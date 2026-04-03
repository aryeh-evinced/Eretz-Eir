import { z } from "zod";

/**
 * Zod schemas for validating AI provider responses.
 * All AI output must pass schema validation before being used.
 * Malformed responses are rejected and fall back to word-list mode.
 */

/** Single answer validation result from AI. */
export const answerValidationSchema = z.object({
  category: z.string(),
  text: z.string(),
  isValid: z.boolean(),
  startsWithLetter: z.boolean(),
  isRealWord: z.boolean(),
  matchesCategory: z.boolean(),
  explanation: z.string(),
});

/** Batch validation response. */
export const validationResponseSchema = z.object({
  validations: z.array(answerValidationSchema),
});

/** Hint response. */
export const hintResponseSchema = z.object({
  text: z.string().min(1),
});

/** Competitor generation response. */
export const competitorResponseSchema = z.object({
  answers: z.array(
    z.object({
      category: z.string(),
      text: z.string(),
    }),
  ),
});

export type ValidationResponse = z.infer<typeof validationResponseSchema>;
export type HintResponse = z.infer<typeof hintResponseSchema>;
export type CompetitorResponse = z.infer<typeof competitorResponseSchema>;

/**
 * Parse AI text response as JSON and validate against a Zod schema.
 * Returns null if parsing or validation fails.
 */
export function parseAIResponse<T>(
  text: string,
  schema: z.ZodSchema<T>,
): T | null {
  try {
    // Strip markdown code fences if present (models sometimes add them)
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    return null;
  } catch {
    return null;
  }
}
