-- ---------------------------------------------------------------------------
-- 0007: AI rate limits and budget tracking
-- ---------------------------------------------------------------------------
-- Extends rate_limits for AI-specific rate limiting and budget tracking.
-- Uses the existing schema (key, count, window_start) pattern.
--
-- Rate limit keys:
--   ai:ip:{ip}          — per-IP AI request limit
--   ai:game:{game_id}   — per-game AI call count
--   ai:concurrent       — global concurrent AI call count
--   ai:help:{round_id}:{player_id} — per-round help limit (max 2)
--   ai:budget:monthly:{YYYY-MM}    — monthly token budget (cumulative)
--   ai:budget:alert:80  — flag: 80% alert sent
--   ai:budget:alert:95  — flag: 95% alert sent
-- ---------------------------------------------------------------------------

-- Seed the global concurrent counter (starts at 0)
INSERT INTO rate_limits (key, count, window_start)
VALUES ('ai:concurrent', 0, now())
ON CONFLICT (key) DO NOTHING;

-- Seed the current month's budget counter
INSERT INTO rate_limits (key, count, window_start)
VALUES (
  'ai:budget:monthly:' || to_char(now(), 'YYYY-MM'),
  0,
  now()
)
ON CONFLICT (key) DO NOTHING;
