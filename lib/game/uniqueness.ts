import type { Answer, Category } from "@/lib/types/game";
import { fuzzyMatch } from "./normalization";

/**
 * Compute uniqueness for all answers across all players in a round.
 *
 * An answer is unique if no other player gave a fuzzy-matching answer in the
 * same category.  Answers with null or empty answerText are never unique.
 *
 * @param allAnswers - 2D array where each inner array is one player's answers.
 * @returns Map<answerId, boolean> — true means unique, false means shared or invalid.
 */
export function computeUniqueness(allAnswers: Answer[][]): Map<string, boolean> {
  const result = new Map<string, boolean>();

  // Flatten to a single list for cross-player comparison.
  const flat = allAnswers.flat();

  // Group answers by category for efficient comparison.
  const byCategory = new Map<Category, Answer[]>();
  for (const answer of flat) {
    const bucket = byCategory.get(answer.category) ?? [];
    bucket.push(answer);
    byCategory.set(answer.category, bucket);
  }

  for (const answer of flat) {
    // Null or empty text is never unique.
    if (!answer.answerText || answer.answerText.trim() === "") {
      result.set(answer.id, false);
      continue;
    }

    const competitors = (byCategory.get(answer.category) ?? []).filter(
      (other) =>
        other.id !== answer.id &&
        other.playerId !== answer.playerId &&
        other.answerText !== null &&
        other.answerText.trim() !== "",
    );

    const isUnique = !competitors.some((other) =>
      fuzzyMatch(answer.answerText!, other.answerText!),
    );

    result.set(answer.id, isUnique);
  }

  return result;
}
