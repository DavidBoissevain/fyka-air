// Air quality scales, names and formatting, following docs/design/huisstijl.html.

export type Quantity = "pm25" | "pm10" | "no2" | "o3" | "nh3" | "lki";

export type Reading = { value: number; measured_at: string };

export type StationReading = {
  id: number;
  source: "luchtmeetnet" | "samenmeten";
  external_id: string;
  kind: "professional" | "citizen";
  name: string | null;
  organisation: string | null;
  municipality: string | null;
  longitude: number;
  latitude: number;
  // Luchtmeetnet: type, components. Samen Meten: network, project, owner, reference stations.
  details: {
    type?: string | null;
    components?: string[];
    network?: string | null;
    project?: string | null;
    reference?: { pm25?: string | null; pm10?: string | null; no2?: string | null };
  };
  measured_at: string;
  readings: Partial<Record<Quantity, Reading>>;
};

export const CHART_QUANTITIES = ["pm25", "pm10", "no2", "o3"] as const;
export type ChartQuantity = (typeof CHART_QUANTITIES)[number];

export type StationHistory = {
  // Last 24 hours, oldest first. t is the end of the hour (ISO, UTC).
  hourly: Partial<Record<ChartQuantity, { t: string; v: number | null }[]>>;
  // Last 7 days (Europe/Amsterdam), oldest first, with the number of hours averaged.
  daily: Partial<Record<ChartQuantity, { day: string; v: number | null; hours: number }[]>>;
};

// LKI colours, one per index 1–11 (decision #23 in TECHNICAL.md): the house
// style's own scale, from deep blue to purple, close in look to RIVM Samen
// Meten's map. It does not copy Luchtmeetnet's 5-colour legend.
export const LKI_COLORS = [
  { bg: "#0A3FC2", fg: "#FFFFFF" },
  { bg: "#2F74F0", fg: "#FFFFFF" },
  { bg: "#8EC2FF", fg: "#0B1B3A" },
  { bg: "#FFF3A6", fg: "#3A3000" },
  { bg: "#FFD84D", fg: "#3A3000" },
  { bg: "#FFB000", fg: "#3A2400" },
  { bg: "#FF7A1A", fg: "#2E1200" },
  { bg: "#F04A1E", fg: "#FFFFFF" },
  { bg: "#D21F3C", fg: "#FFFFFF" },
  { bg: "#A3122E", fg: "#FFFFFF" },
  { bg: "#7E2BB8", fg: "#FFFFFF" },
] as const;

// Thin grey outline around LKI marks, so pale colours stay visible on a light map.
export const LKI_OUTLINE = { light: "#8C939D", dark: "#64748B" } as const;

// Stations without an index, in Luchtmeetnet's "Geen data beschikbaar" grey.
export const NO_INDEX_COLOR = "#70757F";

export const LKI_CATEGORIES = [
  // color: the middle step of the category, for category-level marks like the overview bars.
  { name: "Goed", from: 1, to: 3, color: "#2F74F0", advice: "Geen klachten te verwachten. Ga gerust naar buiten." },
  { name: "Matig", from: 4, to: 6, color: "#FFD84D", advice: "Mensen die gevoelig zijn voor luchtvervuiling kunnen klachten merken." },
  { name: "Onvoldoende", from: 7, to: 8, color: "#FF7A1A", advice: "Gevoelige mensen beperken zware inspanning buiten beter." },
  { name: "Slecht", from: 9, to: 10, color: "#D21F3C", advice: "Iedereen kan klachten krijgen. Beperk zware inspanning buiten." },
  { name: "Zeer slecht", from: 11, to: 11, color: "#7E2BB8", advice: "Vermijd zware inspanning buiten. Gevoelige mensen blijven beter binnen." },
] as const;

export function lkiIndex(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.min(11, Math.max(1, Math.round(value)));
}

export function lkiColor(index: number | null) {
  return index ? LKI_COLORS[index - 1] : null;
}

export function lkiCategory(index: number) {
  return LKI_CATEGORIES.find((c) => index <= c.to) ?? LKI_CATEGORIES[4];
}

// Pollutants with an LKI sub-index and an RIVM map layer.
export const BAND_QUANTITIES = ["pm25", "pm10", "no2", "o3"] as const;
export type BandQuantity = (typeof BAND_QUANTITIES)[number];

// LKI sub-index class edges in µg/m³: a value below the i-th edge gets index
// i (1-based), above the last 11. The same as lki_sub_index() in the database
// (migration 20261005192736, decision #22); the category bounds also match
// RIVM's own map styles (decision #27).
export const SUB_INDEX_EDGES: Record<BandQuantity, readonly number[]> = {
  pm25: [10, 15, 20, 30, 40, 50, 70, 90, 100, 140],
  pm10: [10, 20, 30, 45, 60, 75, 100, 125, 150, 200],
  no2: [10, 20, 30, 45, 60, 75, 100, 125, 150, 200],
  o3: [15, 30, 40, 60, 80, 100, 140, 180, 200, 240],
};

