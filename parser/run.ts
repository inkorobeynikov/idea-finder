// One-shot Idea Finder parser.
//
//   cd parser && npm install
//   cp .env.example .env   # fill in keys
//   npx tsx run.ts
//
// Pulls recent Reddit posts, keeps the ones that look revenue-related, asks
// OpenAI to extract structured product data, and inserts new ideas into the
// Supabase `parsed_ideas` table (duplicates skipped by source_url).

import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/* ---------- env ---------- */

function loadEnv(path = ".env") {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch {
    // No .env file — rely on the real environment.
  }
}
loadEnv();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env. Set OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
  );
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ---------- config ---------- */

const ENDPOINTS = [
  "https://www.reddit.com/r/SideProject/new.json?limit=100",
  "https://www.reddit.com/r/EntrepreneurRideAlong/search.json?q=revenue+making+mrr&sort=new&t=month&limit=100",
  "https://www.reddit.com/r/indiehackers/new.json?limit=100",
];

const KEYWORDS = ["$", "mrr", "arr", "revenue", "/mo", "profitable", "making", "earning"];
// Caps how many posts get sent to OpenAI (one call each). This is the only
// cost knob — override with MAX_POSTS in .env. Default 50 ≈ ~1 cent per run.
const MAX_AFTER_FILTER = Number(process.env.MAX_POSTS) || 50;
const VALID_TOPICS = [
  "ai", "productivity", "finance", "devtools", "marketing", "writing", "design", "data",
];

/* ---------- reddit ---------- */

interface RedditPost {
  title: string;
  selftext: string;
  url: string; // canonical link to the post
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Reddit returns max 100 posts per request; paginate with the `after` cursor.
// Listings cap at ~1000 items per subreddit, so MAX_PAGES * 100 is the ceiling.
const MAX_PAGES = 10;

async function fetchPosts(endpoint: string): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = after ? `${endpoint}${sep}after=${after}` : endpoint;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "idea-finder-bot/1.0" } });
      if (!res.ok) {
        console.warn(`  ! ${url} → HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}`);
        break;
      }
      const json: any = await res.json();
      const children: any[] = json?.data?.children ?? [];
      if (children.length === 0) break;
      posts.push(
        ...children.map((c) => ({
          title: c?.data?.title ?? "",
          selftext: c?.data?.selftext ?? "",
          url: c?.data?.permalink
            ? `https://www.reddit.com${c.data.permalink}`
            : c?.data?.url ?? "",
        })),
      );
      after = json?.data?.after ?? null;
      if (!after) break;
      await sleep(1000); // be polite to Reddit's unauthenticated endpoints
    } catch (err) {
      console.warn(`  ! ${url} → ${err instanceof Error ? err.message : "fetch failed"}`);
      break;
    }
  }
  return posts;
}

function passesFilter(p: RedditPost): boolean {
  const haystack = `${p.title} ${p.selftext}`.toLowerCase();
  return KEYWORDS.some((k) => haystack.includes(k));
}

/* ---------- classification ---------- */

interface Classified {
  is_product: boolean;
  name?: string;
  topics?: string[];
  revenue?: string | null;
  mau?: string | null;
  can_be_extension?: "yes" | "no" | "maybe" | "unknown";
  complexity?: "simple" | "medium" | "complex";
  excerpt?: string;
}

const SYSTEM_PROMPT = "You are a product analyst. Respond only with valid JSON.";

async function classify(post: RedditPost): Promise<Classified | null> {
  const user = `Is this post about a real digital product with revenue data?
If yes: { "is_product": true, "name": string, "topics": string[] (pick from: ai/productivity/finance/devtools/marketing/writing/design/data, max 2), "revenue": string like "$5k/mo" or null, "mau": string like "10k" or null, "can_be_extension": "yes"|"no"|"maybe"|"unknown", "complexity": "simple"|"medium"|"complex", "excerpt": string (max 150 chars, quote the revenue claim) }
If no: { "is_product": false }
Post title: ${post.title}
Post text: ${post.selftext.slice(0, 500)}`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    });
    const content = resp.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as Classified;
  } catch (err) {
    console.warn(`  ! classify failed: ${err instanceof Error ? err.message : "error"}`);
    return null;
  }
}

/* ---------- pipeline ---------- */

// Run up to `limit` async tasks concurrently, preserving result order.
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

const CONCURRENCY = 8;

async function main() {
  // Optional: wipe parsed_ideas before parsing (RESET=1).
  if (process.env.RESET === "1") {
    const { error } = await supabase
      .from("parsed_ideas")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.error(`Reset failed: ${error.message}`);
      process.exit(1);
    }
    console.log("RESET: cleared parsed_ideas.");
  }

  console.log("Fetching Reddit posts...");
  const batches = await Promise.all(ENDPOINTS.map(fetchPosts));
  const all = batches.flat();

  // Dedupe by URL across endpoints.
  const seen = new Set<string>();
  const unique = all.filter((p) => {
    if (!p.url || seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
  const fetched = unique.length;

  const filtered = unique.filter(passesFilter).slice(0, MAX_AFTER_FILTER);
  console.log(`Filtered to ${filtered.length} candidate posts. Classifying with OpenAI...`);

  interface Row {
    name: string;
    topics: string[];
    revenue: string | null;
    mau: string | null;
    source_platform: "reddit";
    source_url: string;
    source_excerpt: string;
    extension: string;
    complexity: string;
  }

  let done = 0;
  const classified = await mapPool(filtered, CONCURRENCY, async (post) => {
    const c = await classify(post);
    done++;
    const isProduct = !!(c?.is_product && c.name);
    console.log(
      `  [${done}/${filtered.length}] ${isProduct ? "product ✓" : "skip"}  ${post.title.slice(0, 55)}`,
    );
    if (!isProduct) return null;
    const row: Row = {
      name: c!.name!,
      topics: (Array.isArray(c!.topics) ? c!.topics : [])
        .filter((t) => VALID_TOPICS.includes(t))
        .slice(0, 2),
      revenue: c!.revenue ?? null,
      mau: c!.mau ?? null,
      source_platform: "reddit",
      source_url: post.url,
      source_excerpt: (c!.excerpt ?? "").slice(0, 150),
      extension: c!.can_be_extension ?? "unknown",
      complexity: c!.complexity ?? "medium",
    };
    return row;
  });

  const rows: Row[] = classified.filter((r): r is Row => r !== null);
  const products = rows.length;

  // Count how many already exist so we can report duplicates accurately.
  let duplicates = 0;
  if (products > 0) {
    const urls = rows.map((r) => r.source_url);
    const { data: existing } = await supabase
      .from("parsed_ideas")
      .select("source_url")
      .in("source_url", urls);
    const existingUrls = new Set((existing ?? []).map((e: any) => e.source_url));
    duplicates = urls.filter((u) => existingUrls.has(u)).length;
  }

  let inserted = 0;
  if (products > 0) {
    const { data, error } = await supabase
      .from("parsed_ideas")
      .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error(`\nInsert failed: ${error.message}`);
      console.error(
        "If this is 'permission denied for table parsed_ideas', grant service_role access " +
          "(see supabase/migrations/003_service_role_grants.sql).",
      );
      process.exit(1);
    }
    inserted = data?.length ?? products - duplicates;
  }

  console.log(
    `\nFetched ${fetched} posts → ${filtered.length} passed filter → ${products} are products → ` +
      `${inserted} inserted (${duplicates} duplicates skipped)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
