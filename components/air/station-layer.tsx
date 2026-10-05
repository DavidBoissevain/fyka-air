"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import type * as GeoJSON from "geojson";
import type * as MapLibreGL from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import { NO_INDEX_COLOR, lkiColor, lkiIndex, type StationReading } from "@/lib/air-quality";

const SOURCE = "stations";
const LAYER = "stations";
const SENSOR_LAYER = "sensors";
const SELECTED_LAYER = "stations-selected";
const CLICKABLE = [LAYER, SENSOR_LAYER];

// Halo behind official stations, and the ring around the selected one.
const THEME = {
  light: { halo: "#FFFFFF", ring: "#1A1D24" },
  dark: { halo: "#0F172A", ring: "#F1F5F9" },
} as const;

type Props = {
  stations: StationReading[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
};

// Official stations as large LKI-coloured dots with a halo, citizen sensors as
// small dots without one, underneath (huisstijl: "Map"). Higher LKI values are
// drawn on top, so problem spots stay visible in dense areas.
export function StationLayer({ stations, selectedId, onSelect }: Props) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const colors = THEME[resolvedTheme];

  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: stations.map((s) => {
        const index = lkiIndex(s.readings.lki?.value);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
          properties: { id: s.id, kind: s.kind, lki: index ?? 0, color: lkiColor(index)?.bg ?? NO_INDEX_COLOR },
        };
      }),
    }),
    [stations],
  );

  // Latest values for the setup effect below, which only re-runs on style loads.
  const latest = useRef({ data, selectedId });
  useEffect(() => {
    latest.current = { data, selectedId };
  });
  const select = useEffectEvent(onSelect);

  // Add source and layers once the style is loaded; they are re-added after a theme switch.
  useEffect(() => {
    if (!isLoaded || !map) return;

    map.addSource(SOURCE, { type: "geojson", data: latest.current.data });
    map.addLayer({
      id: SENSOR_LAYER,
      type: "circle",
      source: SOURCE,
      filter: ["==", ["get", "kind"], "citizen"],
      layout: { "circle-sort-key": ["get", "lki"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.8, 11, 6],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.9,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 10, 1],
        "circle-stroke-color": colors.halo,
      },
    });
    map.addLayer({
      id: LAYER,
      type: "circle",
      source: SOURCE,
      filter: ["==", ["get", "kind"], "professional"],
      layout: { "circle-sort-key": ["get", "lki"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 11, 11],
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": colors.halo,
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
