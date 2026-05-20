"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  EXT_OPTIONS,
  PLATFORMS,
  parseMoney,
  parseUsers,
} from "@/lib/data";
import { Icon } from "@/components/icons";
import { EnrichPanel } from "@/components/EnrichPanel";
import {
  Checkbox,
  ComplexityCell,
  DateCell,
  Dropdown,
  DropdownOption,
  ExtBadge,
  MauCell,
  RevenueCell,
  SortHeader,
  SortState,
  SourceCell,
  TopicsCell,
} from "@/components/ui";

export default function AllIdeasPage() {
  const router = useRouter();
  const { ideas, ideasById, createPage } = useStore();

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [ext, setExt] = useState("all");
  const [enriched, setEnriched] = useState("all");
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleSort(key: string) {
    setSort((s) => {
      if (s.key === key) return { key, dir: s.dir === "asc" ? "desc" : "asc" };
      const numeric = ["revenue", "mau", "date"].includes(key);
      return { key, dir: numeric ? "desc" : "asc" };
    });
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleExpand(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((it) => {
      if (
        q &&
        !(it.name.toLowerCase().includes(q) || it.topics.some((t) => t.includes(q)))
      )
        return false;
      if (platform !== "all" && it.source?.platform !== platform) return false;
      if (ext !== "all" && it.extension !== ext) return false;
      if (enriched === "yes" && !it.researchedAt) return false;
      if (enriched === "no" && it.researchedAt) return false;
      return true;
    });
  }, [ideas, search, platform, ext, enriched]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (key) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "revenue":
          av = parseMoney(a.revenue);
          bv = parseMoney(b.revenue);
          break;
        case "mau":
          av = parseUsers(a.mau);
          bv = parseUsers(b.mau);
          break;
        case "ext":
          av = a.extension || "z";
          bv = b.extension || "z";
          break;
        case "complexity": {
          const map: Record<string, number> = { simple: 1, medium: 2, complex: 3 };
          av = map[a.complexity] || 0;
          bv = map[b.complexity] || 0;
          break;
        }
        case "date":
          av = new Date(a.date).getTime();
          bv = new Date(b.date).getTime();
          break;
        case "topics":
          av = a.topics[0] || "z";
          bv = b.topics[0] || "z";
          break;
        case "source":
          av = a.source?.platform || "z";
          bv = b.source?.platform || "z";
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const allChecked = sorted.length > 0 && sorted.every((r) => selected.has(r.id));
  const someChecked = sorted.some((r) => selected.has(r.id)) && !allChecked;

  function toggleAll() {
    if (allChecked) {
      setSelected((s) => {
        const n = new Set(s);
        sorted.forEach((r) => n.delete(r.id));
        return n;
      });
    } else {
      setSelected((s) => {
        const n = new Set(s);
        sorted.forEach((r) => n.add(r.id));
        return n;
      });
    }
  }

  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    // One page per selected idea, titled after the idea so they're
    // distinguishable in the list we redirect to.
    try {
      await Promise.all(
        [...selected].map((ideaId) =>
          createPage([ideaId], ideasById[ideaId]?.name ?? ""),
        ),
      );
      setSelected(new Set());
      router.push("/ideas");
    } finally {
      setCreating(false);
    }
  }

  const platformOptions: DropdownOption[] = [{ id: "all", label: "All" }, ...PLATFORMS];
  const extOptions: DropdownOption[] = [{ id: "all", label: "All" }, ...EXT_OPTIONS];
  const enrichedOptions: DropdownOption[] = [
    { id: "all", label: "All" },
    { id: "yes", label: "Enriched" },
    { id: "no", label: "Not enriched" },
  ];

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search-wrap">
          <input
            className="input search"
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="spacer" />
        <Dropdown
          label="Platform"
          value={platform}
          options={platformOptions}
          onChange={setPlatform}
        />
        <Dropdown label="Extension" value={ext} options={extOptions} onChange={setExt} />
        <Dropdown
          label="Enriched"
          value={enriched}
          options={enrichedOptions}
          onChange={setEnriched}
        />
      </div>

      <div className="actionbar">
        <span className="count">
          {sorted.length} {sorted.length === 1 ? "idea" : "ideas"}
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </span>
        <span className="spacer" />
        {selected.size > 0 && (
          <div className="selected-tools">
            <button className="btn ghost sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <button className="btn primary sm" onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <span className="spin" /> Creating…
                </>
              ) : (
                <>
                  Create idea page ({selected.size} selected) <Icon.arrow />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <div className="illust">
            <Icon.search />
          </div>
          <h4>No ideas match</h4>
          <p>Try clearing the filters, or run the parsing agent to bring in more.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <colgroup>
              <col style={{ width: 40 }} />
              <col />
              <col style={{ width: 170 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 115 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="cell-checkbox">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    onChange={toggleAll}
                    ariaLabel="Select all"
                  />
                </th>
                <SortHeader id="name" label="Name" sort={sort} onSort={toggleSort} />
                <SortHeader id="topics" label="Topics" sort={sort} onSort={toggleSort} />
                <SortHeader id="revenue" label="Revenue" sort={sort} onSort={toggleSort} />
                <SortHeader id="mau" label="MAU" sort={sort} onSort={toggleSort} />
                <SortHeader id="source" label="Source" sort={sort} onSort={toggleSort} />
                <SortHeader id="ext" label="Extension?" sort={sort} onSort={toggleSort} />
                <SortHeader
                  id="complexity"
                  label="Complexity"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortHeader id="date" label="Date" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const isSel = selected.has(row.id);
                const isOpen = expanded.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`row ${isSel ? "selected" : ""}`}
                      onClick={() => toggleExpand(row.id)}
                    >
                      <td className="cell-checkbox">
                        <Checkbox checked={isSel} onChange={() => toggleSelect(row.id)} />
                      </td>
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
                        <ExtBadge value={row.extension} />
                      </td>
                      <td>
                        <ComplexityCell value={row.complexity} />
                      </td>
                      <td>
                        <DateCell value={row.date} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="expand-row">
                        <td colSpan={9} onClick={(e) => e.stopPropagation()}>
                          <EnrichPanel idea={row} />
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
    </div>
  );
}
