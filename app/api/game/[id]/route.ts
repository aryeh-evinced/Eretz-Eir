import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/observability/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
  }

  // Check participant (via RLS — game_players is restricted)
  const { data: membership } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', gameId)
    .eq('player_id', user.id)
    .single();

  if (!membership) {
    return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not a participant' } }, { status: 403 });
  }

  // Fetch game state
  const { data: game } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) {
    return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Game not found' } }, { status: 404 });
  }

  // Get room info
  const { data: room } = game.room_id
    ? await supabase.from('rooms').select('code, status').eq('id', game.room_id).single()
    : { data: null };

  // Get players
  const { data: players } = await supabase
    .from('game_players')
    .select('player_id, score_total, last_seen_at')
    .eq('game_id', gameId);

  // Get current round
  const { data: currentRound } = await supabase
    .from('rounds')
    .select('*')
    .eq('game_id', gameId)
    .order('round_number', { ascending: false })
    .limit(1)
    .single();

  // Get answers for current round
  let answers = null;
  if (currentRound) {
    const { data } = await supabase
      .from('answers')
      .select('*')
      .eq('round_id', currentRound.id);
    answers = data;
  }

  logger.info('Game state fetched', { gameId, userId: user.id });
  return Response.json({
    ok: true,
    data: {
      session: game,
      room,
      players: players ?? [],
      currentRound,
      answers: answers ?? [],
    },
  });
}
