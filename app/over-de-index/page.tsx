import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AirMark } from "@/components/air-mark";
import { SiteHeader } from "@/components/site-header";
import { LKI_COLORS, NO_INDEX_COLOR } from "@/lib/air-quality";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Hoe werkt de index? · Fyka Air",
  description: "Hoe de Luchtkwaliteitsindex werkt, en welke stippen op de kaart een kleur krijgen.",
};

// The map's dots: large for official stations, small for citizen sensors.
// `absent`: not on the index map, drawn as an empty dashed circle.
function Dot({ large, grey, absent }: { large?: boolean; grey?: boolean; absent?: boolean }) {
  return (
    <i
      className={cn(
        "shrink-0 rounded-full border border-[#8C939D] dark:border-[#64748B]",
        large ? "size-3.5" : "size-2",
        absent && "border-dashed",
      )}
      style={{ background: absent ? "transparent" : grey ? NO_INDEX_COLOR : LKI_COLORS[3].bg }}
      aria-hidden
    />
  );
}

// Which dots get a colour on the index map (decisions #30, #44).
const DOTS: { large?: boolean; grey?: boolean; absent?: boolean; who: string; what: string }[] = [
  { large: true, who: "Meetstation dat ozon meet", what: "Kleur: de index uit de eigen metingen." },
  {
    large: true,
    who: "Meetstation zonder ozonmeter",
    what: "Kleur. Luchtmeetnet rekent met een schatting van de ozon op die plek.",
  },
  {
    large: true,
    who: "Nieuwste uur nog niet compleet",
    what: "Kleur van het uur ervoor, tot de ozonmetingen van het nieuwste uur binnen zijn.",
  },
  {
    large: true,
    grey: true,
    who: "Ozonmeter geeft geen waarden",
    what: "Grijs. Luchtmeetnet vult dan geen schatting in, dus de index mist de ozon.",
  },
  {
    large: true,
    grey: true,
    who: "Meetstation zonder ozonschatting",
    what: "Grijs. Bij een paar stations rekent Luchtmeetnet de ozon nooit mee, dus de index is te laag als ozon de doorslag geeft.",
  },
  {
    absent: true,
    who: "Burgersensor",
    what: "Niet op de indexkaart. Meet alleen fijnstof, dus geen volledige index. Kies de kaart PM2,5 of PM10 om ze te zien.",
  },
];

const linkClass = "text-brand-text underline underline-offset-3 hover:no-underline";

/** "Hoe werkt de index?": the worst pollutant counts, and which dots get a colour (decisions #29 and #30). */
export default function OverDeIndex() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-2xl content-start gap-8 px-4 pt-20 pb-16 sm:px-6">
        <div className="grid gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm">
            <ArrowLeftIcon className="size-4" aria-hidden />
            Naar de kaart
          </Link>
          <div className="flex items-center gap-3">
            <AirMark tile="size-10 shrink-0" />
            <h1 className="text-3xl font-bold tracking-tight">Hoe werkt de index?</h1>
          </div>
        </div>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">De slechtste stof telt</h2>
          <p>
            Elke stof krijgt een eigen score van 1 tot 11: fijnstof (PM2,5 en PM10), stikstofdioxide (NO₂) en ozon
            (O₃). De index is de hoogste score. De stof die het slechtst scoort, bepaalt dus de index.
          </p>
          <p className="text-muted-foreground">
            Waarom geen gemiddelde? Stel dat fijnstof 9 scoort (Slecht) en de rest 2. Gemiddeld is dat ongeveer 4
            (Matig), terwijl de lucht slecht is om in te ademen. Een gemiddelde verstopt zo één schadelijke stof.
            Daarom werkt de index van het RIVM zo, net als de indexen in Europa en de Verenigde Staten.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Welke stip krijgt een kleur?</h2>
          <p className="text-muted-foreground">
            Op de indexkaart krijgt een stip alleen een kleur als de index alle stoffen meeneemt, gemeten of geschat.
            Een grijze stip heeft nu geen volledige index. Wat de gekozen stof helemaal niet meet, staat niet op de
            kaart, zoals burgersensoren op de indexkaart.
          </p>
          <ul className="grid gap-2">
            {DOTS.map((dot) => (
              <li key={dot.who} className="bg-card grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 rounded-lg border p-3.5">
                <span className="grid h-6 place-items-center">
                  <Dot large={dot.large} grey={dot.grey} absent={dot.absent} />
                </span>
                <div className="grid gap-0.5">
                  <span className="font-medium">{dot.who}</span>
                  <span className="text-muted-foreground">{dot.what}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Nu en op lange termijn</h2>
          <p className="text-muted-foreground">
            De index gaat over de lucht van dit uur. Voor je gezondheid op lange termijn tellen vooral fijnstof
            (PM2,5) en stikstofdioxide (NO₂): wat je daarvan jaar in, jaar uit inademt. Ook op een dag met een lage
            index kan dat spelen. Hoe dat bij jou zit, zie je op de kaart onder{" "}
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
