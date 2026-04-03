-- 0005_cron_schedules_down.sql
-- Reverses 0005_cron_schedules.sql

SELECT cron.unschedule('retention-cleanup') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retention-cleanup');
SELECT cron.unschedule('stats-refresh')     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stats-refresh');
SELECT cron.unschedule('presence-scan')     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'presence-scan');
SELECT cron.unschedule('round-backstop')    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'round-backstop');
SELECT cron.unschedule('room-cleanup')      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'room-cleanup');
