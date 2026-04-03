/**
 * Game finalization — compute final ranks, persist to game_players, enqueue stats refresh.
 *
 * Called when a game transitions to "finished". Orchestrates:
 * 1. Fetch all round scores for the game
 * 2. Compute game-level ranking via computeGameRanking
 * 3. Persist rank + final score_total to game_players
 * 4. Enqueue affected player IDs in stats_refresh_queue
 * 5. Set finished_at on game_sessions
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeGameRanking, type RankedPlayer } from "@/lib/game/ranking";
import { logger } from "@/lib/observability/logger";

export interface FinalizedGame {
  gameId: string;
  rankings: RankedPlayer[];
  enqueuedPlayerIds: string[];
}

/**
 * Finalize a game: compute ranks from round-level answer scores, persist ranks,
 * enqueue players for stats refresh.
 *
 * Idempotent: re-running on an already-finalized game overwrites rank values
 * with the same computed values and re-enqueues (upsert) stats refresh.
 */
export async function finalizeGame(
  gameId: string,
  supabaseAdmin: SupabaseClient,
): Promise<FinalizedGame> {
  logger.info("finalizeGame: starting", { gameId });

  // ── 1. Fetch all rounds for this game ────────────────────────────────────
  const { data: rounds, error: roundsError } = await supabaseAdmin
    .from("rounds")
    .select("id, round_number")
    .eq("game_id", gameId)
    .order("round_number", { ascending: true });

  if (roundsError) {
    throw new Error(`finalizeGame: failed to fetch rounds: ${roundsError.message}`);
  }

  if (!rounds || rounds.length === 0) {
    logger.warn("finalizeGame: no rounds found", { gameId });
    return { gameId, rankings: [], enqueuedPlayerIds: [] };
  }

  // ── 2. Fetch answers for all rounds and build per-round score maps ───────
  const roundIds = rounds.map((r) => r.id);

  const { data: answers, error: answersError } = await supabaseAdmin
    .from("answers")
    .select("round_id, player_id, score")
    .in("round_id", roundIds);

  if (answersError) {
    throw new Error(`finalizeGame: failed to fetch answers: ${answersError.message}`);
  }

  // Group answers by round_id, then sum scores per player within each round.
  const roundScoreMaps: Map<string, number>[] = [];

  for (const round of rounds) {
    const roundAnswers = (answers ?? []).filter((a) => a.round_id === round.id);
    const playerScores = new Map<string, number>();

    for (const a of roundAnswers) {
      const current = playerScores.get(a.player_id) ?? 0;
      playerScores.set(a.player_id, current + (a.score ?? 0));
    }

    roundScoreMaps.push(playerScores);
  }

  // ── 3. Compute game-level ranking ────────────────────────────────────────
  const rankings = computeGameRanking(roundScoreMaps);

  logger.info("finalizeGame: rankings computed", {
    gameId,
    playerCount: rankings.length,
    topScore: rankings[0]?.totalScore ?? 0,
  });

  // ── 4. Persist rank + score_total to game_players ────────────────────────
  for (const ranked of rankings) {
    const { error } = await supabaseAdmin
      .from("game_players")
      .update({ rank: ranked.rank, score_total: ranked.totalScore })
      .eq("game_id", gameId)
      .eq("player_id", ranked.playerId);

    if (error) {
      logger.error("finalizeGame: failed to update game_players", {
        gameId,
        playerId: ranked.playerId,
        error: error.message,
      });
      // Continue — best effort for remaining players
    }
  }

  // ── 5. Set finished_at on game_sessions ──────────────────────────────────
  const { error: finishError } = await supabaseAdmin
    .from("game_sessions")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  if (finishError) {
    logger.error("finalizeGame: failed to update game_sessions", {
      gameId,
      error: finishError.message,
    });
  }

  // ── 6. Enqueue affected players for stats refresh ────────────────────────
  const playerIds = rankings.map((r) => r.playerId);
  const enqueuedPlayerIds: string[] = [];

  if (playerIds.length > 0) {
    const queueRows = playerIds.map((id) => ({ player_id: id }));

    // Upsert: if player already in queue, update queued_at to now().
    const { error: queueError } = await supabaseAdmin
      .from("stats_refresh_queue")
      .upsert(queueRows, { onConflict: "player_id" });

    if (queueError) {
      logger.error("finalizeGame: failed to enqueue stats refresh", {
        gameId,
        error: queueError.message,
      });
    } else {
      enqueuedPlayerIds.push(...playerIds);
    }
  }

  logger.info("finalizeGame: complete", {
    gameId,
    rankedPlayers: rankings.length,
    enqueuedPlayers: enqueuedPlayerIds.length,
  });

  return { gameId, rankings, enqueuedPlayerIds };
}
