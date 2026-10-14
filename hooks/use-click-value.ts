import { useSyncExternalStore } from "react";

// Setting (decision #54): a click next to the dots opens a popup with RIVM's
// value at that spot. Off by default; the viewer's choice is remembered in
// localStorage. The server and hydration render the default; storage may be
// blocked, so the choice also lives in memory for this page.
const KEY = "luchtmeter:click-value";
const DEFAULT = false;
let chosen: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (chosen !== null) return chosen;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "on" || saved === "off") return saved === "on";
  } catch {
    // Storage blocked.
  }
  return DEFAULT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setClickValue(on: boolean) {
  chosen = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked; the choice lasts for this page.
  }
  listeners.forEach((l) => l());
}

export function useClickValue(): boolean {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}
