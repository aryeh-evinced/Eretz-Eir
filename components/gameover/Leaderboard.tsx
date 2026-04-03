"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  avatar: string;
  totalScore: number;
  rank: number;
  gamesWon?: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES: Record<number, { emoji: string; ring: string; text: string }> = {
  1: { emoji: "🥇", ring: "ring-2 ring-gold/40 shadow-lg shadow-gold/20", text: "text-gold" },
  2: { emoji: "🥈", ring: "ring-1 ring-text-dim/30", text: "text-text-dim" },
  3: { emoji: "🥉", ring: "ring-1 ring-text-dim/20", text: "text-text-dim" },
};

/**
 * Podium-style leaderboard for the game-over screen.
 * Top 3 get medal emojis and special styling; rest are listed below.
 */
export function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) return null;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <section aria-label="לוח מובילים">
      {/* Podium: top 3 */}
      <div className="flex justify-center gap-3 px-4 pb-4">
        {podium.map((entry) => {
          const style = RANK_STYLES[entry.rank] ?? { emoji: "", ring: "", text: "text-text-primary" };
          return (
            <Card
              key={entry.playerId}
              variant={entry.rank === 1 ? "accent" : "default"}
              className={[
                "flex flex-col items-center gap-2 p-4 min-w-[90px] transition-transform",
                entry.rank === 1 ? "scale-105" : "",
                style.ring,
              ].join(" ")}
            >
              <span className="text-2xl" aria-hidden="true">
                {style.emoji}
              </span>
              <Avatar name={entry.name} emoji={entry.avatar} size="md" />
              <span className="font-display font-bold text-sm text-text-primary">
                {entry.name}
              </span>
              <span className={`font-display font-bold text-2xl ${style.text}`}>
                {entry.totalScore}
              </span>
              <span className="text-xs text-text-dim">
                מקום {entry.rank}
              </span>
            </Card>
          );
        })}
      </div>

      {/* Remaining players */}
      {rest.length > 0 && (
        <div className="px-4 space-y-2">
          {rest.map((entry) => (
            <Card key={entry.playerId} variant="default" className="flex items-center gap-3 p-3">
              <span className="font-display font-bold text-lg text-text-dim w-8 text-center">
                {entry.rank}
              </span>
              <Avatar name={entry.name} emoji={entry.avatar} size="sm" />
              <span className="font-display font-medium text-sm text-text-primary flex-1">
                {entry.name}
              </span>
              <span className="font-display font-bold text-lg text-accent">
                {entry.totalScore}
              </span>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
