import wordLists from "@/data/word-lists.json";
import { sanitizeAnswer } from "@/lib/game/normalization";

type WordListData = Record<string, Record<string, string[]>>;
const data = wordLists as WordListData;

/**
 * Validate an answer against the JSON word list.
 * Client-safe — no native dependencies. Used by client components
 * and as the deterministic fallback for server-side validation.
 */
export function validateWithWordList(
  answer: string,
  letter: string,
  category: string,
): boolean {
  const sanitized = sanitizeAnswer(answer).trim();
  if (!sanitized || !sanitized.startsWith(letter)) return false;

  const words = data[letter]?.[category];
  if (!words) return sanitized.startsWith(letter);

  return words.some((w) => sanitizeAnswer(w) === sanitized) || sanitized.startsWith(letter);
}

/**
 * Get a random word from the JSON word list for AI competitor simulation.
 */
export function getRandomWord(letter: string, category: string): string {
  const words = data[letter]?.[category];
  if (!words || words.length === 0) return "";
  return words[Math.floor(Math.random() * words.length)];
}

/**
 * Get a hint for a given letter/category — first 2 characters + "..."
 */
export function getHint(letter: string, category: string): string {
  const words = data[letter]?.[category];
  if (!words || words.length === 0) return `${letter}...`;
  const word = words[Math.floor(Math.random() * words.length)];
  return word.length > 2 ? `${word.slice(0, 2)}...` : `${word}...`;
}

/**
 * Validate all answers for a round using the JSON word list (deterministic fallback).
 */
export function validateAnswersWithWordList(
  answers: Record<string, string>,
  letter: string,
): Record<string, { valid: boolean; score: number }> {
  const results: Record<string, { valid: boolean; score: number }> = {};
  for (const [category, answer] of Object.entries(answers)) {
    const valid = validateWithWordList(answer, letter, category);
    results[category] = { valid, score: valid ? 10 : 0 };
  }
  return results;
}
