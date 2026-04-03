import type { AIProviderName } from "@/lib/ai/types";
import { logger } from "./logger";

/**
 * AI observability — structured logging for all AI operations.
 * Designed for dashboard metrics and cost tracking.
 */

interface AICallMetrics {
  provider: AIProviderName;
  operation: "validate" | "hint" | "fill" | "generate";
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  fallback: boolean;
  error?: string;
}

/**
 * Log an AI call with structured metrics for observability dashboards.
 */
export function logAICall(metrics: AICallMetrics): void {
  const totalTokens = metrics.inputTokens + metrics.outputTokens;

  // Estimated cost (rough approximation for monitoring)
  const costEstimate =
    metrics.provider === "claude"
      ? (metrics.inputTokens * 3 + metrics.outputTokens * 15) / 1_000_000 // Claude Sonnet pricing
      : (metrics.inputTokens * 0.15 + metrics.outputTokens * 0.6) / 1_000_000; // GPT-4o-mini pricing

  logger.info("ai:call", {
    provider: metrics.provider,
    operation: metrics.operation,
    latencyMs: metrics.latencyMs,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    totalTokens,
    success: metrics.success,
    fallback: metrics.fallback,
    costEstimateUsd: costEstimate,
    ...(metrics.error ? { error: metrics.error } : {}),
  });
}

/**
 * Log a degraded path where AI was skipped entirely.
 */
export function logAIDegradation(
  reason: "budget_exhausted" | "circuit_open" | "concurrent_limit" | "rate_limited",
  operation: string,
  details?: Record<string, unknown>,
): void {
  logger.warn("ai:degraded", {
    reason,
    operation,
    ...details,
  });
}

/**
 * Log budget alert events.
 */
export function logBudgetAlert(
  threshold: number,
  percentage: number,
  currentTokens: number,
  budgetTokens: number,
): void {
  const level = threshold >= 95 ? "error" : "warn";
  logger[level]("ai:budget_alert", {
    threshold,
    percentage,
    currentTokens,
    budgetTokens,
  });
}
