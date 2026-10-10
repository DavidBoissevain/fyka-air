-- Luchtmeetnet publishes a new hour somewhere between :15 and the next :05
-- (on 2026-10-10 the 10:00 UTC hour was missing at 10:15 and complete by
-- 11:05), and RIVM's area map switches as soon as it does. With one run at
-- :15 the dots could lag the area by up to an hour. A run is about 3 requests
-- for the last 3 hours, so run every 10 minutes (TECHNICAL.md, decision #34).
select cron.schedule(
  'collect-luchtmeetnet',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/collect-luchtmeetnet',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_secret_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
