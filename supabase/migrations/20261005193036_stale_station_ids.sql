-- External ids of stations whose details are missing or older than
-- p_max_age_days, as one array (a set-returning function would be capped by
-- the Data API's max_rows). Used by collect-samenmeten's "things" mode.
create function public.stale_station_ids(p_source text, p_max_age_days integer default 7)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(external_id), '{}')
  from public.stations
  where source = p_source
    and (details_updated_at is null or details_updated_at < now() - make_interval(days => p_max_age_days));
$$;

revoke execute on function public.stale_station_ids(text, integer) from public, anon, authenticated;
grant execute on function public.stale_station_ids(text, integer) to service_role;
