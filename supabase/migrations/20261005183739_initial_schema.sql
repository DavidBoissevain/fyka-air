-- Initial schema: stations and hourly measurements from Luchtmeetnet and
-- Samen Meten, plus the hourly Luchtmeetnet collector schedule.
-- See TECHNICAL.md ("Collector design") for the reasoning.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Stations ------------------------------------------------------------------

create table public.stations (
  id bigint generated always as identity primary key,
  source text not null check (source in ('luchtmeetnet', 'samenmeten')),
  external_id text not null,
  kind text not null generated always as (
    case source when 'luchtmeetnet' then 'professional' else 'citizen' end
  ) stored,
  name text,
  organisation text,
  municipality text,
  longitude double precision,
  latitude double precision,
  details jsonb not null default '{}'::jsonb,
  details_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, external_id),
  check ((longitude is null) = (latitude is null))
);

comment on table public.stations is
  'Measuring stations (Luchtmeetnet, professional) and sensors (Samen Meten, citizen).';
comment on column public.stations.external_id is
  'Station number in the source, e.g. NL10444 (Luchtmeetnet) or LTD_94370 (Samen Meten).';
comment on column public.stations.details is
  'Source-specific metadata, e.g. measured components or project.';
comment on column public.stations.details_updated_at is
  'When name, location and details were last refreshed from the source. Null for stubs created by ingest_measurements.';

-- Measurements --------------------------------------------------------------

create table public.measurements (
  station_id bigint not null references public.stations (id) on delete cascade,
  quantity text not null check (quantity in ('pm25', 'pm10', 'no2', 'o3', 'nh3', 'lki')),
  measured_at timestamptz not null,
  value real not null,
  primary key (station_id, quantity, measured_at)
);

comment on column public.measurements.quantity is
  'pm25 and pm10 are calibrated values for Samen Meten sensors (*_kal). lki is the official Luchtkwaliteitsindex.';
comment on column public.measurements.measured_at is
  'End of the measured hour, in UTC.';

-- The primary key covers per-station series and the foreign key.
-- This index covers "latest values for a quantity across all stations" and retention deletes.
create index measurements_quantity_measured_at_idx
  on public.measurements (quantity, measured_at);

-- Access: public read, writes only through ingest_measurements (service role) --

alter table public.stations enable row level security;
alter table public.measurements enable row level security;

create policy "Stations are publicly readable"
  on public.stations for select
  to anon, authenticated
  using (true);

create policy "Measurements are publicly readable"
  on public.measurements for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.stations, public.measurements from anon, authenticated;
grant select on public.stations, public.measurements to anon, authenticated;

-- Ingest --------------------------------------------------------------------

-- Upserts measurements for one source. Rows: [{station, quantity, measured_at, value}].
-- Unknown stations are created as stubs; their details are filled in later by the collector.
-- Rows must be unique on (station, quantity, measured_at).
create function public.ingest_measurements(p_source text, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.stations (source, external_id)
  select distinct p_source, r.station
  from jsonb_to_recordset(p_rows) as r (station text)
  on conflict (source, external_id) do nothing;

  insert into public.measurements (station_id, quantity, measured_at, value)
  select s.id, r.quantity, r.measured_at, r.value
  from jsonb_to_recordset(p_rows) as r (station text, quantity text, measured_at timestamptz, value real)
  join public.stations s on s.source = p_source and s.external_id = r.station
  on conflict (station_id, quantity, measured_at) do update
    set value = excluded.value
    where public.measurements.value is distinct from excluded.value;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.ingest_measurements(text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_measurements(text, jsonb) to service_role;

-- Schedule ------------------------------------------------------------------

-- Luchtmeetnet publishes the previous hour around :10, so collect at :15.
-- Needs two Vault secrets per environment (see supabase/README.md):
--   project_url           e.g. https://<project-ref>.supabase.co
--   collector_secret_key  a secret API key (sb_secret_...)
select cron.schedule(
  'collect-luchtmeetnet',
  '15 * * * *',
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
