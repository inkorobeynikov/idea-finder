// POST /api/ideas/[id]/competitors/find
// Searches the web for products competing with the idea and extracts structured
// competitor data using OpenAI. Returns candidates without persisting — the
// client saves selected items via store.addCompetitor after operator confirms.

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FindBody {
  ideaName?: string;
  topics?: string[];
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface CompetitorCandidate {
  name: string;
  productUrl: string | null;
  revenue: string | null;
  mau: string | null;
  sourceUrl: string | null;
  topics: string[];
  extension: string;
  complexity: string | null;
  notes: string;
}

async function tavilySearch(
  apiKey: string,
  query: string,
): Promise<TavilyResult[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.results) ? (data.results as TavilyResult[]) : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  // 1. Auth via RLS-protected session client.
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return Response.json(
      { error: "Unauthorized", competitors: [] },
      { status: 401 },
    );
  }

  // 2. Validate keys.
  const tavilyKey = process.env.TAVILY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!tavilyKey || !openaiKey) {
    return Response.json(
      {
        error: "Server is missing TAVILY_API_KEY or OPENAI_API_KEY",
        competitors: [],
      },
      { status: 500 },
    );
  }

  // 3. Parse body.
  let body: FindBody;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body", competitors: [] },
      { status: 400 },
    );
  }
  const ideaName = (body.ideaName ?? "").trim();
  const topics = Array.isArray(body.topics) ? body.topics : [];
  if (!ideaName) {
    return Response.json(
      { error: "Missing ideaName", competitors: [] },
      { status: 400 },
    );
  }

  // 4. Three parallel Tavily searches.
  const [a, b, c] = await Promise.all([
    tavilySearch(tavilyKey, `"${ideaName}" revenue mrr site:indiehackers.com`),
    tavilySearch(tavilyKey, `"${ideaName}" competitors revenue mrr`),
    tavilySearch(
      tavilyKey,
      `"${topics[0] ?? ideaName}" product revenue mrr indiehackers.com`,
    ),
  ]);

  // Dedupe by URL, keep first 15.
  const seen = new Set<string>();
  const merged: TavilyResult[] = [];
  for (const r of [...a, ...b, ...c]) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    merged.push(r);
    if (merged.length >= 15) break;
  }

  if (merged.length === 0) {
    return Response.json({ competitors: [] });
  }

  // 5. Build the snippet block for OpenAI.
  const snippets = merged
    .map((r, i) => {
      const title = r.title ?? "(no title)";
      const content = (r.content ?? "").slice(0, 200);
      return `[${i + 1}] ${title}\nURL: ${r.url}\n${content}`;
    })
    .join("\n\n");

  const userContent = `Idea: ${ideaName}
Topics: ${topics.join(", ") || "—"}

Search results:
${snippets}

For each result that describes a real product or startup, extract:
{ name, productUrl, revenue (like "$5k/mo" or null), mau (like "8.4k" or null),
  sourceUrl, topics (1-2 from: ai,productivity,finance,devtools,marketing,writing,design,data),
  extension (yes/no/maybe/unknown), complexity (simple/medium/complex or null) }
Return a JSON array. Skip results that don't describe a named product. Max 10 items.`;

  // 6. Call OpenAI.
  let raw = "";
  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are extracting structured competitor data from web search results. Return only a valid JSON array, no markdown fences.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!aiRes.ok) throw new Error(`OpenAI ${aiRes.status}`);
    const aiData = await aiRes.json();
    raw = aiData?.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "OpenAI request failed",
        competitors: [],
      },
      { status: 502 },
    );
  }

  // 7. Parse JSON, tolerating accidental fences.
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return Response.json({
      error: "Could not parse AI response",
      competitors: [],
    });
  }

  if (!Array.isArray(parsed)) {
    return Response.json({
      error: "AI response was not an array",
      competitors: [],
    });
  }

  const allowedExt = new Set(["yes", "no", "maybe", "unknown"]);
  const allowedComplexity = new Set(["simple", "medium", "complex"]);
  const allowedTopics = new Set([
    "ai",
    "productivity",
    "finance",
    "devtools",
    "marketing",
    "writing",
    "design",
    "data",
  ]);

  const competitors: CompetitorCandidate[] = [];
  for (const item of parsed.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;

    const ext = typeof o.extension === "string" ? o.extension : "unknown";
    const complexityRaw = typeof o.complexity === "string" ? o.complexity : null;
    const topicsRaw = Array.isArray(o.topics) ? o.topics : [];
    const topicList = topicsRaw
      .filter((t): t is string => typeof t === "string")
      .filter((t) => allowedTopics.has(t))
      .slice(0, 2);

    competitors.push({
      name,
      productUrl: typeof o.productUrl === "string" ? o.productUrl : null,
      revenue: typeof o.revenue === "string" ? o.revenue : null,
      mau: typeof o.mau === "string" ? o.mau : null,
      sourceUrl: typeof o.sourceUrl === "string" ? o.sourceUrl : null,
      topics: topicList,
      extension: allowedExt.has(ext) ? ext : "unknown",
      complexity: complexityRaw && allowedComplexity.has(complexityRaw)
        ? complexityRaw
        : null,
      notes: "",
    });
  }

  return Response.json({ competitors });
}
