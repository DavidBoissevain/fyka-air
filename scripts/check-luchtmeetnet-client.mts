/**
 * Runs the collector's Luchtmeetnet client against the live API, without
 * Supabase, to check what the Edge Function would write.
 *
 * Run: npm run check:luchtmeetnet
 */

import {
  fetchMeasurements,
  fetchStationDetails,
} from "../supabase/functions/collect-luchtmeetnet/luchtmeetnet.ts";

const end = new Date();
end.setUTCMinutes(0, 0, 0);
const start = new Date(end.getTime() - 3 * 60 * 60 * 1000);

const rows = await fetchMeasurements(start, end);
console.log(`${rows.length} rows for ${start.toISOString()} – ${end.toISOString()}`);

const byQuantity = new Map<string, number>();
for (const r of rows) byQuantity.set(r.quantity, (byQuantity.get(r.quantity) ?? 0) + 1);
console.table([...byQuantity].map(([quantity, count]) => ({ quantity, count })));
console.log("Sample row:", rows[0]);

const stations = new Set(rows.map((r) => r.station));
const first = [...stations][0];
console.log(`${stations.size} stations. Details for ${first}:`, await fetchStationDetails(first));
