import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  authenticateRequest,
  parseBody,
  successResponse,
  errorResponse,
} from '@/lib/api/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkMultiplayerEnabled } from '@/lib/middleware/featureGates';
import { gameSettingsSchema } from '@/lib/validation/gameSchemas';
import { getCategories } from '@/lib/game/categoryPool';
import { logger } from '@/lib/observability/logger';

const createGameSchema = z.object({
  settings: gameSettingsSchema,
});

// Hebrew letters + digits for room codes
const ROOM_CODE_CHARS = 'אבגדהוזחטיכלמנסעפצקרשת0123456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  const gate = checkMultiplayerEnabled();
  if (!gate.allowed) {
    return errorResponse('FEATURE_DISABLED', 'Multiplayer is not enabled', 403);
  }

  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, createGameSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const { settings } = body.data;
  const categories = getCategories(settings.categoryMode);

  // Generate room code with collision retry (up to 5 times)
  let roomCode: string | null = null;
  let roomId: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, status: 'waiting', created_by: auth.userId })
      .select('id, code')
      .single();

    if (!error && data) {
      roomCode = data.code;
      roomId = data.id;
      break;
    }
    if (error && !error.message.includes('duplicate')) throw error;
    logger.warn('Room code collision, retrying', { attempt, code });
  }

  if (!roomCode || !roomId) {
    return errorResponse(
      'ROOM_CODE_EXHAUSTED',
      'Failed to generate unique room code',
      500,
    );
  }

  // Create game session
  const { data: game, error: gameError } = await supabase
    .from('game_sessions')
    .insert({
      mode: 'multiplayer',
      status: 'waiting',
      category_mode: settings.categoryMode,
      categories,
      timer_seconds: settings.timerSeconds,
      helps_per_round: settings.helpsPerRound,
      created_by: auth.userId,
      room_id: roomId,
    })
    .select('id')
    .single();

  if (gameError || !game) {
    return errorResponse('CREATE_FAILED', 'Failed to create game session', 500);
  }

  // Add creator as first player
  await supabase.from('game_players').insert({
    game_id: game.id,
    player_id: auth.userId,
  });

  logger.info('Game created', {
    gameId: game.id,
    roomCode,
    userId: auth.userId,
  });

  return successResponse({ gameId: game.id, roomCode });
}
