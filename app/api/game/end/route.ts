import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { transitionGame } from '@/lib/game/stateMachine';
import { finalizeGame } from '@/lib/game/finalScore';
import { logger } from '@/lib/observability/logger';
import type { GameStatus } from '@/lib/types/game';

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

  const { data: game } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', parsed.game_id)
    .single();

  if (!game) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Game not found' } }, { status: 404 });
  if (game.created_by !== user.id) return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only the host can end the game' } }, { status: 403 });

  // Validate state transition
  try {
    transitionGame(game.status as GameStatus, 'finish_game');
  } catch {
    return Response.json({ ok: false, error: { code: 'INVALID_STATE', message: 'Game cannot be ended in current state' } }, { status: 409 });
  }

  // Close the room if multiplayer
  if (game.room_id) {
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', game.room_id);
  }

  // Finalize game: compute ranks, persist to game_players, set finished_at, enqueue stats
  const { rankings } = await finalizeGame(parsed.game_id, supabase);

  const finalScores = rankings.map(r => ({
    playerId: r.playerId,
    score: r.totalScore,
    rank: r.rank,
  }));

  logger.info('Game ended', { gameId: parsed.game_id, rankedPlayers: rankings.length });
  return Response.json({ ok: true, data: { finalScores } });
}
