import { normalizeWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import type { Note, VaultEvent } from "@/types";
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

export type ContextMenuItem = ContextMenuAction | { type: "sep" };

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

function deleteConfirm(name: string): NonNullable<Extract<ContextMenuItem, { id: string }>["confirm"]> {
  return {
    title: `Delete ${name}?`,
    description: "This cannot be undone.",
    confirmLabel: "Delete",
  };
}

export function noteMenuItems(note: Note, opts?: { closeTab?: boolean }): ContextMenuItem[] {
  const s = useApp.getState();
  const starred = s.starred.includes(note.id);
  const isDb = note.type === "database";
  return [
    {
      id: "open",
      label: "Open",
      onSelect: () => openNote(note),
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
      id: "copy-path",
      label: "Copy path",
      onSelect: () => void copyText(note.path),
    },
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
      id: "delete",
      label: "Delete",
      danger: true,
      confirm: deleteConfirm(note.title || "this page"),
      onSelect: () => s.deleteNote(note.id),
    },
  ];
}

export function folderMenuItems(path: string): ContextMenuItem[] {
  const s = useApp.getState();
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
      id: "copy-path",
      label: "Copy path",
      onSelect: () => void copyText(path),
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
      confirm: deleteConfirm(title || "this board"),
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
  return [
    {
      id: "open",
      label: "Open",
      hidden: !onOpen,
      onSelect: () => onOpen?.(),
    },
    {
      id: "copy",
      label: "Copy title",
      onSelect: () => void copyText(event.title),
    },
    { type: "sep" },
    {
      id: "delete",
      label: "Delete",
      danger: true,
      confirm: deleteConfirm(event.title || "this event"),
      onSelect: () => s.deleteEvent(event.id),
    },
  ];
}

export function wikiMenuItems(target: string, hit?: Note | null): ContextMenuItem[] {
  const s = useApp.getState();
  if (hit) return noteMenuItems(hit);
  return [
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
      id: "graph",
      label: "Graph",
      hidden: !tools.graph,
      onSelect: () => s.setView({ kind: "graph" }),
    },
    {
      id: "sidebar",
      label: s.sidebarOpen ? "Hide sidebar" : "Show sidebar",
      hint: "⌘\\",
      onSelect: () => s.toggleSidebar(),
    },
  ];
}
