import type { SupabaseClient } from "@supabase/supabase-js";
import type { Answer, Category, HebrewLetter, RoundStatus, ValidatedAnswer } from "@/lib/types/game";
import { validateAnswers } from "@/lib/game/validator";
import { computeUniqueness } from "@/lib/game/uniqueness";
import { scoreAnswer } from "@/lib/game/scoring";
import { transitionRound } from "@/lib/game/stateMachine";
import { shouldEnterManualReview } from "@/lib/game/manualReview";
import { logger } from "@/lib/observability/logger";

export interface ScoredRoundResult {
  roundId: string;
  letter: string;
  playerResults: Array<{
    playerId: string;
    answers: Array<{
      answerId: string;
      category: string;
      text: string | null;
      isValid: boolean;
      isUnique: boolean;
      score: number;
      speedBonus: number;
    }>;
    totalScore: number;
  }>;
}

/**
 * Submit and score a completed round.
 *
 * Steps:
 * 1. Fetch round (must be in "playing" status)
 * 2. Fetch all answers for the round
 * 3. Validate answers using word-list fallback validator
 * 4. Compute uniqueness across all players
 * 5. Score each answer
 * 6. Write validated answers + scores back to DB (best-effort atomic: sequential awaits)
 * 7. Transition round status to "reviewing"
 * 8. Return ScoredRoundResult
 */
