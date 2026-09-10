import { ConfirmDialog, GhostButton, IconButton, MonoLabel, Panel, Select, SolidButton, TextButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ChromeIcon, PROP_ICONS, accentIconClass } from "@/lib/chrome-icons";
import { LOCALES, t as tx, propTypeMessageKey, type Locale, type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/use-t";
import {
  nextItemSwatch,
  remapItemColorKey,
  schemaTarget,
  seedItemColors,
  setItemColor,
} from "@/lib/prop-schema";
import { nid } from "@/lib/ids";
import { useApp } from "@/store";
import type { Note, PropType, RollupAgg, SchemaProp } from "@/types";
import { PROP_TYPES, ROLLUP_AGGS } from "@/types";
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, GripVertical, Plus, Settings2, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export { schemaTarget };

function activeLocale(): Locale {
  return useApp.getState().locale;
}

export function propTypeLabel(type: PropType, locale = activeLocale()): string {
  return tx(locale, propTypeMessageKey(type));
}

/** English fallbacks for callers that still read a static map. */
export const PROP_TYPE_LABEL: Record<PropType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
  relation: "Relation",
  people: "People",
  location: "Location",
  tags: "Tags",
  files: "Files",
  formula: "Formula",
  rollup: "Rollup",
};

const PROP_TYPE_GROUP_DEFS: { key: "prop.group.value" | "prop.group.link" | "prop.group.compute"; types: PropType[] }[] = [
  {
    key: "prop.group.value",
    types: [
      "text",
      "number",
      "select",
      "multi_select",
      "date",
      "checkbox",
      "url",
      "people",
      "location",
      "tags",
      "files",
    ],
  },
  { key: "prop.group.link", types: ["relation"] },
  { key: "prop.group.compute", types: ["formula", "rollup"] },
];

/** Display label used as the default property name for a type. */
export function defaultNameForType(type: PropType, locale = activeLocale()): string {
  return propTypeLabel(type, locale);
}

/**
 * Rename when the name is empty, the generic “Property”, or still the previous type’s default.
 * Custom names (e.g. “Interview date”, “Lieu”) are kept.
 */
export function shouldAutoRenameProperty(name: string, previousType: PropType): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  for (const loc of LOCALES) {
    if (trimmed === tx(loc, "prop.property")) return true;
    if (trimmed === propTypeLabel(previousType, loc)) return true;
  }
  return false;
}

function rollupAggLabel(agg: RollupAgg): string {
  const key = `prop.rollup.${agg}` as MessageKey;
  return tx(activeLocale(), key);
}

