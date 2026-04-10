import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoundAnswers, Category } from "@/lib/types/game";
import type { ValidationResult, AnswerValidation } from "@/lib/types/ai";
import { validateAnswersWithAI } from "@/lib/ai/validate";
import { validateWord, insertWord } from "@/lib/game/wordDb";
import { sanitizeAnswer } from "@/lib/game/normalization";
import { logger } from "@/lib/observability/logger";

function tryLearnWord(letter: string, category: string, word: string): void {
  try {
    insertWord(letter, category, word, "llm");
    logger.info("validator: learned new word from AI", { letter, category, word });
  } catch {
    // Non-fatal: word learning is best-effort
  }
}

/**
 * Validate all answers for a round.
 *
 * Strategy: word-list DB first (instant, free), AI only for misses.
 *
 * 1. Check each answer against the local word DB
 * 2. Answers found in DB are accepted immediately
 * 3. Answers NOT in DB are batched and sent to AI for validation
 * 4. If AI is unavailable, unknown answers are rejected
 */
export async function validateAnswers(
  answers: RoundAnswers,
  supabase: SupabaseClient,
): Promise<ValidationResult> {
  const dbHits: AnswerValidation[] = [];
  const dbMisses: { category: Category; text: string }[] = [];

  for (const a of answers.answers) {
    const sanitized = sanitizeAnswer(a.text).trim();
    if (!sanitized || !sanitized.startsWith(answers.letter)) {
      dbHits.push({
        category: a.category,
        text: sanitized,
        isValid: false,
        startsWithLetter: !!sanitized && sanitized.startsWith(answers.letter),
        isRealWord: false,
        matchesCategory: false,
        explanation: !sanitized ? "תשובה ריקה" : "לא מתחיל באות הנכונה",
      });
      continue;
    }

    if (validateWord(a.text, answers.letter, a.category)) {
      dbHits.push({
        category: a.category,
        text: sanitized,
        isValid: true,
        startsWithLetter: true,
        isRealWord: true,
        matchesCategory: true,
        explanation: "אומת ממאגר המילים",
      });
    } else {
      dbMisses.push({ category: a.category, text: a.text });
    }
  }

  logger.info("validateAnswers: word DB check complete", {
    letter: answers.letter,
    hits: dbHits.filter((h) => h.isValid).length,
    misses: dbMisses.length,
    rejected: dbHits.filter((h) => !h.isValid).length,
  });

  if (dbMisses.length === 0) {
    return { validations: dbHits };
  }

  // Send only the DB misses to AI for validation
  const aiAnswers: RoundAnswers = {
    roundId: answers.roundId,
    letter: answers.letter,
    answers: dbMisses,
  };

  try {
    const aiResult = await validateAnswersWithAI(aiAnswers, supabase);
    // Learn validated words so future lookups hit the DB directly
    for (const v of aiResult.validations) {
      if (v.isValid) {
        tryLearnWord(answers.letter, v.category, v.text);
      }
    }

    logger.info("validateAnswers: AI fallback completed", {
      letter: answers.letter,
      aiChecked: dbMisses.length,
      aiValid: aiResult.validations.filter((v) => v.isValid).length,
    });
    return { validations: [...dbHits, ...aiResult.validations] };
  } catch (err) {
    logger.warn("validateAnswers: AI fallback failed, rejecting unknowns", {
      error: err instanceof Error ? err.message : String(err),
      missCount: dbMisses.length,
    });

    const rejections: AnswerValidation[] = dbMisses.map((m) => ({
      category: m.category as Category,
      text: sanitizeAnswer(m.text),
      isValid: false,
      startsWithLetter: true,
      isRealWord: false,
      matchesCategory: false,
      explanation: "לא נמצא במאגר המילים",
    }));

    return { validations: [...dbHits, ...rejections] };
  }
}
