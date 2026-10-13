import { POINT_DECIMALS } from "@/lib/air-quality";
import { fetchAnnualPoint, inNetherlands, pointParam } from "@/lib/rivm-map";

// RIVM's annual values at one spot, for the annual view's click popup.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lon = pointParam(searchParams.get("lon"), POINT_DECIMALS.jaar);
  const lat = pointParam(searchParams.get("lat"), POINT_DECIMALS.jaar);
  if (lon === null || lat === null) return Response.json({ error: "Ongeldige plek" }, { status: 400 });
  if (!inNetherlands(lon, lat)) {
    return Response.json({ error: "Plek buiten Nederland" }, { status: 400 });
  }

  try {
    const values = await fetchAnnualPoint(lon, lat);
    // The map changes once a year.
    return Response.json(values, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "RIVM niet bereikbaar" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
