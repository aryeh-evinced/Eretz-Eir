#!/usr/bin/env npx tsx
/**
 * Import existing data/word-lists.json into the SQLite word database.
 * Safe to run multiple times (INSERT OR IGNORE).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import Database from "better-sqlite3";

const DB_PATH = resolve(__dirname, "..", "data", "words.db");
const JSON_PATH = resolve(__dirname, "..", "data", "word-lists.json");

function sanitize(text: string): string {
  return text
    .slice(0, 30)
    .replace(/[\n\r\t\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[{}[\]]/g, "")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/['"״׳]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function main(): void {
  const raw = readFileSync(JSON_PATH, "utf-8");
  const data: Record<string, Record<string, string[]>> = JSON.parse(raw);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

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

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO words (letter, category, word, normalized, source) VALUES (?, ?, ?, ?, ?)",
  );

  let total = 0;
  let inserted = 0;

  const tx = db.transaction(() => {
    for (const [letter, categories] of Object.entries(data)) {
      for (const [category, words] of Object.entries(categories)) {
        for (const word of words) {
          total++;
          const normalized = sanitize(word);
          if (!normalized || !normalized.startsWith(letter)) {
            console.warn(`  SKIP: "${word}" does not start with "${letter}" in ${category}`);
            continue;
          }
          const result = stmt.run(letter, category, word.trim(), normalized, "json-seed");
          if (result.changes > 0) inserted++;
        }
      }
    }
  });
  tx();

  const count = (db.prepare("SELECT COUNT(*) as c FROM words").get() as { c: number }).c;
  console.log(`Imported ${inserted} new words (${total} total from JSON). DB now has ${count} words.`);
  db.close();
}

main();
