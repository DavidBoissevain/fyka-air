-- Current readings per station for the map: the latest value of each quantity
-- measured in the last 3 hours. Stations without a recent reading or without a
-- location are left out (decision #15 in TECHNICAL.md).

-- Recent-window queries filter on measured_at across all stations and
-- quantities, so index measured_at on its own. This replaces the
-- (quantity, measured_at) index, which nothing uses.
drop index public.measurements_quantity_measured_at_idx;
create index measurements_measured_at_idx on public.measurements (measured_at);

create view public.station_readings_now
with (security_invoker = true)
as
with latest as (
  select distinct on (m.station_id, m.quantity)
    m.station_id, m.quantity, m.value, m.measured_at
  from public.measurements m
  where m.measured_at > now() - interval '3 hours'
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
  'One row per station with a reading in the last 3 hours. readings: {quantity: {value, measured_at}}.';

grant select on public.station_readings_now to anon, authenticated;
