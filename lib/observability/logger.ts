type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Fields that must NEVER appear in logs.
 *
 * Log redaction contract (from Phase 1):
 * - Raw Authorization headers
 * - Cookies (session tokens)
 * - Service role keys
 * - Full request bodies
 * - Raw AI prompts/responses
 * - Player IPs (hashed only, see PII_FIELDS)
 * - Any field matching provider key patterns
 */
const REDACTED_FIELDS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-service-role",
  "supabase_service_role_key",
  "anthropic_api_key",
  "openai_api_key",
  "apikey",
  "password",
  "secret",
  "token",
  "request_body",
  "requestbody",
  "ai_prompt",
  "ai_response",
  "prompt",
  "completion",
  "raw_response",
]);

/**
 * PII fields — hashed or stripped per ADR 0002 (children's data compliance).
 * These are allowed in logs only in hashed/truncated form.
 */
const PII_FIELDS = new Set([
  "ip",
  "ip_address",
  "client_ip",
  "x-forwarded-for",
  "x-real-ip",
  "email",
  "user_agent",
]);

/**
 * Patterns that indicate leaked secrets. Used by the lint check in CI.
 */
export const SECRET_PATTERNS = [
  /sk-ant-[a-zA-Z0-9]+/,        // Anthropic API key
  /sk-[a-zA-Z0-9]{20,}/,         // OpenAI API key
  /sbp_[a-zA-Z0-9]{20,}/,        // Supabase access token
  /eyJ[a-zA-Z0-9_-]{50,}\./,     // JWT (likely service role key)
] as const;

function hashPII(value: unknown): string {
  // Simple hash for PII fields — truncate to first 8 chars of a hex digest
  // In production, use crypto.subtle.digest or a proper hash.
  const str = String(value);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `[HASHED:${Math.abs(hash).toString(16).slice(0, 8)}]`;
}

function containsSecretPattern(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_FIELDS.has(lowerKey)) {
      cleaned[key] = "[REDACTED]";
    } else if (PII_FIELDS.has(lowerKey)) {
      cleaned[key] = hashPII(value);
    } else if (typeof value === "string" && containsSecretPattern(value)) {
      cleaned[key] = "[REDACTED:secret_pattern_detected]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      cleaned[key] = redact(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? redact(meta) : {}),
  };
  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
