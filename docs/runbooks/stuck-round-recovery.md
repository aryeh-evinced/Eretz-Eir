# Stuck Round Recovery

## Symptoms
- Players see a frozen game screen after timer expires
- Round status remains 'playing' beyond timer_seconds + 120 seconds

## Detection
- Alert: rounds in 'playing' status > timer_seconds + 120 seconds
- Check job_health for round-backstop staleness
- Query: `SELECT * FROM rounds WHERE status = 'playing' AND started_at + (timer_seconds * interval '1 second') < NOW() - interval '120 seconds';`
  (Note: timer_seconds lives on game_sessions, so join is needed in practice)

## Recovery Steps
1. Verify round-backstop Edge Function is running: check job_health table
   ```sql
   SELECT * FROM job_health WHERE job_name = 'round-backstop';
   ```
2. If function is healthy but round is stuck, manually trigger:
   ```bash
   curl -X POST \
     "${SUPABASE_URL}/functions/v1/round-backstop" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
3. If function is unhealthy, check Supabase dashboard for Edge Function logs
4. Last resort: manually transition the round via SQL:
   ```sql
   UPDATE rounds SET status = 'completed', ended_at = NOW(), ended_by = 'timer'
   WHERE id = '<round_id>' AND status = 'playing';
   ```
5. Notify affected players via Realtime broadcast

## Prevention
- Secondary recovery: each client calls POST /api/game/timer-expired 90s after local timer reaches 0
- Round-backstop runs every 60 seconds as a safety net (30-second grace period after timer expiry)
