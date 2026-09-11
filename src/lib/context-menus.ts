import { noteFolder } from "@/lib/folders";
import { normalizeWorkspaceTools } from "@/lib/workspaces";
import { isEncryptedWorkspace } from "@/lib/workspace-lock";
import {
  eventGoogleHref,
  openExternalCalendar,
  providerOpenHref,
} from "@/lib/calendar-sync";
import { downloadEventIcs } from "@/lib/ics";
import { openOrCreateNotesForEvent } from "@/lib/meetings";
import { schemaTarget, schemaWithItemColor } from "@/lib/prop-schema";
import { useApp } from "@/store";
import type { Note, VaultEvent } from "@/types";
import { wikiDisplayOptions, type WikiDisplay } from "@/lib/wiki-display";
import type { LucideIcon } from "lucide-react";

export type ContextMenuAction = {
  id: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  confirm?: { title: string; description: string; confirmLabel?: string };
  onSelect: () => void;
};

export type ContextMenuSwatches = {
  type: "swatches";
  id: string;
  value?: string;
  onPick: (id: string | undefined) => void;
};

export type ContextMenuItem =
  | ContextMenuAction
  | { type: "sep"; hidden?: boolean }
  | ContextMenuSwatches;

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be blocked */
  }
}

function openNote(note: Note) {
  useApp.getState().setView(
    note.type === "database" ? { kind: "database", id: note.id } : { kind: "note", id: note.id },
  );
}

function deleteConfirm(
  name: string,
  description = "This cannot be undone.",
): NonNullable<ContextMenuAction["confirm"]> {
  return {
    title: `Delete ${name}?`,
    description,
    confirmLabel: "Delete",
  };
}

export function noteMenuItems(note: Note, opts?: { closeTab?: boolean }): ContextMenuItem[] {
  const s = useApp.getState();
  const starred = s.starred.includes(note.id);
  const isDb = note.type === "database";
  const currentId = s.view.kind === "note" || s.view.kind === "database" ? s.view.id : null;
  const onCurrent = currentId === note.id;
  return [
    {
      id: "open",
      label: "Open",
      onSelect: () => openNote(note),
    },
    {
      id: "split-page",
      label: "Split page…",
      hidden: isDb || s.view.kind !== "note" || !onCurrent,
      onSelect: () => s.setPageSplitOpen(true),
    },
    {
      id: "split-left",
      label: "Open left",
      hidden: Boolean(s.split) || !currentId || onCurrent,
      onSelect: () => s.splitPage({ side: "left", withId: note.id, focusIncoming: true }),
    },
    {
      id: "split-right",
      label: "Open right",
      hidden: Boolean(s.split) || !currentId || onCurrent,
      onSelect: () => s.splitPage({ side: "right", withId: note.id, focusIncoming: true }),
    },
    {
      id: "close-split",
      label: "Close split",
      hidden: !s.split,
      onSelect: () => s.closeSplit(),
    },
    {
      id: "star",
      label: starred ? "Unstar" : "Star",
      onSelect: () => s.toggleStar(note.id),
    },
    {
      id: "dup",
      label: "Duplicate",
      hidden: isDb,
      onSelect: () => s.duplicateNote(note.id),
    },
    {
      id: "row",
      label: "New row",
      hidden: !isDb,
      onSelect: () => s.createPage({ parent: note.id, stay: true }),
    },
    { type: "sep" },
    {
      id: "copy-link",
      label: "Copy wikilink",
      onSelect: () => void copyText(`[[${note.title}]]`),
    },
    {
      id: "relate",
      label: "Relate…",
      hidden: isDb,
      onSelect: () => {
        openNote(note);
        s.setRelateNoteId(note.id);
      },
    },
    {
      id: "copy-path",
      label: "Copy path",
      onSelect: () => void copyText(note.path),
    },
    ...moveFolderItems(note),
    {
      id: "close",
      label: "Close",
      hidden: !opts?.closeTab || !s.openTabs.includes(note.id),
      onSelect: () => s.closeOpenTab(note.id),
    },
    {
      id: "close-others",
      label: "Close others",
      hidden: !opts?.closeTab || s.openTabs.length < 2,
      onSelect: () => {
        for (const id of [...s.openTabs]) {
          if (id !== note.id) s.closeOpenTab(id);
        }
      },
    },
    { type: "sep" },
    {
      id: "add-cover",
      label: "Add cover",
      hidden: Boolean(note.cover) || isDb,
      onSelect: () => s.patchNote(note.id, { cover: "#cfc8b8" }),
    },
    {
      id: "delete-cover",
      label: "Delete cover",
      hidden: !note.cover || isDb,
      onSelect: () => s.patchNote(note.id, { cover: undefined }),
    },
    { type: "sep", hidden: isDb },
    {
      id: "delete",
      label: "Delete",
      danger: true,
      confirm: deleteConfirm(
        note.title || "this page",
        "The file is removed from the vault. This cannot be undone.",
      ),
      onSelect: () => s.deleteNote(note.id),
    },
  ];
}

