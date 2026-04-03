import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeSupabaseMock(rpcReturnValue: number | null, rpcError?: string) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: rpcReturnValue,
      error: rpcError ? { message: rpcError } : null,
    }),
  } as unknown as SupabaseClient;
}

describe("checkRateLimit", () => {
  it("allows when count is within limit", async () => {
    const supabase = makeSupabaseMock(3); // current count = 3
    const result = await checkRateLimit("user:p1:join", 10, 60, supabase);
    expect(result).toEqual({ allowed: true, current: 3, limit: 10 });
  });

  it("allows when count equals limit", async () => {
    const supabase = makeSupabaseMock(10); // exactly at limit
    const result = await checkRateLimit("user:p1:join", 10, 60, supabase);
    expect(result).toEqual({ allowed: true, current: 10, limit: 10 });
  });

  it("blocks when RPC returns -1 (limit exceeded)", async () => {
    const supabase = makeSupabaseMock(-1);
    const result = await checkRateLimit("user:p1:join", 10, 60, supabase);
    expect(result).toEqual({ allowed: false, current: 10, limit: 10 });
  });

  it("throws when RPC errors", async () => {
    const supabase = makeSupabaseMock(null, "connection failed");
    await expect(checkRateLimit("user:p1:join", 10, 60, supabase)).rejects.toThrow(
      /Rate limit RPC failed/,
    );
  });

  it("throws when RPC returns null data without error", async () => {
    const supabase = makeSupabaseMock(null);
    await expect(checkRateLimit("user:p1:join", 10, 60, supabase)).rejects.toThrow(
      /Rate limit RPC returned unexpected value/,
    );
  });

  it("passes correct arguments to the RPC", async () => {
    const supabase = makeSupabaseMock(1);
    await checkRateLimit("room:abc:connect", 5, 30, supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("increment_or_reset", {
      p_key: "room:abc:connect",
      p_max_count: 5,
      p_window_seconds: 30,
    });
  });

  it("allows count of 1 (first request)", async () => {
    const supabase = makeSupabaseMock(1);
    const result = await checkRateLimit("user:p2:create", 100, 3600, supabase);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
  });
});
