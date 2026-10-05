// Hourly collector for RIVM Samen Meten (citizen sensors), called by pg_cron
// with a secret API key. See TECHNICAL.md, "Collector design".
//
// Body:
//   {"mode": "sweep", "hoursAgo": 0}   sweep the hour labelled with the current hour (default)
//   {"mode": "sweep", "hour": "<ISO>"} sweep a specific hour (backfills)
//   {"mode": "things"}                 fetch details for new or stale sensors
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { fetchHour, fetchThingDetails } from "./samenmeten.ts";

// Refresh sensor details (location, network) weekly.
const DETAILS_MAX_AGE_DAYS = 7;

type Body = { mode?: "sweep" | "things"; hoursAgo?: number; hour?: string };

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const db = ctx.supabaseAdmin;
    try {
      const body: Body = await req.json().catch(() => ({}));

      if (body.mode === "things") {
        const { data: stale, error } = await db.rpc("stale_station_ids", {
          p_source: "samenmeten",
          p_max_age_days: DETAILS_MAX_AGE_DAYS,
        });
        if (error) throw error;
        const names = new Set<string>(stale ?? []);
        if (names.size === 0) return Response.json({ mode: "things", stale: 0 });

        const rows = await fetchThingDetails(names);
        const { data: updated, error: updateError } = await db.rpc("update_station_details", {
          p_source: "samenmeten",
          p_rows: rows,
        });
        if (updateError) throw updateError;
        const result = { mode: "things", stale: names.size, found: rows.length, updated };
        console.log(JSON.stringify(result));
        return Response.json(result);
      }

      const hour = body.hour ? new Date(body.hour) : new Date();
      if (Number.isNaN(hour.getTime())) return Response.json({ error: "Invalid hour" }, { status: 400 });
      if (!body.hour) hour.setUTCHours(hour.getUTCHours() - (body.hoursAgo ?? 0), 0, 0, 0);

      const { rows, observations } = await fetchHour(hour);
      const { data: written, error: ingestError } = await db.rpc("ingest_measurements", {
        p_source: "samenmeten",
        p_rows: rows,
      });
      if (ingestError) throw ingestError;
      const { data: lki, error: lkiError } = await db.rpc("compute_citizen_lki", { p_hour: hour.toISOString() });
      if (lkiError) throw lkiError;

      const result = { mode: "sweep", hour: hour.toISOString(), observations, rows: rows.length, written, lki };
      console.log(JSON.stringify(result));
      return Response.json(result);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      return Response.json({ error: message }, { status: 500 });
    }
  }),
};
