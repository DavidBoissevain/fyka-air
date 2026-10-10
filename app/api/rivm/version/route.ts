import { fetchVersion, isAreaLayer } from "@/lib/rivm-map";

// The version of RIVM's current map for one layer, which the map puts in its
// tile URLs. Cached briefly so a new hour reaches open pages within minutes.
export async function GET(request: Request) {
  const layer = new URL(request.url).searchParams.get("layer") ?? "";
  if (!isAreaLayer(layer)) return Response.json({ error: "Onbekende kaartlaag" }, { status: 400 });

  try {
    const version = await fetchVersion(layer);
    return Response.json({ version }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "RIVM niet bereikbaar" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
