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
import { checkRateLimit } from '@/lib/rateLimit';
import { roomCodeSchema } from '@/lib/validation/gameSchemas';
import { logger } from '@/lib/observability/logger';

const joinSchema = z.object({ code: roomCodeSchema });

export async function POST(request: NextRequest) {
  const gate = checkMultiplayerEnabled();
  if (!gate.allowed) {
    return errorResponse('FEATURE_DISABLED', 'Multiplayer is not enabled', 403);
  }

  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const ip =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const supabase = createAdminClient();

  // Rate limit: 5 attempts per IP per 5 minutes
  const rateCheck = await checkRateLimit(`join:${ip}`, 5, 300, supabase);
  if (!rateCheck.allowed) {
    logger.warn('Join rate limit exceeded', { ip });
    return errorResponse(
      'RATE_LIMITED',
      'Too many join attempts. Try again later.',
      429,
    );
  }

  const body = await parseBody(request, joinSchema);
  if (body instanceof Response) return body;

  // Find room
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, status')
    .eq('code', body.data.code)
    .neq('status', 'finished')
    .single();

  if (roomError || !room) {
    return errorResponse(
      'ROOM_NOT_FOUND',
      'Room not found or already finished',
      404,
    );
  }

  if (room.status !== 'waiting') {
    return errorResponse('GAME_STARTED', 'Game has already started', 409);
  }

  // Find game for this room
  const { data: game } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('room_id', room.id)
    .single();

  if (!game) {
    return errorResponse('GAME_NOT_FOUND', 'Game session not found', 404);
  }

  // Check not already joined
  const { data: existing } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', game.id)
    .eq('player_id', auth.userId)
    .single();

  if (existing) {
    return successResponse({ gameId: game.id, roomCode: body.data.code });
  }

  // Add player
  await supabase.from('game_players').insert({
    game_id: game.id,
    player_id: auth.userId,
  });

  logger.info('Player joined', { gameId: game.id, userId: auth.userId });
  return successResponse({ gameId: game.id, roomCode: body.data.code });
}
