/**
 * Probes the RIVM Samen Meten API to size the hourly collector.
 *
 * Answers: how many sensors exist, how many are active, how to tell
 * professional stations from citizen sensors, how long a sweep of one
 * hour of observations takes, and how much data we'd store.
 *
 * Run: npm run probe:samenmeten
 * Requests are sequential on purpose; be polite to RIVM's infrastructure.
 */

export {};

const BASE = "https://api-samenmeten.rivm.nl/v1.0";
const PAGE_SIZE = 200; // server caps $top at 200
const STALE_HOURS = 3; // decision #15
const HOURS_TO_SWEEP = STALE_HOURS + 1; // include the current, possibly incomplete hour
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 4;
const STORED_QUANTITIES = ["pm25_kal", "pm10_kal", "no2", "nh3"];
const ROUGH_BYTES_PER_ROW = 80; // row + index overhead in Postgres, rough

type Page<T> = { value: T[]; "@iot.nextLink"?: string };

type Thing = {
  "@iot.id": number;
  name: string;
  properties: Record<string, string | null> | null;
  Locations?: { location: { type: string; coordinates: [number, number] } }[];
};

type Observation = {
  phenomenonTime: string;
  result: number;
  Datastream: { "@iot.id": number; name: string };
};

type Stats = { requests: number; ms: number; maxMs: number; retries: number };

const stats: Record<string, Stats> = {};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The server answers 504 after ~30s instead of an empty page when a filter
// matches no rows (an hour not yet published, or $skip past the end), but it
// also throws transient 504s. With `emptyOn504`, a 504 is retried once and a
// second 504 returns null, meaning "no more data".
async function getJson<T>(url: string, label: string, emptyOn504 = false): Promise<T | null> {
  const s = (stats[label] ??= { requests: 0, ms: 0, maxMs: 0, retries: 0 });
  for (let attempt = 1; ; attempt++) {
    const start = performance.now();
    let problem: string;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const ms = performance.now() - start;
      if (res.ok || (emptyOn504 && res.status === 504 && attempt >= 2)) {
        s.requests++;
        s.ms += ms;
        s.maxMs = Math.max(s.maxMs, ms);
        return res.ok ? ((await res.json()) as T) : null;
      }
      problem = `HTTP ${res.status}`;
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    if (attempt >= MAX_ATTEMPTS) throw new Error(`${label}: ${problem} after ${attempt} attempts (${url})`);
    s.retries++;
    console.warn(`  ${label}: ${problem}, retrying (${attempt}/${MAX_ATTEMPTS - 1})`);
    await sleep(2 ** attempt * 1000);
  }
}

// The server's @iot.nextLink drops $select, so page with $skip ourselves.
async function getAll<T>(
  path: string,
  params: Record<string, string>,
  label: string,
  emptyOn504 = false,
): Promise<{ items: T[]; timedOut: boolean }> {
  const items: T[] = [];
  let timedOut = false;
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const query = new URLSearchParams({ ...params, $top: String(PAGE_SIZE), $skip: String(skip) });
    const page = await getJson<Page<T>>(`${BASE}${path}?${query}`, label, emptyOn504);
    if (!page) {
      timedOut = true;
      break;
    }
    items.push(...page.value);
    process.stdout.write(`\r  ${label}: ${items.length}`);
    if (page.value.length < PAGE_SIZE) break;
  }
  process.stdout.write("\n");
  return { items, timedOut };
}

// "LTD_94370" -> "LTD", "NL10444" -> "NL"
function prefixOf(thingName: string) {
  return thingName.match(/^[A-Za-z]+/)?.[0] ?? "?";
}

// "LTD_94370-2-pm25_kal" -> { thing: "LTD_94370", quantity: "pm25_kal" }
function parseDatastreamName(name: string) {
  const parts = name.split("-");
  return { thing: parts.slice(0, -2).join("-"), quantity: parts.at(-1) ?? "?" };
}

function countBy<T>(items: Iterable<T>, key: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return new Map([...counts].sort((a, b) => b[1] - a[1]));
}

function hourStart(hoursAgo: number) {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() - hoursAgo);
  return d;
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number) {
  return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
}

