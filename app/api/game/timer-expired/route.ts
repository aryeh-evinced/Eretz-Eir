import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { submitRound } from '@/lib/game/submitRound';
import { logger } from '@/lib/observability/logger';

const schema = z.object({
  game_id: z.string().uuid(),
  round_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  // Authenticate
  const supabaseServer = createClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
  }

  // Parse body
  let parsed;
  try {
    const body = await request.json();
    parsed = schema.parse(body);
  } catch {
    return Response.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get round — idempotent check
  const { data: round } = await supabase
    .from('rounds')
    .select('id, game_id, status')
    .eq('id', parsed.round_id)
    .single();

  if (!round) {
    return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Round not found' } }, { status: 404 });
  }

  // Idempotent: if not playing, return success
  if (round.status !== 'playing') {
    logger.info('Timer expired but round already processed', { roundId: parsed.round_id, status: round.status });
    return Response.json({ ok: true, data: { status: 'already_processed' } });
  }

  // Score the round
  try {
    const results = await submitRound(parsed.round_id, parsed.game_id, supabase);
    return Response.json({ ok: true, data: { status: 'round_scored', results } });
  } catch (err) {
    logger.error('Timer expired scoring failed', { roundId: parsed.round_id, error: err instanceof Error ? err.message : String(err) });
    return Response.json({ ok: false, error: { code: 'SCORE_FAILED', message: 'Failed to score round' } }, { status: 500 });
  }
}
