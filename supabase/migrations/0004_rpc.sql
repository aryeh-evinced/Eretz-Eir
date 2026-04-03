-- 0004_rpc.sql
-- Server RPCs, Realtime publication, and replica identity configuration.

-- ---------------------------------------------------------------------------
-- increment_or_reset(key, max_count, window_seconds)
-- Rate limiting: increments a counter within a time window, resets if expired.
-- Returns the current count after increment, or -1 if the limit is exceeded.
-- SECURITY DEFINER so clients can call it without direct table access.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_or_reset(
  p_key           text,
  p_max_count     integer,
  p_window_seconds integer
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count       integer;
  v_window_start timestamptz;
BEGIN
  SELECT count, window_start
    INTO v_count, v_window_start
    FROM rate_limits
   WHERE key = p_key;

  IF NOT FOUND THEN
    -- First request for this key
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (p_key, 1, now());
    RETURN 1;
  END IF;

  IF now() > v_window_start + (p_window_seconds * interval '1 second') THEN
    -- Window expired — reset
    UPDATE rate_limits SET count = 1, window_start = now() WHERE key = p_key;
    RETURN 1;
  END IF;

  IF v_count >= p_max_count THEN
    RETURN -1; -- limit exceeded
  END IF;

  UPDATE rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN v_count + 1;
END;
$$;

-- ---------------------------------------------------------------------------
-- heartbeat(p_game_id uuid)
-- Updates last_seen_at for the calling player in a game.
-- Returns false if the player is not a participant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION heartbeat(p_game_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := (auth.uid())::uuid;
BEGIN
  UPDATE game_players
     SET last_seen_at = now()
   WHERE game_id   = p_game_id
     AND player_id = v_player_id;

  RETURN FOUND;
END;
$$;

-- ---------------------------------------------------------------------------
-- upsert_player(p_name text, p_avatar text, p_age_group age_group)
-- Creates or refreshes the player row for the authenticated user.
-- Returns the player id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_player(
  p_name      text,
  p_avatar    text     DEFAULT '',
  p_age_group age_group DEFAULT 'child'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid := (auth.uid())::uuid;
BEGIN
  INSERT INTO players (id, name, avatar, age_group)
  VALUES (v_player_id, p_name, p_avatar, p_age_group)
  ON CONFLICT (id) DO UPDATE
    SET name       = EXCLUDED.name,
        avatar     = EXCLUDED.avatar,
        age_group  = EXCLUDED.age_group,
        updated_at = now();

  -- Ensure stats row exists
  INSERT INTO player_stats (player_id)
  VALUES (v_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  RETURN v_player_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_active_players(p_game_id uuid, p_stale_seconds integer)
-- Returns player_ids with last_seen_at within the staleness threshold.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_active_players(
  p_game_id      uuid,
  p_stale_seconds integer DEFAULT 30
)
RETURNS TABLE (player_id uuid, last_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT player_id, last_seen_at
    FROM game_players
   WHERE game_id      = p_game_id
     AND last_seen_at > now() - (p_stale_seconds * interval '1 second');
$$;

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
-- Add tables that need real-time change events to the publication.
-- Supabase creates supabase_realtime automatically; we just add our tables.
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- ---------------------------------------------------------------------------
-- REPLICA IDENTITY FULL
-- Required for UPDATE and DELETE payloads to include old row data in Realtime.
-- ---------------------------------------------------------------------------
ALTER TABLE game_sessions REPLICA IDENTITY FULL;
ALTER TABLE game_players  REPLICA IDENTITY FULL;
ALTER TABLE rounds        REPLICA IDENTITY FULL;
ALTER TABLE rooms         REPLICA IDENTITY FULL;
