"use client";

import { use, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHART_QUANTITIES,
  QUANTITY_NAMES,
  WHO_GUIDELINE,
  formatDay,
  formatNumber,
  formatTime,
  type ChartQuantity,
  type StationHistory,
  type StationReading,
} from "@/lib/air-quality";

// One series per chart, so no legend: the tab names what is plotted.
const config = { v: { label: "Waarde", color: "var(--brand-text)" } } satisfies ChartConfig;

// Keyed by station and its latest measurement, so new hourly data refetches.
const historyCache = new Map<string, Promise<StationHistory | null>>();
function loadHistory(id: number, measuredAt: string) {
  const key = `${id}:${measuredAt}`;
  let promise = historyCache.get(key);
  if (!promise) {
    promise = fetch(`/api/stations/${id}/history`)
      .then((res) => (res.ok ? (res.json() as Promise<StationHistory>) : null))
      .catch(() => null);
    historyCache.set(key, promise);
  }
  return promise;
}

// Rounds the y-axis up to a clean maximum that always includes the WHO line.
function yAxis(values: number[], who: number) {
  const top = Math.max(who * 1.25, ...values.map((v) => v * 1.1));
  const step = top > 60 ? 20 : top > 30 ? 10 : 5;
  const max = Math.ceil(top / step) * step;
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) };
}

const axisProps = { tickLine: false, axisLine: false, fontSize: 10 } as const;

function TooltipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-popover grid gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-lg">
      <span className="text-muted-foreground">{title}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  );
}

function WhoLine({ who }: { who: number }) {
  return (
    <ReferenceLine
      y={who}
      stroke="var(--foreground)"
      strokeOpacity={0.6}
      strokeWidth={1.25}
      strokeDasharray="4 3"
      label={{ value: `WHO ${who}`, position: "insideTopRight", fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
    />
  );
}

function DayChart({ points, who }: { points: { t: number; v: number | null }[]; who: number }) {
  const values = points.flatMap((p) => (p.v === null ? [] : [p.v]));
  const { max, ticks } = yAxis(values, who);
  const last = points.findLast((p) => p.v !== null);
  const first = points[0].t;
  const end = points.at(-1)!.t;
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <AreaChart data={points} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[first, end]}
          ticks={[first, first + 6 * 3_600_000, first + 12 * 3_600_000, first + 18 * 3_600_000, end]}
          tickFormatter={(t: number) => formatTime(new Date(t).toISOString())}
          {...axisProps}
        />
        <YAxis width={28} domain={[0, max]} ticks={ticks} {...axisProps} />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as { t: number; v: number | null } | undefined;
            if (!active || !point || point.v === null) return null;
            return (
              <TooltipBox title={`Uur tot ${formatTime(new Date(point.t).toISOString())}`}>
                {formatNumber(point.v)} µg/m³
              </TooltipBox>
            );
          }}
        />
        <WhoLine who={who} />
        <Area
          dataKey="v"
          type="monotone"
          stroke="var(--color-v)"
          strokeWidth={2}
          fill="var(--color-v)"
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
        />
        {last && last.v !== null && (
          <ReferenceDot x={last.t} y={last.v} r={4} fill="var(--color-v)" stroke="var(--card)" strokeWidth={2} />
        )}
      </AreaChart>
    </ChartContainer>
  );
}

function WeekChart({ days, who }: { days: { day: string; v: number | null; hours: number }[]; who: number }) {
  const { max, ticks } = yAxis(days.flatMap((d) => (d.v === null ? [] : [d.v])), who);
  const today = days.at(-1)!.day;
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <BarChart data={days} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="day" tickFormatter={(day: string) => (day === today ? "vandaag" : formatDay(day))} {...axisProps} />
        <YAxis width={28} domain={[0, max]} ticks={ticks} {...axisProps} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as { day: string; v: number | null; hours: number } | undefined;
            if (!active || !d || d.v === null) return null;
            return (
              <TooltipBox title={`${formatDay(d.day, true)} · ${d.hours} van 24 uur`}>
                gemiddeld {formatNumber(d.v)} µg/m³
              </TooltipBox>
            );
          }}
        />
        <WhoLine who={who} />
        <Bar dataKey="v" fill="var(--color-v)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

export function StationChart({ station }: { station: StationReading }) {
  const history = use(loadHistory(station.id, station.measured_at));
  const available = CHART_QUANTITIES.filter((q) => history?.hourly[q] && WHO_GUIDELINE[q]);
  const [quantity, setQuantity] = useState<ChartQuantity | undefined>(
    available.includes("pm25") ? "pm25" : available[0],
  );
  const [period, setPeriod] = useState<"day" | "week">("day");

  if (!history) {
    return <p className="text-muted-foreground text-sm">Het verloop kon niet worden geladen. Probeer het later opnieuw.</p>;
  }
  if (!quantity) return null;

  const who = WHO_GUIDELINE[quantity]!;
  const hourly = history.hourly[quantity]!.map((p) => ({ t: Date.parse(p.t), v: p.v }));
  const daily = history.daily[quantity]!;
  const count = period === "day" ? hourly.filter((p) => p.v !== null).length : daily.filter((d) => d.v !== null).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Verloop</h3>
        <Tabs value={period} onValueChange={(value) => setPeriod(value as "day" | "week")}>
          <TabsList>
            <TabsTrigger value="day" className="px-3 text-xs">24 uur</TabsTrigger>
            <TabsTrigger value="week" className="px-3 text-xs">7 dagen</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {available.length > 1 && (
        <Tabs value={quantity} onValueChange={(value) => setQuantity(value as ChartQuantity)}>
          <TabsList variant="line" aria-label="Stof">
            {available.map((q) => (
              <TabsTrigger key={q} value={q} className="px-2 text-xs">
                {QUANTITY_NAMES[q]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {count < 2 ? (
        <p className="bg-muted text-muted-foreground rounded-lg p-3.5 text-sm">
          Nog te weinig metingen voor deze periode. We verzamelen sinds 5 oktober 2026.
        </p>
      ) : period === "day" ? (
        <DayChart points={hourly} who={who} />
      ) : (
        <WeekChart days={daily} who={who} />
      )}

      <p className="text-muted-foreground text-xs">
        {period === "day" ? "Uurwaarden" : "Daggemiddelden"} {QUANTITY_NAMES[quantity]} in µg/m³. De stippellijn is de
        WHO-advieswaarde voor een daggemiddelde.
      </p>

      {/* sr-only on a wrapper: a table ignores the 1px height and overflow, so
          its rows would still add scroll height. */}
      <div className="sr-only">
        <table>
          <caption>
            {period === "day" ? "Uurwaarden" : "Daggemiddelden"} {QUANTITY_NAMES[quantity]} in µg/m³
          </caption>
          <tbody>
            {period === "day"
              ? hourly.map((p) => (
                  <tr key={p.t}>
                    <th scope="row">{formatTime(new Date(p.t).toISOString())}</th>
                    <td>{p.v === null ? "geen meting" : formatNumber(p.v)}</td>
                  </tr>
                ))
              : daily.map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{formatDay(d.day, true)}</th>
                    <td>{d.v === null ? "geen meting" : formatNumber(d.v)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
