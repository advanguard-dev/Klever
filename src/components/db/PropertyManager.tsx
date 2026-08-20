import { ConfirmDialog, GhostButton, IconButton, MonoLabel, Overlay, Panel, Select, SolidButton, TextButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ChromeIcon, PROP_ICONS, accentIconClass } from "@/lib/chrome-icons";
import { nid } from "@/lib/ids";
import { useApp } from "@/store";
import type { Note, PropType, RollupAgg, SchemaProp } from "@/types";
import { PROP_TYPES, ROLLUP_AGGS } from "@/types";
import { ChevronDown, Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PROP_TYPE_LABEL: Record<PropType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
  relation: "Relation",
  tags: "Tags",
  files: "Files",
  formula: "Formula",
  rollup: "Rollup",
};

const PROP_TYPE_GROUPS: { label: string; types: PropType[] }[] = [
  {
    label: "Value",
    types: ["text", "number", "select", "multi_select", "date", "checkbox", "url", "tags", "files"],
  },
  { label: "Link", types: ["relation"] },
  { label: "Compute", types: ["formula", "rollup"] },
];

const ROLLUP_AGG_LABEL: Record<RollupAgg, string> = {
  count: "Count",
  count_unique: "Unique",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  show: "Show",
  show_unique: "Unique values",
  checked: "Checked",
  percent_checked: "% checked",
  earliest: "Earliest",
  latest: "Latest",
};

export function schemaTarget(note: Note, notes: Note[]) {
  if (note.type === "database") return note;
  if (note.parent) return notes.find((n) => n.id === note.parent) ?? note;
  return note;
}

