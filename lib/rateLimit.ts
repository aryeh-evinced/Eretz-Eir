import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/**
 * Check a rate limit using the Supabase `increment_or_reset` RPC.
 *
 * The RPC returns the current count after increment, or -1 if the limit is exceeded.
 * Throws if the RPC call itself errors.
 */
export async function checkRateLimit(
  key: string,
  maxCount: number,
  windowSeconds: number,
  supabase: SupabaseClient,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("increment_or_reset", {
    p_key: key,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    throw new Error(`Rate limit RPC failed: ${error.message}`);
  }

  if (data === null || typeof data !== "number") {
    throw new Error(`Rate limit RPC returned unexpected value: ${JSON.stringify(data)}`);
  }

  const count = data;

  if (count === -1) {
    return { allowed: false, current: maxCount, limit: maxCount };
  }

  return { allowed: true, current: count, limit: maxCount };
}
