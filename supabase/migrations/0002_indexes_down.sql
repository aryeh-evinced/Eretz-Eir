-- 0002_indexes_down.sql
-- Reverses 0002_indexes.sql

DROP INDEX IF EXISTS idx_game_sessions_room_id;
DROP INDEX IF EXISTS idx_stats_refresh_queue_queued;
DROP INDEX IF EXISTS idx_rate_limits_window;
DROP INDEX IF EXISTS idx_answers_player_id;
DROP INDEX IF EXISTS idx_answers_round_id;
DROP INDEX IF EXISTS idx_game_players_last_seen;
DROP INDEX IF EXISTS idx_game_sessions_status;
DROP INDEX IF EXISTS idx_game_sessions_created_by;
DROP INDEX IF EXISTS idx_rooms_code_active;
DROP INDEX IF EXISTS idx_rounds_game_status;
