import Database from "better-sqlite3";
import { resolve } from "path";
import { sanitizeAnswer } from "@/lib/game/normalization";

const DB_PATH = resolve(process.cwd(), "data", "words.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("synchronous = NORMAL");
    ensureSchema(_db);
  }
  return _db;
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      letter TEXT NOT NULL,
      category TEXT NOT NULL,
      word TEXT NOT NULL,
      normalized TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(letter, category, normalized)
    );
    CREATE INDEX IF NOT EXISTS idx_words_lookup ON words(letter, category, normalized);
    CREATE INDEX IF NOT EXISTS idx_words_letter ON words(letter);
  `);
}

// Pre-built in-memory index for O(1) lookups at runtime
let _index: Map<string, Set<string>> | null = null;

function buildIndex(): Map<string, Set<string>> {
  const db = getDb();
  const rows = db.prepare("SELECT letter, category, normalized FROM words").all() as {
    letter: string;
    category: string;
    normalized: string;
  }[];

  const index = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${row.letter}:${row.category}`;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)!.add(row.normalized);
  }
  return index;
}

function getIndex(): Map<string, Set<string>> {
  if (!_index) _index = buildIndex();
  return _index;
}

export function validateWord(answer: string, letter: string, category: string): boolean {
  const normalized = sanitizeAnswer(answer).trim();
  if (!normalized || !normalized.startsWith(letter)) return false;

  const index = getIndex();
  const key = `${letter}:${category}`;
  const wordSet = index.get(key);
  if (!wordSet || wordSet.size === 0) return false;
  return wordSet.has(normalized);
}

export function getRandomWord(letter: string, category: string): string {
  const db = getDb();
  const row = db
    .prepare("SELECT word FROM words WHERE letter = ? AND category = ? ORDER BY RANDOM() LIMIT 1")
    .get(letter, category) as { word: string } | undefined;
  return row?.word ?? "";
}

export function getHint(letter: string, category: string): string {
  const word = getRandomWord(letter, category);
  if (!word) return `${letter}...`;
  return word.length > 2 ? `${word.slice(0, 2)}...` : `${word}...`;
}

export function insertWord(
  letter: string,
  category: string,
  word: string,
  source: string = "llm",
): boolean {
  const normalized = sanitizeAnswer(word).trim();
  if (!normalized || !normalized.startsWith(letter)) return false;

  const db = getDb();
  try {
    db.prepare(
      "INSERT OR IGNORE INTO words (letter, category, word, normalized, source) VALUES (?, ?, ?, ?, ?)",
    ).run(letter, category, word.trim(), normalized, source);
    // Invalidate the in-memory index so next lookup rebuilds it
    _index = null;
    return true;
  } catch {
    return false;
  }
}

export function insertWords(
  entries: { letter: string; category: string; word: string; source?: string }[],
): number {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO words (letter, category, word, normalized, source) VALUES (?, ?, ?, ?, ?)",
  );

  let inserted = 0;
  const tx = db.transaction(() => {
    for (const e of entries) {
      const normalized = sanitizeAnswer(e.word).trim();
      if (!normalized || !normalized.startsWith(e.letter)) continue;
      const result = stmt.run(e.letter, e.category, e.word.trim(), normalized, e.source ?? "seed");
      if (result.changes > 0) inserted++;
    }
  });
  tx();
  _index = null;
  return inserted;
}

export function getWordCount(letter?: string, category?: string): number {
  const db = getDb();
  if (letter && category) {
    return (db.prepare("SELECT COUNT(*) as c FROM words WHERE letter = ? AND category = ?").get(letter, category) as { c: number }).c;
  }
  if (letter) {
    return (db.prepare("SELECT COUNT(*) as c FROM words WHERE letter = ?").get(letter) as { c: number }).c;
  }
  if (category) {
    return (db.prepare("SELECT COUNT(*) as c FROM words WHERE category = ?").get(category) as { c: number }).c;
  }
  return (db.prepare("SELECT COUNT(*) as c FROM words").get() as { c: number }).c;
}

export function getStats(): { letter: string; category: string; count: number }[] {
  const db = getDb();
  return db
    .prepare("SELECT letter, category, COUNT(*) as count FROM words GROUP BY letter, category ORDER BY letter, category")
    .all() as { letter: string; category: string; count: number }[];
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _index = null;
  }
}
