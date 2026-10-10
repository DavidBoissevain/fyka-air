"use client";

import { useMemo, type ReactNode } from "react";
import { ArrowUpRightIcon, InfoIcon } from "lucide-react";

import { AirMark } from "@/components/air-mark";
import { CoffeeIcon, GithubIcon } from "@/components/brand-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LKI_COLORS, type StationReading } from "@/lib/air-quality";
import { COFFEE_URL, GITHUB_URL } from "@/lib/links";
import { cn } from "@/lib/utils";

const count = (n: number) => n.toLocaleString("nl-NL");

// The map's dot for each kind, as in the legend.
function Dot({ large }: { large?: boolean }) {
  return (
    <i
      className={cn(
        "shrink-0 rounded-full border border-[#8C939D] dark:border-[#64748B]",
        large ? "size-3" : "size-1.75",
      )}
      style={{ background: LKI_COLORS[1].bg }}
      aria-hidden
    />
  );
}

type SourceProps = {
  title: string;
  large?: boolean;
  total: number;
  children: ReactNode;
};

function Source({ title, large, total, children }: SourceProps) {
  return (
    <section className="grid gap-1.5 rounded-lg border p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 font-semibold">
          <Dot large={large} />
          {title}
        </h3>
        <span className="text-2xl font-bold tabular-nums">{count(total)}</span>
      </div>
      {children}
    </section>
  );
}

const linkClass = "text-brand-text underline underline-offset-3 hover:no-underline";

/** What the map shows and where it comes from: counts per source and the largest sensor networks. */
export function DataInfo({ stations, className }: { stations: StationReading[]; className?: string }) {
  const summary = useMemo(() => {
    const sensors = stations.filter((s) => s.kind === "citizen");
    const networks = new Map<string, number>();
    for (const s of sensors) {
      const name = s.organisation ?? s.details.network ?? "Onbekend";
      networks.set(name, (networks.get(name) ?? 0) + 1);
    }
    return {
      official: stations.length - sensors.length,
      sensors: sensors.length,
      networkCount: networks.size,
      largest: [...networks].sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }, [stations]);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Over de data"
            className={cn("bg-card dark:bg-card size-10 shadow-lg", className)}
          />
        }
      >
        <InfoIcon />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Over de data</DialogTitle>
          <DialogDescription>
            Op de kaart staan nu {count(stations.length)} meetpunten met een recente meting. Ze komen uit twee
            bronnen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Source large title="Officiële meetstations" total={summary.official}>
            <p className="text-muted-foreground">
              Via{" "}
              <a href="https://www.luchtmeetnet.nl" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Luchtmeetnet
              </a>
              , van het RIVM, GGD&apos;s, DCMR en provincies. Nauwkeurige apparatuur die fijnstof, stikstofdioxide,
              ozon en meer meet.
            </p>
          </Source>

          <Source title="Burgersensoren" total={summary.sensors}>
            <p className="text-muted-foreground">
              Via{" "}
              <a href="https://www.samenmeten.nl" target="_blank" rel="noopener noreferrer" className={linkClass}>
                RIVM Samen Meten
              </a>
              . Sensoren van burgers, gemeenten en onderzoekers, in {summary.networkCount} netwerken. Ze
              meten vooral fijnstof. Het RIVM kalibreert de waarden tegen officiële meetstations in de buurt. Daardoor komen hun metingen ongeveer 2 uur later binnen.
            </p>
            {summary.largest.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Grootste netwerken:{" "}
                {summary.largest.map(([name, n]) => `${name} (${count(n)})`).join(", ")}.
              </p>
            )}
          </Source>

          {/* The RIVM area layer (decision #26). */}
          <section className="grid gap-1.5 rounded-lg border p-3.5">
            <h3 className="font-semibold">Gekleurd gebied</h3>
            <p className="text-muted-foreground">
              Elk uur berekend door het RIVM uit de metingen van de officiële meetstations, plus een model voor
              snelwegen. Het is een schatting, geen meting. Klik naast de stippen voor de waarde op die plek. Bron:{" "}
              <a href="https://www.luchtmeetnet.nl" target="_blank" rel="noopener noreferrer" className={linkClass}>
                luchtmeetnet.nl
              </a>
              .
            </p>
          </section>

          {/* Which dots get a colour on the index map (decision #30); the details are on their own page. */}
          <section className="grid gap-1.5 rounded-lg border p-3.5">
            <h3 className="font-semibold">Kleur van de stippen</h3>
            <p className="text-muted-foreground">
              Op de indexkaart krijgt een stip alleen een kleur als de index alle stoffen meeneemt. Burgersensoren meten
              alleen fijnstof en zijn daar grijs.{" "}
              <a href="/over-de-index" target="_blank" rel="noopener" className={cn(linkClass, "inline-flex items-center gap-0.5")}>
                Meer over de index
                <ArrowUpRightIcon className="size-3.5" aria-hidden />
                <span className="sr-only">(opent in een nieuw tabblad)</span>
              </a>
            </p>
          </section>
        </div>

        <p className="text-muted-foreground text-xs">
          Elk uur komen er nieuwe metingen bij. Een meetstation verdwijnt van de kaart als de laatste meting meer
          dan 3 uur oud is, een burgersensor na 5 uur.
        </p>

        {/* The header has no logo or project links, so the dialog carries them. */}
        <DialogFooter className="-mx-5 -mb-5 grid gap-3 p-5">
          <div className="flex items-center gap-3">
            <AirMark tile="size-9 shrink-0" />
            <p className="text-muted-foreground text-xs">
              <strong className="text-foreground font-semibold">Fyka Air</strong> is gratis en open source. Kijk mee
              in de code of steun de maker.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-card dark:bg-card")}
            >
              <GithubIcon className="size-4" />
              Bekijk de code
            </a>
            <a
              href={COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-yellow-400 font-semibold text-slate-900 hover:bg-yellow-500",
              )}
            >
              <CoffeeIcon className="size-4" />
              Steun mij
            </a>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
