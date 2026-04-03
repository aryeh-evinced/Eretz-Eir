import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, HebrewLetter, RoundAnswers } from "@/lib/types/game";
import type { ValidationResult, AnswerValidation } from "@/lib/types/ai";
import { callAI } from "./provider";
import {
  VALIDATION_SYSTEM_PROMPT,
  buildValidationPrompt,
} from "./prompts";
import {
  validationResponseSchema,
  parseAIResponse,
} from "./schema";
import { validateAnswersWithWordList } from "@/lib/game/fallbackWords";
import { sanitizeAnswer } from "@/lib/game/normalization";
import { logger } from "@/lib/observability/logger";

/** Suspicious input patterns — reject before sending to AI. */
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(previous|all|above)/i,
  /system\s*prompt/i,
  /you\s+are\s+(now|a)/i,
  /\bprompt\b/i,
  /\binstructions?\b/i,
];

/**
 * Check if an answer looks like a prompt injection attempt.
 */
function isSuspiciousInput(text: string): boolean {
  return SUSPICIOUS_PATTERNS.some((p) => p.test(text));
}

/**
 * Validate a single answer using AI, with word-list fallback.
 * Exported for use in the accuracy evaluation test.
 */
export async function validateAnswerWithAI(
  answer: string,
  letter: HebrewLetter,
  category: Category,
  supabase: SupabaseClient,
): Promise<AnswerValidation> {
  const sanitized = sanitizeAnswer(answer);

  // Pre-check: empty or wrong letter
  if (!sanitized || !sanitized.startsWith(letter)) {
    return {
      category,
      text: sanitized,
      isValid: false,
      startsWithLetter: sanitized ? sanitized.startsWith(letter) : false,
      isRealWord: false,
      matchesCategory: false,
      explanation: sanitized ? "לא מתחיל באות הנכונה" : "תשובה ריקה",
    };
  }

  // Pre-check: suspicious patterns
  if (isSuspiciousInput(sanitized)) {
    logger.warn("validate: suspicious input rejected", { answer: sanitized, category, letter });
    return {
      category,
      text: sanitized,
      isValid: false,
      startsWithLetter: true,
      isRealWord: false,
      matchesCategory: false,
      explanation: "תשובה חשודה",
    };
  }

  // Try AI validation
  const result = await callAI(
    [
      { role: "system", content: VALIDATION_SYSTEM_PROMPT },
      { role: "user", content: buildValidationPrompt(letter, [{ category, text: sanitized }]) },
    ],
    supabase,
  );

  if (result) {
    const parsed = parseAIResponse(result.text, validationResponseSchema);
    if (parsed && parsed.validations.length > 0) {
      const v = parsed.validations[0];
      return {
        category,
        text: sanitized,
        isValid: v.isValid,
        startsWithLetter: v.startsWithLetter,
        isRealWord: v.isRealWord,
        matchesCategory: v.matchesCategory,
        explanation: v.explanation,
      };
    }
    logger.warn("validate: AI response failed schema validation, falling back", { category, letter });
  }

  // Fallback to word-list
  const wordListResult = validateAnswersWithWordList({ [category]: sanitized }, letter);
  const valid = wordListResult[category]?.valid ?? false;

  return {
    category,
    text: sanitized,
    isValid: valid,
    startsWithLetter: true,
    isRealWord: valid,
    matchesCategory: valid,
    explanation: valid ? "אומת מרשימת מילים" : "לא נמצא ברשימת מילים",
  };
}

/**
 * Validate all answers for a round using AI, with per-answer fallback.
 * Implements the same contract as the stub in lib/game/validator.ts.
 *
 * All answers for one player are batched in a single AI call.
 * If the AI call fails, falls back to word-list validation.
 */
export async function validateAnswersWithAI(
  answers: RoundAnswers,
  supabase: SupabaseClient,
): Promise<ValidationResult> {
  const sanitizedAnswers = answers.answers
    .map((a) => ({
      category: a.category,
      text: sanitizeAnswer(a.text),
    }))
    .filter((a) => a.text.length > 0);

  // Reject suspicious inputs before AI call
  const safeAnswers = sanitizedAnswers.filter((a) => !isSuspiciousInput(a.text));
  const rejectedAnswers = sanitizedAnswers.filter((a) => isSuspiciousInput(a.text));

  if (rejectedAnswers.length > 0) {
    logger.warn("validate: rejected suspicious inputs", {
      count: rejectedAnswers.length,
      letter: answers.letter,
    });
  }

  // Build validation results for rejected answers
  const rejectedResults: AnswerValidation[] = rejectedAnswers.map((a) => ({
    category: a.category as Category,
    text: a.text,
    isValid: false,
    startsWithLetter: a.text.startsWith(answers.letter),
    isRealWord: false,
    matchesCategory: false,
    explanation: "תשובה חשודה",
  }));

  if (safeAnswers.length === 0) {
    // All answers were empty, rejected, or filtered
    const emptyResults: AnswerValidation[] = answers.answers.map((a) => ({
      category: a.category,
      text: sanitizeAnswer(a.text),
      isValid: false,
      startsWithLetter: false,
      isRealWord: false,
      matchesCategory: false,
      explanation: "תשובה ריקה",
    }));
    return { validations: [...emptyResults, ...rejectedResults] };
  }

  // Try batch AI validation
  const result = await callAI(
    [
      { role: "system", content: VALIDATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildValidationPrompt(
          answers.letter,
          safeAnswers.map((a) => ({ category: a.category as Category, text: a.text })),
        ),
      },
    ],
    supabase,
  );

  if (result) {
    const parsed = parseAIResponse(result.text, validationResponseSchema);
    if (parsed && parsed.validations.length === safeAnswers.length) {
      logger.info("validate: AI batch validation succeeded", {
        letter: answers.letter,
        count: safeAnswers.length,
        provider: result.provider,
      });

      const aiResults: AnswerValidation[] = parsed.validations.map((v) => ({
        category: v.category as Category,
        text: v.text,
        isValid: v.isValid,
        startsWithLetter: v.startsWithLetter,
        isRealWord: v.isRealWord,
        matchesCategory: v.matchesCategory,
        explanation: v.explanation,
      }));

      return { validations: [...aiResults, ...rejectedResults] };
    }

    logger.warn("validate: AI response count mismatch or parse failure, falling back", {
      expected: safeAnswers.length,
      got: parsed?.validations.length ?? 0,
    });
  }

  // Fallback: word-list validation
  logger.info("validate: falling back to word-list validation", {
    letter: answers.letter,
    count: safeAnswers.length,
  });

  const wordListInput: Record<string, string> = {};
  for (const a of safeAnswers) {
    wordListInput[a.category] = a.text;
  }
  const wordListResults = validateAnswersWithWordList(wordListInput, answers.letter);

  const fallbackResults: AnswerValidation[] = safeAnswers.map((a) => {
    const valid = wordListResults[a.category]?.valid ?? false;
    return {
      category: a.category as Category,
      text: a.text,
      isValid: valid,
      startsWithLetter: a.text.startsWith(answers.letter),
      isRealWord: valid,
      matchesCategory: valid,
      explanation: valid ? "אומת מרשימת מילים" : "לא נמצא ברשימת מילים",
    };
  });

  return { validations: [...fallbackResults, ...rejectedResults] };
}
