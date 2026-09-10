import { cellValue, displayValue } from "@/lib/compute";
import { asChipValues, effectivePropType, itemColorId, propChipStyle } from "@/lib/prop-schema";
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

  const resolved = effectivePropType(spec);
  if (resolved === "people" || resolved === "location") {
    const items = asChipValues(value);
    if (!items.length) return <span className="text-faint">—</span>;
    return (
      <span className="inline-flex flex-wrap gap-1">
        {items.map((item) => {
          const hit = resolved === "people" ? resolveLink(item, notes) : undefined;
          return hit ? (
            <button
              key={item}
              type="button"
              className="rounded-md border border-prop/28 bg-prop/[0.08] px-1.5 py-0.5 text-prop hover:underline"
              style={propChipStyle(itemColorId(spec.itemColors, item))}
              onClick={(e) => {
                stop(e);
                setView({ kind: "note", id: hit.id });
              }}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              className="rounded-md border border-prop/28 bg-prop/[0.08] px-1.5 py-0.5 text-prop"
              style={propChipStyle(itemColorId(spec.itemColors, item))}
            >
              {item}
            </span>
          );
        })}
      </span>
    );
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

  if (spec.type === "select" || spec.type === "multi_select" || spec.type === "tags") {
    const items = asChipValues(value);
    if (!items.length) return <span className="text-faint">—</span>;
    return (
      <span className="inline-flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-md border border-prop/28 bg-prop/[0.08] px-1.5 py-0.5 font-mono text-[11px] text-prop"
            style={propChipStyle(itemColorId(spec.itemColors, item))}
          >
            {spec.type === "tags" && !item.startsWith("#") ? `#${item}` : item}
          </span>
        ))}
      </span>
    );
  }

  return <span>{displayValue(value)}</span>;
}
