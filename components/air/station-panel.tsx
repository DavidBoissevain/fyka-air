"use client";

import { Suspense } from "react";
import { MapPinIcon, XIcon } from "lucide-react";

import { StationChart } from "@/components/air/station-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import {
  LKI_CATEGORIES,
  LKI_COLORS,
  QUANTITY_NAMES,
  STATION_TYPES,
  WHO_GUIDELINE,
  formatAge,
  formatNumber,
  formatTime,
  isLate,
  lkiCategory,
  lkiColor,
  lkiIndex,
  stationTitle,
  type Quantity,
  type StationReading,
} from "@/lib/air-quality";
import { distanceKm, type Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

const POLLUTANTS: Quantity[] = ["pm25", "pm10", "no2", "o3"];

export function Freshness({ measuredAt }: { measuredAt: string }) {
  const now = useNow();
  const late = now !== null && isLate(measuredAt, now);
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-2 rounded-full", late ? "bg-warn" : "bg-ok")} aria-hidden />
      Gemeten om {formatTime(measuredAt)}
      {now !== null && <> · {formatAge(measuredAt, now)}</>}
    </span>
  );
}

function LkiSummary({ value, citizen }: { value: number | undefined; citizen: boolean }) {
  const index = lkiIndex(value);
  const color = lkiColor(index);
  const category = index ? lkiCategory(index) : null;
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid size-16 shrink-0 place-items-center rounded-2xl text-[1.75rem] font-bold tabular-nums"
        style={color ? { background: color.bg, color: color.fg } : undefined}
        aria-label={index ? `LKI ${index}` : "Geen index"}
      >
        {index ?? <span className="bg-muted text-muted-foreground grid size-full place-items-center rounded-2xl">–</span>}
      </div>
      <div className="grid min-w-0 gap-0.5">
        <strong className="text-lg font-semibold">{category ? category.name : "Geen index"}</strong>
        <span className="text-muted-foreground text-sm">
          {category
            ? category.advice
            : citizen
              ? "Nog geen index: daarvoor zijn minstens 12 uur metingen nodig."
              : "Dit station meet niet genoeg stoffen voor een luchtkwaliteitsindex."}
        </span>
      </div>
    </div>
  );
}

function PollutantRow({ quantity, station }: { quantity: Quantity; station: StationReading }) {
  const reading = station.readings[quantity];
  const who = WHO_GUIDELINE[quantity];
  if (!reading) {
    return (
      <div className="text-muted-foreground grid grid-cols-[4.25rem_minmax(0,1fr)_7rem] items-center gap-3 border-t py-2.5 text-sm">
        <span>{QUANTITY_NAMES[quantity]}</span>
        <span />
        <span className="text-right">niet gemeten</span>
      </div>
    );
  }
  const percent = who ? Math.min(100, (reading.value / (who * 2)) * 100) : 0;
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_7rem] items-center gap-3 border-t py-2.5 text-sm">
      <span className="font-semibold">{QUANTITY_NAMES[quantity]}</span>
      {who ? (
        <div className="bg-muted relative h-1.5 rounded-full">
          <i className="bg-steel absolute inset-y-0 left-0 rounded-full" style={{ width: `${percent}%` }} />
          <b className="bg-foreground/60 absolute -inset-y-0.75 left-1/2 w-0.5 rounded-full" aria-hidden />
        </div>
      ) : (
        <span />
      )}
      <span className="text-right font-medium tabular-nums">
        {formatNumber(reading.value)}{" "}
        <small className="text-muted-foreground font-normal">{who ? `/ ${who}` : "µg/m³"}</small>
      </span>
    </div>
  );
}

type DetailsProps = {
  station: StationReading;
  // The searched address or place, to show how far away the station is.
  place?: Place | null;
  onClose: () => void;
};

