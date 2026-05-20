"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ParsedIdea, formatShortDate } from "@/lib/data";
import { Icon } from "./icons";

/**
 * Research panel shown inside an expanded All Ideas row. Lets the user kick off
 * an "Enrich" pass (Reddit + web + AI synthesis via /api/enrich) and renders the
 * saved results. Reads research state straight off the idea so a completed enrich
 * (which updates the store) re-renders this without a reload.
 */
export function EnrichPanel({ idea }: { idea: ParsedIdea }) {
  const router = useRouter();
  const { updateIdeaResearch, createPage } = useStore();

  const isEnriched = !!idea.researchedAt;
  const [note, setNote] = useState(idea.researchPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Saved results start collapsed; a fresh enrich opens them.
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function enrich() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: idea.id,
          source_url: idea.source?.url,
          name: idea.name,
          excerpt: idea.source?.excerpt,
          topics: idea.topics,
          userPrompt: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Request failed (${res.status})`);
      }
      const result = await res.json();
      updateIdeaResearch(idea.id, {
        researchAnalysis: result.analysis,
        researchComments: result.comments,
        researchWeb: result.web,
        researchPrompt: note.trim() || null,
        researchedAt: result.researched_at,
      });
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePage() {
    if (creating) return;
    setCreating(true);
    try {
      await createPage([idea.id], idea.name);
      router.push("/ideas");
    } finally {
      setCreating(false);
    }
  }

  const comments = idea.researchComments ?? [];
  const web = idea.researchWeb ?? [];
  const showResults = isEnriched && open;

  return (
    <div className="enrich">
      {/* Source */}
      <section className="enrich-block">
        <span className="label">Source</span>
        <div className="body">
          <p>{idea.source?.excerpt || "No excerpt."}</p>
          <a
            href={idea.source?.url || "#"}
            className="view-source"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            View source <Icon.ext />
          </a>
        </div>
      </section>

      {/* Research */}
      <section className="enrich-block">
        <span className="label">Research</span>
        <div className="body">
          {loading ? (
            <div className="enrich-loading">
              <span className="spin dark" /> Researching… this takes ~15 seconds
            </div>
          ) : isEnriched ? (
            <>
              <div className="enrich-head">
                <span className="enrich-badge">
                  <Icon.sparkles /> Enriched {formatShortDate(idea.researchedAt!)}
                </span>
                <button
                  className="btn ghost xs"
                  onClick={() => setOpen((o) => !o)}
                >
                  {open ? "Hide results" : "Show results"}
                </button>
                <button className="btn ghost xs" onClick={enrich}>
                  Re-enrich
                </button>
              </div>
              {error && <p className="enrich-error">{error}</p>}
              {showResults && (
                <EnrichResults
                  analysis={idea.researchAnalysis ?? ""}
                  comments={comments}
                  web={web}
                  isReddit={idea.source?.platform === "reddit"}
                />
              )}
            </>
          ) : (
            <div className="enrich-form">
              <textarea
                className="textarea enrich-note"
                rows={2}
                placeholder="Focus note (optional) — e.g. focus on pricing, check if extension already exists, look for complaints…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="enrich-actions">
                <button className="btn primary sm" onClick={enrich}>
                  <Icon.sparkles /> Enrich
                </button>
              </div>
              {error && <p className="enrich-error">{error}</p>}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <div className="enrich-foot">
        <button
          className="btn secondary sm"
          onClick={handleCreatePage}
          disabled={creating}
        >
          {creating ? (
            <>
              <span className="spin dark" /> Creating…
            </>
          ) : (
            <>
              Create idea page <Icon.arrow />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function EnrichResults({
  analysis,
  comments,
  web,
  isReddit,
}: {
  analysis: string;
  comments: { author: string; body: string; score: number }[];
  web: { title: string; url: string; snippet: string }[];
  isReddit: boolean;
}) {
  return (
    <div className="enrich-results">
      {analysis && (
        <div className="enrich-section">
          <span className="enrich-section-label">AI Analysis</span>
          <p className="enrich-analysis">{analysis}</p>
        </div>
      )}

      {isReddit && comments.length > 0 && (
        <div className="enrich-section">
          <span className="enrich-section-label">Reddit Thread</span>
          <ul className="enrich-comments">
            {comments.map((c, i) => (
              <li key={i}>
                <span className="cmt-score">↑ {c.score}</span>
                <span className="cmt-author">u/{c.author}:</span>
                <span className="cmt-body">
                  {c.body.length > 120 ? c.body.slice(0, 120) + "…" : c.body}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {web.length > 0 && (
        <div className="enrich-section">
          <span className="enrich-section-label">Web Finds</span>
          <ul className="enrich-web">
            {web.map((w, i) => (
              <li key={i}>
                <a
                  href={w.url}
                  className="src-link"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {w.title} <Icon.ext />
                </a>
                {w.snippet && <span className="web-snippet">{w.snippet}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
