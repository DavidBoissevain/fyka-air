"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAP_LAYERS, QUANTITY_NAMES, type BandQuantity, type MapLayer } from "@/lib/air-quality";
import { cn } from "@/lib/utils";

// Pollutant columns in health order, as in MAP_LAYERS (decision #28).
const POLLUTANTS: BandQuantity[] = ["pm25", "no2", "o3", "pm10"];

type Level = 1 | 2 | 3;
const LEVEL_NAMES: Record<Level, string> = { 1: "licht", 2: "matig", 3: "sterk" };

// How much each pollutant matters per group. A simplified reading of
// well-established links (WHO, EEA), not a medical score.
const GROUPS: { who: string; levels: Record<BandQuantity, Level> }[] = [
  { who: "Astma", levels: { pm25: 2, no2: 3, o3: 3, pm10: 2 } },
  { who: "COPD, longziekte", levels: { pm25: 3, no2: 1, o3: 2, pm10: 1 } },
  { who: "Hart en vaten", levels: { pm25: 3, no2: 1, o3: 1, pm10: 1 } },
  { who: "Kinderen", levels: { pm25: 3, no2: 3, o3: 1, pm10: 1 } },
  { who: "Ouderen", levels: { pm25: 3, no2: 1, o3: 2, pm10: 1 } },
  { who: "Buiten sporten", levels: { pm25: 1, no2: 2, o3: 3, pm10: 1 } },
];

type Explanation = { what: string; effect: string; high?: string; tip: string };

// Short background per layer, same health order as MAP_LAYERS.
const EXPLANATIONS: Partial<Record<MapLayer, Explanation>> = {
  lki: { what: "Alle stoffen samen; de slechtste telt.", effect: "Advies per niveau.", tip: "Goede eerste keuze." },
  pm25: {
    what: "Kleine deeltjes uit verbranding en landbouw.",
    effect: "Komt diep in longen en bloed. Hart, vaten en longen.",
    high: "Winter, windstil, houtstook, vuurwerk.",
    tip: "Beperk dan zware inspanning buiten.",
  },
  no2: {
    what: "Gas uit vooral dieselverkeer.",
    effect: "Prikkelt de luchtwegen, verergert astma.",
    high: "Langs drukke wegen, in de spits.",
    tip: "Kies rustige straten.",
  },
  o3: {
    what: "Zomersmog, ontstaat in zonlicht.",
    effect: "Hoesten en benauwd bij inspanning.",
    high: "Warme, zonnige middagen.",
    tip: "Sport dan 's ochtends.",
  },
  pm10: {
    what: "Grover stof, inclusief PM2,5.",
    effect: "Neus, keel en luchtwegen.",
    high: "Droog, winderig weer, bouw.",
    tip: "PM2,5 zegt meestal meer.",
  },
};

function LevelBlocks({ level, label }: { level: Level; label: string }) {
  return (
    <span className="mx-auto flex w-fit gap-0.5 py-1" title={label}>
      {([1, 2, 3] as const).map((i) => (
        // steel-500 in light mode: the lighter steel token is under 3:1 against the empty blocks.
        <i key={i} className={cn("h-2.5 w-3 rounded-xs", i <= level ? "bg-[#5B7BAA] dark:bg-steel" : "bg-muted")} aria-hidden />
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** "Welke kaart kies ik?": which pollutant matters for whom, and what each layer means (decision #28). */
export function LayerGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Welke kaart kies ik?</DialogTitle>
        </DialogHeader>

        <section className="grid gap-2">
          <h3 className="font-semibold">Waar let ik op?</h3>
          <table className="w-full text-sm">
            <caption className="sr-only">Hoe belangrijk elke stof is, per groep</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  Groep
                </th>
                {POLLUTANTS.map((q) => (
                  <th key={q} scope="col" className="text-muted-foreground px-1 pb-1 text-center text-xs font-medium">
                    {QUANTITY_NAMES[q]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <tr key={g.who} className="border-t">
                  <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                    {g.who}
                  </th>
                  {POLLUTANTS.map((q) => (
                    <td key={q} className="px-1">
                      <LevelBlocks
                        level={g.levels[q]}
                        label={`${g.who}, ${QUANTITY_NAMES[q]}: ${LEVEL_NAMES[g.levels[q]]}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {([3, 2, 1] as const).map((level) => (
              <span key={level} className="inline-flex items-center gap-1.5">
                <LevelBlocks level={level} label={LEVEL_NAMES[level]} />
                <span aria-hidden>{LEVEL_NAMES[level]}</span>
              </span>
            ))}
          </p>
        </section>

        <section className="grid gap-2.5">
          <h3 className="font-semibold">Per kaart</h3>
          {MAP_LAYERS.map((layer) => {
            const text = EXPLANATIONS[layer.id];
            if (!text) return null;
            const rows = [
              ["Wat", text.what],
              ["Effect", text.effect],
              ["Hoog bij", text.high],
              ["Tip", text.tip],
            ].filter((row): row is [string, string] => Boolean(row[1]));
            return (
              <article key={layer.id} className="grid gap-1.5 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">{layer.label}</h4>
                  {layer.tag && (
                    <Badge variant="outline" className="text-muted-foreground font-normal">
                      {layer.tag}
                    </Badge>
                  )}
                </div>
                <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5">
                  {rows.map(([term, value]) => (
                    <div key={term} className="contents">
                      <dt className="text-muted-foreground">{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </section>

        <p className="text-muted-foreground text-xs">
          Algemene informatie, geen medisch advies. Heb je klachten? Overleg met je huisarts of longarts.
        </p>
      </DialogContent>
    </Dialog>
  );
}