export async function submitRound(
  roundId: string,
  gameId: string,
  supabaseAdmin: SupabaseClient,
): Promise<ScoredRoundResult> {
  // ── 1. Fetch round ─────────────────────────────────────────────────────────
  logger.info("submitRound: fetching round", { roundId, gameId });

  const { data: round, error: roundError } = await supabaseAdmin
    .from("rounds")
    .select("*")
    .eq("id", roundId)
    .single();

  if (roundError || !round) {
    throw new Error(`submitRound: round not found (id=${roundId}): ${roundError?.message ?? "no data"}`);
  }

  if (round.game_id !== gameId) {
    throw new Error(`submitRound: round ${roundId} does not belong to game ${gameId}`);
  }

  // Validate that start_review is a legal transition — throws if not in "playing".
  // Actual nextStatus is deferred until after AI validation to decide reviewing vs manual_review.
  transitionRound(round.status as RoundStatus, "start_review");
  logger.info("submitRound: round fetched, transition validated", {
    roundId,
    currentStatus: round.status,
    letter: round.letter,
  });

  // Determine game mode for manual review decisions
  const { data: gameSession } = await supabaseAdmin
    .from("game_sessions")
    .select("mode")
    .eq("id", gameId)
    .single();
  const isSoloMode = gameSession?.mode === "solo";

  // ── 2. Fetch answers ───────────────────────────────────────────────────────
  const { data: rawAnswers, error: answersError } = await supabaseAdmin
    .from("answers")
    .select("*")
    .eq("round_id", roundId);

  if (answersError) {
    throw new Error(`submitRound: failed to fetch answers for round ${roundId}: ${answersError.message}`);
  }

  const answers: Answer[] = (rawAnswers ?? []).map((row) => ({
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    category: row.category as Category,
    answerText: row.answer_text ?? null,
    submittedAt: row.submitted_at ?? null,
    isValid: row.is_valid ?? null,
    startsWithLetter: row.starts_with_letter ?? null,
    isRealWord: row.is_real_word ?? null,
    matchesCategory: row.matches_category ?? null,
    aiExplanation: row.ai_explanation ?? null,
    isUnique: row.is_unique ?? null,
    helpUsed: row.help_used ?? "none",
    speedBonus: row.speed_bonus ?? false,
    score: row.score ?? 0,
  }));

  logger.info("submitRound: answers fetched", { roundId, count: answers.length });

  // ── 3. Validate answers per player ────────────────────────────────────────
  const playerIds = [...new Set(answers.map((a) => a.playerId))];

  // Map: playerId -> their answers
  const answersByPlayer = new Map<string, Answer[]>();
  for (const playerId of playerIds) {
    answersByPlayer.set(
      playerId,
      answers.filter((a) => a.playerId === playerId),
    );
  }

  // Map: answerId -> valid
  // The hybrid validator checks the word DB first (instant), then AI for misses.
  const validationMap = new Map<string, boolean>();
  let aiValidationFailed = false;

  for (const [playerId, playerAnswers] of answersByPlayer.entries()) {
    const answerList = playerAnswers
      .filter((a) => a.answerText !== null && a.answerText.trim() !== "")
      .map((a) => ({ category: a.category, text: a.answerText as string }));

    const validation = new Map<string, boolean>();

    if (answerList.length > 0) {
      try {
        const result = await validateAnswers(
          { roundId, letter: round.letter as HebrewLetter, answers: answerList },
          supabaseAdmin,
        );
        for (const v of result.validations) {
          validation.set(v.category, v.isValid);
        }
        logger.info("submitRound: validation complete for player", {
          playerId,
          validCount: result.validations.filter((v) => v.isValid).length,
          totalChecked: answerList.length,
        });
      } catch (err) {
        aiValidationFailed = true;
        logger.warn("submitRound: validation failed for player", {
          playerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const a of playerAnswers) {
      if (!a.answerText || a.answerText.trim() === "") {
        validationMap.set(a.id, false);
      } else {
        validationMap.set(a.id, validation.get(a.category) ?? false);
      }
    }
  }

  // ── 4. Compute uniqueness ──────────────────────────────────────────────────
  const answersGroupedByPlayer: Answer[][] = playerIds.map(
    (pid) => answersByPlayer.get(pid) ?? [],
  );
  const uniquenessMap = computeUniqueness(answersGroupedByPlayer);
  logger.info("submitRound: uniqueness computed", { roundId });

  // ── 5. Score answers ──────────────────────────────────────────────────────
  // Sentinel timestamp used when submittedAt is missing — sorts last so the
  // answer never wins the speed bonus but still participates in uniqueness.
  const FAR_FUTURE = new Date(8640000000000000).toISOString();

  // Build ValidatedAnswer[] with resolved isValid/isUnique for all answers.
  // Only include answers with non-empty text AND isValid === true in the pool
  // used for scoring (uniqueness comparison and speed-bonus ordering).
  const validatedAnswers: ValidatedAnswer[] = answers
    .filter((a) => a.answerText !== null && a.answerText.trim() !== "" && (validationMap.get(a.id) ?? false))
    .map((a) => ({
      playerId: a.playerId,
      category: a.category,
      text: a.answerText as string,
      submittedAt: a.submittedAt ?? FAR_FUTURE,
      isValid: validationMap.get(a.id) ?? false,
      isUnique: uniquenessMap.get(a.id) ?? false,
    }));

  // Map: answerId -> AnswerScore
  const scoreMap = new Map<string, { base: number; speedBonus: number; total: number }>();
  for (const a of answers) {
    if (a.answerText !== null && a.answerText.trim() !== "") {
      const isValid = validationMap.get(a.id) ?? false;
      const va: ValidatedAnswer = {
        playerId: a.playerId,
        category: a.category,
        text: a.answerText,
        submittedAt: a.submittedAt ?? FAR_FUTURE,
        isValid,
        isUnique: uniquenessMap.get(a.id) ?? false,
      };
      scoreMap.set(a.id, scoreAnswer(va, validatedAnswers));
    } else {
      scoreMap.set(a.id, { base: 0, speedBonus: 0, total: 0 });
    }
  }

  logger.info("submitRound: scoring complete", { roundId });

  // ── 6. Write back to DB ────────────────────────────────────────────────────
  // Batch all answer updates in parallel to avoid N sequential round-trips.
  try {
    const updateResults = await Promise.all(
      answers.map((a) => {
        const isValid = validationMap.get(a.id) ?? false;
        const isUnique = uniquenessMap.get(a.id) ?? false;
        const scored = scoreMap.get(a.id) ?? { base: 0, speedBonus: 0, total: 0 };

        return supabaseAdmin
          .from("answers")
          .update({
            is_valid: isValid,
            is_unique: isUnique,
            speed_bonus: scored.speedBonus > 0,
            score: scored.total,
          })
          .eq("id", a.id)
          .then((result) => {
            if (result.error) {
              throw new Error(`submitRound: failed to update answer ${a.id}: ${result.error.message}`);
            }
          });
      }),
    );

    logger.info("submitRound: answers written to DB", { roundId, count: updateResults.length });

    // Determine review status based on AI validation outcome
    const reviewDecision = shouldEnterManualReview(aiValidationFailed, isSoloMode);
    const nextStatus = reviewDecision.status;

    // Update round status
    const { error: roundUpdateError } = await supabaseAdmin
      .from("rounds")
      .update({
        status: nextStatus,
        ended_at: new Date().toISOString(),
      })
      .eq("id", roundId);

    if (roundUpdateError) {
      throw new Error(`submitRound: failed to update round status: ${roundUpdateError.message}`);
    }

    logger.info("submitRound: round status updated", {
      roundId,
      nextStatus,
      aiValidationFailed,
      reviewReason: reviewDecision.reason,
    });
  } catch (err) {
    logger.error("submitRound: DB write failed (partial updates may have occurred)", {
      roundId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // ── 7. Build and return ScoredRoundResult ──────────────────────────────────
  const playerResults = playerIds.map((playerId) => {
    const playerAnswers = answersByPlayer.get(playerId) ?? [];
    const playerAnswerResults = playerAnswers.map((a) => {
      const scored = scoreMap.get(a.id) ?? { base: 0, speedBonus: 0, total: 0 };
      return {
        answerId: a.id,
        category: a.category,
        text: a.answerText,
        isValid: validationMap.get(a.id) ?? false,
        isUnique: uniquenessMap.get(a.id) ?? false,
        score: scored.total,
        speedBonus: scored.speedBonus,
      };
    });

    const totalScore = playerAnswerResults.reduce((sum, r) => sum + r.score, 0);

    return { playerId, answers: playerAnswerResults, totalScore };
  });

  logger.info("submitRound: complete", {
    roundId,
    playerCount: playerResults.length,
    totalAnswers: answers.length,
  });

  return {
    roundId,
    letter: round.letter as string,
    playerResults,
  };
}
