// Mock data + domain types for Idea Finder.
// Ported from the design prototype's data.jsx.

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

export interface IdeaPage {
  id: string;
  title: string;
  status: Status;
  createdAt: string;
  notes: string;
  ideas: string[];
  cwsCount: number;
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

export const PARSED_IDEAS: ParsedIdea[] = [
  {
    id: "p_001",
    name: "PromptVault",
    topics: ["ai", "productivity"],
    revenue: "$12k/mo",
    mau: "8.4k",
    source: {
      platform: "reddit",
      url: "#",
      excerpt:
        "“I keep losing my best prompts in a Google Doc — would pay for something that auto-tags, ranks, and lets me share folders with my team. The dealbreaker is browser-side capture; ChatGPT/Claude tabs.”",
    },
    extension: "yes",
    complexity: "simple",
    date: "2026-05-18",
  },
  {
    id: "p_002",
    name: "Inbox Sentinel",
    topics: ["productivity"],
    revenue: "$4.2k/mo",
    mau: "2.1k",
    source: {
      platform: "ih",
      url: "#",
      excerpt:
        "Sentiment + urgency overlay on Gmail. Indie dev cleared $4k MRR in 11 weeks. Mentions a pricing wall at $9 → $19 that doubled conversions.",
    },
    extension: "yes",
    complexity: "medium",
    date: "2026-05-17",
  },
  {
    id: "p_003",
    name: "ReceiptParse",
    topics: ["finance", "ai"],
    revenue: null,
    mau: null,
    source: {
      platform: "pd",
      url: "#",
      excerpt:
        "Small business owners on PD asking for OCR + categorization that plugs into QuickBooks. Several said current tools require Zapier glue that breaks weekly.",
    },
    extension: "maybe",
    complexity: "complex",
    date: "2026-05-17",
  },
  {
    id: "p_004",
    name: "FocusFrame",
    topics: ["productivity", "design"],
    revenue: "$2.8k/mo",
    mau: "1.6k",
    source: {
      platform: "reddit",
      url: "#",
      excerpt:
        "“Hide everything on the page except the article I'm reading. Pomodoro mode optional.” Top comment: pays $5/mo, would pay $15.",
    },
    extension: "yes",
    complexity: "simple",
    date: "2026-05-16",
  },
  {
    id: "p_005",
    name: "QueryRunner",
    topics: ["devtools", "data"],
    revenue: "$28k/mo",
    mau: "4.2k",
    source: {
      platform: "hn",
      url: "#",
      excerpt:
        "DuckDB-in-browser for analysts. Founder posted a Show HN, hit #1 for 8h. Several enterprise inbound.",
    },
    extension: "no",
    complexity: "complex",
    date: "2026-05-16",
  },
  {
    id: "p_006",
    name: "Sponsorblock for Newsletters",
    topics: ["marketing", "writing"],
    revenue: null,
    mau: null,
    source: {
      platform: "reddit",
      url: "#",
      excerpt:
        "“I read 30 newsletters a week and 40% is sponsored. Want a button that collapses sponsored blocks like SponsorBlock for YouTube.”",
    },
    extension: "yes",
    complexity: "medium",
    date: "2026-05-15",
  },
  {
    id: "p_007",
    name: "Cohort Calculator",
    topics: ["data", "finance"],
    revenue: "$1.1k/mo",
    mau: "340",
    source: {
      platform: "ih",
      url: "#",
      excerpt:
        "Tiny niche tool for D2C founders. Built in 2 weekends, $39 lifetime, 28 sales first week.",
    },
    extension: "no",
    complexity: "medium",
    date: "2026-05-15",
  },
  {
    id: "p_008",
    name: "TabHerd",
    topics: ["productivity"],
    revenue: "$6.5k/mo",
    mau: "11.2k",
    source: {
      platform: "pd",
      url: "#",
      excerpt:
        "Smart tab grouping by domain + AI summary. Reviewers complain about Chrome's native grouping being clunky and not persistent across windows.",
    },
    extension: "yes",
    complexity: "medium",
    date: "2026-05-14",
  },
  {
    id: "p_009",
    name: "InvoiceNudge",
    topics: ["finance"],
    revenue: "$3.4k/mo",
    mau: "910",
    source: {
      platform: "ih",
      url: "#",
      excerpt:
        "Auto-followup for unpaid invoices. Average user recovers $1,800/mo. Stripe + QuickBooks integrations.",
    },
    extension: "no",
    complexity: "medium",
    date: "2026-05-13",
  },
  {
    id: "p_010",
    name: "ColorPick.io",
    topics: ["design", "devtools"],
    revenue: "$890/mo",
    mau: "5.4k",
    source: {
      platform: "reddit",
      url: "#",
      excerpt:
        "Designer-only color sampler with WCAG contrast and palette export. Browser eyedropper API is now stable, low-hanging fruit.",
    },
    extension: "yes",
    complexity: "simple",
    date: "2026-05-13",
  },
  {
    id: "p_011",
    name: "LinkedinLens",
    topics: ["marketing", "ai"],
    revenue: "$18k/mo",
    mau: "3.1k",
    source: {
      platform: "ih",
      url: "#",
      excerpt:
        "Overlays competitor signals on LinkedIn profiles for sales reps. Average ACV $49/mo, churn ~3%.",
    },
    extension: "yes",
    complexity: "complex",
    date: "2026-05-12",
  },
  {
    id: "p_012",
    name: "GrammarLite",
    topics: ["writing", "ai"],
    revenue: "$540/mo",
    mau: "2.7k",
    source: {
      platform: "reddit",
      url: "#",
      excerpt:
        "“Grammarly is bloated. I want a 200KB extension that fixes typos and nothing else.”",
    },
    extension: "yes",
    complexity: "simple",
    date: "2026-05-12",
  },
  {
    id: "p_013",
    name: "Cap Table Sandbox",
    topics: ["finance", "data"],
    revenue: null,
    mau: null,
    source: {
      platform: "hn",
      url: "#",
      excerpt:
        "Founders complaining Carta is too expensive for pre-seed. Spreadsheet alternatives are clunky.",
    },
    extension: "no",
    complexity: "complex",
    date: "2026-05-11",
  },
  {
    id: "p_014",
    name: "Site Stripper",
    topics: ["productivity", "design"],
    revenue: "$2.2k/mo",
    mau: "9.8k",
    source: {
      platform: "reddit",
      url: "#",
      excerpt:
        "Removes cookie banners, modals, sticky headers, all chrome — for screenshots and clean reading. CleanShot users say they'd buy.",
    },
    extension: "yes",
    complexity: "simple",
    date: "2026-05-10",
  },
  {
    id: "p_015",
    name: "Diff Letter",
    topics: ["writing", "devtools"],
    revenue: "$760/mo",
    mau: "420",
    source: {
      platform: "ih",
      url: "#",
      excerpt:
        "Track changes between two URLs over time. Niche, but lawyers and PMs pay $29/mo.",
    },
    extension: "yes",
    complexity: "medium",
    date: "2026-05-10",
  },
  {
    id: "p_016",
    name: "Standup Roundup",
    topics: ["productivity"],
    revenue: "$5.1k/mo",
    mau: "1.8k",
    source: {
      platform: "pd",
      url: "#",
      excerpt:
        "Async standup summarizer for Slack + Linear. Average team size 9.",
    },
    extension: "no",
    complexity: "medium",
    date: "2026-05-09",
  },
  {
    id: "p_017",
    name: "Type Sleuth",
    topics: ["design"],
    revenue: "$1.4k/mo",
    mau: "6.9k",
    source: {
      platform: "reddit",
      url: "#",
      excerpt:
        "Identify fonts on any webpage with a hover, plus pairing suggestions. WhatFont but with AI pairing.",
    },
    extension: "yes",
    complexity: "simple",
    date: "2026-05-08",
  },
  {
    id: "p_018",
    name: "Affiliate Cloak",
    topics: ["marketing"],
    revenue: "$420/mo",
    mau: "260",
    source: {
      platform: "ih",
      url: "#",
      excerpt: "One-line cloaker + analytics for solo creators. Founder posted a teardown.",
    },
    extension: "maybe",
    complexity: "medium",
    date: "2026-05-08",
  },
];

export const CWS_BY_IDEA: Record<string, CwsItem[]> = {
  i_001: [
    {
      id: "c_001",
      name: "PromptBox – ChatGPT Prompt Library",
      url: "#",
      installs: "82,000",
      rating: 4.6,
      paid: true,
      revenueFound:
        "Estimated $7k–9k MRR based on a Twitter thread from the founder in March 2026; the Pro plan at $4.99/mo seems to convert ~3.1% of MAU.",
      sources: [
        { title: "Founder's MRR thread on X", url: "#" },
        { title: "IndieHackers profile", url: "#" },
      ],
      notes: "Strong template library, weak team sharing",
    },
    {
      id: "c_002",
      name: "AIPRM for ChatGPT",
      url: "#",
      installs: "2,000,000",
      rating: 4.4,
      paid: true,
      revenueFound:
        "Multiple sources reference $1M+ ARR. Acquired by Lasso Security in late 2025.",
      sources: [{ title: "TechCrunch acquisition note", url: "#" }],
      notes: "Massive scale but locked-in to ChatGPT.com",
    },
    {
      id: "c_003",
      name: "Superpower ChatGPT",
      url: "#",
      installs: "300,000",
      rating: 4.7,
      paid: false,
      revenueFound: null,
      sources: [],
      notes: "Free, donations only. Open source.",
    },
  ],
  i_002: [
    {
      id: "c_010",
      name: "Gmail Sentry",
      url: "#",
      installs: "14,000",
      rating: 4.2,
      paid: true,
      revenueFound:
        "Founder said in a podcast around $3.5k MRR in early 2026. Pricing $7/mo, $59/yr.",
      sources: [{ title: "Indie pod episode 42", url: "#" }],
      notes: "",
    },
    {
      id: "c_011",
      name: "Mailflow Priority",
      url: "#",
      installs: "3,200",
      rating: 3.9,
      paid: true,
      revenueFound: null,
      sources: [],
      notes: "Janky UX, opportunity",
    },
  ],
  i_004: [
    {
      id: "c_020",
      name: "Clear Reader",
      url: "#",
      installs: "180,000",
      rating: 4.8,
      paid: false,
      revenueFound: null,
      sources: [],
      notes: "",
    },
    {
      id: "c_021",
      name: "Pocket Focus",
      url: "#",
      installs: "45,000",
      rating: 4.5,
      paid: true,
      revenueFound:
        "Pricing page shows $3/mo. With ~1.5% conversion that's likely $2k MRR.",
      sources: [{ title: "Pricing page", url: "#" }],
      notes: "",
    },
  ],
};

export const MY_IDEAS: IdeaPage[] = [
  {
    id: "i_001",
    title: "AI Prompt Management",
    status: "researching",
    createdAt: "2026-05-18",
    notes:
      "PromptVault is the strongest lead. Worth checking what existing CWS extensions do for prompt capture vs library mgmt. My hypothesis: capture is the wedge.",
    ideas: ["p_001", "p_012"],
    cwsCount: 3,
  },
  {
    id: "i_002",
    title: "Email Triage Overlays",
    status: "in_work",
    createdAt: "2026-05-15",
    notes:
      "Confirmed willingness to pay. Sentry pricing seems too low — could capture $19/mo if we focus on power users (>200 emails/day).",
    ideas: ["p_002", "p_016"],
    cwsCount: 2,
  },
  {
    id: "i_003",
    title: "Page Cleanup / Reader Mode",
    status: "new",
    createdAt: "2026-05-12",
    notes: "",
    ideas: ["p_004", "p_014"],
    cwsCount: 2,
  },
  {
    id: "i_004",
    title: "Designer Color Tools",
    status: "rejected",
    createdAt: "2026-05-08",
    notes:
      "Decent revenue but commoditized. Most successful tools are free/donation. Skip.",
    ideas: ["p_010", "p_017"],
    cwsCount: 0,
  },
  {
    id: "i_005",
    title: "Newsletter Reader Add-ons",
    status: "new",
    createdAt: "2026-05-06",
    notes: "",
    ideas: ["p_006"],
    cwsCount: 0,
  },
  {
    id: "i_006",
    title: "Tab & Window Management",
    status: "researching",
    createdAt: "2026-05-02",
    notes:
      "TabHerd has traction. Worth a deeper teardown of how it handles cross-window persistence.",
    ideas: ["p_008"],
    cwsCount: 0,
  },
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
