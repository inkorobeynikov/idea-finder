# Idea Finder — Implementation Roadmap

The UI is fully built with mock data. Each step below wires up a piece of the real Supabase backend.
Mark steps `[x]` when done. Mark `[~]` when in progress.

---

## Implementation note (architecture taken)

The mock layer has been fully removed and replaced with Supabase. The actual approach
**diverges from the per-step prompts below** but satisfies the same goals, following
CLAUDE.md's decisions ("UI is done — only wire data", "data already loaded → client-side sorting"):

- **No service-role key anywhere in the app.** All reads and writes go through the
  RLS-protected **browser** client using the publishable key + the user's session.
  (Step prompts that mention `SUPABASE_SERVICE_ROLE_KEY` and API routes were not used.)
- **Auth**: real `signInWithPassword`; session refreshed in `src/proxy.ts` (Next 16
  renamed `middleware` → `proxy`) via `src/utils/supabase/middleware.ts`.
- **Data layer**: `src/lib/api.ts` (queries + row↔type mapping), consumed by
  `src/lib/store.tsx`, which fetches everything once after login and applies
  optimistic, write-through mutations. Components were not rewritten.
- Helpers live in `src/utils/supabase/` (matches the pasted Supabase setup), not
  `src/lib/supabase/` as some prompts say.

⚠️ **DB RLS uses the deprecated `auth.role() = 'authenticated'` pattern** (from
`001_init.sql`). It works for this 2-person tool, but if anonymous sign-ins are ever
enabled it silently grants access. Consider switching policies to `TO authenticated`.

---

## Step 1 — Supabase client + Auth middleware `[x]`

> Done (via `src/utils/supabase/*` + `src/proxy.ts`). Auth state + sign in/out live in
> `src/lib/store.tsx`; `LoginScreen` uses `signInWithPassword`. No `/login` route — the
> `AppShell` gate renders the login screen in place when there's no session.

**What**: Replace fake sessionStorage auth with real Supabase Auth. Protect all routes.

**Prompt for Claude Code**:
```
The Idea Finder app has a fully built UI with fake auth (sessionStorage in src/lib/store.tsx) 
and mock data. We're now wiring up the real Supabase backend. Start with auth infrastructure.

1. Install is already done (@supabase/ssr @supabase/supabase-js).

2. Create src/lib/supabase/client.ts:
   - Export createClient() using createBrowserClient from @supabase/ssr
   - Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

3. Create src/lib/supabase/server.ts:
   - Export async createClient() using createServerClient from @supabase/ssr
   - Wire up cookies() from next/headers for getAll/setAll

4. Create src/middleware.ts:
   - Refresh the Supabase session on every request
   - If no valid user AND path is not /login → redirect to /login
   - If valid user AND path is /login → redirect to /
   - Exclude _next/static, _next/image, favicon.ico from matcher

5. Update src/components/LoginScreen.tsx:
   - Currently uses fake store.signIn(). Replace with real Supabase call:
     supabase.auth.signInWithPassword({ email, password })
   - On success: router.push('/') 
   - On error: show error message inline (keep existing UI structure)
   - Remove any import of useStore for auth purposes

6. Update src/components/AppShell.tsx or TopBar.tsx (wherever signOut is called):
   - Replace fake store.signOut() with supabase.auth.signOut() then router.push('/login')

Do not touch any table/data components yet — only auth plumbing.
After completing, update ROADMAP.md: mark Step 1 as [x].
```

---

## Step 2 — Database migration + seed `[x]`

> `001_init.sql` + `seed.sql` exist and are applied (verified: tables reachable, RLS active).
> Seed covers `parsed_ideas` only; `idea_pages`/`cws_items` are created by users at runtime.

**What**: Create SQL migration and seed files. Run them in Supabase Dashboard.

