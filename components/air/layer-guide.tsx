"use client";

import { ClockIcon, HeartPulseIcon } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LKI_COLORS, MAP_LAYERS, QUANTITY_NAMES, type BandQuantity } from "@/lib/air-quality";
import { cn } from "@/lib/utils";

// How much each pollutant weighs for long-term health, as a bar length. A
// simplified reading of well-established links (WHO 2021, EEA burden
// estimates), not a medical score. PM10 is short because it largely overlaps PM2.5.
const LONG_TERM: { quantity: BandQuantity; weight: number; label: string }[] = [
  { quantity: "pm25", weight: 1, label: "zwaarst" },
  { quantity: "no2", weight: 0.55, label: "zwaar" },
  { quantity: "o3", weight: 0.2, label: "minder" },
  { quantity: "pm10", weight: 0.2, label: "minder" },
];
const MAIN: BandQuantity[] = ["pm25", "no2"];

function Card({ icon, when, title, children }: { icon: React.ReactNode; when: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-2 rounded-lg border p-3">
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {when}
      </span>
      <h3 className="font-semibold leading-tight">{title}</h3>
      {children}
    </section>
  );
}

/** "Welke kaart kies ik?": the index for now, PM2.5 and NO2 for long-term health, and one line per layer (decision #28). */
export function LayerGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Welke kaart kies ik?</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Card icon={<ClockIcon className="size-3.5" aria-hidden />} when="Nu" title="Luchtkwaliteitsindex">
            <p className="text-muted-foreground">Hoe is de lucht dit uur? Begin hier.</p>
            <div className="mt-auto grid gap-1 pt-1">
              <div className="grid grid-cols-11 gap-0.5">
                {LKI_COLORS.map((c, i) => (
                  <span key={i} className="h-2 rounded-xs ring-1 ring-black/15 ring-inset" style={{ background: c.bg }} />
                ))}
              </div>
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Goed</span>
                <span>Zeer slecht</span>
              </div>
            </div>
          </Card>

          <Card icon={<HeartPulseIcon className="size-3.5" aria-hidden />} when="Op lange termijn" title="PM2,5 en NO₂">
            <p className="text-muted-foreground">Wat je jaren inademt, telt het zwaarst.</p>
            <dl className="grid grid-cols-[2.75rem_1fr] items-center gap-x-2 gap-y-1 pt-1 text-xs">
              {LONG_TERM.map(({ quantity, weight, label }) => {
                const main = MAIN.includes(quantity);
                return (
                  <div key={quantity} className="contents">
                    <dt className={cn("tabular-nums", main ? "font-semibold" : "text-muted-foreground")}>
                      {QUANTITY_NAMES[quantity]}
                    </dt>
                    <dd>
                      {/* steel-500 in light mode: the lighter steel token is under 3:1 against the card. */}
                      <span
                        className={cn("block h-2 rounded-xs", main ? "bg-[#5B7BAA] dark:bg-steel" : "bg-[#5B7BAA]/30 dark:bg-steel/30")}
                        style={{ width: `${weight * 100}%` }}
                      />
                      <span className="sr-only">{label}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        </div>

        <section className="grid gap-2 text-sm">
          <h3 className="font-semibold">De kaarten</h3>
          <dl className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[auto_1fr]">
            {MAP_LAYERS.map((layer) => (
              <div key={layer.id} className="contents">
                <dt className="font-medium">{layer.label}</dt>
                <dd className="text-muted-foreground mb-1 sm:mb-0">{layer.hint}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-muted-foreground text-xs">Algemene informatie, geen medisch advies.</p>
      </DialogContent>
    </Dialog>
  );
}
