import {
  PropTypeMenu,
  PropertySettings,
  propTypeLabel,
  typeHasOptions,
  typeNeedsExtras,
  useNoteSchema,
} from "@/components/db/PropertyManager";
import { PropInput } from "@/components/editor/PropInput";
import { Chip, ConfirmDialog, IconButton, TextButton } from "@/components/ui";
import { useContextMenu } from "@/components/ContextMenu";
import { tagMenuItems } from "@/lib/context-menus";
import { ChromeIcon, PROP_ICONS, accentIconClass } from "@/lib/chrome-icons";
import { MEETING_INTERNAL_KEYS } from "@/lib/meetings";
import { effectivePropType } from "@/lib/prop-schema";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { Note, PropType } from "@/types";
import { ChevronDown, ChevronUp, Plus, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export function PropertyStrip({ note }: { note: Note }) {
  const t = useT();
  const patchNote = useApp((s) => s.patchNote);
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const {
    schema,
    notes,
    dbs,
    add,
    update,
    setType,
    moveBy,
    duplicate,
    removeProperty,
    wouldLoseValues,
  } = useNoteSchema(note);
  const shown = schema.filter((s) => !s.hidden && !MEETING_INTERNAL_KEYS.has(s.key));
  const shownKeys = shown.map((s) => s.key);
  const [tagDraft, setTagDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const commitTag = () => {
    const v = tagDraft.replace(/^#+/, "").trim();
    if (v && !note.tags.includes(v)) patchNote(note.id, { tags: [...note.tags, v] });
    setTagDraft("");
  };

  const addAndFocus = (type: PropType) => {
    const key = add(type);
    setOpenKey(key);
    setFocusKey(key);
  };

  const requestDelete = (key: string) => {
    if (wouldLoseValues(key)) setPendingDelete(key);
    else removeProperty(key);
  };

  useEffect(() => {
    if (!focusKey) return;
    const el = document.getElementById(`prop-settings-name-${focusKey}`) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    el.select();
    setFocusKey(null);
  }, [focusKey, schema, openKey]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {note.tags.map((tag) => (
          <Chip
            key={tag}
            selected
            tone="tag"
            onClick={() => setView({ kind: "tag", tag })}
            onContextMenu={(e) => open(e, tagMenuItems(tag, { noteId: note.id }))}
            className="font-mono"
          >
            #{tag}
          </Chip>
        ))}
        <input
          value={tagDraft}
          placeholder={t("prop.addTag")}
          aria-label={t("prop.addTag")}
          size={Math.max(8, tagDraft.length + 1)}
          className="klever-focus h-7 w-auto min-w-[4.5rem] rounded-md bg-transparent px-1.5 py-0 font-mono text-[11px] leading-7 text-tag/70 placeholder:leading-7 placeholder:text-tag/35"
          onFocus={() => {
            if (!tagDraft) setTagDraft("#");
          }}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              setTagDraft("#");
              return;
            }
            setTagDraft(`#${raw.replace(/^#+/, "")}`);
          }}
          onBlur={() => {
            if (tagDraft.replace(/^#+/, "").trim() === "") setTagDraft("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTag();
            } else if (e.key === "Escape") {
              setTagDraft("");
              e.currentTarget.blur();
            } else if (e.key === "Backspace" && tagDraft === "#") {
              e.preventDefault();
              setTagDraft("");
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="space-y-0.5">
        {shown.map((s) => {
          const settingsOpen = openKey === s.key;
          const isFirst = shownKeys[0] === s.key;
          const isLast = shownKeys[shownKeys.length - 1] === s.key;
          return (
            <div
              key={s.key}
              className={cn("-mx-1 rounded-xl px-1 py-0.5", settingsOpen && "relative z-20")}
            >
              <div className="grid grid-cols-[auto_minmax(6.5rem,10rem)_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1">
                <PropTypeMenu
                  value={s.type}
                  onPick={(type) => {
                    setType(s, type);
                    if (typeHasOptions(type) || typeNeedsExtras(type)) setOpenKey(s.key);
                  }}
                >
                  {({ open: menuOpen, toggle }) => (
                    <button
                      type="button"
                      aria-label={t("prop.typeAria", { type: propTypeLabel(s.type) })}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      title={t("prop.changeType", { type: propTypeLabel(s.type) })}
                      onClick={toggle}
                      className="klever-focus inline-flex h-8 items-center gap-0.5 rounded-md px-0.5 text-mute hover:bg-paper-2 hover:text-ink"
                    >
                      <ChromeIcon
                        icon={PROP_ICONS[effectivePropType(s)]}
                        className={accentIconClass(effectivePropType(s))}
                      />
                      <ChevronDown size={11} strokeWidth={1.4} className="text-faint" />
                    </button>
                  )}
                </PropTypeMenu>

                <PropertySettings
                  p={s}
                  schema={schema}
                  notes={notes}
                  dbs={dbs}
                  open={settingsOpen}
                  onOpenChange={(next) => setOpenKey(next ? s.key : null)}
                  onChange={(patch) => update(s.key, patch)}
                  onSetType={(type) => {
                    setType(s, type);
                    if (typeHasOptions(type) || typeNeedsExtras(type)) setOpenKey(s.key);
                  }}
                  onDuplicate={() => {
                    const key = duplicate(s.key);
                    if (key) {
                      setOpenKey(key);
                      setFocusKey(key);
                    }
                  }}
                  onDelete={() => requestDelete(s.key)}
                >
                  {({ open: panelOpen, toggle }) => (
                    <button
                      type="button"
                      aria-label={t("prop.editSettings")}
                      aria-haspopup="dialog"
                      aria-expanded={panelOpen}
                      title={t("prop.editSettings")}
                      onClick={toggle}
                      onKeyDown={(e) => {
                        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                        e.preventDefault();
                        moveBy(s.key, e.key === "ArrowUp" ? -1 : 1, shownKeys);
                      }}
                      className={cn(
                        "klever-focus flex min-w-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-left text-sm text-ink hover:bg-paper-2",
                        panelOpen && "bg-paper-2",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <ChevronDown
                        size={12}
                        strokeWidth={1.4}
                        className={cn("shrink-0 text-faint transition-transform duration-150", panelOpen && "rotate-180")}
                      />
                    </button>
                  )}
                </PropertySettings>

                <div className="min-w-0">
                  <PropInput
                    note={note}
                    field={s.key}
                    type={s.type}
                    options={s.options}
                    relationTo={s.relationTo}
                    spec={s}
                  />
                </div>

                <span className="flex items-center">
                  <IconButton
                    aria-label={t("prop.editSettings")}
                    aria-haspopup="dialog"
                    aria-expanded={settingsOpen}
                    active={settingsOpen}
                    className="text-faint hover:text-ink"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setOpenKey(settingsOpen ? null : s.key)}
                  >
                    <Settings2 size={14} strokeWidth={1.4} />
                  </IconButton>
                  <button
                    type="button"
                    aria-label={t("prop.moveUp")}
                    title={t("prop.moveUp")}
                    disabled={isFirst}
                    onClick={() => moveBy(s.key, -1, shownKeys)}
                    className="klever-focus rounded-md p-1 text-faint hover:bg-paper-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronUp size={13} strokeWidth={1.4} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("prop.moveDown")}
                    title={t("prop.moveDown")}
                    disabled={isLast}
                    onClick={() => moveBy(s.key, 1, shownKeys)}
                    className="klever-focus rounded-md p-1 text-faint hover:bg-paper-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronDown size={13} strokeWidth={1.4} />
                  </button>
                  <IconButton
                    aria-label={t("prop.delete")}
                    className="text-faint hover:text-ink"
                    onClick={() => requestDelete(s.key)}
                  >
                    <Trash2 size={14} strokeWidth={1.4} />
                  </IconButton>
                </span>
              </div>
            </div>
          );
        })}

        <PropTypeMenu onPick={addAndFocus}>
          {({ open: menuOpen, toggle }) => (
            <TextButton
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="mt-1 text-prop/80 hover:text-prop"
            >
              <Plus size={13} strokeWidth={1.4} />
              {t("prop.add")}
            </TextButton>
          )}
        </PropTypeMenu>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={t("prop.deleteTitle")}
          description={t("prop.deletePageDesc", {
            name: schema.find((p) => p.key === pendingDelete)?.name ?? t("prop.property"),
          })}
          confirmLabel={t("prop.deleteConfirm")}
          danger
          onConfirm={() => {
            removeProperty(pendingDelete);
            setOpenKey((k) => (k === pendingDelete ? null : k));
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