**Prompt for Claude Code**:
```
Create Supabase migration and seed files for Idea Finder. Read CLAUDE.md for the full schema.

1. Create supabase/migrations/001_init.sql with:
   - All 4 tables: parsed_ideas, idea_pages, idea_page_items, cws_items
   - Use the exact column names from CLAUDE.md (they match frontend types)
   - Enable RLS on all tables
   - Policy on each table: authenticated users can SELECT/INSERT/UPDATE/DELETE
     CREATE POLICY "authenticated_all" ON [table] FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

2. Create supabase/seed.sql with INSERT statements for parsed_ideas.
   Take the PARSED_IDEAS array from src/lib/data.ts and convert to SQL inserts.
   Map fields: name, topics (as ARRAY), revenue, mau, source_platform, source_url, 
   source_excerpt, extension (field name in DB), complexity, parsed_at.
   Use fixed UUIDs (gen_random_uuid() style strings) so seed is reproducible.

   Also insert the MY_IDEAS from data.ts as idea_pages rows (skip created_by for seed).
   And CWS_BY_IDEA as cws_items rows linked to the idea pages.

3. Add a comment at the top of each file explaining how to run:
   -- Run in Supabase Dashboard > SQL Editor
   -- Run 001_init.sql first, then seed.sql

After completing, update ROADMAP.md: mark Step 2 as [x].
```

---

## Step 3 — Connect All Ideas table to Supabase `[x]`

> Done, but kept as a Client Component fed by the store (not a Server Component) so the
> existing filter/sort/select logic is untouched. `PARSED_IDEAS` removed from `data.ts`.

**What**: Replace PARSED_IDEAS mock data with real Supabase query. Keep all UI logic intact.

**Prompt for Claude Code**:
```
Connect the All Ideas page to Supabase. The UI in src/app/page.tsx and all its components 
work perfectly with mock data — do not change any component logic or styling.

1. Convert src/app/page.tsx to a Server Component:
   - Remove "use client" if present
   - Fetch data: const supabase = await createClient() from src/lib/supabase/server.ts
   - Query: supabase.from('parsed_ideas').select('*').order('parsed_at', { ascending: false })
   - Map DB rows to ParsedIdea type (check field names match — see CLAUDE.md schema)
   - Pass ideas as prop to the existing client table component

2. The existing client component (IdeasTable or the default export in page.tsx) already handles 
   all filtering, sorting, selection. Just replace the data source.

3. In the handleCreate function (where pages are created from selected ideas):
   - Replace store.createPage() call with POST /api/ideas (create this route in next step)
   - For now, stub it: just console.log the ideaIds and redirect to /ideas

4. Keep all existing types in src/lib/data.ts — just remove the PARSED_IDEAS array 
   (it moves to seed.sql). Keep all other mock data (MY_IDEAS, CWS_BY_IDEA) for now.

After completing, update ROADMAP.md: mark Step 3 as [x].
```

---

## Step 4 — API routes: create idea pages `[x]`

> Done without an API route: `store.createPage` inserts `idea_pages` + `idea_page_items`
> directly via the RLS-protected client (`created_by` set from the session). Selecting N
> ideas creates N titled pages, then redirects to `/ideas`.

**What**: POST /api/ideas creates N pages from N selected idea IDs.

**Prompt for Claude Code**:
```
Create the API route that turns selected parsed ideas into idea pages in Supabase.

Create src/app/api/ideas/route.ts:

POST handler:
- Parse body: { ideaIds: string[] }
- Authenticate user via Supabase server client (use SUPABASE_SERVICE_ROLE_KEY)
- For each ideaId:
  1. Fetch name from parsed_ideas WHERE id = ideaId
  2. Insert into idea_pages: { title: name, status: 'new', created_by: user.id }
  3. Insert into idea_page_items: { idea_page_id: newPageId, parsed_idea_id: ideaId }
- Return { pages: [{ id, title }] }
- Return 401 if not authenticated, 400 if ideaIds missing/empty

Then wire it up in the All Ideas page:
- In handleCreate (src/app/page.tsx client section), replace the stub with a real fetch:
  const res = await fetch('/api/ideas', { method: 'POST', body: JSON.stringify({ ideaIds: [...selected] }) })
  const { pages } = await res.json()
  router.push('/ideas')

After completing, update ROADMAP.md: mark Step 4 as [x].
```

---

## Step 5 — Connect Ideas list page to Supabase `[x]`

> Done via the store (counts/preview derived in-memory from the single load). `MY_IDEAS` removed.

**What**: Replace MY_IDEAS mock with real DB query on /ideas page.

