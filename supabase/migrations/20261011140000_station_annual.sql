-- Measured annual averages per official station, for the map's annual view
-- (TECHNICAL.md, decision #41). Computed from Luchtmeetnet's validated yearly
-- files by scripts/import-annual.mts and loaded with its data migrations.

create table public.station_annual (
  station_id bigint not null references public.stations (id) on delete cascade,
  quantity text not null check (quantity in ('no2', 'pm25')),
  year smallint not null,
  mean real not null,
  -- Hours covered by measurements; a daily value counts as 24 hours.
  hours integer not null,
  primary key (station_id, quantity, year)
);

comment on table public.station_annual is
  'Annual mean per official station from Luchtmeetnet''s validated yearly files. hours is the time covered by measurements; the app needs at least 75% of the year for a value.';

alter table public.station_annual enable row level security;

create policy "Annual averages are publicly readable"
  on public.station_annual for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.station_annual from anon, authenticated;
grant select on public.station_annual to anon, authenticated;

-- One row per located official station with annual data, its years as
-- {"no2": {"2012": {"mean": 41.4, "hours": 8650}, ...}, "pm25": {...}}.
create view public.station_annual_series
with (security_invoker = true)
as
select s.id, s.source, s.external_id, s.kind, s.name, s.organisation, s.municipality,
  s.longitude, s.latitude, s.details,
  (
    select jsonb_object_agg(q.quantity, q.years)
    from (
      select a.quantity,
        jsonb_object_agg(a.year::text, jsonb_build_object('mean', round(a.mean::numeric, 2), 'hours', a.hours)) as years
      from public.station_annual a
      where a.station_id = s.id
      group by a.quantity
    ) q
  ) as annual
from public.stations s
where s.source = 'luchtmeetnet'
  and s.longitude is not null
  and s.latitude is not null
  and exists (select 1 from public.station_annual a where a.station_id = s.id);

comment on view public.station_annual_series is
  'Official stations with their measured annual averages, for the map''s annual view.';

grant select on public.station_annual_series to anon, authenticated;