function moveFolderItems(note: Note): ContextMenuItem[] {
  const s = useApp.getState();
  const current = noteFolder(note.path);
  const folders = [...new Set(s.notes.map((n) => noteFolder(n.path)).filter(Boolean))].sort();
  const items: ContextMenuItem[] = [
    {
      id: "move-root",
      label: "Move to vault root",
      hidden: !current,
      onSelect: () => s.moveNoteToFolder(note.id, ""),
    },
  ];
  for (const f of folders.slice(0, 8)) {
    if (f === current) continue;
    items.push({
      id: `move-${f}`,
      label: `Move to ${f}`,
      onSelect: () => s.moveNoteToFolder(note.id, f),
    });
  }
  const visible = items.filter((i) => !("type" in i) && !i.hidden);
  if (!visible.length) return [];
  return [{ type: "sep" }, ...items];
}

export function folderMenuItems(
  path: string,
  ui?: { onRename?: () => void; onChangeIcon?: () => void },
): ContextMenuItem[] {
  const s = useApp.getState();
  const name = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
  const nested = s.notes.filter((n) => n.path.startsWith(`${path}/`)).length;
  return [
    {
      id: "page",
      label: "New page",
      onSelect: () => s.createPage({ folder: path, title: "Untitled" }),
    },
    {
      id: "db",
      label: "New database",
      onSelect: () => s.createDatabase({ folder: path }),
    },
    { type: "sep" },
    {
      id: "rename",
      label: "Rename",
      onSelect: () => ui?.onRename?.(),
    },
    {
      id: "icon",
      label: "Change icon",
      onSelect: () => ui?.onChangeIcon?.(),
    },
    {
      id: "copy-path",
      label: "Copy path",
      onSelect: () => void copyText(path),
    },
    { type: "sep" },
    {
      id: "delete",
      label: "Delete",
      danger: true,
      confirm: deleteConfirm(
        name || "this folder",
        nested
          ? `${nested} page${nested === 1 ? "" : "s"} in this folder will be removed from the vault. This cannot be undone.`
          : "This folder is removed from the vault. This cannot be undone.",
      ),
      onSelect: () => s.deleteFolder(path),
    },
  ];
}

export function propValueMenuItems(note: Note, field: string, item: string): ContextMenuItem[] {
  const s = useApp.getState();
  const host = schemaTarget(note, s.notes);
  const spec = (host.schema ?? []).find((p) => p.key === field);
  const current = spec?.itemColors?.[item];
  return [
    {
      type: "swatches",
      id: `hue-${field}-${item}`,
      value: current,
      onPick: (id) => {
        s.patchNote(host.id, {
          schema: schemaWithItemColor(host.schema ?? [], field, item, id),
        });
      },
    },
    { type: "sep" },
    {
      id: "copy-value",
      label: "Copy",
      onSelect: () => void copyText(item),
    },
  ];
}

export function tagMenuItems(tag: string, opts?: { noteId?: string }): ContextMenuItem[] {
  const s = useApp.getState();
  const note = opts?.noteId ? s.notes.find((n) => n.id === opts.noteId) : undefined;
  return [
    {
      id: "open",
      label: "Open",
      onSelect: () => s.setView({ kind: "tag", tag }),
    },
    {
      id: "page",
      label: "New page with tag",
      onSelect: () => s.createPage({ tags: [tag] }),
    },
    {
      id: "copy",
      label: "Copy tag",
      onSelect: () => void copyText(`#${tag}`),
    },
    {
      id: "remove",
      label: "Remove from page",
      hidden: !note,
      onSelect: () => {
        if (!note) return;
        s.patchNote(note.id, { tags: note.tags.filter((t) => t !== tag) });
      },
    },
  ];
}

export function boardMenuItems(id: string, title: string): ContextMenuItem[] {
  const s = useApp.getState();
  return [
    {
      id: "open",
      label: "Open",
      onSelect: () => s.setView({ kind: "freeform", id }),
    },
    {
      id: "dup",
      label: "Duplicate",
      onSelect: () => duplicateBoard(id),
    },
    { type: "sep" },
    {
      id: "delete",
      label: "Delete",
      danger: true,
      hidden: s.boards.length <= 1,
      confirm: deleteConfirm(
        title || "this board",
        "This board is removed. This cannot be undone.",
      ),
      onSelect: () => s.deleteBoard(id),
    },
  ];
}

