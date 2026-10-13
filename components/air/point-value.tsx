"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  ANNUAL_LAYERS,
  ANNUAL_YEAR,
  BAND_QUANTITIES,
  POINT_DECIMALS,
  QUANTITY_NAMES,
  annualCategory,
  annualColor,
  annualInfo,
  continuousSubIndex,
  formatNumber,
  lkiCategory,
  lkiColor,
  lkiIndexFromContinuous,
  subIndex,
  type AnnualLayer,
  type AreaLayer,
  type BandQuantity,
} from "@/lib/air-quality";
import type { AnnualPointValues, PointValues } from "@/lib/rivm-map";

// RIVM's values at the spot from one of our point routes, or null when they
// couldn't be fetched; undefined while loading. The route only accepts
// coordinates with its period's POINT_DECIMALS.
function usePointValues<T>(path: string, decimals: number, longitude: number, latitude: number) {
  const key = `${longitude.toFixed(decimals)},${latitude.toFixed(decimals)}`;
  const [result, setResult] = useState<{ key: string; values: T | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const [lon, lat] = key.split(",");
    fetch(`${path}?lon=${lon}&lat=${lat}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status)))))
      .then((values) => setResult({ key, values }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, values: null });
      });
    return () => controller.abort();
  }, [path, key]);

  return result?.key === key ? result.values : undefined;
}

function Loading() {
  return (
    <div className="grid w-52 gap-2" aria-busy>
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-3.5 w-44" />
    </div>
  );
}

function NoValue({ failed }: { failed: boolean }) {
  return (
    <p className="text-muted-foreground w-52 text-sm">
      {failed ? "De waarde is nu niet beschikbaar." : "Hier is geen berekening, bijvoorbeeld boven water."}
    </p>
  );
}

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
  const values = usePointValues<PointValues>("/api/rivm/point", POINT_DECIMALS.nu, longitude, latitude);
  if (values === undefined) return <Loading />;

  const value = values?.[layer];
  const main = value != null ? headline(layer, value) : null;
  if (!values || !main) return <NoValue failed={!values} />;

  const color = lkiColor(main.index);
  const others = BAND_QUANTITIES.filter((q) => q !== layer && values[q] != null);
  const decider = layer === "lki" ? deciding(values) : null;
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
          {layer !== "lki" && values.lki != null && (
            <>
              <dt>LKI</dt>
              <dd>{lkiIndexFromContinuous(values.lki)}</dd>
            </>
          )}
          {others.map((q) => (
            <div key={q} className="contents">
              <dt>{QUANTITY_NAMES[q]}</dt>
              <dd>{formatNumber(values[q] ?? 0)} µg/m³</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-muted-foreground text-xs">Berekend door het RIVM voor het laatste uur. Dit is een schatting, geen meting.</p>
    </div>
  );
}

/** RIVM's annual average at a clicked spot, against the WHO guideline (decision #39). */
export function AnnualPointValue({
  longitude,
  latitude,
  layer,
}: {
  longitude: number;
  latitude: number;
  layer: AnnualLayer;
}) {
  const values = usePointValues<AnnualPointValues>("/api/rivm/jaar/point", POINT_DECIMALS.jaar, longitude, latitude);
  if (values === undefined) return <Loading />;

  const value = values?.[layer];
  if (!values || value == null) return <NoValue failed={!values} />;

  const { who } = annualInfo(layer);
  const times = value / who;
  const others = ANNUAL_LAYERS.filter((l) => l.id !== layer && values[l.id] != null);
  return (
    <div className="grid w-60 gap-2">
      <div className="flex items-center gap-2.5">
        <span
          className="size-4 shrink-0 rounded-full ring-1 ring-black/15 ring-inset"
          style={{ background: annualColor(layer, value) }}
          aria-hidden
        />
        <span className="text-sm">
          <strong className="font-semibold tabular-nums">
            {QUANTITY_NAMES[layer]} {formatNumber(value)} µg/m³
          </strong>{" "}
          · {annualCategory(layer, value)}
        </span>
      </div>
      <p className="text-xs tabular-nums">
        {times >= 1 ? (
          <>
            <strong className="font-semibold">{formatNumber(times)}×</strong> het WHO-advies van {who} µg/m³
          </>
        ) : (
          <>Onder het WHO-advies van {who} µg/m³</>
        )}
      </p>
      {others.length > 0 && (
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 text-xs tabular-nums">
          {others.map((l) => {
            const v = values[l.id] ?? 0;
            return (
              <div key={l.id} className="contents">
                <dt>{QUANTITY_NAMES[l.id]}</dt>
                <dd>
                  {formatNumber(v)} µg/m³ · {annualCategory(l.id, v)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <p className="text-muted-foreground text-xs">
        Jaargemiddelde {ANNUAL_YEAR}, berekend door het RIVM. Dit is een schatting, geen meting.
      </p>
    </div>
  );
}
