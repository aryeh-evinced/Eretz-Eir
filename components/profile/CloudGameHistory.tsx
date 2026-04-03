"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";

interface CloudGameEntry {
  gameId: string;
  mode: string;
  finishedAt: string;
  scoreTotal: number;
  rank: number | null;
  playerCount: number;
}

interface CloudGameHistoryProps {
  playerId: string | null;
}

/**
 * Cloud-backed multiplayer game history.
 * Fetches from Supabase game_players + game_sessions for the authenticated user.
 * Shows "last updated" metadata and clearly labels this as cloud data.
 */
export function CloudGameHistory({ playerId }: CloudGameHistoryProps) {
  const [games, setGames] = useState<CloudGameEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!playerId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch game_players rows for this player in finished games.
      // Two separate queries to avoid Supabase join typing issues.
      const { data: gpData, error: gpError } = await supabase
        .from("game_players")
        .select("game_id, score_total, rank")
        .eq("player_id", playerId);

      if (gpError) throw new Error(gpError.message);

      const gpRows = gpData as Array<{
        game_id: string;
        score_total: number;
        rank: number | null;
      }> ?? [];

      if (gpRows.length === 0) {
        setGames([]);
        setLastFetched(new Date());
        return;
      }

      const gameIds = gpRows.map((r) => r.game_id);

      // Fetch finished game sessions for these games
      const { data: sessionData, error: sessionError } = await supabase
        .from("game_sessions")
        .select("id, mode, finished_at, status")
        .in("id", gameIds)
        .eq("status", "finished")
        .order("finished_at", { ascending: false })
        .limit(20);

      if (sessionError) throw new Error(sessionError.message);

      const sessions = sessionData as Array<{
        id: string;
        mode: string;
        finished_at: string;
        status: string;
      }> ?? [];

      const sessionMap = new Map(sessions.map((s) => [s.id, s]));
      const finishedGameIds = sessions.map((s) => s.id);

      // Get player count per game
      const playerCounts: Record<string, number> = {};

      if (finishedGameIds.length > 0) {
        const { data: countData } = await supabase
          .from("game_players")
          .select("game_id")
          .in("game_id", finishedGameIds);

        const countRows = countData as Array<{ game_id: string }> ?? [];
        for (const row of countRows) {
          playerCounts[row.game_id] = (playerCounts[row.game_id] ?? 0) + 1;
        }
      }

      const entries: CloudGameEntry[] = gpRows
        .filter((gp) => sessionMap.has(gp.game_id))
        .map((gp) => {
          const session = sessionMap.get(gp.game_id)!;
          return {
            gameId: gp.game_id,
            mode: session.mode,
            finishedAt: session.finished_at,
            scoreTotal: gp.score_total ?? 0,
            rank: gp.rank,
            playerCount: playerCounts[gp.game_id] ?? 1,
          };
        })
        .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
        .slice(0, 20);

      setGames(entries);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת ההיסטוריה");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (!playerId) {
    return (
      <p className="text-text-dim text-center text-sm py-4">
        התחבר כדי לראות היסטוריית משחקים מרובי משתתפים
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with source label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="info" size="sm">ענן</Badge>
          <span className="text-text-dim text-xs">מרובה משתתפים</span>
        </div>
        {lastFetched && (
          <span className="text-text-dim text-[10px]">
            עודכן: {lastFetched.toLocaleTimeString("he-IL")}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      )}

      {error && (
        <Card variant="default" className="text-center py-4">
          <p className="text-accent text-sm">{error}</p>
          <button
            onClick={fetchHistory}
            className="text-teal text-xs mt-2 hover:underline"
          >
            נסה שוב
          </button>
        </Card>
      )}

      {!loading && !error && games.length === 0 && (
        <p className="text-text-dim text-center text-sm py-4">
          אין עדיין משחקים מרובי משתתפים
        </p>
      )}

      {!loading && games.length > 0 && (
        <div className="flex flex-col gap-2" role="list" aria-label="היסטוריית משחקים מהענן">
          {games.map((game) => (
            <Card
              key={game.gameId}
              role="listitem"
              className="flex justify-between items-center px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium text-sm">
                    {game.rank === 1 ? "🏆" : "🎮"}{" "}
                    {game.mode === "multiplayer" ? "מרובה משתתפים" : "סולו"}
                  </span>
                  {game.rank !== null && (
                    <Badge
                      variant={game.rank === 1 ? "success" : "default"}
                      size="sm"
                    >
                      מקום {game.rank}/{game.playerCount}
                    </Badge>
                  )}
                </div>
                <span className="text-text-dim text-xs">
                  {new Date(game.finishedAt).toLocaleDateString("he-IL")}
                </span>
              </div>
              <span className="text-gold font-bold font-display text-lg">
                {game.scoreTotal}{" "}
                <span className="text-xs font-body font-normal">נק&apos;</span>
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
