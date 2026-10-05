// Basemap: OpenFreeMap's Positron (light) and Dark styles, built on
// OpenStreetMap data. Free, no API key, no usage limits, and self-hostable
// later (decision #5 in TECHNICAL.md). Both keep their calm layout but are
// recoloured: like CARTO's light basemap in light mode (near-white, grey
// water, no green, faded roads), the house style's navy in dark mode. Labels
// are switched to Dutch names.
import { cacheLife } from "next/cache";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

const OPENFREEMAP = "https://tiles.openfreemap.org/styles";

// The styles prefer English names ("The Hague"); use the Dutch or local name.
const DUTCH_NAME: ExpressionSpecification = ["coalesce", ["get", "name:nl"], ["get", "name"]];

// Layer id -> colour. Layers missing from a style are skipped.
const COLORS = {
  // Like CARTO's light basemap: no green, grey water.
  light: {
    background: "#F9F9F9",
    landuse_residential: "#F5F5F5",
    park: "#F9F9F9",
    landcover_wood: "#F9F9F9",
    building: "#EEEEEE",
    water: "#D4DADC",
    waterway: "#D4DADC",
  },
  dark: {
    background: "#1B2436",
    landuse_residential: "#212B3F",
    park: "#1E2E36",
    landcover_wood: "#1F2C35",
    building: "#263248",
    water: "#0D1626",
    waterway: "#0D1626",
  },
} as const;

const COLOR_PROPERTY = { background: "background-color", fill: "fill-color", line: "line-color" } as const;

// Fades roads so they read as context, not content.
const ROAD_OPACITY = { light: 0.55, dark: 1 } as const;
const isRoad = (id: string) => /^(highway|road|tunnel|bridge)/.test(id);

async function loadStyle(name: "positron" | "dark", theme: keyof typeof COLORS): Promise<StyleSpecification> {
  const res = await fetch(`${OPENFREEMAP}/${name}`);
  if (!res.ok) throw new Error(`OpenFreeMap style ${name}: HTTP ${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  const colors: Record<string, string> = COLORS[theme];
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const color = colors[layer.id];
      if (color && layer.type in COLOR_PROPERTY) {
        const property = COLOR_PROPERTY[layer.type as keyof typeof COLOR_PROPERTY];
        return { ...layer, paint: { ...layer.paint, [property]: color } } as typeof layer;
      }
      if (layer.type === "line" && isRoad(layer.id) && ROAD_OPACITY[theme] < 1) {
        return { ...layer, paint: { ...layer.paint, "line-opacity": ROAD_OPACITY[theme] } };
      }
      if (layer.type === "symbol" && JSON.stringify(layer.layout?.["text-field"] ?? "").includes("name_en")) {
        return { ...layer, layout: { ...layer.layout, "text-field": DUTCH_NAME } };
      }
      return layer;
    }),
  };
}

export async function getMapStyles() {
  "use cache";
  cacheLife("days");
  const [light, dark] = await Promise.all([loadStyle("positron", "light"), loadStyle("dark", "dark")]);
  return { light, dark };
}