async function main() {
  console.log(`Probing ${BASE} at ${new Date().toISOString()}\n`);

  // 1. Inventory of all sensors (Things) with their location.
  console.log("1. Sensor inventory");
  const inventoryStart = performance.now();
  const { items: things } = await getAll<Thing>(
    "/Things",
    { $select: "id,name,properties", $expand: "Locations($select=location)", $orderby: "id" },
    "things",
  );
  const inventoryMs = performance.now() - inventoryStart;
  const thingsByName = new Map(things.map((t) => [t.name, t]));
  const withoutLocation = things.filter((t) => !t.Locations?.length).length;
  const outsideNl = things.filter((t) => {
    const c = t.Locations?.[0]?.location?.coordinates;
    return c && (c[0] < 3.2 || c[0] > 7.3 || c[1] < 50.7 || c[1] > 53.6);
  }).length;
  console.log(`  ${things.length} sensors in ${seconds(inventoryMs)}`);
  console.log(`  ${withoutLocation} without a location, ${outsideNl} located outside the Netherlands' bounding box\n`);

  // 2. One sweep per recent hour, filtering observations by exact phenomenonTime.
  console.log(`2. Observation sweeps (last ${HOURS_TO_SWEEP} hours, UTC)`);
  const sweeps: { hour: Date; observations: Observation[]; ms: number; duplicates: number; timedOut: boolean }[] = [];
  for (let hoursAgo = 0; hoursAgo < HOURS_TO_SWEEP; hoursAgo++) {
    const hour = hourStart(hoursAgo);
    const start = performance.now();
    const { items: raw, timedOut } = await getAll<Observation>(
      "/Observations",
      {
        $select: "phenomenonTime,result",
        $filter: `phenomenonTime eq ${hour.toISOString()}`,
        $expand: "Datastream($select=id,name)",
      },
      `obs ${hour.toISOString().slice(0, 13)}h`,
      true,
    );
    const ms = performance.now() - start;
    // Paging without $orderby can repeat rows; keep one per datastream.
    const unique = [...new Map(raw.map((o) => [o.Datastream["@iot.id"], o])).values()];
    sweeps.push({ hour, observations: unique, ms, duplicates: raw.length - unique.length, timedOut });
  }
  console.table(
    sweeps.map((s) => ({
      hour: s.hour.toISOString().slice(0, 16),
      observations: s.observations.length,
      endedWith504: s.timedOut,
      duplicatesDropped: s.duplicates,
      sensors: new Set(s.observations.map((o) => parseDatastreamName(o.Datastream.name).thing)).size,
      sweepTime: seconds(s.ms),
    })),
  );

  // 3. Active sensors: any observation within the stale window.
  const activeQuantities = new Map<string, Set<string>>();
  for (const s of sweeps) {
    for (const o of s.observations) {
      const { thing, quantity } = parseDatastreamName(o.Datastream.name);
      if (!activeQuantities.has(thing)) activeQuantities.set(thing, new Set());
      activeQuantities.get(thing)!.add(quantity);
    }
  }
  const unknownActive = [...activeQuantities.keys()].filter((name) => !thingsByName.has(name)).length;

  console.log(`\n3. Sensors by network prefix (active = reading in the last ${STALE_HOURS} hours)`);
  const totalByPrefix = countBy(things, (t) => prefixOf(t.name));
  const activeByPrefix = countBy(activeQuantities.keys(), prefixOf);
  console.table(
    [...totalByPrefix].map(([prefix, total]) => {
      const sample = things.filter((t) => prefixOf(t.name) === prefix);
      const owners = countBy(sample, (t) => t.properties?.owner ?? "-");
      const projects = countBy(sample, (t) => t.properties?.project ?? "-");
      return {
        prefix,
        total,
        active: activeByPrefix.get(prefix) ?? 0,
        example: sample[0].name,
        owners: [...owners.keys()].slice(0, 3).join(", "),
        projects: [...projects.keys()].slice(0, 3).join(", "),
      };
    }),
  );
  if (unknownActive) console.log(`  ${unknownActive} active sensors not found in the inventory`);

  console.log(`\n4. Active sensors per quantity`);
  const quantityCounts = countBy(
    [...activeQuantities.values()].flatMap((q) => [...q]),
    (q) => q,
  );
  console.table([...quantityCounts].map(([quantity, sensors]) => ({ quantity, sensors })));

  // 5. Storage and runtime estimates, based on the fullest complete hour.
  const fullest = sweeps.slice(1).reduce((a, b) => (b.observations.length > a.observations.length ? b : a));
  const storedPerHour = fullest.observations.filter((o) =>
    STORED_QUANTITIES.includes(parseDatastreamName(o.Datastream.name).quantity),
  ).length;
  const allPerHour = fullest.observations.length;
  console.log(`\n5. Estimates (from ${fullest.hour.toISOString().slice(0, 16)}, ~${ROUGH_BYTES_PER_ROW} bytes per row)`);
  console.table(
    [
      { scope: `stored quantities (${STORED_QUANTITIES.join(", ")})`, perHour: storedPerHour },
      { scope: "all quantities", perHour: allPerHour },
    ].map(({ scope, perHour }) => ({
      scope,
      rowsPerHour: perHour,
      rowsPerDay: perHour * 24,
      "30 days": formatBytes(perHour * 24 * 30 * ROUGH_BYTES_PER_ROW),
      "90 days": formatBytes(perHour * 24 * 90 * ROUGH_BYTES_PER_ROW),
    })),
  );
  console.log(`  One hourly sweep took ${seconds(fullest.ms)}; the full sensor inventory took ${seconds(inventoryMs)}.`);

  console.log("\n6. Request timings");
  console.table(
    Object.entries(stats).map(([label, s]) => ({
      label,
      requests: s.requests,
      avg: seconds(s.ms / s.requests),
      max: seconds(s.maxMs),
      retries: s.retries,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
