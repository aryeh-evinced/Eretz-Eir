"use client";

import { Badge } from "@/components/ui/Badge";
import { SpeedBonusIcon } from "./SpeedBonusIcon";
import { HelpUsedIcon } from "./HelpUsedIcon";
import type { HelpUsed } from "@/lib/types/game";

interface AnswerCellProps {
  text: string | null;
  score: number;
  isValid: boolean;
  isUnique: boolean;
  speedBonus: boolean;
  helpUsed: HelpUsed;
  /** If true, show host review controls (accept/reject). */
  showReview?: boolean;
  /** Callback when host accepts/rejects this answer. */
  onReview?: (isValid: boolean) => void;
}

/** Single answer cell in the results table. */
export function AnswerCell({
  text,
  score,
  isValid,
  isUnique,
  speedBonus,
  helpUsed,
  showReview,
  onReview,
}: AnswerCellProps) {
  if (!text) {
    return (
      <td className="text-center px-3 py-3 text-text-dim/40">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs">—</span>
          <Badge variant="default" size="sm">
            0
          </Badge>
        </div>
      </td>
    );
  }

  const bgClass = !isValid
    ? "bg-surface"
    : isUnique
      ? "bg-teal/10"
      : "bg-gold/10";

  return (
    <td className={`text-center px-3 py-3 ${bgClass}`}>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-text-primary truncate max-w-[80px]">
          {text}
        </span>
        <div className="flex items-center gap-1">
          <Badge
            variant={!isValid ? "default" : isUnique ? "success" : "warning"}
            size="sm"
          >
            {score}
          </Badge>
          {speedBonus && <SpeedBonusIcon bonus={3} />}
          <HelpUsedIcon helpUsed={helpUsed} />
        </div>
        {showReview && (
          <div className="flex gap-1 mt-1">
            <button
              className="text-[10px] px-1.5 py-0.5 rounded bg-teal/20 text-teal hover:bg-teal/30 transition-colors"
              onClick={() => onReview?.(true)}
              aria-label="אשר תשובה"
            >
              ✓
            </button>
            <button
              className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
              onClick={() => onReview?.(false)}
              aria-label="דחה תשובה"
            >
              ✗
            </button>
          </div>
        )}
      </div>
    </td>
  );
}
