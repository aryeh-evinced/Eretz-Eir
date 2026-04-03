"use client";

import { useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Leaderboard, type LeaderboardEntry } from "@/components/gameover/Leaderboard";
import { StatHighlight, type StatHighlightData } from "@/components/gameover/StatHighlight";
import { ShareButton } from "@/components/gameover/ShareButton";
import { useGameStore } from "@/stores/gameStore";
import { usePlayerStore } from "@/stores/playerStore";

/**
 * Game-over page.
 *
 * Displays final rankings, stat highlights, and share button.
 * In solo mode, all data comes from the local game store.
 * In multiplayer mode, data will come from the server (fetched via game ID).
 *
 * For now (Phase 6 Task 3), this handles the solo path with simulated AI competitors.
 * The multiplayer path will be wired when the full game engine is connected end-to-end.
 */
export default function GameOverPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const session = useGameStore((s) => s.session);
  const clearGame = useGameStore((s) => s.clearGame);

  const playerName = usePlayerStore((s) => s.name);
  const playerAvatar = usePlayerStore((s) => s.avatar);
  const playerLocalId = usePlayerStore((s) => s.localId);

  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (!session || session.id !== params.id) {
      hasRedirected.current = true;
      router.replace("/");
    }
  }, [session, params.id, router]);

  // Build leaderboard entries from game state.
  // In solo mode, simulate AI competitors with stored scores.
  // In multiplayer, this would come from game_players with rank from finalizeGame.
  const leaderboardEntries: LeaderboardEntry[] = useMemo(() => {
    if (!session) return [];

    // For solo mode: use a deterministic approach based on game ID to generate
    // consistent AI competitor scores across page refreshes.
    const seed = params.id.charCodeAt(0) + params.id.charCodeAt(1);

    const playerScore = 45 + (seed % 30); // placeholder — real score from store
    const aiScore1 = 30 + ((seed * 7) % 40);
    const aiScore2 = 20 + ((seed * 13) % 35);

    const entries: LeaderboardEntry[] = [
      {
        playerId: playerLocalId || "local",
        name: playerName || "שחקן",
        avatar: playerAvatar || "🦊",
        totalScore: playerScore,
        rank: 0, // computed below
      },
      {
        playerId: "ai-noa",
        name: "נועה",
        avatar: "🤖",
        totalScore: aiScore1,
        rank: 0,
      },
      {
        playerId: "ai-yoni",
        name: "יוני",
        avatar: "🧠",
        totalScore: aiScore2,
        rank: 0,
      },
    ];

    // Sort by score descending and assign ranks (competition ranking)
    entries.sort((a, b) => b.totalScore - a.totalScore);
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].totalScore < entries[i - 1].totalScore) {
        currentRank = i + 1;
      }
      entries[i].rank = currentRank;
    }

    return entries;
  }, [session, params.id, playerLocalId, playerName, playerAvatar]);

  // Build stat highlights
  const statHighlights: StatHighlightData[] = useMemo(() => {
    if (leaderboardEntries.length === 0) return [];

    const playerEntry = leaderboardEntries.find(
      (e) => e.playerId === (playerLocalId || "local"),
    );
    if (!playerEntry) return [];

    const totalPlayers = leaderboardEntries.length;
    const topScore = leaderboardEntries[0]?.totalScore ?? 0;

    const highlights: StatHighlightData[] = [
      {
        label: "הניקוד שלך",
        value: playerEntry.totalScore,
        icon: "🏆",
        color: playerEntry.rank === 1 ? "gold" : "accent",
      },
      {
        label: "מקום",
        value: `${playerEntry.rank} / ${totalPlayers}`,
        icon: "📊",
        color: playerEntry.rank === 1 ? "gold" : "teal",
      },
    ];

    if (playerEntry.rank === 1) {
      highlights.push({
        label: "ניצחון!",
        value: "🎉",
        icon: "👑",
        color: "gold",
      });
    }

    if (topScore > 0) {
      const avgScore = Math.round(
        leaderboardEntries.reduce((sum, e) => sum + e.totalScore, 0) / totalPlayers,
      );
      highlights.push({
        label: "ממוצע כללי",
        value: avgScore,
        icon: "📈",
        color: "teal",
      });
    }

    return highlights;
  }, [leaderboardEntries, playerLocalId]);

  function handleNewGame() {
    clearGame();
    router.push("/setup");
  }

  function handleHome() {
    clearGame();
    router.push("/");
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-text-dim font-display text-xl animate-pulse">
          טוען...
        </div>
      </main>
    );
  }

  const playerEntry = leaderboardEntries.find(
    (e) => e.playerId === (playerLocalId || "local"),
  );
  const isWinner = playerEntry?.rank === 1;

  return (
    <main className="min-h-screen flex flex-col pb-8">
      {/* Header */}
      <header className="text-center px-6 pt-10 pb-6">
        <h1 className="font-display font-bold text-4xl text-text-primary mb-2">
          {isWinner ? "🏆 ניצחת!" : "🏁 סוף המשחק"}
        </h1>
        <p className="text-text-dim text-base">
          {isWinner
            ? "כל הכבוד! הובלת את הטבלה!"
            : `סיימת במקום ${playerEntry?.rank ?? "?"}`}
        </p>
      </header>

      {/* Leaderboard */}
      <Leaderboard entries={leaderboardEntries} />

      {/* Stat Highlights */}
      <div className="mt-6">
        <StatHighlight stats={statHighlights} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 px-6 pt-8 w-full max-w-lg mx-auto">
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleNewGame}
            className="text-lg font-display"
          >
            <span aria-hidden="true">🔄</span>
            משחק חדש
          </Button>
          <ShareButton
            gameId={params.id}
            playerName={playerEntry?.name ?? "שחקן"}
            playerRank={playerEntry?.rank ?? 1}
            totalPlayers={leaderboardEntries.length}
            totalScore={playerEntry?.totalScore ?? 0}
          />
        </div>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={handleHome}
          className="text-sm font-display"
        >
          חזרה למסך הבית
        </Button>
      </div>
    </main>
  );
}
