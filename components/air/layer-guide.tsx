"use client";

import { ArrowRightIcon, CheckIcon, ClockIcon, HeartPulseIcon } from "lucide-react";

import { LongTermBars } from "@/components/air/long-term-bars";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setMapPeriod, useMapPeriod } from "@/hooks/use-map-period";
import { ANNUAL_LAYERS, ANNUAL_YEAR, LKI_COLORS, MAP_LAYERS, type MapPeriod } from "@/lib/air-quality";
import { cn } from "@/lib/utils";

function Card({
  icon,
  when,
  title,
  active,
  action,
  onShow,
  children,
}: {
  icon: React.ReactNode;
  when: string;
  title: string;
  // This card's mode is on the map now.
  active: boolean;
  action: string;
  onShow: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("grid grid-rows-[auto_auto_1fr_auto] gap-2 rounded-lg border p-3", active && "border-brand-text/40")}>
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {when}
      </span>
      <h3 className="font-semibold leading-tight">{title}</h3>
      <div className="grid content-start gap-2">{children}</div>
      {active ? (
        <span className="text-muted-foreground inline-flex h-8 items-center gap-1.5 text-xs">
          <CheckIcon className="size-3.5" aria-hidden />
          Staat nu op de kaart
        </span>
      ) : (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={onShow}>
          {action}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      )}
    </section>
  );
}

/**
 * "Welke kaart kies ik?": the index for now, PM2.5 and NO2 for long-term
 * health, each with a button to its mode (decisions #28, #36), and one line per
 * layer of the current mode.
 */
export function LayerGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const period = useMapPeriod();
  const show = (next: MapPeriod) => {
    setMapPeriod(next);
    onOpenChange(false);
  };
  const layers = period === "jaar" ? ANNUAL_LAYERS : MAP_LAYERS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Welke kaart kies ik?</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Card
            icon={<ClockIcon className="size-3.5" aria-hidden />}
            when="Nu"
            title="Luchtkwaliteitsindex"
            active={period === "nu"}
            action="Bekijk de lucht van nu"
            onShow={() => show("nu")}
          >
            <p className="text-muted-foreground">Hoe is de lucht dit uur? Begin hier.</p>
            <div className="grid gap-1 pt-1">
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

          <Card
            icon={<HeartPulseIcon className="size-3.5" aria-hidden />}
            when="Op lange termijn"
            title="PM2,5 en NO₂"
            active={period === "jaar"}
            action="Bekijk het jaargemiddelde"
            onShow={() => show("jaar")}
          >
            <p className="text-muted-foreground">
              Wat je jaren inademt, telt het zwaarst. Het jaargemiddelde van {ANNUAL_YEAR} laat zien hoe dat bij jou zit.
            </p>
            <LongTermBars className="pt-1" />
          </Card>
        </div>

        <section className="grid gap-2 text-sm">
          <h3 className="font-semibold">{period === "jaar" ? "De kaarten van het jaargemiddelde" : "De kaarten van nu"}</h3>
          <dl className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[auto_1fr]">
            {layers.map((layer) => (
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