export function StationDetails({ station, place, onClose }: DetailsProps) {
  const citizen = station.kind === "citizen";
  const type = station.details.type ? STATION_TYPES[station.details.type] ?? station.details.type : null;
  const source = citizen ? station.details.project ?? station.organisation : null;
  const subtitle = (citizen ? [source] : [type, station.organisation]).filter(Boolean).join(" · ");
  // Official stations list all four pollutants (showing what they don't measure);
  // sensors only what they measure.
  const quantities = citizen
    ? (["pm25", "pm10", "no2", "nh3"] as Quantity[]).filter((q) => station.readings[q])
    : [...POLLUTANTS, ...(["nh3"] as Quantity[]).filter((q) => station.readings[q])];
  return (
    <div className="grid content-start gap-5">
      <div className="grid gap-1.5">
        <div className="flex items-start justify-between gap-2.5">
          <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight wrap-anywhere">
            {stationTitle(station)}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Sluiten" className="-mr-1.5">
            <XIcon />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {citizen ? (
            <>
              <Badge variant="outline" className="text-muted-foreground">
                <span className="bg-muted-foreground size-1.5 rounded-full" aria-hidden />
                Burgersensor
              </Badge>
              <Badge variant="outline">Gekalibreerd door het RIVM</Badge>
            </>
          ) : (
            <Badge className="bg-brand-soft text-brand-text">Officieel meetstation</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {subtitle}
          {subtitle && " · "}
          <span className="font-mono text-[0.92em]">{station.external_id}</span>
        </p>
        <Freshness measuredAt={station.measured_at} />
        {place && (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
            {formatNumber(distanceKm(place, station))} km van {place.name}
          </span>
        )}
      </div>

      <div className="grid gap-2">
        <LkiSummary value={station.readings.lki?.value} citizen={citizen} />
        {citizen && (
          <p className="text-muted-foreground text-xs">
            Index op basis van fijnstof (24-uursgemiddelde). Officiële meetstations rekenen ook stikstofdioxide en
            ozon mee, en kunnen daardoor hoger uitkomen.
          </p>
        )}
      </div>

      <div className="grid">
        {quantities.map((q) => (
          <PollutantRow key={q} quantity={q} station={station} />
        ))}
        <p className="text-muted-foreground border-t pt-2 text-xs">
          µg/m³, uurwaarde{citizen && ", gekalibreerd door het RIVM tegen officiële meetstations in de buurt"}. Het
          streepje is de WHO-advieswaarde voor een daggemiddelde.
        </p>
      </div>

      <Suspense key={station.id} fallback={<Skeleton className="h-60 rounded-lg" />}>
        <StationChart station={station} />
      </Suspense>
    </div>
  );
}

export function Overview({ stations: all }: { stations: StationReading[] }) {
  // The category bars show official stations; sensors use a fine-dust-only index.
  const stations = all.filter((s) => s.kind === "professional");
  const sensorCount = all.length - stations.length;
  const latest = all.reduce<string | null>(
    (max, s) => (!max || s.measured_at > max ? s.measured_at : max),
    null,
  );
  const counts = LKI_CATEGORIES.map((category) => ({
    category,
    count: stations.filter((s) => {
      const index = lkiIndex(s.readings.lki?.value);
      return index !== null && index >= category.from && index <= category.to;
    }).length,
  }));
  const withIndex = counts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="grid content-start gap-5">
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
          Luchtkwaliteit nu
        </span>
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight">Nederland</h2>
        <p className="text-muted-foreground text-sm">
          {stations.length} officiële meetstations en {sensorCount.toLocaleString("nl-NL")} burgersensoren met een
          recente meting.
        </p>
        {latest && <Freshness measuredAt={latest} />}
      </div>

      {withIndex > 0 && (
        <div className="grid gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
            Officiële meetstations
          </h3>
          {counts.map(({ category, count }) => (
            <div key={category.name} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
              <span className="font-medium">{category.name}</span>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${(count / withIndex) * 100}%`,
                    background: LKI_COLORS[category.from + Math.floor((category.to - category.from) / 2) - 1].bg,
                  }}
                />
              </div>
              <span className="text-right tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}

      <p className="bg-muted rounded-lg p-3.5 text-sm">
        Klik op een meetstation of burgersensor op de kaart om te zien wat er gemeten wordt.
      </p>
      <p className="text-muted-foreground text-xs">
        De kleuren volgen de Luchtkwaliteitsindex (LKI) van het RIVM: van 1 (goed) tot 11 (zeer slecht).
        Officiële metingen van Luchtmeetnet: RIVM, GGD&apos;s, DCMR en provincies. Burgersensoren via RIVM Samen
        Meten, gekalibreerd door het RIVM.
      </p>
    </div>
  );
}
