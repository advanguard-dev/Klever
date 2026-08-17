import { GhostButton, IconButton, Kbd, MonoLabel, TextButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  ChromeIcon,
  Database,
  FileText,
  Hash,
  Library,
  Network,
  NoteIcon,
  noteKindIcon,
  treeNoteIcon,
} from "@/lib/chrome-icons";
import { buildVaultTree, ensureFolderPaths, folderAncestors, noteFolder, type VaultFolder } from "@/lib/folders";
import { slugify } from "@/lib/ids";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { searchNotes, searchSnippet } from "@/lib/search";
import { useApp } from "@/store";
import type { Note } from "@/types";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Command,
  Folder,
  FolderPlus,
  LayoutDashboard,
  NotebookPen,
  PanelLeft,
  Plus,
  Search,
  Settings2,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** Hide empty placeholder pages from the tree until the user names or fills them. */
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
  const notes = useApp((s) => s.notes);
  const view = useApp((s) => s.view);
  const query = useApp((s) => s.query);
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
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const openWorkspaceSetup = useApp((s) => s.openWorkspaceSetup);

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
    ensureFolderPaths(
      root,
      notes.filter(isSidebarDraftNoise).map((n) => noteFolder(n.path)),
    );
    return root;
  }, [notes]);
  const dbs = useMemo(
    () => notes.filter((n) => n.type === "database" && !isSidebarDraftNoise(n)),
    [notes],
  );
  const tags = useMemo(() => {
    const t = new Set<string>();
    notes.forEach((n) => n.tags.forEach((x) => t.add(x)));
    return [...t].sort();
  }, [notes]);
  const filtered = query.trim() ? searchNotes(notes, query) : null;
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
    <aside className="absolute inset-y-0 left-0 z-40 flex h-full w-[min(100%,15rem)] shrink-0 flex-col border-r border-line bg-paper md:static md:w-60">
      <div className="flex items-center justify-between gap-1 px-3 py-3">
        <div className="relative min-w-0" ref={wsMenuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={wsMenuOpen}
            aria-label="Workspaces"
            className="flex max-w-full items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-paper-2"
            onClick={() => setWsMenuOpen((v) => !v)}
          >
            <span className="truncate font-serif text-2xl font-bold italic tracking-tight">Klever</span>
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
            <p className="mt-0.5 truncate px-1 font-mono text-[10px] tracking-wide text-faint">
              {activeWorkspace.name}
            </p>
          )}
          {wsMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper py-1 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.35)]"
            >
              <p className="px-3 pb-1 pt-2">
                <MonoLabel>Workspaces</MonoLabel>
              </p>
              {workspaces.map((w) => {
                const active = w.id === activeWorkspaceId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left font-serif text-sm transition-colors",
                      active ? "bg-paper-2 text-ink" : "text-mute hover:bg-paper-2 hover:text-ink",
                    )}
                    onClick={() => {
                      setWsMenuOpen(false);
                      void switchWorkspace(w.id);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    {active && <Check size={14} strokeWidth={1.4} className="shrink-0 text-ink" />}
                  </button>
                );
              })}
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-serif text-sm text-mute hover:bg-paper-2 hover:text-ink"
                onClick={() => {
                  setWsMenuOpen(false);
                  openWorkspaceSetup(null);
                }}
              >
                <Plus size={14} strokeWidth={1.4} />
                New workspace
              </button>
              {activeWorkspace && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-serif text-sm text-mute hover:bg-paper-2 hover:text-ink"
                  onClick={() => {
                    setWsMenuOpen(false);
                    openWorkspaceSetup(activeWorkspace.id);
                  }}
                >
                  <Settings2 size={14} strokeWidth={1.4} />
                  Edit workspace
                </button>
              )}
            </div>
          )}
        </div>
        <IconButton aria-label="Collapse sidebar" onClick={toggleSidebar}>
          <PanelLeft size={16} strokeWidth={1.4} />
        </IconButton>
      </div>

      <div className="px-3">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-2 py-1">
          <Search size={13} strokeWidth={1.4} className="text-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            className="w-full bg-transparent py-1 text-sm placeholder:text-faint focus-visible:outline-none"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-1 px-2">
        <GhostButton className="h-8 px-2 py-0" onClick={() => setPlusOpen(true, "sidebar")}>
          <Plus size={14} strokeWidth={1.4} />
          New
        </GhostButton>
        <GhostButton className="h-8 px-2 py-0" onClick={() => createDaily()}>
          <NotebookPen size={14} strokeWidth={1.4} />
          Today
        </GhostButton>
        <TextButton
          className="ml-auto h-8"
          onClick={() => setCommandOpen(true)}
          aria-label="Command palette"
        >
          <Command size={13} strokeWidth={1.4} />
          <Kbd>⌘K</Kbd>
        </TextButton>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-2 pb-8">
        {filtered ? (
          <Section label="Results">
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
                />
                {query.trim() && searchSnippet(n.body, query) && (
                  <p className="px-8 pb-2 font-mono text-[10px] leading-4 text-faint">
                    {searchSnippet(n.body, query)}
                  </p>
                )}
              </div>
            ))}
            {!filtered.length && <p className="px-2 py-3 text-sm text-mute">Nothing matches.</p>}
          </Section>
        ) : (
          <>
            {starredNotes.length > 0 && (
              <Section label="Starred">
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
                  />
                ))}
              </Section>
            )}
            {recentNotes.length > 0 && (
              <Section label="Recents">
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
                  />
                ))}
              </Section>
            )}
            <Section
              label="Vault"
              icon={Library}
              empty={!notes.length && !newFolderOpen}
              onAdd={() => setPlusOpen(true, "sidebar")}
              headerAction={
                <button
                  type="button"
                  aria-label="New folder"
                  title="New folder"
                  className="text-faint hover:text-ink"
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
                    placeholder="Folder name"
                    aria-label="Folder name"
                    className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 font-serif text-sm placeholder:text-faint focus-visible:border-ink focus-visible:outline-none"
                  />
                </form>
              )}
              <FolderBranch
                folder={tree}
                depth={0}
                openFolders={openFolders}
                onToggle={toggleFolder}
                activeId={activeId}
                starred={starred}
                onStar={toggleStar}
                onOpen={openNoteNav}
                onCreate={(folder) => createPage({ folder: folder || undefined, title: "Untitled" })}
              />
            </Section>
            <Section
              label="Databases"
              icon={Database}
              empty={!dbs.length}
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
            <Section label="Tags">
              {tags.map((t) => (
                <Row
                  key={t}
                  label={`#${t}`}
                  lucide={Hash}
                  mono
                  active={view.kind === "tag" && view.tag === t}
                  onClick={() => {
                    setView({ kind: "tag", tag: t });
                    if (window.matchMedia("(max-width: 767px)").matches) {
                      useApp.setState({ sidebarOpen: false });
                    }
                  }}
                />
              ))}
            </Section>
            <Section label="System">
              <Row
                label="Today"
                lucide={NotebookPen}
                onClick={() => {
                  createDaily();
                  if (window.matchMedia("(max-width: 767px)").matches) {
                    useApp.setState({ sidebarOpen: false });
                  }
                }}
              />
              {tools.calendar && (
                <Row
                  label="Calendar"
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
              {tools.board && (
                <Row
                  label="Board"
                  lucide={LayoutDashboard}
                  active={view.kind === "freeform"}
                  onClick={() => {
                    setView({ kind: "freeform" });
                    if (window.matchMedia("(max-width: 767px)").matches) {
                      useApp.setState({ sidebarOpen: false });
                    }
                  }}
                />
              )}
              {tools.graph && (
                <Row
                  label="Graph"
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
            </Section>
          </>
        )}
      </nav>
    </aside>
  );
}

