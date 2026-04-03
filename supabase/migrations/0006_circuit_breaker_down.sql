-- Rollback 0006: remove circuit breaker seed rows
DELETE FROM rate_limits WHERE key IN ('circuit:claude', 'circuit:openai');
