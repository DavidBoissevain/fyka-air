# Supabase

This folder holds the database schema ([migrations/](migrations/)) and the Edge Functions that collect air quality data ([functions/](functions/)). Design notes are in [TECHNICAL.md](../TECHNICAL.md). The Supabase CLI is a pinned dev dependency, so run it with `npx supabase`.

## Collector: `collect-luchtmeetnet`

`pg_cron` calls this function every hour at :15. It does three things:

1. Fetches the last 3 hours of Luchtmeetnet measurements and LKI values.
2. Upserts them through `public.ingest_measurements`.
3. Refreshes details (name, location, components) for up to 20 stations whose details are missing or more than a day old.

It only accepts calls made with a **secret** API key.

You can test the API client without Supabase:

```sh
npm run check:luchtmeetnet
```

## Setting up an environment

1. Apply the migrations:

   ```sh
   npx supabase db push    # hosted project (after `npx supabase link`)
   npx supabase db reset   # local stack (after `npx supabase start`, needs Docker)
   ```

2. Deploy the function (hosted only; the local stack serves it automatically):

   ```sh
   npx supabase functions deploy collect-luchtmeetnet
   ```

3. Store the two secrets the cron job reads. Run this in the SQL editor:

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<secret API key, sb_secret_...>', 'collector_secret_key');
   ```

   - For a hosted project, create a dedicated secret key for this under **Project Settings → API Keys**. That way it can be rotated without touching anything else.
     - The production project (`uoocwxpfujiwfrhkkskb`, "Air", eu-west-1) currently uses the `default` secret key.
     - To switch to a dedicated key, create it, then run `select vault.update_secret((select id from vault.secrets where name = 'collector_secret_key'), '<new key>');`.
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
