@AGENTS.md

# Project state

Decisions, data-source quirks, the schema and what to do next are in [TECHNICAL.md](TECHNICAL.md). Read its "Next steps" and "Open points" sections before starting new work, and record new decisions in its decision log.

# UI reference: the huisstijl

Before building or changing any UI, follow the Fyka Air huisstijl in [docs/design/huisstijl.html](docs/design/huisstijl.html). Open it in a browser to see the map, station panel, colours, type and components in light and dark mode. The rules below are the summary; the page is the visual reference. The page's readings and the citizen sensors on its map are example data.

## Colour

- **Interface:** use the Fyka base tokens, shared with fyka-website.

  | Token | Light | Dark |
  |---|---|---|
  | background | `#EEF1F5` | `#0F172A` |
  | surface | `#F8FAFC` | `#1E293B` |
  | surface hover | `#E8EBF0` | `#334155` |
  | border | `#DCE1E8` | `#334155` |
  | muted text | `#5A6070` | `#94A3B8` |
  | text | `#1A1D24` | `#F1F5F9` |

  The dark mode is Tailwind's slate (navy), not neutral grey. The steel scale (`#5B7BAA` = steel-500) is for borders, secondary UI and charts that don't show air quality.
- **Accent (Fyka Air's own colour):** sky. Primary buttons use a `sky-600 → sky-700` gradient (`#0284C7 → #0369A1`) with white text. Accent text and links are `sky-700` in light mode and `sky-400` in dark mode. Never use the accent on the map, so it can't be confused with LKI blue.
- **Air quality:** use only the LKI scale (RIVM Luchtkwaliteitsindex, 1–11), with these categories: Goed 1–3, Matig 4–6, Onvoldoende 7–8, Slecht 9–10, Zeer slecht 11. Always show the category name next to the colour, never the colour alone. The LKI colours are `LKI_COLORS` in `lib/air-quality.ts` (the same as the reference page): our own 11-step scale from deep blue to purple, close in look to RIVM Samen Meten's map. They deliberately don't copy Luchtmeetnet's 5-colour legend (decision #23 in TECHNICAL.md). Pale colours get a thin dark outline (`LKI_OUTLINE`) so they stay visible on a light map. No index: `#70757F`.

## Type

- Figtree for all UI text (set up in `app/layout.tsx` as `--font-figtree`). Weights 400–700; headings 600, display 700.
- Geist Mono only for identifiers people may copy: station codes (`NL10636`), datastream names (`LTD_94370-2-pm25_kal`).
- Tabular figures wherever numbers line up.

## Data display and copy

- Dutch number format and units: `6,8 µg/m³`, `PM2,5`, `NO₂`, `O₃`. One decimal for concentrations, whole numbers for the LKI.
- Every value shows its source (badge: Officieel / Burgersensor), whether it is calibrated, and when it was measured ("Gemeten om 18:00 · 23 min geleden").
- Freshness, official stations: under 1 hour is normal; 1–3 hours gets an amber dot and the age stays visible; over 3 hours the station leaves the map (decision #15 in TECHNICAL.md).
- Freshness, citizen sensors: their calibrated values arrive about 2 hours late, so shift the windows by 2 hours. Up to 3 hours is normal; amber when the sensor is behind the newest Samen Meten hour on the map or 3 hours or older; over 5 hours it leaves the map (decision #25).
- Show calibrated values by default. Raw values appear next to them on request, never instead of them.
- On the map, official stations are large dots and citizen sensors are small dots, both with a thin grey outline (`LKI_OUTLINE`), not a white halo.
- Charts show the WHO guideline value as a dashed reference line.
- Copy is plain Dutch: short sentences, everyday words, advice people can act on. No raw timestamps or internal names in the UI.

## Components and map

- Build with the shadcn/ui components in `components/ui` (base-nova, Base UI). Radius is `--radius` (0.625rem); badges and the theme toggle are fully rounded.
- Map: MapLibre GL with a quiet basemap. Use the reference page's map colours for water, land, borders, labels and halos in light and dark mode. PDOK has no dark style, so the dark variant is our own.
- Area layer: RIVM's calculated map (decision #26 in TECHNICAL.md) sits under roads, labels and the dots, in our LKI colours only. Always label it as RIVM's calculation ("berekend door het RIVM", an estimate, not a measurement) and credit luchtmeetnet.nl. With a pollutant layer chosen, the dots use the same pollutant and bands (#27).
- Layer choice: always show which layer is active, and list layers by importance for health (LKI, PM2,5, NO₂, O₃, PM10; decision #28). Health explanations stay in plain Dutch, stick to well-established links and say they are not medical advice.
- Logo: the Fyka three-wave mark, plus the Fyka Air app mark "Stroom" (sky tile, 25% rounding, white glyph of two air currents and a particle at 60%), following the app mark recipe in fyka-website's `app-marks.tsx`. Use `AirMark` from `components/air-mark.tsx`. The same glyph is in `app/icon.svg` (favicon) and `app/apple-icon.tsx`; change all three together.
