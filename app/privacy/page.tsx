import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AirMark } from "@/components/air-mark";
import { SiteHeader } from "@/components/site-header";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Privacy · Luchtmeter",
  description: "Wat Luchtmeter over je bijhoudt (bijna niets), en welke diensten je browser gebruikt.",
  alternates: { canonical: "/privacy" },
};

const linkClass = "text-brand-text underline underline-offset-3 hover:no-underline";

// Where a visitor's browser loads things from, besides Luchtmeter itself.
const SERVICES = [
  { name: "Vercel", what: "Host van de site. Bewaart je IP-adres kort in zijn logboeken, om de site draaiend en veilig te houden. Vercel is een Amerikaans bedrijf." },
  { name: "OpenFreeMap", what: "De achtergrondkaart: wegen, water en plaatsnamen." },
  { name: "PDOK (Kadaster)", what: "De zoekdienst van de Nederlandse overheid voor adressen en plaatsen." },
  { name: "unpkg", what: "Een stukje code dat de kaart nodig heeft om te tekenen." },
];

/** The privacy page (decision #48): what Luchtmeter keeps, and which services the browser talks to. */
export default function Privacy() {
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
            <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
          </div>
          <p className="text-lg">
            Kort gezegd: Luchtmeter vraagt niets van je. Geen account, geen cookies, en ik weet niet wie je bent.
          </p>
          <p className="text-muted-foreground text-sm">Bijgewerkt in oktober 2026.</p>
        </div>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Wat Luchtmeter bijhoudt</h2>
          <p className="text-muted-foreground">
            Bezoeken tel ik met{" "}
            <a href="https://watch.fyka.me/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Fyka Watch
            </a>
            , mijn eigen meettool. Die ziet welke pagina je bekijkt, van welke site je kwam, uit welk land je komt en
            wat voor apparaat en browser je gebruikt. Fyka Watch zet geen cookies en bewaart je IP-adres niet. Het
            maakt een anonieme code die elke dag verandert, dus je bent niet over meerdere dagen te volgen.
          </p>
          <p className="text-muted-foreground">
            Zo zie ik hoeveel mensen de kaart gebruiken en wat beter kan. Meer niet: geen profielen, geen reclame, en
            niets wordt verkocht.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">In je eigen browser</h2>
          <p className="text-muted-foreground">
            Je browser onthoudt welke kaart je koos (Nu of Jaargemiddelde, en de kaartlaag), je instellingen en of je
            de site licht of donker wilt. Zo opent de kaart de volgende keer hetzelfde. Dat blijft op je eigen apparaat en gaat nergens
            heen. Wis je je browsergegevens, dan is het weg.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Je locatie</h2>
          <p className="text-muted-foreground">
            Gebruik je de knop voor je locatie, dan vraagt je browser eerst om toestemming. Je locatie blijft in je
            browser: de kaart zoomt er alleen naartoe. Luchtmeter bewaart of verstuurt hem niet. Wel laadt de kaart
            daarna de kaartstukjes van die buurt, net als wanneer je er zelf naartoe schuift.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Zoeken en klikken op de kaart</h2>
          <p className="text-muted-foreground">
            Wat je in het zoekvak typt, gaat rechtstreeks van je browser naar PDOK, de zoekdienst van de overheid. Zo
            vind je adressen en plaatsen.
          </p>
          {/* The rounding is POINT_DECIMALS in lib/air-quality.ts (decision #46). */}
          <p className="text-muted-foreground">
            Zet je in de instellingen aan dat je de waarde ziet waar je klikt, en klik je op de kaart, dan vraagt
            Luchtmeter bij het RIVM de berekende waarde op die plek op, afgerond op
            ongeveer 100 meter (in de jaarkaart 10 meter). Het RIVM ziet dan Luchtmeter, niet jou.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Diensten die je browser gebruikt</h2>
          <p className="text-muted-foreground">
            Net als bij elke website ziet een dienst je IP-adres als je browser er iets van laadt. Luchtmeter gebruikt:
          </p>
          <ul className="grid gap-2">
            {SERVICES.map((s) => (
              <li key={s.name} className="bg-card grid gap-0.5 rounded-lg border p-3.5">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">{s.what}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            De metingen staan in een database bij Supabase. Je browser praat daar niet mee, en er staat niets over
            bezoekers in.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Links naar andere sites</h2>
          <p className="text-muted-foreground">
            Volg je een link naar bijvoorbeeld GitHub, Buy Me a Coffee, Luchtmeetnet of Samen Meten, dan geldt daar
            hun eigen privacybeleid.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Over de cijfers</h2>
          <p className="text-muted-foreground">
            Luchtmeter is een hobbyproject van één persoon. De metingen van de laatste uren zijn voorlopig: Luchtmeetnet
            en het RIVM controleren ze later nog. Het gekleurde gebied is een berekening van het RIVM, geen meting. Zie
            de kaart als een goede indicatie, niet als medisch advies. Officiële waarden staan op{" "}
            <a href="https://www.luchtmeetnet.nl" target="_blank" rel="noopener noreferrer" className={linkClass}>
              luchtmeetnet.nl
            </a>
            .
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Vragen en je rechten</h2>
          <p className="text-muted-foreground">
            Luchtmeter is gemaakt door David Boissevain. De site bewaart niets waarmee je te herkennen bent, dus er is
            weinig om in te zien of te wissen. Heb je een vraag, mail dan naar{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
              {CONTACT_EMAIL}
            </a>
            . Ben je het ergens niet mee eens, dan kun je ook een klacht indienen bij de{" "}
            <a
              href="https://www.autoriteitpersoonsgegevens.nl"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Autoriteit Persoonsgegevens
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
