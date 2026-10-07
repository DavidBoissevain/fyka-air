"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAP_LAYERS, type MapLayer } from "@/lib/air-quality";

type Explanation = { what: string; health: string; when: string; tip: string };

// Plain-Dutch background per layer, in the same health order as MAP_LAYERS (decision #28).
const EXPLANATIONS: Partial<Record<MapLayer, Explanation>> = {
  lki: {
    what: "Combineert stikstofdioxide, ozon en fijnstof (PM10 en PM2,5). De stof met de slechtste score bepaalt de index.",
    health: "Bij elk niveau hoort een advies, van “geen klachten te verwachten” tot “vermijd zware inspanning buiten”.",
    when: "Laat zien hoe de lucht nu is. De grootste schade aan je gezondheid komt van jarenlang vieze lucht.",
    tip: "Een goede eerste keuze. Weet je waar je gevoelig voor bent? Kijk dan ook naar die stof.",
  },
  pm25: {
    what: "Heel kleine stofdeeltjes uit verbranding (verkeer, houtstook, industrie) en uit stoffen die in de lucht samenklonteren, zoals ammoniak uit de landbouw.",
    health:
      "Komt diep in je longen en in je bloed. Op lange termijn de grootste oorzaak van ziekte door luchtvervuiling: hart- en vaatziekten, longziekten en longkanker. Kan astma en COPD verergeren.",
    when: "Vooral in de winter bij koud, windstil weer, bij houtstook en vuurwerk, en bij oostenwind.",
    tip: "Is het hoog? Beperk zware inspanning buiten, zeker met een hart- of longziekte.",
  },
  no2: {
    what: "Een gas uit uitlaatgassen, vooral van dieselverkeer, en uit de industrie.",
    health: "Prikkelt de luchtwegen en maakt astma erger. Kinderen die langs drukke wegen opgroeien krijgen vaker astma.",
    when: "Langs drukke wegen en in de spits, vooral bij windstil weer. Een paar honderd meter van de weg is het al veel minder.",
    tip: "Fiets of wandel via rustige straten in plaats van langs een drukke weg.",
  },
  o3: {
    what: "Ontstaat in zonlicht uit uitlaatgassen en andere stoffen. Ook wel zomersmog genoemd.",
    health: "Prikkelt ogen, neus en luchtwegen. Kan hoesten, een benauwd gevoel en minder longfunctie geven, vooral als je je inspant.",
    when: "Op warme, zonnige dagen, vooral 's middags en in het begin van de avond. Vaak hoger buiten de stad dan in de stad.",
    tip: "Sport op warme zomerdagen liever 's ochtends.",
  },
  pm10: {
    what: "Grotere stofdeeltjes, plus het fijnere PM2,5. Van slijtage van wegen en banden, bouw, landbouw, zand en zeezout.",
    health: "Blijft vooral in neus, keel en de grote luchtwegen. Kan hoesten en irritatie geven en astma verergeren.",
    when: "Bij droog, winderig weer en bij bouwwerk, en ook als er veel PM2,5 in de lucht is.",
    tip: "Telt mee in de index. Voor je gezondheid zegt PM2,5 meestal meer.",
  },
};

// Who should look at what. Kept to well-established links.
const GROUPS: { who: string; look: string }[] = [
  { who: "Astma", look: "Stikstofdioxide langs drukke wegen, ozon op zomerdagen en fijnstof PM2,5." },
  { who: "COPD of een andere longziekte", look: "Fijnstof PM2,5 en ozon." },
  { who: "Hart- of vaatziekte", look: "Fijnstof PM2,5." },
  { who: "Kinderen", look: "Stikstofdioxide en fijnstof PM2,5. Hun longen groeien nog." },
  { who: "Ouderen", look: "Fijnstof PM2,5 en ozon." },
  { who: "Buiten sporten", look: "Ozon op warme middagen, stikstofdioxide langs drukke wegen." },
];

/** "Welke kaart kies ik?": what each layer means for health, and who should look at which (decision #28). */
export function LayerGuide({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: MapLayer;
  onChange: (layer: MapLayer) => void;
}) {
  const active = MAP_LAYERS.find((l) => l.id === value) ?? MAP_LAYERS[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Welke kaart kies ik?</DialogTitle>
          <DialogDescription>
            Alle kaarten gebruiken dezelfde kleuren, van blauw (goed) via geel naar paars (zeer slecht). Begin met de
            luchtkwaliteitsindex. Ben je gevoelig voor een bepaalde stof? Kijk dan ook naar die kaart.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted grid gap-0.5 rounded-md px-3 py-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">Nu op de kaart</span>
          <span className="font-semibold">{active.label}</span>
        </div>

        <section className="grid gap-2">
          <h3 className="font-semibold">Waar let ik op?</h3>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {GROUPS.map((g) => (
              <div key={g.who} className="contents">
                <dt className="font-medium">{g.who}</dt>
                <dd className="text-muted-foreground -mt-1.5 sm:mt-0">{g.look}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-3">
          <h3 className="font-semibold">Per kaart, belangrijkste eerst</h3>
          {MAP_LAYERS.map((layer) => {
            const text = EXPLANATIONS[layer.id];
            if (!text) return null;
            const isActive = layer.id === value;
            return (
              <article key={layer.id} className="grid gap-2 rounded-lg border p-3.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">{layer.label}</h4>
                  {layer.tag && (
                    <Badge variant="outline" className="text-muted-foreground font-normal">
                      {layer.tag}
                    </Badge>
                  )}
                </div>
                <dl className="text-muted-foreground grid gap-1.5">
                  <div>
                    <dt className="text-foreground inline font-medium">Wat is het? </dt>
                    <dd className="inline">{text.what}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">Gezondheid: </dt>
                    <dd className="inline">{text.health}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">Wanneer hoog? </dt>
                    <dd className="inline">{text.when}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">Tip: </dt>
                    <dd className="inline">{text.tip}</dd>
                  </div>
                </dl>
                <Button
                  variant={isActive ? "secondary" : "outline"}
                  size="sm"
                  disabled={isActive}
                  className="justify-self-start"
                  onClick={() => {
                    onChange(layer.id);
                    onOpenChange(false);
                  }}
                >
                  {isActive ? "Staat nu op de kaart" : "Toon op de kaart"}
                </Button>
              </article>
            );
          })}
        </section>

        <p className="text-muted-foreground text-xs">
          Dit is algemene informatie, geen medisch advies. Heb je klachten? Overleg met je huisarts of longarts.
        </p>
      </DialogContent>
    </Dialog>
  );
}
