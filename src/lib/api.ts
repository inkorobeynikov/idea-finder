// Supabase data access for Idea Finder.
// Maps database rows (snake_case schema) to the frontend types in data.ts.

import { createClient } from "@/utils/supabase/client";
import {
  Complexity,
  CwsItem,
  CwsSource,
  Extension,
  IdeaPage,
  ParsedIdea,
  Platform,
  Status,
  Topic,
} from "./data";

// Lazy singleton browser client (created on first use, client-side only).
let _client: ReturnType<typeof createClient> | null = null;
function db() {
  return (_client ??= createClient());
}

/* ---------- Row shapes ---------- */

interface ParsedIdeaRow {
  id: string;
  name: string;
  topics: string[] | null;
  revenue: string | null;
  mau: string | null;
  source_platform: string;
  source_url: string;
  source_excerpt: string | null;
  extension: string | null;
  complexity: string | null;
  parsed_at: string;
}

interface IdeaPageRow {
  id: string;
  title: string;
  status: string | null;
  notes: string | null;
  created_at: string;
}

interface IdeaPageItemRow {
  idea_page_id: string;
  parsed_idea_id: string;
}

interface CwsItemRow {
  id: string;
  idea_page_id: string;
  name: string;
  url: string | null;
  installs: string | null;
  rating: number | null;
  paid: boolean | null;
  revenue_found: string | null;
  sources: CwsSource[] | null;
  notes: string | null;
}

/* ---------- Mappers ---------- */

function mapIdea(r: ParsedIdeaRow): ParsedIdea {
  return {
    id: r.id,
    name: r.name,
    topics: (r.topics ?? []) as Topic[],
    revenue: r.revenue,
    mau: r.mau,
    source: {
      platform: r.source_platform as Platform,
      url: r.source_url,
      excerpt: r.source_excerpt ?? "",
    },
    extension: (r.extension ?? "unknown") as Extension,
    complexity: (r.complexity ?? "medium") as Complexity,
    date: r.parsed_at,
  };
}

function mapPage(r: IdeaPageRow, ideaIds: string[]): IdeaPage {
  return {
    id: r.id,
    title: r.title ?? "",
    status: (r.status ?? "new") as Status,
    notes: r.notes ?? "",
    createdAt: r.created_at,
    ideas: ideaIds,
  };
}

function mapCws(r: CwsItemRow): CwsItem {
  return {
    id: r.id,
    name: r.name,
    url: r.url ?? "",
    installs: r.installs ?? "—",
    rating: typeof r.rating === "number" ? r.rating : Number(r.rating) || 0,
    paid: !!r.paid,
    revenueFound: r.revenue_found,
    sources: r.sources ?? [],
    notes: r.notes ?? "",
  };
}

/* ---------- Initial load ---------- */

export interface InitialData {
  ideas: ParsedIdea[];
  pages: IdeaPage[];
  cws: Record<string, CwsItem[]>;
}

export async function fetchAll(): Promise<InitialData> {
  const supabase = db();
  const [ideasRes, pagesRes, itemsRes, cwsRes] = await Promise.all([
    supabase.from("parsed_ideas").select("*").order("parsed_at", { ascending: false }),
    supabase.from("idea_pages").select("*").order("created_at", { ascending: false }),
    supabase.from("idea_page_items").select("idea_page_id, parsed_idea_id"),
    supabase.from("cws_items").select("*").order("created_at", { ascending: true }),
  ]);

  const firstError =
    ideasRes.error || pagesRes.error || itemsRes.error || cwsRes.error;
  if (firstError) throw firstError;

  const ideas = (ideasRes.data as ParsedIdeaRow[]).map(mapIdea);

  // Group page items by page id.
  const itemsByPage: Record<string, string[]> = {};
  for (const it of itemsRes.data as IdeaPageItemRow[]) {
    (itemsByPage[it.idea_page_id] ??= []).push(it.parsed_idea_id);
  }

  const pages = (pagesRes.data as IdeaPageRow[]).map((p) =>
    mapPage(p, itemsByPage[p.id] ?? []),
  );

  // Group CWS items by page id.
  const cws: Record<string, CwsItem[]> = {};
  for (const c of cwsRes.data as CwsItemRow[]) {
    (cws[c.idea_page_id] ??= []).push(mapCws(c));
  }

  return { ideas, pages, cws };
}

/* ---------- Mutations ---------- */

export async function insertPage(
  title: string,
  ideaIds: string[],
): Promise<IdeaPage> {
  const supabase = db();
  const { data: claims } = await supabase.auth.getClaims();
  const createdBy = claims?.claims?.sub ?? null;

  const { data, error } = await supabase
    .from("idea_pages")
    .insert({ title, status: "new", notes: "", created_by: createdBy })
    .select()
    .single();
  if (error) throw error;

  const page = mapPage(data as IdeaPageRow, []);

  if (ideaIds.length > 0) {
    await addPageItems(page.id, ideaIds);
    page.ideas = ideaIds;
  }
  return page;
}

export async function updatePageRow(
  id: string,
  patch: Partial<Pick<IdeaPage, "title" | "status" | "notes">>,
): Promise<void> {
  const { error } = await db().from("idea_pages").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePageRow(id: string): Promise<void> {
  // idea_page_items and cws_items cascade on delete.
  const { error } = await db().from("idea_pages").delete().eq("id", id);
  if (error) throw error;
}

export async function addPageItems(
  pageId: string,
  ideaIds: string[],
): Promise<void> {
  const rows = ideaIds.map((parsed_idea_id) => ({
    idea_page_id: pageId,
    parsed_idea_id,
  }));
  const { error } = await db()
    .from("idea_page_items")
    .upsert(rows, { onConflict: "idea_page_id,parsed_idea_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removePageItem(
  pageId: string,
  ideaId: string,
): Promise<void> {
  const { error } = await db()
    .from("idea_page_items")
    .delete()
    .eq("idea_page_id", pageId)
    .eq("parsed_idea_id", ideaId);
  if (error) throw error;
}

export async function insertCws(
  pageId: string,
  item: Omit<CwsItem, "id">,
): Promise<CwsItem> {
  const { data, error } = await db()
    .from("cws_items")
    .insert({
      idea_page_id: pageId,
      name: item.name,
      url: item.url || null,
      installs: item.installs,
      rating: item.rating,
      paid: item.paid,
      revenue_found: item.revenueFound,
      sources: item.sources,
      notes: item.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return mapCws(data as CwsItemRow);
}

export async function updateCwsRow(
  id: string,
  patch: Partial<CwsItem>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.url !== undefined) row.url = patch.url || null;
  if (patch.installs !== undefined) row.installs = patch.installs;
  if (patch.rating !== undefined) row.rating = patch.rating;
  if (patch.paid !== undefined) row.paid = patch.paid;
  if (patch.revenueFound !== undefined) row.revenue_found = patch.revenueFound;
  if (patch.sources !== undefined) row.sources = patch.sources;
  if (patch.notes !== undefined) row.notes = patch.notes;

  const { error } = await db().from("cws_items").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteCwsRow(id: string): Promise<void> {
  const { error } = await db().from("cws_items").delete().eq("id", id);
  if (error) throw error;
}
