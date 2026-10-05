/**
 * Probes the Luchtmeetnet open API (official measuring stations) to size the
 * hourly collector for professional stations.
 *
 * Answers: how many stations exist, which components they measure in a
 * recent hour, and how many requests an hourly sweep costs against the
 * fair-use limit.
 *
 * Run: npm run probe:luchtmeetnet
 */

export {};

const BASE = "https://api.luchtmeetnet.nl/open_api";
const RATE_LIMIT = "100 requests per 5 minutes";
const REQUEST_TIMEOUT_MS = 30_000;

type Page<T> = { pagination: { current_page: number; last_page: number }; data: T[] };

type Station = { number: string; location: string };

type Measurement = {
  station_number: string;
  formula: string;
  value: number;
  timestamp_measured: string;
};

let requests = 0;

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  requests++;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function getAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const body = await getJson<Page<T>>(path, { ...params, page: String(page) });
    all.push(...body.data);
    if (page >= body.pagination.last_page) return all;
  }
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function main() {
  console.log(`Probing ${BASE} at ${new Date().toISOString()}\n`);

  const stationsStart = performance.now();
  const stations = await getAll<Station>("/stations", {});
  console.log(`1. ${stations.length} stations in ${seconds(performance.now() - stationsStart)} (${requests} requests)\n`);

  // timestamp_measured is the END of the measured hour, so the latest
  // complete hour is labelled with the current hour.
  const hour = new Date();
  hour.setUTCMinutes(0, 0, 0);
  const iso = hour.toISOString().replace(".000", "");
  const before = requests;
  const sweepStart = performance.now();
  const measurements = await getAll<Measurement>("/measurements", { start: iso, end: iso });
  const lki = await getAll<Measurement>("/lki", { start: iso, end: iso });
  const sweepRequests = requests - before;
  console.log(
    `2. Hour ending ${iso}: ${measurements.length} measurements + ${lki.length} LKI values ` +
      `in ${seconds(performance.now() - sweepStart)} (${sweepRequests} requests)`,
  );

  const byFormula = new Map<string, Set<string>>();
  for (const m of [...measurements, ...lki]) {
    if (!byFormula.has(m.formula)) byFormula.set(m.formula, new Set());
    byFormula.get(m.formula)!.add(m.station_number);
  }
  console.table(
    [...byFormula]
      .map(([formula, s]) => ({ formula, stations: s.size }))
      .sort((a, b) => b.stations - a.stations),
  );

  const reporting = new Set(measurements.map((m) => m.station_number)).size;
  console.log(`3. ${reporting} of ${stations.length} stations reported this hour.`);
  console.log(
    `   An hourly sweep costs ~${sweepRequests} requests (limit: ${RATE_LIMIT}). ` +
      `Station details (location, components) cost 1 request per station, so refresh them daily and throttled.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
