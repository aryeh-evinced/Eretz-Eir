#!/usr/bin/env npx tsx
/**
 * Review words added by LLM validation (source = 'llm').
 * Shows each word and lets you approve or reject it.
 *
 * Usage: npx tsx scripts/review-candidates.ts [--auto-approve]
 */

import Database from "better-sqlite3";
import { resolve } from "path";
import { createInterface } from "readline";

const DB_PATH = resolve(__dirname, "..", "data", "words.db");

function main(): void {
  const autoApprove = process.argv.includes("--auto-approve");
  const db = new Database(DB_PATH);

  const candidates = db
    .prepare("SELECT id, letter, category, word, source, created_at FROM words WHERE source = 'llm' ORDER BY created_at DESC")
    .all() as { id: number; letter: string; category: string; word: string; source: string; created_at: string }[];

  if (candidates.length === 0) {
    console.log("No LLM-learned candidates to review.");
    db.close();
    return;
  }

  console.log(`\n${candidates.length} LLM-learned words to review:\n`);

  if (autoApprove) {
    const stmt = db.prepare("UPDATE words SET source = 'approved' WHERE id = ?");
    const tx = db.transaction(() => {
      for (const c of candidates) stmt.run(c.id);
    });
    tx();
    console.log(`Auto-approved ${candidates.length} words.`);
    db.close();
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const deleteStmt = db.prepare("DELETE FROM words WHERE id = ?");
  const approveStmt = db.prepare("UPDATE words SET source = 'approved' WHERE id = ?");

  let idx = 0;
  let approved = 0;
  let rejected = 0;

  function next(): void {
    if (idx >= candidates.length) {
      console.log(`\nDone. Approved: ${approved}, Rejected: ${rejected}`);
      rl.close();
      db.close();
      return;
    }

    const c = candidates[idx];
    rl.question(
      `[${idx + 1}/${candidates.length}] "${c.word}" for ${c.category} (letter ${c.letter}) — (a)pprove / (r)eject / (s)kip / (q)uit? `,
      (answer) => {
        switch (answer.trim().toLowerCase()) {
          case "a":
            approveStmt.run(c.id);
            approved++;
            break;
          case "r":
            deleteStmt.run(c.id);
            rejected++;
            break;
          case "q":
            console.log(`\nStopped. Approved: ${approved}, Rejected: ${rejected}`);
            rl.close();
            db.close();
            return;
          default:
            break;
        }
        idx++;
        next();
      },
    );
  }

  next();
}

main();
