-- ---------------------------------------------------------------------------
-- 0006: Circuit breaker support for AI providers
-- ---------------------------------------------------------------------------
-- Adds columns to rate_limits for circuit breaker state.
-- The existing schema (key, count, window_start) is sufficient:
--   key = "circuit:claude" or "circuit:openai"
--   count = consecutive failure count
--   window_start = open_until timestamp (when circuit should transition to half-open)
--
-- No new columns needed — the existing schema supports our circuit breaker
-- pattern. This migration seeds the initial rows so we don't need upsert
-- logic on first failure.
-- ---------------------------------------------------------------------------

INSERT INTO rate_limits (key, count, window_start)
VALUES
  ('circuit:claude', 0, now()),
  ('circuit:openai', 0, now())
ON CONFLICT (key) DO NOTHING;
