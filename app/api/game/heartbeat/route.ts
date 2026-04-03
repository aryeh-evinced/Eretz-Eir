import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  authenticateRequest,
  parseBody,
  successResponse,
  errorResponse,
} from '@/lib/api/helpers';
import { createClient } from '@/lib/supabase/server';

const heartbeatSchema = z.object({ game_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, heartbeatSchema);
  if (body instanceof Response) return body;

  const supabase = createClient();
  const { data, error } = await supabase.rpc('heartbeat', {
    p_game_id: body.data.game_id,
  });

  if (error) {
    return errorResponse('HEARTBEAT_FAILED', 'Heartbeat failed', 500);
  }

  return successResponse({ active: !!data });
}
