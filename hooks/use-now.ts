import { useSyncExternalStore } from "react";

// A shared clock that ticks every minute. Returns null during server rendering
// and hydration, so relative times ("23 min geleden") only render on the client.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) clearInterval(timer);
  };
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now || null,
    () => null,
  );
}
