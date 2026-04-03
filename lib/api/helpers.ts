import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ZodSchema } from 'zod';

export async function authenticateRequest(
  _request: NextRequest,
): Promise<{ userId: string } | NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      },
      { status: 401 },
    );
  }

  return { userId: user.id };
}

export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T } | NextResponse> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: result.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 },
      );
    }
    return { data: result.data };
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INVALID_JSON', message: 'Invalid JSON body' },
      },
      { status: 400 },
    );
  }
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function verifyHost(
  gameId: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const { data } = await supabase
    .from('game_sessions')
    .select('created_by')
    .eq('id', gameId)
    .single();
  return data?.created_by === userId;
}

export async function verifyParticipant(
  gameId: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const { data } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', gameId)
    .eq('player_id', userId)
    .single();
  return !!data;
}
