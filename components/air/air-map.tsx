"use client";

import { useState } from "react";
import type { StyleSpecification } from "maplibre-gl";

import { Map, MapControls, MapMarker, MarkerContent } from "@/components/ui/map";
import { MapSearch } from "@/components/air/map-search";
import { StationLayer } from "@/components/air/station-layer";
import { Overview, StationDetails } from "@/components/air/station-panel";
import { LKI_COLORS, NO_INDEX_COLOR, type StationReading } from "@/lib/air-quality";
import type { Place } from "@/lib/geocode";

// SiteHeader height from md up: py-3 around a 52px control row.
const HEADER_HEIGHT = 76;

const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.75],
  [7.25, 53.55],
];

function Legend() {
  return (
    <div className="bg-card/95 absolute bottom-4 left-4 z-10 grid max-w-[calc(100%-2rem)] gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm">
      <div className="grid grid-cols-[repeat(11,1rem)] gap-0.5 sm:grid-cols-[repeat(11,1.125rem)]">
        {LKI_COLORS.map((c, i) => (
          <span key={i} className="h-2 rounded-xs" style={{ background: c.bg }} />
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between">
        <span>1 Goed</span>
        <span>11 Zeer slecht</span>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-3.5">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-full bg-[#2F74F0] ring-2 ring-white dark:ring-[#0F172A]" />
          Meetstation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-1.75 rounded-full bg-[#2F74F0] opacity-90" />
          Burgersensor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-full ring-2 ring-white dark:ring-[#0F172A]" style={{ background: NO_INDEX_COLOR }} />
          Geen index
        </span>
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
  const [place, setPlace] = useState<Place | null>(null);
  const selected = stations.find((s) => s.id === selectedId) ?? null;

  return (
    // Full-bleed: SiteHeader floats on top without a background. The logo sits
    // on the map (hence the bounds padding); from lg up the buttons sit on the
    // panel (hence its top padding), and below lg they and the search box sit
    // on the map (hence the control offsets).
    <div className="bg-card grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="relative h-[70dvh] min-h-105 lg:h-auto">
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
          <StationLayer stations={stations} selectedId={selectedId} onSelect={setSelectedId} />
          <MapControls position="top-right" showLocate className="top-32 md:top-34 lg:top-2" />
          <MapSearch
            stations={stations}
            onSelectStation={setSelectedId}
            onSelectPlace={(chosen, nearestId) => {
              setPlace(chosen);
              setSelectedId(nearestId);
            }}
            onClear={() => setPlace(null)}
            // Below lg: full width under the header row. From lg up: in the
            // header row, centred over the map between the logo and the panel.
            className="top-19 right-3 left-3 md:top-21 lg:top-4.5 lg:right-auto lg:left-1/2 lg:w-[min(400px,calc(100%-26rem))] lg:-translate-x-1/2"
          />
          {place && (
            <MapMarker longitude={place.longitude} latitude={place.latitude}>
              <MarkerContent>
                <div className="bg-card border-foreground size-4 rounded-full border-[3px] shadow-md" aria-label={place.name} />
              </MarkerContent>
            </MapMarker>
          )}
        </Map>
        <Legend />
        <div className="text-muted-foreground bg-card/80 absolute right-2 bottom-1.5 z-10 rounded px-1.5 text-[0.6875rem]">
          OpenFreeMap · © OpenMapTiles · © OpenStreetMap · Metingen: Luchtmeetnet
        </div>
      </div>
      <aside
        className="overflow-y-auto border-t p-5 lg:border-t-0 lg:border-l lg:p-6 lg:pt-25"
        aria-live="polite"
      >
        {selected ? (
          <StationDetails station={selected} place={place} onClose={() => setSelectedId(null)} />
        ) : (
          <Overview stations={stations} />
        )}
      </aside>
    </div>
  );
}
