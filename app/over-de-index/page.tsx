import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AirMark } from "@/components/air-mark";
import { LongTermBars } from "@/components/air/long-term-bars";
import { SiteHeader } from "@/components/site-header";
import {
  LKI_CATEGORIES,
  LKI_COLORS,
  NO_INDEX_COLOR,
  QUANTITY_NAMES,
  lkiCategory,
  type BandQuantity,
} from "@/lib/air-quality";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Hoe werkt de index? · Fyka Air",
  description: "Hoe de Luchtkwaliteitsindex werkt, en wat je op de kaart ziet.",
  alternates: { canonical: "/over-de-index" },
};

// One step of the LKI scale, with its number.
function Step({ index, className }: { index: number; className?: string }) {
  const { bg, fg } = LKI_COLORS[index - 1];
  return (
    <span
      className={cn(
        "grid size-6 place-items-center rounded-sm text-xs font-semibold tabular-nums ring-1 ring-black/15 ring-inset",
        className,
      )}
      style={{ background: bg, color: fg }}
    >
      {index}
    </span>
  );
}

// The map's dots: large for official stations, small for citizen sensors.
// `absent`: not on the index map, drawn as an empty dashed circle.
function Dot({ index, small, absent }: { index?: number; small?: boolean; absent?: boolean }) {
  return (
    <i
      className={cn(
        "shrink-0 rounded-full border border-[#8C939D] dark:border-[#64748B]",
        small ? "size-2.5" : "size-4",
        absent && "border-dashed",
      )}
      style={{ background: absent ? "transparent" : index ? LKI_COLORS[index - 1].bg : NO_INDEX_COLOR }}
      aria-hidden
    />
  );
}

// Example sub-indices on a warm summer afternoon: ozone is high, the rest low.
// Ordered by importance for health, as in the layer menu (decision #28).
const EXAMPLE: { quantity: BandQuantity; score: number }[] = [
  { quantity: "pm25", score: 2 },
  { quantity: "no2", score: 2 },
  { quantity: "o3", score: 7 },
  { quantity: "pm10", score: 1 },
];
const EXAMPLE_INDEX = Math.max(...EXAMPLE.map((e) => e.score));
const EXAMPLE_AVERAGE = Math.round(EXAMPLE.reduce((sum, e) => sum + e.score, 0) / EXAMPLE.length);

// What the index map shows (decisions #26, #30, #44).
const MAP_PARTS: { visual: React.ReactNode; title: string; text: string }[] = [
  {
    visual: (
      <span
        className="h-4 w-full rounded-sm opacity-70"
        style={{ background: `linear-gradient(90deg, ${LKI_COLORS[1].bg}, ${LKI_COLORS[2].bg}, ${LKI_COLORS[3].bg})` }}
        aria-hidden
      />
    ),
    title: "Gekleurd gebied",
    text: "Het RIVM berekent elk uur de index voor elke plek. Dat is een schatting, geen meting.",
  },
  {
    visual: (
      <span className="flex gap-1.5" aria-hidden>
        <Dot index={2} />
        <Dot index={4} />
        <Dot index={6} />
      </span>
    ),
    title: "Gekleurde stip",
    text: "Een officieel meetstation. De kleur is de index van dit uur op die plek.",
  },
  {
    visual: <Dot />,
    title: "Grijze stip",
    text: "Dit meetstation heeft nu geen volledige index, meestal omdat de ozon ontbreekt. Klik erop om te zien waarom.",
  },
  {
    visual: <Dot small absent />,
    title: "Geen burgersensoren",
    text: "Burgersensoren meten alleen fijnstof, dus geen volledige index. Je ziet ze op de kaarten PM2,5 en PM10.",
  },
];

const linkClass = "text-brand-text underline underline-offset-3 hover:no-underline";

