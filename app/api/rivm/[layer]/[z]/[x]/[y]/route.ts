import { fetchTile, isAreaLayer, tileInNetherlands } from "@/lib/rivm-map";

// RIVM refreshes the map hourly; cache tiles briefly in the browser and on the CDN.
const CACHED = "public, max-age=300, s-maxage=600, stale-while-revalidate=600";

export async function GET(_request: Request, { params }: RouteContext<"/api/rivm/[layer]/[z]/[x]/[y]">) {
  const { layer, z: zParam, x: xParam, y: yParam } = await params;
  const [z, x, y] = [zParam, xParam, yParam].map(Number);
  const valid =
    isAreaLayer(layer) &&
    [z, x, y].every(Number.isInteger) &&
    z >= 6 &&
    z <= 12 &&
    x >= 0 &&
    y >= 0 &&
    x < 2 ** z &&
    y < 2 ** z;
  if (!valid) return Response.json({ error: "Ongeldige tegel" }, { status: 400 });

  // Only the Netherlands, so this can't be used as an open proxy.
  if (!tileInNetherlands(z, x, y)) return new Response(null, { status: 204, headers: { "Cache-Control": CACHED } });

  try {
    const png = await fetchTile(layer, z, x, y);
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": CACHED } });
  } catch (error) {
    console.error(error);
    return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