export function subIndex(quantity: BandQuantity, value: number | undefined | null) {
  if (value == null || !Number.isFinite(value)) return null;
  const i = SUB_INDEX_EDGES[quantity].findIndex((edge) => value < edge);
  return i === -1 ? 11 : i + 1;
}

// RIVM's map LKI is continuous (3.74); Luchtmeetnet rounds it up to the index.
export function lkiIndexFromContinuous(value: number | undefined | null) {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.min(11, Math.max(1, Math.ceil(value)));
}

// Upper bound per category, for "Goed tot 20 · Matig tot 50 · …".
export function categoryRanges(quantity: BandQuantity) {
  const edges = SUB_INDEX_EDGES[quantity];
  return LKI_CATEGORIES.map((c) => ({ name: c.name, upTo: c.to < 11 ? edges[c.to - 1] : null }));
}

// What the map colours by: the area layer (RIVM, decision #26) and the dots.
// "off" hides the area and colours the dots by LKI. Ordered by importance for
// health (decision #28): the overall index first, then PM2.5, NO2, O3, PM10.
export const MAP_LAYERS = [
  {
    id: "lki",
    label: "Luchtkwaliteitsindex",
    tag: "Totaalbeeld",
    hint: "Begin hier: alle stoffen samen, met advies per niveau.",
    legend: "Luchtkwaliteitsindex",
  },
  {
    id: "pm25",
    label: "Fijnstof (PM2,5)",
    tag: "Grootste gezondheidsrisico",
    hint: "Kleine deeltjes die diep in je longen en bloed komen.",
    legend: "Fijnstof PM2,5 per uur, in µg/m³",
  },
  {
    id: "no2",
    label: "Stikstofdioxide (NO₂)",
    tag: "Verkeer",
    hint: "Vooral langs drukke wegen. Belangrijk bij astma.",
    legend: "Stikstofdioxide NO₂ per uur, in µg/m³",
  },
  {
    id: "o3",
    label: "Ozon (O₃)",
    tag: "Zomersmog",
    hint: "Hoog op warme, zonnige middagen. Let op bij buiten sporten.",
    legend: "Ozon O₃ per uur, in µg/m³",
  },
  {
    id: "pm10",
    label: "Fijnstof (PM10)",
    tag: "Grover stof",
    hint: "Prikkelt neus, keel en luchtwegen.",
    legend: "Fijnstof PM10 per uur, in µg/m³",
  },
  {
    id: "off",
    label: "Alleen meetpunten",
    tag: null,
    hint: "Alleen de metingen, zonder gekleurd gebied.",
    legend: "Luchtkwaliteitsindex",
  },
] as const;
export type MapLayer = (typeof MAP_LAYERS)[number]["id"];
export type AreaLayer = Exclude<MapLayer, "off">;

// WHO 2021 guideline values in µg/m³ (24-hour mean; 8-hour mean for O₃).
export const WHO_GUIDELINE: Partial<Record<Quantity, number>> = {
  pm25: 15,
  pm10: 45,
  no2: 25,
  o3: 100,
};

export const QUANTITY_NAMES: Record<Quantity, string> = {
  pm25: "PM2,5",
  pm10: "PM10",
  no2: "NO₂",
  o3: "O₃",
  nh3: "NH₃",
  lki: "LKI",
};

// Display name: official stations have a location name; citizen sensors only a code.
export function stationTitle(station: Pick<StationReading, "kind" | "name" | "external_id">) {
  return station.kind === "citizen" ? "Burgersensor" : station.name ?? station.external_id;
}

export const STATION_TYPES: Record<string, string> = {
  Municipal: "Stedelijke achtergrond",
  Regional: "Regionale achtergrond",
  Traffic: "Verkeer",
  Industrial: "Industrie",
};

const TIME_ZONE = "Europe/Amsterdam";

export function formatNumber(value: number, decimals = 1) {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

// Calendar day (YYYY-MM-DD) in Amsterdam of the hour that ends at `iso`.
// The hour ending at 00:00 still belongs to the previous day.
export function amsterdamDay(iso: string) {
  return new Date(Date.parse(iso) - 60_000).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// "ma 5 okt"
export function formatDay(day: string, withDate = false) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "short",
    ...(withDate ? { day: "numeric", month: "short" } : {}),
    timeZone: TIME_ZONE,
  });
}

// "23 min geleden", "2 uur geleden"
export function formatAge(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return minutes < 60 ? `${minutes} min geleden` : `${Math.floor(minutes / 60)} uur geleden`;
}

// Calibrated citizen-sensor values arrive about 2 hours after the hour they
// cover, because the RIVM calibrates them first (decision #25 in TECHNICAL.md).
export const CITIZEN_DELAY_HOURS = 2;

const HOUR_MS = 60 * 60 * 1000;

// Late (amber dot): over an hour past the source's normal delay, or, for a
// citizen sensor, behind the newest Samen Meten hour on the map.
export function isLate(iso: string, now: number, citizen?: { newest: string | null }) {
  const measured = Date.parse(iso);
  if (now - measured >= (1 + (citizen ? CITIZEN_DELAY_HOURS : 0)) * HOUR_MS) return true;
  return citizen?.newest != null && measured < Date.parse(citizen.newest);
}
