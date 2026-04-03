import type { HebrewLetter } from "@/lib/types/game";
import { GAME_LETTERS } from "@/lib/constants/letters";

/**
 * Draw a random letter from the valid Hebrew game letters.
 * Optionally exclude letters already used in prior rounds.
 */
export function drawLetter(excludeLetters: HebrewLetter[] = []): HebrewLetter {
  const available = GAME_LETTERS.filter((l) => !excludeLetters.includes(l));
  const pool = available.length > 0 ? available : [...GAME_LETTERS];
  return pool[Math.floor(Math.random() * pool.length)];
}
