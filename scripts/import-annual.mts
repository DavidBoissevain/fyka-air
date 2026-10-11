/**
 * Computes annual averages per official station from Luchtmeetnet's validated
 * yearly files and writes them as a data migration for public.station_annual
 * (TECHNICAL.md, decision #41).
 *
 * Source: https://data.rivm.nl/data/luchtmeetnet/Vastgesteld-jaar/<year>/<year>_{NO2,PM25}.csv
 * (about 100 MB each). Downloads are kept in .cache/luchtmeetnet/, so a rerun
 * only fetches what's missing.
 *
 * Method, per station, pollutant and year:
 * - Rows are hourly ("uur") or, for PM2.5 before 2015, daily ("dag") values.
 *   The duration that covers the most time is used, so a year is never a mix.
 * - Values for the same start time (parallel instruments, an instrument
 *   change) are averaged first, so no hour counts twice.
 * - mean is the average over those periods; hours is the time they cover
 *   (a day counts 24). The app shows a value only from 75% of the year.
 *
 * Run: npm run import:annual -- --from 2012 --to 2025 [--out <file.sql>]
 * Then apply the written migration (supabase/migrations/).
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASE = "https://data.rivm.nl/data/luchtmeetnet/Vastgesteld-jaar";
const CACHE = join(".cache", "luchtmeetnet");
// File component name → our quantity.
const COMPONENTS = { NO2: "no2", PM25: "pm25" } as const;
const DURATION_HOURS: Record<string, number> = { uur: 1, dag: 24 };
const MIN_COVERAGE = 0.75;
const SPOT_CHECK = "NL49017"; // Amsterdam-Stadhouderskade

type Row = { externalId: string; quantity: string; year: number; mean: number; hours: number };

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? fallback : process.argv[i + 1];
  if (value === undefined) throw new Error(`Missing --${name}`);
  return value;
}

const hoursInYear = (year: number) => ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 8784 : 8760);

async function download(year: number, component: string) {
  const file = join(CACHE, `${year}_${component}.csv`);
  if (existsSync(file)) return file;
  const url = `${BASE}/${year}/${year}_${component}.csv`;
  console.log(`  downloading ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const partial = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(partial));
  renameSync(partial, file);
  return file;
}

// Per station and duration: start time → [sum, count] of the values starting then.
type Periods = Map<string, Map<string, [number, number]>>;

async function stationYears(file: string, year: number, quantity: string): Promise<{ rows: Row[]; skipped: number }> {
  const stations = new Map<string, Periods>();
  let columns: string[] | null = null;
  let skipped = 0;

  const lines = createInterface({ input: createReadStream(file, { encoding: "utf-8" }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const cells = line.split(";");
    if (!columns) {
      columns = cells;
      continue;
    }
    const get = (name: string) => cells[columns!.indexOf(name)];
    const raw = get("waarde");
    if (!raw) continue;
    const duration = get("meetduur");
    if (!(duration in DURATION_HOURS)) {
      skipped++;
      continue;
    }
    const station = get("meetlocatie_id");
    const start = get("begindatumtijd");
    let byDuration = stations.get(station);
    if (!byDuration) stations.set(station, (byDuration = new Map()));
    let periods = byDuration.get(duration);
    if (!periods) byDuration.set(duration, (periods = new Map()));
    const slot = periods.get(start) ?? [0, 0];
    slot[0] += Number(raw);
    slot[1] += 1;
    periods.set(start, slot);
  }

  const rows: Row[] = [];
  for (const [externalId, byDuration] of stations) {
    // The duration that covers the most time.
    let best: { mean: number; hours: number } | null = null;
    for (const [duration, periods] of byDuration) {
      const hours = Math.min(periods.size * DURATION_HOURS[duration], hoursInYear(year));
      if (best && best.hours >= hours) continue;
      let sum = 0;
      for (const [total, count] of periods.values()) sum += total / count;
      best = { mean: sum / periods.size, hours };
    }
    if (best) rows.push({ externalId, quantity, year, mean: best.mean, hours: best.hours });
  }
  return { rows, skipped };
}

function sql(rows: Row[], from: number, to: number) {
  const values = rows
    .sort((a, b) => a.externalId.localeCompare(b.externalId) || a.quantity.localeCompare(b.quantity) || a.year - b.year)
    .map((r) => `  ('${r.externalId}', '${r.quantity}', ${r.year}, ${r.mean.toFixed(2)}, ${r.hours})`)
    .join(",\n");
  return `-- Annual averages ${from}–${to} per official station (TECHNICAL.md, decision #41).
-- Generated by scripts/import-annual.mts from Luchtmeetnet's validated yearly
-- files (${BASE}). Do not edit by hand: rerun
-- npm run import:annual -- --from ${from} --to ${to}
-- Stations we don't know (closed before our collector started) drop out at the join.

insert into public.station_annual (station_id, quantity, year, mean, hours)
select s.id, v.quantity, v.year::smallint, v.mean::real, v.hours::integer
from (values
${values}
) as v (external_id, quantity, year, mean, hours)
join public.stations s on s.source = 'luchtmeetnet' and s.external_id = v.external_id
on conflict (station_id, quantity, year) do update
  set mean = excluded.mean, hours = excluded.hours;
`;
}

async function main() {
  const from = Number(arg("from"));
  const to = Number(arg("to", String(from)));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) throw new Error("Use --from <year> --to <year>");
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const out = arg("out", join("supabase", "migrations", `${stamp}_station_annual_${from}_${to}.sql`));
  mkdirSync(CACHE, { recursive: true });

  const all: Row[] = [];
  for (let year = from; year <= to; year++) {
    for (const [component, quantity] of Object.entries(COMPONENTS)) {
      const file = await download(year, component);
      const { rows, skipped } = await stationYears(file, year, quantity);
      all.push(...rows);
      const enough = rows.filter((r) => r.hours / hoursInYear(year) >= MIN_COVERAGE).length;
      const spot = rows.find((r) => r.externalId === SPOT_CHECK);
      console.log(
        `${year} ${component.padEnd(4)} ${String(rows.length).padStart(3)} stations, ${String(enough).padStart(3)} with ≥ ${MIN_COVERAGE * 100}%` +
          (spot ? ` · ${SPOT_CHECK} ${spot.mean.toFixed(1)} (${Math.round((spot.hours / hoursInYear(year)) * 100)}%)` : "") +
          (skipped ? ` · ${skipped} rows with another duration skipped` : ""),
      );
    }
  }

  writeFileSync(out, sql(all, from, to));
  console.log(`\nWrote ${all.length} station-years to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
