# Technical notes

This file tracks the major technical details and decisions for fyka-air. Add new entries to the decision log as they come up. See [VISION.md](VISION.md) for the why.

## Stack

- Next.js 16 (App Router, React 19). This Next.js version has breaking changes compared with older docs, so read `node_modules/next/dist/docs/` before writing code (see [AGENTS.md](AGENTS.md)).
- Tailwind CSS v4.
- shadcn/ui, `base-nova` style, built on Base UI (`@base-ui/react`), with lucide icons.
- Recharts for charts.
- MapLibre GL JS through [mapcn](https://www.mapcn.dev/) (`components/ui/map.tsx`), with OpenFreeMap basemaps (#5).
- next-themes for light and dark mode (the `dark` class on `<html>`).
- Next.js Cache Components (`cacheComponents: true`) for caching the station data (#20).
- Supabase (Postgres) for data and the hourly collector. The project is "Air" (`uoocwxpfujiwfrhkkskb`, region eu-west-1, Ireland). The site is hosted on Vercel.

## Data sources

We combine two sources (decision #17):

| | Luchtmeetnet | RIVM Samen Meten |
|---|---|---|
| **What** | Official ("professional") measuring stations run by RIVM, GGDs, DCMR and provinces | Citizen and municipal sensor networks, about 30 of them |
| **Active stations/sensors** | 91 of 102 stations reported in the last hour | About 2,200 of 12,373 sensors had a reading in the last 3 hours |
| **Main quantities** | NO2, PM10, PM2.5, O3, NH3, LKI and more | PM2.5 and PM10, calibrated by RIVM |
| **API quality** | Fast, simple JSON | Quirky; see the limitations below |
| **License** | Open license, attribution requested | CC0 |

Probe scripts measure both APIs: `npm run probe:luchtmeetnet` and `npm run probe:samenmeten` (in [scripts/](scripts/)).

### Luchtmeetnet

Findings verified on 2026-10-05.

#### Access

- **API:** REST/JSON at `https://api.luchtmeetnet.nl/open_api`.
- **Auth:** none.
- **Docs:** [api-docs.luchtmeetnet.nl](https://api-docs.luchtmeetnet.nl/).
- **Fair use:** at most **100 requests per 5 minutes**. During testing it reset connections (`ECONNRESET`) for a while, even below that limit, so the collector has to cope with outages.
- **License:** the measurement data is public and free to use under an open license. RIVM asks for correct source attribution ([source](https://luchtkwaliteitkaart.nl/bron/rivm-luchtmeetnet)).

#### Endpoints

| Endpoint | Returns | Notes |
|---|---|---|
| `/stations?page=n` | `number`, `location` | 102 stations, 5 pages |
| `/stations/{number}` | `geometry` (lon/lat), `components`, `organisation`, `type` (for example "Regional"), `municipality`, `province` | 1 request per station, so refresh daily and throttle the requests |
| `/measurements?start=&end=` | `station_number`, `formula`, `value`, `timestamp_measured` | Up to 1,000 per page. Can also filter by `station_number` and `formula`. |
| `/lki?start=&end=` | The official LKI per station | |
| `/components` | Formula → Dutch and English name | |

- **Timestamps:** `timestamp_measured` marks the **end** of the measured hour. So `18:00` covers 17:00–18:00 UTC.
- **Freshness:** data for the hour ending 18:00 was available at 18:11 UTC.
- **Cost of an hourly sweep:** **2 requests** (`/measurements` plus `/lki` with `start=end=<hour>`), returning 506 measurements and 86 LKI values in 0.2 s.
- **Station coverage that hour:**

  | Component | Stations |
  |---|---|
  | LKI | 86 |
  | PM10 | 80 |
  | NO2 | 78 |
  | PM2.5 | 64 |
  | O3 | 44 |
  | NH3 | 9 |

### RIVM Samen Meten

Findings verified on 2026-10-05.

#### Access

- **API:** OGC SensorThings API v1.0 at `https://api-samenmeten.rivm.nl/v1.0`, running the GOST server.
- **Auth:** none.
- **Rate limits:** none published.
- **Docs:** [samenmeten.nl/international/API](https://www.samenmeten.nl/international/API) and the [GOST reference](https://gost1.docs.apiary.io/#reference/0/root/get-sensorthings-resource-endpoints).
- **License:** **CC-0 (1.0)** per [data.overheid.nl](https://data.overheid.nl/dataset/utrecht-samen-meten-dataportaal). Samen Meten's principle is that data, methods and software are all open ([OpenData](https://www.samenmeten.nl/international/OpenData)). We credit "RIVM Samen Meten" anyway.

#### Data model

- **Thing:** one device. 12,373 in total. Fetching them all takes about 8 s: 62 pages of 200, ordered by `id`, with `Locations` expanded.
  - 53 have no location.
  - 256 lie outside the Netherlands' bounding box.
- **Thing name prefix:** identifies the network. **None of them are official Luchtmeetnet stations.** The largest networks:

  | Prefix | Network | Total | Active (last 3 hours) |
  |---|---|---|---|
  | `LTD` | Sensor.Community (Luftdaten) | 6,119 | 1,407 |
  | `OHN` | Ohnics | 341 | 182 |
  | `HLL` | Hollandse Luchten | 559 | 122 |
  | `LUC` | Luchtclub (Gemeente Rotterdam) | 704 | 119 |
  | `AGR` | AirGradient | 101 | 62 |
  | `SCL` | Scapeler | 79 | 53 |
  | `SMC` | Smart Citizen | 78 | 51 |

  Many networks are fully inactive. Examples are the Palmes diffusion-tube projects (`*PB`), `NBI` and `SSK`. Some prefixes belong to RIVM research projects (`OZK`, `SSK`, `VW`), but those are still sensors, not reference stations.
- **Thing `properties`:** `owner`, `project`, `codegemeente` (municipality code), `knmicode` (nearest KNMI weather station), and the Luchtmeetnet reference station codes for each pollutant (`pm25closecode`, `pm25regiocode`, `pm25stadcode`, and the same set for `pm10`, `no2` and `nh3`). For example, `NL10444` links a sensor to the Luchtmeetnet stations it's compared against.
- **ObservedProperties:**

  | Name | Meaning |
  |---|---|
  | `pm10`, `pm25` | Raw PM10 and PM2.5 |
  | `pm10_kal`, `pm25_kal` | Calibrated by RIVM |
  | `no2` | NO2 (there is no calibrated variant) |
  | `nh3` | NH3 |
  | `temp` | Temperature |
  | `rh` | Relative humidity |
  | `pres` | Air pressure |

- **Datastream names:** `<thing>-<n>-<quantity>`, for example `LTD_94370-2-pm25_kal`.
- **Units:** QUDT definitions (`MicroGM-PER-M3`, `DEG_C`, `PERCENT`).
- **Active sensors per quantity (last 3 hours):**

  | Quantity | Active sensors |
  |---|---|
  | `pm25_kal` | 2,159 |
  | `pm25` (raw) | 1,967 |
  | `temp` | 1,515 |
  | `rh` | 1,354 |
  | `pm10_kal` | 1,274 |
  | `pm10` (raw) | 1,271 |
  | `pres` | 725 |
  | `no2` | **14** |
  | `nh3` | 0 |

- **Observations:** hourly, at about 10,600 per complete hour (all quantities).
  - The value for `18:00` only starts appearing around 18:20–18:30 UTC, and it's filled in while you read it.
  - That suggests `phenomenonTime` marks the end of the hour, like Luchtmeetnet, but this is **not confirmed**.

#### How to sweep one hour

`/Observations?$filter=phenomenonTime eq <hour>&$expand=Datastream($select=id,name)&$select=phenomenonTime,result&$top=200&$skip=<n>`

- **Speed:** about 0.1–0.7 s per page, 53 pages per hour.
- **Totals:** 66 s per complete hour, of which about 60 s is spent detecting the end of the data (see below).
- **Consistency:** three complete hours each returned exactly 10,600 rows with **no duplicates**, so the unordered `$skip` paging is stable once an hour is complete.
- **The current hour:** sweeping it while data is still arriving gave 1,213 duplicates and repeated 504s. **Only sweep an hour once it's complete.**

#### Known limitations

- **No empty pages.** A filter that matches no rows, such as an unpublished hour or `$skip` past the end, returns **504 after about 30 s**.
- **Transient 504s.** These also happen on valid pages; one offset failed once and then worked. So: retry a 504 once, and treat a second 504 as the end of the data.
- **`$top` is capped at 200.**
- **`@iot.nextLink` drops `$select`,** so build `$skip` URLs yourself.
- **What times out with a 504:**
  - `$count=true`
  - `$orderby` on `Observations` (both `id` and `phenomenonTime`)
  - `$expand` of latest observations across 100 or more Things
- **What crashes the server:** filters on a related entity's fields (`Datastream/id`, `Datastream/ObservedProperty/id`). These return 502 or a closed connection.
- **What isn't supported:** a `$filter` inside a nested `$expand`. It returns 400 with every datetime syntax we tried.
- **What works reliably:**
  - `/Things` with `$orderby=id` and `$expand=Locations`
  - per-datastream reads such as `/Datastreams(id)/Observations`
  - the top-level hour filter above

#### Related open source

- [rivm-syso/Samen-analyseren-tool](https://github.com/rivm-syso/Samen-analyseren-tool): RIVM's analysis and visualization tool.
- [rivm-syso/samanapir](https://github.com/rivm-syso/samanapir): an R package for the API, with query patterns and calibration logic.

### Fallback: Sensor.Community

`https://data.sensor.community/static/v2/data.1h.json` holds hourly averages for every sensor worldwide in a single file: 8.8 MB, downloaded in 2 s. The values are raw, not calibrated by RIVM. The license still needs checking (probably ODbL). Use this source only if Samen Meten proves unreliable.

## Storage estimate

These figures cover Samen Meten at about 80 bytes per row, including the index, which is a rough number. Luchtmeetnet adds only about 600 rows per hour.

| Scope | Rows per hour | 30 days | 90 days |
|---|---|---|---|
| Stored quantities (`pm25_kal`, `pm10_kal`, `no2`, `nh3`) | ~3,400 | ~200 MB | ~590 MB |
| All quantities | ~10,600 | ~610 MB | ~1.8 GB |

With Supabase's 500 MB free tier, store only the needed quantities and keep **30 days of raw hourly data** to begin with.

**Watch this once Samen Meten runs (2026-10-05 onwards).** At 30 days, raw data is about 2.5 million Samen Meten rows plus 0.4 million Luchtmeetnet rows. With the primary key and `measured_at` index, that's an estimated 300–400 MB. Citizen-sensor LKI rows are deleted after 2 days to save space. If the database nears 500 MB, lower the retention with `maintain_measurements(p_keep_days)`; the charts only need 7 days.

## Decision log

| # | Date | Decision | Status | Rationale |
|---|------|----------|--------|-----------|
| 1 | 2026-10-05 | ~~Use RIVM Samen Meten as the primary data source~~ Replaced by #17 | Superseded | — |
| 2 | 2026-10-05 | Ingest data into our own database with a scheduled hourly collector, and serve the app from that store instead of calling upstream APIs from the client | Decided | The upstream APIs are slow or rate-limited. |
| 3 | 2026-10-05 | Show calibrated (`*_kal`) values by default for citizen sensors, with raw values available | Decided | Calibrated values are RIVM's best estimate. Keeping raw values available follows the "honest about the data" principle. |
| 4 | 2026-10-05 | Start with Supabase for the database and Vercel for hosting | Decided (temporary) | Fastest way to get started. Both are US-controlled, which conflicts with the sovereignty principle, so plan to migrate to EU or Dutch-controlled infrastructure later. Keep the data access layer portable: plain Postgres, no lock-in to Supabase-specific features where we can avoid them. |
| 5 | 2026-10-05 | Use MapLibre GL JS through [mapcn](https://www.mapcn.dev/) components, with [OpenFreeMap](https://openfreemap.org/)'s Positron (light) and Dark styles as the basemap, recolored (light mode like CARTO's light basemap: near-white land, grey water, no green, faded roads; navy in dark mode) and with Dutch labels | Decided | MapLibre is open source (BSD), WebGL-based and uses vector tiles, so it's smooth and fully styleable. mapcn gives shadcn-style, theme-aware map components on top of it. Positron's calm layout keeps the LKI dots readable, and the recoloring stops it from looking grey. OpenFreeMap is free, with no API key and no usage limits, and it's open source and self-hostable, so it can later move to our own infrastructure (#4). Rejected: PDOK BRT-Achtergrondkaart (the standard style is busy, and a stripped-down version looked too plain), plain Positron (too grey), Liberty (too busy), and CARTO's hosted styles, mapcn's default (only free for non-commercial use up to a monthly view limit). |
| 6 | 2026-10-05 | First version scope: a national map of current PM2.5 and NO2, a sensor detail panel with 24-hour and 7-day charts, and address search. No accounts. | Decided | Small enough to ship, and covers the main reason people look up air quality. NO2 comes almost entirely from Luchtmeetnet (#17). |
| 7 | 2026-10-05 | Use RIVM's Luchtkwaliteitsindex (LKI) for the color scale, with WHO guideline values as reference lines in charts | Decided | It's the official Dutch index, so the colors match Luchtmeetnet. Luchtmeetnet publishes the official LKI per station. Citizen sensors get an LKI computed from their PM values (#22). |
| 8 | 2026-10-05 | Run the hourly collector on Supabase (pg_cron triggering an Edge Function) | Decided | Keeps data and scheduling in one place. Vercel's Hobby plan only allows daily cron jobs. A Samen Meten hour takes about 66 s, so run one hour per invocation and check this against the Edge Function wall-clock limit. |
| 9 | 2026-10-05 | Keep 30 days of raw hourly data and daily averages after that, storing only the needed quantities. No historical backfill, except one day of Samen Meten so sensors had a 24-hour LKI from the start. | Decided | Built: `measurements_daily` plus the nightly `maintain_measurements()` job. Fits Supabase's free tier, but keep an eye on it (see the storage estimate). |
| 10 | 2026-10-05 | Dutch only for now, with no translation framework | Decided | The audience is Dutch. We can add English later. |
| 11 | 2026-10-05 | License the code under EUPL-1.2 | Decided | The European Union Public Licence fits the sovereignty principle. The official text is in `LICENSE`. |
| 12 | 2026-10-05 | Host the code on GitHub | Decided | — |
| 13 | 2026-10-05 | Use Fyka Watch for analytics | Decided | — |
| 14 | 2026-10-05 | Use PDOK Locatieserver for address and place search | Decided | It's a free Dutch government geocoder and fits the sovereignty principle. |
| 15 | 2026-10-05 | Don't show sensors with no reading in the last 3 hours | Decided | Stale data is misleading on a map that's supposed to show current air quality. |
| 16 | 2026-10-05 | Label every sensor as professional or citizen sensor. Professional means a Luchtmeetnet station; everything from Samen Meten counts as a citizen sensor, including the municipal and RIVM research networks. | Decided | Samen Meten contains no reference stations (see the probe). Municipal networks use the same low-cost sensors. |
| 17 | 2026-10-05 | Use two data sources: Luchtmeetnet for professional stations and Samen Meten for citizen sensors. Sensor.Community is the fallback. | Decided | Luchtmeetnet is fast, official and covers NO2 (78 stations, compared with 14 sensors in Samen Meten). Samen Meten adds RIVM calibration and networks that aren't on Sensor.Community. |
| 18 | 2026-10-05 | Keep the schema plain Postgres: store longitude and latitude as columns (no PostGIS), and write through a SQL function (`ingest_measurements`) rather than Supabase-specific features | Decided | Makes the later move off Supabase easier (#4). With about 2,300 points, the map loads all active stations anyway, so we don't need spatial queries. |
| 19 | 2026-10-05 | Store only calibrated PM values from Samen Meten, not raw values | Decided | Keeps storage within the free tier (#9). This narrows #3: raw values can be linked from the sensor detail panel instead. |
| 20 | 2026-10-05 | The app reads the `station_readings_now` view through Supabase's REST API with a plain server-side `fetch`, cached for 5 minutes with `use cache` | Decided | New data arrives hourly, so a 5-minute cache shows it soon after without hitting the database on every visit. A plain `fetch` with the publishable (read-only) key avoids depending on `supabase-js` (#4). |
| 21 | 2026-10-05 | Color map dots by the official LKI that Luchtmeetnet publishes. In the station panel, compare each pollutant with its WHO guideline instead of coloring it by an LKI sub-index. | Decided | The per-pollutant LKI bands in the house style are example values. We don't color by a band we can't verify (see "Honest" in VISION.md). |

## Database schema

See [supabase/migrations/](supabase/migrations/) for the schema and [supabase/README.md](supabase/README.md) for setup.

- **`stations`:** one row per Luchtmeetnet station or Samen Meten sensor.
  - Unique on `(source, external_id)`.
  - `kind` (`professional` or `citizen`) is generated from `source` (#16).
  - Also holds name, organisation, municipality, `longitude`/`latitude`, a `details` jsonb with source-specific metadata, and `details_updated_at`.
- **`measurements`:** hourly values.
  - Primary key `(station_id, quantity, measured_at)`, plus an index on `measured_at` for "last 3 hours" queries and retention deletes.
  - `quantity` is one of `pm25`, `pm10`, `no2`, `o3`, `nh3` or `lki`. For Samen Meten sensors, `pm25` and `pm10` are the calibrated values.
  - `measured_at` is the end of the hour.
- **`station_readings_now`** (view, `security_invoker`): one row per located station with a reading in the last 3 hours (#15).
  - `readings` is a jsonb object `{quantity: {value, measured_at}}`.
  - `measured_at` is the newest of those readings.
  - This is what the map loads.
- **Access:** the tables and the view are publicly readable (RLS select policy for `anon` and `authenticated`). Only `service_role` can write, through `ingest_measurements(source, rows jsonb)`, which also creates stub stations for numbers it hasn't seen yet.
- **Not built yet:** daily aggregates and the 30-day retention job (#9), and the Samen Meten collector.

## Frontend

The visual reference is [docs/design/huisstijl.html](docs/design/huisstijl.html), summarized in [CLAUDE.md](CLAUDE.md).

- **Page:** [app/page.tsx](app/page.tsx) has a header (Fyka mark, light/dark toggle) and the map with a side panel ([components/air/](components/air/)). On mobile, the panel sits below the map.
- **Data:** `getStationReadings()` in [lib/air-data.ts](lib/air-data.ts) (#20).
- **Map:**
  - Stations are drawn as LKI-colored circles with a halo by [station-layer.tsx](components/air/station-layer.tsx), a MapLibre layer on top of mapcn's `useMap()`. Stations without an index are drawn in steel blue.
  - [lib/map-style.ts](lib/map-style.ts) loads the OpenFreeMap styles on the server, cached for a day. It recolors background, land use, parks, buildings and water per theme, and replaces English label names (`name_en`) with `name:nl`, falling back to `name`. Client components must not import it, because it contains a `"use cache"` function.
- **Panel:** with no station selected, it shows an overview (stations per LKI category, the latest measurement time). Clicking a station shows its LKI, advice, pollutant values against WHO guidelines, and a chart.
- **Chart** ([station-chart.tsx](components/air/station-chart.tsx)):
  - Tabs for the pollutant (only those the station measures) and the period: 24 hours (hourly line) or 7 days (daily-mean bars).
  - The WHO guideline is a dashed reference line. Missing hours show as gaps, and the tooltip shows how many hours went into each daily mean.
  - A screen-reader table repeats the values.
  - Data comes from `GET /api/stations/[id]/history` ([route](app/api/stations/[id]/history/route.ts)), which calls `getStationHistory()`, cached for 5 minutes. Daily means use Europe/Amsterdam days. The window ends at the last hour the collector should already have stored (20 minutes past the hour).
- **Search** ([map-search.tsx](components/air/map-search.tsx), [lib/geocode.ts](lib/geocode.ts)):
  - Finds stations by name, code or municipality, plus addresses, streets, postcodes, places and municipalities through PDOK Locatieserver's `suggest` endpoint. Only `suggest` handles half-typed words, and it returns coordinates via `fl=centroide_ll`.
  - The browser calls PDOK directly: the API is public and allows CORS, and what people type goes to a Dutch government service.
  - Choosing a place pins it, selects the nearest station, zooms to show both, and shows the distance in the panel.
- **Scales, names and Dutch formatting:** [lib/air-quality.ts](lib/air-quality.ts). The LKI hex colors are our own picks in RIVM's color order and still need checking against the official legend.
- **Theme tokens:** the Fyka base colors and the sky accent are mapped onto shadcn's variables in [app/globals.css](app/globals.css), with extra `brand-text`, `brand-soft`, `steel`, `ok` and `warn` colors.

### Environment variables

Set these in `.env.local` locally and in Vercel's project settings. [.env.example](.env.example) shows the format.

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://uoocwxpfujiwfrhkkskb.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The project's publishable key (`sb_publishable_...`). It only allows reads. |

### Open points

- **Freshness dot:** Luchtmeetnet publishes about 10 minutes after the hour and the collector runs at :15. The newest reading is therefore often 60–75 minutes old, so the house style's "amber after 1 hour" rule triggers often. Consider 90 minutes.
- **MapLibre worker:** mapcn loads MapLibre's web worker from unpkg. Self-host it from `public/` once we move toward EU infrastructure.

## Collector design

- **Idempotent writes.** Upsert on `(source, datastream/station, timestamp)`, so re-sweeping an hour is safe.
- **Luchtmeetnet** (built: [supabase/functions/collect-luchtmeetnet](supabase/functions/collect-luchtmeetnet/))
  - Every hour at :15, fetch `/measurements` and `/lki` for the **last 3 hours**, so missed runs catch up. That's about 1,500 rows in about 3 requests.
  - Refresh details for up to 20 stations per run, oldest first and 1 s apart. That's about 23 requests per run, well under the limit, and every station gets refreshed daily.
  - Tolerate connection resets by retrying with backoff.
- **Samen Meten**
  - Every hour, at about :45, sweep the hour labelled with the current hour, which should be complete by then. Also re-sweep the previous hour to fill any gaps.
  - Never sweep an hour that's still being filled.
  - Retry a 504 once; a second 504 means the end of the data.
  - Refresh the Thing inventory (names, properties, locations) daily: about 8 s.
- **General**
  - Run requests one after another, never in parallel.
  - Store timestamps in UTC as the **end** of the measured hour, and convert to `Europe/Amsterdam` only for display.
  - Skip Things without a location or outside the Netherlands.
