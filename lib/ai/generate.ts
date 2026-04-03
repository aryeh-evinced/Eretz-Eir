import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, HebrewLetter } from "@/lib/types/game";
import type { CompetitorAnswer, CompetitorGenerationResult } from "@/lib/types/ai";
import { callAI } from "./provider";
import {
  COMPETITOR_SYSTEM_PROMPT,
  buildCompetitorPrompt,
} from "./prompts";
import { competitorResponseSchema, parseAIResponse } from "./schema";
import { isContentSafe } from "./contentSafety";
import { getRandomWord } from "@/lib/game/fallbackWords";
import { logger } from "@/lib/observability/logger";

/**
 * Generate competitor answers using AI with word-list fallback.
 * Content safety filter applied to all AI-generated text.
 */
export async function generateCompetitorAnswers(
  letter: HebrewLetter,
  categories: Category[],
  difficulty: "easy" | "medium" | "hard",
  supabase: SupabaseClient,
): Promise<CompetitorGenerationResult> {
  // Try AI generation
  const result = await callAI(
    [
      { role: "system", content: COMPETITOR_SYSTEM_PROMPT },
      { role: "user", content: buildCompetitorPrompt(letter, categories, difficulty) },
    ],
    supabase,
  );

  if (result) {
    const parsed = parseAIResponse(result.text, competitorResponseSchema);
    if (parsed) {
      // Content safety filter
      const safeAnswers = parsed.answers.filter((a) => isContentSafe(a.text));
      const filteredCount = parsed.answers.length - safeAnswers.length;

      if (filteredCount > 0) {
        logger.warn("generate: filtered unsafe competitor answers", { filteredCount });
      }

      // Fill any missing categories from word list
      const answeredCategories = new Set(safeAnswers.map((a) => a.category));
      const missing = categories.filter((c) => !answeredCategories.has(c));

      const filledAnswers: CompetitorAnswer[] = [
        ...safeAnswers.map((a) => ({
          category: a.category as Category,
          text: a.text,
        })),
        ...missing.map((c) => ({
          category: c,
          text: getRandomWord(letter, c),
        })),
      ];

      logger.info("generate: AI competitor generation succeeded", {
        letter,
        aiAnswers: safeAnswers.length,
        wordListFills: missing.length,
      });

      return { answers: filledAnswers };
    }

    logger.warn("generate: AI response failed schema validation, falling back");
  }

  // Fallback: word-list generation
  logger.info("generate: falling back to word-list generation", { letter });

  const fallbackAnswers: CompetitorAnswer[] = categories.map((c) => ({
    category: c,
    text: getRandomWord(letter, c),
  }));

  return { answers: fallbackAnswers };
}
