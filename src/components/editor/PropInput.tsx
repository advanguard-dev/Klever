import { Chip, Select, Toggle } from "@/components/ui";
import { assetPathFor, pickFile } from "@/lib/assets";
import { ChromeIcon, PROP_ICONS } from "@/lib/chrome-icons";
import { cellValue, displayValue } from "@/lib/compute";
import { resolveLink } from "@/lib/parse";
import { useApp } from "@/store";
import type { Note, SchemaProp } from "@/types";

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
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const setView = useApp((s) => s.setView);
  const putBlob = useApp((s) => s.putBlob);
  const parent = note.parent ? notes.find((n) => n.id === note.parent) : undefined;
  const fieldSpec = spec ?? parent?.schema?.find((s) => s.key === field);
  const value = note.props[field];

  if (fieldSpec?.type === "formula" || fieldSpec?.type === "rollup" || type === "formula" || type === "rollup") {
    const shown = fieldSpec ? cellValue(note, fieldSpec, notes) : undefined;
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-mute">
        <ChromeIcon
          icon={PROP_ICONS[fieldSpec?.type === "rollup" || type === "rollup" ? "rollup" : "formula"]}
        />
        {displayValue(shown)}
      </span>
    );
  }

  const setVal = (v: unknown) => patchNote(note.id, { props: { ...note.props, [field]: v } });

  if (type === "checkbox") {
    return <Toggle checked={Boolean(value)} onChange={(on) => setVal(on)} label={value ? "On" : "Off"} />;
  }
  if (type === "select") {
    const current = String(value ?? "");
    return (
      <div className="flex flex-wrap gap-1.5">
        {(options ?? []).map((o) => {
          const on = current === o;
          return (
            <Chip key={o} selected={on} onClick={() => setVal(on ? undefined : o)} className="font-mono">
              {o}
            </Chip>
          );
        })}
        {!options?.length && (
          <input
            value={current}
            onChange={(e) => setVal(e.target.value || undefined)}
            className="bg-transparent py-1 text-sm focus-visible:outline-none"
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
          return (
            <Chip
              key={o}
              selected={on}
              className="font-mono"
              onClick={() => setVal(on ? selected.filter((x) => x !== o) : [...selected, o])}
            >
              {o}
            </Chip>
          );
        })}
        {type === "tags" && (
          <input
            placeholder="tag"
            className="w-20 bg-transparent font-mono text-[11px] focus-visible:outline-none"
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
        className="bg-transparent py-1 font-mono text-sm focus-visible:outline-none"
      />
    );
  }
  if (type === "number") {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => setVal(e.target.value === "" ? undefined : Number(e.target.value))}
        className="bg-transparent py-1 font-mono text-sm focus-visible:outline-none"
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
    return (
      <div className="flex flex-wrap items-center gap-2">
        {paths.map((p) => (
          <span key={p} className="font-mono text-[11px] text-mute">
            {p.split("/").pop()}
            <button
              type="button"
              className="ml-1 text-faint hover:text-ink"
              onClick={() => setVal(paths.filter((x) => x !== p))}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          className="font-serif text-[11px] text-mute hover:text-ink"
          onClick={() => {
            void pickFile("*/*").then(async (file) => {
              if (!file) return;
              const path = assetPathFor(file);
              await putBlob(file, path, file.type);
              setVal([...paths, path]);
            });
          }}
        >
          + file
        </button>
      </div>
    );
  }
  return (
    <input
      value={String(value ?? "")}
      onChange={(e) => setVal(e.target.value)}
      className="bg-transparent py-1 text-sm focus-visible:outline-none"
    />
  );
}
