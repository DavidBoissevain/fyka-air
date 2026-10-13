# Luchtmeter

An open source map of air quality in the Netherlands: **[luchtmeter.sprintapps.net](https://luchtmeter.sprintapps.net)**

Luchtmeter shows the official RIVM measuring stations and about 2,200 citizen sensors on one map, coloured by the Luchtkwaliteitsindex (LKI). It's honest about the data: official values are kept apart from citizen sensors, calibrated values from raw ones, and every reading says how old it is. A second mode, "Jaargemiddelde", shows annual averages for PM2,5 and NO₂ against the WHO guideline and the EU limit for 2030.

The app is in Dutch. See [VISION.md](VISION.md) for why it exists.

## Data

| Source | What | License |
|---|---|---|
| [Luchtmeetnet](https://www.luchtmeetnet.nl/) | Official stations: NO₂, PM10, PM2,5, O₃, LKI | Open, attribution requested |
| [RIVM Samen Meten](https://samenmeten.rivm.nl/dataportaal/) | Citizen sensors, PM2,5 and PM10 calibrated by RIVM | CC0 |
| RIVM model maps | The calculated area layer, hourly and annual | Credit www.luchtmeetnet.nl |
| [PDOK Locatieserver](https://www.pdok.nl/) | Address search, called from the browser | Public government API |

Supabase Edge Functions collect the measurements into Postgres on a `pg_cron` schedule. The web app only reads.

## Stack

Next.js 16 (App Router, React 19), Tailwind CSS v4, shadcn/ui on Base UI, MapLibre GL with OpenFreeMap basemaps, Recharts, and Supabase. Hosted on Vercel.

> This Next.js version has breaking changes. Check `node_modules/next/dist/docs/` before relying on older docs (see [AGENTS.md](AGENTS.md)).

## Getting started

Requires Node.js 22.6 or newer.

```sh
npm install
cp .env.example .env.local   # fill in SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Open [localhost:3000](http://localhost:3000). The publishable key only allows reads, so a local setup can safely point at the production database.

To run your own database and collectors, follow [supabase/README.md](supabase/README.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run lint` | ESLint |
| `npm run probe:luchtmeetnet`, `probe:samenmeten` | Measure the source APIs (speed, coverage) |
| `npm run check:luchtmeetnet`, `check:samenmeten` | Test the collectors' API clients without Supabase |
| `npm run import:annual -- --from 2012 --to 2025` | Compute annual station averages from RIVM's validated yearly files and write a migration |

## Layout

```
app/                  Pages and API routes (RIVM map tiles, station history)
components/air/       Map, layers, station panel, charts
components/ui/        shadcn/ui components
lib/                  Data access, LKI and WHO scales, Dutch formatting, map style
supabase/             Schema migrations and the two collector Edge Functions
scripts/              Probes, client checks, annual import
docs/design/          Huisstijl (visual reference, open in a browser)
```

## Documentation

- [TECHNICAL.md](TECHNICAL.md): data-source quirks, schema, decision log, next steps
- [CLAUDE.md](CLAUDE.md): UI rules (colours, type, copy) summarizing the [huisstijl](docs/design/huisstijl.html)
- [supabase/README.md](supabase/README.md): collectors, schedules, setting up an environment

## License

[EUPL-1.2](LICENSE). Data © RIVM and the respective sensor networks. The Figtree font is under the [OFL](assets/fonts/OFL.txt).
