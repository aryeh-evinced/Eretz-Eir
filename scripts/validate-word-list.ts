#!/usr/bin/env npx tsx
/**
 * Validates data/word-lists.json for completeness and correctness.
 *
 * Checks:
 *  - All 22 Hebrew letters present (no final forms)
 *  - All 20 categories present per letter
 *  - ≥10 words per letter/category (warn if <10, fail if <5)
 *  - Every word starts with the correct Hebrew letter
 *
 * Exit code 0 on pass, 1 on fail.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const EXPECTED_LETTERS = [
  "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י",
  "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר",
  "ש", "ת",
] as const;

const EXPECTED_CATEGORIES = [
  "ארץ", "עיר", "חי", "צומח", "ילד", "ילדה", "מקצוע", "זמר/ת",
  "אוכל", "צבע", "כלי", "משחק", "סרט", "שיר", "ספר", "מותג",
  "ספורט", "לבוש", "גוף", "ריהוט",
] as const;

const MIN_REQUIRED = 5;
const MIN_RECOMMENDED = 10;

interface WordLists {
  [letter: string]: {
    [category: string]: string[];
  };
}

function main(): void {
  const filePath = resolve(__dirname, "..", "data", "word-lists.json");
  const raw = readFileSync(filePath, "utf-8");
  const data: WordLists = JSON.parse(raw);

  let errors = 0;
  let warnings = 0;
  let totalWords = 0;
  let totalEntries = 0;

  // Check all 22 letters are present
  for (const letter of EXPECTED_LETTERS) {
    if (!(letter in data)) {
      console.error(`FAIL: Missing letter "${letter}"`);
      errors++;
      continue;
    }

    const letterData = data[letter];

    // Check all categories per letter
    for (const category of EXPECTED_CATEGORIES) {
      totalEntries++;

      if (!(category in letterData)) {
        console.error(`FAIL: Letter "${letter}" missing category "${category}"`);
        errors++;
        continue;
      }

      const words = letterData[category];
      totalWords += words.length;

      // Check minimum count
      if (words.length < MIN_REQUIRED) {
        console.error(
          `FAIL: "${letter}" / "${category}" has ${words.length} words (minimum ${MIN_REQUIRED})`
        );
        errors++;
      } else if (words.length < MIN_RECOMMENDED) {
        console.warn(
          `WARN: "${letter}" / "${category}" has ${words.length} words (recommended ${MIN_RECOMMENDED})`
        );
        warnings++;
      }

      // Check each word starts with the correct letter
      for (const word of words) {
        if (!word.startsWith(letter)) {
          console.error(
            `FAIL: "${word}" in "${letter}" / "${category}" does not start with "${letter}"`
          );
          errors++;
        }
      }

      // Check for duplicates within the same letter/category
      const unique = new Set(words);
      if (unique.size !== words.length) {
        const dupes = words.filter((w, i) => words.indexOf(w) !== i);
        console.error(
          `FAIL: Duplicates in "${letter}" / "${category}": ${dupes.join(", ")}`
        );
        errors++;
      }
    }
  }

  // Check for unexpected letters in the data
  for (const key of Object.keys(data)) {
    if (!EXPECTED_LETTERS.includes(key as (typeof EXPECTED_LETTERS)[number])) {
      console.error(`FAIL: Unexpected letter "${key}" in data`);
      errors++;
    }
  }

  // Coverage stats
  console.log("\n=== Coverage Stats ===");
  console.log(`Letters: ${Object.keys(data).length} / ${EXPECTED_LETTERS.length}`);
  console.log(`Total entries (letter×category): ${totalEntries}`);
  console.log(`Total words: ${totalWords}`);
  console.log(
    `Average words per entry: ${(totalWords / totalEntries).toFixed(1)}`
  );

  // Per-letter breakdown
  console.log("\n=== Per-Letter Breakdown ===");
  for (const letter of EXPECTED_LETTERS) {
    if (!(letter in data)) continue;
    const counts = EXPECTED_CATEGORIES.map((cat) => {
      const words = data[letter]?.[cat];
      return words ? words.length : 0;
    });
    const total = counts.reduce((a, b) => a + b, 0);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    console.log(
      `  ${letter}: ${total} words (min=${min}, max=${max}) [${counts.join(", ")}]`
    );
  }

  console.log(`\nErrors: ${errors}, Warnings: ${warnings}`);

  if (errors > 0) {
    console.error("\nVALIDATION FAILED");
    process.exit(1);
  } else {
    console.log("\nVALIDATION PASSED");
    process.exit(0);
  }
}

main();
