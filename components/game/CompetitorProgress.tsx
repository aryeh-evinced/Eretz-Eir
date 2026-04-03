"use client";

interface Competitor {
  name: string;
  categoriesFilled: number;
  totalCategories: number;
}

interface CompetitorProgressProps {
  competitors: Competitor[];
}

function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={[
            "w-2.5 h-2.5 rounded-full transition-colors duration-500 motion-reduce:transition-none",
            i < filled ? "bg-gold" : "bg-surface-2",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export function CompetitorProgress({ competitors }: CompetitorProgressProps) {
  if (competitors.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" aria-label="התקדמות מתחרים">
      <h3 className="text-sm font-medium text-text-dim">מתחרים</h3>
      <div className="flex flex-col gap-1.5">
        {competitors.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between gap-3 rounded-game border border-border bg-surface px-3 py-2"
            aria-label={`${c.name}: ${c.categoriesFilled} מתוך ${c.totalCategories}`}
          >
            <span className="text-sm text-text-primary">{c.name}</span>
            <ProgressDots filled={c.categoriesFilled} total={c.totalCategories} />
          </div>
        ))}
      </div>
    </div>
  );
}
