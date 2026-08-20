import { Kbd, Overlay, Panel } from "@/components/ui";
import { Database, FileText, NoteIcon, noteKindIcon } from "@/lib/chrome-icons";
import { searchNotes, searchSnippet } from "@/lib/search";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import type { Note } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  FolderOpen,
  LayoutDashboard,
  Moon,
  Network,
  NotebookPen,
  Save,
  Search,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function CommandPalette() {
  const open = useApp((s) => s.commandOpen);
  const setOpen = useApp((s) => s.setCommandOpen);
  const notes = useApp((s) => s.notes);
  const setView = useApp((s) => s.setView);
  const createPage = useApp((s) => s.createPage);
  const createDatabase = useApp((s) => s.createDatabase);
  const setDumpOpen = useApp((s) => s.setDumpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setTheme = useApp((s) => s.setTheme);
  const theme = useApp((s) => s.theme);
  const saveToFolder = useApp((s) => s.saveToFolder);
  const openFolder = useApp((s) => s.openFolder);
  const createDaily = useApp((s) => s.createDaily);
  const boards = useApp((s) => s.boards);
  const createBoard = useApp((s) => s.createBoard);
  const recents = useApp((s) => s.recents);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const tools =
    workspaces.find((w) => w.id === activeWorkspaceId)?.tools ?? defaultWorkspaceTools();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo(() => {
    type Action = {
      id: string;
      label: string;
      run: () => void;
      hint?: string;
      icon: LucideIcon | typeof FileText;
    };
    const list: Action[] = [
      { id: "new", label: "New note", run: () => void createPage(), hint: "⌘N", icon: FileText },
      { id: "daily", label: "Today's note", run: () => void createDaily(), hint: "⌘⇧T", icon: NotebookPen },
      { id: "db", label: "New database", run: () => void createDatabase(), icon: Database },
    ];
    if (tools.graph) {
      list.push({
        id: "graph",
        label: "Open graph",
        run: () => setView({ kind: "graph" }),
        hint: "⌘⇧G",
        icon: Network,
      });
    }
    if (tools.calendar) {
      list.push({
        id: "calendar",
        label: "Open calendar",
        run: () => setView({ kind: "calendar" }),
        icon: Calendar,
      });
    }
    if (tools.board) {
      list.push({
        id: "new-board",
        label: "New board",
        run: () => createBoard(),
        icon: LayoutDashboard,
      });
      for (const b of boards) {
        list.push({
          id: `board-${b.id}`,
          label: b.title,
          run: () => setView({ kind: "freeform", id: b.id }),
          icon: LayoutDashboard,
        });
      }
    }
    if (tools.brainDump) {
      list.push({
        id: "dump",
        label: "Brain dump",
        run: () => setDumpOpen(true),
        hint: "⌘⇧D",
        icon: Sparkles,
      });
    }
    list.push(
      { id: "folder", label: "Open folder", run: () => void openFolder(), icon: FolderOpen },
      { id: "save", label: "Save vault to folder", run: () => void saveToFolder(), icon: Save },
      {
        id: "theme",
        label: theme === "dark" ? "Use light theme" : "Use dark theme",
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
        icon: theme === "dark" ? Sun : Moon,
      },
      { id: "settings", label: "AI settings", run: () => setSettingsOpen(true), icon: Settings },
    );
    return list;
  }, [
    createBoard,
    createDaily,
    createDatabase,
    createPage,
    openFolder,
    saveToFolder,
    setDumpOpen,
    setSettingsOpen,
    setTheme,
    setView,
    theme,
    boards,
    tools.board,
    tools.brainDump,
    tools.calendar,
    tools.graph,
  ]);

  const noteHits = (
    q.trim()
      ? searchNotes(notes, q)
      : recents.map((id) => notes.find((n) => n.id === id)).filter((n): n is Note => Boolean(n))
  ).slice(0, 8);
  const actionHits = actions.filter((a) => a.label.toLowerCase().includes(q.trim().toLowerCase()));
  const items: {
    id: string;
    label: string;
    hint?: string;
    run: () => void;
    kind: string;
    icon: LucideIcon;
    pageIcon?: string;
    snippet?: string;
  }[] = [
    ...actionHits.map((a) => ({ ...a, kind: "Action" })),
    ...noteHits.map((n) => ({
      id: "note-" + n.id,
      label: n.title,
      kind: q.trim() ? (n.type === "database" ? "Database" : "Note") : "Recent",
      icon: noteKindIcon(n.type),
      pageIcon: n.icon,
      snippet: q.trim() ? searchSnippet(n.body, q) : undefined,
      run: () =>
        setView(n.type === "database" ? { kind: "database" as const, id: n.id } : { kind: "note" as const, id: n.id }),
    })),
  ];

  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setI(0), [q]);

  if (!open) return null;

  const run = (idx: number) => {
    const item = items[idx];
    if (!item) return;
    item.run();
    setOpen(false);
  };

  return (
    <Overlay onClose={() => setOpen(false)}>
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={15} strokeWidth={1.4} className="text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((x) => Math.min(items.length - 1, x + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(i);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Go somewhere"
            className="w-full bg-transparent py-4 font-serif text-base focus-visible:outline-none"
          />
          <span className="hidden sm:inline-flex">
            <Kbd>ESC</Kbd>
          </span>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {items.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setI(idx)}
                onClick={() => run(idx)}
                className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-2 text-left font-serif text-sm max-md:py-3 ${
                  idx === i ? "border-ink bg-paper-2 text-ink" : "border-transparent text-mute hover:bg-paper-2"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <NoteIcon
                    icon={item.pageIcon}
                    fallback={item.icon}
                    className={idx === i ? "text-ink" : "text-faint"}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {item.snippet && (
                      <span className="block truncate font-mono text-[10px] normal-case tracking-normal text-faint">
                        {item.snippet}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-faint">
                  {item.kind}
                  {item.hint}
                </span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-4 py-6 text-sm text-mute">Nothing here.</li>}
        </ul>
      </Panel>
    </Overlay>
  );
}
