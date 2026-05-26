"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  Competitor,
  CwsItem,
  ParsedIdea,
  STATUSES,
  Status,
  Topic as TopicName,
  formatShortDate,
} from "@/lib/data";
import { Icon } from "@/components/icons";
import { EnrichPanel } from "@/components/EnrichPanel";
import { SeoKeywordsPanel } from "@/components/SeoKeywordsPanel";
import {
  Checkbox,
  ComplexityCell,
  Dropdown,
  ExtBadge,
  InlineEdit,
  MauCell,
  Modal,
  RevenueCell,
  SourceCell,
  StatusBadge,
  Toggle,
  Topic,
  TopicsCell,
} from "@/components/ui";

export default function IdeaPageRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const page = store.getPage(params.id);

  if (!page) {
    return (
      <div className="page">
        <button className="crumb" onClick={() => router.push("/ideas")}>
          <Icon.back /> My Ideas
        </button>
        <div className="empty" style={{ marginTop: 32 }}>
          <h4>Page not found</h4>
          <p>This idea page no longer exists.</p>
        </div>
      </div>
    );
  }

  return <IdeaPageScreen key={page.id} pageId={page.id} />;
}

function IdeaPageScreen({ pageId }: { pageId: string }) {
  const router = useRouter();
  const store = useStore();
  const page = store.getPage(pageId)!;
  const { ideasById } = store;

  const [title, setTitle] = useState(page.title || "");
  const [notes, setNotes] = useState(page.notes || "");
  const [savedFlash, setSavedFlash] = useState(false);

  // Auto-save (debounced) for title + notes
  useEffect(() => {
    if (title === (page.title || "") && notes === (page.notes || "")) return;
    const t = setTimeout(() => {
      store.updatePage({ ...page, title, notes });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, notes]);

  function setStatus(newStatus: string) {
    store.updatePage({ ...page, status: newStatus as typeof page.status });
  }

  // Ideas table state
  const [expandedIdea, setExpandedIdea] = useState<Set<string>>(new Set());
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);

  function toggleExpandIdea(id: string) {
    setExpandedIdea((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const ideaRows = page.ideas
    .map((id) => ideasById[id])
    .filter(Boolean) as ParsedIdea[];

  // CWS state
  const cwsList = store.getCws(pageId);
  const [selectedCws, setSelectedCws] = useState<Set<string>>(new Set());
  const [expandedCws, setExpandedCws] = useState<Set<string>>(new Set());
  const [showAddCwsModal, setShowAddCwsModal] = useState(false);
  const [findRevState, setFindRevState] = useState<"idle" | "loading" | "done">("idle");
  const [findProgress, setFindProgress] = useState<[number, number]>([0, 0]);

  // Competitors state
  const competitorsList = store.getCompetitors(pageId);
  const [showFindCompetitorsModal, setShowFindCompetitorsModal] = useState(false);
  const [showAddCompetitorModal, setShowAddCompetitorModal] = useState(false);

  const ideaNameForFind = ideaRows[0]?.name ?? (title || "this idea");
  const topicsForFind = ideaRows[0]?.topics ?? [];

  function toggleCwsSel(id: string) {
    setSelectedCws((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleCwsExpand(id: string) {
    setExpandedCws((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const cwsAllChecked = cwsList.length > 0 && cwsList.every((c) => selectedCws.has(c.id));
  const cwsSomeChecked = cwsList.some((c) => selectedCws.has(c.id)) && !cwsAllChecked;
  function toggleCwsAll() {
    if (cwsAllChecked) setSelectedCws(new Set());
    else setSelectedCws(new Set(cwsList.map((c) => c.id)));
  }

  function removeCws(id: string) {
    store.removeCws(pageId, id);
    setSelectedCws((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setExpandedCws((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  async function findRevenue() {
    const ids = [...selectedCws];
    if (ids.length === 0 || findRevState === "loading") return;

    const items = ids
      .map((id) => cwsList.find((c) => c.id === id))
      .filter((c): c is CwsItem => !!c)
      .map((c) => ({ id: c.id, name: c.name, url: c.url || undefined }));

    setFindRevState("loading");
    setFindProgress([0, items.length]);

    try {
      const res = await fetch("/api/find-revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

      // Read the SSE stream, applying each completed item as it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = 0;

      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;

          const evt = JSON.parse(json) as {
            id: string;
            revenue_found?: string;
            sources?: { title: string; url: string }[];
            error?: string;
          };

          if (!evt.error && evt.revenue_found !== undefined) {
            store.updateCws(pageId, evt.id, {
              revenueFound: evt.revenue_found,
              sources: evt.sources ?? [],
            });
          }
          done += 1;
          setFindProgress([done, items.length]);
        }
      }

      setFindRevState("done");
      setTimeout(() => {
        setFindRevState("idle");
        setSelectedCws(new Set());
      }, 1200);
    } catch (e) {
      console.error("Find revenue failed:", e);
      setFindRevState("idle");
    }
  }

  return (
    <div className="page">
      <button className="crumb" onClick={() => router.push("/")}>
        <Icon.back /> All Ideas
      </button>

      <div className="idea-header">
        <input
          className="idea-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled idea page"
        />
        <StatusDropdown value={page.status} onChange={setStatus} />
        <MoreMenu
          onDelete={() => {
            if (confirm("Delete this idea page? This cannot be undone.")) {
              store.deletePage(page.id);
              router.push("/ideas");
            }
          }}
        />
      </div>

      <div className="idea-meta-row">
        <span>{ideaRows.length} ideas</span>
        <span className="sep">·</span>
        <span>{cwsList.length} CWS items</span>
        <span className="sep">·</span>
        <span>Created {formatShortDate(page.createdAt)}</span>
      </div>

      <div className="notes-row">
        <textarea
          className="notes-area"
          rows={2}
          placeholder="Add notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <span className={`save-indicator ${savedFlash ? "visible" : ""}`}>
          <Icon.check /> Saved
        </span>
      </div>

      {/* ---------- Ideas section ---------- */}
      <div className="section-head">
        <span className="section-title">Ideas</span>
        <span style={{ color: "var(--muted-2)", fontSize: 12 }}>{ideaRows.length}</span>
        <span className="section-line" />
      </div>

      {ideaRows.length === 0 ? (
        <button className="add-row-btn" onClick={() => setShowAddIdeaModal(true)}>
          <Icon.plus /> Add ideas from the database
        </button>
      ) : (
        <>
          <div className="table-wrap">
            <table className="t">
              <colgroup>
                <col />
                <col style={{ width: 170 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 115 }} />
                <col style={{ width: 32 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Topics</th>
                  <th>Revenue</th>
                  <th>MAU</th>
                  <th>Source</th>
                  <th>Complexity</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ideaRows.map((row) => {
                  const isOpen = expandedIdea.has(row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr className="row" onClick={() => toggleExpandIdea(row.id)}>
                        <td className="cell-name">
                          <span className={`chev ${isOpen ? "open" : ""}`}>
                            <Icon.chev />
                          </span>
                          <span className="name-text">{row.name}</span>
                        </td>
                        <td>
                          <TopicsCell topics={row.topics} />
                        </td>
                        <td>
                          <RevenueCell value={row.revenue} />
                        </td>
                        <td>
                          <MauCell value={row.mau} />
                        </td>
                        <td>
                          <SourceCell source={row.source} />
                        </td>
                        <td>
                          <ComplexityCell value={row.complexity} />
                        </td>
                        <td>
                          {row.productUrl ? (
                            <a
                              href={row.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Open product"
                              style={{ color: "var(--muted)", display: "inline-flex" }}
                            >
                              <Icon.ext />
                            </a>
                          ) : null}
                        </td>
                        <td>
                          <button
                            className="row-x"
                            onClick={(e) => {
                              e.stopPropagation();
                              store.removeIdeaFromPage(page.id, row.id);
                            }}
                            title="Remove from page"
                          >
                            <Icon.x />
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="expand-row">
                          <td colSpan={8} onClick={(e) => e.stopPropagation()}>
                            <EnrichPanel idea={row} showCreatePage={false} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="add-row-btn" onClick={() => setShowAddIdeaModal(true)}>
            <Icon.plus /> Add idea from database
          </button>
        </>
      )}

      {/* ---------- Competitors section ---------- */}
      <div className="section-head" style={{ marginTop: 34 }}>
        <span className="section-title">Competitors</span>
        <span style={{ color: "var(--muted-2)", fontSize: 12 }}>
          {competitorsList.length}
        </span>
        <span className="section-line" />
      </div>

      <div className="section-toolbar">
        <span className="left">
          {competitorsList.length}{" "}
          {competitorsList.length === 1 ? "competitor" : "competitors"}
        </span>
        <span className="spacer" />
        <button
          className="btn secondary sm"
          onClick={() => setShowAddCompetitorModal(true)}
        >
          <Icon.plus /> Add manually
        </button>
        <button
          className="btn primary sm"
          onClick={() => setShowFindCompetitorsModal(true)}
        >
          <Icon.sparkles /> Find competitors
        </button>
      </div>

      {competitorsList.length === 0 ? (
        <button
          className="add-row-btn"
          onClick={() => setShowFindCompetitorsModal(true)}
        >
          <Icon.plus /> Find competitors from the web
        </button>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <colgroup>
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 115 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Revenue</th>
                <th>MAU</th>
                <th>Extension?</th>
                <th>Complexity</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitorsList.map((c) => (
                <tr className="row" key={c.id}>
                  <td className="cell-name">
                    <span className="name-text">{c.name}</span>
                    {c.productUrl ? (
                      <a
                        href={c.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open product"
                        style={{
                          color: "var(--muted)",
                          display: "inline-flex",
                          marginLeft: 6,
                          verticalAlign: "middle",
                        }}
                      >
                        <Icon.ext />
                      </a>
                    ) : null}
                  </td>
                  <td>
                    <RevenueCell value={c.revenue} />
                  </td>
                  <td>
                    <MauCell value={c.mau} />
                  </td>
                  <td>
                    <ExtBadge value={c.extension} />
                  </td>
                  <td>
                    <ComplexityCell value={c.complexity ?? "medium"} />
                  </td>
                  <td>
                    <InlineEdit
                      value={c.notes}
                      onChange={(v) =>
                        store.updateCompetitor(pageId, c.id, { notes: v })
                      }
                      placeholder="Add note..."
                    />
                  </td>
                  <td>
                    <button
                      className="row-x"
                      onClick={() => store.removeCompetitor(pageId, c.id)}
                      title="Remove competitor"
                    >
                      <Icon.x />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- CWS section ---------- */}
      <div className="section-head" style={{ marginTop: 34 }}>
        <span className="section-title">Chrome Web Store</span>
        <span style={{ color: "var(--muted-2)", fontSize: 12 }}>{cwsList.length}</span>
        <span className="section-line" />
      </div>

      <div className="section-toolbar">
        <span className="left">
          {cwsList.length} {cwsList.length === 1 ? "extension" : "extensions"}
          {selectedCws.size > 0 ? ` · ${selectedCws.size} selected` : ""}
        </span>
        <span className="spacer" />
        <button className="btn secondary sm" onClick={() => setShowAddCwsModal(true)}>
          <Icon.plus /> Add extension
        </button>
        <button
          className="btn primary sm"
          disabled={selectedCws.size === 0 || findRevState === "loading"}
          onClick={findRevenue}
        >
          {findRevState === "loading" && (
            <>
              <span className="spin" />
              Searching... ({findProgress[0]}/{findProgress[1]})
            </>
          )}
          {findRevState === "done" && (
            <>
              <Icon.check /> Done
            </>
          )}
          {findRevState === "idle" && (
            <>
              <Icon.sparkles /> Find revenue ({selectedCws.size} selected) <Icon.arrow />
            </>
          )}
        </button>
      </div>

      {cwsList.length === 0 ? (
        <div className="empty" style={{ padding: "30px 24px" }}>
          <p style={{ margin: 0 }}>
            No Chrome Web Store extensions logged here yet. Add one to start tracking
            installs and revenue.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <colgroup>
              <col style={{ width: 40 }} />
              <col />
              <col style={{ width: 90 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="cell-checkbox">
                  <Checkbox
                    checked={cwsAllChecked}
                    indeterminate={cwsSomeChecked}
                    onChange={toggleCwsAll}
                  />
                </th>
                <th>Extension</th>
                <th>Installs</th>
                <th>Rating</th>
                <th>Paid plan</th>
                <th>Revenue found</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cwsList.map((c) => {
                const isSel = selectedCws.has(c.id);
                const isOpen = expandedCws.has(c.id);
                const hasRev = !!c.revenueFound;
                return (
                  <Fragment key={c.id}>
                    <tr
                      className={`row ${isSel ? "selected" : ""}`}
                      onClick={() => hasRev && toggleCwsExpand(c.id)}
                    >
                      <td className="cell-checkbox">
                        <Checkbox checked={isSel} onChange={() => toggleCwsSel(c.id)} />
                      </td>
                      <td className="cell-name">
                        {hasRev && (
                          <span className={`chev ${isOpen ? "open" : ""}`}>
                            <Icon.chev />
                          </span>
                        )}
                        {!hasRev && <span style={{ display: "inline-block", width: 20 }} />}
                        <a
                          href={c.url || "#"}
                          className="name-text subtle-link"
                          style={{ color: "var(--ink)", fontWeight: 500 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                        </a>
                      </td>
                      <td className="cell-tabular cell-mono cell-muted">{c.installs}</td>
                      <td>
                        <span className="rating">
                          <span>{c.rating.toFixed(1)}</span>
                          <span className="star">
                            <Icon.star />
                          </span>
                        </span>
                      </td>
                      <td>
                        {c.paid ? (
                          <span className="badge yes">yes</span>
                        ) : (
                          <span className="badge no">no</span>
                        )}
                      </td>
                      <td className={hasRev ? "" : "cell-muted"}>
                        {hasRev ? (
                          <span>
                            <span
                              className="truncate"
                              style={{
                                maxWidth: 230,
                                display: "inline-block",
                                verticalAlign: "middle",
                              }}
                            >
                              {c.revenueFound!.length > 60
                                ? c.revenueFound!.slice(0, 60) + "…"
                                : c.revenueFound}
                            </span>
                            <span className="dot-found" title="Revenue found" />
                          </span>
                        ) : (
                          <span className="cell-num-empty">—</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <InlineEdit
                          value={c.notes}
                          onChange={(v) => store.updateCws(pageId, c.id, { notes: v })}
                          placeholder="Add note..."
                        />
                      </td>
                      <td>
                        <button
                          className="row-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCws(c.id);
                          }}
                        >
                          <Icon.x />
                        </button>
                      </td>
                    </tr>
                    {isOpen && hasRev && (
                      <tr className="expand-row">
                        <td colSpan={8}>
                          <div className="expand-revenue">
                            <div className="inset">{c.revenueFound}</div>
                            {c.sources && c.sources.length > 0 && (
                              <div className="src-list">
                                <span className="label">Sources</span>
                                {c.sources.map((s, i) => (
                                  <a
                                    key={i}
                                    href={s.url}
                                    className="src-link"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="num">
                                      {(i + 1).toString().padStart(2, "0")}
                                    </span>
                                    <span>{s.title}</span>
                                    <Icon.ext />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- SEO Keywords section ---------- */}
      <SeoKeywordsPanel pageId={pageId} />

      {showAddIdeaModal && (
        <AddIdeasModal
          allIdeas={store.ideas}
          excludeIds={new Set(page.ideas)}
          onClose={() => setShowAddIdeaModal(false)}
          onAdd={(ids) => {
            store.addIdeasToPage(page.id, ids);
            setShowAddIdeaModal(false);
          }}
        />
      )}

      {showAddCwsModal && (
        <AddCwsModal
          onClose={() => setShowAddCwsModal(false)}
          onAdd={(item) => {
            store.addCws(pageId, item);
            setShowAddCwsModal(false);
          }}
        />
      )}

      {showFindCompetitorsModal && (
        <FindCompetitorsModal
          pageId={pageId}
          ideaName={ideaNameForFind}
          topics={topicsForFind}
          onClose={() => setShowFindCompetitorsModal(false)}
          onAdd={(items) => {
            for (const item of items) {
              store.addCompetitor(pageId, item);
            }
            setShowFindCompetitorsModal(false);
          }}
        />
      )}

      {showAddCompetitorModal && (
        <AddCompetitorModal
          onClose={() => setShowAddCompetitorModal(false)}
          onAdd={(item) => {
            store.addCompetitor(pageId, item);
            setShowAddCompetitorModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Status dropdown with colored pill ---------- */
function StatusDropdown({
  value,
  onChange,
}: {
  value: Status;
  onChange: (id: string) => void;
}) {
  const trigger = (
    <span className="status-trigger">
      <StatusBadge status={value} />
      <Icon.caret />
    </span>
  );
  return (
    <Dropdown
      value={value}
      align="right"
      trigger={trigger}
      options={STATUSES.map((s) => ({
        id: s.id,
        label: s.label,
        render: () => <StatusBadge status={s.id} />,
      }))}
      onChange={onChange}
    />
  );
}

/* ---------- More menu ---------- */
function MoreMenu({ onDelete }: { onDelete: () => void }) {
  const trigger = (
    <button className="btn ghost icon" title="More">
      <Icon.dots />
    </button>
  );
  return (
    <Dropdown
      value=""
      align="right"
      trigger={trigger}
      options={[
        {
          id: "delete",
          label: "Delete page",
          render: () => <span style={{ color: "#B91C1C" }}>Delete page</span>,
        },
      ]}
      onChange={(id) => {
        if (id === "delete") onDelete();
      }}
    />
  );
}

/* ---------- Add ideas from DB modal ---------- */
function AddIdeasModal({
  allIdeas,
  excludeIds,
  onClose,
  onAdd,
}: {
  allIdeas: ParsedIdea[];
  excludeIds: Set<string>;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const candidates = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return allIdeas
      .filter((it) => !excludeIds.has(it.id))
      .filter(
        (it) =>
          !ql || it.name.toLowerCase().includes(ql) || it.topics.some((t) => t.includes(ql)),
      );
  }, [allIdeas, excludeIds, q]);

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-head">
        <h3>Add ideas from database</h3>
        <span className="spacer" />
        <button className="btn ghost icon" onClick={onClose}>
          <Icon.x />
        </button>
      </div>
      <div className="modal-body">
        <input
          className="input search"
          placeholder="Search by name or topic..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div style={{ height: 14 }} />
        {candidates.length === 0 ? (
          <div
            style={{
              padding: "24px 8px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 12.5,
            }}
          >
            No matching ideas.
          </div>
        ) : (
          <div className="modal-list">
            {candidates.map((it) => (
              <div
                key={it.id}
                className={`modal-list-item ${sel.has(it.id) ? "selected" : ""}`}
                onClick={() => toggle(it.id)}
              >
                <Checkbox checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
                <div className="name">{it.name}</div>
                <div className="topics">
                  {it.topics.slice(0, 2).map((t) => (
                    <Topic key={t} name={t} />
                  ))}
                </div>
                <div className={`rev ${it.revenue ? "has" : ""}`}>{it.revenue || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-foot">
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{sel.size} selected</span>
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={sel.size === 0} onClick={() => onAdd([...sel])}>
          Add {sel.size > 0 ? `(${sel.size})` : ""}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Add CWS modal ---------- */
function AddCwsModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Omit<CwsItem, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [installs, setInstalls] = useState("");
  const [rating, setRating] = useState("");
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState("");

  const canSave = name.trim().length > 0;

  function submit() {
    if (!canSave) return;
    onAdd({
      name: name.trim(),
      url,
      installs: installs || "—",
      rating: parseFloat(rating) || 0,
      paid,
      notes,
      revenueFound: null,
      sources: [],
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <h3>Add extension</h3>
        <span className="spacer" />
        <button className="btn ghost icon" onClick={onClose}>
          <Icon.x />
        </button>
      </div>
      <div className="modal-body">
        <div className="field-grid">
          <div>
            <label className="field-label">
              Extension name <span style={{ color: "#B91C1C" }}>*</span>
            </label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PromptBox"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Chrome Web Store URL</label>
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://chrome.google.com/webstore/..."
            />
          </div>
          <div className="row2">
            <div>
              <label className="field-label">Installs</label>
              <input
                className="input"
                value={installs}
                onChange={(e) => setInstalls(e.target.value)}
                placeholder="82,000"
              />
            </div>
            <div>
              <label className="field-label">Rating (0–5)</label>
              <input
                className="input"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="4.6"
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
            }}
          >
            <label className="field-label" style={{ margin: 0 }}>
              Has paid plan
            </label>
            <Toggle on={paid} onChange={setPaid} />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea
              className="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What stands out about this extension..."
            />
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!canSave} onClick={submit}>
          Add
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Find competitors modal (Tavily + OpenAI) ---------- */
type CompetitorDraft = Omit<Competitor, "id" | "ideaPageId">;

function FindCompetitorsModal({
  pageId,
  ideaName,
  topics,
  onClose,
  onAdd,
}: {
  pageId: string;
  ideaName: string;
  topics: TopicName[];
  onClose: () => void;
  onAdd: (items: CompetitorDraft[]) => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CompetitorDraft[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());

  const fetchCompetitors = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${pageId}/competitors/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaName, topics }),
      });
      const data: {
        error?: string;
        competitors?: Array<{
          name: string;
          productUrl: string | null;
          revenue: string | null;
          mau: string | null;
          sourceUrl: string | null;
          topics: string[];
          extension: string;
          complexity: string | null;
          notes?: string;
        }>;
      } = await res.json().catch(() => ({ competitors: [] }));

      if (!res.ok || data.error) {
        setError(data.error || `Request failed (${res.status})`);
        setState("error");
        return;
      }

      const items: CompetitorDraft[] = (data.competitors ?? []).map((c) => ({
        name: c.name,
        productUrl: c.productUrl,
        revenue: c.revenue,
        mau: c.mau,
        topics: (c.topics ?? []) as TopicName[],
        extension: (c.extension ?? "unknown") as CompetitorDraft["extension"],
        complexity: (c.complexity ?? null) as CompetitorDraft["complexity"],
        sourceUrl: c.sourceUrl,
        notes: c.notes ?? "",
      }));
      setCandidates(items);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setState("error");
    }
  }, [pageId, ideaName, topics]);

  useEffect(() => {
    fetchCompetitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(i: number) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  function submit() {
    const items = [...sel].map((i) => candidates[i]).filter(Boolean);
    if (items.length === 0) return;
    onAdd(items);
  }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-head">
        <h3>Find competitors</h3>
        <span className="spacer" />
        <button className="btn ghost icon" onClick={onClose}>
          <Icon.x />
        </button>
      </div>
      <div className="modal-body">
        {state === "loading" && (
          <div
            style={{
              padding: "32px 8px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <span className="spin" /> Searching the web…
          </div>
        )}
        {state === "error" && (
          <div
            style={{
              padding: "24px 8px",
              textAlign: "center",
              color: "#B91C1C",
              fontSize: 13,
            }}
          >
            {error || "Search failed."}
          </div>
        )}
        {state === "ready" && candidates.length === 0 && (
          <div
            style={{
              padding: "24px 8px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 12.5,
            }}
          >
            No competitor candidates found.
          </div>
        )}
        {state === "ready" && candidates.length > 0 && (
          <div className="modal-list">
            {candidates.map((c, i) => (
              <div
                key={i}
                className={`modal-list-item ${sel.has(i) ? "selected" : ""}`}
                onClick={() => toggle(i)}
              >
                <Checkbox checked={sel.has(i)} onChange={() => toggle(i)} />
                <div className="name">{c.name}</div>
                <div className={`rev ${c.revenue ? "has" : ""}`}>
                  {c.revenue || "—"}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted)",
                    maxWidth: 240,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.productUrl ?? c.sourceUrl ?? ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-foot">
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {sel.size} selected
        </span>
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={sel.size === 0}
          onClick={submit}
        >
          Add selected {sel.size > 0 ? `(${sel.size})` : ""}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Add competitor modal (manual entry) ---------- */
function AddCompetitorModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: CompetitorDraft) => void;
}) {
  const [name, setName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [revenue, setRevenue] = useState("");
  const [mau, setMau] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = name.trim().length > 0;

  function submit() {
    if (!canSave) return;
    onAdd({
      name: name.trim(),
      productUrl: productUrl.trim() || null,
      revenue: revenue.trim() || null,
      mau: mau.trim() || null,
      topics: [],
      extension: "unknown",
      complexity: null,
      sourceUrl: null,
      notes,
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <h3>Add competitor</h3>
        <span className="spacer" />
        <button className="btn ghost icon" onClick={onClose}>
          <Icon.x />
        </button>
      </div>
      <div className="modal-body">
        <div className="field-grid">
          <div>
            <label className="field-label">
              Name <span style={{ color: "#B91C1C" }}>*</span>
            </label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ToneShift"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Product URL</label>
            <input
              className="input"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="row2">
            <div>
              <label className="field-label">Revenue</label>
              <input
                className="input"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                placeholder="$5k/mo"
              />
            </div>
            <div>
              <label className="field-label">MAU</label>
              <input
                className="input"
                value={mau}
                onChange={(e) => setMau(e.target.value)}
                placeholder="8.4k"
              />
            </div>
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea
              className="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What stands out about this competitor..."
            />
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!canSave} onClick={submit}>
          Add
        </button>
      </div>
    </Modal>
  );
}
