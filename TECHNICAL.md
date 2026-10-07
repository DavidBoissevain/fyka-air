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
- **Calibrated values arrive about an hour after raw ones** (checked 2026-10-07). At 18:34 UTC, a sensor had raw `pm25` for 18:00 but `pm25_kal` only up to 17:00. A :40 sweep of the current hour found about 6,000 raw observations but stored 0 rows, and calibrated data for hour H only landed with the :55 re-sweep at H+1:55: always 2–3 hours old, a few minutes from the 3-hour cut-off. Fixed by #24 (sweep the previous hour) and #25 (citizen freshness windows shifted by 2 hours).
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

### RIVM model maps (the coloured area layer)

Researched 2026-10-07 and built the same day as the map's area layer (#26).

- **RIVM `lucht` WMS** at `https://data.rivm.nl/geo/lucht/wms`: the source of Luchtmeetnet's colored map.
  - **Layers:** `actueel_{lki,no2,o3,pm10,pm25}` for now, plus `vandaag_`, `morgen_` and `overmorgen_{comp}_{HH}` forecasts every 3 hours. There is no time dimension and no timestamp.
  - **Which hour "actueel" shows** (tested 2026-10-07 19:03 UTC): the newest hour Luchtmeetnet has published, here the hour ending 18:00. Ozone is the clearest test because it changes fastest: the map's mean difference from 35 stations was 5 µg/m³ for that hour, against 10 and 16 for the two hours before. RIVM's own style labels the map "kaart ververst elk uur". When in the hour it updates is not yet measured; our label could say "Berekend voor het laatste uur".
  - **How it's made:** on a 125 m grid, from this hour's measurements at official background stations. Measurements at traffic stations aren't used in the base map, and neither are Samen Meten sensors. Sources: RIVM's 2015 smog advice, appendix 3, and a 2023 RIVM slide ("Past hour: Belgian RIO model for background maps + local traffic").
    - **Background:** the Belgian RIO method. It removes each station's local character using land use, then interpolates between the stations (kriging).
    - **Roads:** motorway contributions to NO₂ and fine dust are modelled with current KNMI weather and scaled to measurements at street stations.
    - **LKI:** computed per grid cell from the component maps. The decimal is a linear interpolation within the index band (O₃ 54.8 in band 40–60 gives 3.74), and Luchtmeetnet rounds decimal LKI values up.
    - **Forecast layers:** pure model output, from CAMS since August 2023.
    - **Limitations:** NO₂ along streets is underestimated, and incidents such as fires and wood burning don't show up. Luchtmeetnet's "mijn locatie" page mentions OPS plus TREDM instead, a conflict we haven't resolved.
  - **Access:** a GetMap in EPSG:3857 works even though the capabilities only list RD and CRS:84, and responses carry CORS `*` with no key. So a MapLibre raster source with `{bbox-epsg-3857}` works. GetFeatureInfo returns values, and the LKI comes as a decimal (`3.74`). A WCS serves the same grids as GeoTIFF.
  - **Terms:** credit "www.luchtmeetnet.nl", with no availability guarantee.
  - **Styling:** RIVM's default LKI style uses Luchtmeetnet's colors in fine steps. The values are continuous, with Goed 0–3, Matig 3–6, Onvoldoende 6–8, Slecht 8–10 and Zeer slecht above 10, so the whole-number index is the value rounded up. **Our own colors work:** a GetMap with an `SLD_BODY` parameter returns the map in our 11 LKI colors (tested 2026-10-07). Use a `RasterSymbolizer` with `ColorMap type="intervals"` and entries at quantity 0 (transparent), 1, 2, … 10, then 999, which is about 1 KB of XML in the URL.
