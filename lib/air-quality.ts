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
  // color: the middle step of the category, for category-level marks.
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

// RIVM's continuous sub-index: linear within the band, so O3 54.8 in band
// 40–60 gives 3.74. The open top class counts as 11.
export function continuousSubIndex(quantity: BandQuantity, value: number) {
  const edges = [0, ...SUB_INDEX_EDGES[quantity]];
  const i = edges.findIndex((edge) => value < edge);
  if (i === -1) return 11;
  if (i === 0) return 0;
  return i - 1 + (value - edges[i - 1]) / (edges[i] - edges[i - 1]);
}

// RIVM's map LKI is continuous (3.74); Luchtmeetnet rounds it up to the index.
export function lkiIndexFromContinuous(value: number | undefined | null) {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.min(11, Math.max(1, Math.ceil(value)));
}

// Upper bound per category, with its last index (the legend tick sits after that step).
export function categoryRanges(quantity: BandQuantity) {
  const edges = SUB_INDEX_EDGES[quantity];
  return LKI_CATEGORIES.map((c) => ({ name: c.name, to: c.to, upTo: c.to < 11 ? edges[c.to - 1] : null }));
}

// What the map colours by: the area layer (RIVM, decision #26) and the dots.
// Ordered by importance for
// health (decision #28): the overall index first, then PM2.5, NO2, O3, PM10.
// short: the layer button's name on phones; hint: the guide's one line.
export const MAP_LAYERS = [
  {
    id: "lki",
    label: "Luchtkwaliteitsindex",
    short: "Index",
    hint: "Begin hier om de kwaliteit van nu te bepalen: de stof die het slechtst scoort, bepaalt de index.",
    legend: "Luchtkwaliteitsindex",
  },
  {
    id: "pm25",
    label: "Fijnstof (PM2,5)",
    short: "PM2,5",
    hint: "Kleine deeltjes die diep in je longen en bloed komen.",
    legend: "Fijnstof PM2,5 per uur, in µg/m³",
  },
  {
    id: "no2",
    label: "Stikstofdioxide (NO₂)",
    short: "NO₂",
    hint: "Vooral langs drukke wegen. Belangrijk bij astma.",
    legend: "Stikstofdioxide NO₂ per uur, in µg/m³",
  },
  {
    id: "o3",
    label: "Ozon (O₃)",
    short: "O₃",
    hint: "Hoog op warme, zonnige middagen. Let op bij buiten sporten.",
    legend: "Ozon O₃ per uur, in µg/m³",
  },
  {
    id: "pm10",
    label: "Fijnstof (PM10)",
    short: "PM10",
    hint: "Prikkelt neus, keel en luchtwegen.",
    legend: "Fijnstof PM10 per uur, in µg/m³",
  },
] as const;
export type MapLayer = (typeof MAP_LAYERS)[number]["id"];
// Every map layer has an RIVM area layer under the dots.
export type AreaLayer = MapLayer;

// The map's two modes (decision #36): the air of this hour, or the annual average.
export type MapPeriod = "nu" | "jaar";

// Decimals of a clicked spot sent to the point routes: about 100 m for RIVM's
// 125 m hourly grid, 10 m for its 25 m annual grid. The routes only accept
// coordinates rounded like this, so each spot has one URL in the CDN cache.
export const POINT_DECIMALS: Record<MapPeriod, number> = { nu: 3, jaar: 4 };

// The annual view (decisions #36–#39): RIVM's 25 m map of the annual average,
// the one Atlas Leefomgeving shows, in RIVM's own WHO colour scale. Only the
// two pollutants that weigh most for long-term health.
export const ANNUAL_YEAR = 2024;

type AnnualBand = { upTo: number | null; color: string };

