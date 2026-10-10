"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  BAND_QUANTITIES,
  QUANTITY_NAMES,
  continuousSubIndex,
  formatNumber,
  lkiCategory,
  lkiColor,
  lkiIndexFromContinuous,
  subIndex,
  type AreaLayer,
  type BandQuantity,
} from "@/lib/air-quality";
import type { PointValues } from "@/lib/rivm-map";

type Result = { key: string; values: PointValues | null };

function headline(layer: AreaLayer, value: number) {
  if (layer === "lki") {
    const index = lkiIndexFromContinuous(value);
    return index && { index, text: `LKI ${index}` };
  }
  const index = subIndex(layer, value);
  return index && { index, text: `${QUANTITY_NAMES[layer]} ${formatNumber(value)} µg/m³` };
}

// The LKI is the highest sub-index (decision #22), so the pollutant whose
// sub-index matches it sets the index here. No match (should not happen): say nothing.
function deciding(values: PointValues) {
  const lki = values.lki;
  if (lki == null) return null;
  let best: { quantity: BandQuantity; diff: number } | null = null;
  for (const q of BAND_QUANTITIES) {
    const value = values[q];
    if (value == null) continue;
    const diff = Math.abs(continuousSubIndex(q, value) - lki);
    if (!best || diff < best.diff) best = { quantity: q, diff };
  }
  return best && best.diff < 0.15 ? best.quantity : null;
}

/** RIVM's calculated values at a clicked spot on the map (decision #26). */
export function PointValue({ longitude, latitude, layer }: { longitude: number; latitude: number; layer: AreaLayer }) {
  const key = `${longitude.toFixed(5)},${latitude.toFixed(5)}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const [lon, lat] = key.split(",");
    fetch(`/api/rivm/point?lon=${lon}&lat=${lat}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<PointValues>) : Promise.reject(new Error(String(res.status)))))
      .then((values) => setResult({ key, values }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, values: null });
      });
    return () => controller.abort();
  }, [key]);

  const current = result?.key === key ? result : null;
  if (!current) {
    return (
      <div className="grid w-52 gap-2" aria-busy>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-44" />
      </div>
    );
  }

  const value = current.values?.[layer];
  const main = value != null ? headline(layer, value) : null;
  if (!current.values || !main) {
    return (
      <p className="text-muted-foreground w-52 text-sm">
        {current.values ? "Hier is geen berekening, bijvoorbeeld boven water." : "De waarde is nu niet beschikbaar."}
      </p>
    );
  }

  const color = lkiColor(main.index);
  const others = BAND_QUANTITIES.filter((q) => q !== layer && current.values?.[q] != null);
  const decider = layer === "lki" ? deciding(current.values) : null;
  return (
    <div className="grid w-56 gap-2">
      <div className="flex items-center gap-2.5">
        <span
          className="size-4 shrink-0 rounded-full ring-1 ring-black/15 ring-inset"
          style={{ background: color?.bg }}
          aria-hidden
        />
        <span className="text-sm">
          <strong className="font-semibold tabular-nums">{main.text}</strong> · {lkiCategory(main.index).name}
        </span>
      </div>
      {decider && (
        <p className="text-xs">
          Hier bepaalt <strong className="font-semibold">{QUANTITY_NAMES[decider]}</strong> de index: de stof die het
          slechtst scoort, telt.
        </p>
      )}
      {others.length > 0 && (
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 text-xs tabular-nums">
          {layer !== "lki" && current.values.lki != null && (
            <>
              <dt>LKI</dt>
              <dd>{lkiIndexFromContinuous(current.values.lki)}</dd>
            </>
          )}
          {others.map((q) => (
            <div key={q} className="contents">
              <dt>{QUANTITY_NAMES[q]}</dt>
              <dd>{formatNumber(current.values?.[q] ?? 0)} µg/m³</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-muted-foreground text-xs">Berekend door het RIVM voor het laatste uur. Dit is een schatting, geen meting.</p>
    </div>
  );
}
