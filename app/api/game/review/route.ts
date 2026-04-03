import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { transitionRound } from '@/lib/game/stateMachine';
import { logger } from '@/lib/observability/logger';
import type { RoundStatus } from '@/lib/types/game';

const schema = z.object({
  round_id: z.string().uuid(),
  overrides: z.array(z.object({
    answer_id: z.string().uuid(),
    is_valid: z.boolean(),
  })),
});

export async function POST(request: NextRequest) {
  const supabaseServer = createClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
  }

  let parsed;
  try {
    const body = await request.json();
    parsed = schema.parse(body);
  } catch {
    return Response.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get round and verify host
  const { data: round } = await supabase
    .from('rounds')
    .select('id, game_id, status')
    .eq('id', parsed.round_id)
    .single();

  if (!round) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Round not found' } }, { status: 404 });

  const { data: game } = await supabase
    .from('game_sessions')
    .select('created_by')
    .eq('id', round.game_id)
    .single();

  if (!game || game.created_by !== user.id) {
    return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only the host can review answers' } }, { status: 403 });
  }

  if (round.status !== 'manual_review' && round.status !== 'reviewing') {
    return Response.json({ ok: false, error: { code: 'INVALID_STATE', message: 'Round is not in review state' } }, { status: 409 });
  }

  // Apply overrides
  for (const override of parsed.overrides) {
    const score = override.is_valid ? 10 : 0; // Simplified: valid=10, invalid=0. Uniqueness already computed.
    await supabase
      .from('answers')
      .update({ is_valid: override.is_valid, score })
      .eq('id', override.answer_id);
  }

  // Transition to completed
  try {
    transitionRound(round.status as RoundStatus, 'complete_review');
    await supabase.from('rounds').update({ status: 'completed' }).eq('id', parsed.round_id);
  } catch {
    return Response.json({ ok: false, error: { code: 'TRANSITION_FAILED', message: 'Failed to complete review' } }, { status: 500 });
  }

  logger.info('Review completed', { roundId: parsed.round_id, overrides: parsed.overrides.length });
  return Response.json({ ok: true, data: { status: 'review_complete' } });
}
