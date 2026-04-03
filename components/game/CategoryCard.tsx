"use client";

import { useId } from "react";
import type { Category } from "@/lib/types/game";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import { HelpButton, type HelpState } from "./HelpButton";

type ValidationResult = "valid" | "invalid" | "shared" | null;

interface CategoryCardProps {
  category: Category;
  letter: string;
  value: string;
  onChange: (value: string) => void;
  onHelp: () => void;
  helpState: HelpState;
  hint?: string;
  disabled?: boolean;
  validationResult: ValidationResult;
  remainingHelps?: number;
}

const validationStyles: Record<NonNullable<ValidationResult>, { border: string; bg: string; badge: string; text: string }> = {
  valid: {
    border: "border-teal",
    bg: "bg-teal/5",
    badge: "bg-teal/20 text-teal",
    text: "תקין ✓",
  },
  invalid: {
    border: "border-accent",
    bg: "bg-accent/5",
    badge: "bg-accent/20 text-accent",
    text: "לא תקין ✗",
  },
  shared: {
    border: "border-gold",
    bg: "bg-gold/5",
    badge: "bg-gold/20 text-gold",
    text: "משותף",
  },
};

export function CategoryCard({
  category,
  letter,
  value,
  onChange,
  onHelp,
  helpState,
  hint,
  disabled = false,
  validationResult,
  remainingHelps = 0,
}: CategoryCardProps) {
  const inputId = useId();
  const icon = CATEGORY_ICONS[category] ?? "📝";
  const vStyle = validationResult ? validationStyles[validationResult] : null;

  return (
    <div
      className={[
        "relative rounded-game border p-3 transition-colors duration-150",
        vStyle ? `${vStyle.border} ${vStyle.bg}` : "border-border bg-surface",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <label
          htmlFor={inputId}
          className="flex items-center gap-2 text-sm font-medium text-text-primary"
        >
          <span aria-hidden="true">{icon}</span>
          <span>{category}</span>
        </label>

        <div className="flex items-center gap-2">
          {vStyle && (
            <span
              className={[
                "text-xs font-medium rounded-full px-2 py-0.5",
                vStyle.badge,
              ].join(" ")}
            >
              {vStyle.text}
            </span>
          )}
          <HelpButton state={helpState} onClick={onHelp} remainingHelps={remainingHelps} />
        </div>
      </div>

      {/* Hint text */}
      {helpState === "hint" && hint && (
        <p className="text-xs text-gold mb-1.5" role="status">
          רמז: {hint}
        </p>
      )}

      {/* Input */}
      <input
        id={inputId}
        type="text"
        dir="rtl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={`${category} שמתחיל/ה ב-${letter}`}
        aria-label={`${category} — הקלד מילה שמתחילה ב-${letter}`}
        className={[
          "w-full rounded-game border bg-input-bg px-4 py-2.5 text-base text-text-primary",
          "placeholder:text-text-dim",
          "focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal",
          "transition-colors duration-150",
          "min-h-[44px]",
          disabled ? "opacity-50 cursor-not-allowed" : "",
          vStyle ? vStyle.border : "border-border",
        ].join(" ")}
      />
    </div>
  );
}
