'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoomCode } from '@/components/lobby/RoomCode';
import { ShareLink } from '@/components/lobby/ShareLink';
import { PlayerList } from '@/components/lobby/PlayerList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { subscribeToGame } from '@/lib/realtime/gameChannel';
import type { GameEvent } from '@/lib/realtime/gameChannel';

interface LobbyPlayer {
  id: string;
  name: string;
  emoji: string;
  isHost: boolean;
}

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string>('');
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = currentPlayerId === hostId;
  const code = params.code ?? '';

  // Fetch game state on mount
  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch(`/api/game/lookup?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (data.ok) {
          setGameId(data.data.id);
          setHostId(data.data.hostId);
          setCurrentPlayerId(data.data.currentPlayerId);
          setPlayers(data.data.players ?? []);
        } else {
          setError(data.error?.message ?? 'חדר לא נמצא');
        }
      } catch {
        setError('שגיאה בטעינת המשחק');
      } finally {
        setLoading(false);
      }
    }
    if (code) fetchGame();
  }, [code]);

  // Subscribe to realtime events
  useEffect(() => {
    if (!gameId) return;

    const { unsubscribe } = subscribeToGame(gameId, (event: GameEvent) => {
      switch (event.type) {
        case 'player_joined':
          setPlayers((prev) => [
            ...prev,
            {
              id: event.playerId,
              name: event.playerName,
              emoji: '👤',
              isHost: false,
            },
          ]);
          break;
        case 'player_left':
          setPlayers((prev) => prev.filter((p) => p.id !== event.playerId));
          break;
        case 'round_start':
          router.push(`/game/${gameId}`);
          break;
        case 'host_changed':
          setHostId(event.newHostId);
          break;
      }
    });

    return unsubscribe;
  }, [gameId, router]);

  const handleStart = async () => {
    if (!gameId) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/game/${gameId}`);
      } else {
        setError(data.error?.message ?? 'שגיאה בהתחלת המשחק');
        setStarting(false);
      }
    } catch {
      setError('שגיאה בהתחלת המשחק');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-4 flex flex-col items-center gap-6 pt-8">
      <h1 className="text-2xl font-bold text-text-primary font-display">
        חדר משחק
      </h1>

      <Card className="w-full max-w-md p-6">
        <RoomCode code={code} />
      </Card>

      <Card className="w-full max-w-md p-6">
        <PlayerList players={players} hostId={hostId} />
      </Card>

      <div className="w-full max-w-md flex flex-col gap-3">
        <ShareLink code={code} />

        {isHost && (
          <Button
            onClick={handleStart}
            disabled={players.length < 2}
            loading={starting}
            size="lg"
            fullWidth
          >
            התחל משחק!
          </Button>
        )}
      </div>

      {error && <p className="text-accent text-sm">{error}</p>}
    </div>
  );
}
