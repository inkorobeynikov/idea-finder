"use client";

import {
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "./icons";
import {
  Complexity,
  Extension,
  IdeaSource,
  Status,
  Topic as TopicName,
  formatShortDate,
} from "@/lib/data";

/* ---------- Topic pill ---------- */
export function Topic({ name }: { name: TopicName }) {
  return <span className={`topic ${name}`}>{name}</span>;
}

/* ---------- Status badge ---------- */
const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  researching: "Researching",
  in_work: "In work",
  rejected: "Rejected",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <span className="dot" style={{ background: "currentColor", opacity: 0.8 }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/* ---------- Extension badge ---------- */
export function ExtBadge({ value }: { value: Extension }) {
  if (!value || value === "unknown") return <span className="badge unknown">?</span>;
  return <span className={`badge ${value}`}>{value}</span>;
}

/* ---------- Complexity ---------- */
export function ComplexityCell({ value }: { value: Complexity }) {
  const map: Record<Complexity, number> = { simple: 1, medium: 2, complex: 3 };
  const n = map[value] || 0;
  return (
    <span className="cell-complexity">
      <span className="bars">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`bar ${i < n ? "on" : ""}`} />
        ))}
      </span>
      {value}
    </span>
  );
}

/* ---------- Source ---------- */
export function SourceCell({ source }: { source: IdeaSource | null }) {
  if (!source) return <span className="cell-num-empty">—</span>;
  const map: Record<string, { c: string; label: string }> = {
    reddit: { c: "reddit", label: "r/" },
    ih: { c: "ih", label: "IH" },
    pd: { c: "pd", label: "PD" },
    hn: { c: "hn", label: "Y" },
  };
  const m = map[source.platform] || { c: "", label: "?" };
  return (
    <a
      href={source.url || "#"}
      className="cell-source"
      onClick={(e) => e.stopPropagation()}
      target="_blank"
      rel="noreferrer"
    >
      <span className={`source-icon ${m.c}`}>{m.label}</span>
      <Icon.ext />
    </a>
  );
}

export function RevenueCell({ value }: { value: string | null }) {
  if (!value) return <span className="cell-num-empty">—</span>;
  return <span className="cell-num-pos">{value}</span>;
}

export function MauCell({ value }: { value: string | null }) {
  if (!value) return <span className="cell-num-empty">—</span>;
  return <span className="cell-mono cell-muted">{value}</span>;
}

export function DateCell({ value }: { value: string | null }) {
  if (!value) return <span className="cell-num-empty">—</span>;
  return <span className="cell-date">{formatShortDate(value)}</span>;
}

/* ---------- Checkbox ---------- */
export function Checkbox({
  checked,
  onChange,
  indeterminate,
  onClick,
  ariaLabel,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={`cb ${indeterminate ? "indeterminate" : ""}`}
      checked={!!checked}
      onChange={(e) => onChange?.(e.target.checked)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      aria-label={ariaLabel || "Select row"}
    />
  );
}

/* ---------- Topics inline cell ---------- */
export function TopicsCell({ topics, max = 2 }: { topics: TopicName[]; max?: number }) {
  if (!topics || !topics.length) return <span className="cell-num-empty">—</span>;
  const visible = topics.slice(0, max);
  const extra = topics.length - max;
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {visible.map((t) => (
        <Topic key={t} name={t} />
      ))}
      {extra > 0 && <span className="topic more">+{extra}</span>}
    </span>
  );
}

/* ---------- Dropdown ---------- */
export interface DropdownOption {
  id: string;
  label: string;
  render?: () => ReactNode;
}

export function Dropdown({
  label,
  value,
  options,
  onChange,
  align = "left",
  trigger,
}: {
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (id: string) => void;
  align?: "left" | "right";
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = options.find((o) => o.id === value);

  return (
    <div className="dd" ref={ref}>
      {trigger ? (
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      ) : (
        <button type="button" className="dd-trigger" onClick={() => setOpen((o) => !o)}>
          {label && <span className="dd-label">{label}:</span>}
          <span>{selected ? selected.label : "All"}</span>
          <Icon.caret />
        </button>
      )}
      {open && (
        <div className={`dd-menu ${align === "right" ? "right" : ""}`}>
          {options.map((opt) => (
            <div
              key={opt.id}
              className="dd-item"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              <span className="check">{opt.id === value && <Icon.check />}</span>
              {opt.render ? opt.render() : opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({
  children,
  onClose,
  size,
}: {
  children: ReactNode;
  onClose?: () => void;
  size?: "lg";
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal ${size === "lg" ? "lg" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------- Sort header ---------- */
export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export function SortHeader({
  id,
  label,
  sort,
  onSort,
  align = "left",
  width,
}: {
  id: string;
  label: string;
  sort: SortState;
  onSort: (id: string) => void;
  align?: "left" | "right";
  width?: number;
}) {
  const active = sort.key === id;
  const dir = active ? sort.dir : null;
  const style: React.CSSProperties = { width };
  if (align === "right") style.textAlign = "right";
  return (
    <th className="sortable" style={style} onClick={() => onSort(id)}>
      {label}
      {active ? (
        <span className="sort-arrow">{dir === "asc" ? "↑" : "↓"}</span>
      ) : (
        <span className="sort-arrow dim">↑</span>
      )}
    </th>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label?: string;
}) {
  return (
    <label className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span style={{ fontSize: 13 }}>{label}</span>}
    </label>
  );
}

/* ---------- Inline edit (table cell) ---------- */
export function InlineEdit({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  // Uncontrolled: commit on blur. `key` remounts the field when the external
  // value changes so it stays in sync without a state-syncing effect.
  return (
    <input
      key={value}
      className={`inline-edit ${!value ? "placeholder" : ""}`}
      defaultValue={value || ""}
      placeholder={placeholder}
      onBlur={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
