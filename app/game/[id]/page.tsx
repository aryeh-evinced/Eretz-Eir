"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/stores/gameStore";
import { LetterDisplay } from "@/components/game/LetterDisplay";
import { Timer } from "@/components/ui/Timer";
import { CategoryGrid } from "@/components/game/CategoryGrid";
import { DoneButton } from "@/components/game/DoneButton";
import { PlayerBar, type PlayerBarEntry } from "@/components/game/PlayerBar";
import { usePlayerStore } from "@/stores/playerStore";

const AI_COMPETITORS: PlayerBarEntry[] = [
  { id: "ai-noa", name: "נועה", avatar: "🤖", score: 0 },
  { id: "ai-yoni", name: "יוני", avatar: "🧠", score: 0 },
];

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useGameStore((s) => s.session);
  const currentRound = useGameStore((s) => s.currentRound);
  const answers = useGameStore((s) => s.answers);
  const settings = useGameStore((s) => s.settings);
  const setAnswer = useGameStore((s) => s.setAnswer);
  const submitRound = useGameStore((s) => s.submitRound);

  const playerName = usePlayerStore((s) => s.name);
  const playerAvatar = usePlayerStore((s) => s.avatar);
  const playerLocalId = usePlayerStore((s) => s.localId);

  const [remainingSeconds, setRemainingSeconds] = useState(settings.timerSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (!session || session.status !== "playing" || session.id !== params.id) {
      hasRedirected.current = true;
      router.replace("/setup");
    }
  }, [session, params.id, router]);

  // Timer countdown
  useEffect(() => {
    setRemainingSeconds(settings.timerSeconds);
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentRound?.roundNumber, settings.timerSeconds]);

  const handleDone = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    submitRound();
    if (session) router.push(`/game/${session.id}/results`);
  }, [submitRound, session, router]);

  if (!session || !currentRound || session.id !== params.id) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-text-dim font-display text-xl animate-pulse">טוען...</div>
      </main>
    );
  }

  const players: PlayerBarEntry[] = [
    { id: playerLocalId || "local", name: playerName || "שחקן", avatar: playerAvatar || "🦊", score: 0, isCurrentPlayer: true },
    ...AI_COMPETITORS,
  ];

  return (
    <main className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <span className="text-text-dim text-xs font-medium">סיבוב {currentRound.roundNumber}</span>
          <Timer totalSeconds={settings.timerSeconds} remainingSeconds={remainingSeconds} onExpire={handleDone} />
          <div className="w-16" />
        </div>
      </header>

      <section className="flex justify-center py-6" aria-label="האות שנבחרה">
        <LetterDisplay letter={currentRound.letter} animated />
      </section>

      <section className="flex-1 px-4 pb-4 w-full max-w-lg mx-auto" aria-label="קטגוריות">
        <CategoryGrid categories={currentRound.categories} answers={answers} onAnswerChange={setAnswer} />
      </section>

      <div className="px-4 pb-3 w-full max-w-lg mx-auto">
        <DoneButton onClick={handleDone} />
      </div>

      <PlayerBar players={players} />
    </main>
  );
}
