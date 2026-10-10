-- Luchtmeetnet first publishes the LKI of a new hour from a station's own
-- pollutants. For stations without an ozone sensor it adds an ozone estimate
-- only once the ozone network has reported that hour. Stations that report
-- early (OMWB, some in Limburg) therefore showed a preliminary, too low index
-- on the map. Skip those values, so the previous hour's complete index shows
-- instead (TECHNICAL.md, decision #30).

create or replace view public.station_readings_now
with (security_invoker = true)
as
with ozone_hours as (
  -- Hours for which the ozone network has reported: at least 20 of the
  -- normally ~48 official ozone values.
  select m.measured_at
  from public.measurements m
  join public.stations s on s.id = m.station_id
  where m.quantity = 'o3'
    and s.source = 'luchtmeetnet'
    and m.measured_at > now() - interval '3 hours'
  group by m.measured_at
  having count(*) >= 20
),
latest as (
  select distinct on (m.station_id, m.quantity)
    m.station_id, m.quantity, m.value, m.measured_at
  from public.measurements m
  join public.stations s on s.id = m.station_id
  where m.measured_at > now() - interval '5 hours'
    and (s.kind = 'citizen' or m.measured_at > now() - interval '3 hours')
    and not (
      m.quantity = 'lki'
      and s.kind = 'professional'
      and m.measured_at not in (select measured_at from ozone_hours)
      and not exists (
        select 1 from public.measurements o
        where o.station_id = m.station_id and o.quantity = 'o3' and o.measured_at = m.measured_at
      )
    )
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
  'One row per station with a recent reading: the last 3 hours for official stations, 5 hours for citizen sensors. readings: {quantity: {value, measured_at}}. An official LKI without ozone is skipped until the ozone network has reported its hour (decision #30).';
