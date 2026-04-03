-- 0005_cron_schedules.sql
-- Schedule Edge Functions via pg_cron + pg_net HTTP POST.
-- Uses INSERT ... ON CONFLICT DO UPDATE for idempotent re-runs.
--
-- The Edge Function base URL is read from a Postgres custom setting:
--   supabase.functions_base_url  (set below)
-- The service role key is read from:
--   supabase.service_role_key    (set below)
--
-- In production these settings must be set via Supabase dashboard or
-- `ALTER DATABASE ... SET` from a superuser connection before running this
-- migration.  The placeholders below are safe defaults that prevent the
-- migration from failing; replace them with real values in each environment.

-- ---------------------------------------------------------------------------
-- Postgres custom settings for Edge Function invocation
-- ---------------------------------------------------------------------------
-- Format: https://<project-ref>.supabase.co/functions/v1
DO $$
BEGIN
  -- Only set if not already configured (idempotent)
  IF current_setting('supabase.functions_base_url', true) IS NULL
     OR current_setting('supabase.functions_base_url', true) = '' THEN
    EXECUTE 'ALTER DATABASE postgres SET supabase.functions_base_url = ''https://PLACEHOLDER.supabase.co/functions/v1''';
  END IF;

  IF current_setting('supabase.service_role_key', true) IS NULL
     OR current_setting('supabase.service_role_key', true) = '' THEN
    EXECUTE 'ALTER DATABASE postgres SET supabase.service_role_key = ''PLACEHOLDER_SERVICE_ROLE_KEY''';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Schedule helpers: unschedule first to allow idempotent updates
-- ---------------------------------------------------------------------------
SELECT cron.unschedule('room-cleanup')       WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'room-cleanup');
SELECT cron.unschedule('round-backstop')     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'round-backstop');
SELECT cron.unschedule('presence-scan')      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'presence-scan');
SELECT cron.unschedule('stats-refresh')      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stats-refresh');
SELECT cron.unschedule('retention-cleanup')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retention-cleanup');

-- ---------------------------------------------------------------------------
-- room-cleanup — every 15 minutes
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'room-cleanup',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('supabase.functions_base_url') || '/room-cleanup',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ---------------------------------------------------------------------------
-- round-backstop — every 1 minute
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'round-backstop',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('supabase.functions_base_url') || '/round-backstop',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ---------------------------------------------------------------------------
-- presence-scan — every 1 minute
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'presence-scan',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('supabase.functions_base_url') || '/presence-scan',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ---------------------------------------------------------------------------
-- stats-refresh — every 1 minute
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'stats-refresh',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('supabase.functions_base_url') || '/stats-refresh',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ---------------------------------------------------------------------------
-- retention-cleanup — monthly (1st of each month at 03:00 UTC)
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'retention-cleanup',
  '0 3 1 * *',
  $$
    SELECT net.http_post(
      url     := current_setting('supabase.functions_base_url') || '/retention-cleanup',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);
