import { POINT_DECIMALS } from "@/lib/air-quality";
import { fetchPoint, inNetherlands, pointParam } from "@/lib/rivm-map";

// RIVM's calculated values at one spot, for the map's click popup.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lon = pointParam(searchParams.get("lon"), POINT_DECIMALS.nu);
  const lat = pointParam(searchParams.get("lat"), POINT_DECIMALS.nu);
  if (lon === null || lat === null) return Response.json({ error: "Ongeldige plek" }, { status: 400 });
  if (!inNetherlands(lon, lat)) {
    return Response.json({ error: "Plek buiten Nederland" }, { status: 400 });
  }

  try {
    const values = await fetchPoint(lon, lat);
    return Response.json(values, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "RIVM niet bereikbaar" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
