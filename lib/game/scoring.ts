import type { ValidatedAnswer, AnswerScore } from "@/lib/types/game";
import { fuzzyMatch } from "./normalization";

/**
 * Score a single answer against all answers in the same round.
 * Returns base points (0/5/10) + speed bonus (0/3).
 */
export function scoreAnswer(answer: ValidatedAnswer, allAnswers: ValidatedAnswer[]): AnswerScore {
  if (!answer.text || !answer.isValid) {
    return { base: 0, speedBonus: 0, total: 0 };
  }

  const sameCategory = allAnswers.filter(
    (a) => a.category === answer.category && a.playerId !== answer.playerId && a.isValid,
  );

  const isUnique = !sameCategory.some((a) => fuzzyMatch(a.text, answer.text));
  const base = isUnique ? 10 : 5;

  const validInCategory = allAnswers
    .filter((a) => a.category === answer.category && a.isValid)
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  const speedBonus = validInCategory[0]?.playerId === answer.playerId ? 3 : 0;

  return { base, speedBonus, total: base + speedBonus };
}
