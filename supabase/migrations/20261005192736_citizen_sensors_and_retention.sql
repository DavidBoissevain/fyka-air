-- Citizen sensors (Samen Meten), the LKI for them, daily averages and the
-- nightly retention job. See TECHNICAL.md, decisions #7, #9 and #22.

-- LKI ------------------------------------------------------------------------

-- RIVM LKI sub-index (1–11) for one pollutant. Class edges from RIVM report
-- 2014-0050 (table 7, classes 1–9); 10 and 11 split the open top class and are
-- our own extension. PM uses a 24-hour average, NO2 and O3 hourly values.
-- Checked against Luchtmeetnet's published LKI: 44 of 44 stations with all
-- components matched on 2026-10-05.
create function public.lki_sub_index(p_quantity text, p_value real)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select i::integer
      from unnest(
        case p_quantity
          when 'pm25' then array[10, 15, 20, 30, 40, 50, 70, 90, 100, 140]
          when 'pm10' then array[10, 20, 30, 45, 60, 75, 100, 125, 150, 200]
          when 'no2'  then array[10, 20, 30, 45, 60, 75, 100, 125, 150, 200]
          when 'o3'   then array[15, 30, 40, 60, 80, 100, 140, 180, 200, 240]
        end
      ) with ordinality as band (edge, i)
      where p_value < band.edge
      order by i
      limit 1
    ),
    11
  );
$$;

-- LKI for citizen sensors at one hour, from the 24-hour average of their
-- calibrated PM2.5 and PM10 (decision #7). Sensors don't measure ozone, so this
-- is a fine-dust index; official stations also include NO2 and O3.
-- Needs at least 12 hourly values in the 24 hours ending at p_hour, and a PM
-- reading at p_hour itself.
create function public.compute_citizen_lki(p_hour timestamptz)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.measurements (station_id, quantity, measured_at, value)
  select m.station_id, 'lki', p_hour, max(public.lki_sub_index(m.quantity, m.avg_value))
  from (
    select m.station_id, m.quantity, avg(m.value)::real as avg_value
    from public.measurements m
    join public.stations s on s.id = m.station_id and s.source = 'samenmeten'
    where m.quantity in ('pm25', 'pm10')
      and m.measured_at > p_hour - interval '24 hours'
      and m.measured_at <= p_hour
    group by m.station_id, m.quantity
    having count(*) >= 12 and bool_or(m.measured_at = p_hour)
  ) m
  group by m.station_id
  on conflict (station_id, quantity, measured_at) do update
    set value = excluded.value
    where public.measurements.value is distinct from excluded.value;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Station details -----------------------------------------------------------

-- Updates name, location and details for existing stations of one source.
-- Rows: [{external_id, name, organisation, municipality, longitude, latitude, details}].
-- Unknown external_ids are ignored; ingest_measurements creates stations.
create function public.update_station_details(p_source text, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.stations s
  set name = r.name,
      organisation = r.organisation,
      municipality = r.municipality,
      longitude = r.longitude,
      latitude = r.latitude,
      details = coalesce(r.details, '{}'::jsonb),
      details_updated_at = now()
  from jsonb_to_recordset(p_rows) as r (
    external_id text, name text, organisation text, municipality text,
    longitude double precision, latitude double precision, details jsonb
  )
  where s.source = p_source and s.external_id = r.external_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Daily averages ------------------------------------------------------------

create table public.measurements_daily (
  station_id bigint not null references public.stations (id) on delete cascade,
  quantity text not null check (quantity in ('pm25', 'pm10', 'no2', 'o3', 'nh3', 'lki')),
  day date not null,
  mean real not null,
  min real not null,
  max real not null,
  hours smallint not null,
  primary key (station_id, quantity, day)
);

comment on table public.measurements_daily is
  'Daily statistics per station and quantity. day is the calendar day in Europe/Amsterdam; an hour belongs to the day it ends in, except the hour ending at 00:00.';

alter table public.measurements_daily enable row level security;

create policy "Daily measurements are publicly readable"
  on public.measurements_daily for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.measurements_daily from anon, authenticated;
grant select on public.measurements_daily to anon, authenticated;

-- Recomputes daily statistics for Amsterdam days p_from..p_to (inclusive).
create function public.rollup_daily(p_from date, p_to date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.measurements_daily (station_id, quantity, day, mean, min, max, hours)
  select
    m.station_id,
    m.quantity,
    ((m.measured_at - interval '1 minute') at time zone 'Europe/Amsterdam')::date as day,
    avg(m.value),
    min(m.value),
    max(m.value),
    count(*)
  from public.measurements m
  -- Generous UTC window around the local days; the day filter below is exact.
  where m.measured_at > (p_from::timestamp - interval '1 day') at time zone 'UTC'
    and m.measured_at <= (p_to::timestamp + interval '2 days') at time zone 'UTC'
    and ((m.measured_at - interval '1 minute') at time zone 'Europe/Amsterdam')::date between p_from and p_to
  group by 1, 2, 3
  on conflict (station_id, quantity, day) do update
    set mean = excluded.mean, min = excluded.min, max = excluded.max, hours = excluded.hours;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Nightly maintenance: roll up the last two Amsterdam days, then delete raw
-- hourly data past the retention window (decision #9). Citizen-sensor LKI rows
-- are derived and only needed for the map, so they go after 2 days.
create function public.maintain_measurements(p_keep_days integer default 30)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  rolled integer;
  pruned integer;
  pruned_lki integer;
begin
  rolled := public.rollup_daily(today - 2, today - 1);

  delete from public.measurements where measured_at < now() - make_interval(days => p_keep_days);
  get diagnostics pruned = row_count;

  delete from public.measurements m
  using public.stations s
  where s.id = m.station_id and s.source = 'samenmeten' and m.quantity = 'lki'
    and m.measured_at < now() - interval '2 days';
  get diagnostics pruned_lki = row_count;

  return jsonb_build_object('rolled_up', rolled, 'pruned', pruned, 'pruned_citizen_lki', pruned_lki);
end;
$$;

-- Only the service role (collectors) and cron (postgres) may call these.
revoke execute on function public.compute_citizen_lki(timestamptz) from public, anon, authenticated;
revoke execute on function public.update_station_details(text, jsonb) from public, anon, authenticated;
revoke execute on function public.rollup_daily(date, date) from public, anon, authenticated;
revoke execute on function public.maintain_measurements(integer) from public, anon, authenticated;
grant execute on function public.compute_citizen_lki(timestamptz) to service_role;
grant execute on function public.update_station_details(text, jsonb) to service_role;

-- Schedules ------------------------------------------------------------------

-- Samen Meten publishes the hour labelled HH:00 between about HH:20 and HH:30.
-- Sweep it at :40, re-sweep the previous hour at :55 for late data, and fetch
-- details for new or stale sensors at :05. Each run fits the Edge Function's
-- 150 s limit; the three never overlap. Uses the same Vault secrets as
-- collect-luchtmeetnet (see supabase/README.md).
select cron.schedule(
  'collect-samenmeten-current',
  '40 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/collect-samenmeten',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_secret_key')
    ),
    body := '{"mode": "sweep", "hoursAgo": 0}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

select cron.schedule(
  'collect-samenmeten-previous',
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

select cron.schedule(
  'collect-samenmeten-things',
  '5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/collect-samenmeten',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_secret_key')
    ),
    body := '{"mode": "things"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- 02:30 UTC is after midnight in Amsterdam all year.
select cron.schedule('maintain-measurements', '30 2 * * *', $$ select public.maintain_measurements(); $$);
