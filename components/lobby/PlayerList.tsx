'use client';

import { Avatar } from '@/components/ui/Avatar';

interface Player {
  id: string;
  name: string;
  emoji: string;
  isHost: boolean;
}

interface PlayerListProps {
  players: Player[];
  hostId: string;
}

export function PlayerList({ players, hostId }: PlayerListProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-bold text-text-primary">
        שחקנים ({players.length})
      </h3>
      <div className="flex flex-col gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-3 bg-surface-2 rounded-game px-4 py-3"
          >
            <Avatar name={player.name} emoji={player.emoji} size="sm" />
            <span className="text-text-primary font-medium flex-1">
              {player.name}
            </span>
            {player.id === hostId && (
              <span className="text-xs bg-gold text-bg px-2 py-1 rounded-full font-bold">
                מארח
              </span>
            )}
          </div>
        ))}
      </div>
      {players.length < 2 && (
        <p className="text-sm text-text-dim text-center animate-pulse">
          ממתין לשחקנים נוספים...
        </p>
      )}
    </div>
  );
}
