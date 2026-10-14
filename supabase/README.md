# Supabase

This folder holds the database schema ([migrations/](migrations/)) and the Edge Functions that collect air quality data ([functions/](functions/)). Design notes are in [TECHNICAL.md](../TECHNICAL.md). The Supabase CLI is a pinned dev dependency, so run it with `npx supabase`.

## Collector: `collect-luchtmeetnet`

`pg_cron` calls this function every 10 minutes, so a newly published hour shows up soon after Luchtmeetnet publishes it. It does three things:

1. Fetches the last 3 hours of Luchtmeetnet measurements and LKI values.
2. Upserts them through `public.ingest_measurements`.
3. Refreshes details (name, location, components) for up to 20 stations whose details are missing or more than a day old.

It only accepts calls made with the secret API key named `collectors` (decision #53 in TECHNICAL.md).

To backfill after an outage, send `{"hours": 24}` to fetch the last 24 hours instead of 3 (at most 48).

You can test the API client without Supabase:

```sh
npm run check:luchtmeetnet
```

## Collector: `collect-samenmeten`

Citizen sensors from RIVM Samen Meten. `pg_cron` calls it three times an hour with a JSON body:

| When | Body | What it does |
|---|---|---|
| :40 | `{"mode": "sweep", "hoursAgo": 1}` | Fetches the previous hour, upserts it, and computes citizen-sensor LKI for that hour. Not the current hour: RIVM publishes calibrated values about an hour after raw ones (decision #24 in TECHNICAL.md) |
| :55 | `{"mode": "sweep", "hoursAgo": 1}` | Sweeps the previous hour again, to retry a failed :40 run and pick up late values |
| :05 | `{"mode": "things"}` | When sensors lack details (location, network) or they're older than 7 days, reads the full sensor inventory and updates them |

To backfill a specific hour, send `{"mode": "sweep", "hour": "2026-10-05T18:00:00Z"}`. Test the API client without Supabase with `npm run check:samenmeten`.

## Nightly maintenance

`pg_cron` runs `select public.maintain_measurements();` at 02:30 UTC. It rolls up daily averages for the last two days into `measurements_daily`, deletes raw hourly data older than 30 days, and deletes citizen-sensor LKI rows older than 2 days.

## Setting up an environment

1. Apply the migrations:

   ```sh
   npx supabase db push    # hosted project (after `npx supabase link`)
   npx supabase db reset   # local stack (after `npx supabase start`, needs Docker)
   ```

2. Deploy the functions (hosted only; the local stack serves them automatically):

   ```sh
   npx supabase functions deploy collect-luchtmeetnet
   npx supabase functions deploy collect-samenmeten
   ```

3. Store the two secrets the cron job reads. Run this in the SQL editor:

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<secret API key, sb_secret_...>', 'collector_secret_key');
   ```

   - For a hosted project, create a dedicated secret key named `collectors` under **Project Settings → API Keys**. That way it can be rotated without touching anything else. The functions accept only that key (`auth: "secret:collectors"`); a key with another name gets a 401.
     - The production project (`uoocwxpfujiwfrhkkskb`, "Luchtmeter", eu-west-1) uses it since 2026-10-13.
     - To store a new key, run `select vault.update_secret((select id from vault.secrets where name = 'collector_secret_key'), '<new key>');`.
   - If the local stack has no `collectors` key, set `auth: "secret:*"` while testing.
   - For the local stack, use `http://host.docker.internal:54321` as the URL and the secret key that `npx supabase status` prints.

4. Check that it runs. To trigger it by hand:

   ```sh
   curl -X POST https://<project-ref>.supabase.co/functions/v1/collect-luchtmeetnet \
     -H "apikey: <secret key>"
   ```

   Then look at the results:

   ```sql
   select * from cron.job_run_details order by start_time desc limit 5;
   select * from net._http_response order by created desc limit 5;
   ```