export function duplicateBoard(id: string) {
  const s = useApp.getState();
  const src = s.boards.find((b) => b.id === id);
  if (!src) return;
  s.createBoard(`${src.title.replace(/\s+copy$/, "")} copy`);
  useApp.getState().setBoard({
    objects: src.objects.map((o) => structuredClone(o)),
    connections: src.connections?.map((c) => structuredClone(c)),
    dotted: src.dotted,
    camera: structuredClone(src.camera),
  });
}

export function eventMenuItems(event: VaultEvent, onOpen?: () => void): ContextMenuItem[] {
  const s = useApp.getState();
  const source = event.sourceId ? s.calendarSources.find((c) => c.id === event.sourceId) : undefined;
  const googleHref = eventGoogleHref(event, source);
  const appleHref = event.sourceKind === "apple" && source ? providerOpenHref(source) : null;
  return [
    {
      id: "open",
      label: "Open",
      hidden: !onOpen,
      onSelect: () => onOpen?.(),
    },
    {
      id: "notes",
      label: "Take notes",
      onSelect: () => openOrCreateNotesForEvent(event),
    },
    {
      id: "google",
      label: "Open in Google Calendar",
      hidden: !googleHref,
      onSelect: () => googleHref && openExternalCalendar(googleHref),
    },
    {
      id: "apple-open",
      label: "Open in Apple Calendar",
      hidden: !appleHref,
      onSelect: () => appleHref && openExternalCalendar(appleHref),
    },
    {
      id: "apple-ics",
      label: "Add to Apple Calendar",
      hidden: Boolean(event.sourceId),
      onSelect: () => downloadEventIcs(event),
    },
    {
      id: "copy",
      label: "Copy title",
      onSelect: () => void copyText(event.title),
    },
    { type: "sep" },
    {
      id: "delete",
      label: event.sourceId ? "Hide locally" : "Delete",
      danger: true,
      confirm: deleteConfirm(
        event.title || "this event",
        event.sourceId
          ? "Removed from Klever only. The event stays on the remote calendar."
          : "This local event is removed from the calendar. This cannot be undone.",
      ),
      onSelect: () => s.deleteEvent(event.id),
    },
  ];
}

export function wikiMenuItems(
  target: string,
  hit?: Note | null,
  opts?: {
    display?: WikiDisplay;
    onDisplay?: (display: WikiDisplay) => void;
  },
): ContextMenuItem[] {
  const s = useApp.getState();
  const displayItems: ContextMenuItem[] = opts?.onDisplay
    ? [
        ...wikiDisplayOptions().map((o) => ({
          id: `display-${o.value}`,
          label: o.label,
          hint: opts.display === o.value ? "●" : undefined,
          onSelect: () => opts.onDisplay!(o.value),
        })),
        { type: "sep" as const },
      ]
    : [];
  if (hit) return [...displayItems, ...noteMenuItems(hit)];
  return [
    ...displayItems,
    {
      id: "create",
      label: `Create “${target}”`,
      onSelect: () => {
        const id = s.createPage({ title: target });
        s.setView({ kind: "note", id });
      },
    },
    {
      id: "copy",
      label: "Copy wikilink",
      onSelect: () => void copyText(`[[${target}]]`),
    },
  ];
}

export function appMenuItems(): ContextMenuItem[] {
  const s = useApp.getState();
  if (!s.ready || s.view.kind === "welcome") return [];
  const tools = normalizeWorkspaceTools(
    s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.tools,
  );
  return [
    { id: "page", label: "New page", hint: "⌘N", onSelect: () => s.createPage() },
    { id: "today", label: "Today", hint: "⌘⇧T", onSelect: () => s.createDaily() },
    {
      id: "command",
      label: "Command palette",
      hint: "⌘K",
      onSelect: () => s.setCommandOpen(true),
    },
    { type: "sep" },
    {
      id: "calendar",
      label: "Calendar",
      hidden: !tools.calendar,
      onSelect: () => s.setView({ kind: "calendar" }),
    },
    {
      id: "meeting",
      label: "Meetings",
      hint: "⌘⇧M",
      hidden: !tools.meeting,
      onSelect: () => s.setView({ kind: "meeting" }),
    },
    {
      id: "graph",
      label: "Graph",
      hidden: !tools.graph,
      onSelect: () => s.setView({ kind: "graph" }),
    },
    {
      id: "lock",
      label: "Lock workspace",
      hidden: !isEncryptedWorkspace(s.workspaces.find((w) => w.id === s.activeWorkspaceId)) || !s.unlocked,
      onSelect: () => void s.lockWorkspace(),
    },
    {
      id: "sidebar",
      label: s.sidebarOpen ? "Hide sidebar" : "Show sidebar",
      hint: "⌘\\",
      onSelect: () => s.toggleSidebar(),
    },
  ];
}
