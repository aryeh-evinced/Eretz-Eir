-- 0002_indexes.sql
-- Hot-path indexes for active rounds, active rooms, and game lookups.

-- Active rounds: server polls status='playing' rounds constantly
CREATE INDEX idx_rounds_game_status
  ON rounds (game_id, status)
  WHERE status IN ('playing', 'reviewing', 'manual_review');

-- Active rooms: lobby joins look up code among non-finished rooms
CREATE UNIQUE INDEX idx_rooms_code_active
  ON rooms (code)
  WHERE status != 'finished';

-- Game lookups by creator or status
CREATE INDEX idx_game_sessions_created_by ON game_sessions (created_by);
CREATE INDEX idx_game_sessions_status     ON game_sessions (status) WHERE status != 'finished';

-- Presence: recently active players in a game
CREATE INDEX idx_game_players_last_seen
  ON game_players (game_id, last_seen_at DESC);

-- Answer lookups by round (validation, scoring)
CREATE INDEX idx_answers_round_id ON answers (round_id);

-- Answer lookups by player (profile, stats)
CREATE INDEX idx_answers_player_id ON answers (player_id);

-- Rate limit cleanup by window
CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);

-- Stats queue processing order
CREATE INDEX idx_stats_refresh_queue_queued ON stats_refresh_queue (queued_at);

-- Room → game linkage
CREATE INDEX idx_game_sessions_room_id ON game_sessions (room_id) WHERE room_id IS NOT NULL;
