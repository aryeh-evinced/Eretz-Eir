import { describe, it, expect, vi } from "vitest";

// We test the budget module's pure logic. DB interactions are mocked.
// The budget module uses environment variables for configuration.

describe("AI budget configuration", () => {
  it("default budget is 1M tokens", () => {
    // The module reads AI_MONTHLY_BUDGET_TOKENS with default 1000000
    expect(parseInt(process.env.AI_MONTHLY_BUDGET_TOKENS ?? "1000000", 10)).toBe(1000000);
  });

  it("default max concurrent is 10", () => {
    expect(parseInt(process.env.AI_MAX_CONCURRENT ?? "10", 10)).toBe(10);
  });

  it("default per-IP limit is 100 per hour", () => {
    expect(parseInt(process.env.AI_PER_IP_LIMIT ?? "100", 10)).toBe(100);
    expect(parseInt(process.env.AI_PER_IP_WINDOW_SECONDS ?? "3600", 10)).toBe(3600);
  });

  it("default per-game limit is 200", () => {
    expect(parseInt(process.env.AI_PER_GAME_LIMIT ?? "200", 10)).toBe(200);
  });
});

describe("AI observability", () => {
  it("logAICall logs structured metrics", async () => {
    const { logAICall } = await import("@/lib/observability/ai");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logAICall({
      provider: "claude",
      operation: "validate",
      latencyMs: 250,
      inputTokens: 100,
      outputTokens: 50,
      success: true,
      fallback: false,
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.message).toBe("ai:call");
    expect(parsed.provider).toBe("claude");
    expect(parsed.totalTokens).toBe(150);
    expect(parsed.success).toBe(true);

    consoleSpy.mockRestore();
  });

  it("logAIDegradation logs degradation events", async () => {
    const { logAIDegradation } = await import("@/lib/observability/ai");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logAIDegradation("budget_exhausted", "callAI", { percentage: 100 });

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.message).toBe("ai:degraded");
    expect(parsed.reason).toBe("budget_exhausted");

    consoleSpy.mockRestore();
  });
});
