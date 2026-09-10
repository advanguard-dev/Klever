import { useContextMenu } from "@/components/ContextMenu";
import { Chip, Select, Toggle } from "@/components/ui";
import { ChromeIcon, PROP_ICONS } from "@/lib/chrome-icons";
import { cellValue, displayValue } from "@/lib/compute";
import { resolveAssetSrc } from "@/lib/assets";
import { cn } from "@/lib/cn";
import { propValueMenuItems } from "@/lib/context-menus";
import {
  asChipValues,
  effectivePropType,
  itemColorId,
  nextItemSwatch,
  propChipStyle,
  schemaTarget,
  schemaWithItemColor,
  setItemColor,
} from "@/lib/prop-schema";
import { normalizePropUrl } from "@/lib/prop-url";
import { resolveLink } from "@/lib/parse";
import { useApp } from "@/store";
import type { Note, SchemaProp } from "@/types";
import { ExternalLink } from "lucide-react";
import { useState, type MouseEvent } from "react";

export function PropInput({
  note,
  field,
  type,
  options,
  relationTo,
  spec,
}: {
  note: Note;
  field: string;
  type: string;
  options?: string[];
  relationTo?: string;
  spec?: SchemaProp;
}) {
  const { open } = useContextMenu();
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const setView = useApp((s) => s.setView);
  const linkLocalFile = useApp((s) => s.linkLocalFile);
  const parent = note.parent ? notes.find((n) => n.id === note.parent) : undefined;
  const fieldSpec =
    spec ?? parent?.schema?.find((s) => s.key === field) ?? note.schema?.find((s) => s.key === field);
  const value = note.props[field];

  if (fieldSpec?.type === "formula" || fieldSpec?.type === "rollup" || type === "formula" || type === "rollup") {
    const shown = fieldSpec ? cellValue(note, fieldSpec, notes) : undefined;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-smart/[0.08] px-1.5 py-0.5 font-mono text-[11px] text-smart">
        <ChromeIcon
          icon={PROP_ICONS[fieldSpec?.type === "rollup" || type === "rollup" ? "rollup" : "formula"]}
          className="shrink-0 text-smart/80"
        />
        {displayValue(shown)}
      </span>
    );
  }

  const setVal = (v: unknown) => patchNote(note.id, { props: { ...note.props, [field]: v } });
  const setItemHue = (item: string, color?: string) => {
    const target = schemaTarget(note, notes);
    const schema = target.schema ?? [];
    if (!schema.some((s) => s.key === field)) return;
    patchNote(target.id, { schema: schemaWithItemColor(schema, field, item, color) });
  };
  const valueMenu = (item: string) => (e: MouseEvent) => open(e, propValueMenuItems(note, field, item));
  const resolved = fieldSpec ? effectivePropType(fieldSpec) : type;

  if (resolved === "people" || resolved === "location") {
    return (
      <ChipListInput
        values={asChipValues(value)}
        onChange={(next) => setVal(next.length ? next : undefined)}
        placeholder={resolved === "people" ? "Add name or email" : "Add place"}
        ariaLabel={resolved === "people" ? "Add person" : "Add location"}
        notes={resolved === "people" ? notes : undefined}
        onOpenNote={(id) => setView({ kind: "note", id })}
        itemColors={fieldSpec?.itemColors}
        onItemColor={setItemHue}
        onItemMenu={valueMenu}
      />
    );
  }

  if (type === "checkbox") {
    return <Toggle checked={Boolean(value)} onChange={(on) => setVal(on)} label={value ? "On" : "Off"} />;
  }
  if (type === "select") {
    const current = String(value ?? "");
    return (
      <div className="flex flex-wrap gap-1.5">
        {(options ?? []).map((o) => {
          const on = current === o;
          const hue = itemColorId(fieldSpec?.itemColors, o);
          return (
            <Chip
              key={o}
              selected={on}
              tone="prop"
              onClick={() => setVal(on ? undefined : o)}
              onContextMenu={valueMenu(o)}
              className="font-mono"
              style={propChipStyle(hue)}
            >
              {o}
            </Chip>
          );
        })}
        {!options?.length && (
          <input
            value={current}
            onChange={(e) => setVal(e.target.value || undefined)}
            className="bg-transparent py-1 text-sm klever-focus rounded-sm"
          />
        )}
      </div>
    );
  }
  if (type === "multi_select" || type === "tags") {
    const selected = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
    const pool = options ?? [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {pool.map((o) => {
          const on = selected.includes(o);
          const hue = itemColorId(fieldSpec?.itemColors, o);
          return (
            <Chip
              key={o}
              selected={on}
              tone={type === "tags" ? "tag" : "prop"}
              className="font-mono"
              style={propChipStyle(hue)}
              onClick={() => setVal(on ? selected.filter((x) => x !== o) : [...selected, o])}
              onContextMenu={valueMenu(o)}
            >
              {o}
            </Chip>
          );
        })}
        {type === "tags" && (
          <input
            placeholder="Add tag"
            className="w-20 bg-transparent font-mono text-[11px] klever-focus rounded-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = e.currentTarget.value.trim();
                if (v && !selected.includes(v)) setVal([...selected, v]);
                e.currentTarget.value = "";
              }
            }}
          />
        )}
      </div>
    );
  }
  if (type === "date") {
    return (
      <input
        type="date"
        value={String(value ?? "").slice(0, 10)}
        onChange={(e) => setVal(e.target.value)}
        className="bg-transparent py-1 font-mono text-sm klever-focus rounded-sm"
      />
    );
  }
  if (type === "number") {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => setVal(e.target.value === "" ? undefined : Number(e.target.value))}
        className="bg-transparent py-1 font-mono text-sm klever-focus rounded-sm"
      />
    );
  }
  if (type === "relation") {
    const ids = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
    const pool = notes.filter(
      (n) => n.id !== note.id && n.type === "page" && (!relationTo || n.parent === relationTo),
    );
    return (
      <div className="flex flex-wrap items-center gap-2">
        {ids.map((id) => {
          const hit = resolveLink(id, notes);
          return (
            <button
              key={id}
              type="button"
              className="rounded-full bg-paper-2 px-2.5 py-0.5 font-mono text-[11px] text-mute hover:text-ink"
              onClick={() => hit && setView({ kind: "note", id: hit.id })}
            >
              {hit?.title ?? id}
            </button>
          );
        })}
        <Select
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v && !ids.includes(v)) setVal([...ids, v]);
          }}
          className="min-w-[8rem]"
        >
          <option value="">link…</option>
          {pool.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </Select>
      </div>
    );
  }
  if (type === "files") {
    const paths = Array.isArray(value) ? value.map(String) : [];
    const fileBlobs = useApp.getState().blobs;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {paths.map((p) => {
          const href = resolveAssetSrc(p, fileBlobs);
          const openable = href && (href.startsWith("http") || href.startsWith("blob:") || href.startsWith("file:"));
          return (
            <span key={p} className="inline-flex items-center gap-1 font-mono text-[11px] text-mute">
              {openable ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-smart hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.split("/").pop()}
                </a>
              ) : (
                p.split("/").pop()
              )}
              <button
                type="button"
                className="text-faint hover:text-ink"
                onClick={() => setVal(paths.filter((x) => x !== p))}
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="text-[11px] font-medium text-mute hover:text-ink"
          onClick={() => {
            void linkLocalFile("*/*").then((path) => {
              if (!path) return;
              setVal([...paths, path]);
            });
          }}
        >
          + file
        </button>
      </div>
    );
  }
  if (type === "url") {
    const raw = String(value ?? "");
    const href = normalizePropUrl(raw);
    return (
      <div className="flex min-w-0 items-center gap-2">
        <input
          value={raw}
          placeholder="https://…"
          onChange={(e) => setVal(e.target.value || undefined)}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm klever-focus rounded-sm"
        />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Open link"
            className="shrink-0 text-smart hover:text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} strokeWidth={1.5} />
          </a>
        ) : null}
      </div>
    );
  }
  if (type === "text") {
    const raw = String(value ?? "");
    const href = normalizePropUrl(raw);
    if (href && raw.trim()) {
      return (
        <div className="flex min-w-0 items-center gap-2">
          <input
            value={raw}
            onChange={(e) => setVal(e.target.value || undefined)}
            className="min-w-0 flex-1 bg-transparent py-1 text-sm klever-focus rounded-sm"
          />
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Open link"
            className="shrink-0 text-smart hover:text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} strokeWidth={1.5} />
          </a>
        </div>
      );
    }
  }
  return (
    <input
      value={String(value ?? "")}
      onChange={(e) => setVal(e.target.value)}
      className="bg-transparent py-1 text-sm klever-focus rounded-sm"
    />
  );
}