**Prompt for Claude Code**:
```
Connect the /ideas page (src/app/ideas/page.tsx) to Supabase.

Convert to Server Component:
- Fetch idea_pages with related counts:
  SELECT idea_pages.*, 
    count of idea_page_items per page,
    count of cws_items per page,
    first linked parsed_idea name (for preview)
  
  Use two approaches combined:
  1. supabase.from('idea_pages').select('*, idea_page_items(count), cws_items(count)')
  2. For preview name: supabase.from('idea_page_items').select('parsed_idea_id, parsed_ideas(name)').eq('idea_page_id', ...)
     Or do a single join: select('*, idea_page_items(parsed_ideas(name)), cws_items(count)')

- Map to the existing card component props (title, status, createdAt, cwsCount, idea count, preview name)
- Keep all existing card UI unchanged

Also remove MY_IDEAS from src/lib/data.ts since it's now served from DB.

After completing, update ROADMAP.md: mark Step 5 as [x].
```

---

## Step 6 — Connect Idea detail page to Supabase `[x]`

> Done via the store (no API routes). Title/notes/status updates, add/remove ideas, and
> CWS add/update/remove all write through to Supabase optimistically. `CWS_BY_IDEA` removed.

**What**: Replace in-memory store with real Supabase reads/writes on /ideas/[id].

**Prompt for Claude Code**:
```
Connect the idea detail page (src/app/ideas/[id]/page.tsx) to Supabase.
Read CLAUDE.md for the DB schema.

1. Convert to Server Component that loads:
   idea_pages row + joined idea_page_items(parsed_ideas(*)) + cws_items(*)
   WHERE idea_pages.id = params.id
   Return 404 if not found.

2. Pass loaded data to existing client subcomponents as props.

3. Create API routes for mutations (use SUPABASE_SERVICE_ROLE_KEY):

   src/app/api/ideas/[id]/route.ts
   - PATCH: update title, status, or notes on idea_pages

   src/app/api/ideas/[id]/items/route.ts  
   - POST: add a parsed_idea to this page (insert idea_page_items row)
   - Body: { ideaId: string }

   src/app/api/ideas/[id]/items/[itemId]/route.ts
   - DELETE: remove idea_page_items row

   src/app/api/ideas/[id]/cws/route.ts
   - POST: insert cws_items row
   - Body: { name, url, installs, rating, paid, notes }

   src/app/api/ideas/[id]/cws/[cwsId]/route.ts
   - PATCH: update cws_items row (any field)
   - DELETE: delete cws_items row

4. Wire up these routes in the client components:
   - Status dropdown onChange → PATCH /api/ideas/[id]
   - Notes textarea auto-save (debounce 1s) → PATCH /api/ideas/[id]
   - Title inline edit → PATCH /api/ideas/[id]
   - Remove idea button → DELETE /api/ideas/[id]/items/[itemId]
   - Add idea modal submit → POST /api/ideas/[id]/items
   - Add CWS form submit → POST /api/ideas/[id]/cws
   - CWS notes edit → PATCH /api/ideas/[id]/cws/[cwsId]
   - Remove CWS → DELETE /api/ideas/[id]/cws/[cwsId]

5. Remove CWS_BY_IDEA from src/lib/data.ts — now served from DB.

After completing, update ROADMAP.md: mark Step 6 as [x].
```

---

## Step 7 — Find Revenue: Tavily API `[x]`

> Done — but uses **Tavily** (`https://api.tavily.com/search`), not Perplexity. The route
> `src/app/api/find-revenue/route.ts` authenticates the user via the RLS session client,
> then for each selected CWS item queries Tavily (advanced search, 5 results), summarizes
> the top snippet into `revenue_found`, collects result links into `sources`, and writes
> the row using a **service-role** client. Results stream back as SSE (one event per item);
> the idea page reads the stream and applies each via `store.updateCws` so rows update live
> while the button shows "Searching... (N/total)".
>
> ⚠️ This is the one place a `SUPABASE_SERVICE_ROLE_KEY` is used in the app, contrary to the
> "no service-role key anywhere" note above. The write could instead go through the same
> RLS session client (`@/utils/supabase/server`) to stay consistent — the route already
> holds the user's session. Requires `TAVILY_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` in env.

**What**: Wire up the "Find revenue" button to Perplexity.

