// POST /api/find-revenue
// For each selected CWS item, search Tavily for public revenue data, persist the
// result to cws_items, and stream one Server-Sent Event per completed item so the
// client can update rows in real time.

import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import type { CwsSource } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FindRevenueItem {
  id: string;
  name: string;
  url?: string;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

/** Take the first 1–2 sentences of a Tavily snippet as a compact summary. */
function summarize(content: string): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return trimmed.length > 240 ? trimmed.slice(0, 240) + "…" : trimmed;
  return sentences.slice(0, 2).join(" ").trim();
}

export async function POST(request: Request) {
  // 1. Verify the caller is an authenticated user (RLS-protected session client).
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate body.
  let items: FindRevenueItem[];
  try {
    const body = await request.json();
    items = Array.isArray(body?.items) ? body.items : [];
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (items.length === 0) {
    return Response.json({ error: "No items provided" }, { status: 400 });
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!tavilyKey || !serviceUrl || !serviceKey) {
    return Response.json(
      { error: "Server is missing TAVILY_API_KEY or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  // Service-role client used only for the cws_items write (bypasses RLS).
  const admin = createServiceClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      for (const item of items) {
        try {
          const query = `Chrome extension "${item.name}" revenue earnings MRR how much money`;
          const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyKey,
              query,
              search_depth: "advanced",
              max_results: 5,
            }),
          });

          if (!res.ok) throw new Error(`Tavily ${res.status}`);

          const data = await res.json();
          const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];

          const sources: CwsSource[] = results
            .filter((r) => r.url)
            .map((r) => ({ title: r.title || r.url!, url: r.url! }));

          const topContent = results.find((r) => r.content)?.content ?? "";
          const revenueFound =
            results.length > 0
              ? summarize(topContent) || "Public mentions found — see sources for details."
              : "No public revenue data found.";

          // Persist to the DB before notifying the client.
          await admin
            .from("cws_items")
            .update({ revenue_found: revenueFound, sources })
            .eq("id", item.id);

          send({ id: item.id, revenue_found: revenueFound, sources });
        } catch (err) {
          // Emit an error event so the client can advance progress without stalling.
          send({
            id: item.id,
            error: err instanceof Error ? err.message : "Search failed",
          });
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
