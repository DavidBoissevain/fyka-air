"use client";

import { useMemo, useState } from "react";
import { ChartBarIcon } from "lucide-react";
import type { StyleSpecification } from "maplibre-gl";

import { Button } from "@/components/ui/button";
import { Map, MapControls, MapMarker, MapPopup, MarkerContent } from "@/components/ui/map";
import { DataInfo } from "@/components/air/data-info";
import { LayerPicker } from "@/components/air/layer-picker";
import { MapSearch } from "@/components/air/map-search";
import { PointValue } from "@/components/air/point-value";
import { RivmLayer } from "@/components/air/rivm-layer";
import { StationLayer } from "@/components/air/station-layer";
import { Overview, StationDetails } from "@/components/air/station-panel";
import {
  LKI_COLORS,
  MAP_LAYERS,
  NO_INDEX_COLOR,
  categoryRanges,
  type AreaLayer,
  type MapLayer,
  type StationReading,
} from "@/lib/air-quality";
import { setMapLayer, useMapLayer } from "@/hooks/use-map-layer";
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
  const pollutant = layer === "lki" || layer === "off" ? null : layer;
  return (
    <div className="bg-card/95 pointer-events-auto grid max-w-full gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm sm:max-w-72">
      <span className="font-semibold">{info.legend}</span>
      <div className="grid grid-cols-[repeat(11,1rem)] gap-0.5 sm:grid-cols-[repeat(11,1.125rem)]">
        {LKI_COLORS.map((c, i) => (
          <span key={i} className="h-2 rounded-xs ring-1 ring-black/15 ring-inset" style={{ background: c.bg }} />
        ))}
      </div>
      {pollutant ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-2.5 gap-y-0.5 tabular-nums">
          {categoryRanges(pollutant).map((r) => (
            <span key={r.name}>
              {r.name} {r.upTo ? `tot ${r.upTo}` : "daarboven"}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground flex justify-between">
          <span>1 Goed</span>
          <span>11 Zeer slecht</span>
        </div>
      )}
      <div className="text-muted-foreground flex flex-wrap gap-x-3.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-full border border-[#8C939D] dark:border-[#64748B]" style={{ background: LKI_COLORS[1].bg }} />
          Meetstation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-1.75 rounded-full border border-[#8C939D] dark:border-[#64748B]" style={{ background: LKI_COLORS[1].bg }} />
          Burgersensor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-full border border-[#8C939D] dark:border-[#64748B]" style={{ background: NO_INDEX_COLOR }} />
          {pollutant ? "Niet gemeten" : "Geen index"}
        </span>
        {layer !== "off" && (
          <span className="inline-flex items-center gap-1.5">
            <i className="size-3 rounded-xs opacity-60" style={{ background: `linear-gradient(90deg, ${LKI_COLORS[2].bg}, ${LKI_COLORS[4].bg})` }} />
            Gebied: berekend door het RIVM
          </span>
        )}
      </div>
    </div>
  );
}

type Props = {
  stations: StationReading[];
  styles: { light: StyleSpecification; dark: StyleSpecification };
};

export function AirMap({ stations, styles }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const mapLayer = useMapLayer();
  const [probe, setProbe] = useState<{ longitude: number; latitude: number } | null>(null);
  const area: AreaLayer | null = mapLayer === "off" ? null : mapLayer;
  const selected = stations.find((s) => s.id === selectedId) ?? null;
  const panelOpen = selected !== null || overviewOpen;
  const newestCitizen = useMemo(
    () =>
      stations.reduce<string | null>(
        (max, s) => (s.kind === "citizen" && (!max || Date.parse(s.measured_at) > Date.parse(max)) ? s.measured_at : max),
        null,
      ),
    [stations],
  );

  function chooseLayer(layer: MapLayer) {
    setMapLayer(layer);
    if (layer === "off") setProbe(null);
  }

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
          <RivmLayer layer={area} />
          <StationLayer
            stations={stations}
            colorBy={area ?? "lki"}
            selectedId={selectedId}
            onSelect={selectStation}
            // With the area layer on, a click next to the dots shows RIVM's value there.
            onMapClick={(lngLat) => setProbe(area ? { longitude: lngLat.lng, latitude: lngLat.lat } : null)}
          />
          {/* Just under the header row, right-aligned with its buttons (px-6). */}
          <MapControls
            position="top-right"
            showLocate
            className="top-17 right-6 md:top-19 lg:right-[calc(var(--panel)+1.5rem)]"
          />
          <MapSearch
            stations={stations}
            onSelectStation={selectStation}
            onSelectPlace={(chosen, nearestId) => {
              setPlace(chosen);
              selectStation(nearestId);
            }}
            onClear={() => setPlace(null)}
            // In the header row, top left: same padding and height as the
            // header, and clear of its two buttons on the right.
            className="top-3 right-34 left-6 max-w-100 md:right-38"
          />
          {place && (
            <MapMarker longitude={place.longitude} latitude={place.latitude}>
              <MarkerContent>
                <div className="bg-card border-foreground size-4 rounded-full border-[3px] shadow-md" aria-label={place.name} />
              </MarkerContent>
            </MapMarker>
          )}
          {probe && area && (
            <MapPopup
              key={`${probe.longitude},${probe.latitude}`}
              longitude={probe.longitude}
              latitude={probe.latitude}
              closeButton
              closeOnClick={false}
              onClose={() => setProbe(null)}
            >
              <PointValue longitude={probe.longitude} latitude={probe.latitude} layer={area} />
            </MapPopup>
          )}
        </Map>
        {/* Under the search box, aligned with the zoom controls on the right. */}
        <LayerPicker
          value={mapLayer}
          onChange={chooseLayer}
          className="absolute top-17 left-6 z-10 max-w-[calc(100%-6.5rem)] md:top-19"
        />
        {/* Legend bottom left, buttons bottom right; on phones the buttons sit above the full-width legend. */}
        <div className="pointer-events-none absolute right-3 bottom-4 left-4 z-10 flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-end sm:justify-between lg:right-[calc(var(--panel)+0.75rem)]">
          <Legend layer={mapLayer} />
          <div className="pointer-events-auto flex gap-2 self-end sm:mb-4">
            <DataInfo stations={stations} />
            {!overviewOpen && (
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
          OpenFreeMap · © OpenMapTiles · © OpenStreetMap · Metingen: Luchtmeetnet, RIVM Samen Meten{area && " · Kaart: RIVM, luchtmeetnet.nl"}
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
          {selected ? (
            <StationDetails station={selected} place={place} newestCitizen={newestCitizen} onClose={() => setSelectedId(null)} />
          ) : (
            <Overview stations={stations} onClose={() => setOverviewOpen(false)} />
          )}
        </aside>
      )}
    </div>
  );
}
