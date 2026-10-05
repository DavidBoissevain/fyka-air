# Technical notes

This file tracks the major technical details and decisions for fyka-air. Add new entries to the decision log as they come up. See [VISION.md](VISION.md) for the why.

## Stack

- Next.js 16 (App Router, React 19). This Next.js version has breaking changes compared with older docs, so read `node_modules/next/dist/docs/` before writing code (see [AGENTS.md](AGENTS.md)).
- Tailwind CSS v4.
- shadcn/ui, `base-nova` style, built on Base UI (`@base-ui/react`), with lucide icons.
- Recharts for charts.

## Data source: RIVM Samen Meten

Findings verified on 2026-10-05.

### Access

- **API:** OGC SensorThings API v1.0 at `https://api-samenmeten.rivm.nl/v1.0`.
- **Auth:** none, the API is fully public.
- **Rate limits:** none published.
- **Docs:** [samenmeten.nl/international/API](https://www.samenmeten.nl/international/API) and the [GOST SensorThings reference](https://gost1.docs.apiary.io/#reference/0/root/get-sensorthings-resource-endpoints).
- **Query language:** OData-style (`$filter`, `$expand`, `$select`, `$top`, `$skip`, `$orderby`). Pages link onward through `@iot.nextLink`.

### License

- The dataset is listed as **CC-0 (1.0)** on [data.overheid.nl](https://data.overheid.nl/dataset/utrecht-samen-meten-dataportaal). That makes it public domain, so reuse is allowed, including commercially.
- Samen Meten's principle is that data, measurement methods and software are all open ([OpenData](https://www.samenmeten.nl/international/OpenData)).
- Attribution isn't required, but we credit "RIVM Samen Meten" in the app anyway.

### Data model

These are the standard SensorThings entities: `Things`, `Locations`, `HistoricalLocations`, `Datastreams`, `Sensors`, `ObservedProperties`, `Observations` and `FeaturesOfInterest`.

- **Thing:** one measuring device. Its name prefix tells you the source:
  - `NL*`: official RIVM measuring stations
  - `LTD_*`: Sensor.Community (formerly Luftdaten)
  - `SMC_*`: Smart Citizen
  - other prefixes for other citizen projects
- **Thing `properties`:** metadata such as `owner`, `project`, `codegemeente` (municipality code) and `knmicode` (nearest KNMI weather station). They also hold reference station codes for each pollutant (`pm25closecode`, `pm25regiocode`, `pm25stadcode`, and the same set for `pm10`, `no2` and `nh3`). These link a citizen sensor to the official stations it's compared against.
- **Datastream:** one measured quantity on one Thing, named `<thing>-<n>-<quantity>`. For example:

  ```
  LTD_94370-2-pm25       raw PM2.5
  LTD_94370-2-pm25_kal   calibrated PM2.5 (by RIVM)
  LTD_94370-2-pm10       raw PM10
  LTD_94370-2-pm10_kal   calibrated PM10
  LTD_94370-6-temp       temperature (°C)
  LTD_94370-6-rh         relative humidity (%)
  ```

- **Units:** QUDT definitions, for example `MicroGM-PER-M3` (µg/m³), `DEG_C` and `PERCENT`.
- **Quantities:** PM2.5, PM10, NO2, NH3, temperature and humidity. The portal also shows sound (geluid) data, but it hasn't yet been confirmed whether the API exposes it.
- **Observations:** hourly values with UTC `phenomenonTime`. Live data was confirmed, with a reading from 17:00 UTC on the same day.

### Example queries

```
# Sensors with their datastreams
/Things?$top=2&$expand=Datastreams($expand=ObservedProperty)

# Sensors from one network
/Things?$top=50&$filter=startswith(name,'LTD')

# Observations for one datastream
/Datastreams(56195)/Observations?$top=24&$orderby=phenomenonTime desc
```

### Known limitations

- **Heavy queries time out with a 504 Gateway Time-out.** Both of these failed:
  - `$count=true` on `Things`
  - `/Observations?$orderby=phenomenonTime desc` across all sensors

  Small queries scoped to one Thing or one Datastream work reliably.
- **Many sensors are inactive.** Some datastreams return no observations at all.
- **The API isn't built to back a public app directly.** It's too slow, and we shouldn't put user load on RIVM infrastructure.

### Related open source

- [rivm-syso/Samen-analyseren-tool](https://github.com/rivm-syso/Samen-analyseren-tool): RIVM's own analysis and visualization tool.
- [rivm-syso/samanapir](https://github.com/rivm-syso/samanapir): an R package for the API. It's a useful reference for query patterns and calibration logic.

## Decision log

| # | Date | Decision | Status | Rationale |
|---|------|----------|--------|-----------|
| 1 | 2026-10-05 | Use RIVM Samen Meten as the primary data source | Decided | It's public, CC0, combines official and citizen sensors, and fits the Dutch-sovereign goal. |
| 2 | 2026-10-05 | Ingest data into our own database with a scheduled hourly collector, and serve the app from that store instead of calling the RIVM API from the client | Decided | The upstream API is slow, times out on broad queries and has no published rate limits. |
| 3 | 2026-10-05 | Show calibrated (`*_kal`) values by default, with raw values available | Decided | Calibrated values are RIVM's best estimate. Keeping raw values available follows the "honest about the data" principle. |
| 4 | 2026-10-05 | Start with Supabase for the database and Vercel for hosting | Decided (temporary) | Fastest way to get started. Both are US-controlled, which conflicts with the sovereignty principle, so plan to migrate to EU or Dutch-controlled infrastructure later. Keep the data access layer portable: plain Postgres, no lock-in to Supabase-specific features where we can avoid them. |
| 5 | 2026-10-05 | Use MapLibre GL JS through [mapcn](https://www.mapcn.dev/) components, with PDOK BRT-Achtergrondkaart vector tiles as the basemap | Proposed | MapLibre is open source (BSD), WebGL-based and uses vector tiles, so it's smooth and fully styleable. mapcn gives shadcn-style, theme-aware map components on top of it. PDOK tiles come from the Dutch government. mapcn uses CARTO tiles by default, so we swap in PDOK. PDOK has no dark style, so we need a custom dark variant of its style JSON. |
| 6 | 2026-10-05 | First version scope: a national map of current calibrated PM2.5 and NO2, a sensor detail panel with 24-hour and 7-day charts, and address search. No accounts. | Decided | Small enough to ship, and covers the main reason people look up air quality. |
| 7 | 2026-10-05 | Use RIVM's Luchtkwaliteitsindex (LKI) for the color scale, with WHO guideline values as reference lines in charts | Decided | It's the official Dutch index, so the colors match Luchtmeetnet and other official sources. |
| 8 | 2026-10-05 | Run the hourly collector on Supabase (pg_cron triggering an Edge Function) | Decided | Keeps data and scheduling in one place. Vercel's Hobby plan only allows daily cron jobs. Edge Functions have time limits, so check how long a sweep takes with `scripts/probe-samenmeten.ts`. |
| 9 | 2026-10-05 | Keep raw hourly values for 30–90 days and daily averages after that. No historical backfill at first. | Decided | Keeps storage within Supabase limits. Set the exact number of days once the probe gives real data volumes. |
| 10 | 2026-10-05 | Dutch only for now, with no translation framework | Decided | The audience is Dutch. We can add English later. |
| 11 | 2026-10-05 | License the code under EUPL-1.2 | Decided | The European Union Public Licence fits the sovereignty principle. |
| 12 | 2026-10-05 | Host the code on GitHub | Decided | — |
| 13 | 2026-10-05 | Use Fyka Watch for analytics | Decided | — |
| 14 | 2026-10-05 | Use PDOK Locatieserver for address and place search | Decided | It's a free Dutch government geocoder and fits the sovereignty principle. |
| 15 | 2026-10-05 | Don't show sensors with no reading in the last 3 hours | Decided | Stale data is misleading on a map that's supposed to show current air quality. |
| 16 | 2026-10-05 | Label every sensor as professional (official measuring station) or citizen sensor | Decided | Supports the "honest about the data" principle. The probe script checks how to tell the two apart. |

## Collector guidelines

- Poll at most once an hour, which matches how often the data updates.
- Paginate with `$top`/`$skip` and keep queries small: scope them to one Datastream, or filter by Thing prefix or time window.
- Run requests one after another, not in parallel, and back off on 5xx errors.
- Skip or flag sensors with no recent observations.
- Store timestamps in UTC and convert to `Europe/Amsterdam` only for display.
