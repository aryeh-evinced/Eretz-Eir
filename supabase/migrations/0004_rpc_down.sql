-- 0004_rpc_down.sql
-- Reverses 0004_rpc.sql

-- Remove tables from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS rooms;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS rounds;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS game_players;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS game_sessions;

-- Restore default replica identity
ALTER TABLE rooms         REPLICA IDENTITY DEFAULT;
ALTER TABLE rounds        REPLICA IDENTITY DEFAULT;
ALTER TABLE game_players  REPLICA IDENTITY DEFAULT;
ALTER TABLE game_sessions REPLICA IDENTITY DEFAULT;

-- Drop RPCs
DROP FUNCTION IF EXISTS get_active_players(uuid, integer);
DROP FUNCTION IF EXISTS upsert_player(text, text, age_group);
DROP FUNCTION IF EXISTS heartbeat(uuid);
DROP FUNCTION IF EXISTS increment_or_reset(text, integer, integer);
