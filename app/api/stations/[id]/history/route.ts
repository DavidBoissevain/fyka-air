import { getStationHistory } from "@/lib/air-data";

export async function GET(_request: Request, { params }: RouteContext<"/api/stations/[id]/history">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Ongeldig station" }, { status: 400 });
  }
  return Response.json(await getStationHistory(id));
}
