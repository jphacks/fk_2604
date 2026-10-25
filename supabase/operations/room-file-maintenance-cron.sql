-- MANUAL OPT-IN ONLY. Not a migration. Review/deploy/test the function first.
-- Enable pg_cron and pg_net in Dashboard first.
-- In Dashboard Vault, create these two secrets (do not put values in this file):
--   room_file_maintenance_url: https://<project-ref>.supabase.co/functions/v1/room-file-maintenance
--   room_file_maintenance_secret: same random secret as FILE_MAINTENANCE_SECRET
-- Reusing the named cron job updates it instead of creating duplicate jobs.
select cron.schedule(
  'room-file-maintenance',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='room_file_maintenance_url'),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-file-maintenance-secret',(select decrypted_secret from vault.decrypted_secrets where name='room_file_maintenance_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
-- Monitor:
-- select jobid,jobname,schedule,active from cron.job where jobname='room-file-maintenance';
-- select * from cron.job_run_details order by start_time desc limit 20;
-- Cron success means HTTP was queued, not that Storage deletion succeeded:
-- inspect Edge Function logs and net._http_response HTTP status too.
-- Pause without deleting data:
-- select cron.unschedule('room-file-maintenance');
