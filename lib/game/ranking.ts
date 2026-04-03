/**
 * Ranking and scoring utilities.
 *
 * Phase 4: in-round scoring aggregation and ranking.
 * Phase 6: game_players.rank persistence, post-game aggregation via finalScore.ts.
 */

export interface RankedPlayer {
  playerId: string;
  totalScore: number;
  rank: number;
}

/**
 * Given a map of playerId -> roundScore, return a ranked list sorted
 * descending by score.  Ties receive the same rank.
 *
 * Returns an empty array for an empty map.
 *
 * Phase 4 final: in-round ranking with tie handling.
 */
export function computeRoundRanking(playerScores: Map<string, number>): RankedPlayer[] {
  if (playerScores.size === 0) return [];

  const sorted = Array.from(playerScores.entries())
    .map(([playerId, totalScore]) => ({ playerId, totalScore }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const ranked: RankedPlayer[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].totalScore < sorted[i - 1].totalScore) {
      // Score dropped — next rank is position + 1 (dense ranking would be i+1).
      // Using standard competition ranking: skip ranks equal to the number of tied players.
      currentRank = i + 1;
    }
    ranked.push({ ...sorted[i], rank: currentRank });
  }

  return ranked;
}

/**
 * Aggregate scores across multiple rounds and return a ranked list.
 *
 * Each element of allRoundScores is a Map<playerId, score> for one round.
 * Players missing from a round's map are treated as scoring 0 for that round.
 *
 * Phase 4 final: multi-round aggregation and ranking.
 * Rank persistence and stats enqueue handled by finalScore.ts (Phase 6).
 */
export function computeGameRanking(allRoundScores: Map<string, number>[]): RankedPlayer[] {
  if (allRoundScores.length === 0) return [];

  // Collect all player IDs across all rounds.
  const allPlayerIds = new Set<string>();
  for (const roundScores of allRoundScores) {
    for (const playerId of roundScores.keys()) {
      allPlayerIds.add(playerId);
    }
  }

  if (allPlayerIds.size === 0) return [];

  // Sum scores for each player across all rounds.
  const totals = new Map<string, number>();
  for (const playerId of allPlayerIds) {
    let sum = 0;
    for (const roundScores of allRoundScores) {
      sum += roundScores.get(playerId) ?? 0;
    }
    totals.set(playerId, sum);
  }

  return computeRoundRanking(totals);
}
