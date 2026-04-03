/**
 * Rebuild player_stats from game data.
 *
 * Recomputes aggregated statistics for one or more players by scanning their
 * game_players + answers history. Designed for:
 * - Stats refresh queue draining (per-player incremental rebuild)
 * - Backfill (bulk recomputation for all players)
 *
 * Deterministic: given the same game data, always produces the same stats.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/observability/logger";

interface ComputedPlayerStats {
  playerId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  avgScorePerRound: number;
  uniqueAnswersCount: number;
  fastestAnswerMs: number | null;
  strongestCategory: string | null;
  weakestCategory: string | null;
}

/**
 * Rebuild stats for a list of player IDs.
 *
 * For each player:
 * 1. Count finished games played and won (rank === 1)
 * 2. Sum total score across all finished games
 * 3. Compute avg score per round
 * 4. Count unique valid answers
 * 5. Find fastest answer (ms between round start and answer submit)
 * 6. Find strongest/weakest categories by valid answer ratio
 *
 * Writes results to player_stats (upsert).
 */
export async function rebuildPlayerStats(
  playerIds: string[],
  supabaseAdmin: SupabaseClient,
): Promise<ComputedPlayerStats[]> {
  if (playerIds.length === 0) return [];

  const results: ComputedPlayerStats[] = [];

  for (const playerId of playerIds) {
    try {
      const stats = await rebuildSinglePlayer(playerId, supabaseAdmin);
      results.push(stats);

      // Upsert to player_stats
      const { error } = await supabaseAdmin.from("player_stats").upsert(
        {
          player_id: stats.playerId,
          games_played: stats.gamesPlayed,
          games_won: stats.gamesWon,
          total_score: stats.totalScore,
          avg_score_per_round: stats.avgScorePerRound,
          unique_answers_count: stats.uniqueAnswersCount,
          fastest_answer_ms: stats.fastestAnswerMs,
          strongest_category: stats.strongestCategory,
          weakest_category: stats.weakestCategory,
        },
        { onConflict: "player_id" },
      );

      if (error) {
        logger.error("rebuildPlayerStats: upsert failed", {
          playerId,
          error: error.message,
        });
      }
    } catch (err) {
      logger.error("rebuildPlayerStats: failed for player", {
        playerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

async function rebuildSinglePlayer(
  playerId: string,
  supabaseAdmin: SupabaseClient,
): Promise<ComputedPlayerStats> {
  // Fetch all game_players rows for finished games
  const { data: gamePlayers, error: gpError } = await supabaseAdmin
    .from("game_players")
    .select("game_id, score_total, rank, game_sessions!inner(status)")
    .eq("player_id", playerId)
    .eq("game_sessions.status", "finished");

  if (gpError) {
    throw new Error(`Failed to fetch game_players: ${gpError.message}`);
  }

  const finishedGames = gamePlayers ?? [];
  const gamesPlayed = finishedGames.length;
  const gamesWon = finishedGames.filter((g) => g.rank === 1).length;
  const totalScore = finishedGames.reduce((sum, g) => sum + (g.score_total ?? 0), 0);

  // Count total rounds this player participated in (across finished games)
  const gameIds = finishedGames.map((g) => g.game_id);
  let totalRounds = 0;

  if (gameIds.length > 0) {
    const { data: rounds, error: roundsError } = await supabaseAdmin
      .from("rounds")
      .select("id")
      .in("game_id", gameIds);

    if (roundsError) {
      throw new Error(`Failed to fetch rounds: ${roundsError.message}`);
    }
    totalRounds = rounds?.length ?? 0;
  }

  const avgScorePerRound = totalRounds > 0 ? totalScore / totalRounds : 0;

  // Fetch all answers for this player in finished games
  let uniqueAnswersCount = 0;
  let fastestAnswerMs: number | null = null;
  const categoryValid = new Map<string, number>();
  const categoryTotal = new Map<string, number>();

  if (gameIds.length > 0) {
    // Get round IDs for finished games
    const { data: roundsData } = await supabaseAdmin
      .from("rounds")
      .select("id, started_at")
      .in("game_id", gameIds);

    const roundStartTimes = new Map<string, string>();
    for (const r of roundsData ?? []) {
      roundStartTimes.set(r.id, r.started_at);
    }

    const roundIds = Array.from(roundStartTimes.keys());

    if (roundIds.length > 0) {
      const { data: answers, error: answersError } = await supabaseAdmin
        .from("answers")
        .select("round_id, category, is_valid, is_unique, submitted_at, answer_text")
        .eq("player_id", playerId)
        .in("round_id", roundIds);

      if (answersError) {
        throw new Error(`Failed to fetch answers: ${answersError.message}`);
      }

      for (const a of answers ?? []) {
        const cat = a.category;

        // Track category totals (non-empty answers only)
        if (a.answer_text && a.answer_text.trim() !== "") {
          categoryTotal.set(cat, (categoryTotal.get(cat) ?? 0) + 1);

          if (a.is_valid) {
            categoryValid.set(cat, (categoryValid.get(cat) ?? 0) + 1);
          }
        }

        // Count unique valid answers
        if (a.is_unique && a.is_valid) {
          uniqueAnswersCount++;
        }

        // Fastest answer: time from round start to submitted_at
        if (a.submitted_at && a.is_valid) {
          const roundStart = roundStartTimes.get(a.round_id);
          if (roundStart) {
            const ms =
              new Date(a.submitted_at).getTime() - new Date(roundStart).getTime();
            if (ms > 0 && (fastestAnswerMs === null || ms < fastestAnswerMs)) {
              fastestAnswerMs = ms;
            }
          }
        }
      }
    }
  }

  // Determine strongest and weakest categories by valid/total ratio
  let strongestCategory: string | null = null;
  let weakestCategory: string | null = null;
  let bestRatio = -1;
  let worstRatio = 2;

  for (const [cat, total] of categoryTotal.entries()) {
    if (total === 0) continue;
    const valid = categoryValid.get(cat) ?? 0;
    const ratio = valid / total;

    if (ratio > bestRatio) {
      bestRatio = ratio;
      strongestCategory = cat;
    }
    if (ratio < worstRatio) {
      worstRatio = ratio;
      weakestCategory = cat;
    }
  }

  // If all categories have same ratio, strongest === weakest → null out weakest
  if (strongestCategory === weakestCategory) {
    weakestCategory = null;
  }

  return {
    playerId,
    gamesPlayed,
    gamesWon,
    totalScore,
    avgScorePerRound: Math.round(avgScorePerRound * 100) / 100,
    uniqueAnswersCount,
    fastestAnswerMs,
    strongestCategory,
    weakestCategory,
  };
}
