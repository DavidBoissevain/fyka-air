import { isAnnualLayer } from "@/lib/air-quality";
import { fetchAnnualTile, tileInNetherlands } from "@/lib/rivm-map";

// RIVM's annual map changes once a year, and the year is in the map's tile
// URLs (?v=), so a tile can be cached for a long time.
const CACHED = "public, max-age=86400, s-maxage=2592000";

export async function GET(_request: Request, { params }: RouteContext<"/api/rivm/jaar/[layer]/[z]/[x]/[y]">) {
  const { layer, z: zParam, x: xParam, y: yParam } = await params;
  const [z, x, y] = [zParam, xParam, yParam].map(Number);
  // Up to zoom 14: the map has a 25 m grid, so streets stay sharp.
  const valid =
    isAnnualLayer(layer) &&
    [z, x, y].every(Number.isInteger) &&
    z >= 6 &&
    z <= 14 &&
    x >= 0 &&
    y >= 0 &&
    x < 2 ** z &&
    y < 2 ** z;
  if (!valid) return Response.json({ error: "Ongeldige tegel" }, { status: 400 });

  // Only the Netherlands, so this can't be used as an open proxy.
  if (!tileInNetherlands(z, x, y)) return new Response(null, { status: 204, headers: { "Cache-Control": CACHED } });

  try {
    const png = await fetchAnnualTile(layer, z, x, y);
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": CACHED } });
  } catch (error) {
    console.error(error);
    return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
