import { useSyncExternalStore } from "react";

import type { MapPeriod } from "@/lib/air-quality";

// The map's mode, "nu" or "jaar" (decision #36). A link with ?periode=jaar
// opens the annual view; otherwise the viewer's last choice from localStorage.
// The server and hydration render "nu"; storage may be blocked, so the choice
// also lives in memory for this page.
const KEY = "luchtmeter:map-period";
const PARAM = "periode";
const DEFAULT: MapPeriod = "nu";
let chosen: MapPeriod | null = null;
const listeners = new Set<() => void>();

const isPeriod = (value: string | null): value is MapPeriod => value === "nu" || value === "jaar";

// The address wins (setMapPeriod keeps it in step), so a link to ?periode=jaar
// always opens the annual view.
function read(): MapPeriod {
  const linked = new URLSearchParams(window.location.search).get(PARAM);
  if (isPeriod(linked)) return linked;
  if (chosen) return chosen;
  try {
    const saved = localStorage.getItem(KEY);
    if (isPeriod(saved)) return saved;
  } catch {
    // Storage blocked.
  }
  return DEFAULT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMapPeriod(period: MapPeriod) {
  chosen = period;
  try {
    localStorage.setItem(KEY, period);
  } catch {
    // Storage blocked; the choice lasts for this page.
  }
  // Keep the address shareable: ?periode=jaar for the annual view, nothing for now.
  const url = new URL(window.location.href);
  if (period === "jaar") url.searchParams.set(PARAM, period);
  else url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((l) => l());
}

export function useMapPeriod(): MapPeriod {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}
