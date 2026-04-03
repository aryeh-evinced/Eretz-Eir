"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { loadGameHistory } from "@/lib/storage/localGame";
import type { GameHistoryEntry } from "@/lib/storage/localGame";

export function GameHistory() {
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadGameHistory());
  }, []);

  if (history.length === 0) {
    return (
      <p className="text-text-dim text-center text-sm py-6">
        עדיין לא שיחקת. לך תשחק! 🎮
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="היסטוריית משחקים">
      {history.slice(0, 10).map((game) => (
        <Card
          key={game.id}
          role="listitem"
          className="flex justify-between items-center px-4 py-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-text-primary font-medium text-sm">
              {game.won ? "🏆 ניצחון" : "🎮 משחק"}
            </span>
            <span className="text-text-dim text-xs">
              {new Date(game.startedAt).toLocaleDateString("he-IL")}
              {" · "}
              {game.rounds} {game.rounds === 1 ? "סיבוב" : "סיבובים"}
            </span>
          </div>
          <span className="text-gold font-bold font-display text-lg">
            {game.score} <span className="text-xs font-body font-normal">נק&apos;</span>
          </span>
        </Card>
      ))}
    </div>
  );
}
