"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { STATUSES, formatRelDate } from "@/lib/data";
import { Icon } from "@/components/icons";
import { Dropdown, DropdownOption, StatusBadge } from "@/components/ui";

export default function MyIdeasPage() {
  const router = useRouter();
  const { pages, ideasById, createPage, cwsCount } = useStore();
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return pages;
    return pages.filter((p) => p.status === filter);
  }, [pages, filter]);

  const statusOptions: DropdownOption[] = [
    { id: "all", label: "All statuses" },
    ...STATUSES,
  ];

  async function handleCreateEmpty() {
    const id = await createPage([]);
    router.push(`/ideas/${id}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Ideas</h1>
        <span className="spacer" />
        <Dropdown
          label="Status"
          value={filter}
          options={statusOptions}
          onChange={setFilter}
        />
        <span style={{ width: 8 }} />
        <button className="btn secondary" onClick={handleCreateEmpty}>
          <Icon.plus /> New page
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="illust">
            <Icon.sparkles />
          </div>
          <h4>No pages here yet</h4>
          <p>
            Select ideas from the database and click &quot;Create idea page&quot; to start
            grouping them.
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((p) => {
            const previewIdeas = p.ideas
              .slice(0, 2)
              .map((id) => ideasById[id])
              .filter(Boolean);
            const count = cwsCount(p);
            return (
              <Link key={p.id} href={`/ideas/${p.id}`} className="idea-card">
                <div className="row">
                  <StatusBadge status={p.status} />
                  <span className="spacer" />
                  <span className="date">{formatRelDate(p.createdAt)}</span>
                </div>
                <div className="title-line">
                  <div className="title">{p.title || "Untitled idea page"}</div>
                </div>
                <div className="meta">
                  {p.ideas.length} {p.ideas.length === 1 ? "idea" : "ideas"} · {count} CWS{" "}
                  {count === 1 ? "item" : "items"}
                </div>
                {previewIdeas.length > 0 && (
                  <div className="preview">
                    {previewIdeas.map((it) => (
                      <div className="preview-item" key={it.id}>
                        <span className="preview-bullet" />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {it.name}
                        </span>
                      </div>
                    ))}
                    {p.ideas.length > previewIdeas.length && (
                      <div className="preview-item" style={{ color: "var(--muted-2)" }}>
                        <span className="preview-bullet" />
                        <span>+{p.ideas.length - previewIdeas.length} more</span>
                      </div>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
