import type { SupabaseClient } from "@supabase/supabase-js";
import { transitionRound } from "./stateMachine";
import type { RoundStatus } from "@/lib/types/game";
import { logger } from "@/lib/observability/logger";

/**
 * Manual review auto-accept timeout in milliseconds.
 * After this duration, unreviewed answers are auto-accepted.
 * Independent of the round-backstop Edge Function.
 */
const MANUAL_REVIEW_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Check if a round in manual_review has timed out and should auto-accept.
 * Called by timer-expired and done route handlers, NOT by round-backstop.
 *
 * Returns true if the round was auto-accepted.
 */
export async function checkManualReviewTimeout(
  roundId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data: round } = await supabase
    .from("rounds")
    .select("id, status, ended_at")
    .eq("id", roundId)
    .single();

  if (!round || round.status !== "manual_review") return false;

  const endedAt = round.ended_at ? new Date(round.ended_at).getTime() : Date.now();
  const elapsed = Date.now() - endedAt;

  if (elapsed < MANUAL_REVIEW_TIMEOUT_MS) return false;

  // Auto-accept: transition to completed without host review
  try {
    transitionRound(round.status as RoundStatus, "complete_review");
    await supabase.from("rounds").update({ status: "completed" }).eq("id", roundId);

    logger.info("manualReview: auto-accepted after timeout", {
      roundId,
      elapsedMs: elapsed,
      timeoutMs: MANUAL_REVIEW_TIMEOUT_MS,
    });

    return true;
  } catch (err) {
    logger.error("manualReview: auto-accept transition failed", {
      roundId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Determine if a round should enter manual review.
 *
 * In multiplayer: enters manual_review when AI validation had low-confidence
 * results or validation entirely failed (host decides).
 *
 * In solo mode with both providers down: use optimistic letter-only acceptance
 * (if the answer starts with the correct letter, accept it).
 */
export function shouldEnterManualReview(
  aiValidationFailed: boolean,
  isSoloMode: boolean,
): { status: "reviewing" | "manual_review"; reason: string } {
  if (!aiValidationFailed) {
    return { status: "reviewing", reason: "AI validation succeeded" };
  }

  if (isSoloMode) {
    // Solo mode degradation: don't enter manual review (no host to review).
    // Word-list fallback already ran. Accept results as-is.
    return { status: "reviewing", reason: "solo mode degradation: word-list fallback used" };
  }

  // Multiplayer: host needs to review flagged answers
  return { status: "manual_review", reason: "AI validation failed, host review required" };
}

/**
 * Auto-accept all pending manual review rounds that have timed out.
 * Can be called periodically by a scheduled check.
 */
export async function drainTimedOutReviews(
  supabase: SupabaseClient,
): Promise<{ drained: number }> {
  const cutoff = new Date(Date.now() - MANUAL_REVIEW_TIMEOUT_MS).toISOString();

  const { data: staleRounds } = await supabase
    .from("rounds")
    .select("id")
    .eq("status", "manual_review")
    .lt("ended_at", cutoff);

  if (!staleRounds || staleRounds.length === 0) {
    return { drained: 0 };
  }

  let drained = 0;
  for (const round of staleRounds) {
    const accepted = await checkManualReviewTimeout(round.id, supabase);
    if (accepted) drained++;
  }

  if (drained > 0) {
    logger.info("manualReview: drained timed-out reviews", { drained, total: staleRounds.length });
  }

  return { drained };
}
