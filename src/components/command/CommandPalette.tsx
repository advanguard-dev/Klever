import { Kbd, Overlay, Panel } from "@/components/ui";
import { Database, FileText, NoteIcon, noteKindIcon } from "@/lib/chrome-icons";
import { searchNotes, searchSnippet } from "@/lib/search";
import { createMeetingNote } from "@/lib/meetings";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { isEncryptedWorkspace } from "@/lib/workspace-lock";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { Note } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  Calendar,
  FolderOpen,
  FileUp,
  LayoutDashboard,
  Library,
  Lock,
  Columns2,
  Scissors,
  Moon,
  Network,
  NotebookPen,
  Save,
  Search,
  Settings,
  Sparkles,
  Sprout,
  Sun,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export function CommandPalette() {
  const t = useT();
  const open = useApp((s) => s.commandOpen);
  const setOpen = useApp((s) => s.setCommandOpen);
  const notes = useApp((s) => s.notes);
  const semanticSearch = useApp((s) => s.dev.semanticSearch);
  const setView = useApp((s) => s.setView);
  const createPage = useApp((s) => s.createPage);
  const createDatabase = useApp((s) => s.createDatabase);
  const setDumpOpen = useApp((s) => s.setDumpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setTheme = useApp((s) => s.setTheme);
  const theme = useApp((s) => s.theme);
  const saveToFolder = useApp((s) => s.saveToFolder);
  const openFolder = useApp((s) => s.openFolder);
  const importMarkdown = useApp((s) => s.importMarkdown);
  const createDaily = useApp((s) => s.createDaily);
  const startGraphFixture = useApp((s) => s.startGraphFixture);
  const closeSplit = useApp((s) => s.closeSplit);
  const setPageSplitOpen = useApp((s) => s.setPageSplitOpen);
  const split = useApp((s) => s.split);
  const view = useApp((s) => s.view);
  const boards = useApp((s) => s.boards);
  const createBoard = useApp((s) => s.createBoard);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const recents = useApp((s) => s.recents);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const lockWorkspace = useApp((s) => s.lockWorkspace);
  const unlocked = useApp((s) => s.unlocked);
  const tools =
    workspaces.find((w) => w.id === activeWorkspaceId)?.tools ?? defaultWorkspaceTools();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (id: string) => `${listId}-${id}`;

  const actions = useMemo(() => {
    type Action = {
      id: string;
      label: string;
      run: () => void;
      hint?: string;
      icon: LucideIcon | typeof FileText;
    };
    const list: Action[] = [
      { id: "new", label: t("cmd.newPage"), run: () => void createPage(), hint: "⌘N", icon: FileText },
      {
        id: "starters",
        label: t("cmd.starters"),
        run: () => setPlusOpen(true, "sidebar"),
        icon: Library,
      },
      { id: "daily", label: t("cmd.daily"), run: () => void createDaily(), hint: "⌘⇧T", icon: NotebookPen },
      { id: "db", label: t("cmd.newDatabase"), run: () => void createDatabase(), icon: Database },
    ];
    if (view.kind === "note" && !split) {
      list.push({
        id: "split-page",
        label: t("cmd.splitPage"),
        run: () => setPageSplitOpen(true),
        icon: Scissors,
      });
    }
    if (split) {
      list.push({
        id: "close-split",
        label: t("cmd.closeSplit"),
        run: () => closeSplit(),
        icon: Columns2,
      });
    }
    if (tools.graph) {
      list.push({
        id: "graph",
        label: t("cmd.openGraph"),
        run: () => setView({ kind: "graph" }),
        hint: "⌘⇧G",
        icon: Network,
      });
    }
    if (tools.calendar) {
      list.push({
        id: "calendar",
        label: t("cmd.openCalendar"),
        run: () => setView({ kind: "calendar" }),
        icon: Calendar,
      });
    }
    if (tools.meeting) {
      list.push({
        id: "meeting",
        label: t("cmd.openMeetings"),
        run: () => setView({ kind: "meeting" }),
        hint: "⌘⇧M",
        icon: AudioLines,
      });
      list.push({
        id: "new-meeting",
        label: t("cmd.newMeeting"),
        run: () => createMeetingNote(),
        icon: AudioLines,
      });
    }
    if (tools.board) {
      list.push({
        id: "new-board",
        label: t("cmd.newBoard"),
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
        label: t("cmd.brainDump"),
        run: () => setDumpOpen(true),
        hint: "⌘⇧D",
        icon: Sparkles,
      });
    }
    if (isEncryptedWorkspace(activeWorkspace) && unlocked) {
      list.push({
        id: "lock",
        label: t("cmd.lockWorkspace"),
        run: () => void lockWorkspace(),
        icon: Lock,
      });
    }
    if (!isEncryptedWorkspace(activeWorkspace)) {
      list.push(
        { id: "folder", label: t("cmd.openFolder"), run: () => void openFolder(), icon: FolderOpen },
        { id: "import", label: t("cmd.importMarkdown"), run: () => void importMarkdown(), icon: FileUp },
        { id: "save", label: t("cmd.saveVault"), run: () => void saveToFolder(), icon: Save },
      );
    }
    list.push(
      {
        id: "theme",
        label: theme === "dark" ? t("shell.useLight") : t("shell.useDark"),
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
        icon: theme === "dark" ? Sun : Moon,
      },
      { id: "settings", label: t("cmd.settings"), run: () => setSettingsOpen(true), icon: Settings },
    );
    if (import.meta.env.DEV) {
      list.push({
        id: "orchard",
        label: t("cmd.openOrchard"),
        run: () => void startGraphFixture(),
        icon: Sprout,
      });
    }
    return list;
  }, [
    createBoard,
    createDaily,
    createDatabase,
    createPage,
    startGraphFixture,
    importMarkdown,
    openFolder,
    saveToFolder,
    setDumpOpen,
    setSettingsOpen,
    setTheme,
    setView,
    theme,
    boards,
    lockWorkspace,
    unlocked,
    activeWorkspace,
    tools.board,
    tools.brainDump,
    tools.calendar,
    tools.graph,
    tools.meeting,
    t,
    split,
    setPageSplitOpen,
    setPlusOpen,
    closeSplit,
    view.kind,
  ]);

  const noteHits = (
    q.trim()
      ? searchNotes(notes, q, { semantic: semanticSearch !== false })
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
    <Overlay onClose={() => setOpen(false)} title={t("shell.search")}>
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={15} strokeWidth={1.4} className="text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            role="combobox"
            aria-label={t("shell.search")}
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items[i] ? optionId(items[i].id) : undefined}
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
            placeholder={t("shell.search")}
            className="w-full bg-transparent py-4 text-base"
          />
          <span className="hidden sm:inline-flex">
            <Kbd>ESC</Kbd>
          </span>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto py-2">
          {items.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                id={optionId(item.id)}
                role="option"
                aria-selected={idx === i}
                onMouseEnter={() => setI(idx)}
                onClick={() => run(idx)}
                className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-2 text-left text-sm max-md:py-3 ${
                  idx === i ? "border-ring bg-paper-2 text-ink" : "border-transparent text-mute hover:bg-paper-2"
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
          {!items.length && <li className="px-4 py-6 text-sm text-mute">{t("insert.nothing")}</li>}
        </ul>
      </Panel>
    </Overlay>
  );
}