- **Annual-only maps:** `data.rivm.nl/geo/gcn/wms` and Atlas Leefomgeving. Not suitable for an hourly layer.
- **Samen Meten's "berekende kaart":** an hourly 270×320 PNG (about 1 km per pixel), with no CORS header and no documentation.
- **Copernicus CAMS WMS:** about 10 km resolution, so too coarse. Fallback only.

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
| 15 | 2026-10-05 | Don't show sensors with no reading in the last 3 hours | Decided; for citizen sensors amended by #25 | Stale data is misleading on a map that's supposed to show current air quality. |
| 16 | 2026-10-05 | Label every sensor as professional or citizen sensor. Professional means a Luchtmeetnet station; everything from Samen Meten counts as a citizen sensor, including the municipal and RIVM research networks. | Decided | Samen Meten contains no reference stations (see the probe). Municipal networks use the same low-cost sensors. |
| 17 | 2026-10-05 | Use two data sources: Luchtmeetnet for professional stations and Samen Meten for citizen sensors. Sensor.Community is the fallback. | Decided | Luchtmeetnet is fast, official and covers NO2 (78 stations, compared with 14 sensors in Samen Meten). Samen Meten adds RIVM calibration and networks that aren't on Sensor.Community. |
| 18 | 2026-10-05 | Keep the schema plain Postgres: store longitude and latitude as columns (no PostGIS), and write through a SQL function (`ingest_measurements`) rather than Supabase-specific features | Decided | Makes the later move off Supabase easier (#4). With about 2,300 points, the map loads all active stations anyway, so we don't need spatial queries. |
| 19 | 2026-10-05 | Store only calibrated PM values from Samen Meten, not raw values | Decided | Keeps storage within the free tier (#9). This narrows #3: raw values can be linked from the sensor detail panel instead. |
| 20 | 2026-10-05 | The app reads the `station_readings_now` view through Supabase's REST API with a plain server-side `fetch`, cached for 5 minutes with `use cache` | Decided | New data arrives hourly, so a 5-minute cache shows it soon after without hitting the database on every visit. A plain `fetch` with the publishable (read-only) key avoids depending on `supabase-js` (#4). |
| 21 | 2026-10-05 | Color map dots by the official LKI that Luchtmeetnet publishes. In the station panel, compare each pollutant with its WHO guideline instead of coloring it by an LKI sub-index. | Decided | The per-pollutant LKI bands in the house style are example values. We don't color by a band we can't verify (see "Honest" in VISION.md). The bands have since been verified (#22), so the map colours pollutants by them (#27); the panel keeps the WHO comparison. |
| 22 | 2026-10-05 | Compute the LKI for citizen sensors from the 24-hour average of their calibrated PM2.5 and PM10, using RIVM's class edges, and say in the panel that it's a fine-dust index | Decided | **RIVM's bands:** report 2014-0050, table 7, with PM as a 24-hour average and NO2/O3 hourly; the LKI is the highest sub-index. These reproduced Luchtmeetnet's published LKI at 44 of 44 stations that measure every component (2026-10-05). Stations without an ozone sensor still get ozone in their official LKI, so RIVM evidently fills in an estimated value. **Classes 10 and 11:** the report has one open top class, but Luchtmeetnet's `/open_api/components/{formula}` limits split it the same way we do (PM2.5 100–140 / >140, PM10 and NO2 150–200 / >200, O3 200–240 / >240). Those limits confirm every band edge (checked 2026-10-06). **Why PM only:** sensors don't measure ozone or NO2, so their index can be lower than nearby official stations whenever ozone is the deciding pollutant. A sensor needs at least 12 hourly values in the last 24 hours to get an index. |
| 23 | 2026-10-06 | Keep the house style's own 11 LKI colors (deep blue `#0A3FC2` through yellow and orange to purple `#7E2BB8`), close in look to RIVM Samen Meten's map. All dots get a thin grey outline (no white halo). Stations without an index use Luchtmeetnet's grey `#70757F`. | Decided | **Why:** we tried colors built from Luchtmeetnet's official legend and found the house style's scale looked better. **The trade-off:** the only official LKI legend is Luchtmeetnet's, with one color per category (Goed `#96C8FF`, Matig `#FFFFC8`, Onvoldoende `#FFC800`, Slecht `#FF4B00`, Zeer slecht `#A43AD9`, from the site's legend CSS). Our colors don't match it, so the category name next to each color (CLAUDE.md) is what links them to official sources. **Other sources:** the API's `/components/LKI` limits list colors per index, but they're inconsistent (index 4 is red, while 5–6 are pale yellow again). Samen Meten's 11-color ramp (`#0020C5` → `#DC0625`) is a generic concentration scale with its own thresholds per quantity, not the LKI. |
| 24 | 2026-10-07 | Sweep the previous Samen Meten hour at :40 and again at :55 (cron jobs `collect-samenmeten-sweep` and `collect-samenmeten-resweep`), instead of the current hour at :40 and the previous hour at :55 | Decided | Calibrated values arrive about an hour after raw ones (see "Known limitations"), so the :40 sweep of the current hour stored nothing and data for hour H landed at H+1:55. Now it lands at H+1:40, and a failed :40 run is retried 15 minutes later instead of leaving the hour missing. The :55 run is the same sweep as before, so late values are still picked up as late as before. Migration `20261007183948_citizen_sensor_delay`. |
| 25 | 2026-10-07 | Judge citizen sensors' freshness against their calibration delay: amber when a sensor is behind the newest Samen Meten hour on the map or its reading is 3 hours or older, and off the map after 5 hours. Official stations keep #15 (amber from 1 hour, off after 3). | Decided | Citizen readings are normally 1h40–2h40 old (#24), so the 1-hour amber rule marked every sensor late and told people nothing, and the 3-hour cut-off left minutes of margin. Shifting both windows by 2 hours gives sensors the same slack as official stations: about two missed hours before they leave the map. "Behind the newest hour" catches a sensor that missed one hour, which a fixed age threshold would only flag late in that hour. The 3-hour age check still turns every sensor amber if the collector stops. The panel and the data dialog say that sensor readings arrive about 2 hours later. Built: `isLate()` in `lib/air-quality.ts` and the `station_readings_now` view. |
| 26 | 2026-10-07 | Colour the map between the dots with RIVM's hourly "actueel" maps (`data.rivm.nl/geo/lucht/wms`): the LKI by default, or PM2.5, PM10, NO2 or O3 from a "Kaartlagen" menu, or off. Tiles and point values go through our own routes (`/api/rivm/...`), restyled in our LKI colours with `SLD_BODY`. Clicking next to the dots shows RIVM's values at that spot. | Decided | RIVM already computes this every hour on a 125 m grid from current official measurements plus a road model (see "RIVM model maps"), which beats anything we could interpolate from our points, especially NO2 along roads. **Proxy:** CDN caching (10 minutes) spares RIVM's server, which has no availability guarantee, and only Dutch tiles are served, so it can't be used as an open proxy. **Honesty:** the layer is labelled "berekend door het RIVM" in the legend, the popup and the data dialog, and credited to luchtmeetnet.nl as its terms ask. |
| 27 | 2026-10-07 | With a pollutant layer chosen, colour both the area and the dots by that pollutant's hourly value in its LKI sub-index bands (`SUB_INDEX_EDGES`, the same as `lki_sub_index()`); stations that don't measure it are grey ("Niet gemeten"). The legend names the categories with their µg/m³ bounds. | Decided | One colour should mean one thing on the map. The bands are verified (#22), and their category bounds match RIVM's own map styles (for example PM2.5: Goed up to 20, Matig up to 50, Onvoldoende up to 90, Slecht up to 140). For PM, RIVM's LKI uses 24-hour averages; the hourly map applies the same bands to hourly values, as RIVM's own maps do. |
| 28 | 2026-10-07 | Make the layer choice prominent: a labelled button at the top left that always shows the active layer, and a panel ranked by importance for health (LKI as the overall picture, then PM2.5, NO2, O3, PM10). Each layer gets a short tag and one line; the full explanation, including who should look at which layer, is in a separate "Welke kaart kies ik?" guide. | Decided | People mostly come for their health, and sensitive groups react to different pollutants (asthma: NO2, ozone and PM2.5; heart disease: PM2.5; outdoor exercise: ozone). The ranking follows the health burden (EEA estimates for the EU: PM2.5 far ahead of NO2 and O3; PM10 largely overlaps PM2.5). The guide keeps the panel short, sticks to well-established links and says it isn't medical advice. |

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
- **`station_readings_now`** (view, `security_invoker`): one row per located station with a recent reading: the last 3 hours for official stations (#15), 5 hours for citizen sensors (#25).
  - `readings` is a jsonb object `{quantity: {value, measured_at}}`.
  - `measured_at` is the newest of those readings.
  - This is what the map loads.
- **Access:** the tables and the view are publicly readable (RLS select policy for `anon` and `authenticated`). Only `service_role` can write, through `ingest_measurements(source, rows jsonb)`, which also creates stub stations for numbers it hasn't seen yet.
- **`measurements_daily`:** mean, min, max and number of hours per station, quantity and day (Europe/Amsterdam; the hour ending at 00:00 belongs to the previous day). Publicly readable.
- **Functions** (service role and cron only):
  - `lki_sub_index(quantity, value)`: RIVM class edges (#22).
  - `compute_citizen_lki(hour)`: writes `lki` rows for Samen Meten sensors.
  - `update_station_details(source, rows)` and `stale_station_ids(source, max_age_days)`: sensor details.
  - `rollup_daily(from, to)`: fills `measurements_daily`.
  - `maintain_measurements(keep_days = 30)`: nightly at 02:30 UTC. Rolls up the last two days, deletes raw data older than the retention window, and deletes citizen LKI rows older than 2 days.

## Frontend

The visual reference is [docs/design/huisstijl.html](docs/design/huisstijl.html), summarized in [CLAUDE.md](CLAUDE.md).

- **Page:** [app/page.tsx](app/page.tsx) has a header row with the address search on the left and only the light/dark toggle and app switcher on the right. The Fyka Air mark and the GitHub ("Bekijk de code") and "Steun mij" links are in the footer of the "Over de data" dialog ([data-info.tsx](components/air/data-info.tsx)). Below the header is the map with a side panel ([components/air/](components/air/)). From `lg` up, the panel floats over the right side of the map, so opening it doesn't resize the map or move the view; the map's own controls shift left by the panel width (`--panel`). On mobile, the panel sits below the map.
- **Data:** `getStationReadings()` in [lib/air-data.ts](lib/air-data.ts) (#20).
- **Map:**
  - [station-layer.tsx](components/air/station-layer.tsx) draws a MapLibre layer on top of mapcn's `useMap()`. Official stations are large LKI-colored circles and citizen sensors are small dots drawn underneath, both with a thin grey outline. Higher LKI values are drawn on top, and anything without an index is steel blue.
  - **Area layer** ([rivm-layer.tsx](components/air/rivm-layer.tsx), #26): RIVM's hourly map as a raster layer, inserted before the basemap's first line or symbol layer, so it sits above the land but under roads, labels and the dots. Tiles come from [`/api/rivm/[layer]/[z]/[x]/[y]`](app/api/rivm/[layer]/[z]/[x]/[y]/route.ts), which uses [lib/rivm-map.ts](lib/rivm-map.ts) to fetch RIVM's WMS in our colours (zoom 6–12, Dutch tiles only, cached 10 minutes on the CDN). A 10-minute bucket in the tile URL keeps open pages fresh.
  - **Kaartlaag** ([layer-picker.tsx](components/air/layer-picker.tsx), #28): a labelled button under the search box that always names the active layer ("Kaart: Luchtkwaliteitsindex"). It opens a panel that lists the layers by importance for health (LKI, PM2,5, NO₂, O₃, PM10, then "Alleen meetpunten"), each with a tag and one line. "Welke kaart kies ik?" opens [layer-guide.tsx](components/air/layer-guide.tsx): a small grid showing per group (astma, COPD, hart en vaten, kinderen, ouderen, buiten sporten) how much each pollutant matters, as one to three steel blocks (a simplified reading of WHO and EEA links, not a medical score), and a short card per layer (wat, effect, hoog bij, tip). The choice recolours the area and the dots (#27), the legend follows it, and it's remembered per viewer in `localStorage` ([hooks/use-map-layer.ts](hooks/use-map-layer.ts)).
  - **Value at a spot** ([point-value.tsx](components/air/point-value.tsx)): with the area layer on, clicking next to the dots opens a popup with RIVM's values there, from [`/api/rivm/point`](app/api/rivm/point/route.ts).
  - About 2,200 stations and sensors are loaded at once. `getStationReadings()` pages through the view, because the Data API returns at most 1,000 rows per request.
  - [lib/map-style.ts](lib/map-style.ts) loads the OpenFreeMap styles on the server, cached for a day. It recolors background, land use, parks, buildings and water per theme, and replaces English label names (`name_en`) with `name:nl`, falling back to `name`. Client components must not import it, because it contains a `"use cache"` function.
- **Panel:** closed by default, so the map fills the page. The "Overzicht Nederland" button at the bottom right of the map opens an overview (stations per LKI category, the latest measurement time). Both the overview and a station close with a cross; selecting a station replaces the overview, and closing it returns to the full map. Clicking a station shows its LKI, advice, pollutant values against WHO guidelines, and a chart. A citizen sensor shows "Burgersensor" and "Gekalibreerd door het RIVM" badges, its network and code, and only what it measures, with a note that its index is based on fine dust only (#22).
- **Data info** ([data-info.tsx](components/air/data-info.tsx)): an ⓘ button next to "Overzicht Nederland" opens a dialog. It shows how many official stations and citizen sensors are on the map, where each comes from (Luchtmeetnet, RIVM Samen Meten), the number of sensor networks and the three largest, all counted from the loaded stations.
- **Chart** ([station-chart.tsx](components/air/station-chart.tsx)):
  - Tabs for the pollutant (only those the station measures) and the period: 24 hours (hourly line) or 7 days (daily-mean bars).
  - The WHO guideline is a dashed reference line. Missing hours show as gaps, and the tooltip shows how many hours went into each daily mean.
  - A screen-reader table repeats the values.
  - Data comes from `GET /api/stations/[id]/history` ([route](app/api/stations/[id]/history/route.ts)), which calls `getStationHistory()`, cached for 5 minutes. Daily means use Europe/Amsterdam days. The window ends at the last hour the collector should already have stored (20 minutes past the hour).
- **Search** ([map-search.tsx](components/air/map-search.tsx), [lib/geocode.ts](lib/geocode.ts)):
  - Finds stations by name, code or municipality, plus addresses, streets, postcodes, places and municipalities through PDOK Locatieserver's `suggest` endpoint. Only `suggest` handles half-typed words, and it returns coordinates via `fl=centroide_ll`.
  - The browser calls PDOK directly: the API is public and allows CORS, and what people type goes to a Dutch government service.
  - Choosing a place pins it, selects the nearest station, zooms to show both, and shows the distance in the panel.
- **Scales, names and Dutch formatting:** [lib/air-quality.ts](lib/air-quality.ts). LKI colors per decision #23.
- **Theme tokens:** the Fyka base colors and the sky accent are mapped onto shadcn's variables in [app/globals.css](app/globals.css), with extra `brand-text`, `brand-soft`, `steel`, `ok` and `warn` colors.

### Environment variables

Set these in `.env.local` locally and in Vercel's project settings. [.env.example](.env.example) shows the format.

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://uoocwxpfujiwfrhkkskb.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The project's publishable key (`sb_publishable_...`). It only allows reads. |

### Next steps

Updated 2026-10-07. Pick up here in a new session.

1. **Launch:** push to GitHub, deploy to Vercel with the environment variables below, and add Fyka Watch analytics (#13).
2. **Check the new Samen Meten schedule** (#24): the :40 sweep should now store about 3,400 rows per hour (`select * from net._http_response order by created desc`). If it often stores far fewer than the :55 re-sweep, calibrated values arrive later than :40 and the sweep should move later.
3. **Check the RIVM area layer in use** (#26): look at it in light and dark mode and on a phone, tune its opacity (`OPACITY` in rivm-layer.tsx), and after launch check the proxy's CDN hit rate and RIVM errors (502s) in the Vercel logs.
4. **Check the database size** about a week after 2026-10-05 (see the storage estimate).
5. **The rest of the open points** below.
6. **Later:** move to EU infrastructure (#4).

### Open points

- **Freshness dot for official stations:** Luchtmeetnet publishes about 10 minutes after the hour and its collector runs at :15, so readings are up to 75 minutes old and the "amber after 1 hour" rule triggers in the last quarter of every hour. Consider 90 minutes. (Citizen sensors have their own windows, #25.)
- **Supabase free-tier pausing:** free projects are paused after a period of inactivity. Check whether the collectors' own requests count as activity; if the project gets paused, collection stops.
- **Payload:** the page sends about 2,200 stations with their readings to the browser. If it gets slow, send a slim list for the map and load details on click.
- **MapLibre worker:** mapcn loads MapLibre's web worker from unpkg. Self-host it from `public/` once we move toward EU infrastructure.

## Collector design

- **Idempotent writes.** Upsert on `(source, datastream/station, timestamp)`, so re-sweeping an hour is safe.
- **Luchtmeetnet** (built: [supabase/functions/collect-luchtmeetnet](supabase/functions/collect-luchtmeetnet/))
  - Every hour at :15, fetch `/measurements` and `/lki` for the **last 3 hours**, so missed runs catch up. That's about 1,500 rows in about 3 requests.
  - Refresh details for up to 20 stations per run, oldest first and 1 s apart. That's about 23 requests per run, well under the limit, and every station gets refreshed daily.
  - Tolerate connection resets by retrying with backoff.
- **Samen Meten** (built: [supabase/functions/collect-samenmeten](supabase/functions/collect-samenmeten/), testable with `npm run check:samenmeten`)
  - **:40:** sweep the previous hour (`hoursAgo: 1`). Its calibrated values are published by then; the current hour only has raw values (#24).
  - **:55:** sweep the previous hour again, to retry a failed :40 run and pick up late values.
  - **:05:** "things" mode. When any sensor's details are missing or more than 7 days old, fetch the full Thing inventory (about 8 s, 300 ms of CPU) and update every known sensor in one call.
  - **Each sweep:** about 70 s and 300 ms of CPU, within the Edge Function's 150 s / 2 s limits. Writes about 3,400 rows, then runs `compute_citizen_lki` for that hour.
  - Never sweep an hour that's still being filled.
  - Retry a 504 once; a second 504 means the end of the data.
  - Calibrated PM (`pm25_kal`, `pm10_kal`), `no2` and `nh3` are stored; negative values are dropped.
  - The function also accepts `{"mode": "sweep", "hour": "<ISO>"}` for backfills.
- **General**
  - Run requests one after another, never in parallel.
  - Store timestamps in UTC as the **end** of the measured hour, and convert to `Europe/Amsterdam` only for display.
  - Skip Things without a location or outside the Netherlands.
