"use client";

import { Card } from "@/components/ui/Card";

export interface StatHighlightData {
  label: string;
  value: string | number;
  icon: string;
  color?: "gold" | "teal" | "accent";
}

interface StatHighlightProps {
  stats: StatHighlightData[];
}

const COLOR_CLASSES: Record<string, string> = {
  gold: "text-gold",
  teal: "text-teal",
  accent: "text-accent",
};

/**
 * Grid of highlight stat cards shown on the game-over screen.
 * Displays achievements like "fastest answer", "most unique answers", etc.
 */
export function StatHighlight({ stats }: StatHighlightProps) {
  if (stats.length === 0) return null;

  return (
    <section aria-label="נקודות ציון" className="px-4">
      <h2 className="font-display font-bold text-lg text-text-primary text-center mb-3">
        נקודות ציון
      </h2>
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        {stats.map((stat, idx) => (
          <Card key={idx} variant="elevated" className="flex flex-col items-center gap-1 p-3 text-center">
            <span className="text-2xl" aria-hidden="true">
              {stat.icon}
            </span>
            <span className={`font-display font-bold text-xl ${COLOR_CLASSES[stat.color ?? "accent"]}`}>
              {stat.value}
            </span>
            <span className="text-xs text-text-dim">
              {stat.label}
            </span>
          </Card>
        ))}
      </div>
    </section>
  );
}
