import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIMessage, AIProviderResult } from "./types";
import { callClaude } from "./claude";
import { callOpenAI } from "./openai";
import { isAvailable, recordSuccess, recordFailure } from "./circuitBreaker";
import {
  checkBudget,
  recordTokenUsage,
  acquireConcurrentSlot,
  releaseConcurrentSlot,
} from "./budget";
import { logAICall, logAIDegradation } from "@/lib/observability/ai";
import { logger } from "@/lib/observability/logger";

/**
 * Call AI provider with Claude as primary and OpenAI as fallback.
 * Circuit breaker state is checked/updated in Postgres.
 * Budget and concurrency limits are enforced before the call.
 *
 * Fallback chain:
 * 1. Check budget — if exhausted, return null (word-list mode)
 * 2. Acquire concurrent slot — if full, return null
 * 3. If Claude circuit is available → try Claude
 * 4. If Claude fails → record failure, try OpenAI
 * 5. If OpenAI circuit is available → try OpenAI
 * 6. If OpenAI fails → record failure, return null (word-list mode)
 * 7. Release concurrent slot and record token usage
 *
 * Fail-closed: if circuit breaker DB is unreachable, both providers are
 * considered unavailable → returns null immediately (word-list mode).
 */
export async function callAI(
  messages: AIMessage[],
  supabase: SupabaseClient,
): Promise<AIProviderResult | null> {
  // Budget check
  const budget = await checkBudget(supabase);
  if (budget.exhausted) {
    logAIDegradation("budget_exhausted", "callAI", {
      percentage: budget.percentage,
      currentTokens: budget.currentTokens,
    });
    return null;
  }

  // Concurrency check
  const acquired = await acquireConcurrentSlot(supabase);
  if (!acquired) {
    logAIDegradation("concurrent_limit", "callAI");
    return null;
  }

  try {
    // Try Claude first
    const claudeCheck = await isAvailable("claude", supabase);

    if (claudeCheck.available) {
      try {
        const result = await callClaude(messages);
        await recordSuccess("claude", supabase);
        await recordTokenUsage(result.inputTokens, result.outputTokens, supabase);
        logAICall({
          provider: "claude",
          operation: "validate",
          latencyMs: result.latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          success: true,
          fallback: false,
        });
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error("provider: Claude call failed, trying OpenAI", {
          error: errorMsg,
          circuitStatus: claudeCheck.status,
        });
        logAICall({
          provider: "claude",
          operation: "validate",
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          fallback: true,
          error: errorMsg,
        });
        await recordFailure("claude", supabase);
      }
    } else {
      logAIDegradation("circuit_open", "callAI:claude");
    }

    // Fallback to OpenAI
    const openaiCheck = await isAvailable("openai", supabase);

    if (openaiCheck.available) {
      try {
        const result = await callOpenAI(messages);
        await recordSuccess("openai", supabase);
        await recordTokenUsage(result.inputTokens, result.outputTokens, supabase);
        logAICall({
          provider: "openai",
          operation: "validate",
          latencyMs: result.latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          success: true,
          fallback: true,
        });
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error("provider: OpenAI call also failed, falling back to word-list", {
          error: errorMsg,
          circuitStatus: openaiCheck.status,
        });
        logAICall({
          provider: "openai",
          operation: "validate",
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          fallback: true,
          error: errorMsg,
        });
        await recordFailure("openai", supabase);
      }
    } else {
      logAIDegradation("circuit_open", "callAI:openai");
    }

    // Both providers failed or unavailable
    return null;
  } finally {
    await releaseConcurrentSlot(supabase);
  }
}