function isStoredPropValue(v: unknown) {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

export function propertyWouldLoseValues(notes: Note[], schemaNoteId: string, key: string) {
  return notes.some(
    (n) => (n.parent === schemaNoteId || n.id === schemaNoteId) && isStoredPropValue(n.props[key]),
  );
}

export function propTypePatch(p: SchemaProp, type: PropType, schema: SchemaProp[]): Partial<SchemaProp> {
  const rel = schema.find((x) => x.type === "relation");
  const name = shouldAutoRenameProperty(p.name, p.type) ? defaultNameForType(type) : p.name;
  const options =
    type === "select" || type === "multi_select" ? p.options ?? ["Inbox", "Active", "Done"] : undefined;
  return {
    type,
    name,
    options,
    itemColors:
      type === "select" || type === "multi_select" || type === "tags" || type === "people" || type === "location"
        ? seedItemColors(options ?? [], p.itemColors)
        : p.itemColors,
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
  };
}

export function createSchemaProp(type: PropType, schema: SchemaProp[]): SchemaProp {
  const key = `prop_${nid(4)}`;
  const stub: SchemaProp = { key, name: "Property", type: "text" };
  const patch = propTypePatch(stub, type, schema);
  return {
    key,
    name: patch.name ?? defaultNameForType(type),
    type,
    options: patch.options,
    itemColors: patch.itemColors,
    formula: patch.formula,
    rollup: patch.rollup,
    default: patch.default,
  };
}

export function moveSchemaProp(schema: SchemaProp[], fromKey: string, toKey: string): SchemaProp[] {
  if (fromKey === toKey) return schema;
  const i = schema.findIndex((p) => p.key === fromKey);
  const j = schema.findIndex((p) => p.key === toKey);
  if (i < 0 || j < 0) return schema;
  const next = [...schema];
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

const EMPTY_SCHEMA: SchemaProp[] = [];

export function useNoteSchema(note: Note) {
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const deleteProperty = useApp((s) => s.deleteProperty);
  const target = schemaTarget(note, notes);
  const schema = target.schema ?? EMPTY_SCHEMA;
  const dbs = notes.filter((n) => n.type === "database" && n.id !== target.id);

  const setSchema = (next: SchemaProp[]) => patchNote(target.id, { schema: next });

  const add = (type: PropType = "text") => {
    const prop = createSchemaProp(type, schema);
    setSchema([...schema, prop]);
    return prop.key;
  };

  const update = (key: string, patch: Partial<SchemaProp>) => {
    setSchema(schema.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const setType = (p: SchemaProp, type: PropType) => {
    if (p.type === type) return;
    update(p.key, propTypePatch(p, type, schema));
  };

  const moveTo = (fromKey: string, toKey: string) => {
    setSchema(moveSchemaProp(schema, fromKey, toKey));
  };

  const moveBy = (key: string, dir: -1 | 1, keys = schema.map((p) => p.key)) => {
    const i = keys.findIndex((k) => k === key);
    const dest = keys[i + dir];
    if (!dest) return;
    moveTo(key, dest);
  };

  const duplicate = (key: string) => {
    const p = schema.find((x) => x.key === key);
    if (!p) return null;
    const nextKey = `${p.key}_${nid(3)}`;
    const i = schema.findIndex((x) => x.key === key);
    const next = [...schema];
    next.splice(i + 1, 0, { ...p, key: nextKey, name: `${p.name} copy` });
    setSchema(next);
    return nextKey;
  };

  const removeProperty = (key: string) => {
    deleteProperty(target.id, key);
  };

  const wouldLoseValues = (key: string) => propertyWouldLoseValues(notes, target.id, key);

  return {
    notes,
    target,
    schema,
    dbs,
    add,
    update,
    setType,
    moveTo,
    moveBy,
    duplicate,
    removeProperty,
    wouldLoseValues,
  };
}

export function PropTypeMenu({
  value,
  onPick,
  align = "left",
  children,
}: {
  value?: PropType;
  onPick: (type: PropType) => void;
  align?: "left" | "right";
  children: (opts: { open: boolean; toggle: () => void }) => ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {children({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          aria-label={t("prop.typeMenu")}
          className={cn(
            "absolute z-30 mt-1 max-h-[min(24rem,70vh)] min-w-[12.5rem] overflow-y-auto rounded-md border border-line bg-paper py-1 shadow-md",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {PROP_TYPE_GROUP_DEFS.map((g) => (
            <div key={g.key}>
              <p className="px-3 pt-1.5 pb-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                {t(g.key)}
              </p>
              {g.types
                .filter((type) => PROP_TYPES.includes(type))
                .map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "klever-focus flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                      value === type ? "bg-paper-2 text-ink" : "text-mute hover:bg-paper-2 hover:text-ink",
                    )}
                    onClick={() => {
                      onPick(type);
                      setOpen(false);
                    }}
                  >
                    <ChromeIcon icon={PROP_ICONS[type]} className={accentIconClass(type)} />
                    {propTypeLabel(type)}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PropertyManager({ note, onClose }: { note: Note; onClose: () => void }) {
  const t = useT();
  const {
    schema,
    notes,
    dbs,
    target,
    add,
    update,
    setType,
    moveTo,
    moveBy,
    duplicate,
    removeProperty,
    wouldLoseValues,
  } = useNoteSchema(note);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const titleId = useId();
  const showVisibility = target.type === "database";

  const addAndFocus = (type: PropType) => {
    const key = add(type);
    setFocusKey(key);
    setOpenKey(typeHasOptions(type) ? key : null);
  };

  const requestDelete = (key: string) => {
    if (wouldLoseValues(key)) setPendingDelete(key);
    else removeProperty(key);
  };

  useEffect(() => {
    if (!focusKey) return;
    const el = document.getElementById(`prop-name-${focusKey}`) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    el.select();
    setFocusKey(null);
  }, [focusKey, schema]);

  return (
    <>
      <section className="rounded-2xl border border-line bg-paper" aria-labelledby={titleId}>
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 id={titleId} className="font-serif text-xl font-semibold tracking-tight text-ink">
              {t("prop.properties")}
            </h2>
            <GhostButton onClick={onClose}>{t("prop.done")}</GhostButton>
          </header>

          <div className="px-3 py-2">
            {schema.length === 0 ? (
              <div className="px-2 py-10 text-center">
                <p className="text-sm text-mute">{t("prop.empty")}</p>
                <p className="mt-1 text-sm text-faint">{t("prop.emptyHint")}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {schema.map((p, i) => {
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
                        open && "relative z-20 border-line bg-paper-2/60",
                        dragging === p.key && "opacity-40",
                        overKey === p.key && dragging && dragging !== p.key && "border-ink/30 bg-paper-2",
                      )}
                    >
                      <div className="group/row grid grid-cols-[1.5rem_auto_minmax(0,1fr)_auto] items-center gap-1 px-1 py-1">
                        <span
                          draggable
                          aria-label={t("prop.dragReorder")}
                          title={t("prop.dragReorder")}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", p.key);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging(p.key);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setOverKey(null);
                          }}
                          className="klever-focus flex h-8 w-6 cursor-grab items-center justify-center rounded-md text-faint transition-colors duration-150 hover:bg-paper-2 hover:text-ink active:cursor-grabbing"
                        >
                          <GripVertical size={14} strokeWidth={1.4} />
                        </span>

                        <PropTypeMenu
                          value={p.type}
                          onPick={(type) => {
                            setType(p, type);
                            if (typeHasOptions(type)) setOpenKey(p.key);
                          }}
                        >
                          {({ open: menuOpen, toggle }) => (
                            <button
                              type="button"
                              aria-label={t("prop.typeAria", { type: propTypeLabel(p.type) })}
                              aria-haspopup="menu"
                              aria-expanded={menuOpen}
                              title={t("prop.changeType", { type: propTypeLabel(p.type) })}
                              onClick={toggle}
                              className="klever-focus inline-flex h-8 items-center gap-1 rounded-md px-1 text-mute hover:bg-paper-2 hover:text-ink"
                            >
                              <ChromeIcon icon={PROP_ICONS[p.type]} className={accentIconClass(p.type)} />
                              <ChevronDown size={12} strokeWidth={1.4} className="text-faint" />
                            </button>
                          )}
                        </PropTypeMenu>

                        <input
                          id={`prop-name-${p.key}`}
                          value={p.name}
                          aria-label={t("prop.name")}
                          title="⌥↑ ⌥↓ to reorder"
                          onChange={(e) => update(p.key, { name: e.target.value })}
                          onBlur={() => {
                            if (!p.name.trim()) update(p.key, { name: defaultNameForType(p.type) });
                          }}
                          onKeyDown={(e) => {
                            if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                            e.preventDefault();
                            moveBy(p.key, e.key === "ArrowUp" ? -1 : 1);
                          }}
                          className="min-w-0 rounded-lg bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-faint hover:bg-paper-2 focus-visible:bg-paper-2 klever-focus"
                        />

                        <span className="flex items-center">
                          <IconButton
                            aria-label="Move up"
                            title="Move up"
                            disabled={i === 0}
                            onClick={() => moveBy(p.key, -1)}
                          >
                            <ChevronUp size={14} strokeWidth={1.4} />
                          </IconButton>
                          <IconButton
                            aria-label="Move down"
                            title="Move down"
                            disabled={i === schema.length - 1}
                            onClick={() => moveBy(p.key, 1)}
                          >
                            <ChevronDown size={14} strokeWidth={1.4} />
                          </IconButton>
                          {showVisibility && (
                            <IconButton
                              aria-label={p.hidden ? "Show in views" : "Hide from views"}
                              title={p.hidden ? "Hidden from table and board views" : "Visible in views"}
                              active={Boolean(p.hidden)}
                              onClick={() => update(p.key, { hidden: p.hidden ? undefined : true })}
                            >
                              {p.hidden ? (
                                <EyeOff size={14} strokeWidth={1.4} />
                              ) : (
                                <Eye size={14} strokeWidth={1.4} />
                              )}
                            </IconButton>
                          )}
                          <PropertySettings
                            p={p}
                            schema={schema}
                            notes={notes}
                            dbs={dbs}
                            open={open}
                            onOpenChange={(next) => setOpenKey(next ? p.key : null)}
                            onChange={(patch) => update(p.key, patch)}
                            onSetType={(type) => setType(p, type)}
                            onDuplicate={() => {
                              const key = duplicate(p.key);
                              if (key) {
                                setOpenKey(key);
                                setFocusKey(key);
                              }
                            }}
                            onDelete={() => requestDelete(p.key)}
                            align="right"
                            includeComputeExtras={false}
                          >
                            {({ open: settingsOpen, toggle }) => (
                              <IconButton
                                aria-label={t("prop.editSettings")}
                                aria-haspopup="dialog"
                                aria-expanded={settingsOpen}
                                active={settingsOpen}
                                onClick={toggle}
                              >
                                <Settings2 size={14} strokeWidth={1.4} />
                              </IconButton>
                            )}
                          </PropertySettings>
                          <IconButton aria-label={t("prop.delete")} onClick={() => requestDelete(p.key)}>
                            <Trash2 size={14} strokeWidth={1.4} />
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="flex shrink-0 items-center border-t border-line px-4 py-3">
            <PropTypeMenu onPick={addAndFocus}>
              {({ open, toggle }) =>
                schema.length === 0 ? (
                  <SolidButton onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
                    <Plus size={14} strokeWidth={1.4} />
                    {t("prop.add")}
                  </SolidButton>
                ) : (
                  <TextButton onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
                    <Plus size={14} strokeWidth={1.4} />
                    {t("prop.add")}
                  </TextButton>
                )
              }
            </PropTypeMenu>
          </footer>
        </section>
      {pendingDelete && (
        <ConfirmDialog
          title={t("prop.deleteTitle")}
          description={t("prop.deleteRowsDesc", {
            name: schema.find((p) => p.key === pendingDelete)?.name ?? t("prop.property"),
          })}
          confirmLabel={t("prop.deleteConfirm")}
          onConfirm={() => {
            removeProperty(pendingDelete);
            setOpenKey((k) => (k === pendingDelete ? null : k));
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

export function typeHasOptions(type: PropType) {
  return type === "select" || type === "multi_select";
}

/** Relation / formula / rollup still show extra editors on the row. Options live in the settings panel. */
export function typeNeedsExtras(type: PropType) {
  return type === "relation" || type === "formula" || type === "rollup";
}

export function PropertySettings({
  p,
  schema,
  notes,
  dbs,
  open,
  onOpenChange,
  onChange,
  onSetType,
  onDuplicate,
  onDelete,
  align = "left",
  includeComputeExtras = true,
  children,
}: {
  p: SchemaProp;
  schema: SchemaProp[];
  notes: Note[];
  dbs: Note[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<SchemaProp>) => void;
  onSetType: (type: PropType) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  align?: "left" | "right";
  /** Formula / relation / rollup editors. Off when those already show on the row. */
  includeComputeExtras?: boolean;
  children: (opts: { open: boolean; toggle: () => void }) => ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const nameId = `prop-settings-name-${p.key}`;
  const showDefault =
    p.type !== "files" && p.type !== "relation" && p.type !== "formula" && p.type !== "rollup";

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onOpenChangeRef.current(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      onOpenChangeRef.current(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 overflow-visible">
      {children({ open, toggle: () => onOpenChange(!open) })}
      {open && (
        <Panel
          role="dialog"
          aria-label={t("prop.settings")}
          className={cn(
            "absolute z-40 mt-1 w-[min(20.5rem,calc(100vw-2rem))] p-3",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="flex flex-col gap-3">
            <label className="block">
              <MonoLabel>{t("prop.name")}</MonoLabel>
              <input
                id={nameId}
                value={p.name}
                aria-label={t("prop.name")}
                onChange={(e) => onChange({ name: e.target.value })}
                onBlur={() => {
                  if (!p.name.trim()) onChange({ name: defaultNameForType(p.type) });
                }}
                className="mt-1 w-full rounded-lg bg-paper-2/60 px-2 py-1.5 text-sm text-ink placeholder:text-faint klever-focus"
              />
            </label>

            <div>
              <MonoLabel>{t("prop.typeMenu")}</MonoLabel>
              <div className="mt-1">
                <PropTypeMenu value={p.type} onPick={onSetType}>
                  {({ open: menuOpen, toggle }) => (
                    <button
                      type="button"
                      aria-label={t("prop.typeAria", { type: propTypeLabel(p.type) })}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      title={t("prop.changeType", { type: propTypeLabel(p.type) })}
                      onClick={toggle}
                      className="klever-focus inline-flex h-8 w-full items-center gap-2 rounded-lg bg-paper-2/60 px-2 text-sm text-ink hover:bg-paper-2"
                    >
                      <ChromeIcon icon={PROP_ICONS[p.type]} className={accentIconClass(p.type)} />
                      <span className="flex-1 text-left">{propTypeLabel(p.type)}</span>
                      <ChevronDown size={12} strokeWidth={1.4} className="text-faint" />
                    </button>
                  )}
                </PropTypeMenu>
              </div>
            </div>

            {typeHasOptions(p.type) && (
              <OptionsEditor
                options={p.options ?? []}
                itemColors={p.itemColors}
                onChange={(options, itemColors) => onChange({ options, itemColors })}
              />
            )}

            {includeComputeExtras && typeNeedsExtras(p.type) && (
              <TypeExtras p={p} schema={schema} notes={notes} dbs={dbs} onChange={onChange} />
            )}

            <label className="block">
              <MonoLabel>{t("prop.hint")}</MonoLabel>
              <input
                value={p.description ?? ""}
                placeholder={t("prop.hintPlaceholder")}
                onChange={(e) => onChange({ description: e.target.value || undefined })}
                className="mt-1 w-full rounded-lg bg-paper-2/60 px-2 py-1.5 text-sm text-ink placeholder:text-faint klever-focus"
              />
            </label>

            {showDefault && (
              <label className="block">
                <MonoLabel>{t("prop.default")}</MonoLabel>
                <input
                  value={p.default === undefined || p.default === null ? "" : String(p.default)}
                  placeholder={t("prop.defaultEmpty")}
                  onChange={(e) => onChange({ default: e.target.value || undefined })}
                  className="mt-1 w-full rounded-lg bg-paper-2/60 px-2 py-1.5 text-sm text-ink placeholder:text-faint klever-focus"
                />
              </label>
            )}

            {(onDuplicate || onDelete) && (
              <div className="flex flex-wrap gap-1 border-t border-line/70 pt-2">
                {onDuplicate && (
                  <TextButton onClick={onDuplicate}>
                    <Copy size={13} strokeWidth={1.4} />
                    {t("prop.duplicate")}
                  </TextButton>
                )}
                {onDelete && (
                  <TextButton onClick={onDelete}>
                    <Trash2 size={13} strokeWidth={1.4} />
                    {t("prop.deleteAction")}
                  </TextButton>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function TypeExtras({
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
          className="mt-1 w-full resize-y rounded-lg bg-paper px-2 py-1.5 font-mono text-[12px] leading-5 text-ink klever-focus"
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
              {rollupAggLabel(a)}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

function OptionsEditor({
  options,
  itemColors,
  onChange,
}: {
  options: string[];
  itemColors?: Record<string, string>;
  onChange: (options: string[], itemColors?: Record<string, string>) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const draftRef = useRef<HTMLInputElement | null>(null);

  const commitDraft = () => {
    const v = draft.trim();
    if (v && !options.includes(v)) {
      onChange([...options, v], setItemColor(itemColors, v, nextItemSwatch(itemColors)));
    }
    setDraft("");
  };

  const moveBy = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    onChange(next);
  };

  const moveTo = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= options.length || to >= options.length) return;
    const next = [...options];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div>
      <MonoLabel>{t("prop.options")}</MonoLabel>
      <ul className="mt-2 flex max-h-[min(14rem,40vh)] flex-col gap-0.5 overflow-y-auto">
        {options.map((o, i) => (
          <li
            key={i}
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("text/plain");
              const from = raw ? Number(raw) : dragging;
              if (from !== null && !Number.isNaN(from)) moveTo(from, i);
              setDragging(null);
              setOverIndex(null);
            }}
            className={cn(
              "flex items-center gap-0.5 rounded-lg border border-transparent bg-paper-2/50 px-0.5 py-0.5",
              dragging === i && "opacity-40",
              overIndex === i && dragging !== null && dragging !== i && "border-ink/30 bg-paper-2",
            )}
          >
            <span
              draggable
              aria-label={t("prop.dragReorder")}
              title={t("prop.dragReorder")}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(i));
                e.dataTransfer.effectAllowed = "move";
                setDragging(i);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOverIndex(null);
              }}
              className="klever-focus flex h-7 w-5 cursor-grab items-center justify-center rounded-md text-faint hover:bg-paper hover:text-ink active:cursor-grabbing"
            >
              <GripVertical size={12} strokeWidth={1.4} />
            </span>
            <input
              value={o}
              aria-label={t("prop.optionN", { n: i + 1 })}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                onChange(next, remapItemColorKey(itemColors, o, e.target.value));
              }}
              onBlur={() => {
                const trimmed = options.map((x) => x.trim()).filter(Boolean);
                onChange(trimmed, itemColors);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  draftRef.current?.focus();
                }
                if (e.key === "Backspace" && o === "") {
                  onChange(
                    options.filter((_, j) => j !== i),
                    setItemColor(itemColors, o, undefined),
                  );
                }
              }}
              className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 font-mono text-[12px] text-ink klever-focus"
            />
            <button
              type="button"
              aria-label={t("prop.moveUp")}
              title={t("prop.moveUp")}
              disabled={i === 0}
              onClick={() => moveBy(i, -1)}
              className="klever-focus rounded-md p-1 text-faint hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronUp size={12} strokeWidth={1.4} />
            </button>
            <button
              type="button"
              aria-label={t("prop.moveDown")}
              title={t("prop.moveDown")}
              disabled={i === options.length - 1}
              onClick={() => moveBy(i, 1)}
              className="klever-focus rounded-md p-1 text-faint hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronDown size={12} strokeWidth={1.4} />
            </button>
            <button
              type="button"
              aria-label={t("prop.removeOption", { name: o.trim() || t("prop.optionN", { n: i + 1 }) })}
              className="klever-focus rounded-md px-1.5 py-0.5 font-mono text-[12px] text-faint hover:text-ink"
              onClick={() =>
                onChange(
                  options.filter((_, j) => j !== i),
                  setItemColor(itemColors, o, undefined),
                )
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={draftRef}
        value={draft}
        placeholder={t("prop.addOption")}
        aria-label={t("prop.addOption")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
          }
        }}
        className="mt-1.5 w-full rounded-lg bg-paper-2/60 px-2 py-1.5 font-mono text-[12px] text-ink placeholder:text-faint klever-focus"
      />
    </div>
  );
}