function FolderBranch({
  folder,
  depth,
  openFolders,
  onToggle,
  activeId,
  starred,
  onStar,
  onOpen,
  onCreate,
}: {
  folder: VaultFolder;
  depth: number;
  openFolders: Set<string>;
  onToggle: (path: string) => void;
  activeId: string | null;
  starred: string[];
  onStar: (id: string) => void;
  onOpen: (n: Note) => void;
  onCreate: (folder: string) => void;
}) {
  return (
    <>
      {folder.notes.map((n) => (
        <Row
          key={n.id}
          label={n.title}
          icon={n.icon}
          kind={n.type}
          depth={depth}
          active={activeId === n.id}
          starred={starred.includes(n.id)}
          onStar={() => onStar(n.id)}
          onClick={() => onOpen(n)}
        />
      ))}
      {folder.folders.map((child) => {
        const open = openFolders.has(child.path);
        return (
          <div key={child.path}>
            <div className="group/folder flex items-center">
              <button
                type="button"
                onClick={() => onToggle(child.path)}
                className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-left font-serif text-sm text-mute transition-colors duration-150 hover:bg-paper-2 hover:text-ink"
                style={{ paddingLeft: 8 + depth * 12 }}
              >
                <ChevronRight
                  size={12}
                  strokeWidth={1.4}
                  className={cn("shrink-0 text-faint transition-transform duration-150", open && "rotate-90")}
                />
                <ChromeIcon icon={Folder} />
                <span className="truncate">{child.name}</span>
              </button>
              <button
                type="button"
                aria-label={`New page in ${child.name}`}
                className="mr-1 hidden h-6 w-6 items-center justify-center text-faint hover:text-ink group-hover/folder:inline-flex"
                onClick={() => onCreate(child.path)}
              >
                <Plus size={12} strokeWidth={1.4} />
              </button>
            </div>
            {open && (
              <FolderBranch
                folder={child}
                depth={depth + 1}
                openFolders={openFolders}
                onToggle={onToggle}
                activeId={activeId}
                starred={starred}
                onStar={onStar}
                onOpen={onOpen}
                onCreate={onCreate}
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
            className="px-1 text-faint hover:text-ink"
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
          />
        ))}
    </div>
  );
}

function Section({
  label,
  icon,
  children,
  empty,
  onAdd,
  headerAction,
}: {
  label: string;
  icon?: typeof FileText;
  children: React.ReactNode;
  empty?: boolean;
  onAdd?: () => void;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between border-b border-line px-2 pb-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {icon && <ChromeIcon icon={icon} size={12} className="shrink-0 text-faint" />}
          <MonoLabel>{label}</MonoLabel>
        </span>
        <div className="flex items-center gap-1">
          {headerAction}
          {empty && onAdd && (
            <button
              type="button"
              aria-label={`Add ${label}`}
              className="text-faint hover:text-ink"
              onClick={onAdd}
            >
              <Plus size={13} strokeWidth={1.4} />
            </button>
          )}
        </div>
      </div>
      {empty ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-lg px-2 py-1.5 text-left font-serif text-sm text-faint hover:bg-paper-2 hover:text-ink"
        >
          {label === "Databases" ? "New database" : "New page"}
        </button>
      ) : (
        children
      )}
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
  mono,
  starred,
  onStar,
  depth = 0,
}: {
  label: string;
  icon?: string;
  kind?: "page" | "database";
  lucide?: typeof FileText;
  active?: boolean;
  onClick: () => void;
  mono?: boolean;
  starred?: boolean;
  onStar?: () => void;
  depth?: number;
}) {
  const Fallback = lucide ?? (kind ? noteKindIcon(kind) : FileText);
  const treeIcon = treeNoteIcon(icon, kind);
  return (
    <div className="group/row flex items-center">
      <button
        type="button"
        onClick={onClick}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pr-1 text-left font-serif text-sm transition-colors duration-150",
          active ? "bg-paper-2 text-ink" : "text-mute hover:bg-paper-2 hover:text-ink",
          mono && "font-mono text-[12px]",
        )}
      >
        <span className="flex w-4 shrink-0 items-center justify-center text-center text-xs text-faint">
          <NoteIcon icon={treeIcon} fallback={Fallback} />
        </span>
        <span className="truncate">{label}</span>
      </button>
      {onStar && (
        <button
          type="button"
          aria-label={starred ? "Unstar" : "Star"}
          onClick={onStar}
          className={cn(
            "mr-1 h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint hover:text-ink",
            starred ? "inline-flex text-ink" : "hidden group-hover/row:inline-flex",
          )}
        >
          <Star size={12} strokeWidth={1.4} fill={starred ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}
