"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

export interface PlayerBarEntry {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isCurrentPlayer?: boolean;
  isDone?: boolean;
}

interface PlayerBarProps {
  players: PlayerBarEntry[];
}

export function PlayerBar({ players }: PlayerBarProps) {
  return (
    <div
      className="flex items-center gap-3 overflow-x-auto px-4 py-3 bg-surface border-t border-border"
      role="list"
      aria-label="שחקנים"
    >
      {players.map((player) => (
        <div
          key={player.id}
          className={[
            "flex flex-col items-center gap-1 min-w-[60px]",
            player.isCurrentPlayer ? "opacity-100" : "opacity-70",
          ].join(" ")}
          role="listitem"
        >
          <div className="relative">
            <Avatar
              name={player.name}
              emoji={player.avatar}
              size="sm"
              className={player.isCurrentPlayer ? "ring-2 ring-teal" : ""}
            />
            {player.isDone && (
              <span
                className="absolute -top-1 -left-1 text-xs"
                aria-label="סיים"
              >
                ✅
              </span>
            )}
          </div>
          <span className="text-xs text-text-dim truncate max-w-[60px]">
            {player.name}
          </span>
          <Badge variant="accent" size="sm">
            {player.score}
          </Badge>
        </div>
      ))}
    </div>
  );
}
