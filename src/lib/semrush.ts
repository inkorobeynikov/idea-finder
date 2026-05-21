// SEMrush Keyword Magic (Broad Match) access for the SEO keyword research feature.
//
// Primary path (runtime): the SEMrush Analytics API, used when SEMRUSH_API_KEY is set.
// The `phrase_fullsearch` report is the broad-match equivalent — it returns keywords
// that contain the words of the searched phrase, with search volume (Nq) and keyword
// difficulty (Kd). Docs: https://developer.semrush.com/api/v3/analytics/keyword-reports/
//
// Fallback path (no API key): the API route returns the extracted candidate keywords in
// "candidates" mode and the actual scraping is performed by Claude in a Cowork session
// using Claude-in-Chrome tools — navigate
//   https://www.semrush.com/analytics/keywordmagic/page/1/us/broad/?q={keyword}&db=us
// via mcp__Claude_in_Chrome__navigate, scrape the Broad Match table with get_page_text /
// javascript_tool, then persist through store.saveKeywords. Those MCP tools are not
// importable from a deployed Next.js route, so they are not called from this module.

const SEMRUSH_ENDPOINT = "https://api.semrush.com/";

export interface SemrushKeyword {
  keyword: string;
  globalVolume: number;
  kd: number;
}

/** Raised when no SEMRUSH_API_KEY is configured; the route catches it to fall back. */
export class MissingSemrushKeyError extends Error {
  constructor() {
    super("SEMRUSH_API_KEY is not set");
    this.name = "MissingSemrushKeyError";
  }
}

/**
 * Query SEMrush for keywords related to `keyword` (broad match). Returns every row the
 * API gives back — volume filtering and de-duplication happen in the route handler.
 * Returns [] on any API error (quota, login wall, malformed response) after logging.
 */
export async function searchSemrush(keyword: string): Promise<SemrushKeyword[]> {
  const key = process.env.SEMRUSH_API_KEY;
  if (!key) throw new MissingSemrushKeyError();

  const params = new URLSearchParams({
    type: "phrase_fullsearch",
    key,
    phrase: keyword,
    database: "us",
    export_columns: "Ph,Nq,Kd",
    display_limit: "100",
    display_sort: "Kd_asc",
  });

  let text: string;
  try {
    const res = await fetch(`${SEMRUSH_ENDPOINT}?${params.toString()}`);
    text = await res.text();
    if (!res.ok) {
      console.warn(`SEMrush ${res.status} for "${keyword}": ${text.slice(0, 120)}`);
      return [];
    }
  } catch (err) {
    console.warn(`SEMrush request failed for "${keyword}":`, err);
    return [];
  }

  // Error responses are plain text like "ERROR 50 :: NOTHING FOUND".
  if (text.startsWith("ERROR")) {
    console.warn(`SEMrush error for "${keyword}": ${text.trim()}`);
    return [];
  }

  return parseSemrushCsv(text);
}

/** Parse SEMrush's semicolon-delimited CSV (header row + data rows). */
function parseSemrushCsv(text: string): SemrushKeyword[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim());
  const phIdx = headers.indexOf("Keyword");
  const nqIdx = headers.indexOf("Search Volume");
  const kdIdx = headers.indexOf("Keyword Difficulty");

  const rows: SemrushKeyword[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(";");
    const keyword = (cols[phIdx] ?? "").trim();
    if (!keyword) continue;
    rows.push({
      keyword,
      globalVolume: Math.round(Number(cols[nqIdx]) || 0),
      kd: Math.round(Number(cols[kdIdx]) || 0),
    });
  }
  return rows;
}
