import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIProviderName, CircuitBreakerState, CircuitStatus } from "./types";
import { logger } from "@/lib/observability/logger";

/**
 * Circuit breaker backed by Postgres rate_limits table.
 *
 * Design decisions:
 * - State lives in Postgres, not in-process (Vercel serverless = many instances).
 * - Fail-closed: if we can't read circuit state from DB, default to word-list mode.
 * - Uses rate_limits table with keys like "circuit:claude" / "circuit:openai".
 * - failure_count stored in `count` column.
 * - open_until stored in `window_start` column (repurposed: when circuit is open,
 *   this is the time at which it becomes half-open).
 */

const FAILURE_THRESHOLD = 3; // consecutive failures before opening
const OPEN_DURATION_MS = 30_000; // 30 seconds open before half-open

function circuitKey(provider: AIProviderName): string {
  return `circuit:${provider}`;
}

/**
 * Read circuit breaker state from Postgres.
 * Returns null if the row doesn't exist (circuit never tripped).
 * Throws on DB errors — callers must handle this (fail-closed).
 */
async function readState(
  provider: AIProviderName,
  supabase: SupabaseClient,
): Promise<CircuitBreakerState | null> {
  const { data, error } = await supabase
    .from("rate_limits")
    .select("count, window_start")
    .eq("key", circuitKey(provider))
    .maybeSingle();

  if (error) {
    throw new Error(`Circuit breaker DB read failed: ${error.message}`);
  }

  if (!data) return null;

  return {
    failureCount: data.count,
    openUntil: data.window_start,
    lastFailure: null,
  };
}

/**
 * Determine current circuit status from stored state.
 */
export function getStatus(state: CircuitBreakerState | null): CircuitStatus {
  if (!state || state.failureCount < FAILURE_THRESHOLD) {
    return "closed";
  }

  if (state.openUntil) {
    const openUntil = new Date(state.openUntil).getTime();
    if (Date.now() < openUntil) {
      return "open";
    }
    // Past open_until → half-open, allow one probe
    return "half-open";
  }

  // Threshold reached but no open_until — treat as open (defensive)
  return "open";
}

/**
 * Check if a provider's circuit is available for calls.
 *
 * Fail-closed: if DB read fails, returns false (provider unavailable).
 * This prevents unmetered AI calls when infrastructure is degraded.
 */
export async function isAvailable(
  provider: AIProviderName,
  supabase: SupabaseClient,
): Promise<{ available: boolean; status: CircuitStatus }> {
  try {
    const state = await readState(provider, supabase);
    const status = getStatus(state);
    const available = status !== "open";

    if (!available) {
      logger.warn("circuit breaker: provider unavailable", { provider, status });
    }

    return { available, status };
  } catch (err) {
    // Fail-closed: can't read state → assume provider unavailable
    logger.error("circuit breaker: DB read failed, failing closed", {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return { available: false, status: "open" };
  }
}

/**
 * Record a successful call — reset failure count.
 */
export async function recordSuccess(
  provider: AIProviderName,
  supabase: SupabaseClient,
): Promise<void> {
  const key = circuitKey(provider);

  const { error } = await supabase
    .from("rate_limits")
    .upsert(
      { key, count: 0, window_start: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    logger.error("circuit breaker: failed to record success", {
      provider,
      error: error.message,
    });
  }
}

/**
 * Record a failure — increment failure count.
 * If threshold is reached, open the circuit for OPEN_DURATION_MS.
 */
export async function recordFailure(
  provider: AIProviderName,
  supabase: SupabaseClient,
): Promise<void> {
  const key = circuitKey(provider);

  // Read current state
  const state = await readState(provider, supabase).catch(() => null);
  const currentCount = state?.failureCount ?? 0;
  const newCount = currentCount + 1;

  // If we hit the threshold, set open_until
  const openUntil =
    newCount >= FAILURE_THRESHOLD
      ? new Date(Date.now() + OPEN_DURATION_MS).toISOString()
      : new Date().toISOString();

  const { error } = await supabase
    .from("rate_limits")
    .upsert(
      { key, count: newCount, window_start: openUntil },
      { onConflict: "key" },
    );

  if (error) {
    logger.error("circuit breaker: failed to record failure", {
      provider,
      error: error.message,
    });
  } else {
    logger.warn("circuit breaker: failure recorded", {
      provider,
      failureCount: newCount,
      threshold: FAILURE_THRESHOLD,
      circuitOpened: newCount >= FAILURE_THRESHOLD,
    });
  }
}
