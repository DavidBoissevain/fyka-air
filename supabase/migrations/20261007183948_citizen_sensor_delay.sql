-- Samen Meten publishes calibrated PM (*_kal) about an hour after the raw
-- values, so sweeping the hour labelled with the current hour at :40 stored
-- nothing and data for hour H only landed with the :55 re-sweep at H+1:55
-- (TECHNICAL.md, decisions #24 and #25).

-- Collector: sweep the previous hour at :40, and again at :55 to retry a failed
-- run and pick up late values. Renamed, because neither sweeps the current hour.
select cron.unschedule('collect-samenmeten-current');
select cron.unschedule('collect-samenmeten-previous');

select cron.schedule(
  'collect-samenmeten-sweep',
  '40 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/collect-samenmeten',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_secret_key')
    ),
    body := '{"mode": "sweep", "hoursAgo": 1}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

select cron.schedule(
  'collect-samenmeten-resweep',
  '55 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/collect-samenmeten',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_secret_key')
    ),
    body := '{"mode": "sweep", "hoursAgo": 1}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- Map: citizen sensors' newest reading is normally 1h40–2h40 old, so give them
-- the same two missed hours as official stations: 5 hours instead of 3.
create or replace view public.station_readings_now
with (security_invoker = true)
as
with latest as (
  select distinct on (m.station_id, m.quantity)
    m.station_id, m.quantity, m.value, m.measured_at
  from public.measurements m
  join public.stations s on s.id = m.station_id
  where m.measured_at > now() - interval '5 hours'
    and (s.kind = 'citizen' or m.measured_at > now() - interval '3 hours')
  order by m.station_id, m.quantity, m.measured_at desc
)
select
  s.id,
  s.source,
  s.external_id,
  s.kind,
  s.name,
  s.organisation,
  s.municipality,
  s.longitude,
  s.latitude,
  s.details,
  max(l.measured_at) as measured_at,
  jsonb_object_agg(
    l.quantity,
    jsonb_build_object('value', l.value, 'measured_at', l.measured_at)
  ) as readings
from public.stations s
join latest l on l.station_id = s.id
where s.latitude is not null
group by s.id;

comment on view public.station_readings_now is
  'One row per station with a recent reading: the last 3 hours for official stations, 5 hours for citizen sensors. readings: {quantity: {value, measured_at}}.';
