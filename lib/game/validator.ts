import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoundAnswers } from "@/lib/types/game";
import type { ValidationResult } from "@/lib/types/ai";
import { validateAnswersWithAI } from "@/lib/ai/validate";

/**
 * Validate all answers for a round.
 *
 * Phase 5 implementation: delegates to AI validation with automatic
 * word-list fallback (handled inside validateAnswersWithAI).
 *
 * Drop-in replacement for the Phase 4 stub — same interface, now
 * backed by AI with circuit-breaker-protected fallback chain.
 */
export async function validateAnswers(
  answers: RoundAnswers,
  supabase: SupabaseClient,
): Promise<ValidationResult> {
  return validateAnswersWithAI(answers, supabase);
}
