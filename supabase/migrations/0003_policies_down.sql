-- 0003_policies_down.sql
-- Reverses 0003_policies.sql

DROP POLICY IF EXISTS "answers_select_others_after_round" ON answers;
DROP POLICY IF EXISTS "answers_select_own"               ON answers;
DROP POLICY IF EXISTS "rounds_select_participant"         ON rounds;
DROP POLICY IF EXISTS "game_players_select_participant"   ON game_players;
DROP POLICY IF EXISTS "game_sessions_select_participant"  ON game_sessions;
DROP POLICY IF EXISTS "rooms_select_active"               ON rooms;
DROP POLICY IF EXISTS "player_stats_select_self"          ON player_stats;
DROP POLICY IF EXISTS "players_update_self"               ON players;
DROP POLICY IF EXISTS "players_select_self"               ON players;

DROP FUNCTION IF EXISTS is_game_participant(uuid);

ALTER TABLE job_health           DISABLE ROW LEVEL SECURITY;
ALTER TABLE stats_refresh_queue  DISABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits          DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                DISABLE ROW LEVEL SECURITY;
ALTER TABLE answers              DISABLE ROW LEVEL SECURITY;
ALTER TABLE rounds               DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_players         DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats         DISABLE ROW LEVEL SECURITY;
ALTER TABLE players              DISABLE ROW LEVEL SECURITY;
