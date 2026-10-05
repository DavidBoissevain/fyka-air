/**
 * Runs the collector's Samen Meten client against the live API, without
 * Supabase, to check what the Edge Function would write and how much CPU
 * it uses (Edge Functions allow 2 s of CPU per request).
 *
 * Run: npm run check:samenmeten
 */

import { fetchHour, fetchThingDetails } from "../supabase/functions/collect-samenmeten/samenmeten.ts";

const hour = new Date();
hour.setUTCHours(hour.getUTCHours() - 1, 0, 0, 0);

let cpu = process.cpuUsage();
let start = performance.now();
const { rows, observations } = await fetchHour(hour);
let used = process.cpuUsage(cpu);
console.log(
  `Sweep ${hour.toISOString()}: ${observations} observations -> ${rows.length} rows ` +
    `in ${((performance.now() - start) / 1000).toFixed(1)} s, CPU ${((used.user + used.system) / 1000).toFixed(0)} ms`,
);
const byQuantity = new Map<string, number>();
for (const r of rows) byQuantity.set(r.quantity, (byQuantity.get(r.quantity) ?? 0) + 1);
console.table([...byQuantity].map(([quantity, count]) => ({ quantity, count })));
console.log("Sample row:", rows[0]);

const names = new Set(rows.map((r) => r.station));
cpu = process.cpuUsage();
start = performance.now();
const details = await fetchThingDetails(names);
used = process.cpuUsage(cpu);
const located = details.filter((d) => d.latitude !== null).length;
console.log(
  `Details for ${names.size} sensors: ${details.length} found, ${located} located in NL, ` +
    `in ${((performance.now() - start) / 1000).toFixed(1)} s, CPU ${((used.user + used.system) / 1000).toFixed(0)} ms`,
);
console.log("Sample details:", details[0]);
