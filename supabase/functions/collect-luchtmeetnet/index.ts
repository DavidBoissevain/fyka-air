// Hourly collector for Luchtmeetnet (professional stations), called by pg_cron
// with a secret API key. See TECHNICAL.md, "Collector design".
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { fetchMeasurements, fetchStationDetails, sleep } from "./luchtmeetnet.ts";

// Re-fetch the last few hours each run so missed runs and late data catch up.
const CATCH_UP_HOURS = 3;
// Station details cost one request each against the 100-per-5-minutes limit,
// so refresh a few per run, oldest first.
const DETAILS_PER_RUN = 20;
const DETAILS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DETAILS_SPACING_MS = 1000;

export default {
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    const db = ctx.supabaseAdmin;
    try {
      const end = new Date();
      end.setUTCMinutes(0, 0, 0);
      const start = new Date(end.getTime() - CATCH_UP_HOURS * 60 * 60 * 1000);

      const rows = await fetchMeasurements(start, end);
      const { data: upserted, error: ingestError } = await db.rpc("ingest_measurements", {
        p_source: "luchtmeetnet",
        p_rows: rows,
      });
      if (ingestError) throw ingestError;

      const { data: stations, error: stationsError } = await db
        .from("stations")
        .select("id, external_id, details_updated_at")
        .eq("source", "luchtmeetnet");
      if (stationsError) throw stationsError;

      // Never-refreshed stubs count as oldest.
      const refreshedAt = (s: { details_updated_at: string | null }) =>
        s.details_updated_at ? Date.parse(s.details_updated_at) : 0;
      const stale = stations
        .filter((s) => refreshedAt(s) < Date.now() - DETAILS_MAX_AGE_MS)
        .sort((a, b) => refreshedAt(a) - refreshedAt(b))
        .slice(0, DETAILS_PER_RUN);

      const failedStations: string[] = [];
      for (const station of stale) {
        try {
          const details = await fetchStationDetails(station.external_id);
          const { error } = await db
            .from("stations")
            .update({ ...details, details_updated_at: new Date().toISOString() })
            .eq("id", station.id);
          if (error) throw error;
        } catch (error) {
          console.error(`Station ${station.external_id}:`, error);
          failedStations.push(station.external_id);
        }
        await sleep(DETAILS_SPACING_MS);
      }

      const result = {
        window: { start: start.toISOString(), end: end.toISOString() },
        measurementsFetched: rows.length,
        measurementsWritten: upserted,
        stationDetailsRefreshed: stale.length - failedStations.length,
        failedStations,
      };
      console.log(JSON.stringify(result));
      return Response.json(result);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      return Response.json({ error: message }, { status: 500 });
    }
  }),
};
