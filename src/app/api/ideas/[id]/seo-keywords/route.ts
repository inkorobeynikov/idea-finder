// POST /api/ideas/[id]/seo-keywords
// Extract candidate search terms from the supplied URLs (page <title> + meta description),
// then — if SEMRUSH_API_KEY is set — query SEMrush Keyword Magic (Broad Match) for each,
// filter to Global Volume > 2000, dedupe, and sort by KD ascending. The route does NOT
// write the DB: the client persists results through the RLS browser client
// (store.saveKeywords), consistent with the project's no-service-role convention.
//
// Without an API key the route returns { mode: "candidates" } so the UI can surface the
// extracted terms and the Claude-in-Chrome agent fallback (see src/lib/semrush.ts).

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { MissingSemrushKeyError, searchSemrush } from "@/lib/semrush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResearchUrlInput {
  label: string;
  url: string;
}

interface KeywordResult {
  keyword: string;
  globalVolume: number;
  kd: number;
}

const VOLUME_FLOOR = 2000;
const MAX_KEYWORDS = 10;
const SEMRUSH_DELAY_MS = 1500;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "our", "are", "all", "any", "can",
  "from", "that", "this", "have", "has", "was", "will", "into", "out", "get",
  "app", "apps", "free", "online", "best", "new", "chrome", "extension",
  "extensions", "tool", "tools", "google", "web", "store", "com", "www", "http",
  "https", "home", "page", "site", "website", "welcome", "to", "of", "in", "on",
  "a", "an", "is", "it", "by", "or", "as", "at", "be",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull <title> + <meta name="description"> text from a URL. Returns "" on any failure. */
async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaFinderBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
    const desc =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ??
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(html)?.[1] ??
      "";
    return `${title} ${desc}`;
  } catch {
    return "";
  }
}

/** Extract up to MAX_KEYWORDS candidate terms, preferring 2–3 word phrases. */
function extractKeywords(texts: string[], labels: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (term: string) => {
    const t = term.trim().toLowerCase();
    if (!t || seen.has(t) || out.length >= MAX_KEYWORDS) return;
    seen.add(t);
    out.push(t);
  };

  // Prefer the product names verbatim first (the row labels are often the product).
  for (const label of labels) {
    const clean = label.replace(/\s+/g, " ").trim();
    if (clean && clean.length <= 40 && !STOPWORDS.has(clean.toLowerCase())) add(clean);
  }

  const tokenLists = texts.map((t) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );

  // 2–3 word phrases from each text.
  for (const size of [3, 2]) {
    for (const tokens of tokenLists) {
      for (let i = 0; i + size <= tokens.length; i++) {
        add(tokens.slice(i, i + size).join(" "));
      }
    }
  }
  // Single words as a last resort.
  for (const tokens of tokenLists) {
    for (const w of tokens) add(w);
  }

  return out.slice(0, MAX_KEYWORDS);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await params; // path id reserved for future per-page logging; not needed for the read.

  // 1. Authenticate via the RLS-protected session client.
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate body.
  let urls: ResearchUrlInput[];
  try {
    const body = await request.json();
    urls = Array.isArray(body?.urls) ? body.urls : [];
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  urls = urls.filter((u) => u && typeof u.url === "string" && u.url.trim());
  if (urls.length === 0) {
    return Response.json({ error: "No URLs provided" }, { status: 400 });
  }

  // 3. Extract candidate keywords from each page's title + description.
  const texts = await Promise.all(urls.map((u) => fetchPageText(u.url.trim())));
  const labels = urls.map((u) => (u.label ?? "").trim()).filter(Boolean);
  const candidates = extractKeywords(texts, labels);

  if (candidates.length === 0) {
    return Response.json({ error: "Could not extract any keywords from the URLs" }, { status: 422 });
  }

  // 4. SEMrush scrape (API path) or fall back to returning candidates.
  let collected: KeywordResult[];
  try {
    collected = [];
    for (let i = 0; i < candidates.length; i++) {
      const rows = await searchSemrush(candidates[i]);
      collected.push(...rows);
      if (i < candidates.length - 1) await sleep(SEMRUSH_DELAY_MS);
    }
  } catch (err) {
    if (err instanceof MissingSemrushKeyError) {
      return Response.json({ mode: "candidates", candidates });
    }
    throw err;
  }

  // 5. Filter > 2000 volume, dedupe by keyword (keep highest volume), sort by KD asc.
  const byKeyword = new Map<string, KeywordResult>();
  for (const row of collected) {
    if (row.globalVolume <= VOLUME_FLOOR) continue;
    const existing = byKeyword.get(row.keyword);
    if (!existing || row.globalVolume > existing.globalVolume) {
      byKeyword.set(row.keyword, row);
    }
  }
  const keywords = [...byKeyword.values()].sort((a, b) => a.kd - b.kd);

  return Response.json({
    mode: "results",
    keywords,
    researchedAt: new Date().toISOString(),
  });
}
