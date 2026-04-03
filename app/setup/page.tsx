"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useGameStore } from "@/stores/gameStore";
import type { GameMode, CategoryMode } from "@/lib/types/game";

const TIMER_OPTIONS = [
  { seconds: 120, label: "2 דקות" },
  { seconds: 180, label: "3 דקות" },
  { seconds: 300, label: "5 דקות" },
  { seconds: 420, label: "7 דקות" },
] as const;

const GAME_MODES: {
  id: GameMode;
  label: string;
  icon: string;
  description: string;
  disabled: boolean;
}[] = [
  {
    id: "solo",
    label: "סולו",
    icon: "🎮",
    description: "שחק לבד נגד מחשב",
    disabled: false,
  },
  {
    id: "multiplayer",
    label: "מרובה משתתפים",
    icon: "👥",
    description: "שחק עם חברים",
    disabled: true,
  },
];

const CATEGORY_MODES: {
  id: CategoryMode;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "fixed",
    label: "קבוע",
    icon: "✅",
    description: "8 הקטגוריות הקלאסיות",
  },
  {
    id: "custom",
    label: "מותאם אישית",
    icon: "⚙️",
    description: "בחר קטגוריות בעצמך",
  },
  {
    id: "random",
    label: "אקראי",
    icon: "🎲",
    description: "6 קטגוריות אקראיות כל סיבוב",
  },
];

export default function SetupPage() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);

  const [mode, setMode] = useState<GameMode>("solo");
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("fixed");
  const [timerSeconds, setTimerSeconds] = useState(180);

  function handleStart() {
    startGame({
      mode,
      categoryMode,
      timerSeconds,
      helpsPerRound: 2,
    });
    const session = useGameStore.getState().session;
    if (session) {
      router.push(`/game/${session.id}`);
    }
  }

  return (
    <main className="min-h-screen flex flex-col pb-8">
      {/* Header */}
      <header className="text-center px-6 pt-10 pb-6">
        <h1 className="font-display font-bold text-4xl text-text-primary mb-2">
          הגדרות משחק
        </h1>
        <p className="text-text-dim text-base">בחר את ההגדרות ויאללה!</p>
      </header>

      <div className="flex flex-col gap-8 px-6 w-full max-w-lg mx-auto">
        {/* ─── Game Mode ────────────────────────────────────────── */}
        <section aria-labelledby="mode-heading">
          <h2
            id="mode-heading"
            className="text-text-dim text-xs font-bold uppercase tracking-widest mb-3"
          >
            מצב משחק
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {GAME_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={m.disabled}
                onClick={() => !m.disabled && setMode(m.id)}
                className="relative"
              >
                <Card
                  variant={mode === m.id ? "accent" : "default"}
                  className={[
                    "flex flex-col items-center gap-2 p-5 cursor-pointer transition-all duration-200",
                    "hover:border-accent/50 hover:bg-accent/5",
                    mode === m.id
                      ? "ring-2 ring-accent shadow-lg shadow-accent/20"
                      : "",
                    m.disabled
                      ? "opacity-50 cursor-not-allowed hover:border-border hover:bg-surface"
                      : "",
                  ].join(" ")}
                >
                  <span className="text-4xl" aria-hidden="true">
                    {m.icon}
                  </span>
                  <span className="font-display font-bold text-lg text-text-primary">
                    {m.label}
                  </span>
                  <span className="text-text-dim text-xs text-center">
                    {m.description}
                  </span>
                </Card>
                {m.disabled && (
                  <Badge
                    variant="warning"
                    size="sm"
                    className="absolute top-2 left-2"
                  >
                    בקרוב
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ─── Category Mode ───────────────────────────────────── */}
        <section aria-labelledby="category-heading">
          <h2
            id="category-heading"
            className="text-text-dim text-xs font-bold uppercase tracking-widest mb-3"
          >
            סוג קטגוריות
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORY_MODES.map((cm) => (
              <button
                key={cm.id}
                type="button"
                onClick={() => setCategoryMode(cm.id)}
              >
                <Card
                  variant={categoryMode === cm.id ? "accent" : "default"}
                  className={[
                    "flex flex-col items-center gap-2 p-4 cursor-pointer transition-all duration-200",
                    "hover:border-accent/50 hover:bg-accent/5",
                    categoryMode === cm.id
                      ? "ring-2 ring-accent shadow-lg shadow-accent/20"
                      : "",
                  ].join(" ")}
                >
                  <span className="text-3xl" aria-hidden="true">
                    {cm.icon}
                  </span>
                  <span className="font-display font-bold text-sm text-text-primary">
                    {cm.label}
                  </span>
                  <span className="text-text-dim text-[11px] text-center leading-tight">
                    {cm.description}
                  </span>
                </Card>
              </button>
            ))}
          </div>
        </section>

        {/* ─── Timer ───────────────────────────────────────────── */}
        <section aria-labelledby="timer-heading">
          <h2
            id="timer-heading"
            className="text-text-dim text-xs font-bold uppercase tracking-widest mb-3"
          >
            זמן לסיבוב
          </h2>
          <div className="flex gap-3 justify-center flex-wrap">
            {TIMER_OPTIONS.map((opt) => (
              <button
                key={opt.seconds}
                type="button"
                onClick={() => setTimerSeconds(opt.seconds)}
                className={[
                  "px-5 py-3 rounded-game border font-display font-bold text-base",
                  "transition-all duration-200",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal focus-visible:outline-offset-2",
                  "active:scale-95 motion-reduce:active:scale-100",
                  timerSeconds === opt.seconds
                    ? "border-gold bg-gold/15 text-gold shadow-md shadow-gold/20 ring-2 ring-gold/40"
                    : "border-border bg-surface-2 text-text-dim hover:border-gold/40 hover:text-gold/80",
                ].join(" ")}
                aria-pressed={timerSeconds === opt.seconds}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* ─── Start Button ────────────────────────────────────── */}
        <div className="pt-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleStart}
            className="text-2xl font-display shadow-xl shadow-accent/40 hover:shadow-accent/60 py-5"
          >
            <span aria-hidden="true">🚀</span>
            התחל משחק!
          </Button>
        </div>
      </div>
    </main>
  );
}
