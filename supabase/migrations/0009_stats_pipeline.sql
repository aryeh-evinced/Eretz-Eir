-- 0009_stats_pipeline.sql
-- Phase 6: Async stats refresh pipeline.
-- Creates player_category_stats materialized view, refresh function with
-- advisory lock guard, and helper to drain the stats_refresh_queue.

-- ---------------------------------------------------------------------------
-- player_category_stats materialized view
-- Per-player, per-category aggregate stats used by profile/leaderboard surfaces.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS player_category_stats AS
SELECT
  a.player_id,
  a.category,
  COUNT(*)                                        AS total_answers,
  COUNT(*) FILTER (WHERE a.is_valid = true)       AS valid_answers,
  COUNT(*) FILTER (WHERE a.is_unique = true AND a.is_valid = true) AS unique_answers,
  COALESCE(SUM(a.score), 0)                       AS total_score,
  ROUND(
    CASE
      WHEN COUNT(*) FILTER (WHERE a.answer_text IS NOT NULL AND a.answer_text <> '') = 0 THEN 0
      ELSE COUNT(*) FILTER (WHERE a.is_valid = true)::numeric /
           COUNT(*) FILTER (WHERE a.answer_text IS NOT NULL AND a.answer_text <> '')
    END, 4
  )                                               AS valid_ratio
FROM answers a
JOIN rounds r ON r.id = a.round_id
JOIN game_sessions gs ON gs.id = r.game_id
WHERE gs.status = 'finished'
GROUP BY a.player_id, a.category;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_category_stats_pk
  ON player_category_stats (player_id, category);

-- ---------------------------------------------------------------------------
-- refresh_player_stats(player_ids uuid[])
-- Recomputes player_stats rows for the given player IDs.
-- Uses pg_advisory_xact_lock to prevent overlapping refreshes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_player_stats(p_player_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id   bigint := 8675309;  -- arbitrary lock ID for stats refresh
  v_count     integer := 0;
  v_player_id uuid;
BEGIN
  -- Advisory lock: skip if another refresh is running
  IF NOT pg_try_advisory_xact_lock(v_lock_id) THEN
    RAISE NOTICE 'refresh_player_stats: skipping — another refresh in progress';
    RETURN -1;
  END IF;

  FOREACH v_player_id IN ARRAY p_player_ids
  LOOP
    -- Recompute from game_players for finished games
    INSERT INTO player_stats (
      player_id,
      games_played,
      games_won,
      total_score,
      avg_score_per_round,
      unique_answers_count,
      fastest_answer_ms,
      strongest_category,
      weakest_category
    )
    SELECT
      v_player_id,
      COALESCE(gp_agg.games_played, 0),
      COALESCE(gp_agg.games_won, 0),
      COALESCE(gp_agg.total_score, 0),
      COALESCE(gp_agg.avg_score_per_round, 0),
      COALESCE(ans_agg.unique_count, 0),
      ans_agg.fastest_ms,
      cat_agg.strongest,
      cat_agg.weakest
    FROM (
      -- Game-level aggregates
      SELECT
        COUNT(*)                             AS games_played,
        COUNT(*) FILTER (WHERE gp.rank = 1)  AS games_won,
        COALESCE(SUM(gp.score_total), 0)     AS total_score,
        CASE
          WHEN COALESCE(SUM(r_count.round_count), 0) = 0 THEN 0
          ELSE ROUND(SUM(gp.score_total)::numeric / SUM(r_count.round_count), 2)
        END                                  AS avg_score_per_round
      FROM game_players gp
      JOIN game_sessions gs ON gs.id = gp.game_id AND gs.status = 'finished'
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS round_count FROM rounds WHERE game_id = gp.game_id
      ) r_count ON true
      WHERE gp.player_id = v_player_id
    ) gp_agg
    LEFT JOIN LATERAL (
      -- Answer-level aggregates
      SELECT
        COUNT(*) FILTER (WHERE a.is_unique AND a.is_valid)  AS unique_count,
        MIN(
          CASE
            WHEN a.submitted_at IS NOT NULL AND a.is_valid THEN
              EXTRACT(EPOCH FROM (a.submitted_at - r.started_at)) * 1000
          END
        )::integer AS fastest_ms
      FROM answers a
      JOIN rounds r ON r.id = a.round_id
      JOIN game_sessions gs ON gs.id = r.game_id AND gs.status = 'finished'
      WHERE a.player_id = v_player_id
    ) ans_agg ON true
    LEFT JOIN LATERAL (
      -- Category strength: best and worst valid_ratio
      SELECT
        (SELECT category FROM (
          SELECT category,
                 COUNT(*) FILTER (WHERE is_valid)::numeric / NULLIF(COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text <> ''), 0) AS ratio
          FROM answers a2
          JOIN rounds r2 ON r2.id = a2.round_id
          JOIN game_sessions gs2 ON gs2.id = r2.game_id AND gs2.status = 'finished'
          WHERE a2.player_id = v_player_id
            AND a2.answer_text IS NOT NULL AND a2.answer_text <> ''
          GROUP BY category
          ORDER BY ratio DESC NULLS LAST
          LIMIT 1
        ) best) AS strongest,
        (SELECT category FROM (
          SELECT category,
                 COUNT(*) FILTER (WHERE is_valid)::numeric / NULLIF(COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text <> ''), 0) AS ratio
          FROM answers a3
          JOIN rounds r3 ON r3.id = a3.round_id
          JOIN game_sessions gs3 ON gs3.id = r3.game_id AND gs3.status = 'finished'
          WHERE a3.player_id = v_player_id
            AND a3.answer_text IS NOT NULL AND a3.answer_text <> ''
          GROUP BY category
          ORDER BY ratio ASC NULLS LAST
          LIMIT 1
        ) worst) AS weakest
    ) cat_agg ON true
    ON CONFLICT (player_id) DO UPDATE SET
      games_played         = EXCLUDED.games_played,
      games_won            = EXCLUDED.games_won,
      total_score          = EXCLUDED.total_score,
      avg_score_per_round  = EXCLUDED.avg_score_per_round,
      unique_answers_count = EXCLUDED.unique_answers_count,
      fastest_answer_ms    = EXCLUDED.fastest_answer_ms,
      strongest_category   = EXCLUDED.strongest_category,
      weakest_category     = EXCLUDED.weakest_category;

    v_count := v_count + 1;
  END LOOP;

  -- Refresh the materialized view concurrently (non-blocking reads)
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_category_stats;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- drain_stats_queue(batch_size integer)
-- Atomically dequeue up to batch_size player IDs from stats_refresh_queue,
-- call refresh_player_stats, then delete dequeued rows.
-- Returns the number of players refreshed (or -1 if lock contention).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION drain_stats_queue(p_batch_size integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_ids uuid[];
  v_result     integer;
BEGIN
  -- Select and lock queued rows (FIFO by queued_at)
  SELECT ARRAY_AGG(player_id)
    INTO v_player_ids
    FROM (
      SELECT player_id
        FROM stats_refresh_queue
       ORDER BY queued_at ASC
       LIMIT p_batch_size
       FOR UPDATE SKIP LOCKED
    ) sub;

  IF v_player_ids IS NULL OR array_length(v_player_ids, 1) IS NULL THEN
    RETURN 0;  -- nothing to process
  END IF;

  -- Refresh stats
  v_result := refresh_player_stats(v_player_ids);

  IF v_result >= 0 THEN
    -- Delete processed rows
    DELETE FROM stats_refresh_queue WHERE player_id = ANY(v_player_ids);
  END IF;

  RETURN v_result;
END;
$$;
