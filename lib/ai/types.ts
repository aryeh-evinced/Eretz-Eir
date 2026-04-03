/** Supported AI provider identifiers. */
export type AIProviderName = "claude" | "openai";

/** Structured message for AI calls. */
export interface AIMessage {
  role: "system" | "user";
  content: string;
}

/** Result from an AI provider call. */
export interface AIProviderResult {
  text: string;
  provider: AIProviderName;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

/** Configuration for an AI provider. */
export interface AIProviderConfig {
  name: AIProviderName;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

/** Circuit breaker state stored in Postgres rate_limits table. */
export interface CircuitBreakerState {
  failureCount: number;
  openUntil: string | null; // ISO8601 timestamp or null if closed
  lastFailure: string | null;
}

/** Circuit breaker status. */
export type CircuitStatus = "closed" | "open" | "half-open";
