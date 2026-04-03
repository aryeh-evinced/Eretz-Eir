import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type GameEvent =
  | { type: 'player_joined'; playerId: string; playerName: string }
  | { type: 'player_left'; playerId: string }
  | { type: 'round_start'; roundId: string; letter: string; categories: string[] }
  | { type: 'player_done'; playerId: string }
  | { type: 'round_end'; roundId: string; results: unknown }
  | { type: 'answers_revealed'; roundId: string }
  | { type: 'host_changed'; newHostId: string }
  | { type: 'game_over'; finalScores: unknown };

export type GameEventHandler = (event: GameEvent) => void;

export function subscribeToGame(
  gameId: string,
  onEvent: GameEventHandler,
): { channel: RealtimeChannel; unsubscribe: () => void } {
  const supabase = createClient();
  const channel = supabase
    .channel(`game:${gameId}`)
    .on('broadcast', { event: 'game_event' }, (payload) => {
      onEvent(payload.payload as GameEvent);
    })
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export function broadcastGameEvent(
  channel: RealtimeChannel,
  event: GameEvent,
) {
  channel.send({
    type: 'broadcast',
    event: 'game_event',
    payload: event,
  });
}