export function PropertyManager({ note, onClose }: { note: Note; onClose: () => void }) {
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const target = schemaTarget(note, notes);
  const schema = target.schema ?? [];
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const dbs = notes.filter((n) => n.type === "database" && n.id !== target.id);
  const shared = target.id !== note.id || note.type === "database";

  const setSchema = (next: SchemaProp[]) => patchNote(target.id, { schema: next });

  const add = () => {
    const key = `prop_${nid(4)}`;
    const prop: SchemaProp = { key, name: "Property", type: "text" };
    setSchema([...schema, prop]);
    setOpenKey(null);
    setFocusKey(key);
  };

  const update = (key: string, patch: Partial<SchemaProp>) => {
    setSchema(schema.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const setType = (p: SchemaProp, type: PropType) => {
    const rel = schema.find((x) => x.type === "relation");
    update(p.key, {
      type,
      options:
        type === "select" || type === "multi_select" ? p.options ?? ["Inbox", "Active", "Done"] : undefined,
      formula:
        type === "formula"
          ? p.formula ?? 'if(prop("Status") == "Harvest", "Shipped", prop("Status"))'
          : undefined,
      rollup:
        type === "rollup"
          ? p.rollup ?? {
              relation: rel?.key ?? "related",
              property: "title",
              agg: "count",
            }
          : undefined,
      default: type === "formula" || type === "rollup" ? undefined : p.default,
    });
  };

  const moveTo = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const i = schema.findIndex((p) => p.key === fromKey);
    const j = schema.findIndex((p) => p.key === toKey);
    if (i < 0 || j < 0) return;
    const next = [...schema];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    setSchema(next);
  };

  useEffect(() => {
    if (!focusKey) return;
    const el = document.getElementById(`prop-name-${focusKey}`) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    el.select();
    setFocusKey(null);
  }, [focusKey, schema]);

  const caption = shared
    ? note.type === "database"
      ? "Every row in this database"
      : `Every row in ${target.title}`
    : "Only on this page";

  return (
    <>
      {!pendingDelete && (
        <Overlay onClose={onClose}>
          <Panel className="flex max-h-[min(80vh,42rem)] flex-col overflow-hidden p-0">
            <header className="shrink-0 border-b border-line px-5 py-4">
              <h2 className="font-serif text-xl tracking-tight text-ink">Properties</h2>
              <p className="mt-1 truncate font-mono text-[11px] text-mute">
                {schema.length} {schema.length === 1 ? "property" : "properties"} · {caption}
              </p>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {schema.length === 0 ? (
                <div className="px-2 py-10 text-center">
                  <p className="font-serif text-sm text-mute">No properties yet.</p>
                  <p className="mt-1 text-sm text-faint">Add one to track status, dates, or links.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {schema.map((p) => {
                    const open = openKey === p.key;
                    const extras = typeNeedsExtras(p.type);
                    return (
                      <li
                        key={p.key}
                        onDragOver={(e) => {
                          if (!dragging) return;
                          e.preventDefault();
                          setOverKey(p.key);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = e.dataTransfer.getData("text/plain") || dragging;
                          if (from) moveTo(from, p.key);
                          setDragging(null);
                          setOverKey(null);
                        }}
                        className={cn(
                          "rounded-xl border border-transparent transition-colors duration-150",
                          p.hidden && "opacity-50",
                          open && "border-line bg-paper-2/60",
                          dragging === p.key && "opacity-40",
                          overKey === p.key && dragging && dragging !== p.key && "border-ink/30 bg-paper-2",
                        )}
                      >
                        <div className="group/row grid grid-cols-[1.5rem_minmax(0,1fr)_7.5rem_auto] items-center gap-1 px-1 py-1">
                          <span
                            draggable
                            title="Drag to reorder"
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", p.key);
                              e.dataTransfer.effectAllowed = "move";
                              setDragging(p.key);
                            }}
                            onDragEnd={() => {
                              setDragging(null);
                              setOverKey(null);
                            }}
                            className="flex h-8 w-6 cursor-grab items-center justify-center rounded-md text-faint opacity-0 transition-opacity duration-150 hover:bg-paper-2 hover:text-ink group-hover/row:opacity-100 active:cursor-grabbing"
                          >
                            <GripVertical size={14} strokeWidth={1.4} />
                          </span>

                          <label className="flex min-w-0 items-center gap-2">
                            <ChromeIcon icon={PROP_ICONS[p.type]} className={accentIconClass(p.type)} />
                            <input
                              id={`prop-name-${p.key}`}
                              value={p.name}
                              aria-label="Property name"
                              title="⌥↑ ⌥↓ to reorder"
                              onChange={(e) => update(p.key, { name: e.target.value })}
                              onKeyDown={(e) => {
                                if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                                const i = schema.findIndex((x) => x.key === p.key);
                                const j = e.key === "ArrowUp" ? i - 1 : i + 1;
                                const dest = schema[j];
                                if (!dest) return;
                                e.preventDefault();
                                moveTo(p.key, dest.key);
                              }}
                              className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-faint hover:bg-paper-2 focus-visible:bg-paper-2 focus-visible:outline-none"
                            />
                          </label>

                          <Select
                            aria-label="Property type"
                            value={p.type}
                            onChange={(e) => setType(p, e.target.value as PropType)}
                            className="min-w-0 w-full"
                          >
                            {PROP_TYPE_GROUPS.map((g) => (
                              <optgroup key={g.label} label={g.label}>
                                {g.types
                                  .filter((t) => PROP_TYPES.includes(t))
                                  .map((t) => (
                                    <option key={t} value={t}>
                                      {PROP_TYPE_LABEL[t]}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </Select>

                          <span className="flex items-center">
                            <IconButton
                              aria-label={p.hidden ? "Show in views" : "Hide from views"}
                              title={p.hidden ? "Hidden from views" : "Visible in views"}
                              active={Boolean(p.hidden)}
                              onClick={() => update(p.key, { hidden: p.hidden ? undefined : true })}
                            >
                              {p.hidden ? (
                                <EyeOff size={14} strokeWidth={1.4} />
                              ) : (
                                <Eye size={14} strokeWidth={1.4} />
                              )}
                            </IconButton>
                            <IconButton
                              aria-label={open ? "Hide details" : "More"}
                              aria-expanded={open}
                              active={open}
                              onClick={() => setOpenKey(open ? null : p.key)}
                            >
                              <ChevronDown
                                size={14}
                                strokeWidth={1.4}
                                className={cn("transition-transform duration-150", open && "rotate-180")}
                              />
                            </IconButton>
                          </span>
                        </div>

                        {extras && (
                          <div className="border-t border-line/70 px-3 py-2 pl-[2.35rem]">
                            <TypeExtras
                              p={p}
                              schema={schema}
                              notes={notes}
                              dbs={dbs}
                              onChange={(patch) => update(p.key, patch)}
                            />
                          </div>
                        )}

                        {open && (
                          <div className="flex flex-col gap-3 border-t border-line/70 px-3 py-3 pl-[2.35rem]">
                            <label className="block">
                              <MonoLabel>Hint</MonoLabel>
                              <input
                                value={p.description ?? ""}
                                placeholder="Optional description"
                                onChange={(e) => update(p.key, { description: e.target.value || undefined })}
                                className="mt-1 w-full rounded-lg bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-faint hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
                              />
                            </label>
                            {p.type !== "files" &&
                              p.type !== "relation" &&
                              p.type !== "formula" &&
                              p.type !== "rollup" && (
                                <label className="block">
                                  <MonoLabel>Default</MonoLabel>
                                  <input
                                    value={p.default === undefined || p.default === null ? "" : String(p.default)}
                                    placeholder="Empty"
                                    onChange={(e) => update(p.key, { default: e.target.value || undefined })}
                                    className="mt-1 w-full rounded-lg bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-faint hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
                                  />
                                </label>
                              )}
                            <div className="flex flex-wrap gap-1">
                              <TextButton
                                onClick={() => {
                                  const key = `${p.key}_${nid(3)}`;
                                  setSchema([...schema, { ...p, key, name: `${p.name} copy` }]);
                                  setFocusKey(key);
                                }}
                              >
                                <Copy size={13} strokeWidth={1.4} />
                                Duplicate
                              </TextButton>
                              <TextButton onClick={() => setPendingDelete(p.key)}>
                                <Trash2 size={13} strokeWidth={1.4} />
                                Delete
                              </TextButton>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-3">
              {schema.length === 0 ? (
                <SolidButton onClick={add}>
                  <Plus size={14} strokeWidth={1.4} />
                  Add property
                </SolidButton>
              ) : (
                <TextButton onClick={add}>
                  <Plus size={14} strokeWidth={1.4} />
                  Add property
                </TextButton>
              )}
              <GhostButton onClick={onClose}>Done</GhostButton>
            </footer>
          </Panel>
        </Overlay>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this property?"
          description={`“${schema.find((p) => p.key === pendingDelete)?.name ?? "Property"}” will be removed from the schema. Values on rows are kept in the file but hidden from views.`}
          confirmLabel="Delete property"
          onConfirm={() => {
            setSchema(schema.filter((x) => x.key !== pendingDelete));
            setOpenKey(null);
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

function typeNeedsExtras(type: PropType) {
  return type === "select" || type === "multi_select" || type === "relation" || type === "formula" || type === "rollup";
}

function TypeExtras({
  p,
  schema,
  notes,
  dbs,
  onChange,
}: {
  p: SchemaProp;
  schema: SchemaProp[];
  notes: Note[];
  dbs: Note[];
  onChange: (patch: Partial<SchemaProp>) => void;
}) {
  if (p.type === "select" || p.type === "multi_select") {
    return <OptionsEditor options={p.options ?? []} onChange={(options) => onChange({ options })} />;
  }
  if (p.type === "relation") {
    return (
      <label className="flex flex-wrap items-center gap-2">
        <MonoLabel>Link to</MonoLabel>
        <Select
          value={p.relationTo ?? ""}
          onChange={(e) => onChange({ relationTo: e.target.value || undefined })}
          className="min-w-[10rem] flex-1"
        >
          <option value="">Any page</option>
          {dbs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </Select>
      </label>
    );
  }
  if (p.type === "formula") {
    return (
      <label className="block">
        <MonoLabel>Formula</MonoLabel>
        <textarea
          value={p.formula ?? ""}
          onChange={(e) => onChange({ formula: e.target.value })}
          rows={2}
          spellCheck={false}
          className="mt-1 w-full resize-y rounded-lg bg-paper px-2 py-1.5 font-mono text-[12px] leading-5 text-ink focus-visible:outline-none"
        />
        <p className="mt-1 font-mono text-[10px] text-faint">prop("Status") · if · len · days · concat</p>
      </label>
    );
  }
  if (p.type === "rollup") {
    return (
      <RollupEditor
        schema={schema}
        notes={notes}
        value={
          p.rollup ?? {
            relation: schema.find((x) => x.type === "relation")?.key ?? "related",
            property: "title",
            agg: "count",
          }
        }
        onChange={(rollup) => onChange({ rollup })}
      />
    );
  }
  return null;
}

function RollupEditor({
  schema,
  notes,
  value,
  onChange,
}: {
  schema: SchemaProp[];
  notes: Note[];
  value: { relation: string; property: string; agg: RollupAgg };
  onChange: (rollup: { relation: string; property: string; agg: RollupAgg }) => void;
}) {
  const relations = schema.filter((s) => s.type === "relation");
  const rel = schema.find((s) => s.key === value.relation);
  const relatedDb = notes.find((n) => n.id === rel?.relationTo);
  const props = [
    { key: "title", name: "Title" },
    ...(relatedDb?.schema ?? []).map((s) => ({ key: s.key, name: s.name })),
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label className="block min-w-0">
        <MonoLabel>Relation</MonoLabel>
        <Select
          value={value.relation}
          onChange={(e) => onChange({ ...value, relation: e.target.value })}
          className="mt-1 w-full min-w-0"
        >
          {relations.length === 0 && <option value={value.relation}>{value.relation}</option>}
          {relations.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block min-w-0">
        <MonoLabel>Property</MonoLabel>
        <Select
          value={value.property}
          onChange={(e) => onChange({ ...value, property: e.target.value })}
          className="mt-1 w-full min-w-0"
        >
          {props.map((pr) => (
            <option key={pr.key} value={pr.key}>
              {pr.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block min-w-0">
        <MonoLabel>Calculate</MonoLabel>
        <Select
          value={value.agg}
          onChange={(e) => onChange({ ...value, agg: e.target.value as RollupAgg })}
          className="mt-1 w-full min-w-0"
        >
          {ROLLUP_AGGS.map((a) => (
            <option key={a} value={a}>
              {ROLLUP_AGG_LABEL[a] ?? a.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement | null>(null);

  const commitDraft = () => {
    const v = draft.trim();
    if (v && !options.includes(v)) onChange([...options, v]);
    setDraft("");
  };

  return (
    <div>
      <MonoLabel>Options</MonoLabel>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {options.map((o, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full border border-line bg-paper pl-2.5"
          >
            <input
              value={o}
              aria-label={`Option ${i + 1}`}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                onChange(next);
              }}
              onBlur={() => onChange(options.map((x) => x.trim()).filter(Boolean))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  draftRef.current?.focus();
                }
                if (e.key === "Backspace" && o === "") {
                  onChange(options.filter((_, j) => j !== i));
                }
              }}
              className="min-w-[4ch] bg-transparent py-0.5 font-mono text-[11px] text-ink focus-visible:outline-none"
              style={{ width: `${Math.max(4, o.length + 1)}ch` }}
            />
            <button
              type="button"
              aria-label={`Remove ${o || "option"}`}
              className="px-1.5 py-0.5 font-mono text-[11px] text-faint hover:text-ink"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={draftRef}
          value={draft}
          placeholder="Add option"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
          className="w-28 bg-transparent py-0.5 font-mono text-[11px] text-ink placeholder:text-faint focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
