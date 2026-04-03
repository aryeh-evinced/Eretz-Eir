import type { DifficultyState, AICompetitor } from "@/lib/types/game";

/**
 * Adjust AI competitor difficulty based on player performance.
 * Only activates after 2 rounds of data.
 */
export function adjustDifficulty(
  state: DifficultyState,
  competitors: AICompetitor[],
): AICompetitor[] {
  if (state.roundsPlayed < 2) return competitors;

  return competitors.map((comp) => {
    const adjusted = { ...comp };

    if (state.playerAvgScorePerRound > comp.expectedScore * 1.3) {
      // Player is dominating — make competitors harder
      adjusted.emptyProbability = Math.max(comp.emptyProbability - 5, 2);
      adjusted.mistakeProbability = Math.max(comp.mistakeProbability - 3, 1);
    } else if (state.playerAvgScorePerRound < comp.expectedScore * 0.5) {
      // Player is struggling — ease up
      adjusted.emptyProbability = Math.min(comp.emptyProbability + 8, 40);
      adjusted.mistakeProbability = Math.min(comp.mistakeProbability + 5, 30);
    }

    return adjusted;
  });
}
