"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { StationHeading } from "@/components/air/station-panel";
import { TooltipBox, WhoLine, axisProps, yAxis } from "@/components/air/station-chart";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ANNUAL_FIRST_YEAR,
  ANNUAL_LAST_YEAR,
  ANNUAL_LAYERS,
  ANNUAL_YEAR,
  MIN_TREND_YEARS,
  QUANTITY_NAMES,
  annualCategory,
  annualColor,
  annualInfo,
  annualValue,
  formatNumber,
  formatTimesWho,
  type AnnualLayer,
  type AnnualStation,
} from "@/lib/air-quality";

const percent = (share: number) => `${Math.min(100, Math.round(share * 100))}%`;

// "Geen fijnstofmeting", "Geen NO₂-meting"
const NOT_MEASURED: Record<AnnualLayer, string> = { pm25: "Geen fijnstofmeting", no2: "Geen NO₂-meting" };

// The tile for the map's pollutant, like the LKI tile in the hourly panel:
// how many times the WHO guideline, in the annual colour, with its category.
function AnnualSummary({ station, layer }: { station: AnnualStation; layer: AnnualLayer }) {
  const value = annualValue(station, layer, ANNUAL_YEAR);
  const { who } = annualInfo(layer);
  const name = QUANTITY_NAMES[layer];

  let title: string;
  let text: string;
  if (value?.kind === "value") {
    title = annualCategory(layer, value.mean);
    text = `${name} was hier in ${ANNUAL_YEAR} gemiddeld ${formatNumber(value.mean)} µg/m³: ${formatNumber(value.mean / who)} keer het WHO-advies van ${who}.`;
  } else if (value?.kind === "few") {
    title = `Te weinig metingen in ${ANNUAL_YEAR}`;
    text =
      value.share > 0
        ? `Dit station mat in ${ANNUAL_YEAR} in ${percent(value.share)} van de uren. Dat is te weinig voor een betrouwbaar jaargemiddelde.`
        : `Dit station heeft geen metingen van ${name} uit ${ANNUAL_YEAR}.`;
  } else {
    const other = ANNUAL_LAYERS.find((l) => l.id !== layer)!;
    const otherMeasured = annualValue(station, other.id, ANNUAL_YEAR)?.kind === "value";
    title = NOT_MEASURED[layer];
    text = `Dit station meet geen ${name}. Daarom staat het niet op deze kaart.${otherMeasured ? ` Kies ${QUANTITY_NAMES[other.id]} om zijn jaargemiddelde te zien.` : ""}`;
  }

  const color = value?.kind === "value" ? annualColor(layer, value.mean) : null;
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold tabular-nums ring-1 ring-black/10 ring-inset"
        style={color ? { background: color, color: readableOn(color) } : undefined}
        aria-label={value?.kind === "value" ? `${formatNumber(value.mean / who)} keer het WHO-advies` : "Geen waarde"}
      >
        {value?.kind === "value" ? (
          formatTimesWho(layer, value.mean)
        ) : (
          <span className="bg-muted text-muted-foreground grid size-full place-items-center rounded-2xl">–</span>
        )}
      </div>
      <div className="grid min-w-0 gap-0.5">
        <strong className="text-lg font-semibold">{title}</strong>
        <span className="text-muted-foreground text-sm">{text}</span>
      </div>
    </div>
  );
}

// Dark text on RIVM's pale bands, white on the dark ones.
function readableOn(color: string) {
  return ["#3175B4", "#D66C51", "#C44539", "#B01D1B"].includes(color) ? "#FFFFFF" : "#1A1D24";
}

