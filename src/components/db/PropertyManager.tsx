import { ConfirmDialog, GhostButton, IconButton, MonoLabel, Overlay, Panel, Select, SolidButton, TextButton, Toggle } from "@/components/ui";
import { ChromeIcon, PROP_ICONS } from "@/lib/chrome-icons";
import { nid } from "@/lib/ids";
import { useApp } from "@/store";
import type { Note, PropType, RollupAgg, SchemaProp } from "@/types";
import { PROP_TYPES, ROLLUP_AGGS } from "@/types";
import { ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import { useState } from "react";

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
  const [openKey, setOpenKey] = useState<string | null>(schema[0]?.key ?? null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const dbs = notes.filter((n) => n.type === "database" && n.id !== target.id);

  const setSchema = (next: SchemaProp[]) => patchNote(target.id, { schema: next });

  const add = () => {
    const key = `prop_${nid(4)}`;
    const prop: SchemaProp = { key, name: "Property", type: "text" };
    setSchema([...schema, prop]);
    setOpenKey(key);
  };

  const update = (key: string, patch: Partial<SchemaProp>) => {
    setSchema(schema.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const move = (key: string, dir: -1 | 1) => {
    const i = schema.findIndex((p) => p.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= schema.length) return;
    const next = [...schema];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    setSchema(next);
  };

  return (
    <>
    {!pendingDelete && (
    <Overlay onClose={onClose}>
      <Panel className="max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <MonoLabel>Properties</MonoLabel>
            <h2 className="mt-2 font-serif text-3xl italic tracking-tight">{target.title}</h2>
          </div>
          <TextButton onClick={onClose}>Close</TextButton>
        </div>
        <ul className="mt-6 space-y-2">
          {schema.map((p) => (
            <li key={p.key} className="border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <IconButton aria-label="Move up" onClick={() => move(p.key, -1)}>
                  <ChevronUp size={13} strokeWidth={1.4} />
                </IconButton>
                <IconButton aria-label="Move down" onClick={() => move(p.key, 1)}>
                  <ChevronDown size={13} strokeWidth={1.4} />
                </IconButton>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left font-serif text-sm hover:text-mute"
                  onClick={() => setOpenKey(openKey === p.key ? null : p.key)}
                >
                  <ChromeIcon icon={PROP_ICONS[p.type]} />
                  {p.name}
                  <span className="font-mono text-[10px] text-faint">{p.type}</span>
                  {p.hidden && <EyeOff size={12} strokeWidth={1.4} className="text-faint" aria-label="Hidden" />}
                </button>
              </div>
              {openKey === p.key && (
                <div className="mt-3 grid gap-3 pl-10">
                  <label className="block">
                    <MonoLabel>Name</MonoLabel>
                    <input
                      value={p.name}
                      onChange={(e) => update(p.key, { name: e.target.value })}
                      className="mt-1 w-full bg-transparent text-sm focus-visible:outline-none"
                    />
                  </label>
                  <label className="block">
                    <MonoLabel>Type</MonoLabel>
                    <Select
                      value={p.type}
                      onChange={(e) => {
                        const type = e.target.value as PropType;
                        const rel = schema.find((x) => x.type === "relation");
                        update(p.key, {
                          type,
                          options:
                            type === "select" || type === "multi_select"
                              ? p.options ?? ["Inbox", "Active", "Done"]
                              : undefined,
                          formula:
                            type === "formula" ? p.formula ?? 'if(prop("Status") == "Harvest", "Shipped", prop("Status"))' : undefined,
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
                      }}
                      className="mt-1"
                    >
                      {PROP_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <MonoLabel>Description</MonoLabel>
                    <input
                      value={p.description ?? ""}
                      onChange={(e) => update(p.key, { description: e.target.value || undefined })}
                      className="mt-1 w-full bg-transparent text-sm focus-visible:outline-none"
                    />
                  </label>
                  {(p.type === "select" || p.type === "multi_select") && (
                    <OptionsEditor
                      options={p.options ?? []}
                      onChange={(options) => update(p.key, { options })}
                    />
                  )}
                  {p.type === "relation" && (
                    <label className="block">
                      <MonoLabel>Relation to</MonoLabel>
                      <Select
                        value={p.relationTo ?? ""}
                        onChange={(e) => update(p.key, { relationTo: e.target.value || undefined })}
                        className="mt-1"
                      >
                        <option value="">Any page</option>
                        {dbs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                  {p.type === "formula" && (
                    <label className="block">
                      <MonoLabel>Formula</MonoLabel>
                      <textarea
                        value={p.formula ?? ""}
                        onChange={(e) => update(p.key, { formula: e.target.value })}
                        rows={3}
                        spellCheck={false}
                        className="mt-1 w-full resize-y bg-transparent font-mono text-[12px] leading-5 focus-visible:outline-none"
                      />
                      <p className="mt-1 font-mono text-[10px] text-faint">
                        prop("Status") · if · len · days · concat
                      </p>
                    </label>
                  )}
                  {p.type === "rollup" && (
                    <RollupEditor
                      schema={schema}
                      notes={notes}
                      value={p.rollup ?? { relation: schema.find((x) => x.type === "relation")?.key ?? "related", property: "title", agg: "count" }}
                      onChange={(rollup) => update(p.key, { rollup })}
                    />
                  )}
                  {p.type !== "files" && p.type !== "relation" && p.type !== "formula" && p.type !== "rollup" && (
                    <label className="block">
                      <MonoLabel>Default</MonoLabel>
                      <input
                        value={p.default === undefined || p.default === null ? "" : String(p.default)}
                        onChange={(e) => update(p.key, { default: e.target.value || undefined })}
                        className="mt-1 w-full bg-transparent text-sm focus-visible:outline-none"
                      />
                    </label>
                  )}
                  <Toggle
                    checked={Boolean(p.hidden)}
                    onChange={(on) => update(p.key, { hidden: on || undefined })}
                    label="Hide from views"
                  />
                  <div className="flex gap-3">
                    <TextButton
                      onClick={() => {
                        const key = `${p.key}_${nid(3)}`;
                        setSchema([...schema, { ...p, key, name: `${p.name} copy` }]);
                      }}
                    >
                      Duplicate
                    </TextButton>
                    <TextButton
                      onClick={() => setPendingDelete(p.key)}
                    >
                      Delete
                    </TextButton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-3">
          <SolidButton onClick={add}>Add property</SolidButton>
          <GhostButton onClick={onClose}>Done</GhostButton>
        </div>
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
    <div className="grid gap-3">
      <label className="block">
        <MonoLabel>Relation</MonoLabel>
        <Select
          value={value.relation}
          onChange={(e) => onChange({ ...value, relation: e.target.value })}
          className="mt-1"
        >
          {relations.length === 0 && <option value={value.relation}>{value.relation}</option>}
          {relations.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <MonoLabel>Property</MonoLabel>
        <Select
          value={value.property}
          onChange={(e) => onChange({ ...value, property: e.target.value })}
          className="mt-1"
        >
          {props.map((pr) => (
            <option key={pr.key} value={pr.key}>
              {pr.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <MonoLabel>Calculate</MonoLabel>
        <Select
          value={value.agg}
          onChange={(e) => onChange({ ...value, agg: e.target.value as RollupAgg })}
          className="mt-1"
        >
          {ROLLUP_AGGS.map((a) => (
            <option key={a} value={a}>
              {a.replaceAll("_", " ")}
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
  return (
    <div>
      <MonoLabel>Options</MonoLabel>
      <ul className="mt-2 space-y-1">
        {options.map((o, i) => (
          <li key={`${o}-${i}`} className="flex items-center gap-2">
            <input
              value={o}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                onChange(next.filter(Boolean));
              }}
              className="flex-1 bg-transparent text-sm focus-visible:outline-none"
            />
            <button
              type="button"
              className="font-mono text-[11px] text-faint hover:text-ink"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        value={draft}
        placeholder="Add option"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = draft.trim();
            if (v && !options.includes(v)) onChange([...options, v]);
            setDraft("");
          }
        }}
        className="mt-2 w-full bg-transparent font-mono text-[11px] focus-visible:outline-none"
      />
    </div>
  );
}
