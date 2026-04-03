import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/observability/logger';

/**
 * Transfer host to the next eligible player.
 * Returns the new host's player_id, or null if no eligible player found.
 *
 * Eligible = last_seen_at within 60 seconds, ordered by joined_at (longest tenured first).
 */
export async function transferHost(
  gameId: string,
  currentHostId: string,
  supabaseAdmin: SupabaseClient,
): Promise<string | null> {
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from('game_players')
    .select('player_id, last_seen_at')
    .eq('game_id', gameId)
    .neq('player_id', currentHostId)
    .gte('last_seen_at', cutoff)
    .order('joined_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    logger.error('Host transfer candidate query failed', {
      gameId,
      currentHostId,
      error: fetchError.message,
    });
    return null;
  }

  if (!candidates || candidates.length === 0) {
    logger.warn('No eligible host transfer candidate', { gameId, currentHostId });
    return null;
  }

  const newHostId = candidates[0].player_id as string;

  const { error: updateError } = await supabaseAdmin
    .from('game_sessions')
    .update({ created_by: newHostId })
    .eq('id', gameId);

  if (updateError) {
    logger.error('Host transfer failed', {
      gameId,
      newHostId,
      error: updateError.message,
    });
    return null;
  }

  logger.info('Host transferred', { gameId, from: currentHostId, to: newHostId });
  return newHostId;
}
