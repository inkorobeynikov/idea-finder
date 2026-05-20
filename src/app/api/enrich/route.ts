// POST /api/enrich
// Enriches a single parsed idea: pulls the Reddit thread (when the source is
// Reddit), runs a Tavily web search, synthesizes an analysis with OpenAI, then
// persists everything to parsed_ideas and returns the result to the client.

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { ResearchComment, ResearchWebResult } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EnrichBody {
  id?: string;
  source_url?: string;
  name?: string;
  excerpt?: string;
  topics?: string[];
  userPrompt?: string;
}

interface RedditCommentData {
  author?: string;
  body?: string;
  score?: number;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

/** Fetch the top comments from a Reddit thread's public JSON endpoint. */
async function fetchRedditComments(sourceUrl: string): Promise<ResearchComment[]> {
  const jsonUrl = sourceUrl.replace(/\/?$/, "") + "/.json";
  const res = await fetch(jsonUrl, {
    headers: { "User-Agent": "idea-finder-bot/1.0" },
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);

  const data = await res.json();
  // [0] is the post listing, [1] is the comment listing.
  const children: { kind?: string; data?: RedditCommentData }[] =
    data?.[1]?.data?.children ?? [];

  return children
    .filter((c) => c.kind === "t1" && c.data?.body && c.data?.author)
    .map((c) => c.data as RedditCommentData)
    .filter((d) => {
      const body = (d.body ?? "").trim();
      return (
        d.author !== "AutoModerator" &&
        body &&
        body !== "[deleted]" &&
        body !== "[removed]"
      );
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((d) => ({
      author: d.author ?? "unknown",
      body: (d.body ?? "").slice(0, 300),
      score: d.score ?? 0,
    }));
}

/** Run a basic Tavily web search and map results to compact web finds. */
async function fetchWebResults(
  apiKey: string,
  query: string,
): Promise<ResearchWebResult[]> {
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
  if (!res.ok) throw new Error(`Tavily ${res.status}`);

  const data = await res.json();
  const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title || r.url!,
      url: r.url!,
      snippet: (r.content ?? "").slice(0, 150),
    }));
}

export async function POST(request: Request) {
  // 1. Authenticate via the RLS-protected session client.
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate body.
  let body: EnrichBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { id, source_url, name, excerpt, topics = [], userPrompt } = body;
  if (!id || !name) {
    return Response.json({ error: "Missing id or name" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!openaiKey || !tavilyKey) {
    return Response.json(
      { error: "Server is missing OPENAI_API_KEY or TAVILY_API_KEY" },
      { status: 500 },
    );
  }

  // 3. Gather Reddit + web research in parallel; tolerate either failing.
  const isReddit = !!source_url && source_url.includes("reddit.com");
  const [comments, web] = await Promise.all([
    isReddit
      ? fetchRedditComments(source_url!).catch(() => [] as ResearchComment[])
      : Promise.resolve([] as ResearchComment[]),
    fetchWebResults(
      tavilyKey,
      `${name} revenue earnings chrome extension ${topics[0] ?? ""}`.trim(),
    ).catch(() => [] as ResearchWebResult[]),
  ]);

  // 4. Synthesize an analysis with OpenAI.
  const commentLines =
    comments.length > 0
      ? comments
          .slice(0, 3)
          .map((c) => `- (↑${c.score}) u/${c.author}: ${c.body}`)
          .join("\n")
      : "No thread data";
  const webLines =
    web.length > 0
      ? web
          .slice(0, 3)
          .map((w) => `- ${w.title}: ${w.snippet}`)
          .join("\n")
      : "No web data";

  const userContent = `Analyze this product idea for Chrome extension potential.

Product: ${name}
Topics: ${topics.join(", ") || "—"}
Original excerpt: ${excerpt || "—"}

Reddit discussion highlights:
${commentLines}

Web research findings:
${webLines}
${userPrompt ? `\nUser's specific focus: ${userPrompt}\n` : ""}
Write 4-5 sentences covering:
- What problem this solves and who pays
- Why a simplified Chrome extension could work (or not)
- Key signal from the discussion/web research
- Main risk or competition concern`;

  let analysis = "";
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
              "You are a product analyst evaluating Chrome extension opportunities. Be concise.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!aiRes.ok) throw new Error(`OpenAI ${aiRes.status}`);
    const aiData = await aiRes.json();
    analysis = aiData?.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "AI synthesis failed" },
      { status: 502 },
    );
  }

  // 5. Persist to parsed_ideas via the (RLS) session client.
  const researchedAt = new Date().toISOString();
  const { error } = await supabase
    .from("parsed_ideas")
    .update({
      research_analysis: analysis,
      research_comments: comments,
      research_web: web,
      research_prompt: userPrompt || null,
      researched_at: researchedAt,
    })
    .eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    analysis,
    comments,
    web,
    researched_at: researchedAt,
  });
}
