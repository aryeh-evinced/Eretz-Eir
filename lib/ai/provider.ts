import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIMessage, AIProviderResult } from "./types";
import { callClaude } from "./claude";
import { callOpenAI } from "./openai";
import { isAvailable, recordSuccess, recordFailure } from "./circuitBreaker";
import { logger } from "@/lib/observability/logger";

/**
 * Call AI provider with Claude as primary and OpenAI as fallback.
 * Circuit breaker state is checked/updated in Postgres.
 *
 * Fallback chain:
 * 1. If Claude circuit is available → try Claude
 * 2. If Claude fails → record failure, try OpenAI
 * 3. If OpenAI circuit is available → try OpenAI
 * 4. If OpenAI fails → record failure, return null (caller falls back to word-list)
 *
 * Fail-closed: if circuit breaker DB is unreachable, both providers are
 * considered unavailable → returns null immediately (word-list mode).
 */
export async function callAI(
  messages: AIMessage[],
  supabase: SupabaseClient,
): Promise<AIProviderResult | null> {
  // Try Claude first
  const claudeCheck = await isAvailable("claude", supabase);

  if (claudeCheck.available) {
    try {
      const result = await callClaude(messages);
      await recordSuccess("claude", supabase);
      return result;
    } catch (err) {
      logger.error("provider: Claude call failed, trying OpenAI", {
        error: err instanceof Error ? err.message : String(err),
        circuitStatus: claudeCheck.status,
      });
      await recordFailure("claude", supabase);
    }
  } else {
    logger.info("provider: Claude circuit is open, skipping to OpenAI", {
      status: claudeCheck.status,
    });
  }

  // Fallback to OpenAI
  const openaiCheck = await isAvailable("openai", supabase);

  if (openaiCheck.available) {
    try {
      const result = await callOpenAI(messages);
      await recordSuccess("openai", supabase);
      return result;
    } catch (err) {
      logger.error("provider: OpenAI call also failed, falling back to word-list", {
        error: err instanceof Error ? err.message : String(err),
        circuitStatus: openaiCheck.status,
      });
      await recordFailure("openai", supabase);
    }
  } else {
    logger.warn("provider: both circuits open, falling back to word-list", {
      claudeStatus: claudeCheck.status,
      openaiStatus: openaiCheck.status,
    });
  }

  // Both providers failed or unavailable
  return null;
}
