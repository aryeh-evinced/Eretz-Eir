import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the logger's redaction by capturing console output
describe("Log Redaction", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts authorization headers", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", { authorization: "Bearer sk-secret-key" });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authorization).toBe("[REDACTED]");
  });

  it("redacts cookies", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", { cookie: "session=abc123" });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.cookie).toBe("[REDACTED]");
  });

  it("redacts service role keys", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", { supabase_service_role_key: "eyJhbGci..." });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.supabase_service_role_key).toBe("[REDACTED]");
  });

  it("redacts AI prompts and responses", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", {
      ai_prompt: "Validate these answers...",
      ai_response: "The answers are valid...",
    });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.ai_prompt).toBe("[REDACTED]");
    expect(parsed.ai_response).toBe("[REDACTED]");
  });

  it("redacts request bodies", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", { request_body: '{"answers": [...]}' });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.request_body).toBe("[REDACTED]");
  });

  it("hashes PII fields (IP addresses)", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", { ip_address: "192.168.1.1" });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.ip_address).toMatch(/^\[HASHED:[0-9a-f]+\]$/);
    expect(parsed.ip_address).not.toContain("192.168.1.1");
  });

  it("hashes email addresses in PII fields", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", { email: "child@example.com" });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.email).toMatch(/^\[HASHED:[0-9a-f]+\]$/);
    expect(parsed.email).not.toContain("child@example.com");
  });

  it("detects and redacts secret patterns in values", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", {
      someField: "my key is sk-ant-abc123secretkey",
    });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.someField).toBe("[REDACTED:secret_pattern_detected]");
  });

  it("redacts nested sensitive fields", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", {
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.headers.authorization).toBe("[REDACTED]");
    expect(parsed.headers["content-type"]).toBe("application/json");
  });

  it("passes through safe fields unchanged", async () => {
    const { logger } = await import("@/lib/observability/logger");
    logger.info("test", {
      gameId: "abc-123",
      playerId: "uuid-456",
      score: 42,
    });
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.gameId).toBe("abc-123");
    expect(parsed.playerId).toBe("uuid-456");
    expect(parsed.score).toBe(42);
  });
});
