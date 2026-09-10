import { IconChooser } from "@/components/editor/IconChooser";
import { PropInput } from "@/components/editor/PropInput";
import { PropertyManager } from "@/components/db/PropertyManager";
import { RecordCard } from "@/components/db/RecordCard";
import { Chip, ConfirmDialog, EmptyState, Field, GhostButton, IconButton, MonoLabel, Panel, Select, SolidButton, TextButton } from "@/components/ui";
import { contextMenuFromKey, useContextMenu } from "@/components/ContextMenu";
import { noteMenuItems } from "@/lib/context-menus";
import { cn } from "@/lib/cn";
import { ChromeIcon, NoteIcon, NoteLabel, accentIconClass, noteKindIcon, PROP_ICONS, VIEW_ICONS } from "@/lib/chrome-icons";
import { nid, slugify } from "@/lib/ids";
import { effectivePropType, itemColorId, propAccentStyle } from "@/lib/prop-schema";
import { applyView, emptyFilterRule, resolveFilter, visibleSchema, newView } from "@/lib/views";
import { useApp } from "@/store";
import type { CoverSource, DbView, DbViewType, FilterNode, FilterOp, Note, SchemaProp, ViewSort } from "@/types";
import { DB_VIEW_TYPES } from "@/types";
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function DatabasePage({ note, viewId }: { note: Note; viewId?: string }) {
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const upsertNote = useApp((s) => s.upsertNote);
  const createPage = useApp((s) => s.createPage);
  const setView = useApp((s) => s.setView);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const rows = useMemo(() => notes.filter((n) => n.parent === note.id), [notes, note.id]);
  const views = note.views ?? [{ id: "table", name: "Table", type: "table" as const }];
  const active = views.find((v) => v.id === viewId) ?? views[0];
  const schema = note.schema ?? [];
  const shown = visibleSchema(schema, active);
  const filtered = applyView(rows, active, notes, schema);
  const [propsOpen, setPropsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [pendingDeleteView, setPendingDeleteView] = useState(false);
  const [addViewOpen, setAddViewOpen] = useState(false);
  const addViewRef = useRef<HTMLDivElement | null>(null);
  const { open } = useContextMenu();
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [titleSeenId, setTitleSeenId] = useState(note.id);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  if (note.id !== titleSeenId) {
    setTitleSeenId(note.id);
    setDraftTitle(note.title);
  }
  useEffect(() => {
    if (document.activeElement === titleInputRef.current) return;
    if (draftTitle === note.title) return;
    setDraftTitle(note.title);
  }, [note.title, note.id, draftTitle]);

  useEffect(() => {
    if (!addViewOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (addViewRef.current?.contains(e.target as Node)) return;
      setAddViewOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddViewOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [addViewOpen]);

  const addView = (type: DbViewType) => {
    const view = newView(type);
    patchNote(note.id, { views: [...views, view] });
    setView({ kind: "database", id: note.id, viewId: view.id });
    setAddViewOpen(false);
  };

  const patchView = (patch: Partial<DbView>) => {
    patchNote(note.id, {
      views: views.map((v) => (v.id === active.id ? { ...v, ...patch } : v)),
    });
  };

  const moveTab = (id: string, dir: -1 | 1) => {
    const i = views.findIndex((v) => v.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= views.length) return;
    const next = [...views];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    patchNote(note.id, { views: next });
  };

  return (
    <div
      className="flex flex-col px-4 py-8 pb-32 group/page md:px-8 md:py-10"
      onContextMenu={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, select, button, table, [role='menu']")) return;
        open(e, noteMenuItems(note));
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <MonoLabel>Database</MonoLabel>
          <div className="mt-1">
            <IconChooser
              value={note.icon}
              onChange={(icon) => patchNote(note.id, { icon })}
              fallback={noteKindIcon("database")}
              size={28}
            />
          </div>
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => {
              const title = draftTitle.trim() || "Untitled";
              if (title === note.title) return;
              const folder = note.path.includes("/")
                ? note.path.split("/").slice(0, -1).join("/")
                : "";
              const nextPath = `${folder ? folder + "/" : ""}${slugify(title)}.database.md`;
              upsertNote({ ...note, title, path: nextPath }, { renameFrom: note.path });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="klever-focus mt-2 block rounded-md bg-transparent font-serif text-3xl font-semibold tracking-tight md:text-4xl"
            placeholder="Untitled"
            aria-label="Database title"
          />
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={() => setPropsOpen((o) => !o)} aria-pressed={propsOpen}>
            Properties
          </GhostButton>
          <SolidButton onClick={() => createPage({ parent: note.id, stay: true })}>
            <Plus size={14} strokeWidth={1.4} />
            New row
          </SolidButton>
          <GhostButton onClick={() => setPlusOpen(true, "database")} aria-label="Insert">
            Insert
          </GhostButton>
        </div>
      </div>

      {propsOpen && (
        <div className="mt-6">
          <PropertyManager note={note} onClose={() => setPropsOpen(false)} />
        </div>
      )}

      <div className="mt-8 flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-line">
        {views.map((v) => (
          <div key={v.id} className="group/tab flex items-center">
            {editingTab === v.id ? (
              <input
                autoFocus
                defaultValue={v.name}
                className="klever-focus h-9 w-28 border-b-2 border-ring bg-transparent px-2 text-sm"
                onBlur={(e) => {
                  const name = e.target.value.trim() || v.name;
                  patchNote(note.id, {
                    views: views.map((x) => (x.id === v.id ? { ...x, name } : x)),
                  });
                  setEditingTab(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditingTab(null);
                }}
              />
            ) : (
              <button
                type="button"
                title="Double-click to rename"
                onClick={() => setView({ kind: "database", id: note.id, viewId: v.id })}
                onDoubleClick={() => setEditingTab(v.id)}
                onContextMenu={(e) =>
                  open(e, [
                    {
                      id: "open",
                      label: "Open",
                      onSelect: () => setView({ kind: "database", id: note.id, viewId: v.id }),
                    },
                    { id: "rename", label: "Rename", onSelect: () => setEditingTab(v.id) },
                    {
                      id: "dup",
                      label: "Duplicate view",
                      onSelect: () => {
                        const copy = { ...v, id: nid(), name: `${v.name} copy` };
                        patchNote(note.id, { views: [...views, copy] });
                        setView({ kind: "database", id: note.id, viewId: copy.id });
                      },
                    },
                    { type: "sep" as const },
                    {
                      id: "delete",
                      label: "Delete view",
                      danger: true,
                      hidden: views.length <= 1,
                      confirm: {
                        title: `Delete ${v.name}?`,
                        description: "This cannot be undone.",
                        confirmLabel: "Delete",
                      },
                      onSelect: () => {
                        const next = views.filter((x) => x.id !== v.id);
                        patchNote(note.id, { views: next });
                        const fallback = next[0];
                        if (v.id === active.id && fallback) {
                          setView({ kind: "database", id: note.id, viewId: fallback.id });
                        }
                      },
                    },
                  ])
                }
                className={cn(
                  "klever-focus inline-flex h-9 items-center gap-2 rounded-t-md border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                  v.id === active.id
                    ? "border-ring text-ink"
                    : "border-transparent text-mute hover:bg-paper-2 hover:text-ink",
                )}
              >
                <ChromeIcon
                  icon={VIEW_ICONS[v.type]}
                  size={14}
                  className={v.id === active.id ? "text-ink" : "text-mute"}
                />
                {v.name}
              </button>
            )}
            {v.id === active.id && (
              <span className="ml-0.5 hidden items-center group-hover/tab:flex group-focus-within/tab:flex">
                <IconButton aria-label="Move tab left" onClick={() => moveTab(v.id, -1)}>
                  <ChevronLeft size={13} strokeWidth={1.4} />
                </IconButton>
                <IconButton aria-label="Move tab right" onClick={() => moveTab(v.id, 1)}>
                  <ChevronRight size={13} strokeWidth={1.4} />
                </IconButton>
              </span>
            )}
          </div>
        ))}
        <div ref={addViewRef} className="relative ml-0.5 shrink-0">
          <IconButton
            aria-label="Add view"
            aria-haspopup="menu"
            aria-expanded={addViewOpen}
            onClick={() => setAddViewOpen((o) => !o)}
          >
            <Plus size={14} strokeWidth={1.4} />
          </IconButton>
          {addViewOpen && (
            <div
              role="menu"
              aria-label="Add view"
              className="absolute left-0 top-full z-30 mt-1 min-w-[9.5rem] rounded-md border border-line bg-paper py-1 shadow-md"
            >
              {DB_VIEW_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="menuitem"
                  className="klever-focus flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm capitalize text-mute hover:bg-paper-2 hover:text-ink"
                  onClick={() => addView(t)}
                >
                  <ChromeIcon icon={VIEW_ICONS[t]} size={14} className="text-mute" />
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <GhostButton
          className="ml-2 h-8 px-3 py-0 text-sm"
          aria-label={settingsOpen ? "Hide view settings" : "View settings"}
          onClick={() => setSettingsOpen((s) => !s)}
        >
          <SlidersHorizontal size={14} strokeWidth={1.4} />
          <span className="hidden sm:inline">{settingsOpen ? "Hide settings" : "Settings"}</span>
        </GhostButton>
        <span className="ml-auto font-mono text-[11px] text-mute">{filtered.length} rows</span>
      </div>

      {settingsOpen && (
        <ViewSettings
          view={active}
          schema={schema}
          onPatch={patchView}
          onDuplicate={() => {
            const copy: DbView = { ...active, id: nid(6), name: `${active.name} copy` };
            patchNote(note.id, { views: [...views, copy] });
            setView({ kind: "database", id: note.id, viewId: copy.id });
          }}
          onDelete={() => {
            if (views.length < 2) return;
            setPendingDeleteView(true);
          }}
        />
      )}

      <div className="mt-6">
        {filtered.length === 0 ? (
          <EmptyState
            className="px-0"
            title="No rows yet"
            description="Each row is a page in this database. Add one to begin."
            action={
              <SolidButton onClick={() => createPage({ parent: note.id, stay: true })}>
                <Plus size={14} strokeWidth={1.4} />
                New row
              </SolidButton>
            }
          />
        ) : (
          <>
            {active.type === "table" && <TableView rows={filtered} schema={shown} />}
            {active.type === "board" && (
              <BoardView rows={filtered} schema={shown} groupBy={active.groupBy ?? "status"} db={note} cover={active.cover} size={active.cardSize} />
            )}
            {active.type === "gallery" && (
              <GalleryView rows={filtered} schema={shown} cover={active.cover ?? "page"} size={active.cardSize ?? "m"} />
            )}
            {active.type === "card" && (
              <CardView rows={filtered} schema={shown} cover={active.cover ?? "page"} size={active.cardSize ?? "m"} />
            )}
            {active.type === "list" && <ListView rows={filtered} schema={shown} />}
            {active.type === "calendar" && (
              <CalendarView rows={filtered} dateProp={active.dateProp ?? "due"} />
            )}
            {active.type === "timeline" && (
              <TimelineView
                rows={filtered}
                dateProp={active.dateProp ?? "due"}
                endDateProp={active.endDateProp}
              />
            )}
          </>
        )}
      </div>

      {pendingDeleteView && (
        <ConfirmDialog
          title="Delete this view?"
          description={`“${active.name}” is removed. Rows stay in the database.`}
          confirmLabel="Delete view"
          onConfirm={() => {
            const next = views.filter((v) => v.id !== active.id);
            if (!next.length) {
              setPendingDeleteView(false);
              return;
            }
            patchNote(note.id, { views: next });
            setView({ kind: "database", id: note.id, viewId: next[0]?.id });
            setPendingDeleteView(false);
          }}
          onClose={() => setPendingDeleteView(false)}
        />
      )}
    </div>
  );
}

function ViewSettings({
  view,
  schema,
  onPatch,
  onDuplicate,
  onDelete,
}: {
  view: DbView;
  schema: SchemaProp[];
  onPatch: (patch: Partial<DbView>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const visible = view.visible ?? schema.filter((s) => !s.hidden).map((s) => s.key);
  return (
    <Panel className="mt-4 p-4">
      <div className="flex flex-wrap gap-6">
        <label className="block">
          <MonoLabel>Type</MonoLabel>
          <Select
            value={view.type}
            onChange={(e) => onPatch({ type: e.target.value as DbViewType })}
            className="mt-1"
          >
            {DB_VIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </label>
        {view.type === "board" && (
          <label className="block">
            <MonoLabel>Group by</MonoLabel>
            <Select
              value={view.groupBy ?? ""}
              onChange={(e) => onPatch({ groupBy: e.target.value })}
              className="mt-1"
            >
              {schema.filter((s) => s.type === "select").map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {view.type === "calendar" && (
          <label className="block">
            <MonoLabel>Date</MonoLabel>
            <Select
              value={view.dateProp ?? "due"}
              onChange={(e) => onPatch({ dateProp: e.target.value })}
              className="mt-1"
            >
              {schema.filter((s) => s.type === "date").map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {view.type === "timeline" && (
          <>
            <label className="block">
              <MonoLabel>Start date</MonoLabel>
              <Select
                value={view.dateProp ?? "due"}
                onChange={(e) => onPatch({ dateProp: e.target.value })}
                className="mt-1"
              >
                {schema.filter((s) => s.type === "date").map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <MonoLabel>End date (optional)</MonoLabel>
              <Select
                value={view.endDateProp ?? ""}
                onChange={(e) => onPatch({ endDateProp: e.target.value || undefined })}
                className="mt-1"
              >
                <option value="">Same day</option>
                {schema.filter((s) => s.type === "date").map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
          </>
        )}
        {(view.type === "gallery" || view.type === "card" || view.type === "board") && (
          <>
            <label className="block">
              <MonoLabel>Cover</MonoLabel>
              <Select
                value={view.cover ?? "page"}
                onChange={(e) => onPatch({ cover: e.target.value as CoverSource })}
                className="mt-1"
              >
                <option value="page">Page cover</option>
                <option value="first-image">First image</option>
                <option value="none">None</option>
              </Select>
            </label>
            <label className="block">
              <MonoLabel>Size</MonoLabel>
              <Select
                value={view.cardSize ?? "m"}
                onChange={(e) => onPatch({ cardSize: e.target.value as DbView["cardSize"] })}
                className="mt-1"
              >
                <option value="s">S</option>
                <option value="m">M</option>
                <option value="l">L</option>
              </Select>
            </label>
          </>
        )}
      </div>
      <div className="mt-4">
        <MonoLabel>Visible properties</MonoLabel>
        <div className="mt-2 flex flex-wrap gap-3">
          {schema.filter((s) => !s.hidden).map((s) => (
            <Chip
              key={s.key}
              selected={visible.includes(s.key)}
              tone="prop"
              onClick={() => {
                const next = visible.includes(s.key)
                  ? visible.filter((k) => k !== s.key)
                  : [...visible, s.key];
                onPatch({ visible: next });
              }}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      </div>
      <FilterEditor view={view} schema={schema} onPatch={onPatch} />
      <SortEditor view={view} schema={schema} onPatch={onPatch} />
      <div className="mt-4 flex gap-3">
        <TextButton onClick={onDuplicate}>Duplicate view</TextButton>
        <TextButton onClick={onDelete}>Delete view</TextButton>
      </div>
    </Panel>
  );
}

function FilterEditor({
  view,
  schema,
  onPatch,
}: {
  view: DbView;
  schema: SchemaProp[];
  onPatch: (p: Partial<DbView>) => void;
}) {
  const root = resolveFilter(view) ?? ({ type: "group", op: "and", children: [] } satisfies FilterNode);
  const group: Extract<FilterNode, { type: "group" }> =
    root.type === "group" ? root : { type: "group", op: "and", children: [root] };

  const commit = (next: FilterNode) => {
    onPatch({ filter: next, filters: undefined });
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <MonoLabel>Filters</MonoLabel>
        <Select
          value={group.op}
          onChange={(e) => commit({ ...group, op: e.target.value as "and" | "or" })}
          className="h-7 min-w-[4.5rem] text-[10px]"
        >
          <option value="and">AND</option>
          <option value="or">OR</option>
        </Select>
      </div>
      <div className="mt-2 space-y-2">
        <FilterNodeEditor
          node={group}
          depth={0}
          schema={schema}
          onChange={commit}
        />
        <div className="flex flex-wrap gap-2">
          <TextButton
            onClick={() =>
              commit({
                ...group,
                children: [...group.children, emptyFilterRule(schema[0]?.key ?? "title")],
              })
            }
          >
            + condition
          </TextButton>
          <TextButton
            onClick={() =>
              commit({
                ...group,
                children: [
                  ...group.children,
                  { type: "group", op: "or", children: [emptyFilterRule(schema[0]?.key ?? "title")] },
                ],
              })
            }
          >
            + group
          </TextButton>
        </div>
      </div>
    </div>
  );
}

function FilterNodeEditor({
  node,
  depth,
  schema,
  onChange,
  onRemove,
}: {
  node: FilterNode;
  depth: number;
  schema: SchemaProp[];
  onChange: (n: FilterNode) => void;
  onRemove?: () => void;
}) {
  const ops: FilterOp[] = ["eq", "neq", "contains", "empty", "not_empty", "gt", "lt", "gte", "lte"];

  if (node.type === "rule") {
    return (
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <Select
          value={node.key}
          onChange={(e) => onChange({ ...node, key: e.target.value })}
          className="min-w-[6rem]"
        >
          <option value="title">Title</option>
          {schema.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          value={node.op}
          onChange={(e) => onChange({ ...node, op: e.target.value as FilterOp })}
          className="min-w-[7rem]"
        >
          {ops.map((o) => (
            <option key={o} value={o}>
              {o.replace("_", " ")}
            </option>
          ))}
        </Select>
        {node.op !== "empty" && node.op !== "not_empty" && (
          <Field
            value={String(node.value ?? "")}
            onChange={(e) => onChange({ ...node, value: e.target.value })}
            className="h-8 w-40 rounded-lg py-1"
          />
        )}
        {onRemove && (
          <IconButton aria-label="Remove" onClick={onRemove}>
            <X size={13} strokeWidth={1.4} />
          </IconButton>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2",
        depth > 0 && "rounded-lg border border-rule bg-paper-2/50 p-2",
      )}
    >
      {depth > 0 && (
        <div className="flex items-center gap-2">
          <Select
            value={node.op}
            onChange={(e) => onChange({ ...node, op: e.target.value as "and" | "or" })}
            className="h-7 min-w-[4.5rem] text-[10px]"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </Select>
          <span className="font-mono text-[10px] text-mute">group</span>
          {onRemove && (
            <IconButton aria-label="Remove group" onClick={onRemove}>
              <X size={13} strokeWidth={1.4} />
            </IconButton>
          )}
        </div>
      )}
      {node.children.map((child, i) => (
        <FilterNodeEditor
          key={i}
          node={child}
          depth={depth + 1}
          schema={schema}
          onChange={(next) => {
            const children = [...node.children];
            children[i] = next;
            onChange({ ...node, children });
          }}
          onRemove={() =>
            onChange({ ...node, children: node.children.filter((_, j) => j !== i) })
          }
        />
      ))}
      {depth < 2 && (
        <TextButton
          onClick={() =>
            onChange({
              ...node,
              children: [...node.children, emptyFilterRule(schema[0]?.key ?? "title")],
            })
          }
        >
          + condition
        </TextButton>
      )}
    </div>
  );
}

function SortEditor({
  view,
  schema,
  onPatch,
}: {
  view: DbView;
  schema: SchemaProp[];
  onPatch: (p: Partial<DbView>) => void;
}) {
  const sorts = view.sorts ?? [];
  return (
    <div className="mt-4">
      <MonoLabel>Sorts</MonoLabel>
      <div className="mt-2 space-y-2">
        {sorts.map((s, i) => (
          <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
            <Select
              value={s.key}
              onChange={(e) => {
                const next = [...sorts];
                next[i] = { ...s, key: e.target.value };
                onPatch({ sorts: next });
              }}
              className="min-w-[6rem]"
            >
              <option value="title">Title</option>
              {schema.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              value={s.dir}
              onChange={(e) => {
                const next = [...sorts];
                next[i] = { ...s, dir: e.target.value as ViewSort["dir"] };
                onPatch({ sorts: next });
              }}
              className="min-w-[5rem]"
            >
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </Select>
            <IconButton
              aria-label="Remove sort"
              onClick={() => onPatch({ sorts: sorts.filter((_, j) => j !== i) })}
            >
              <X size={13} strokeWidth={1.4} />
            </IconButton>
          </div>
        ))}
        <TextButton
          onClick={() => onPatch({ sorts: [...sorts, { key: "title", dir: "asc" }] })}
        >
          + sort
        </TextButton>
      </div>
    </div>
  );
}

function TableView({ rows, schema }: { rows: Note[]; schema: SchemaProp[] }) {
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[640px] border-collapse text-sm">
      <thead>
        <tr className="text-left">
          <th className="border-b border-line py-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-mute">
            Name
          </th>
          {schema.map((s) => (
            <th
              key={s.key}
              className="border-b border-line py-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-mute"
            >
              <span className="inline-flex items-center gap-1.5">
                <ChromeIcon icon={PROP_ICONS[effectivePropType(s)]} className={accentIconClass(effectivePropType(s))} />
                {s.name}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="align-middle transition-colors duration-150 hover:bg-paper-2"
            onContextMenu={(e) => {
              if ((e.target as HTMLElement).closest("input, textarea, select, button:not(.row-name)")) return;
              open(e, noteMenuItems(row));
            }}
          >
            <td className="border-b border-line py-2.5 pr-4">
              <button
                type="button"
                className="row-name text-left hover:opacity-70"
                onClick={() => setView({ kind: "note", id: row.id })}
                onContextMenu={(e) => open(e, noteMenuItems(row))}
              >
                <NoteLabel note={row} />
              </button>
            </td>
            {schema.map((s) => (
              <td key={s.key} className="border-b border-line py-1 pr-4">
                <PropInput note={row} field={s.key} type={s.type} options={s.options} relationTo={s.relationTo} spec={s} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function BoardView({
  rows,
  schema,
  groupBy,
  db,
  cover,
  size,
}: {
  rows: Note[];
  schema: SchemaProp[];
  groupBy: string;
  db: Note;
  cover?: CoverSource;
  size?: DbView["cardSize"];
}) {
  const createPage = useApp((s) => s.createPage);
  const patchNote = useApp((s) => s.patchNote);
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const col = schema.find((s) => s.key === groupBy) ?? db.schema?.find((s) => s.key === groupBy);
  const columns = [...(col?.options ?? ["No status"])];
  if (rows.some((r) => !r.props[groupBy])) columns.push("—");
  return (
    <div className="flex gap-6 overflow-x-auto pb-8">
      {columns.map((c) => {
        const items = rows.filter((r) => {
          const val = String(r.props[groupBy] ?? "");
          return c === "—" ? !val : val === c;
        });
        return (
          <section key={c} className="w-64 shrink-0">
            <div className="mb-3 flex items-baseline justify-between">
              <MonoLabel style={c === "—" ? undefined : propAccentStyle(itemColorId(col?.itemColors, c))}>
                {c}
              </MonoLabel>
              <span className="font-mono text-[10px] text-faint">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((row) => (
                <RecordCard
                  key={row.id}
                  row={row}
                  schema={schema.slice(0, 3)}
                  cover={cover ?? "none"}
                  size={size ?? "s"}
                  onOpen={() => setView({ kind: "note", id: row.id })}
                  onContextMenu={(e) => open(e, noteMenuItems(row))}
                />
              ))}
              <GhostButton
                className="w-full border-dashed py-2 text-[12px] text-mute"
                onClick={() => {
                  const id = createPage({ parent: db.id, title: "Untitled", stay: true });
                  const created = useApp.getState().notes.find((n) => n.id === id);
                  if (created) {
                    patchNote(id, {
                      props: { ...created.props, [groupBy]: c === "—" ? undefined : c },
                    });
                  }
                }}
              >
                Add
              </GhostButton>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function GalleryView({
  rows,
  schema,
  cover,
  size,
}: {
  rows: Note[];
  schema: SchemaProp[];
  cover: CoverSource;
  size: NonNullable<DbView["cardSize"]>;
}) {
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const cols = size === "s" ? "sm:grid-cols-3 xl:grid-cols-4" : size === "l" ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3";
  return (
    <div className={cn("grid grid-cols-1 gap-4", cols)}>
      {rows.map((row) => (
        <RecordCard
          key={row.id}
          row={row}
          schema={schema.slice(0, 4)}
          cover={cover}
          size={size}
          onOpen={() => setView({ kind: "note", id: row.id })}
          onContextMenu={(e) => open(e, noteMenuItems(row))}
        />
      ))}
    </div>
  );
}

function CardView({
  rows,
  schema,
  cover,
  size,
}: {
  rows: Note[];
  schema: SchemaProp[];
  cover: CoverSource;
  size: NonNullable<DbView["cardSize"]>;
}) {
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {rows.map((row) => (
        <RecordCard
          key={row.id}
          row={row}
          schema={schema}
          cover={cover}
          size={size}
          snippet
          onOpen={() => setView({ kind: "note", id: row.id })}
          onContextMenu={(e) => open(e, noteMenuItems(row))}
        />
      ))}
    </div>
  );
}

function ListView({ rows, schema }: { rows: Note[]; schema: SchemaProp[] }) {
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const status = schema.find((s) => s.type === "select");
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id} className="flex items-baseline gap-4 border-b border-line py-3">
          <button
            type="button"
            className="text-left text-sm hover:opacity-70"
            onClick={() => setView({ kind: "note", id: row.id })}
            onContextMenu={(e) => open(e, noteMenuItems(row))}
          >
            <NoteLabel note={row} />
          </button>
          <span
            className={cn(
              "ml-auto font-mono text-[11px]",
              status ? "text-prop/80" : "text-tag/75",
            )}
            style={
              status
                ? propAccentStyle(itemColorId(status.itemColors, String(row.props[status.key] ?? "")))
                : undefined
            }
          >
            {status ? String(row.props[status.key] ?? "") : row.tags.join(" ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CalendarView({ rows, dateProp }: { rows: Note[]; dateProp: string }) {
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: start + days }, (_, i) => {
    if (i < start) return null;
    const day = i - start + 1;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, iso, items: rows.filter((r) => String(r.props[dateProp] ?? "").slice(0, 10) === iso) };
  });

  return (
    <div>
      <MonoLabel>
        {now.toLocaleString(undefined, { month: "long", year: "numeric" })}
      </MonoLabel>
      <div className="mt-4 grid grid-cols-7 gap-px bg-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-paper px-2 py-2 font-mono text-[10px] text-mute">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div key={i} className="min-h-24 bg-paper p-2">
            {c && (
              <>
                <div className="font-mono text-[10px] text-mute">{c.day}</div>
                {c.items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="klever-focus mt-1 flex w-full items-center gap-1 truncate rounded-md text-left text-xs hover:opacity-70"
                    onClick={() => setView({ kind: "note", id: n.id })}
                    onContextMenu={(e) => open(e, noteMenuItems(n))}
                    onKeyDown={(e) =>
                      contextMenuFromKey(e, (ev) => open(ev, noteMenuItems(n)))
                    }
                  >
                    {n.icon ? <NoteIcon icon={n.icon} size={12} className="shrink-0 text-faint" /> : null}
                    <span className="truncate">{n.title}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function parseDay(raw: unknown): number | null {
  const s = String(raw ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s + "T12:00:00");
  return Number.isFinite(t) ? t : null;
}

function TimelineView({
  rows,
  dateProp,
  endDateProp,
}: {
  rows: Note[];
  dateProp: string;
  endDateProp?: string;
}) {
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const items = rows
    .map((n) => {
      const start = parseDay(n.props[dateProp]);
      if (start == null) return null;
      const end = endDateProp ? parseDay(n.props[endDateProp]) ?? start : start;
      return { note: n, start, end: Math.max(end, start) };
    })
    .filter((x): x is { note: Note; start: number; end: number } => Boolean(x))
    .sort((a, b) => a.start - b.start);

  if (!items.length) {
    return (
      <p className="font-mono text-[12px] text-mute">
        No dated rows. Set a date property on rows to see the timeline.
      </p>
    );
  }

  const min = Math.min(...items.map((i) => i.start));
  const max = Math.max(...items.map((i) => i.end));
  const span = Math.max(max - min, 86400000);
  const dayMs = 86400000;
  const days = Math.ceil(span / dayMs) + 1;

  return (
    <div className="overflow-x-auto">
      <MonoLabel>
        {new Date(min).toLocaleDateString()} — {new Date(max).toLocaleDateString()} · {days}d
      </MonoLabel>
      <div className="mt-3 min-w-[640px] space-y-2">
        {items.map(({ note, start, end }) => {
          const left = ((start - min) / span) * 100;
          const width = Math.max(((end - start + dayMs) / span) * 100, 2);
          return (
            <div key={note.id} className="grid grid-cols-[10rem_1fr] items-center gap-3">
              <button
                type="button"
                className="truncate text-left text-sm hover:opacity-70"
                onClick={() => setView({ kind: "note", id: note.id })}
                onContextMenu={(e) => open(e, noteMenuItems(note))}
              >
                {note.title}
              </button>
              <div className="relative h-7 rounded bg-paper-2">
                <button
                  type="button"
                  className="absolute top-0.5 h-6 rounded-md bg-ink/80 px-2 text-left font-mono text-[10px] text-paper hover:bg-ink"
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: 24 }}
                  onClick={() => setView({ kind: "note", id: note.id })}
                  title={note.title}
                >
                  <span className="truncate">{note.title}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
