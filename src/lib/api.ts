// Supabase data access for Idea Finder.
// Maps database rows (snake_case schema) to the frontend types in data.ts.

import { createClient } from "@/utils/supabase/client";
import {
  Competitor,
  Complexity,
  CwsItem,
  CwsSource,
  Extension,
  IdeaPage,
  ParsedIdea,
  Platform,
  ResearchComment,
  ResearchWebResult,
  SeoKeyword,
  SeoResearchUrl,
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
  product_url: string | null;
  research_analysis: string | null;
  research_comments: ResearchComment[] | null;
  research_web: ResearchWebResult[] | null;
  research_prompt: string | null;
  researched_at: string | null;
}

interface IdeaPageRow {
  id: string;
  title: string;
  status: string | null;
  notes: string | null;
  created_at: string;
  startup_url: string | null;
}

interface IdeaPageItemRow {
  idea_page_id: string;
  parsed_idea_id: string;
}

interface CompetitorRow {
  id: string;
  idea_page_id: string;
  name: string;
  product_url: string | null;
  revenue: string | null;
  mau: string | null;
  topics: string[] | null;
  extension: string | null;
  complexity: string | null;
  source_url: string | null;
  notes: string | null;
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

interface SeoKeywordRow {
  id: string;
  idea_page_id: string;
  keyword: string;
  global_volume: number;
  kd: number;
  researched_at: string;
}

interface SeoResearchUrlRow {
  id: string;
  idea_page_id: string;
  url: string;
  label: string | null;
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
    productUrl: r.product_url,
    researchAnalysis: r.research_analysis,
    researchComments: r.research_comments ?? [],
    researchWeb: r.research_web ?? [],
    researchPrompt: r.research_prompt,
    researchedAt: r.researched_at,
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
    startupUrl: r.startup_url ?? null,
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

function mapCompetitor(r: CompetitorRow): Competitor {
  return {
    id: r.id,
    ideaPageId: r.idea_page_id,
    name: r.name,
    productUrl: r.product_url,
    revenue: r.revenue,
    mau: r.mau,
    topics: (r.topics ?? []) as Topic[],
    extension: (r.extension ?? "unknown") as Extension,
    complexity: (r.complexity ?? null) as Complexity | null,
    sourceUrl: r.source_url,
    notes: r.notes ?? "",
  };
}

function mapKeyword(r: SeoKeywordRow): SeoKeyword {
  return {
    id: r.id,
    ideaPageId: r.idea_page_id,
    keyword: r.keyword,
    globalVolume: r.global_volume,
    kd: r.kd,
    researchedAt: r.researched_at,
  };
}

function mapResearchUrl(r: SeoResearchUrlRow): SeoResearchUrl {
  return {
    id: r.id,
    ideaPageId: r.idea_page_id,
    url: r.url,
    label: r.label,
  };
}

/* ---------- Initial load ---------- */

export interface InitialData {
  ideas: ParsedIdea[];
  pages: IdeaPage[];
  cws: Record<string, CwsItem[]>;
  keywords: Record<string, SeoKeyword[]>;
  seoUrls: Record<string, SeoResearchUrl[]>;
  competitors: Record<string, Competitor[]>;
}

export async function fetchAll(): Promise<InitialData> {
  const supabase = db();
  const [
    ideasRes,
    pagesRes,
    itemsRes,
    cwsRes,
    keywordsRes,
    seoUrlsRes,
    competitorsRes,
  ] = await Promise.all([
    supabase.from("parsed_ideas").select("*").order("parsed_at", { ascending: false }),
    supabase.from("idea_pages").select("*").order("created_at", { ascending: false }),
    supabase.from("idea_page_items").select("idea_page_id, parsed_idea_id"),
    supabase.from("cws_items").select("*").order("created_at", { ascending: true }),
    supabase.from("seo_keywords").select("*").order("kd", { ascending: true }),
    supabase.from("seo_research_urls").select("*"),
    supabase.from("competitors").select("*").order("added_at", { ascending: true }),
  ]);

  const firstError =
    ideasRes.error ||
    pagesRes.error ||
    itemsRes.error ||
    cwsRes.error ||
    keywordsRes.error ||
    seoUrlsRes.error ||
    competitorsRes.error;
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

  // Group keywords + research URLs by page id.
  const keywords: Record<string, SeoKeyword[]> = {};
  for (const k of keywordsRes.data as SeoKeywordRow[]) {
    (keywords[k.idea_page_id] ??= []).push(mapKeyword(k));
  }
  const seoUrls: Record<string, SeoResearchUrl[]> = {};
  for (const u of seoUrlsRes.data as SeoResearchUrlRow[]) {
    (seoUrls[u.idea_page_id] ??= []).push(mapResearchUrl(u));
  }

  // Group competitors by page id.
  const competitors: Record<string, Competitor[]> = {};
  for (const c of competitorsRes.data as CompetitorRow[]) {
    (competitors[c.idea_page_id] ??= []).push(mapCompetitor(c));
  }

  return { ideas, pages, cws, keywords, seoUrls, competitors };
}

/* ---------- Mutations ---------- */

export interface ResearchPatch {
  researchAnalysis?: string | null;
  researchComments?: ResearchComment[];
  researchWeb?: ResearchWebResult[];
  researchPrompt?: string | null;
  researchedAt?: string | null;
}

export async function updateIdeaResearch(
  id: string,
  patch: ResearchPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.researchAnalysis !== undefined) row.research_analysis = patch.researchAnalysis;
  if (patch.researchComments !== undefined) row.research_comments = patch.researchComments;
  if (patch.researchWeb !== undefined) row.research_web = patch.researchWeb;
  if (patch.researchPrompt !== undefined) row.research_prompt = patch.researchPrompt;
  if (patch.researchedAt !== undefined) row.researched_at = patch.researchedAt;

