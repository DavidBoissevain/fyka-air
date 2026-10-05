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

// RIVM Luchtkwaliteitsindex 1–11. The hex values are Fyka's own picks in
// RIVM's colour order and still need checking against the official legend.
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

// Map dot colour for stations that report no index.
export const NO_INDEX_COLOR = "#7B93B5";

export const LKI_CATEGORIES = [
  { name: "Goed", from: 1, to: 3, advice: "Geen klachten te verwachten. Ga gerust naar buiten." },
  { name: "Matig", from: 4, to: 6, advice: "Mensen die gevoelig zijn voor luchtvervuiling kunnen klachten merken." },
  { name: "Onvoldoende", from: 7, to: 8, advice: "Gevoelige mensen beperken zware inspanning buiten beter." },
  { name: "Slecht", from: 9, to: 10, advice: "Iedereen kan klachten krijgen. Beperk zware inspanning buiten." },
  { name: "Zeer slecht", from: 11, to: 11, advice: "Vermijd zware inspanning buiten. Gevoelige mensen blijven beter binnen." },
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

export function isLate(iso: string, now: number) {
  return now - Date.parse(iso) >= 60 * 60 * 1000;
}
