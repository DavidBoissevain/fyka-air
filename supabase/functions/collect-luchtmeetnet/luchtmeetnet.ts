// Luchtmeetnet open API client. No imports, so it runs in Deno (Edge Function)
// and in Node (scripts/check-luchtmeetnet-client.mts).
// API notes and limits: TECHNICAL.md, "Luchtmeetnet".

const BASE = "https://api.luchtmeetnet.nl/open_api";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

// Luchtmeetnet formula -> our quantity. Other components are ignored.
const QUANTITIES: Record<string, string> = {
  PM25: "pm25",
  PM10: "pm10",
  NO2: "no2",
  O3: "o3",
  NH3: "nh3",
  LKI: "lki",
};

export type MeasurementRow = {
  station: string;
  quantity: string;
  measured_at: string;
  value: number;
};

export type StationDetails = {
  name: string | null;
  organisation: string | null;
  municipality: string | null;
  longitude: number | null;
  latitude: number | null;
  details: { type: string | null; components: string[]; province: string | null };
};

type Page<T> = { pagination: { last_page: number }; data: T[] };

type ApiMeasurement = {
  station_number: string;
  formula: string;
  value: number | null;
  timestamp_measured: string;
};

type ApiStation = {
  location?: string;
  organisation?: string;
  municipality?: string | null;
  province?: string | null;
  type?: string;
  components?: string[];
  geometry?: { coordinates?: [number, number] };
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries network errors (the API sometimes resets connections), 429 and 5xx.
async function getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 1; ; attempt++) {
    let problem: string;
    let retryable = true;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.ok) return (await res.json()) as T;
      problem = `HTTP ${res.status}`;
      retryable = res.status === 429 || res.status >= 500;
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new Error(`${problem} for ${url} after ${attempt} attempt(s)`);
    }
    await sleep(2 ** attempt * 1000);
  }
}

async function getAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const body = await getJson<Page<T>>(path, { ...params, page: String(page) });
    all.push(...body.data);
    if (page >= body.pagination.last_page) return all;
  }
}

function isoSeconds(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Hourly measurements and LKI with timestamp_measured in [start, end].
// timestamp_measured is the end of the measured hour.
export async function fetchMeasurements(start: Date, end: Date): Promise<MeasurementRow[]> {
  const params = { start: isoSeconds(start), end: isoSeconds(end) };
  const raw = [
    ...(await getAll<ApiMeasurement>("/measurements", params)),
    ...(await getAll<ApiMeasurement>("/lki", params)),
  ];
  const rows = new Map<string, MeasurementRow>();
  for (const m of raw) {
    const quantity = QUANTITIES[m.formula];
    if (!quantity || typeof m.value !== "number" || !Number.isFinite(m.value)) continue;
    const measuredAt = new Date(m.timestamp_measured).toISOString();
    rows.set(`${m.station_number}|${quantity}|${measuredAt}`, {
      station: m.station_number,
      quantity,
      measured_at: measuredAt,
      value: m.value,
    });
  }
  return [...rows.values()];
}

export async function fetchStationDetails(stationNumber: string): Promise<StationDetails> {
  const { data } = await getJson<{ data: ApiStation }>(`/stations/${encodeURIComponent(stationNumber)}`);
  const [longitude, latitude] = data.geometry?.coordinates ?? [null, null];
  return {
    name: data.location?.trim() || null,
    organisation: data.organisation?.trim() || null,
    municipality: data.municipality?.trim() || null,
    longitude: typeof longitude === "number" ? longitude : null,
    latitude: typeof latitude === "number" ? latitude : null,
    details: {
      type: data.type ?? null,
      components: data.components ?? [],
      province: data.province ?? null,
    },
  };
}