  const { error } = await db().from("parsed_ideas").update(row).eq("id", id);
  if (error) throw error;
}

export async function updateIdeaProductUrl(id: string, url: string): Promise<void> {
  const { error } = await db()
    .from("parsed_ideas")
    .update({ product_url: url || null })
    .eq("id", id);
  if (error) throw error;
}

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

/* ---------- Competitors ---------- */

export async function insertCompetitor(
  pageId: string,
  item: Omit<Competitor, "id" | "ideaPageId">,
): Promise<Competitor> {
  const { data, error } = await db()
    .from("competitors")
    .insert({
      idea_page_id: pageId,
      name: item.name,
      product_url: item.productUrl,
      revenue: item.revenue,
      mau: item.mau,
      topics: item.topics,
      extension: item.extension,
      complexity: item.complexity,
      source_url: item.sourceUrl,
      notes: item.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return mapCompetitor(data as CompetitorRow);
}

export async function updateCompetitorRow(
  id: string,
  patch: Partial<Omit<Competitor, "id" | "ideaPageId">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.productUrl !== undefined) row.product_url = patch.productUrl;
  if (patch.revenue !== undefined) row.revenue = patch.revenue;
  if (patch.mau !== undefined) row.mau = patch.mau;
  if (patch.topics !== undefined) row.topics = patch.topics;
  if (patch.extension !== undefined) row.extension = patch.extension;
  if (patch.complexity !== undefined) row.complexity = patch.complexity;
  if (patch.sourceUrl !== undefined) row.source_url = patch.sourceUrl;
  if (patch.notes !== undefined) row.notes = patch.notes;

  const { error } = await db().from("competitors").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteCompetitorRow(id: string): Promise<void> {
  const { error } = await db().from("competitors").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- SEO keywords ---------- */

export async function updatePageStartupUrl(
  pageId: string,
  url: string,
): Promise<void> {
  const { error } = await db()
    .from("idea_pages")
    .update({ startup_url: url || null })
    .eq("id", pageId);
  if (error) throw error;
}

/** Replace all keyword rows for a page with a fresh result set (delete + bulk insert). */
export async function saveKeywords(
  pageId: string,
  rows: Array<{ keyword: string; globalVolume: number; kd: number }>,
): Promise<SeoKeyword[]> {
  const supabase = db();
  const { error: delError } = await supabase
    .from("seo_keywords")
    .delete()
    .eq("idea_page_id", pageId);
  if (delError) throw delError;

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("seo_keywords")
    .insert(
      rows.map((r) => ({
        idea_page_id: pageId,
        keyword: r.keyword,
        global_volume: r.globalVolume,
        kd: r.kd,
      })),
    )
    .select();
  if (error) throw error;
  return (data as SeoKeywordRow[]).map(mapKeyword);
}

export async function insertSeoResearchUrl(
  pageId: string,
  url: string,
  label?: string,
): Promise<SeoResearchUrl> {
  const { data, error } = await db()
    .from("seo_research_urls")
    .insert({ idea_page_id: pageId, url, label: label ?? null })
    .select()
    .single();
  if (error) throw error;
  return mapResearchUrl(data as SeoResearchUrlRow);
}

export async function updateSeoResearchUrlRow(
  id: string,
  patch: Partial<Pick<SeoResearchUrl, "url" | "label">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.label !== undefined) row.label = patch.label;
  const { error } = await db().from("seo_research_urls").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteSeoResearchUrlRow(id: string): Promise<void> {
  const { error } = await db().from("seo_research_urls").delete().eq("id", id);
  if (error) throw error;
}
