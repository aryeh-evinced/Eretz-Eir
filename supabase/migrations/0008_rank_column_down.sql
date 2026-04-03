-- 0008_rank_column_down.sql
-- Reverse the rank column addition.

ALTER TABLE game_players DROP COLUMN IF EXISTS rank;
