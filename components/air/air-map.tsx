"use client";

import { useCallback, useMemo, useState } from "react";
import { ChartBarIcon } from "lucide-react";
import type { StyleSpecification } from "maplibre-gl";

import { Button } from "@/components/ui/button";
import { Map, MapControls, MapMarker, MapPopup, MarkerContent } from "@/components/ui/map";
import { AnnualStationDetails } from "@/components/air/annual-station-panel";
import { DataInfo } from "@/components/air/data-info";
import { LayerPicker } from "@/components/air/layer-picker";
import { MapSearch } from "@/components/air/map-search";
import { PeriodSwitch } from "@/components/air/period-switch";
import { AnnualPointValue, PointValue } from "@/components/air/point-value";
import { AnnualRivmLayer, RivmLayer } from "@/components/air/rivm-layer";
import { StationLayer, lkiPaint, onHourlyMap, type Paint } from "@/components/air/station-layer";
import { Overview, StationDetails } from "@/components/air/station-panel";
import {
  ANNUAL_LAYERS,
  ANNUAL_YEAR,
  LKI_COLORS,
  MAP_LAYERS,
  NO_INDEX_COLOR,
  annualColor,
  annualInfo,
  annualLayerFor,
  annualValue,
  categoryRanges,
  formatNumber,
  type AnnualLayer,
  type AnnualStation,
  type MapLayer,
  type StationReading,
} from "@/lib/air-quality";
import { setMapLayer, useMapLayer } from "@/hooks/use-map-layer";
import { setMapPeriod, useMapPeriod } from "@/hooks/use-map-period";
import type { Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

// SiteHeader height from md up: py-3 around a 52px control row.
const HEADER_HEIGHT = 76;

const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.75],
  [7.25, 53.55],
];

