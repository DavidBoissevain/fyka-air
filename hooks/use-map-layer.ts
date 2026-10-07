import { useSyncExternalStore } from "react";

import { MAP_LAYERS, type MapLayer } from "@/lib/air-quality";

// The viewer's map layer choice, remembered in localStorage. The server and
// hydration render the default; storage may be blocked, so the choice also
// lives in memory for this page.
const KEY = "fyka-air:map-layer";
const DEFAULT: MapLayer = "lki";
let chosen: MapLayer | null = null;
const listeners = new Set<() => void>();

function read(): MapLayer {
  if (chosen) return chosen;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && MAP_LAYERS.some((l) => l.id === saved)) return saved as MapLayer;
  } catch {
    // Storage blocked.
  }
  return DEFAULT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMapLayer(layer: MapLayer) {
  chosen = layer;
  try {
    localStorage.setItem(KEY, layer);
  } catch {
    // Storage blocked; the choice lasts for this page.
  }
  listeners.forEach((l) => l());
}

export function useMapLayer(): MapLayer {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}
