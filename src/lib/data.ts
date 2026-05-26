// Domain types, option lists, and formatting helpers for Idea Finder.
// Data now comes from Supabase (see lib/api.ts) — no mock data lives here.

export type Topic =
  | "ai"
  | "productivity"
  | "finance"
  | "devtools"
  | "marketing"
  | "writing"
  | "design"
  | "data";

export type Platform = "reddit" | "ih" | "pd" | "hn";
export type Extension = "yes" | "maybe" | "no" | "unknown";
export type Complexity = "simple" | "medium" | "complex";
export type Status = "new" | "researching" | "in_work" | "rejected";

export interface IdeaSource {
  platform: Platform;
  url: string;
  excerpt: string;
}

export interface ResearchComment {
  author: string;
  body: string;
  score: number;
}

export interface ResearchWebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ParsedIdea {
  id: string;
  name: string;
  topics: Topic[];
  revenue: string | null;
  mau: string | null;
  source: IdeaSource;
  extension: Extension;
  complexity: Complexity;
  date: string;
  productUrl?: string | null;
  // Enrichment research (populated by /api/enrich). All optional.
  researchAnalysis?: string | null;
  researchComments?: ResearchComment[];
  researchWeb?: ResearchWebResult[];
  researchPrompt?: string | null;
  researchedAt?: string | null;
}

export interface CwsSource {
  title: string;
  url: string;
}

export interface CwsItem {
  id: string;
  name: string;
  url: string;
  installs: string;
  rating: number;
  paid: boolean;
  revenueFound: string | null;
  sources: CwsSource[];
  notes: string;
}

export interface Competitor {
  id: string;
  ideaPageId: string;
  name: string;
  productUrl: string | null;
  revenue: string | null;
  mau: string | null;
  topics: Topic[];
  extension: Extension;
  complexity: Complexity | null;
  sourceUrl: string | null;
  notes: string;
}

export interface IdeaPage {
  id: string;
  title: string;
  status: Status;
  createdAt: string;
  notes: string;
  ideas: string[];
  startupUrl: string | null;
}

export interface SeoKeyword {
  id: string;
  ideaPageId: string;
  keyword: string;
  globalVolume: number;
  kd: number;
  researchedAt: string;
}

export interface SeoResearchUrl {
  id: string;
  ideaPageId: string;
  url: string;
  label: string | null;
}

export const TOPICS: Topic[] = [
  "ai",
  "productivity",
  "finance",
  "devtools",
  "marketing",
  "writing",
  "design",
  "data",
];

export const STATUSES: { id: Status; label: string }[] = [
  { id: "new", label: "New" },
  { id: "researching", label: "Researching" },
  { id: "in_work", label: "In work" },
  { id: "rejected", label: "Rejected" },
];

export const EXT_OPTIONS: { id: Extension; label: string }[] = [
  { id: "yes", label: "Yes" },
  { id: "maybe", label: "Maybe" },
  { id: "no", label: "No" },
  { id: "unknown", label: "Unknown" },
];

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "reddit", label: "Reddit" },
  { id: "ih", label: "IndieHackers" },
  { id: "pd", label: "ProductDiscovery" },
  { id: "hn", label: "HackerNews" },
];

/* ---------- sort + format helpers ---------- */

export function parseMoney(v: string | null): number {
  if (!v) return -1;
  const m = v.replace(/[$,/mo\s]/g, "");
  if (m.endsWith("k") || m.endsWith("K")) return parseFloat(m) * 1000;
  if (m.endsWith("m") || m.endsWith("M")) return parseFloat(m) * 1000000;
  return parseFloat(m) || 0;
}

export function parseUsers(v: string | null): number {
  if (!v) return -1;
  const m = v.replace(/[,\s]/g, "");
  if (m.endsWith("k")) return parseFloat(m) * 1000;
  if (m.endsWith("m") || m.endsWith("M")) return parseFloat(m) * 1000000;
  return parseFloat(m) || 0;
}

export function parseInstalls(v: string | null): number {
  if (!v) return -1;
  return parseFloat(String(v).replace(/[,\s]/g, "")) || 0;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatRelDate(iso: string): string {
  return `Created ${formatShortDate(iso)}`;
}