function Legend({ layer }: { layer: MapLayer }) {
  const info = MAP_LAYERS.find((l) => l.id === layer) ?? MAP_LAYERS[0];
  const pollutant = layer === "lki" ? null : layer;
  return (
    <div className="bg-card/95 pointer-events-auto grid max-w-full gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm sm:max-w-72">
      <span className="font-semibold">{info.legend}</span>
      <div className="grid gap-1 [--cell:1rem] sm:[--cell:1.125rem]">
        <div className="grid grid-cols-[repeat(11,var(--cell))] gap-0.5">
          {LKI_COLORS.map((c, i) => (
            <span key={i} className="h-2 rounded-xs ring-1 ring-black/15 ring-inset" style={{ background: c.bg }} />
          ))}
        </div>
        {pollutant && (
          // Category limits in µg/m³, each under the gap where the next category starts.
          <div className="text-muted-foreground relative h-3.5 tabular-nums">
            {categoryRanges(pollutant)
              .filter((r) => r.upTo !== null)
              .map((r) => (
                <span
                  key={r.name}
                  className="absolute top-0 -translate-x-1/2 leading-none"
                  style={{ left: `calc(${r.to} * (var(--cell) + 0.125rem) - 0.0625rem)` }}
                >
                  {r.upTo}
                </span>
              ))}
          </div>
        )}
      </div>
      <div className="text-muted-foreground flex justify-between">
        <span>{pollutant ? "Goed" : "1 Goed"}</span>
        <span>{pollutant ? "Zeer slecht" : "11 Zeer slecht"}</span>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-3.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-full border border-[#8C939D] dark:border-[#64748B]" style={{ background: LKI_COLORS[1].bg }} />
          Meetstation
        </span>
        {/* Citizen sensors only show on the fine dust layers (decision #44). */}
        {(layer === "pm25" || layer === "pm10") && (
          <span className="inline-flex items-center gap-1.5">
            <i className="size-1.75 rounded-full border border-[#8C939D] dark:border-[#64748B]" style={{ background: LKI_COLORS[1].bg }} />
            Burgersensor
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-full border border-[#8C939D] dark:border-[#64748B]" style={{ background: NO_INDEX_COLOR }} />
          {/* Grey: a station that measures this layer but has no (complete) value right now. */}
          {pollutant ? "Nu geen meting" : "Nu geen volledige index"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-xs opacity-60" style={{ background: `linear-gradient(90deg, ${LKI_COLORS[2].bg}, ${LKI_COLORS[4].bg})` }} />
          Gebied: berekend door het RIVM
        </span>
      </div>
      {layer === "lki" && <span className="text-muted-foreground">Burgersensoren zie je op de kaart Fijnstof (PM2,5).</span>}
    </div>
  );
}

// The annual view's legend (decision #38): RIVM's bands, the WHO guideline and
// the EU limit for 2030 marked on the bar, and the three categories by name.
function AnnualLegend({ layer }: { layer: AnnualLayer }) {
  const { legend, bands, who, eu2030 } = annualInfo(layer);
  const n = bands.length;
  // Position of the gap after the i-th cell, as in the hourly legend.
  const at = (i: number) => `calc(${i} * (100% + 0.125rem) / ${n} - 0.0625rem)`;
  const edge = (value: number) => bands.findIndex((b) => b.upTo === value) + 1;
  const marks = [
    { value: who, label: "WHO" },
    { value: eu2030, label: "EU 2030" },
  ];
  const colors = (from: number, to: number) =>
    bands.filter((b) => (b.upTo ?? Infinity) > from && (b.upTo ?? Infinity) <= to).map((b) => b.color);
  const categories = [
    { name: "Onder het WHO-advies", range: `tot ${who}`, colors: colors(-Infinity, who) },
    { name: "Boven het WHO-advies", range: `${who} tot ${eu2030}`, colors: colors(who, eu2030) },
    { name: "Boven de EU-norm 2030", range: `${eu2030} of meer`, colors: colors(eu2030, Infinity) },
  ];
  return (
    <div className="bg-card/95 pointer-events-auto grid w-full gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm sm:w-72">
      <span className="font-semibold">{legend}</span>
      <div className="grid gap-1">
        <div className="relative">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {bands.map((b) => (
              <span key={b.color} className="h-2.5 rounded-xs ring-1 ring-black/15 ring-inset" style={{ background: b.color }} />
            ))}
          </div>
          {marks.map((m) => (
            <span
              key={m.label}
              className="border-foreground/70 absolute -top-1 -bottom-1 border-l border-dashed"
              style={{ left: at(edge(m.value)) }}
              aria-hidden
            />
          ))}
        </div>
        {/* The WHO guideline and the EU limit, under their marks. */}
        <div className="text-muted-foreground relative h-3.5 tabular-nums">
          {marks.map((m) => (
            <span
              key={m.label}
              className="absolute top-0 -translate-x-1/2 leading-none whitespace-nowrap"
              style={{ left: at(edge(m.value)) }}
            >
              {formatNumber(m.value, 0)} <span className="text-foreground font-medium">{m.label}</span>
            </span>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-x-2 gap-y-1">
        {categories.map((c) => (
          <div key={c.name} className="contents">
            <span
              className="h-2.5 rounded-xs ring-1 ring-black/15 ring-inset"
              style={{ background: c.colors.length > 1 ? `linear-gradient(90deg, ${c.colors.join(", ")})` : c.colors[0] }}
              aria-hidden
            />
            <dt>{c.name}</dt>
            <dd className="text-muted-foreground tabular-nums">{c.range}</dd>
          </div>
        ))}
      </dl>
      <div className="text-muted-foreground flex flex-wrap gap-x-3.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-full border border-[#8C939D] dark:border-[#64748B]" style={{ background: bands[Math.floor(n / 2)].color }} />
          Meetstation (gemeten)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-xs opacity-70" style={{ background: `linear-gradient(90deg, ${bands[1].color}, ${bands[n - 3].color})` }} />
          Gebied: berekend door het RIVM
        </span>
      </div>
    </div>
  );
}

// The annual view's dots (decisions #42, #43): only stations with a measured
// annual average for the map's year, in RIVM's colours. Higher values on top.
function hasAnnualValue(s: AnnualStation, layer: AnnualLayer) {
  return annualValue(s, layer, ANNUAL_YEAR)?.kind === "value";
}

function annualPaint(layer: AnnualLayer): Paint<AnnualStation> {
  return (s) => {
    const value = annualValue(s, layer, ANNUAL_YEAR);
    return value?.kind === "value"
      ? { color: annualColor(layer, value.mean), rank: value.mean }
      : { color: NO_INDEX_COLOR, rank: -1 };
  };
}

type Props = {
  stations: StationReading[];
  // Official stations with measured annual averages, for the annual view.
  annualStations: AnnualStation[];
  styles: { light: StyleSpecification; dark: StyleSpecification };
};

export function AirMap({ stations, annualStations, styles }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const mapLayer = useMapLayer();
  // The annual view (decision #36) shows RIVM's annual map without dots or panel.
  const annual = useMapPeriod() === "jaar";
  const annualLayer = annualLayerFor(mapLayer);
  const [probe, setProbe] = useState<{ longitude: number; latitude: number } | null>(null);
  // The selection is kept across modes; each mode looks it up in its own list.
  const selected = annual ? null : stations.find((s) => s.id === selectedId) ?? null;
  // The panel can show any annual station (it explains a missing value), the
  // map and search only those with a value for this layer: no grey dots (#43).
  const annualSelected = annual ? annualStations.find((s) => s.id === selectedId) ?? null : null;
  const annualShown = useMemo(
    () => annualStations.filter((s) => hasAnnualValue(s, annualLayer)),
    [annualStations, annualLayer],
  );
  const panelOpen = annual ? annualSelected !== null : selected !== null || overviewOpen;
  const nowPaint = useMemo(() => lkiPaint(mapLayer), [mapLayer]);
  // The hourly map leaves out what a station never measures (#44); the panel
  // still finds any station, so an open one stays open when the layer changes.
  const nowShown = useMemo(() => stations.filter(onHourlyMap(mapLayer)), [stations, mapLayer]);
  const yearPaint = useMemo(() => annualPaint(annualLayer), [annualLayer]);
  const nowColor = useCallback((s: StationReading) => lkiPaint("lki")(s).color, []);
  const yearColor = useCallback((s: AnnualStation) => yearPaint(s).color, [yearPaint]);
  const newestCitizen = useMemo(
    () =>
      stations.reduce<string | null>(
        (max, s) => (s.kind === "citizen" && (!max || Date.parse(s.measured_at) > Date.parse(max)) ? s.measured_at : max),
        null,
      ),
    [stations],
  );

  // A station replaces the overview, so closing it returns to the full map.
  function selectStation(id: number | null) {
    setSelectedId(id);
    if (id !== null) {
      setOverviewOpen(false);
      setProbe(null);
    }
  }

  return (
    // Full-bleed: SiteHeader floats on top without a background, with the
    // search box in its row on the left (hence the bounds padding and the
    // control offsets). From lg up with the panel open, the header buttons sit
    // on the panel (hence its top padding).
    // From lg up the panel floats over the map, so opening it doesn't resize
    // the map and move the view; --panel moves the map's own controls clear.
    <div
      className={cn(
        "bg-card relative grid min-h-0 flex-1",
        panelOpen ? "lg:[--panel:380px]" : "lg:[--panel:0px]",
      )}
    >
      <div className={cn("relative min-h-105 lg:h-auto", panelOpen ? "h-[70dvh]" : "h-auto")}>
        <Map
          styles={styles}
          bounds={NL_BOUNDS}
          fitBoundsOptions={{ padding: { top: HEADER_HEIGHT + 24, right: 24, bottom: 24, left: 24 } }}
          maxBounds={[
            [1.5, 49.8],
            [9.2, 54.4],
          ]}
          minZoom={6}
          dragRotate={false}
          pitchWithRotate={false}
          attributionControl={false}
        >
          {annual ? <AnnualRivmLayer layer={annualLayer} /> : <RivmLayer layer={mapLayer} />}
          {annual ? (
            <StationLayer
              stations={annualShown}
              paint={yearPaint}
              selectedId={selectedId}
              onSelect={selectStation}
              // A click next to the dots shows RIVM's value there.
              onMapClick={(lngLat) => setProbe({ longitude: lngLat.lng, latitude: lngLat.lat })}
            />
          ) : (
            <StationLayer
              stations={nowShown}
              paint={nowPaint}
              selectedId={selectedId}
              onSelect={selectStation}
              onMapClick={(lngLat) => setProbe({ longitude: lngLat.lng, latitude: lngLat.lat })}
            />
          )}
          {/* Just under the header row, right-aligned with its buttons (px-6). */}
          <MapControls
            position="top-right"
            showLocate
            className="top-17 right-6 md:top-19 lg:right-[calc(var(--panel)+1.5rem)]"
          />
          {/* In the header row, top left: same padding and height as the
              header, and clear of its two buttons on the right. */}
          {annual ? (
            <MapSearch
              stations={annualShown}
              colorOf={yearColor}
              // A place shows the calculated annual value there, not the nearest station.
              nearest={false}
              onSelectStation={selectStation}
              onSelectPlace={(chosen) => {
                setPlace(chosen);
                setSelectedId(null);
                setProbe({ longitude: chosen.longitude, latitude: chosen.latitude });
              }}
              onClear={() => setPlace(null)}
              className="top-3 right-34 left-6 max-w-100 md:right-38"
            />
          ) : (
            <MapSearch
              stations={nowShown}
              colorOf={nowColor}
              onSelectStation={selectStation}
              onSelectPlace={(chosen, nearestId) => {
                setPlace(chosen);
                selectStation(nearestId);
              }}
              onClear={() => setPlace(null)}
              className="top-3 right-34 left-6 max-w-100 md:right-38"
            />
          )}
          {place && (
            <MapMarker longitude={place.longitude} latitude={place.latitude}>
              <MarkerContent>
                <div className="bg-card border-foreground size-4 rounded-full border-[3px] shadow-md" aria-label={place.name} />
              </MarkerContent>
            </MapMarker>
          )}
          {probe && (
            <MapPopup
              key={`${probe.longitude},${probe.latitude},${annual}`}
              longitude={probe.longitude}
              latitude={probe.latitude}
              closeButton
              closeOnClick={false}
              onClose={() => setProbe(null)}
            >
              {annual ? (
                <AnnualPointValue longitude={probe.longitude} latitude={probe.latitude} layer={annualLayer} />
              ) : (
                <PointValue longitude={probe.longitude} latitude={probe.latitude} layer={mapLayer} />
              )}
            </MapPopup>
          )}
        </Map>
        {/* Under the search box, aligned with the zoom controls on the right: the mode, then the layer. */}
        <div className="pointer-events-none absolute top-17 left-6 z-10 flex max-w-[calc(100%-6.5rem)] flex-col items-start gap-2 md:top-19">
          <PeriodSwitch value={annual ? "jaar" : "nu"} onChange={setMapPeriod} className="pointer-events-auto" />
          {annual ? (
            <LayerPicker
              layers={ANNUAL_LAYERS}
              value={annualLayer}
              onChange={setMapLayer}
              period={String(ANNUAL_YEAR)}
              className="pointer-events-auto"
            />
          ) : (
            <LayerPicker layers={MAP_LAYERS} value={mapLayer} onChange={setMapLayer} className="pointer-events-auto" />
          )}
        </div>
        {/* Legend bottom left, buttons bottom right; on phones the buttons sit above the full-width legend. */}
        <div className="pointer-events-none absolute right-3 bottom-4 left-4 z-10 flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-end sm:justify-between lg:right-[calc(var(--panel)+0.75rem)]">
          {annual ? <AnnualLegend layer={annualLayer} /> : <Legend layer={mapLayer} />}
          <div className="pointer-events-auto flex gap-2 self-end sm:mb-4">
            <DataInfo stations={stations} />
            {!annual && !overviewOpen && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedId(null);
                  setOverviewOpen(true);
                }}
                className="bg-card dark:bg-card h-10 gap-2 px-3.5 shadow-lg"
              >
                <ChartBarIcon />
                Overzicht Nederland
              </Button>
            )}
          </div>
        </div>
        <div className="text-muted-foreground bg-card/80 absolute right-2 bottom-1.5 z-10 rounded px-1.5 text-[0.6875rem] lg:right-[calc(var(--panel)+0.5rem)]">
          OpenFreeMap · © OpenMapTiles · © OpenStreetMap ·{" "}
          {annual
            ? `Kaart: RIVM, jaargemiddelde ${ANNUAL_YEAR}`
            : "Metingen: Luchtmeetnet, RIVM Samen Meten · Kaart: RIVM, luchtmeetnet.nl"}
        </div>
      </div>
      {panelOpen && (
        <aside
          // Relative so absolute descendants (the chart's sr-only table) stay
          // inside the scroller instead of overflowing the page. Stable gutter:
          // content that grows past the panel height adds a scrollbar without
          // shifting everything sideways.
          className="bg-card relative overflow-y-auto border-t p-5 scrollbar-gutter-stable lg:absolute lg:inset-y-0 lg:right-0 lg:z-30 lg:w-95 lg:border-t-0 lg:border-l lg:p-6 lg:pt-25"
          aria-live="polite"
        >
          {annualSelected ? (
            <AnnualStationDetails station={annualSelected} layer={annualLayer} onClose={() => setSelectedId(null)} />
          ) : selected ? (
            <StationDetails
              station={selected}
              place={place}
              newestCitizen={newestCitizen}
              layer={mapLayer}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <Overview stations={stations} onClose={() => setOverviewOpen(false)} />
          )}
        </aside>
      )}
    </div>
  );
}
