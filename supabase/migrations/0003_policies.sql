-- 0003_policies.sql
-- Row Level Security policies.
-- Design principles:
--   1. Players can only read their own profile and modify it via API routes.
--   2. Clients CANNOT write answers directly — all mutations go through Route Handlers.
--   3. Game state reads are scoped to participants.
--   4. rate_limits and job_health are server-only (all client access blocked).

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------
ALTER TABLE players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_refresh_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_health           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: is the calling user a participant in a given game?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_game_participant(p_game_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id  = p_game_id
      AND player_id = (auth.uid())::uuid
  );
$$;

-- ---------------------------------------------------------------------------
-- players: self-management only
-- ---------------------------------------------------------------------------

-- Players can read their own row
CREATE POLICY "players_select_self"
  ON players FOR SELECT
  USING (id = (auth.uid())::uuid);

-- Players can update their own profile (name, avatar, age_group)
CREATE POLICY "players_update_self"
  ON players FOR UPDATE
  USING (id = (auth.uid())::uuid);

-- Route Handlers insert players on first login via service role — no client INSERT
-- No INSERT or DELETE policy for authenticated role.

-- ---------------------------------------------------------------------------
-- player_stats: read-only for self; writes via service role only
-- ---------------------------------------------------------------------------
CREATE POLICY "player_stats_select_self"
  ON player_stats FOR SELECT
  USING (player_id = (auth.uid())::uuid);

-- ---------------------------------------------------------------------------
-- rooms: any authenticated user can read active rooms to join
-- ---------------------------------------------------------------------------
CREATE POLICY "rooms_select_active"
  ON rooms FOR SELECT
  USING (status != 'finished');

-- No client INSERT/UPDATE/DELETE on rooms — managed by Route Handlers

-- ---------------------------------------------------------------------------
-- game_sessions: participants can read their games
-- ---------------------------------------------------------------------------
CREATE POLICY "game_sessions_select_participant"
  ON game_sessions FOR SELECT
  USING (is_game_participant(id));

-- Block direct game-state mutations from clients
-- (no INSERT/UPDATE/DELETE policies for authenticated role)

-- ---------------------------------------------------------------------------
-- game_players: participants can read game membership
-- ---------------------------------------------------------------------------
CREATE POLICY "game_players_select_participant"
  ON game_players FOR SELECT
  USING (is_game_participant(game_id));

-- Players can update their own last_seen_at (presence ping via heartbeat RPC)
-- Direct UPDATE is blocked; presence is via heartbeat() RPC (SECURITY DEFINER).

-- ---------------------------------------------------------------------------
-- rounds: participants can read rounds for their games
-- ---------------------------------------------------------------------------
CREATE POLICY "rounds_select_participant"
  ON rounds FOR SELECT
  USING (is_game_participant(game_id));

-- Block direct round mutations from clients

-- ---------------------------------------------------------------------------
-- answers: players can read their own; others only after round ends
-- ---------------------------------------------------------------------------

-- Own answers: always readable
CREATE POLICY "answers_select_own"
  ON answers FOR SELECT
  USING (player_id = (auth.uid())::uuid);

-- Other players' answers: readable only after the round is completed
CREATE POLICY "answers_select_others_after_round"
  ON answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id    = answers.round_id
        AND r.status = 'completed'
        AND is_game_participant(r.game_id)
    )
  );

-- Block ALL direct client writes to answers — Route Handlers use service role
-- No INSERT/UPDATE/DELETE policy for authenticated role.

-- ---------------------------------------------------------------------------
-- rate_limits: server-only — block all client access
-- ---------------------------------------------------------------------------
-- No policies created → default DENY for authenticated / anon roles.

-- ---------------------------------------------------------------------------
-- stats_refresh_queue: server-only
-- ---------------------------------------------------------------------------
-- No policies created → default DENY.

-- ---------------------------------------------------------------------------
-- job_health: server-only (health endpoint reads via service role)
-- ---------------------------------------------------------------------------
-- No policies created → default DENY for client roles.
