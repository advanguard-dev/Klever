import { cellValue, displayValue } from "@/lib/compute";
import { normalizePropUrl } from "@/lib/prop-url";
import { resolveLink } from "@/lib/parse";
import { useApp } from "@/store";
import type { Note, SchemaProp } from "@/types";
import { ExternalLink } from "lucide-react";

/** Read-only property value — links and relations are interactive. */
export function PropValue({
  note,
  spec,
  onLinkClick,
}: {
  note: Note;
  spec: SchemaProp;
  onLinkClick?: (e: React.MouseEvent) => void;
}) {
  const notes = useApp((s) => s.notes);
  const setView = useApp((s) => s.setView);
  const value = cellValue(note, spec, notes);
  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLinkClick?.(e);
  };

  if (value === undefined || value === null || value === "") {
    return <span className="text-faint">—</span>;
  }

  if (spec.type === "relation") {
    const ids = Array.isArray(value) ? value.map(String) : [String(value)];
    return (
      <span className="inline-flex flex-wrap gap-1">
        {ids.map((id) => {
          const hit = resolveLink(id, notes);
          return (
            <button
              key={id}
              type="button"
              className="rounded-full bg-paper-2 px-1.5 py-0.5 text-ink hover:bg-paper"
              onClick={(e) => {
                stop(e);
                if (hit) setView({ kind: "note", id: hit.id });
              }}
            >
              {hit?.title ?? id}
            </button>
          );
        })}
      </span>
    );
  }

  if (spec.type === "url") {
    const raw = String(value);
    const href = normalizePropUrl(raw);
    if (!href) return <span>{raw}</span>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-smart underline-offset-2 hover:underline"
        onClick={stop}
      >
        {raw}
        <ExternalLink size={10} strokeWidth={1.6} className="shrink-0 opacity-70" />
      </a>
    );
  }

  if (spec.type === "text") {
    const raw = String(value);
    const href = normalizePropUrl(raw);
    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-smart underline-offset-2 hover:underline"
          onClick={stop}
        >
          {raw}
        </a>
      );
    }
  }

  if (spec.type === "checkbox") {
    return <span>{value ? "Yes" : "No"}</span>;
  }

  return <span>{displayValue(value)}</span>;
}
