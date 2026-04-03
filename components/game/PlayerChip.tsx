interface PlayerChipProps {
  name: string;
  avatar: string;
  score: number;
  isDone: boolean;
  isCurrent: boolean;
}

export function PlayerChip({ name, avatar, score, isDone, isCurrent }: PlayerChipProps) {
  return (
    <div
      className={[
        "flex flex-col items-center gap-1 rounded-game px-3 py-2 min-w-[72px] shrink-0",
        "border transition-colors duration-150",
        isCurrent
          ? "border-teal bg-teal/10"
          : "border-border bg-surface",
      ].join(" ")}
      aria-label={`${name}, ${score} נקודות${isDone ? ", סיים" : ""}`}
    >
      <div className="relative">
        <span className="text-2xl" aria-hidden="true">{avatar}</span>
        {isDone && (
          <span
            className="absolute -top-1 -left-1 text-xs bg-teal text-bg rounded-full w-4 h-4 flex items-center justify-center"
            aria-hidden="true"
          >
            ✓
          </span>
        )}
      </div>
      <span className="text-xs text-text-primary font-medium truncate max-w-[64px]">
        {name}
      </span>
      <span className="text-xs font-bold text-gold tabular-nums">{score}</span>
    </div>
  );
}
