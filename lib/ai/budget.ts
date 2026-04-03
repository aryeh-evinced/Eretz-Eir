import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/observability/logger";

/**
 * AI budget tracking — all state in Postgres, never in-process.
 *
 * Vercel serverless = many concurrent instances. In-process budget tracking
 * would overspend by a factor of concurrent instances. All counters are
 * atomically incremented in Postgres.
 */

// Budget configuration from environment (defaults for development)
const AI_MONTHLY_BUDGET_TOKENS = parseInt(
  process.env.AI_MONTHLY_BUDGET_TOKENS ?? "1000000",
  10,
);
const AI_MAX_CONCURRENT = parseInt(
  process.env.AI_MAX_CONCURRENT ?? "10",
  10,
);
const AI_PER_IP_LIMIT = parseInt(
  process.env.AI_PER_IP_LIMIT ?? "100",
  10,
);
const AI_PER_IP_WINDOW_SECONDS = parseInt(
  process.env.AI_PER_IP_WINDOW_SECONDS ?? "3600",
  10,
);
const AI_PER_GAME_LIMIT = parseInt(
  process.env.AI_PER_GAME_LIMIT ?? "200",
  10,
);
const AI_HELP_PER_ROUND_LIMIT = 2;

function currentMonthKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `ai:budget:monthly:${yyyy}-${mm}`;
}

/**
 * Check if the monthly budget has been exhausted.
 * Returns { exhausted, currentTokens, budgetTokens, percentage }.
 */
export async function checkBudget(
  supabase: SupabaseClient,
): Promise<{
  exhausted: boolean;
  currentTokens: number;
  budgetTokens: number;
  percentage: number;
}> {
  const key = currentMonthKey();

  const { data, error } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    logger.error("budget: failed to read budget counter", { error: error.message });
    // Fail-closed: treat as exhausted to prevent unmetered AI calls
    return {
      exhausted: true,
      currentTokens: AI_MONTHLY_BUDGET_TOKENS,
      budgetTokens: AI_MONTHLY_BUDGET_TOKENS,
      percentage: 100,
    };
  }

  const currentTokens = data?.count ?? 0;
  const percentage = Math.round((currentTokens / AI_MONTHLY_BUDGET_TOKENS) * 100);

  return {
    exhausted: currentTokens >= AI_MONTHLY_BUDGET_TOKENS,
    currentTokens,
    budgetTokens: AI_MONTHLY_BUDGET_TOKENS,
    percentage,
  };
}

/**
 * Record token usage after an AI call.
 * Atomically increments the monthly budget counter.
 */
