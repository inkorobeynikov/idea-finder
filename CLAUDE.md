@AGENTS.md

# Idea Finder

Internal tool for Ivan and Anya to find profitable digital product ideas and evaluate them as potential Chrome extensions.

**Strategy**: find working products with proven revenue → check Chrome Web Store competition → simplify to a "one-click" extension → ship and earn.

## Current state

The full UI is already built and works with **mock data** in `src/lib/data.ts` and `src/lib/store.tsx`.
Auth is fake (sessionStorage). All data is in-memory.

**The job now**: replace mock store with real Supabase backend.

## Stack

- **Framework**: Next.js 14+ App Router, TypeScript
- **Styling**: Tailwind CSS + shadcn/ui (custom CSS in globals.css)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (replacing current fake sessionStorage auth)
- **Hosting**: Vercel
- **Revenue search**: Perplexity API
- **Parsing agent**: Claude Code CLI on VPS via cron

## File structure

```
src/
  app/
    page.tsx                    # All Ideas — main table (uses useStore)
    layout.tsx                  # Wraps with StoreProvider
    ideas/
      page.tsx                  # Idea pages list
      [id]/page.tsx             # Single idea page
    api/                        # API routes (to be created)
  lib/
    data.ts                     # Types + mock data (keep types, replace mock data)
    store.tsx                   # Client state (replace fake auth + in-memory with Supabase)
  utils/
    supabase/
      client.ts       # createBrowserClient (created by Supabase setup)
      server.ts       # createServerClient (created by Supabase setup)
      middleware.ts   # updateSession (created by Supabase setup)
  components/
    AppShell.tsx                # Header + nav
    LoginScreen.tsx             # Login form (currently fake auth)
    TopBar.tsx
    icons.tsx
    ui.tsx
  middleware.ts                 # Session refresh only — needs auth redirect added
```

## Database schema

Column names follow the existing frontend types to minimize mapping:

```sql
-- Raw ideas from parsing agent
parsed_ideas
  id              uuid PK default gen_random_uuid()
  name            text NOT NULL          -- maps to ParsedIdea.name
  topics          text[]                 -- maps to ParsedIdea.topics
  revenue         text                   -- "$5k/mo", null
  mau             text                   -- "8.4k", null
  source_platform text NOT NULL          -- "reddit" | "ih" | "pd" | "hn"
  source_url      text NOT NULL
  source_excerpt  text
  extension       text default 'unknown' -- "yes"|"no"|"maybe"|"unknown"
  complexity      text                   -- "simple"|"medium"|"complex"
  parsed_at       timestamptz default now()
  is_reviewed     bool default false

-- Idea research pages
idea_pages
  id              uuid PK default gen_random_uuid()
  title           text NOT NULL
  status          text default 'new'     -- "new"|"researching"|"in_work"|"rejected"
  notes           text default ''
  created_at      timestamptz default now()
  created_by      uuid REFERENCES auth.users

-- Which parsed ideas belong to which page (many-to-many)
idea_page_items
  id              uuid PK default gen_random_uuid()
  idea_page_id    uuid REFERENCES idea_pages ON DELETE CASCADE
  parsed_idea_id  uuid REFERENCES parsed_ideas

-- Chrome Web Store research
cws_items
  id              uuid PK default gen_random_uuid()
  idea_page_id    uuid REFERENCES idea_pages ON DELETE CASCADE
  name            text NOT NULL          -- extension name
  url             text                   -- CWS link
  installs        text
  rating          numeric(3,1)
  paid            bool default false
  revenue_found   text                   -- Perplexity result
  sources         jsonb default '[]'     -- [{title, url}]
  notes           text default ''
  created_at      timestamptz default now()
```

## Key decisions

- **UI is done** — do not rewrite components, only wire up data
- **1 idea = 1 page** — selecting N ideas creates N separate idea pages
- **No registration UI** — users created manually in Supabase Dashboard
- **CWS is manual in MVP** — no auto-parsing
- **Perplexity API** for "Find revenue" — returns citations for verification
- **Client-side sorting** on main table — data already loaded, no extra requests
- **Mock data in data.ts is seed reference** — actual seed SQL is in supabase/seed.sql

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PERPLEXITY_API_KEY=
```

## Design

- Light theme: white backgrounds, `#E5E7EB` borders, `#F9FAFB` subtle backgrounds
- Primary button: `#111827` fill + white text
- Status colors: new=blue, researching=amber, in_work=green, rejected=gray
- Custom CSS lives in `src/app/globals.css` — **do not use inline Tailwind for layout classes already defined there**

## ROADMAP

Track progress in `ROADMAP.md`. Mark steps `[x]` when done.
