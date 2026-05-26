"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { SeoKeyword, formatShortDate } from "@/lib/data";
import { Icon } from "@/components/icons";
import { InlineEdit, SortHeader, SortState } from "@/components/ui";

interface ResearchResponse {
  mode: "results" | "candidates";
  keywords?: Array<{ keyword: string; globalVolume: number; kd: number }>;
  candidates?: string[];
  researchedAt?: string;
  error?: string;
}

export function SeoKeywordsPanel({ pageId }: { pageId: string }) {
  const store = useStore();
  const page = store.getPage(pageId)!;
  const cwsList = store.getCws(pageId);
  const seoUrls = store.getSeoUrls(pageId);
  const keywords = store.getKeywords(pageId);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "globalVolume", dir: "desc" });

  function onSort(key: string) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  const sorted = useMemo(() => {
    const arr = [...keywords];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "keyword") cmp = a.keyword.localeCompare(b.keyword);
      else if (sort.key === "globalVolume") cmp = a.globalVolume - b.globalVolume;
      else cmp = a.kd - b.kd;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [keywords, sort]);

  const lastResearched = keywords[0]?.researchedAt ?? null;

  async function onRunResearch() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCandidates(null);

    // Build the full URL list: startup + CWS extensions + manual rows.
    const urls: Array<{ label: string; url: string }> = [];
    if (page.startupUrl) urls.push({ label: "Startup", url: page.startupUrl });
    for (const c of cwsList) if (c.url) urls.push({ label: c.name, url: c.url });
    for (const u of seoUrls) if (u.url) urls.push({ label: u.label ?? "", url: u.url });

    if (urls.length === 0) {
      setError("Add at least one URL (startup, CWS, or manual) before researching.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/ideas/${pageId}/seo-keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data: ResearchResponse = await res.json().catch(() => ({ mode: "results" }));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      if (data.mode === "candidates") {
        setCandidates(data.candidates ?? []);
      } else {
        await store.saveKeywords(pageId, data.keywords ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Keyword research failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="section-head" style={{ marginTop: 34 }}>
        <span className="section-title">SEO Keywords</span>
        <span style={{ color: "var(--muted-2)", fontSize: 12 }}>{keywords.length}</span>
        <span className="section-line" />
      </div>

      {/* ---------- A. URL inputs ---------- */}
      <div className="table-wrap" style={{ marginBottom: 14 }}>
        <table className="t">
          <colgroup>
            <col style={{ width: "30%" }} />
            <col />
            <col style={{ width: 44 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Label</th>
              <th>URL</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {/* Startup URL — pinned, editable */}
            <tr className="row">
              <td className="cell-name">Startup</td>
              <td onClick={(e) => e.stopPropagation()}>
                <InlineEdit
                  value={page.startupUrl ?? ""}
                  onChange={(v) => store.updateStartupUrl(pageId, v)}
                  placeholder="https://yourproduct.com"
                />
              </td>
              <td />
            </tr>

            {/* CWS extension URLs — read-only */}
            {cwsList.map((c) => (
              <tr className="row" key={c.id}>
                <td className="cell-name cell-muted">{c.name}</td>
                <td>
                  {c.url ? (
                    <a className="name-text subtle-link" href={c.url}>
                      {c.url}
                    </a>
                  ) : (
                    <span className="cell-num-empty">—</span>
                  )}
                </td>
                <td />
              </tr>
            ))}

            {/* Manual research URLs — editable + deletable */}
            {seoUrls.map((u) => (
              <tr className="row" key={u.id}>
                <td onClick={(e) => e.stopPropagation()}>
                  <InlineEdit
                    value={u.label ?? ""}
                    onChange={(v) => store.updateSeoUrl(pageId, u.id, { label: v })}
                    placeholder="Label"
                  />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <InlineEdit
                    value={u.url}
                    onChange={(v) => store.updateSeoUrl(pageId, u.id, { url: v })}
                    placeholder="https://…"
                  />
                </td>
                <td>
                  <button
                    className="row-x"
                    onClick={() => store.removeSeoUrl(pageId, u.id)}
                    aria-label="Remove URL"
                  >
                    <Icon.x />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-toolbar">
        <button
          className="btn secondary sm"
          onClick={() => store.addSeoUrl(pageId, "", "")}
        >
          <Icon.plus /> Add URL
        </button>
        <span className="spacer" />
        {keywords.length > 0 && (
          <>
            {lastResearched && (
              <span className="badge unknown">
                Last researched {formatShortDate(lastResearched)}
              </span>
            )}
            <button className="btn secondary sm" onClick={onRunResearch} disabled={loading}>
              ↺ Re-research
            </button>
          </>
        )}
      </div>

      {/* ---------- B. Results ---------- */}
      {loading ? (
        <div className="enrich-loading">
          <span className="spin dark" /> Researching keywords… SEMrush calls run in
          sequence, this can take a minute
        </div>
      ) : keywords.length === 0 ? (
        <div className="empty" style={{ padding: "30px 24px" }}>
          <h4>No keywords yet</h4>
          <p style={{ marginBottom: 14 }}>
            Pull Broad Match keywords from SEMrush for the URLs above.
          </p>
          <button className="btn primary sm" onClick={onRunResearch}>
            <Icon.sparkles /> Research Keywords
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <colgroup>
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <SortHeader id="keyword" label="Keyword" sort={sort} onSort={onSort} />
                <SortHeader
                  id="globalVolume"
                  label="Global Volume"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                />
                <SortHeader id="kd" label="KD %" sort={sort} onSort={onSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((k: SeoKeyword) => (
                <tr className="row" key={k.id}>
                  <td className="cell-name">{k.keyword}</td>
                  <td
                    className="cell-tabular cell-mono"
                    style={{ textAlign: "right" }}
                  >
                    {k.globalVolume.toLocaleString()}
                  </td>
                  <td
                    className="cell-tabular cell-mono"
                    style={{
                      textAlign: "right",
                      color: k.kd < 70 ? "#D97706" : "var(--muted)",
                      fontWeight: k.kd < 70 ? 600 : undefined,
                    }}
                  >
                    {k.kd}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="enrich-error">{error}</p>}

      {candidates && (
        <div className="empty" style={{ padding: "20px 24px", marginTop: 12 }}>
          <h4>No SEMRUSH_API_KEY — manual scrape needed</h4>
          <p style={{ marginBottom: 10 }}>
            Extracted these candidate keywords. Ask Claude to scrape them in SEMrush
            Keyword Magic (Broad Match) via Claude in Chrome; results will be saved here.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {candidates.map((c) => (
              <span key={c} className="topic">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