**Prompt for Claude Code**:
```
Implement the "Find revenue" API route for Idea Finder.

Create src/app/api/find-revenue/route.ts:

POST handler:
- Body: { items: Array<{ id: string, name: string, url?: string }> }
- Authenticate user
- For each item, call Perplexity API:
  POST https://api.perplexity.ai/chat/completions
  Headers: Authorization: Bearer ${PERPLEXITY_API_KEY}
  Body:
    model: "llama-3.1-sonar-small-128k-online"
    return_citations: true
    messages: [{
      role: "user",
      content: "How much revenue does the Chrome extension '[name]' make? 
      Search for creator interviews, indie hacker posts, reddit discussions, 
      or any public source with earnings data. Be concise, use specific numbers 
      if found, say 'No public data found' if nothing. CWS URL: [url]"
    }]

- After each response:
  - Save result text to cws_items.revenue_found (PATCH via supabase service client)
  - Save citations array as JSON to cws_items.sources (array of {title, url})

- Return results as a stream (Server-Sent Events) or as a single JSON array — 
  whichever is simpler to implement. If SSE: emit one JSON event per completed item.
  If JSON: process all items then return { results: [{id, revenue_found, sources}] }

Wire up in the idea page client component:
- "Find revenue" button → POST /api/find-revenue with selected CWS item ids
- On response: update the relevant CWS rows in local state to show revenue_found
- Button shows spinner + "Searching (1/N)..." during processing
- Expanded row shows revenue_found text + sources as numbered links

After completing, update ROADMAP.md: mark Step 7 as [x].
```

---

## Step 8 — Parsing agent `[~]`

> In progress. Built a simpler **one-shot** version in `parser/` (`run.ts`, run with
> `npx tsx run.ts`) instead of the multi-file VPS/cron design below: fetches Reddit JSON →
> keyword filter (cap 30) → classify with OpenAI `gpt-4o-mini` (JSON mode) → upsert into
> `parsed_ideas` (skip existing `source_url`). Uses `OPENAI_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY`.
> Requires `service_role` table grants — see `supabase/migrations/003_service_role_grants.sql`.
> Still TODO for full Step 8: Indie Hackers scraping, cron, multi-file structure.

**What**: Standalone Claude Code project that runs on VPS and fills parsed_ideas.

**Prompt for Claude Code**:
```
Create a standalone parsing agent for Idea Finder. This lives in /parser folder at project root.
It runs via Claude Code CLI on a VPS cron job.

Create parser/CLAUDE.md with these instructions:
---
# Idea Parser Agent

Goal: find working digital products with proven revenue. Insert structured data into Supabase.

Sources:
- Reddit: r/SideProject, r/EntrepreneurRideAlong, r/indiehackers (use public JSON API: https://www.reddit.com/r/SideProject/new.json)
- Indie Hackers: https://www.indiehackers.com/interviews (scrape with cheerio)

Period: posts from 2025-01-01 onward. Skip if source_url already exists in DB.

Algorithm:
1. Fetch posts from Reddit (100 posts per subreddit, last 7 days)
2. Fetch Indie Hackers interviews list
3. Keyword filter (fast, no LLM): keep only posts containing any of:
   $, mrr, arr, revenue, making, /mo, profitable, earning, income
4. For posts passing filter, classify with LLM:
   - Is this a real digital product with revenue data? (yes/no)
   - If yes, extract:
     name: product name
     topics: array of 1-3 tags from [ai, productivity, finance, devtools, marketing, writing, design, data]
     revenue: string like "$5k/mo" or null
     mau: string like "8.4k" or null  
     source_url: direct link to the post
     source_excerpt: 150 char summary of revenue claim
     extension: can this be simplified to a Chrome extension? (yes/no/maybe/unknown)
     complexity: how complex is the original product? (simple/medium/complex)
5. Insert valid results into Supabase via REST API
   Skip duplicates (check source_url not already in DB first)
---

Create parser/package.json with: node-fetch, cheerio (for IH scraping)
Create parser/src/reddit.ts — fetch posts from 3 subreddits
Create parser/src/indiehackers.ts — scrape IH interviews page
Create parser/src/filter.ts — keyword filter function
Create parser/src/supabase.ts — insert rows via Supabase REST API using SUPABASE_SERVICE_ROLE_KEY
Create parser/src/index.ts — orchestrates the full pipeline
Create parser/.env.example with: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Create parser/README.md with manual run command and cron setup instructions

After completing, update ROADMAP.md: mark Step 8 as [x].
```

