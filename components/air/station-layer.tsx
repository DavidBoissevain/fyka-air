"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import type * as GeoJSON from "geojson";
import type * as MapLibreGL from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import {
  LKI_OUTLINE,
  NO_INDEX_COLOR,
  lkiColor,
  lkiIndex,
  subIndex,
  type BandQuantity,
  type StationReading,
} from "@/lib/air-quality";

const SOURCE = "stations";
const LAYER = "stations";
const SENSOR_LAYER = "sensors";
const SELECTED_LAYER = "stations-selected";
const CLICKABLE = [LAYER, SENSOR_LAYER];

// Thin grey outline around every dot, and the ring around the selected station.
const THEME = {
  light: { outline: LKI_OUTLINE.light, ring: "#1A1D24" },
  dark: { outline: LKI_OUTLINE.dark, ring: "#F1F5F9" },
} as const;

// What a dot needs; the colour and drawing order come from `paint`.
type Dot = Pick<StationReading, "id" | "kind" | "longitude" | "latitude">;

// A dot's colour, and its rank: higher ranks are drawn on top.
export type Paint<T extends Dot> = (station: T) => { color: string; rank: number };

type Props<T extends Dot> = {
  stations: T[];
  // Keep it stable (useMemo), or the dots are rebuilt on every render.
  paint: Paint<T>;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  // A click on the map that hits no station.
  onMapClick?: (lngLat: MapLibreGL.LngLat) => void;
};

// The hourly map: the LKI, or one pollutant's hourly value in its LKI sub-index
// bands (decision #27). A citizen sensor's LKI covers fine dust only, so on
// the LKI it's grey, like a pollutant it doesn't measure: only complete
// indices get a colour (decision #30).
export function lkiPaint(colorBy: "lki" | BandQuantity): Paint<StationReading> {
  return (s) => {
    const index =
      colorBy === "lki"
        ? s.kind === "citizen"
          ? null
          : lkiIndex(s.readings.lki?.value)
        : subIndex(colorBy, s.readings[colorBy]?.value);
    return { color: lkiColor(index)?.bg ?? NO_INDEX_COLOR, rank: index ?? 0 };
  };
}

// Official stations as large dots, citizen sensors as small dots underneath,
// both with a thin grey outline. Higher values are drawn on top, so problem
// spots stay visible in dense areas.
export function StationLayer<T extends Dot>({ stations, paint, selectedId, onSelect, onMapClick }: Props<T>) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const colors = THEME[resolvedTheme];

  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: stations.map((s) => {
        const { color, rank } = paint(s);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
          properties: { id: s.id, kind: s.kind, rank, color },
        };
      }),
    }),
    [stations, paint],
  );

  // Latest values for the setup effect below, which only re-runs on style loads.
  const latest = useRef({ data, selectedId });
  useEffect(() => {
    latest.current = { data, selectedId };
  });
  const select = useEffectEvent(onSelect);
  const clickMap = useEffectEvent((lngLat: MapLibreGL.LngLat) => onMapClick?.(lngLat));

  // Add source and layers once the style is loaded; they are re-added after a theme switch.
  useEffect(() => {
    if (!isLoaded || !map) return;

    map.addSource(SOURCE, { type: "geojson", data: latest.current.data });
    map.addLayer({
      id: SENSOR_LAYER,
      type: "circle",
      source: SOURCE,
      filter: ["==", ["get", "kind"], "citizen"],
      layout: { "circle-sort-key": ["get", "rank"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.8, 11, 6],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.9,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 11, 1],
        "circle-stroke-color": colors.outline,
      },
    });
    map.addLayer({
      id: LAYER,
      type: "circle",
      source: SOURCE,
      filter: ["==", ["get", "kind"], "professional"],
      layout: { "circle-sort-key": ["get", "rank"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 11, 11],
        "circle-color": ["get", "color"],
        "circle-stroke-width": 1.25,
        "circle-stroke-color": colors.outline,
      },
    });
    map.addLayer({
      id: SELECTED_LAYER,
      type: "circle",
      source: SOURCE,
      filter: ["==", ["get", "id"], latest.current.selectedId ?? -1],
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          ["case", ["==", ["get", "kind"], "citizen"], 6, 11],
          11,
          ["case", ["==", ["get", "kind"], "citizen"], 10, 16],
        ],
        "circle-color": "rgba(0, 0, 0, 0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": colors.ring,
      },
    });

    const handleClick = (e: MapLibreGL.MapMouseEvent) => {
      // Official stations win when they overlap a sensor.
      const features = map.queryRenderedFeatures(e.point, { layers: CLICKABLE });
      const feature = features.find((f) => f.properties.kind === "professional") ?? features[0];
      select(feature ? Number(feature.properties.id) : null);
      if (!feature) clickMap(e.lngLat);
    };
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const unpointer = () => (map.getCanvas().style.cursor = "");
    map.on("click", handleClick);
    map.on("mouseenter", CLICKABLE, pointer);
    map.on("mouseleave", CLICKABLE, unpointer);

    return () => {
      map.off("click", handleClick);
      map.off("mouseenter", CLICKABLE, pointer);
      map.off("mouseleave", CLICKABLE, unpointer);
      try {
        if (map.getLayer(SELECTED_LAYER)) map.removeLayer(SELECTED_LAYER);
        if (map.getLayer(LAYER)) map.removeLayer(LAYER);
        if (map.getLayer(SENSOR_LAYER)) map.removeLayer(SENSOR_LAYER);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch {
        // The style may be mid-reload.
      }
    };
  }, [isLoaded, map, colors]);

  useEffect(() => {
    if (!isLoaded || !map) return;
    (map.getSource(SOURCE) as MapLibreGL.GeoJSONSource | undefined)?.setData(data);
  }, [isLoaded, map, data]);

  useEffect(() => {
    if (!isLoaded || !map?.getLayer(SELECTED_LAYER)) return;
    map.setFilter(SELECTED_LAYER, ["==", ["get", "id"], selectedId ?? -1]);
  }, [isLoaded, map, selectedId]);

  return null;
}
