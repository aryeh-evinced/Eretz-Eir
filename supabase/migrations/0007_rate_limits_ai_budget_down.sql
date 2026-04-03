-- Rollback 0007: remove AI budget/rate limit seed rows
DELETE FROM rate_limits WHERE key LIKE 'ai:%';
