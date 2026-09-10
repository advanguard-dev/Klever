import { IconButton, Kbd, MonoLabel, TextButton } from "@/components/ui";
import { contextMenuFromKey, useContextMenu, type PointEvent } from "@/components/ContextMenu";
import { boardMenuItems, folderMenuItems, noteMenuItems, tagMenuItems } from "@/lib/context-menus";
import { cn } from "@/lib/cn";
import { ChromeIcon, Database, FileText, Hash, Library, Network, NoteIcon, noteKindIcon, treeNoteIcon } from "@/lib/chrome-icons";
import { IconPickerOverlay } from "@/components/editor/IconChooser";
import { dropNoteNearNote, dropNoteToFolder } from "@/lib/drop-files";
import { folderDropHighlight, folderDragPath, hasFileTransfer, isKleverTreeDrag, KLEVER_FOLDER_DRAG, KLEVER_NOTE_DRAG, noteDragId } from "@/lib/dnd";
import { filesFromFileList } from "@/lib/local-file-path";
import { slugify } from "@/lib/ids";
import { buildVaultTree, canMoveFolder, ensureFolderPaths, folderAncestors, noteFolder, type VaultFolder } from "@/lib/folders";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { isEncryptedWorkspace } from "@/lib/workspace-lock";
import { searchNotes, searchSnippet } from "@/lib/search";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { Note } from "@/types";
import {
  AudioLines,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Command,
  Folder,
  FolderPlus,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  NotebookPen,
  PanelLeft,
  Plus,
  Search,
  Settings2,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** Hide empty placeholder pages from the tree until the user names or fills them. */
let draggingFolderPath: string | null = null;
function isSidebarDraftNoise(n: Note) {
  if (n.title !== "Untitled" && n.title !== "New database") return false;
  const body = n.body.replace(/^#\s+.+\n*/, "").trim();
  if (body.length > 0) return false;
  // Brand-new DBs keep default schema — still noise until renamed.
  if (n.title === "New database" && n.type === "database") return true;
  if (n.type === "database" && (n.schema?.length || (n.views?.length ?? 0) > 1)) return false;
  return true;
}

export function Sidebar() {
  const t = useT();
  const notes = useApp((s) => s.notes);
  const folderIcons = useApp((s) => s.folderIcons);
  const view = useApp((s) => s.view);
  const query = useApp((s) => s.query);
  const semanticSearch = useApp((s) => s.dev.semanticSearch);
  const setQuery = useApp((s) => s.setQuery);
  const setView = useApp((s) => s.setView);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const createDaily = useApp((s) => s.createDaily);
  const recents = useApp((s) => s.recents);
  const starred = useApp((s) => s.starred);
  const toggleStar = useApp((s) => s.toggleStar);
  const createPage = useApp((s) => s.createPage);
  const importDroppedFiles = useApp((s) => s.importDroppedFiles);
  const boards = useApp((s) => s.boards);
  const createBoard = useApp((s) => s.createBoard);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const openWorkspaceSetup = useApp((s) => s.openWorkspaceSetup);
  const lockWorkspace = useApp((s) => s.lockWorkspace);
  const unlocked = useApp((s) => s.unlocked);
  const { open } = useContextMenu();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const tools = activeWorkspace?.tools ?? defaultWorkspaceTools();

  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wsMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wsMenuRef.current?.contains(e.target as Node)) setWsMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [wsMenuOpen]);

  const tree = useMemo(() => {
    const visible = notes.filter((n) => !isSidebarDraftNoise(n));
    const root = buildVaultTree(visible);
    ensureFolderPaths(root, [
      ...notes.filter(isSidebarDraftNoise).map((n) => noteFolder(n.path)),
      ...Object.keys(folderIcons),
    ]);
    return root;
  }, [notes, folderIcons]);
  const dbs = useMemo(
    () => notes.filter((n) => n.type === "database" && !isSidebarDraftNoise(n)),
    [notes],
  );
  const tags = useMemo(() => {
    const t = new Set<string>();
    notes.forEach((n) => n.tags.forEach((x) => t.add(x)));
    return [...t].sort();
  }, [notes]);
  const filtered = query.trim() ? searchNotes(notes, query, { semantic: semanticSearch !== false }) : null;
  const recentNotes = recents
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is Note => n != null && !isSidebarDraftNoise(n));
  const starredNotes = starred
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is Note => Boolean(n));

  const activeId = view.kind === "note" || view.kind === "database" ? view.id : null;
  const activeNote = activeId ? notes.find((n) => n.id === activeId) : undefined;
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());
  const foldersInited = useRef(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (foldersInited.current || !tree.folders.length) return;
    foldersInited.current = true;
    setOpenFolders(new Set(tree.folders.map((f) => f.path)));
  }, [tree]);

  useEffect(() => {
    if (!activeNote) return;
    setOpenFolders((prev) => {
      const next = new Set(prev);
      for (const p of folderAncestors(activeNote.path)) next.add(p);
      return next;
    });
  }, [activeNote]);

  useEffect(() => {
    if (newFolderOpen) folderInputRef.current?.focus();
  }, [newFolderOpen]);

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const submitNewFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = slugify(name);
    createPage({ folder, title: "Untitled" });
    setOpenFolders((prev) => new Set(prev).add(folder));
    setNewFolderOpen(false);
    setNewFolderName("");
  };

  const cancelNewFolder = () => {
    setNewFolderOpen(false);
    setNewFolderName("");
  };

  const openNoteNav = (n: Note) => {
    setView(
      n.type === "database" ? { kind: "database", id: n.id } : { kind: "note", id: n.id },
    );
    if (window.matchMedia("(max-width: 767px)").matches) {
      useApp.setState({ sidebarOpen: false });
    }
  };

  return (
    <aside className="absolute inset-y-0 left-0 z-40 flex h-full w-[min(100%,15rem)] shrink-0 flex-col border-r border-line bg-blotter md:static md:w-60">
      <div className="flex items-center justify-between gap-1 px-3 py-2.5">
        <div className="relative min-w-0" ref={wsMenuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={wsMenuOpen}
            aria-label={t("sidebar.workspaces")}
            className="klever-focus flex max-w-full items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-ink/[0.06]"
            onClick={() => setWsMenuOpen((v) => !v)}
          >
            <span className="truncate font-sans text-lg font-semibold tracking-tight">Klever</span>
            <ChevronDown
              size={14}
              strokeWidth={1.4}
              className={cn(
                "shrink-0 text-mute transition-transform duration-150",
                wsMenuOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {activeWorkspace && (
            <p className="mt-0.5 flex items-center gap-1 truncate px-1 font-mono text-[10px] tracking-wide text-faint">
              {isEncryptedWorkspace(activeWorkspace) && (
                <Lock size={10} strokeWidth={1.6} className="shrink-0" aria-hidden />
              )}
              <span className="truncate">{activeWorkspace.name}</span>
            </p>
          )}
          {wsMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded-md border border-line bg-paper py-1 shadow-md"
            >
              <p className="px-3 pb-1 pt-2">
                <MonoLabel>{t("sidebar.workspaces")}</MonoLabel>
              </p>
              {workspaces.map((w) => {
                const active = w.id === activeWorkspaceId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "klever-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      active ? "bg-ink/[0.08] text-ink" : "text-mute hover:bg-ink/[0.06] hover:text-ink",
                    )}
                    onClick={() => {
                      setWsMenuOpen(false);
                      void switchWorkspace(w.id);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    {isEncryptedWorkspace(w) && (
                      <Lock size={13} strokeWidth={1.4} className="shrink-0 text-faint" aria-label={t("sidebar.encrypted")} />
                    )}
                    {active && <Check size={14} strokeWidth={1.4} className="shrink-0 text-ink" />}
                  </button>
                );
              })}
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                role="menuitem"
                className="klever-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mute hover:bg-ink/[0.06] hover:text-ink"
                onClick={() => {
                  setWsMenuOpen(false);
                  openWorkspaceSetup(null);
                }}
              >
                <Plus size={14} strokeWidth={1.4} />
                {t("sidebar.newWorkspace")}
              </button>
              {activeWorkspace && (
                <button
                  type="button"
                  role="menuitem"
                  className="klever-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mute hover:bg-ink/[0.06] hover:text-ink"
                  onClick={() => {
                    setWsMenuOpen(false);
                    openWorkspaceSetup(activeWorkspace.id);
                  }}
                >
                  <Settings2 size={14} strokeWidth={1.4} />
                  {t("sidebar.editWorkspace")}
                </button>
              )}
              {activeWorkspace && isEncryptedWorkspace(activeWorkspace) && unlocked && (
                <button
                  type="button"
                  role="menuitem"
                  className="klever-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mute hover:bg-ink/[0.06] hover:text-ink"
                  onClick={() => {
                    setWsMenuOpen(false);
                    void lockWorkspace();
                  }}
                >
                  <Lock size={14} strokeWidth={1.4} />
                  {t("sidebar.lockWorkspace")}
                </button>
              )}
            </div>
          )}
        </div>
        <IconButton aria-label={t("sidebar.collapse")} onClick={toggleSidebar}>
          <PanelLeft size={16} strokeWidth={1.4} />
        </IconButton>
      </div>

      <div className="px-3">
        <label className="klever-focus-within flex min-h-11 items-center gap-2 rounded-md bg-ink/[0.045] px-2.5 py-1 md:min-h-0">
          <Search size={13} strokeWidth={1.4} className="text-mute" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("sidebar.filter")}
            aria-label={t("sidebar.filter")}
            className="w-full bg-transparent py-1 text-sm placeholder:text-faint"
          />
        </label>
      </div>

      <div className="mt-2 flex items-center gap-0.5 px-2">
        <TextButton className="h-8 px-2 py-0" onClick={() => setPlusOpen(true, "sidebar")}>
          <Plus size={14} strokeWidth={1.4} />
          {t("sidebar.new")}
        </TextButton>
        <TextButton className="h-8 px-2 py-0" onClick={() => createDaily()}>
          <NotebookPen size={14} strokeWidth={1.4} />
          {t("sidebar.today")}
        </TextButton>
        <TextButton
          className="ml-auto h-8 max-md:h-11"
          onClick={() => setCommandOpen(true)}
          aria-label={t("sidebar.command")}
        >
          <Command size={13} strokeWidth={1.4} />
          <span className="hidden md:inline-flex">
            <Kbd>⌘K</Kbd>
          </span>
        </TextButton>
      </div>

      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {filtered ? (
          <Section persistId="results" label={t("sidebar.results")}>
            {filtered.map((n) => (
              <div key={n.id}>
                <Row
                  label={n.title}
                  icon={n.icon}
                  kind={n.type}
                  active={activeId === n.id}
                  starred={starred.includes(n.id)}
                  onStar={() => toggleStar(n.id)}
                  onClick={() => openNoteNav(n)}
                  onContextMenu={(e) => open(e, noteMenuItems(n))}
                />
                {query.trim() && searchSnippet(n.body, query) && (
                  <p className="px-8 pb-2 font-mono text-[10px] leading-4 text-faint">
                    {searchSnippet(n.body, query)}
                  </p>
                )}
              </div>
            ))}
            {!filtered.length && <p className="px-2 py-3 text-sm text-mute">{t("sidebar.nothingMatches")}</p>}
          </Section>
        ) : (
          <>
            {starredNotes.length > 0 && (
              <Section persistId="starred" label={t("sidebar.starred")}>
                {starredNotes.map((n) => (
                  <Row
                    key={n.id}
                    label={n.title}
                    icon={n.icon}
                    kind={n.type}
                    lucide={Star}
                    active={activeId === n.id}
                    starred
                    onStar={() => toggleStar(n.id)}
                    onClick={() => openNoteNav(n)}
                    onContextMenu={(e) => open(e, noteMenuItems(n))}
                  />
                ))}
              </Section>
            )}
            {recentNotes.length > 0 && (
              <Section persistId="recents" label={t("sidebar.recents")} defaultOpen={false}>
                {recentNotes.map((n) => (
                  <Row
                    key={n.id}
                    label={n.title}
                    icon={n.icon}
                    kind={n.type}
                    lucide={Clock}
                    active={activeId === n.id}
                    starred={starred.includes(n.id)}
                    onStar={() => toggleStar(n.id)}
                    onClick={() => openNoteNav(n)}
                    onContextMenu={(e) => open(e, noteMenuItems(n))}
                  />
                ))}
              </Section>
            )}
            <Section
              persistId="vault"
              label={t("sidebar.vault")}
              emptyAdd="page"
              icon={Library}
              empty={!notes.length && !newFolderOpen}
              onAdd={() => setPlusOpen(true, "sidebar")}
              headerAction={
                <button
                  type="button"
                  aria-label={t("sidebar.newFolder")}
                  title={t("sidebar.newFolder")}
                  className="klever-focus rounded-md text-mute hover:text-ink"
                  onClick={() => setNewFolderOpen(true)}
                >
                  <FolderPlus size={13} strokeWidth={1.4} />
                </button>
              }
            >
              {newFolderOpen && (
                <form
                  className="mb-1 px-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitNewFolder();
                  }}
                >
                  <input
                    ref={folderInputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelNewFolder();
                      }
                    }}
                    onBlur={() => {
                      if (!newFolderName.trim()) cancelNewFolder();
                    }}
                    placeholder={t("sidebar.folderName")}
                    aria-label={t("sidebar.folderName")}
                    className="w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm placeholder:text-faint klever-focus"
                  />
                </form>
              )}
              <div
                onDragOver={(e) => {
                  if (!hasFileTransfer(e) && !isKleverTreeDrag(e)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = isKleverTreeDrag(e) ? "move" : "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const folderFrom = folderDragPath(e);
                  if (folderFrom) {
                    const next = useApp.getState().moveFolder(folderFrom, "");
                    if (next && next !== folderFrom) {
                      setOpenFolders((prev) => {
                        const n = new Set<string>();
                        for (const p of prev) {
                          if (p === folderFrom || p.startsWith(`${folderFrom}/`)) n.add(`${next}${p.slice(folderFrom.length)}`);
                          else n.add(p);
                        }
                        n.add(next);
                        return n;
                      });
                    }
                  } else {
                    const dragged = noteDragId(e);
                    if (dragged) dropNoteToFolder(dragged, "");
                    else if (e.dataTransfer.files.length) {
                      void importDroppedFiles(filesFromFileList(e.dataTransfer.files));
                    }
                  }
                }}
              >
              <FolderBranch
                folder={tree}
                depth={0}
                openFolders={openFolders}
                onToggle={toggleFolder}
                onRenamed={(from, to) => {
                  setOpenFolders((prev) => {
                    const next = new Set<string>();
                    for (const p of prev) {
                      if (p === from || p.startsWith(`${from}/`)) next.add(`${to}${p.slice(from.length)}`);
                      else next.add(p);
                    }
                    next.add(to);
                    return next;
                  });
                }}
                activeId={activeId}
                starred={starred}
                onStar={toggleStar}
                onOpen={openNoteNav}
                onCreate={(folder) => createPage({ folder: folder || undefined, title: "Untitled" })}
                importDroppedFiles={importDroppedFiles}
              />
              </div>
            </Section>
            <Section
              persistId="databases"
              label={t("sidebar.databases")}
              emptyAdd="database"
              icon={Database}
              empty={!dbs.length}
              defaultOpen={false}
              onAdd={() => setPlusOpen(true, "sidebar")}
            >
              {dbs.map((n) => (
                <DatabaseBranch
                  key={n.id}
                  db={n}
                  notes={notes}
                  activeId={activeId}
                  starred={starred}
                  onStar={toggleStar}
                  onOpen={openNoteNav}
                />
              ))}
            </Section>
            {tools.board && (
              <Section
                persistId="boards"
                label={t("sidebar.boards")}
                icon={LayoutDashboard}
                headerAction={
                  <button
                    type="button"
                    aria-label={t("sidebar.newBoard")}
                    className="klever-focus rounded-md text-mute hover:text-ink"
                    onClick={() => createBoard()}
                  >
                    <Plus size={13} strokeWidth={1.4} />
                  </button>
                }
              >
                {boards.map((b) => (
                  <Row
                    key={b.id}
                    label={b.title}
                    lucide={LayoutDashboard}
                    active={view.kind === "freeform" && view.id === b.id}
                    onClick={() => setView({ kind: "freeform", id: b.id })}
                    onContextMenu={(e) => open(e, boardMenuItems(b.id, b.title))}
                  />
                ))}
              </Section>
            )}
            <Section persistId="tags" label={t("sidebar.tags")}>
              {tags.map((t) => (
                <Row
                  key={t}
                  label={`#${t}`}
                  lucide={Hash}
                  mono
                  tone="tag"
                  active={view.kind === "tag" && view.tag === t}
                  onClick={() => {
                    setView({ kind: "tag", tag: t });
                    if (window.matchMedia("(max-width: 767px)").matches) {
                      useApp.setState({ sidebarOpen: false });
                    }
                  }}
                  onContextMenu={(e) => open(e, tagMenuItems(t))}
                />
              ))}
            </Section>
          </>
        )}
      </nav>
      {(tools.calendar || tools.meeting || tools.graph) && (
        <div className="shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          {tools.calendar && (
            <Row
              label={t("sidebar.calendar")}
              lucide={Calendar}
              active={view.kind === "calendar"}
              onClick={() => {
                setView({ kind: "calendar" });
                if (window.matchMedia("(max-width: 767px)").matches) {
                  useApp.setState({ sidebarOpen: false });
                }
              }}
            />
          )}
          {tools.meeting && (
            <Row
              label={t("sidebar.meetings")}
              lucide={AudioLines}
              active={view.kind === "meeting"}
              onClick={() => {
                setView({ kind: "meeting" });
                if (window.matchMedia("(max-width: 767px)").matches) {
                  useApp.setState({ sidebarOpen: false });
                }
              }}
            />
          )}
          {tools.graph && (
            <Row
              label={t("sidebar.graph")}
              lucide={Network}
              active={view.kind === "graph"}
              onClick={() => {
                setView({ kind: "graph" });
                if (window.matchMedia("(max-width: 767px)").matches) {
                  useApp.setState({ sidebarOpen: false });
                }
              }}
            />
          )}
        </div>
      )}
    </aside>
  );
}