// bands: RIVM's style rivm_nsl_{NO2,PM25}_WHO_v3 ("intervals": a value below
// upTo gets that colour; null is the open top band). who and eu2030 are band
// edges: the WHO 2021 annual guideline and the EU limit from 2030.
export const ANNUAL_LAYERS = [
  {
    id: "pm25",
    label: "Fijnstof (PM2,5)",
    short: "PM2,5",
    hint: "Kleine deeltjes die diep in je longen en bloed komen. Weegt het zwaarst voor je gezondheid.",
    legend: `Fijnstof PM2,5, jaargemiddelde ${ANNUAL_YEAR}, in µg/m³`,
    rivmLayer: `rivm_nsl_20260401_gm_PM25${ANNUAL_YEAR}`,
    who: 5,
    eu2030: 10,
    bands: [
      { upTo: 5, color: "#ABD9E9" },
      { upTo: 7, color: "#FFFFBF" },
      { upTo: 8, color: "#FAE7AC" },
      { upTo: 9, color: "#F0BC8B" },
      { upTo: 10, color: "#E3926D" },
      { upTo: 11, color: "#D66C51" },
      { upTo: 15, color: "#C44539" },
      { upTo: null, color: "#B01D1B" },
    ] as readonly AnnualBand[],
  },
  {
    id: "no2",
    label: "Stikstofdioxide (NO₂)",
    short: "NO₂",
    hint: "Vooral langs drukke wegen. Een maat voor uitlaatgassen.",
    legend: `Stikstofdioxide NO₂, jaargemiddelde ${ANNUAL_YEAR}, in µg/m³`,
    rivmLayer: `rivm_nsl_20260401_gm_NO2${ANNUAL_YEAR}`,
    who: 10,
    eu2030: 20,
    bands: [
      { upTo: 8, color: "#3175B4" },
      { upTo: 10, color: "#ABD9E9" },
      { upTo: 12, color: "#FFFFBF" },
      { upTo: 14, color: "#FAE7AC" },
      { upTo: 16, color: "#F0BC8B" },
      { upTo: 20, color: "#E3926D" },
      { upTo: 25, color: "#D66C51" },
      { upTo: 30, color: "#C44539" },
      { upTo: null, color: "#B01D1B" },
    ] as readonly AnnualBand[],
  },
] as const;
export type AnnualLayer = (typeof ANNUAL_LAYERS)[number]["id"];

export function isAnnualLayer(value: string): value is AnnualLayer {
  return ANNUAL_LAYERS.some((l) => l.id === value);
}

export function annualInfo(layer: AnnualLayer) {
  return ANNUAL_LAYERS.find((l) => l.id === layer) ?? ANNUAL_LAYERS[0];
}

// The annual view's layer: the chosen pollutant if it has an annual map, else PM2.5.
export function annualLayerFor(layer: MapLayer): AnnualLayer {
  return isAnnualLayer(layer) ? layer : "pm25";
}

export function annualColor(layer: AnnualLayer, value: number) {
  const bands = annualInfo(layer).bands;
  return (bands.find((b) => b.upTo !== null && value < b.upTo) ?? bands[bands.length - 1]).color;
}

// The three categories of the annual view, named next to every colour.
export function annualCategory(layer: AnnualLayer, value: number) {
  const { who, eu2030 } = annualInfo(layer);
  if (value < who) return "Onder het WHO-advies";
  if (value < eu2030) return "Boven het WHO-advies";
  return "Boven de EU-norm 2030";
}

// Measured annual averages per official station (decision #41), from Luchtmeetnet's
// validated yearly files. hours is the time covered; a daily value counts 24.
export type AnnualValue = { mean: number; hours: number };

export type AnnualStation = Pick<
  StationReading,
  "id" | "source" | "external_id" | "kind" | "name" | "organisation" | "municipality" | "longitude" | "latitude" | "details"
> & {
  // {"no2": {"2024": {mean, hours}, ...}, "pm25": {...}}
  annual: Partial<Record<AnnualLayer, Record<string, AnnualValue>>>;
};

// The trend in the station panel, and the share of a year needed for a value.
export const ANNUAL_FIRST_YEAR = 2012;
export const ANNUAL_LAST_YEAR = 2025;
export const MIN_ANNUAL_COVERAGE = 0.75;
// Fewer valid years than this show a sentence instead of a chart: two bars
// can't tell a trend from one year's swing (decision #43).
export const MIN_TREND_YEARS = 3;

export function hoursInYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 8784 : 8760;
}

// A station's annual average for one year: the value with its share of the
// year measured, "few" below MIN_ANNUAL_COVERAGE, or null when it doesn't
// measure the pollutant at all.
export function annualValue(station: AnnualStation, layer: AnnualLayer, year: number) {
  const series = station.annual[layer];
  if (!series) return null;
  const value = series[String(year)];
  const share = value ? value.hours / hoursInYear(year) : 0;
  if (!value || share < MIN_ANNUAL_COVERAGE) return { kind: "few" as const, share };
  return { kind: "value" as const, mean: value.mean, share };
}

// "2,1×": how many times the WHO guideline.
export function formatTimesWho(layer: AnnualLayer, mean: number) {
  return `${formatNumber(mean / annualInfo(layer).who)}×`;
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
