# Idea Finder — Parser

One-shot script that finds real product ideas on Reddit, classifies them with OpenAI,
and inserts new ones into the Supabase `parsed_ideas` table. Run it by hand whenever you
want fresh ideas — no cron required.

## What it does

1. Fetches recent posts from `r/SideProject`, `r/EntrepreneurRideAlong`, and `r/indiehackers`
   (public JSON endpoints, no Reddit auth).
2. Keeps only posts mentioning revenue signals (`$`, `mrr`, `arr`, `revenue`, `/mo`,
   `profitable`, `making`, `earning`), capped at `MAX_POSTS` (default 50).
3. Asks `gpt-4o-mini` whether each is a real product with revenue, and extracts
   name / topics / revenue / MAU / extension-fit / complexity / excerpt.
4. Inserts the products into `parsed_ideas`, skipping any whose `source_url` already exists.

## Setup

```bash
cd parser
npm install
cp .env.example .env   # then fill in the three keys
```

`.env`:

- `OPENAI_API_KEY` — from platform.openai.com
- `SUPABASE_URL` — same as `NEXT_PUBLIC_SUPABASE_URL` in the app's `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` — the `sb_secret_...` key (Dashboard → Project Settings → API keys)

## Run

```bash
npx tsx run.ts
```

Example output:

```
Fetched 248 posts → 27 passed filter → 11 are products → 9 inserted (2 duplicates skipped)
```

Refresh the app's **All Ideas** page to see the new rows.

## Prerequisite: service_role must have table access

This script writes with the secret (`service_role`) key. If inserts fail with
`permission denied for table parsed_ideas` (Postgres `42501`), the `service_role` is
missing table GRANTs in your project. Fix it once by running
[`../supabase/migrations/003_service_role_grants.sql`](../supabase/migrations/003_service_role_grants.sql)
in the Supabase Dashboard → SQL Editor.