function FolderBranch({
  folder,
  depth,
  openFolders,
  onToggle,
  onRenamed,
  activeId,
  starred,
  onStar,
  onOpen,
  onCreate,
  importDroppedFiles,
}: {
  folder: VaultFolder;
  depth: number;
  openFolders: Set<string>;
  onToggle: (path: string) => void;
  onRenamed: (from: string, to: string) => void;
  activeId: string | null;
  starred: string[];
  onStar: (id: string) => void;
  onOpen: (n: Note) => void;
  onCreate: (folder: string) => void;
  importDroppedFiles: (files: File[], opts?: { folder?: string }) => Promise<void>;
}) {
  const { open: openMenu } = useContextMenu();
  const [overFolder, setOverFolder] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [iconPath, setIconPath] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const folderIcons = useApp((s) => s.folderIcons);
  const renameFolder = useApp((s) => s.renameFolder);
  const setFolderIcon = useApp((s) => s.setFolderIcon);

  useEffect(() => {
    if (renamingPath) renameRef.current?.focus();
  }, [renamingPath]);

  const folderMenu = (path: string) =>
    folderMenuItems(path, {
      onRename: () => {
        const name = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
        setRenamingPath(path);
        setRenameValue(name);
      },
      onChangeIcon: () => setIconPath(path),
    });

  const commitRename = () => {
    if (!renamingPath) return;
    if (!renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const next = renameFolder(renamingPath, renameValue);
    if (next && next !== renamingPath) onRenamed(renamingPath, next);
    setRenamingPath(null);
  };

  const folderDropProps = (folderPath: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!hasFileTransfer(e) && !isKleverTreeDrag(e)) return;
      if (
        e.dataTransfer.types.includes(KLEVER_FOLDER_DRAG) &&
        draggingFolderPath &&
        !canMoveFolder(draggingFolderPath, folderPath)
      ) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setOverFolder(folderPath);
      e.dataTransfer.dropEffect = isKleverTreeDrag(e) ? "move" : "copy";
    },
    onDragLeave: () => setOverFolder((cur) => (cur === folderPath ? null : cur)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOverFolder(null);
      const folderFrom = folderDragPath(e);
      if (folderFrom) {
        const next = useApp.getState().moveFolder(folderFrom, folderPath);
        if (next) onRenamed(folderFrom, next);
        return;
      }
      const dragged = noteDragId(e);
      if (dragged) dropNoteToFolder(dragged, folderPath);
      else if (e.dataTransfer.files.length) {
        void importDroppedFiles(filesFromFileList(e.dataTransfer.files), { folder: folderPath });
      }
    },
  });

  return (
    <>
      {folder.notes.map((n) => (
        <Row
          key={n.id}
          noteId={n.id}
          label={n.title}
          icon={n.icon}
          kind={n.type}
          depth={depth}
          active={activeId === n.id}
          starred={starred.includes(n.id)}
          onStar={() => onStar(n.id)}
          onClick={() => onOpen(n)}
          onContextMenu={(e) => openMenu(e, noteMenuItems(n))}
          onNoteDrop={(draggedId) => dropNoteNearNote(draggedId, n)}
        />
      ))}
      {folder.folders.map((child) => {
        const open = openFolders.has(child.path);
        const renaming = renamingPath === child.path;
        const mark = folderIcons[child.path];
        return (
          <div key={child.path}>
            <div
              className="group/folder flex items-center"
              draggable={!renaming}
              onDragStart={(e) => {
                if (renaming) return;
                draggingFolderPath = child.path;
                e.dataTransfer.setData(KLEVER_FOLDER_DRAG, child.path);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                draggingFolderPath = null;
              }}
              onContextMenu={(e) => openMenu(e, folderMenu(child.path))}
              {...folderDropProps(child.path)}
            >
              {renaming ? (
                <form
                  className="min-w-0 flex-1 px-1"
                  style={{ paddingLeft: 8 + depth * 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRename();
                  }}
                >
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setRenamingPath(null);
                      }
                    }}
                    onBlur={commitRename}
                    aria-label="Folder name"
                    className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm klever-focus"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggle(child.path)}
                  aria-expanded={open}
                  onKeyDown={(e) =>
                    contextMenuFromKey(e, (ev) => openMenu(ev, folderMenu(child.path)))
                  }
                  className={cn(
                    "klever-focus flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm text-mute transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink",
                    overFolder === child.path && folderDropHighlight(true),
                  )}
                  style={{ paddingLeft: 8 + depth * 12 }}
                >
                  <ChevronRight
                    size={12}
                    strokeWidth={1.4}
                    className={cn("shrink-0 text-faint transition-transform duration-150", open && "rotate-90")}
                  />
                  <NoteIcon icon={mark} fallback={Folder} />
                  <span className="truncate">{child.name}</span>
                </button>
              )}
              <button
                type="button"
                aria-label={`Folder actions for ${child.name}`}
                className="klever-focus hidden h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-ink/[0.06] hover:text-ink group-hover/folder:inline-flex group-focus-within/folder:inline-flex"
                onClick={(e) => openMenu(e, folderMenu(child.path))}
              >
                <MoreHorizontal size={12} strokeWidth={1.4} />
              </button>
              <button
                type="button"
                aria-label={`New page in ${child.name}`}
                className="klever-focus mr-1 hidden h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-ink/[0.06] hover:text-ink group-hover/folder:inline-flex group-focus-within/folder:inline-flex"
                onClick={() => onCreate(child.path)}
              >
                <Plus size={12} strokeWidth={1.4} />
              </button>
            </div>
            {iconPath === child.path && (
              <IconPickerOverlay
                value={folderIcons[child.path]}
                onChange={(icon) => setFolderIcon(child.path, icon)}
                onClose={() => setIconPath(null)}
              />
            )}
            {open && (
              <FolderBranch
                folder={child}
                depth={depth + 1}
                openFolders={openFolders}
                onToggle={onToggle}
                onRenamed={onRenamed}
                activeId={activeId}
                starred={starred}
                onStar={onStar}
                onOpen={onOpen}
                onCreate={onCreate}
                importDroppedFiles={importDroppedFiles}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function DatabaseBranch({
  db,
  notes,
  activeId,
  starred,
  onStar,
  onOpen,
}: {
  db: Note;
  notes: Note[];
  activeId: string | null;
  starred: string[];
  onStar: (id: string) => void;
  onOpen: (n: Note) => void;
}) {
  const children = notes.filter((n) => n.parent === db.id);
  const [open, setOpen] = useState(() => children.some((c) => c.id === activeId));
  const { open: openMenu } = useContextMenu();
  useEffect(() => {
    if (notes.some((n) => n.parent === db.id && n.id === activeId)) setOpen(true);
  }, [activeId, db.id, notes]);

  return (
    <div>
      <div className="flex items-center">
        {children.length > 0 && (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            className="klever-focus px-1 text-faint hover:text-ink"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronRight
              size={12}
              strokeWidth={1.4}
              className={cn("transition-transform duration-150", open && "rotate-90")}
            />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <Row
            label={db.title}
            icon={db.icon}
            kind="database"
            active={activeId === db.id}
            starred={starred.includes(db.id)}
            onStar={() => onStar(db.id)}
            onClick={() => onOpen(db)}
            onContextMenu={(e) => openMenu(e, noteMenuItems(db))}
          />
        </div>
      </div>
      {open &&
        children.map((n) => (
          <Row
            key={n.id}
            label={n.title}
            icon={n.icon}
            kind="page"
            depth={1}
            active={activeId === n.id}
            starred={starred.includes(n.id)}
            onStar={() => onStar(n.id)}
            onClick={() => onOpen(n)}
            onContextMenu={(e) => openMenu(e, noteMenuItems(n))}
          />
        ))}
    </div>
  );
}

const SIDEBAR_SECTIONS_KEY = "klever.sidebar.sections";

function readSectionOpen(label: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed[label] === "boolean" ? parsed[label] : fallback;
  } catch {
    return fallback;
  }
}

function writeSectionOpen(label: string, open: boolean) {
  try {
    const raw = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[label] = open;
    localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore quota / private mode */
  }
}

function Section({
  persistId,
  label,
  icon,
  children,
  empty,
  emptyAdd,
  onAdd,
  headerAction,
  defaultOpen = true,
}: {
  persistId?: string;
  label: string;
  icon?: typeof FileText;
  children: React.ReactNode;
  empty?: boolean;
  emptyAdd?: "page" | "database";
  onAdd?: () => void;
  headerAction?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const t = useT();
  const storageKey = persistId ?? label;
  const [open, setOpen] = useState(() => readSectionOpen(storageKey, defaultOpen));

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      writeSectionOpen(storageKey, next);
      return next;
    });
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-2 pb-1">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? t("sidebar.collapseSection", { label }) : t("sidebar.expandSection", { label })}
          onClick={toggle}
          className="klever-focus flex min-w-0 items-center gap-1 rounded-md text-left hover:text-ink"
        >
          <ChevronRight
            size={12}
            strokeWidth={1.4}
            className={cn("shrink-0 text-faint transition-transform duration-150", open && "rotate-90")}
            aria-hidden
          />
          {icon && <ChromeIcon icon={icon} size={12} className="shrink-0 text-faint" />}
          <MonoLabel>{label}</MonoLabel>
        </button>
        <div className="flex items-center gap-1">
          {headerAction}
          {empty && onAdd && (
            <button
              type="button"
              aria-label={t("sidebar.addSection", { label })}
              className="klever-focus rounded-md text-mute hover:text-ink"
              onClick={onAdd}
            >
              <Plus size={13} strokeWidth={1.4} />
            </button>
          )}
        </div>
      </div>
      {open &&
        (empty ? (
          <button
            type="button"
            onClick={onAdd}
            className="klever-focus w-full rounded-lg px-2 py-1.5 text-left text-sm text-faint hover:bg-ink/[0.06] hover:text-ink"
          >
            {emptyAdd === "database" ? t("sidebar.newDatabase") : t("sidebar.newPage")}
          </button>
        ) : (
          children
        ))}
    </div>
  );
}

function Row({
  label,
  icon,
  kind,
  lucide,
  active,
  onClick,
  onContextMenu,
  mono,
  tone,
  starred,
  onStar,
  depth = 0,
  noteId,
  onNoteDrop,
}: {
  label: string;
  icon?: string;
  kind?: "page" | "database";
  lucide?: typeof FileText;
  active?: boolean;
  onClick: () => void;
  onContextMenu?: (e: PointEvent) => void;
  mono?: boolean;
  tone?: "tag";
  starred?: boolean;
  onStar?: () => void;
  depth?: number;
  noteId?: string;
  onNoteDrop?: (draggedId: string) => void;
}) {
  const Fallback = lucide ?? (kind ? noteKindIcon(kind) : FileText);
  const treeIcon = treeNoteIcon(icon, kind);
  const [dropOver, setDropOver] = useState(false);
  return (
    <div
      className={cn("group/row flex items-center", dropOver && "rounded-lg bg-smart/10 ring-1 ring-smart/25")}
      onContextMenu={onContextMenu}
      draggable={Boolean(noteId)}
      onDragStart={(e) => {
        if (!noteId) return;
        e.dataTransfer.setData(KLEVER_NOTE_DRAG, noteId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!onNoteDrop || !e.dataTransfer.types.includes(KLEVER_NOTE_DRAG)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropOver(true);
        e.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        if (!onNoteDrop) return;
        e.preventDefault();
        e.stopPropagation();
        setDropOver(false);
        const dragged = noteDragId(e);
        if (dragged && dragged !== noteId) onNoteDrop(dragged);
      }}
    >
      <button
        type="button"
        onClick={onClick}
        onKeyDown={(e) => contextMenuFromKey(e, onContextMenu)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={cn(
          "klever-focus flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pr-1 text-left text-sm transition-colors duration-150",
          active
            ? "bg-ink/[0.08] text-ink"
            : tone === "tag"
              ? "text-tag/80 hover:bg-ink/[0.06] hover:text-tag"
              : "text-mute hover:bg-ink/[0.06] hover:text-ink",
          mono && "font-mono text-[12px]",
        )}
      >
        <span className="flex w-4 shrink-0 items-center justify-center text-center text-xs">
          <NoteIcon
            icon={treeIcon}
            fallback={Fallback}
            className={tone === "tag" ? "shrink-0 text-tag/75" : "shrink-0 text-faint"}
          />
        </span>
        <span className="truncate">{label}</span>
      </button>
      {onStar && (
        <button
          type="button"
          aria-label={starred ? "Unstar" : "Star"}
          onClick={onStar}
          className={cn(
            "klever-focus mr-1 h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-ink/[0.06] hover:text-ink",
            starred ? "inline-flex text-ink" : "hidden group-hover/row:inline-flex group-focus-within/row:inline-flex",
          )}
        >
          <Star size={12} strokeWidth={1.4} fill={starred ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}
