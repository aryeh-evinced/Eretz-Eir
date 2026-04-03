"use client";

import { Avatar } from "@/components/ui/Avatar";
import { AnswerCell } from "./AnswerCell";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import type { Category, HelpUsed } from "@/lib/types/game";

interface PlayerResult {
  id: string;
  name: string;
  avatar: string;
  answers: Record<
    string,
    {
      answerId?: string;
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

interface ResultsTableProps {
  results: PlayerResult[];
  categories: Category[];
  /** Show host review controls for answers in manual_review state. */
  isManualReview?: boolean;
  /** Callback when host reviews an answer. */
  onReviewAnswer?: (answerId: string, isValid: boolean) => void;
}

/** Full results table showing all players' answers with scoring details. */
export function ResultsTable({
  results,
  categories,
  isManualReview,
  onReviewAnswer,
}: ResultsTableProps) {
  return (
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
                  <Avatar name={player.name} emoji={player.avatar} size="sm" />
                  <span className="font-medium text-text-primary text-xs">
                    {player.name}
                  </span>
                </div>
              </td>
              {categories.map((cat) => {
                const cell = player.answers[cat];
                return (
                  <AnswerCell
                    key={cat}
                    text={cell?.text ?? null}
                    score={cell?.score ?? 0}
                    isValid={cell?.isValid ?? false}
                    isUnique={cell?.isUnique ?? false}
                    speedBonus={cell?.speedBonus ?? false}
                    helpUsed={cell?.helpUsed ?? "none"}
                    showReview={isManualReview && !!cell?.answerId}
                    onReview={
                      cell?.answerId
                        ? (isValid) => onReviewAnswer?.(cell.answerId!, isValid)
                        : undefined
                    }
                  />
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
  );
}
