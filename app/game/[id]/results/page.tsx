"use client";

import { useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useGameStore } from "@/stores/gameStore";
import { usePlayerStore } from "@/stores/playerStore";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import type { Category, HelpUsed } from "@/lib/types/game";

interface PlayerResult {
  id: string;
  name: string;
  avatar: string;
  answers: Record<
    string,
    {
      text: string;
      score: number;
      isValid: boolean;
      isUnique: boolean;
      speedBonus: boolean;
      helpUsed: HelpUsed;
    }
  >;
  totalScore: number;
}

function generateAIAnswers(
  categories: Category[],
  letter: string,
): Record<
  string,
  {
    text: string;
    score: number;
    isValid: boolean;
    isUnique: boolean;
    speedBonus: boolean;
    helpUsed: HelpUsed;
  }
> {
  const result: Record<
    string,
    {
      text: string;
      score: number;
      isValid: boolean;
      isUnique: boolean;
      speedBonus: boolean;
      helpUsed: HelpUsed;
    }
  > = {};
  for (const cat of categories) {
    const hasAnswer = Math.random() > 0.2;
    const isValid = hasAnswer && Math.random() > 0.15;
    const isUnique = isValid && Math.random() > 0.3;
    const speedBonus = isUnique && Math.random() > 0.7;
    const score = !isValid ? 0 : isUnique ? 10 : 5;
    const bonus = speedBonus ? 3 : 0;
    result[cat] = {
      text: hasAnswer ? `${letter}...` : "",
      score: score + bonus,
      isValid,
      isUnique,
      speedBonus,
      helpUsed: "none",
    };
  }
  return result;
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const session = useGameStore((s) => s.session);
  const currentRound = useGameStore((s) => s.currentRound);
  const answers = useGameStore((s) => s.answers);
  const nextRound = useGameStore((s) => s.nextRound);
  const endGame = useGameStore((s) => s.endGame);
  const clearGame = useGameStore((s) => s.clearGame);

  const playerName = usePlayerStore((s) => s.name);
  const playerAvatar = usePlayerStore((s) => s.avatar);
  const playerLocalId = usePlayerStore((s) => s.localId);

  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (!session || session.id !== params.id) {
      hasRedirected.current = true;
      router.replace("/setup");
    }
  }, [session, params.id, router]);

  // Build results for display — real validation will come from the AI backend
  const results: PlayerResult[] = useMemo(() => {
    if (!currentRound) return [];

    const categories = currentRound.categories;
    const letter = currentRound.letter;

    // Player results: mark all as valid/unique for now (placeholder until AI validation)
    const playerAnswers: PlayerResult["answers"] = {};
    let playerTotal = 0;
    for (const cat of categories) {
      const text = answers[cat] ?? "";
      const hasText = text.trim().length > 0;
      const isValid = hasText;
      const isUnique = isValid;
      const score = !isValid ? 0 : isUnique ? 10 : 5;
      playerAnswers[cat] = {
        text,
        score,
        isValid,
        isUnique,
        speedBonus: false,
        helpUsed: "none",
      };
      playerTotal += score;
    }

    const player: PlayerResult = {
      id: playerLocalId || "local",
      name: playerName || "שחקן",
      avatar: playerAvatar || "🦊",
      answers: playerAnswers,
      totalScore: playerTotal,
    };

    // AI results (simulated)
    const noaAnswers = generateAIAnswers(categories, letter);
    const noaTotal = Object.values(noaAnswers).reduce((s, a) => s + a.score, 0);
    const noa: PlayerResult = {
      id: "ai-noa",
      name: "נועה",
      avatar: "🤖",
      answers: noaAnswers,
      totalScore: noaTotal,
    };

    const yoniAnswers = generateAIAnswers(categories, letter);
    const yoniTotal = Object.values(yoniAnswers).reduce(
      (s, a) => s + a.score,
      0,
    );
    const yoni: PlayerResult = {
      id: "ai-yoni",
      name: "יוני",
      avatar: "🧠",
      answers: yoniAnswers,
      totalScore: yoniTotal,
    };

    return [player, noa, yoni].sort((a, b) => b.totalScore - a.totalScore);
  }, [currentRound, answers, playerLocalId, playerName, playerAvatar]);

  function handleNextRound() {
    nextRound();
    if (session) {
      router.push(`/game/${session.id}`);
    }
  }

  function handleEndGame() {
    endGame();
    clearGame();
    router.push("/");
  }

  if (!session || !currentRound) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-text-dim font-display text-xl animate-pulse">
          טוען...
        </div>
      </main>
    );
  }

  const categories = currentRound.categories;

  return (
    <main className="min-h-screen flex flex-col pb-8">
      {/* Header */}
      <header className="text-center px-6 pt-10 pb-4">
        <h1 className="font-display font-bold text-3xl text-text-primary mb-1">
          תוצאות סיבוב {currentRound.roundNumber}
        </h1>
        <p className="text-text-dim text-base">
          האות:{" "}
          <span className="font-display font-bold text-2xl text-accent">
            {currentRound.letter}
          </span>
        </p>
      </header>

      {/* ─── Podium / Ranking ──────────────────────────────── */}
      <section
        className="flex justify-center gap-4 px-6 pb-6"
        aria-label="דירוג שחקנים"
      >
        {results.map((player, idx) => {
          const rankColors = [
            "text-gold border-gold/40 bg-gold/10",
            "text-text-dim border-border bg-surface-2",
            "text-text-dim border-border bg-surface-2",
          ];
          const rankEmojis = ["🥇", "🥈", "🥉"];
          return (
            <Card
              key={player.id}
              variant={idx === 0 ? "accent" : "default"}
              className={[
                "flex flex-col items-center gap-2 p-4 min-w-[90px]",
                idx === 0 ? "ring-2 ring-gold/40 shadow-lg shadow-gold/20" : "",
              ].join(" ")}
            >
              <span className="text-2xl" aria-hidden="true">
                {rankEmojis[idx] ?? ""}
              </span>
              <Avatar name={player.name} emoji={player.avatar} size="md" />
              <span className="font-display font-bold text-sm text-text-primary">
                {player.name}
              </span>
              <span
                className={[
                  "font-display font-bold text-2xl",
                  idx === 0 ? "text-gold" : "text-text-primary",
                ].join(" ")}
              >
                {player.totalScore}
              </span>
            </Card>
          );
        })}
      </section>

      {/* ─── Results Table ─────────────────────────────────── */}
      <section
        className="px-4 w-full max-w-2xl mx-auto"
        aria-label="טבלת תוצאות"
      >
        <div className="overflow-x-auto rounded-game border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2">
                <th className="text-right px-3 py-2 text-text-dim font-medium sticky right-0 bg-surface-2 z-10">
                  שחקן
                </th>
                {categories.map((cat) => (
                  <th
                    key={cat}
                    className="text-center px-3 py-2 text-text-dim font-medium whitespace-nowrap"
                  >
                    <span aria-hidden="true">{CATEGORY_ICONS[cat] ?? "📝"}</span>{" "}
                    {cat}
                  </th>
                ))}
                <th className="text-center px-3 py-2 text-text-dim font-medium">
                  סה&quot;כ
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((player) => (
                <tr key={player.id} className="border-t border-border">
                  <td className="px-3 py-3 sticky right-0 bg-surface z-10">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={player.name}
                        emoji={player.avatar}
                        size="sm"
                      />
                      <span className="font-medium text-text-primary text-xs">
                        {player.name}
                      </span>
                    </div>
                  </td>
                  {categories.map((cat) => {
                    const cell = player.answers[cat];
                    if (!cell || !cell.text) {
                      return (
                        <td
                          key={cat}
                          className="text-center px-3 py-3 text-text-dim/40"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs">—</span>
                            <Badge variant="default" size="sm">
                              0
                            </Badge>
                          </div>
                        </td>
                      );
                    }

                    const bgClass = !cell.isValid
                      ? "bg-surface"
                      : cell.isUnique
                        ? "bg-teal/10"
                        : "bg-gold/10";

                    return (
                      <td key={cat} className={`text-center px-3 py-3 ${bgClass}`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-text-primary truncate max-w-[80px]">
                            {cell.text}
                          </span>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant={
                                !cell.isValid
                                  ? "default"
                                  : cell.isUnique
                                    ? "success"
                                    : "warning"
                              }
                              size="sm"
                            >
                              {cell.score}
                            </Badge>
                            {cell.speedBonus && (
                              <span
                                className="text-gold text-[10px]"
                                title="בונוס מהירות"
                              >
                                ⚡+3
                              </span>
                            )}
                            {cell.helpUsed !== "none" && (
                              <span
                                className="text-[10px]"
                                title="עזרה"
                              >
                                💡
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center px-3 py-3">
                    <span className="font-display font-bold text-lg text-accent">
                      {player.totalScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Actions ───────────────────────────────────────── */}
      <div className="flex gap-3 px-6 pt-8 w-full max-w-lg mx-auto">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleNextRound}
          className="text-lg font-display"
        >
          <span aria-hidden="true">🔄</span>
          סיבוב הבא
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={handleEndGame}
          className="text-lg font-display"
        >
          <span aria-hidden="true">🏁</span>
          סיים משחק
        </Button>
      </div>
    </main>
  );
}
