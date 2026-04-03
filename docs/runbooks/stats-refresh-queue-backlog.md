# Stats Refresh Queue Backlog

## Trigger
Queue depth in `stats_refresh_queue` exceeds 500 rows or age of oldest queued entry exceeds 5 minutes.

## Impact
Player profiles and leaderboards show stale data. No gameplay impact — stats are display-only.

## Investigation

```sql
-- Queue depth and oldest entry
SELECT COUNT(*), MIN(queued_at), MAX(queued_at)
FROM stats_refresh_queue;

-- Check if advisory lock is held (indicates a running refresh)
SELECT * FROM pg_locks WHERE locktype = 'advisory' AND objid = 8675309;

-- Check job_health for recent errors
SELECT * FROM job_health WHERE job_name = 'stats-refresh';

-- Check cron schedule is active
SELECT * FROM cron.job WHERE jobname = 'stats-refresh';
```

## Resolution

### Lock contention (refresh stacking)
If a previous refresh is stuck or slow:
```sql
-- Check running queries
SELECT pid, query, state, now() - query_start AS duration
FROM pg_stat_activity
WHERE query ILIKE '%refresh_player_stats%' OR query ILIKE '%drain_stats_queue%';

-- If stuck for >5 minutes, terminate
SELECT pg_terminate_backend(<pid>);
```

### Cron schedule disabled
```sql
-- Re-enable (migration 0005 schedule)
SELECT cron.schedule(
  'stats-refresh',
  '* * * * *',
  $$SELECT net.http_post(
    url := current_setting('supabase.functions_base_url') || '/stats-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{}'::jsonb
  );$$
);
```

### Manual drain
If the Edge Function is down, drain directly from SQL:
```sql
SELECT drain_stats_queue(500);
```

### Full materialized view refresh
If data is significantly stale or corrupted:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY player_category_stats;
```

## Prevention
- Monitor queue depth via the stats-refresh job logs (queue_depth field)
- Alert on queue_depth > 500 or oldest entry > 5 minutes
- The advisory lock guard (`pg_try_advisory_xact_lock`) prevents refresh stacking
- Freshness SLO: stats stale for at most 2 minutes under normal load