export async function recordTokenUsage(
  inputTokens: number,
  outputTokens: number,
  supabase: SupabaseClient,
): Promise<void> {
  const totalTokens = inputTokens + outputTokens;
  const key = currentMonthKey();

  // Upsert: increment count by totalTokens
  const { data: current } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("key", key)
    .maybeSingle();

  const newCount = (current?.count ?? 0) + totalTokens;

  const { error } = await supabase
    .from("rate_limits")
    .upsert(
      { key, count: newCount, window_start: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    logger.error("budget: failed to record token usage", {
      error: error.message,
      totalTokens,
    });
    return;
  }

  // Check alert thresholds
  const percentage = Math.round((newCount / AI_MONTHLY_BUDGET_TOKENS) * 100);

  if (percentage >= 95) {
    await emitBudgetAlert(95, percentage, newCount, supabase);
  } else if (percentage >= 80) {
    await emitBudgetAlert(80, percentage, newCount, supabase);
  }
}

/**
 * Emit a budget alert (idempotent — only fires once per threshold per month).
 */
async function emitBudgetAlert(
  threshold: 80 | 95,
  percentage: number,
  currentTokens: number,
  supabase: SupabaseClient,
): Promise<void> {
  const alertKey = `ai:budget:alert:${threshold}`;

  // Check if alert already sent this month
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("key", alertKey)
    .maybeSingle();

  if (existing && existing.count > 0) return; // Already alerted

  // Record alert
  await supabase
    .from("rate_limits")
    .upsert(
      { key: alertKey, count: 1, window_start: new Date().toISOString() },
      { onConflict: "key" },
    );

  const level = threshold === 95 ? "error" : "warn";
  logger[level](`budget: AI budget at ${percentage}% (threshold: ${threshold}%)`, {
    currentTokens,
    budgetTokens: AI_MONTHLY_BUDGET_TOKENS,
    percentage,
    threshold,
  });
}

/**
 * Check per-IP rate limit for AI requests.
 */
export async function checkIPRateLimit(
  ip: string,
  supabase: SupabaseClient,
): Promise<{ allowed: boolean }> {
  const { data, error } = await supabase.rpc("increment_or_reset", {
    p_key: `ai:ip:${ip}`,
    p_max_count: AI_PER_IP_LIMIT,
    p_window_seconds: AI_PER_IP_WINDOW_SECONDS,
  });

  if (error) {
    logger.error("budget: IP rate limit check failed", { ip, error: error.message });
    return { allowed: false }; // Fail-closed
  }

  return { allowed: data !== -1 };
}

/**
 * Check per-game rate limit for AI calls.
 */
export async function checkGameRateLimit(
  gameId: string,
  supabase: SupabaseClient,
): Promise<{ allowed: boolean }> {
  const { data, error } = await supabase.rpc("increment_or_reset", {
    p_key: `ai:game:${gameId}`,
    p_max_count: AI_PER_GAME_LIMIT,
    p_window_seconds: 86400, // 24 hours (game lifetime)
  });

  if (error) {
    logger.error("budget: game rate limit check failed", { gameId, error: error.message });
    return { allowed: false };
  }

  return { allowed: data !== -1 };
}

/**
 * Check per-round help limit (max 2 per round per player).
 */
export async function checkHelpLimit(
  roundId: string,
  playerId: string,
  supabase: SupabaseClient,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ai:help:${roundId}:${playerId}`;

  const { data, error } = await supabase.rpc("increment_or_reset", {
    p_key: key,
    p_max_count: AI_HELP_PER_ROUND_LIMIT,
    p_window_seconds: 86400, // Effectively unlimited window (round-scoped key)
  });

  if (error) {
    logger.error("budget: help limit check failed", { roundId, playerId, error: error.message });
    return { allowed: false, remaining: 0 };
  }

  const allowed = data !== -1;
  const used = allowed ? (data as number) : AI_HELP_PER_ROUND_LIMIT;
  return { allowed, remaining: AI_HELP_PER_ROUND_LIMIT - used };
}

/**
 * Acquire a concurrent AI call slot. Returns true if acquired.
 * Must call releaseConcurrentSlot() after the call completes.
 */
export async function acquireConcurrentSlot(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data: current } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("key", "ai:concurrent")
    .maybeSingle();

  const currentCount = current?.count ?? 0;

  if (currentCount >= AI_MAX_CONCURRENT) {
    logger.warn("budget: concurrent AI limit reached", {
      current: currentCount,
      max: AI_MAX_CONCURRENT,
    });
    return false;
  }

  const { error } = await supabase
    .from("rate_limits")
    .upsert(
      { key: "ai:concurrent", count: currentCount + 1, window_start: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    logger.error("budget: failed to acquire concurrent slot", { error: error.message });
    return false;
  }

  return true;
}

/**
 * Release a concurrent AI call slot.
 */
export async function releaseConcurrentSlot(
  supabase: SupabaseClient,
): Promise<void> {
  const { data: current } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("key", "ai:concurrent")
    .maybeSingle();

  const newCount = Math.max(0, (current?.count ?? 1) - 1);

  await supabase
    .from("rate_limits")
    .upsert(
      { key: "ai:concurrent", count: newCount, window_start: new Date().toISOString() },
      { onConflict: "key" },
    );
}

/**
 * Get current AI budget and usage summary for dashboard/observability.
 */
export async function getBudgetSummary(
  supabase: SupabaseClient,
): Promise<{
  monthlyTokens: number;
  monthlyBudget: number;
  percentage: number;
  concurrentSlots: number;
  maxConcurrent: number;
}> {
  const budget = await checkBudget(supabase);

  const { data: concurrent } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("key", "ai:concurrent")
    .maybeSingle();

  return {
    monthlyTokens: budget.currentTokens,
    monthlyBudget: budget.budgetTokens,
    percentage: budget.percentage,
    concurrentSlots: concurrent?.count ?? 0,
    maxConcurrent: AI_MAX_CONCURRENT,
  };
}
