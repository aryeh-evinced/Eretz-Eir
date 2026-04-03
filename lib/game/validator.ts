import type { RoundAnswers } from "@/lib/types/game";
import type { ValidationResult } from "@/lib/types/ai";

/**
 * Validate all answers for a round by calling the AI provider.
 * Stub — implementation in Phase 5.
 */
export async function validateAnswers(_answers: RoundAnswers): Promise<ValidationResult> {
  throw new Error("Not implemented — requires AI provider (Phase 5)");
}