// One pollutant, like the hourly panel's rows. The bar runs to the EU limit
// for 2030, so the tick halfway is the WHO guideline.
function AnnualRow({ station, layer }: { station: AnnualStation; layer: AnnualLayer }) {
  const value = annualValue(station, layer, ANNUAL_YEAR);
  const { who, eu2030 } = annualInfo(layer);
  if (value?.kind !== "value") {
    return (
      <div className="text-muted-foreground grid grid-cols-[4.25rem_minmax(0,1fr)_7.5rem] items-center gap-3 border-t py-2.5 text-sm">
        <span>{QUANTITY_NAMES[layer]}</span>
        <span />
        <span className="text-right">{value ? "te weinig metingen" : "niet gemeten"}</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_7.5rem] items-center gap-3 border-t py-2.5 text-sm">
      <span className="font-semibold">{QUANTITY_NAMES[layer]}</span>
      <div className="bg-muted relative h-1.5 rounded-full">
        <i
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(100, (value.mean / eu2030) * 100)}%`, background: annualColor(layer, value.mean) }}
        />
        <b
          className="bg-foreground/60 absolute -inset-y-0.75 w-0.5 -translate-x-1/2 rounded-full"
          style={{ left: `${(who / eu2030) * 100}%` }}
          aria-hidden
        />
      </div>
      <span className="text-right font-medium tabular-nums">
        {formatNumber(value.mean)} <small className="text-muted-foreground font-normal">/ {who}</small>
      </span>
    </div>
  );
}

const config = { v: { label: "Jaargemiddelde", color: "var(--brand-text)" } } satisfies ChartConfig;
const YEAR_TICKS = [2012, 2015, 2020, 2025];

type YearPoint = { year: number; v: number | null; share: number };

// Measured annual averages from ANNUAL_FIRST_YEAR on, one bar per year in its
// annual colour; a year with too few measurements is a gap. With fewer than
// MIN_TREND_YEARS valid years there's no trend to show, so it says so instead.
function YearChart({ station, initial }: { station: AnnualStation; initial: AnnualLayer }) {
  const measured = ANNUAL_LAYERS.filter((l) => station.annual[l.id]).map((l) => l.id);
  const [chosen, setChosen] = useState<AnnualLayer>(initial);
  const layer = measured.includes(chosen) ? chosen : measured[0];
  if (!layer) return null;

  const { who } = annualInfo(layer);
  const points: YearPoint[] = [];
  for (let year = ANNUAL_FIRST_YEAR; year <= ANNUAL_LAST_YEAR; year++) {
    const value = annualValue(station, layer, year);
    points.push({ year, v: value?.kind === "value" ? value.mean : null, share: value?.share ?? 0 });
  }
  const values = points.flatMap((p) => (p.v === null ? [] : [p.v]));
  const { max, ticks } = yAxis(values, who);
  const validYears = points.filter((p) => p.v !== null).map((p) => p.year);
  const name = QUANTITY_NAMES[layer];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Gemeten per jaar</h3>
        {measured.length > 1 && (
          <Tabs value={layer} onValueChange={(value) => setChosen(value as AnnualLayer)}>
            <TabsList aria-label="Stof">
              {measured.map((l) => (
                <TabsTrigger key={l} value={l} className="px-3 text-xs">
                  {QUANTITY_NAMES[l]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {validYears.length < MIN_TREND_YEARS ? (
        <p className="bg-muted text-muted-foreground rounded-lg p-3.5 text-sm">
          {validYears.length === 0
            ? `Nog geen jaar met genoeg metingen van ${name}.`
            : `Alleen voor ${validYears.join(" en ")} zijn er genoeg metingen van ${name}.`}{" "}
          Voor een verloop zijn minstens {MIN_TREND_YEARS} jaar nodig.
        </p>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-44 w-full">
          <BarChart data={points} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="year"
              interval={0}
              tickFormatter={(year: number) => (YEAR_TICKS.includes(year) ? String(year) : "")}
              {...axisProps}
            />
            <YAxis width={28} domain={[0, max]} ticks={ticks} {...axisProps} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as YearPoint | undefined;
                if (!active || !p || p.v === null) return null;
                return (
                  <TooltipBox title={`${p.year} · gemeten in ${percent(p.share)} van de uren`}>
                    gemiddeld {formatNumber(p.v)} µg/m³
                  </TooltipBox>
                );
              }}
            />
            <WhoLine who={who} />
            <Bar dataKey="v" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}>
              {points.map((p) => (
                <Cell key={p.year} fill={p.v === null ? "transparent" : annualColor(layer, p.v)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}

      {validYears.length >= MIN_TREND_YEARS && (
        <p className="text-muted-foreground text-xs">Jaargemiddelden {name} in µg/m³.</p>
      )}

      {/* sr-only on a wrapper: a table ignores the 1px height and overflow. */}
      <div className="sr-only">
        <table>
          <caption>Jaargemiddelden {QUANTITY_NAMES[layer]} in µg/m³</caption>
          <tbody>
            {points.map((p) => (
              <tr key={p.year}>
                <th scope="row">{p.year}</th>
                <td>{p.v === null ? "te weinig metingen" : formatNumber(p.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** An official station in the annual view (decision #42): its measured annual averages. */
export function AnnualStationDetails({
  station,
  layer,
  onClose,
}: {
  station: AnnualStation;
  layer: AnnualLayer;
  onClose: () => void;
}) {
  const value = annualValue(station, layer, ANNUAL_YEAR);
  return (
    <div className="grid content-start gap-5">
      <StationHeading station={station} onClose={onClose}>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <CalendarIcon className="size-3.5 shrink-0" aria-hidden />
          Jaargemiddelde {ANNUAL_YEAR}
          {value && value.share > 0 && <> · gemeten in {percent(value.share)} van de uren</>}
        </span>
      </StationHeading>

      <AnnualSummary station={station} layer={layer} />

      <div className="grid">
        {ANNUAL_LAYERS.map((l) => (
          <AnnualRow key={l.id} station={station} layer={l.id} />
        ))}
        <p className="text-muted-foreground border-t pt-2 text-xs">µg/m³, jaargemiddelde {ANNUAL_YEAR}.</p>
      </div>

      <YearChart key={`${station.id}-${layer}`} station={station} initial={layer} />
    </div>
  );
}
