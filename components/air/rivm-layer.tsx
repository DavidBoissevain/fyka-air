"use client";

import { useEffect } from "react";
import type * as MapLibreGL from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import type { AreaLayer } from "@/lib/air-quality";

const SOURCE = "rivm";
const LAYER = "rivm";

// Light enough that roads, labels and the dots stay readable on top.
const OPACITY = { light: 0.6, dark: 0.5 } as const;

// RIVM refreshes hourly and our proxy caches for 10 minutes; a new bucket in
// the tile URL makes long-open pages fetch fresh tiles.
const BUCKET_MS = 10 * 60 * 1000;
const tileUrl = (layer: AreaLayer) =>
  `${window.location.origin}/api/rivm/${layer}/{z}/{x}/{y}?v=${Math.floor(Date.now() / BUCKET_MS)}`;

// RIVM's calculated air quality map (decision #26), in our LKI colours, above
// the land but under roads, borders, labels and our dots.
export function RivmLayer({ layer }: { layer: AreaLayer | null }) {
  const { map, isLoaded, resolvedTheme } = useMap();

  // Re-added on every style load (theme switch) and layer change.
  useEffect(() => {
    if (!isLoaded || !map || !layer) return;

    const beforeId = map.getStyle().layers.find((l) => l.type === "line" || l.type === "symbol")?.id;
    map.addSource(SOURCE, {
      type: "raster",
      tiles: [tileUrl(layer)],
      tileSize: 256,
      minzoom: 6,
      maxzoom: 12,
      bounds: [3.2, 50.7, 7.3, 53.6],
    });
    map.addLayer(
      {
        id: LAYER,
        type: "raster",
        source: SOURCE,
        paint: { "raster-opacity": OPACITY[resolvedTheme], "raster-resampling": "nearest", "raster-fade-duration": 150 },
      },
      beforeId,
    );

    const refresh = setInterval(() => {
      (map.getSource(SOURCE) as MapLibreGL.RasterTileSource | undefined)?.setTiles([tileUrl(layer)]);
    }, BUCKET_MS);

    return () => {
      clearInterval(refresh);
      try {
        if (map.getLayer(LAYER)) map.removeLayer(LAYER);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch {
        // The style may be mid-reload.
      }
    };
  }, [isLoaded, map, layer, resolvedTheme]);

  return null;
}
