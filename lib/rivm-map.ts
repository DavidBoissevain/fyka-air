// RIVM's current air quality maps: an open WMS on data.rivm.nl, computed every
// hour on a 125 m grid from official measurements plus a road model. We
// proxy it (app/api/rivm) and restyle it in our LKI colours with SLD_BODY.
// See TECHNICAL.md, "RIVM model maps" and decision #26.
import { createHash } from "node:crypto";

import { BAND_QUANTITIES, LKI_COLORS, SUB_INDEX_EDGES, type AreaLayer } from "@/lib/air-quality";

const WMS = "https://data.rivm.nl/geo/lucht/wms";
const TIMEOUT_MS = 15_000;

export const AREA_LAYERS: readonly AreaLayer[] = ["lki", ...BAND_QUANTITIES];

export function isAreaLayer(value: string): value is AreaLayer {
  return (AREA_LAYERS as readonly string[]).includes(value);
}

// Rough bounds of the Netherlands, as in the Samen Meten collector.
export const NL = { minLon: 3.2, maxLon: 7.3, minLat: 50.7, maxLat: 53.6 };

export function inNetherlands(lon: number, lat: number) {
  return lon >= NL.minLon && lon <= NL.maxLon && lat >= NL.minLat && lat <= NL.maxLat;
}

// Web Mercator (EPSG:3857): half the world's width in metres.
const HALF = 20037508.342789244;
const mercX = (lon: number) => (lon * HALF) / 180;
const mercY = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * HALF) / Math.PI;

export function tileBbox(z: number, x: number, y: number) {
  const size = (2 * HALF) / 2 ** z;
  const minX = -HALF + x * size;
  const maxY = HALF - y * size;
  return { minX, minY: maxY - size, maxX: minX + size, maxY };
}

export function tileInNetherlands(z: number, x: number, y: number) {
  const b = tileBbox(z, x, y);
  return b.maxX > mercX(NL.minLon) && b.minX < mercX(NL.maxLon) && b.maxY > mercY(NL.minLat) && b.minY < mercY(NL.maxLat);
}

// Our 11 LKI colours as a raster colour map. "intervals" colours values below
// each quantity, like lki_sub_index(); below 0 (no data) stays transparent.
// The map LKI is continuous and rounds up to the index, so index k covers (k-1, k].
function sld(layer: AreaLayer) {
  const edges = layer === "lki" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : SUB_INDEX_EDGES[layer];
  const entries = [
    `<ColorMapEntry color="#000000" opacity="0" quantity="0"/>`,
    ...LKI_COLORS.map((c, i) => `<ColorMapEntry color="${c.bg}" opacity="1" quantity="${edges[i] ?? 100000}"/>`),
  ].join("");
  return (
    `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer>` +
    `<Name>lucht:actueel_${layer}</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer>` +
    `<ColorMap type="intervals">${entries}</ColorMap>` +
    `</RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`
  );
}

// One 256 px PNG tile in our colours. GeoServer reports errors as XML with
// status 200, so check the content type too.
export async function fetchTile(layer: AreaLayer, z: number, x: number, y: number) {
  const b = tileBbox(z, x, y);
  const url = new URL(WMS);
  url.search = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: `lucht:actueel_${layer}`,
    format: "image/png",
    transparent: "true",
    srs: "EPSG:3857",
    bbox: [b.minX, b.minY, b.maxX, b.maxY].join(","),
    width: "256",
    height: "256",
    SLD_BODY: sld(layer),
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/png")) {
    throw new Error(`RIVM WMS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

// RIVM's map has no timestamp and changes once an hour at a moment we can't
// predict, so the version is a hash of the whole country at about 2 km per
// pixel in RIVM's own fine-stepped style. It goes into the tile URL, so all
// tiles on screen come from the same hour.
export async function fetchVersion(layer: AreaLayer) {
  const url = new URL(WMS);
  url.search = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: `lucht:actueel_${layer}`,
    styles: "",
    format: "image/png",
    srs: "EPSG:3857",
    bbox: [mercX(NL.minLon), mercY(NL.minLat), mercX(NL.maxLon), mercY(NL.maxLat)].join(","),
    width: "256",
    height: "256",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/png")) {
    throw new Error(`RIVM WMS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return createHash("sha1").update(Buffer.from(await res.arrayBuffer())).digest("hex").slice(0, 12);
}

export type PointValues = Record<AreaLayer, number | null>;

// RIVM's values at one point for all layers, from a single GetFeatureInfo.
// Negative values mean no data (outside the grid, over water).
export async function fetchPoint(lon: number, lat: number): Promise<PointValues> {
  const d = 0.0005;
  const layers = AREA_LAYERS.map((l) => `lucht:actueel_${l}`).join(",");
  const url = new URL(WMS);
  url.search = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers,
    query_layers: layers,
    styles: "",
    srs: "EPSG:4326",
    bbox: [lon - d, lat - d, lon + d, lat + d].join(","),
    width: "3",
    height: "3",
    x: "1",
    y: "1",
    info_format: "application/json",
    feature_count: "10",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`RIVM WMS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { features?: { properties?: Record<string, unknown> }[] };

  const values = Object.fromEntries(AREA_LAYERS.map((l) => [l, null])) as PointValues;
  for (const feature of json.features ?? []) {
    for (const [key, value] of Object.entries(feature.properties ?? {})) {
      const layer = key.replace(/^actueel_/, "");
      if (isAreaLayer(layer) && typeof value === "number" && Number.isFinite(value) && value >= 0) {
        values[layer] = value;
      }
    }
  }
  return values;
}
