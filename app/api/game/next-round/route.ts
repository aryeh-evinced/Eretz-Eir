import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { drawLetter } from '@/lib/game/letters';
import { logger } from '@/lib/observability/logger';
import type { HebrewLetter } from '@/lib/types/game';

const schema = z.object({ game_id: z.string().uuid() });

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

  // Verify host
  const { data: game } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', parsed.game_id)
    .single();

  if (!game) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Game not found' } }, { status: 404 });
  if (game.created_by !== user.id) return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only the host can advance rounds' } }, { status: 403 });

  // Get current round, verify it's completed
  const { data: currentRound } = await supabase
    .from('rounds')
    .select('*')
    .eq('game_id', parsed.game_id)
    .order('round_number', { ascending: false })
    .limit(1)
    .single();

  if (!currentRound || currentRound.status !== 'completed') {
    return Response.json({ ok: false, error: { code: 'INVALID_STATE', message: 'Current round is not completed' } }, { status: 409 });
  }

  // Get used letters
  const { data: allRounds } = await supabase
    .from('rounds')
    .select('letter')
    .eq('game_id', parsed.game_id);

  const usedLetters = (allRounds ?? []).map(r => r.letter as HebrewLetter);
  const letter = drawLetter(usedLetters);
  const categories = game.categories as string[];
  const nextRoundNumber = (currentRound.round_number as number) + 1;

  // Create next round
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      game_id: parsed.game_id,
      round_number: nextRoundNumber,
      letter,
      categories,
      status: 'playing',
    })
    .select('id')
    .single();

  if (roundError || !round) return Response.json({ ok: false, error: { code: 'CREATE_ROUND_FAILED', message: 'Failed to create round' } }, { status: 500 });

  // Create empty answer rows
  const { data: players } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', parsed.game_id);

  if (players) {
    const answerRows = players.flatMap(p =>
      categories.map(cat => ({
        round_id: round.id,
        player_id: p.player_id,
        category: cat,
        answer_text: null,
        is_valid: null,
        is_unique: null,
        help_used: 'none' as const,
        speed_bonus: false,
        score: 0,
      }))
    );
    await supabase.from('answers').insert(answerRows);
  }

  logger.info('Next round started', { gameId: parsed.game_id, roundId: round.id, roundNumber: nextRoundNumber, letter });
  return Response.json({ ok: true, data: { roundId: round.id, letter, categories } });
}