function ChipListInput({
  values,
  onChange,
  placeholder,
  ariaLabel,
  notes,
  onOpenNote,
  itemColors,
  onItemColor,
  onItemMenu,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  ariaLabel: string;
  notes?: Note[];
  onOpenNote?: (id: string) => void;
  itemColors?: Record<string, string>;
  onItemColor?: (item: string, color?: string) => void;
  onItemMenu?: (item: string) => (e: MouseEvent) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const added = asChipValues(raw);
    if (!added.length) {
      setDraft("");
      return;
    }
    const next = [...values];
    let colors = itemColors;
    for (const item of added) {
      if (!next.some((x) => x.toLowerCase() === item.toLowerCase())) {
        next.push(item);
        if (!itemColorId(colors, item)) {
          const hue = nextItemSwatch(colors);
          colors = setItemColor(colors, item, hue);
          onItemColor?.(item, hue);
        }
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {values.map((item) => {
        const hit = notes?.length ? resolveLink(item, notes) : undefined;
        const mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item) ? `mailto:${item}` : undefined;
        return (
          <span
            key={item}
            className="inline-flex max-w-full items-center rounded-md border border-prop/28 bg-prop/[0.08] text-prop"
            style={propChipStyle(itemColorId(itemColors, item))}
            onContextMenu={onItemMenu?.(item)}
          >
            {hit ? (
              <button
                type="button"
                title={hit.title}
                className="klever-focus max-w-[12rem] truncate px-2.5 py-0.5 text-xs font-medium hover:underline"
                onClick={() => onOpenNote?.(hit.id)}
              >
                {item}
              </button>
            ) : mail ? (
              <a
                href={mail}
                className="klever-focus max-w-[12rem] truncate px-2.5 py-0.5 text-xs font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {item}
              </a>
            ) : (
              <span className="max-w-[12rem] truncate px-2.5 py-0.5 text-xs font-medium">{item}</span>
            )}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              className={cn("klever-focus px-1.5 py-0.5 text-[11px] text-prop/60 hover:text-prop")}
              onClick={() => onChange(values.filter((x) => x !== item))}
            >
              ×
            </button>
          </span>
        );
      })}
      <input
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        size={Math.max(placeholder.length, draft.length + 1)}
        className="h-7 min-w-[7rem] rounded-md bg-transparent px-1.5 py-0 text-xs leading-7 text-ink placeholder:text-faint klever-focus"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length) {
            e.preventDefault();
            onChange(values.slice(0, -1));
          } else if (e.key === "Escape") {
            setDraft("");
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
