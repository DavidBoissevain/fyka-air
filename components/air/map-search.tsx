"use client";

import { useId, useMemo, useRef, useState } from "react";
import { MapPinIcon, SearchIcon, XIcon } from "lucide-react";

import { useMap } from "@/components/ui/map";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NO_INDEX_COLOR, lkiColor, lkiIndex, stationTitle, type StationReading } from "@/lib/air-quality";
import { PLACE_TYPE_LABELS, PLACE_ZOOM, distanceKm, suggestPlaces, type Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

type Item = { kind: "station"; station: StationReading } | { kind: "place"; place: Place };

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Props = {
  stations: StationReading[];
  onSelectStation: (id: number) => void;
  // Called with the place and the nearest station, if any.
  onSelectPlace: (place: Place, nearestId: number | null) => void;
  onClear: () => void;
  className?: string;
};

// Search box on the map: measuring stations by name or code, and addresses
// and places through PDOK Locatieserver. Choosing a place zooms to it and
// selects the nearest station.
export function MapSearch({ stations, onSelectStation, onSelectPlace, onClear, className }: Props) {
  const { map } = useMap();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef<AbortController>(undefined);

  const stationHits = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return stations
      .filter((s) => [s.name, s.external_id, s.municipality].some((v) => v && normalize(v).includes(q)))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "professional" ? -1 : 1))
      .slice(0, 3);
  }, [query, stations]);

  const items: Item[] = [
    ...stationHits.map((station) => ({ kind: "station" as const, station })),
    ...places.map((place) => ({ kind: "place" as const, place })),
  ];

  function search(value: string) {
    setQuery(value);
    setOpen(true);
    setActive(0);
    clearTimeout(timer.current);
    request.current?.abort();
    if (value.trim().length < 2) {
      setPlaces([]);
      setFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        setPlaces(await suggestPlaces(value.trim(), controller.signal));
        setFailed(false);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setPlaces([]);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
  }

  function choose(item: Item) {
    setOpen(false);
    if (item.kind === "station") {
      const { station } = item;
      setQuery(station.kind === "citizen" ? station.external_id : stationTitle(station));
      onSelectStation(station.id);
      map?.flyTo({ center: [station.longitude, station.latitude], zoom: Math.max(map.getZoom(), 11), duration: 900 });
      return;
    }

    const { place } = item;
    setQuery(place.name);
    const nearest = stations.reduce<StationReading | null>(
      (best, s) => (!best || distanceKm(place, s) < distanceKm(place, best) ? s : best),
      null,
    );
    onSelectPlace(place, nearest?.id ?? null);
    if (!map) return;
    if (nearest) {
      // Show both the place and its nearest station.
      map.fitBounds(
        [
          [Math.min(place.longitude, nearest.longitude), Math.min(place.latitude, nearest.latitude)],
          [Math.max(place.longitude, nearest.longitude), Math.max(place.latitude, nearest.latitude)],
        ],
        { padding: 80, maxZoom: PLACE_ZOOM[place.type], duration: 900 },
      );
    } else {
      map.flyTo({ center: [place.longitude, place.latitude], zoom: PLACE_ZOOM[place.type], duration: 900 });
    }
  }

  function clear() {
    search("");
    setOpen(false);
    onClear();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (items.length) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter" && open && items[active]) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length >= 2;

  return (
    <div className={cn("absolute z-20", className)}>
      {/* Same height, border and rounding as the header's control buttons, as it shares their row. */}
      <InputGroup className="bg-background/80 dark:bg-card/80 border-border h-11 border-2 shadow-lg backdrop-blur-sm md:h-13 md:rounded-xl">
        <InputGroupAddon className="cursor-pointer">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          role="combobox"
          aria-label="Zoek een adres, plaats of meetstation"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
          placeholder="Zoek een adres of plaats"
          autoComplete="off"
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="cursor-pointer focus:cursor-text [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Zoekopdracht wissen" onClick={clear}>
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      {showList && (
        <div id={listId} role="listbox" className="bg-popover mt-1.5 grid rounded-lg border p-1 shadow-lg">
          {items.map((item, i) => {
            const isStation = item.kind === "station";
            // Citizen sensors are grey, as on the LKI map (decision #30).
            const color =
              isStation && item.station.kind === "professional"
                ? lkiColor(lkiIndex(item.station.readings.lki?.value))?.bg ?? NO_INDEX_COLOR
                : NO_INDEX_COLOR;
            return (
              <div
                key={isStation ? `s${item.station.id}` : item.place.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Keep focus in the input so blur doesn't close the list before the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
                  i === active && "bg-muted",
                )}
              >
                {isStation ? (
                  <span className="size-2.5 justify-self-center rounded-full ring-1 ring-black/25" style={{ background: color }} />
                ) : (
                  <MapPinIcon className="text-muted-foreground size-4" aria-hidden />
                )}
                <span className="truncate">
                  {isStation
                    ? item.station.kind === "citizen"
                      ? item.station.external_id
                      : stationTitle(item.station)
                    : item.place.name}
                </span>
                <small className="text-muted-foreground text-xs">
                  {isStation
                    ? item.station.kind === "citizen"
                      ? "Burgersensor"
                      : "Meetstation"
                    : PLACE_TYPE_LABELS[item.place.type]}
                </small>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-muted-foreground px-2.5 py-2 text-sm">
              {loading
                ? "Zoeken…"
                : failed
                  ? "Zoeken lukt nu niet. Probeer het later opnieuw."
                  : `Niets gevonden voor “${query.trim()}”.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
