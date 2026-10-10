-- Luchtmeetnet adds an ozone estimate to the LKI of stations without an ozone
-- sensor, but not for every one: Baamsum and the ODZL stations in Limburg
-- never get it, so their index stays too low whenever ozone decides (LKI 1
-- inside a "Matig" area). Their metadata doesn't mark them, so detect them
-- from the data: in the hours where the ozone network's median sub-index is
-- above the station's own pollutants, an estimate lifts the station's LKI.
-- A station whose LKI almost never lifts in those hours gets no index
-- (TECHNICAL.md, decision #33).

create or replace view public.station_readings_now
with (security_invoker = true)
as
with ozone_hours as (
  -- Hours for which the ozone network has reported (at least 20 of the
  -- normally ~48 official ozone values), with its median sub-index.
  select m.measured_at,
    percentile_disc(0.5) within group (order by public.lki_sub_index('o3', m.value)) as o3_sub
  from public.measurements m
  join public.stations s on s.id = m.station_id
  where m.quantity = 'o3'
    and s.source = 'luchtmeetnet'
    and m.measured_at > now() - interval '72 hours'
  group by m.measured_at
  having count(*) >= 20
),
own_hours as (
  -- Official stations without an ozone sensor: LKI and the highest sub-index
  -- of their own pollutants per hour (hourly values, also for PM).
  select m.station_id, m.measured_at,
    max(m.value) filter (where m.quantity = 'lki') as lki,
    greatest(
      public.lki_sub_index('no2', max(m.value) filter (where m.quantity = 'no2')) * nullif(count(*) filter (where m.quantity = 'no2'), 0),
      public.lki_sub_index('pm10', max(m.value) filter (where m.quantity = 'pm10')) * nullif(count(*) filter (where m.quantity = 'pm10'), 0),
      public.lki_sub_index('pm25', max(m.value) filter (where m.quantity = 'pm25')) * nullif(count(*) filter (where m.quantity = 'pm25'), 0)
    ) as own
  from public.measurements m
  join public.stations s on s.id = m.station_id
  where s.source = 'luchtmeetnet'
    and not coalesce(s.details->'components' ? 'O3', false)
    and m.quantity in ('lki', 'no2', 'pm10', 'pm25')
    and m.measured_at > now() - interval '72 hours'
  group by m.station_id, m.measured_at
),
no_ozone_estimate as (
  -- At least 6 hours where ozone should decide, lifted in fewer than 1 in 10.
  -- Stations that get the estimate are lifted in about 9 in 10.
  select o.station_id
  from own_hours o
  join ozone_hours h on h.measured_at = o.measured_at
  where o.lki is not null and h.o3_sub > o.own
  group by o.station_id
  having count(*) >= 6 and count(*) filter (where o.lki > o.own) * 10 < count(*)
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
      and not exists (
        select 1 from public.measurements o
        where o.station_id = m.station_id and o.quantity = 'o3' and o.measured_at = m.measured_at
      )
      and (
        -- Own ozone sensor, but no value this hour: no estimate fills the gap (#31).
        coalesce(s.details->'components' ? 'O3', false)
        -- No ozone sensor: the estimate is only in once the network has reported (#30).
        or m.measured_at not in (select measured_at from ozone_hours)
        -- No ozone sensor, and Luchtmeetnet adds no estimate for this station (#33).
        or m.station_id in (select station_id from no_ozone_estimate)
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
  'One row per station with a recent reading: the last 3 hours for official stations, 5 hours for citizen sensors. readings: {quantity: {value, measured_at}}. An official LKI without ozone is skipped until the ozone network has reported its hour, always for stations whose own ozone sensor missed that hour, and for stations whose LKI Luchtmeetnet never lifts with an ozone estimate (decisions #30, #31, #33).';
