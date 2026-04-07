import { NextRequest } from 'next/server';
import {
  authenticateRequest,
  parseBody,
  successResponse,
  errorResponse,
  verifyParticipant,
} from '@/lib/api/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { submitAnswersSchema } from '@/lib/validation/gameSchemas';
import { submitRound } from '@/lib/game/submitRound';
import { logger } from '@/lib/observability/logger';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, submitAnswersSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const { roundId, answers } = body.data;

  const { data: round } = await supabase
    .from('rounds')
    .select('id, game_id, status')
    .eq('id', roundId)
    .single();

  if (!round) return errorResponse('NOT_FOUND', 'Round not found', 404);

  const isParticipant = await verifyParticipant(
    round.game_id,
    auth.userId,
    supabase,
  );
  if (!isParticipant) {
    return errorResponse(
      'FORBIDDEN',
      'Not a participant in this game',
      403,
    );
  }

  if (round.status !== 'playing') {
    return errorResponse(
      'INVALID_STATE',
      'Round is not accepting answers',
      409,
    );
  }

  const submittedAt = new Date().toISOString();
  for (const answer of answers) {
    await supabase
      .from('answers')
      .update({
        answer_text: answer.text,
        submitted_at: submittedAt,
      })
      .eq('round_id', roundId)
      .eq('player_id', auth.userId)
      .eq('category', answer.category);
  }

  logger.info('Player submitted answers', {
    roundId,
    userId: auth.userId,
    count: answers.length,
  });

  const { data: allAnswers } = await supabase
    .from('answers')
    .select('player_id, answer_text')
    .eq('round_id', roundId);

  const { data: players } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', round.game_id);

  if (allAnswers && players) {
    const playerIds = players.map((p) => p.player_id);
    const allDone = playerIds.every((pid) => {
      const playerAnswers = allAnswers.filter((a) => a.player_id === pid);
      return playerAnswers.some((a) => a.answer_text !== null);
    });

    if (allDone) {
      // Atomically claim the round for scoring: only the first caller that
      // transitions status from 'playing' to 'scoring' proceeds. This
      // prevents concurrent "Done!" requests from triggering submitRound twice.
      const { data: claimed, error: claimError } = await supabase
        .from('rounds')
        .update({ ended_by: 'all_done' })
        .eq('id', roundId)
        .eq('status', 'playing')
        .select('id')
        .single();

      if (claimError || !claimed) {
        logger.info('Round scoring already claimed by another request', { roundId });
        return successResponse({ status: 'submitted' });
      }

      try {
        const results = await submitRound(roundId, round.game_id, supabase);
        return successResponse({ status: 'round_complete', results });
      } catch (err) {
        logger.error('Failed to submit round', {
          roundId,
          error: err instanceof Error ? err.message : String(err),
        });
        return errorResponse('SUBMIT_FAILED', 'Failed to process round', 500);
      }
    }
  }

  return successResponse({ status: 'submitted' });
}
