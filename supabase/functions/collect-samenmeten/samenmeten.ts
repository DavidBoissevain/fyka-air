// RIVM Samen Meten (SensorThings API) client. No imports, so it runs in Deno
// (Edge Function) and in Node (scripts/check-samenmeten-client.mts).
// API quirks and the sweep strategy: TECHNICAL.md, "RIVM Samen Meten".

const BASE = "https://api-samenmeten.rivm.nl/v1.0";
const PAGE_SIZE = 200; // the server caps $top at 200
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

// Samen Meten datastream quantity -> our quantity. Raw PM is not stored (decision #19).
const QUANTITIES: Record<string, string> = {
  pm25_kal: "pm25",
  pm10_kal: "pm10",
  no2: "no2",
  nh3: "nh3",
};

// Rough bounding box of the Netherlands; sensors outside it are skipped.
const NL = { minLon: 3.2, maxLon: 7.3, minLat: 50.7, maxLat: 53.6 };

export type MeasurementRow = {
  station: string;
  quantity: string;
  measured_at: string;
  value: number;
};

export type StationDetailsRow = {
  external_id: string;
  name: null;
  organisation: string | null;
  municipality: null;
  longitude: number | null;
  latitude: number | null;
  details: Record<string, unknown>;
};

type Observation = { result: number; Datastream: { "@iot.id": number; name: string } };

type Thing = {
  name: string;
  properties: Record<string, string | null> | null;
  Locations?: { location?: { coordinates?: [number, number] } }[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The server answers 504 after ~30 s instead of an empty page when a filter
// matches no rows, and also throws transient 504s. With `emptyOn504`, a 504 is
// retried once and a second one returns null, meaning "no more data".
async function getPage<T>(url: string, emptyOn504: boolean): Promise<T[] | null> {
  for (let attempt = 1; ; attempt++) {
    let problem: string;
    let retryable = true;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.ok) return ((await res.json()) as { value: T[] }).value;
      problem = `HTTP ${res.status}`;
      if (res.status === 504 && emptyOn504 && attempt >= 2) return null;
      retryable = res.status === 429 || res.status >= 500;
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    if (!retryable || attempt >= MAX_ATTEMPTS) throw new Error(`${problem} for ${url} after ${attempt} attempt(s)`);
    await sleep(2000 * attempt);
  }
}

// @iot.nextLink drops $select, so page with $skip ourselves.
async function getAll<T>(path: string, params: Record<string, string>, emptyOn504 = false) {
  const items: T[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const query = new URLSearchParams({ ...params, $top: String(PAGE_SIZE), $skip: String(skip) });
    const page = await getPage<T>(`${BASE}${path}?${query}`, emptyOn504);
    if (!page) return { items, endedWith504: true };
    items.push(...page);
    if (page.length < PAGE_SIZE) return { items, endedWith504: false };
  }
}

// "LTD_94370-2-pm25_kal" -> { thing: "LTD_94370", quantity: "pm25_kal" }
function parseDatastreamName(name: string) {
  const parts = name.split("-");
  return { thing: parts.slice(0, -2).join("-"), quantity: parts.at(-1) ?? "" };
}

// All observations labelled `hour` (phenomenonTime), mapped to our quantities.
// Only sweep an hour once it is complete; while it is being filled, paging
// returns duplicates and misses rows.
export async function fetchHour(hour: Date): Promise<{ rows: MeasurementRow[]; observations: number }> {
  const measuredAt = hour.toISOString();
  const { items } = await getAll<Observation>(
    "/Observations",
    {
      $select: "result",
      $filter: `phenomenonTime eq ${measuredAt}`,
      $expand: "Datastream($select=id,name)",
    },
    true,
  );

  // One row per datastream; unordered paging can repeat rows.
  const rows = new Map<number, MeasurementRow>();
  for (const o of items) {
    const { thing, quantity } = parseDatastreamName(o.Datastream.name);
    const ours = QUANTITIES[quantity];
    if (!ours || !thing || typeof o.result !== "number" || !Number.isFinite(o.result) || o.result < 0) continue;
    rows.set(o.Datastream["@iot.id"], { station: thing, quantity: ours, measured_at: measuredAt, value: o.result });
  }
  return { rows: [...rows.values()], observations: items.length };
}

// Details for the given sensors (by Thing name), from the full Thing inventory
// (about 12,400 Things, 62 pages, ~10 s). Sensors without a location in the
// Netherlands get null coordinates, so the map leaves them out.
export async function fetchThingDetails(names: Set<string>): Promise<StationDetailsRow[]> {
  const { items } = await getAll<Thing>("/Things", {
    $select: "name,properties",
    $expand: "Locations($select=location)",
    $orderby: "id",
  });
  const rows: StationDetailsRow[] = [];
  for (const thing of items) {
    if (!names.has(thing.name)) continue;
    const p = thing.properties ?? {};
    const [lon, lat] = thing.Locations?.[0]?.location?.coordinates ?? [];
    const inNl =
      typeof lon === "number" && typeof lat === "number" &&
      lon >= NL.minLon && lon <= NL.maxLon && lat >= NL.minLat && lat <= NL.maxLat;
    rows.push({
      external_id: thing.name,
      name: null,
      organisation: p.owner?.trim() || null,
      municipality: null,
      longitude: inNl ? lon : null,
      latitude: inNl ? lat : null,
      details: {
        network: thing.name.match(/^[A-Za-z]+/)?.[0] ?? null,
        project: p.project?.trim() || null,
        owner: p.owner?.trim() || null,
        municipality_code: p.codegemeente ?? null,
        // Luchtmeetnet stations RIVM compares this sensor against.
        reference: { pm25: p.pm25closecode ?? null, pm10: p.pm10closecode ?? null, no2: p.no2closecode ?? null },
      },
    });
  }
  return rows;
}