/** "Hoe werkt de index?": the scale, the worst pollutant counts (decision #29), and what the index map shows (#30, #44). */
export default function OverDeIndex() {
  const result = lkiCategory(EXAMPLE_INDEX);
  const average = lkiCategory(EXAMPLE_AVERAGE);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-2xl content-start gap-10 px-4 pt-20 pb-16 sm:px-6">
        <div className="grid gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm">
            <ArrowLeftIcon className="size-4" aria-hidden />
            Naar de kaart
          </Link>
          <div className="flex items-center gap-3">
            <AirMark tile="size-10 shrink-0" />
            <h1 className="text-3xl font-bold tracking-tight">Hoe werkt de index?</h1>
          </div>
          <p className="text-lg">
            De Luchtkwaliteitsindex van het RIVM vertelt in één getal hoe schoon de lucht nu is: van 1 (goed) tot 11
            (zeer slecht).
          </p>
        </div>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Van 1 tot 11</h2>
          <ul className="bg-card grid gap-3 rounded-lg border p-4">
            {LKI_CATEGORIES.map((c) => (
              <li key={c.name} className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3">
                <span className="flex gap-0.5">
                  {Array.from({ length: c.to - c.from + 1 }, (_, i) => (
                    <Step key={i} index={c.from + i} />
                  ))}
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium leading-6">{c.name}</span>
                  <span className="text-muted-foreground text-sm">{c.advice}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">De slechtste stof telt</h2>
          <p>
            Elke stof krijgt een eigen score van 1 tot 11: fijnstof (PM2,5 en PM10), stikstofdioxide (NO₂) en ozon (O₃).
            De hoogste score is de index.
          </p>

          <figure className="bg-card grid gap-3 rounded-lg border p-4">
            <figcaption className="text-muted-foreground text-sm">Voorbeeld: een warme zomermiddag</figcaption>
            <div
              role="img"
              aria-label={`${EXAMPLE.map((e) => `${QUANTITY_NAMES[e.quantity]} ${e.score}`).join(", ")}. De index is ${EXAMPLE_INDEX}, het gemiddelde ${EXAMPLE_AVERAGE}.`}
              className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 text-sm"
            >
              <div className="grid auto-rows-6 gap-1.5 pt-6" aria-hidden>
                {EXAMPLE.map((e) => (
                  <span
                    key={e.quantity}
                    className={cn("self-center tabular-nums", e.score === EXAMPLE_INDEX ? "font-semibold" : "text-muted-foreground")}
                  >
                    {QUANTITY_NAMES[e.quantity]}
                  </span>
                ))}
              </div>
              <div className="relative grid auto-rows-6 gap-1.5 pt-6" aria-hidden>
                {/* The average, for comparison: it would hide the one pollutant that is bad. */}
                <span
                  className="border-foreground/60 absolute top-0 bottom-0 border-l border-dashed"
                  style={{ left: `${(EXAMPLE_AVERAGE / 11) * 100}%` }}
                >
                  <span className="text-muted-foreground absolute top-0 left-1.5 text-xs whitespace-nowrap">
                    gemiddeld {EXAMPLE_AVERAGE}
                  </span>
                </span>
                {EXAMPLE.map((e) => {
                  const { bg, fg } = LKI_COLORS[e.score - 1];
                  return (
                    <span
                      key={e.quantity}
                      className="flex min-w-6 items-center justify-end rounded-sm pr-1.5 text-xs font-semibold tabular-nums ring-1 ring-black/15 ring-inset"
                      style={{ width: `${(e.score / 11) * 100}%`, background: bg, color: fg }}
                    >
                      {e.score}
                    </span>
                  );
                })}
              </div>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-sm">
              <span className="font-medium">Index</span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-black/15 ring-inset"
                style={{ background: LKI_COLORS[EXAMPLE_INDEX - 1].bg, color: LKI_COLORS[EXAMPLE_INDEX - 1].fg }}
              >
                {EXAMPLE_INDEX} · {result.name}
              </span>
              <span className="text-muted-foreground">
                Het gemiddelde ({EXAMPLE_AVERAGE}, {average.name}) zou de ozon verstoppen.
              </span>
            </p>
          </figure>

          <p className="text-muted-foreground">
            Zo verstopt één schadelijke stof zich niet achter de rest. De indexen in Europa en de Verenigde Staten werken
            ook zo.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Wat zie je op de indexkaart?</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {MAP_PARTS.map((part) => (
              <li key={part.title} className="bg-card grid content-start gap-2 rounded-lg border p-4">
                <span className="flex h-5 items-center">{part.visual}</span>
                <span className="font-medium">{part.title}</span>
                <span className="text-muted-foreground text-sm">{part.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Nu en op lange termijn</h2>
          <p>
            De index gaat over de lucht van dit uur. Voor je gezondheid op lange termijn telt vooral wat je jaar in, jaar
            uit inademt: fijnstof (PM2,5) en stikstofdioxide (NO₂).
          </p>
          <figure className="bg-card grid gap-3 rounded-lg border p-4">
            <figcaption className="text-muted-foreground text-sm">Hoe zwaar elke stof weegt op lange termijn</figcaption>
            <LongTermBars labels className="text-sm" />
          </figure>
          <p className="text-muted-foreground">
            Hoe dat bij jou zit, zie je op de kaart onder{" "}
            <Link href="/?periode=jaar" className={linkClass}>
              Jaargemiddelde
            </Link>
            .
          </p>
        </section>

        <p className="text-muted-foreground border-t pt-4 text-sm">
          De index is de Luchtkwaliteitsindex (LKI) van het RIVM. Officiële waarden:{" "}
          <a href="https://www.luchtmeetnet.nl" target="_blank" rel="noopener noreferrer" className={linkClass}>
            luchtmeetnet.nl
          </a>
          . Algemene informatie, geen medisch advies.
        </p>
      </main>
    </div>
  );
}
