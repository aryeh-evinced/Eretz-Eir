import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  authenticateRequest,
  parseBody,
  successResponse,
  errorResponse,
  verifyHost,
} from '@/lib/api/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { transitionGame } from '@/lib/game/stateMachine';
import { drawLetter } from '@/lib/game/letters';
import { logger } from '@/lib/observability/logger';
import type { GameStatus, HebrewLetter } from '@/lib/types/game';

const startSchema = z.object({ game_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, startSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const { game_id } = body.data;

  // Verify host
  const isHost = await verifyHost(game_id, auth.userId, supabase);
  if (!isHost) {
    return errorResponse('FORBIDDEN', 'Only the host can start the game', 403);
  }

  // Get game
  const { data: game } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', game_id)
    .single();

  if (!game) return errorResponse('NOT_FOUND', 'Game not found', 404);

  // Validate state transition
  try {
    transitionGame(game.status as GameStatus, 'start_game');
  } catch {
    return errorResponse(
      'INVALID_STATE',
      'Game cannot be started in current state',
      409,
    );
  }

  // Draw letter for first round
  const letter = drawLetter([]);
  const categories = game.categories as string[];

  // Create first round
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      game_id,
      round_number: 1,
      letter,
      categories,
      status: 'playing',
    })
    .select('id')
    .single();

  if (roundError || !round) {
    return errorResponse('CREATE_ROUND_FAILED', 'Failed to create round', 500);
  }

  // Update game and room status
  await supabase
    .from('game_sessions')
    .update({ status: 'playing' })
    .eq('id', game_id);

  if (game.room_id) {
    await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', game.room_id);
  }

  // Create empty answer rows for each player x category
  const { data: players } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', game_id);

  if (players) {
    const answerRows = players.flatMap((p) =>
      categories.map((cat) => ({
        round_id: round.id,
        player_id: p.player_id,
        category: cat,
        answer_text: null,
        is_valid: null,
        is_unique: null,
        help_used: 'none',
        speed_bonus: false,
        score: 0,
      })),
    );
    await supabase.from('answers').insert(answerRows);
  }

  logger.info('Game started', {
    gameId: game_id,
    roundId: round.id,
    letter: letter as HebrewLetter,
  });

  return successResponse({ roundId: round.id, letter, categories });
}
