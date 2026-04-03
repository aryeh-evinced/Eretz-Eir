-- supabase/tests/rls.test.sql
-- RLS smoke tests.
-- Run via: psql <connection_string> -f supabase/tests/rls.test.sql
--
-- Requires pgTAP extension (available on Supabase hosted projects).
-- Each test uses SET LOCAL ROLE / SET LOCAL request.jwt.claims to simulate
-- a specific authenticated user.

BEGIN;

SELECT plan(12);

-- ---------------------------------------------------------------------------
-- Setup: seed test data as superuser
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p1_id uuid := '10000000-0000-0000-0000-000000000001';
  p2_id uuid := '10000000-0000-0000-0000-000000000002';
  g_id  uuid := '20000000-0000-0000-0000-000000000001';
  r_id  uuid := '30000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO players (id, name, avatar, age_group) VALUES
    (p1_id, 'Player 1', '', 'adult'),
    (p2_id, 'Player 2', '', 'adult')
  ON CONFLICT DO NOTHING;

  INSERT INTO player_stats (player_id) VALUES (p1_id), (p2_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO game_sessions (id, mode, status, category_mode, categories, timer_seconds, created_by) VALUES
    (g_id, 'multiplayer', 'playing', 'fixed', ARRAY['ארץ','עיר'], 90, p1_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO game_players (game_id, player_id) VALUES (g_id, p1_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO rounds (id, game_id, round_number, letter, categories, status) VALUES
    (r_id, g_id, 1, 'א', ARRAY['ארץ','עיר'], 'playing')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_auth_user(p_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    true);
  SELECT set_config('role', 'authenticated', true);
$$;

-- ---------------------------------------------------------------------------
-- 1. Player can SELECT their own row
-- ---------------------------------------------------------------------------
SELECT set_auth_user('10000000-0000-0000-0000-000000000001'::uuid);
SELECT is(
  (SELECT count(*)::int FROM players WHERE id = '10000000-0000-0000-0000-000000000001'),
  1,
  'Player 1 can read their own row'
);

-- 2. Player cannot SELECT another player's row
SELECT is(
  (SELECT count(*)::int FROM players WHERE id = '10000000-0000-0000-0000-000000000002'),
  0,
  'Player 1 cannot read Player 2 row'
);

-- 3. Player can SELECT their own stats
SELECT is(
  (SELECT count(*)::int FROM player_stats WHERE player_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'Player 1 can read their own stats'
);

-- 4. Player cannot SELECT another player's stats
SELECT is(
  (SELECT count(*)::int FROM player_stats WHERE player_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'Player 1 cannot read Player 2 stats'
);

-- 5. Game participant can SELECT their game
SELECT is(
  (SELECT count(*)::int FROM game_sessions WHERE id = '20000000-0000-0000-0000-000000000001'),
  1,
  'Player 1 (participant) can read game session'
);

-- 6. Non-participant cannot SELECT the game
SELECT set_auth_user('10000000-0000-0000-0000-000000000002'::uuid);
SELECT is(
  (SELECT count(*)::int FROM game_sessions WHERE id = '20000000-0000-0000-0000-000000000001'),
  0,
  'Player 2 (non-participant) cannot read game session'
);

-- 7. Direct INSERT into answers is blocked for authenticated users
SELECT throws_ok(
  $$INSERT INTO answers (round_id, player_id, category, help_used, speed_bonus, score)
    VALUES ('30000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000002',
            'ארץ', 'none', false, 0)$$,
  'new row violates row-level security policy for table "answers"',
  'Direct INSERT into answers is blocked for authenticated users'
);

-- 8. Direct UPDATE of game_sessions status is blocked for authenticated users
SELECT throws_ok(
  $$UPDATE game_sessions SET status = 'finished'
     WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  'new row violates row-level security policy for table "game_sessions"',
  'Direct UPDATE of game_sessions is blocked'
);

-- 9. rate_limits is completely blocked for authenticated users
SELECT set_auth_user('10000000-0000-0000-0000-000000000001'::uuid);
SELECT is(
  (SELECT count(*)::int FROM rate_limits),
  0,
  'rate_limits returns no rows for authenticated users (RLS blocks all)'
);

-- 10. job_health is blocked for authenticated users
SELECT is(
  (SELECT count(*)::int FROM job_health),
  0,
  'job_health returns no rows for authenticated users (RLS blocks all)'
);

-- 11. heartbeat() RPC updates last_seen_at for participant
SELECT set_auth_user('10000000-0000-0000-0000-000000000001'::uuid);
SELECT is(
  heartbeat('20000000-0000-0000-0000-000000000001'::uuid),
  true,
  'heartbeat() returns true for game participant'
);

-- 12. heartbeat() returns false for non-participant
SELECT set_auth_user('10000000-0000-0000-0000-000000000002'::uuid);
SELECT is(
  heartbeat('20000000-0000-0000-0000-000000000001'::uuid),
  false,
  'heartbeat() returns false for non-participant'
);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
SELECT * FROM finish();

ROLLBACK;
