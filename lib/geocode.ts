// Address and place search with PDOK Locatieserver (decision #14 in
// TECHNICAL.md). Called from the browser; the API is public and allows CORS.

const SUGGEST = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest";

export type PlaceType = "gemeente" | "woonplaats" | "weg" | "postcode" | "adres";

export type Place = {
  id: string;
  name: string;
  type: PlaceType;
  longitude: number;
  latitude: number;
};

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  gemeente: "Gemeente",
  woonplaats: "Plaats",
  weg: "Straat",
  postcode: "Postcode",
  adres: "Adres",
};

// How far to zoom in for each kind of result.
export const PLACE_ZOOM: Record<PlaceType, number> = {
  gemeente: 11,
  woonplaats: 12,
  weg: 15,
  postcode: 15,
  adres: 16,
};

type Doc = { id: string; weergavenaam: string; type: PlaceType; centroide_ll: string };

// "suggest" handles half-typed words ("utrec"); "free" doesn't.
export async function suggestPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    rows: "5",
    fl: "id,weergavenaam,type,centroide_ll",
    fq: `type:(${Object.keys(PLACE_TYPE_LABELS).join(" OR ")})`,
  });
  const res = await fetch(`${SUGGEST}?${params}`, { signal });
  if (!res.ok) throw new Error(`PDOK Locatieserver: HTTP ${res.status}`);
  const { response } = (await res.json()) as { response: { docs: Doc[] } };
  return response.docs.flatMap((doc) => {
    const match = doc.centroide_ll.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    if (!match) return [];
    return [{ id: doc.id, name: doc.weergavenaam, type: doc.type, longitude: Number(match[1]), latitude: Number(match[2]) }];
  });
}

// Great-circle distance in kilometres.
export function distanceKm(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
