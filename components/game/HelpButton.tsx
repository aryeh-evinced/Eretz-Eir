"use client";

export type HelpState = "available" | "hint" | "used" | "disabled";

interface HelpButtonProps {
  state: HelpState;
  onClick: () => void;
  remainingHelps: number;
}

const stateConfig: Record<HelpState, { icon: string; label: string }> = {
  available: { icon: "💡", label: "קבל רמז" },
  hint: { icon: "💡", label: "מלא תשובה" },
  used: { icon: "💡", label: "נוצל" },
  disabled: { icon: "💡", label: "אין עזרות" },
};

export function HelpButton({ state, onClick, remainingHelps }: HelpButtonProps) {
  const { icon, label } = stateConfig[state];
  const isClickable = state === "available" || state === "hint";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      aria-label={`${label} (${remainingHelps} נותרו)`}
      title={label}
      className={[
        "inline-flex items-center justify-center rounded-game min-w-[44px] min-h-[44px] p-2",
        "border transition-all duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal focus-visible:outline-offset-2",
        isClickable
          ? "border-gold/40 bg-gold/10 hover:bg-gold/20 active:scale-95 motion-reduce:active:scale-100 cursor-pointer"
          : "border-border bg-surface-2 opacity-40 cursor-not-allowed",
        state === "hint" ? "ring-2 ring-gold/50 animate-pulse motion-reduce:animate-none" : "",
      ].join(" ")}
    >
      <span className="text-lg" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
