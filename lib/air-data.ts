// Server-side reads from Supabase's REST API (PostgREST). Plain fetch keeps
// this portable when we move off Supabase (decision #4 in TECHNICAL.md).
import { cacheLife } from "next/cache";

import {
  CHART_QUANTITIES,
  amsterdamDay,
  type ChartQuantity,
  type StationHistory,
  type StationReading,
} from "@/lib/air-quality";

// New data arrives hourly; refresh every 5 minutes so it shows up soon after.
const HOURLY_DATA = { stale: 300, revalidate: 300, expire: 3600 };
const HOUR = 60 * 60 * 1000;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function rest<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`/rest/v1/${path}`, env("SUPABASE_URL"));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY") } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

// The Data API returns at most 1,000 rows per request; with citizen sensors
// there are about 2,200, so page through them.
const PAGE = 1000;

export async function getStationReadings(): Promise<StationReading[]> {
  "use cache";
  cacheLife(HOURLY_DATA);
  const all: StationReading[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await rest<StationReading[]>("station_readings_now", {
      select: "id,source,external_id,kind,name,organisation,municipality,longitude,latitude,details,measured_at,readings",
      order: "id",
      limit: String(PAGE),
      offset: String(offset),
    });
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

// The last 24 hourly values and the last 7 daily means (Europe/Amsterdam days)
// per pollutant. Hours without a measurement are null, so charts show gaps.
export async function getStationHistory(stationId: number): Promise<StationHistory> {
  "use cache";
  cacheLife(HOURLY_DATA);

  // The collector stores the hour ending at HH:00 at about HH:15, so end the
  // window at the last hour that should already be in.
  const lastHour = new Date(Date.now() - 20 * 60 * 1000);
  lastHour.setUTCMinutes(0, 0, 0);
  const since = new Date(lastHour.getTime() - 7 * 24 * HOUR);

  // At most 4 quantities × 168 hours = 672 rows, under PostgREST's 1,000-row cap.
  const rows = await rest<{ quantity: ChartQuantity; measured_at: string; value: number }[]>("measurements", {
    select: "quantity,measured_at,value",
    station_id: `eq.${stationId}`,
    quantity: `in.(${CHART_QUANTITIES.join(",")})`,
    measured_at: `gt.${since.toISOString()}`,
    order: "measured_at",
  });

  const hours = Array.from({ length: 24 }, (_, i) => new Date(lastHour.getTime() - (23 - i) * HOUR).toISOString());
  // Count back calendar days from today, so DST changes can't skip or repeat a day.
  const [year, month, date] = amsterdamDay(lastHour.toISOString()).split("-").map(Number);
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(year, month - 1, date - (6 - i))).toISOString().slice(0, 10),
  );

  const history: StationHistory = { hourly: {}, daily: {} };
  for (const quantity of CHART_QUANTITIES) {
    const own = rows.filter((r) => r.quantity === quantity);
    if (own.length === 0) continue;

    const byHour = new Map(own.map((r) => [new Date(r.measured_at).toISOString(), r.value]));
    history.hourly[quantity] = hours.map((t) => ({ t, v: byHour.get(t) ?? null }));

    const byDay = new Map<string, number[]>();
    for (const r of own) {
      const day = amsterdamDay(r.measured_at);
      byDay.set(day, [...(byDay.get(day) ?? []), r.value]);
    }
    history.daily[quantity] = days.map((day) => {
      const values = byDay.get(day) ?? [];
      return { day, v: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, hours: values.length };
    });
  }
  return history;
}
