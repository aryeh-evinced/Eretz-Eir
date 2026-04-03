import { describe, it, expect } from "vitest";
import { getStatus } from "@/lib/ai/circuitBreaker";
import type { CircuitBreakerState } from "@/lib/ai/types";

describe("circuitBreaker.getStatus", () => {
  it("returns closed when state is null", () => {
    expect(getStatus(null)).toBe("closed");
  });

  it("returns closed when failure count is below threshold", () => {
    const state: CircuitBreakerState = {
      failureCount: 2,
      openUntil: null,
      lastFailure: null,
    };
    expect(getStatus(state)).toBe("closed");
  });

  it("returns closed when failure count is zero", () => {
    const state: CircuitBreakerState = {
      failureCount: 0,
      openUntil: new Date().toISOString(),
      lastFailure: null,
    };
    expect(getStatus(state)).toBe("closed");
  });

  it("returns open when failure count >= threshold and open_until is in the future", () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    const state: CircuitBreakerState = {
      failureCount: 3,
      openUntil: futureDate,
      lastFailure: null,
    };
    expect(getStatus(state)).toBe("open");
  });

  it("returns half-open when failure count >= threshold and open_until is in the past", () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const state: CircuitBreakerState = {
      failureCount: 3,
      openUntil: pastDate,
      lastFailure: null,
    };
    expect(getStatus(state)).toBe("half-open");
  });

  it("returns open when threshold reached but no open_until", () => {
    const state: CircuitBreakerState = {
      failureCount: 5,
      openUntil: null,
      lastFailure: null,
    };
    expect(getStatus(state)).toBe("open");
  });

  it("treats exactly threshold count as open", () => {
    const futureDate = new Date(Date.now() + 30_000).toISOString();
    const state: CircuitBreakerState = {
      failureCount: 3,
      openUntil: futureDate,
      lastFailure: null,
    };
    expect(getStatus(state)).toBe("open");
  });
});
