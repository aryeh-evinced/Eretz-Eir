-- 0008_rank_column.sql
-- Adds rank column to game_players for Phase 6 post-game aggregation.

ALTER TABLE game_players ADD COLUMN rank integer;

-- Backfill ranks for all finished games using score_total ordering.
-- Uses standard competition ranking (ties get same rank, next rank skips).
WITH ranked AS (
  SELECT
    gp.game_id,
    gp.player_id,
    RANK() OVER (PARTITION BY gp.game_id ORDER BY gp.score_total DESC) AS computed_rank
  FROM game_players gp
  JOIN game_sessions gs ON gs.id = gp.game_id
  WHERE gs.status = 'finished'
)
UPDATE game_players gp
   SET rank = ranked.computed_rank
  FROM ranked
 WHERE gp.game_id   = ranked.game_id
   AND gp.player_id = ranked.player_id;

-- Also set finished_at for games that are finished but have NULL finished_at.
UPDATE game_sessions
   SET finished_at = COALESCE(finished_at, now())
 WHERE status = 'finished'
   AND finished_at IS NULL;
