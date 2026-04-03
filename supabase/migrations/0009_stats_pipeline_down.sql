-- 0009_stats_pipeline_down.sql
-- Reverse the stats pipeline objects.

DROP FUNCTION IF EXISTS drain_stats_queue(integer);
DROP FUNCTION IF EXISTS refresh_player_stats(uuid[]);
DROP MATERIALIZED VIEW IF EXISTS player_category_stats;