---

## Step 9 — Enrich research panel `[x]`

> Done. The expanded All Ideas row now hosts a full research panel
> (`src/components/EnrichPanel.tsx`):
> - **Migration `002_add_research.sql`** adds `research_analysis`, `research_comments`,
>   `research_web`, `research_prompt`, `researched_at` to `parsed_ideas`. `ParsedIdea`
>   gained matching optional fields; `mapIdea()` maps them; `updateIdeaResearch()`
>   (api.ts) + a store action apply results optimistically with write-through.
> - **`/api/enrich`** (RLS session client): fetches the Reddit thread JSON (top 5
>   comments, skips AutoModerator/deleted) when the source is Reddit, runs a basic
>   Tavily search, synthesizes a 4–5 sentence analysis with OpenAI `gpt-4o-mini`,
>   then persists to `parsed_ideas` and returns `{ analysis, comments, web, researched_at }`.
> - **Panel UI**: Source excerpt + view link; an "Enriched [date]" badge with
>   Re-enrich + collapsible results when already researched, or a focus-note textarea
>   + "✦ Enrich" button when not; loading state; AI Analysis / Reddit Thread / Web
>   Finds sections; and a "Create idea page →" action.
> - Needs `OPENAI_API_KEY` + `TAVILY_API_KEY` in env.

**What**: Add a research/enrich panel to the expanded All Ideas row.

---

## Step 10 — Deploy to Vercel `[ ]`

Manual step:
1. Push all code to GitHub
2. Connect repo to Vercel dashboard
3. Add all env variables in Vercel project settings
4. Verify login works, verify data loads from Supabase
5. Create both users in Supabase Dashboard → Authentication → Users

Mark as [x] after successful deploy with real data.

---

## Step 11 — SEO Keywords panel `[~]`

> In progress. Adds a **SEO Keywords** section to the idea detail page
> (`src/components/SeoKeywordsPanel.tsx`), below the CWS section.
>
> - **Migration `004_seo_keywords.sql`** adds `idea_pages.startup_url` and two RLS tables:
>   `seo_keywords` (keyword / global_volume / kd, per page) and `seo_research_urls`
>   (manual research URLs). `IdeaPage` gained `startupUrl`; `SeoKeyword` / `SeoResearchUrl`
>   types added to `data.ts`; `api.ts` maps them and `fetchAll` hydrates both keyed by
>   page id; store gained `saveKeywords`, `getKeywords`, `getSeoUrls`, `addSeoUrl`,
>   `updateSeoUrl`, `removeSeoUrl`, `updateStartupUrl` (optimistic write-through).
> - **URL table**: editable Startup row + read-only CWS extension URLs + manual rows
>   (`+ Add URL`). **Keyword table**: client-sortable `Keyword | Global Volume | KD %`,
>   default KD asc, filtered to Global Volume > 2000.
> - **`/api/ideas/[id]/seo-keywords`** (RLS session client): extracts candidate keywords
>   from each URL's `<title>` + meta description, then queries SEMrush. **Primary path**
>   is the SEMrush Analytics API (`phrase_fullsearch`, broad match) when `SEMRUSH_API_KEY`
>   is set — returns `{ mode: "results" }`. **Fallback** when no key: returns
>   `{ mode: "candidates" }` and Claude scrapes Keyword Magic in Chrome, then persists via
>   `store.saveKeywords` (RLS browser client). The route never writes the DB itself.
> - Needs optional `SEMRUSH_API_KEY` in env (absence triggers the agent fallback).

---

## Backlog

- [ ] Auto-parse Chrome Web Store for CWS table
- [ ] Add sources: HN Show HN, Product Hunt
- [ ] Configurable AI provider for revenue search (settings page)
- [ ] Add sources: Twitter/X #buildinpublic
- [ ] Parse pain points ("is there a tool for...", "I wish there was...")
- [ ] Add sources: VC.ru, Habrhabr
- [ ] Stats dashboard
- [ ] Export to CSV
