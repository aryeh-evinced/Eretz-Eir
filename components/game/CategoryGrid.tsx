"use client";

import type { Category } from "@/lib/types/game";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import { Card } from "@/components/ui/Card";

interface CategoryGridProps {
  categories: Category[];
  answers: Record<string, string>;
  onAnswerChange: (category: string, text: string) => void;
  disabled?: boolean;
}

export function CategoryGrid({
  categories,
  answers,
  onAnswerChange,
  disabled = false,
}: CategoryGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full" role="list">
      {categories.map((category) => {
        const icon = CATEGORY_ICONS[category] ?? "📝";
        return (
          <Card
            key={category}
            variant="default"
            className="flex flex-col gap-2 p-3"
            role="listitem"
          >
            <label
              htmlFor={`cat-${category}`}
              className="flex items-center gap-2 text-sm font-medium text-text-primary"
            >
              <span aria-hidden="true" className="text-lg">{icon}</span>
              {category}
            </label>
            <input
              id={`cat-${category}`}
              type="text"
              value={answers[category] ?? ""}
              onChange={(e) => onAnswerChange(category, e.target.value)}
              disabled={disabled}
              placeholder={`...${category}`}
              autoComplete="off"
              className={[
                "w-full rounded-game border bg-input-bg px-3 py-2.5 text-base text-text-primary",
                "placeholder:text-text-dim/50",
                "focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal",
                "transition-colors duration-150",
                "min-h-[44px]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "border-border",
              ].join(" ")}
            />
          </Card>
        );
      })}
    </div>
  );
}
