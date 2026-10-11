"use client";

import { useEffect, useRef, useState } from "react";
import type * as MapLibreGL from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import { ANNUAL_YEAR, type AnnualLayer, type AreaLayer } from "@/lib/air-quality";

// Source and layer ids.
const SOURCE = "rivm";
const ANNUAL_ID = "rivm-jaar";

// Light enough that roads, labels and the dots stay readable on top.
const OPACITY = { light: 0.6, dark: 0.5 } as const;
// The annual view has no dots yet, so its colours can be stronger.
const ANNUAL_OPACITY = { light: 0.7, dark: 0.6 } as const;

// A raster layer above the land but under the basemap's roads, borders and
// labels (its first line or symbol layer), and so under our dots too.
function addRaster(map: MapLibreGL.Map, id: string, url: string, maxzoom: number, opacity: number) {
  const beforeId = map.getStyle().layers.find((l) => l.type === "line" || l.type === "symbol")?.id;
  map.addSource(id, {
    type: "raster",
    tiles: [url],
    tileSize: 256,
    minzoom: 6,
    maxzoom,
    bounds: [3.2, 50.7, 7.3, 53.6],
  });
  map.addLayer(
    {
      id,
      type: "raster",
      source: id,
      paint: { "raster-opacity": opacity, "raster-resampling": "nearest", "raster-fade-duration": 150 },
    },
    beforeId,
  );
  return () => {
    try {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    } catch {
      // The style may be mid-reload.
    }
  };
}

// RIVM refreshes its map once an hour at an unknown moment, and the version
// endpoint is cached for a minute, so a new hour shows within about 3 minutes.
const POLL_MS = 2 * 60 * 1000;

const tileUrl = (layer: AreaLayer, version: string) =>
  `${window.location.origin}/api/rivm/${layer}/{z}/{x}/{y}?v=${version}`;

// RIVM's current map version for the layer (see fetchVersion in
// lib/rivm-map.ts), checked every few minutes. Null until the first answer.
function useRivmVersion(layer: AreaLayer | null) {
  const [current, setCurrent] = useState<{ layer: AreaLayer; version: string } | null>(null);

  useEffect(() => {
    if (!layer) return;
    const controller = new AbortController();
    const check = () =>
      fetch(`/api/rivm/version?layer=${layer}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<{ version: string }>) : Promise.reject(new Error(`${res.status}`))))
        .then(({ version }) =>
          setCurrent((c) => (c?.layer === layer && c.version === version ? c : { layer, version })),
        )
        .catch(() => {
          if (controller.signal.aborted) return;
          // Keep the version we have; without one, try the tiles anyway.
          setCurrent((c) => (c?.layer === layer ? c : { layer, version: `t${Math.floor(Date.now() / POLL_MS)}` }));
        });

    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [layer]);

  return current?.layer === layer ? current.version : null;
}

// RIVM's calculated air quality map (decision #26), in our LKI colours, above
// the land but under roads, borders, labels and our dots.
export function RivmLayer({ layer }: { layer: AreaLayer | null }) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const version = useRivmVersion(layer);
  const versionRef = useRef(version);
  useEffect(() => {
    versionRef.current = version;
  }, [version]);
  const ready = version !== null;
  // The source's current tile URL; MapLibre only fills source.tiles once loaded.
  const urlRef = useRef<string | null>(null);

  // Re-added on every style load (theme switch) and layer change.
  useEffect(() => {
    const v = versionRef.current;
    if (!isLoaded || !map || !layer || !v) return;

    urlRef.current = tileUrl(layer, v);
    return addRaster(map, SOURCE, urlRef.current, 12, OPACITY[resolvedTheme]);
  }, [isLoaded, map, layer, resolvedTheme, ready]);

  // A new RIVM hour: swap every tile at once, so no two hours show together.
  useEffect(() => {
    if (!isLoaded || !map || !layer || !version) return;
    const source = map.getSource(SOURCE) as MapLibreGL.RasterTileSource | undefined;
    const url = tileUrl(layer, version);
    if (!source || urlRef.current === url) return;
    urlRef.current = url;
    source.setTiles([url]);
  }, [isLoaded, map, layer, version]);

  return null;
}

// RIVM's annual map (decision #37), on a 25 m grid, so tiles go up to zoom 14.
// It changes once a year: the year in the URL is its version, no polling needed.
export function AnnualRivmLayer({ layer }: { layer: AnnualLayer }) {
  const { map, isLoaded, resolvedTheme } = useMap();

  useEffect(() => {
    if (!isLoaded || !map) return;
    const url = `${window.location.origin}/api/rivm/jaar/${layer}/{z}/{x}/{y}?v=${ANNUAL_YEAR}`;
    return addRaster(map, ANNUAL_ID, url, 14, ANNUAL_OPACITY[resolvedTheme]);
  }, [isLoaded, map, layer, resolvedTheme]);

  return null;
}
