import { create } from "zustand";
import type {
  AiSettings,
  AppView,
  BlobRecord,
  DbView,
  DbViewType,
  EditorMode,
  FreeformBoard,
  FreeformObject,
  InsertContext,
  Note,
  NoteComment,
  Peer,
  VaultEvent,
  Workspace,
  WorkspaceAiMode,
  WorkspaceTools,
} from "@/types";
import { defaultAi } from "@/lib/ai";
import { DEMO_FILES } from "@/lib/demo";
import { pickFiles } from "@/lib/assets";
import { nid, slugify, todayDate, todayIso } from "@/lib/ids";
import { fileToNote, noteToFile, notesFromFiles } from "@/lib/parse";
import { defaultViews, newView } from "@/lib/views";
import { createWorkspaceDraft, normalizeWorkspaceTools } from "@/lib/workspaces";
import {
  defaultFreeformBoard,
  loadBlobs,
  loadBoard,
  loadEvents,
  loadFiles,
  loadOrMigrateWorkspaces,
  loadWorkspaceVaultMeta,
  pickVaultFolder,
  saveBlobs,
  saveBoard,
  saveEvents,
  saveFiles,
  saveMeta,
  saveWorkspaceVaultMeta,
  saveWorkspacesRegistry,
  walkVault,
  writeVaultToDirectory,
} from "@/lib/persist";

let dirHandle: FileSystemDirectoryHandle | null = null;
let persistTimer: number | undefined;
const TAB_ID = nid();
let channel: BroadcastChannel | null = null;
let helloTimer: number | undefined;

function viewNoteId(view: AppView) {
  return view.kind === "note" || view.kind === "database" ? view.id : undefined;
}

function filesFromNotes(notes: Note[]) {
  const files: Record<string, string> = {};
  for (const n of notes) files[n.path] = noteToFile(n);
  return files;
}

function uniquePath(notes: Note[], path: string, id: string) {
  if (!notes.some((n) => n.path === path)) return path;
  return path.replace(/(\.database)?\.md$/, (m) => `-${id}${m}`);
}

function applyDefaults(schema?: Note["schema"]) {
  if (!schema) return {};
  const props: Record<string, unknown> = {};
  for (const s of schema) {
    if (s.type === "formula" || s.type === "rollup") continue;
    if (s.default !== undefined) props[s.key] = s.default;
    else if (s.type === "select" && s.options?.[0]) props[s.key] = s.options[0];
  }
  return props;
}

function homeView(notes: Note[]): AppView {
  const welcome = notes.find((n) => n.id === "welcome");
  if (welcome) return { kind: "note", id: "welcome" };
  const first = notes[0];
  if (!first) return { kind: "graph" };
  return first.type === "database"
    ? { kind: "database", id: first.id }
    : { kind: "note", id: first.id };
}

function clampViewToTools(view: AppView, tools: WorkspaceTools): AppView {
  if (view.kind === "calendar" && !tools.calendar) return { kind: "graph" };
  if (view.kind === "freeform" && !tools.board) return { kind: "graph" };
  if (view.kind === "graph" && !tools.graph) {
    return tools.calendar ? { kind: "calendar" } : tools.board ? { kind: "freeform" } : { kind: "welcome" };
  }
  return view;
}

interface AppState {
  ready: boolean;
  notes: Note[];
  blobs: Record<string, BlobRecord>;
  events: VaultEvent[];
  board: FreeformBoard;
  view: AppView;
  sidebarOpen: boolean;
  propsOpen: boolean;
  theme: "light" | "dark";
  mode: EditorMode;
  displayName: string;
  peers: Peer[];
  ai: AiSettings;
  commandOpen: boolean;
  dumpOpen: boolean;
  settingsOpen: boolean;
  plusOpen: boolean;
  plusContext: InsertContext;
  query: string;
  error: string | null;
  folderName: string | null;
  recents: string[];
  starred: string[];
  workspaces: Workspace[];
  activeWorkspaceId: string;
  workspaceSetupOpen: boolean;
  workspaceSetupId: string | null;
  hydrate: () => Promise<void>;
  startDemo: () => Promise<void>;
  startEmpty: () => void;
  openFolder: () => Promise<void>;
  saveToFolder: () => Promise<void>;
  importMarkdown: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (input: {
    name: string;
    tools: WorkspaceTools;
    aiMode: WorkspaceAiMode;
  }) => Promise<void>;
  updateWorkspace: (
    id: string,
    patch: { name?: string; tools?: Partial<WorkspaceTools>; aiMode?: WorkspaceAiMode },
  ) => void;
  openWorkspaceSetup: (id?: string | null) => void;
  closeWorkspaceSetup: () => void;
  setView: (view: AppView) => void;
  toggleStar: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setMode: (mode: EditorMode) => void;
  setDisplayName: (name: string) => void;
  addComment: (noteId: string, body: string) => void;
  resolveComment: (noteId: string, commentId: string, resolved?: boolean) => void;
  removeComment: (noteId: string, commentId: string) => void;
  setAi: (ai: Partial<AiSettings>) => void;
  setQuery: (q: string) => void;
  setError: (e: string | null) => void;
  toggleSidebar: () => void;
  toggleProps: () => void;
  setCommandOpen: (open: boolean) => void;
  setDumpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setPlusOpen: (open: boolean, context?: InsertContext) => void;
  upsertNote: (note: Note, opts?: { renameFrom?: string }) => void;
  patchNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  createPage: (opts?: {
    parent?: string;
    title?: string;
    body?: string;
    tags?: string[];
    path?: string;
    template?: boolean;
    stay?: boolean;
    folder?: string;
    props?: Record<string, unknown>;
  }) => string;
  createDatabase: (opts?: {
    viewType?: DbViewType;
    title?: string;
    stay?: boolean;
    folder?: string;
    path?: string;
  }) => string;
  createDaily: () => string;
  createEvent: (opts: {
    title: string;
    body?: string;
    date: string;
    project?: string;
    tags?: string[];
  }) => string;
  patchEvent: (id: string, patch: Partial<VaultEvent>) => void;
  deleteEvent: (id: string) => void;
  setBoard: (patch: Partial<FreeformBoard>) => void;
  upsertBoardObject: (obj: FreeformObject) => void;
  patchBoardObject: (id: string, patch: Partial<FreeformObject>) => void;
  removeBoardObject: (id: string) => void;
  clearBoard: () => void;
  duplicateNote: (id: string) => string;
  addDatabaseView: (dbId: string, type: DbViewType) => string;
  putBlob: (file: Blob, path: string, mime?: string) => Promise<string>;
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

async function flush(s: {
  notes: Note[];
  blobs: Record<string, BlobRecord>;
  events: VaultEvent[];
  board: FreeformBoard;
  theme: "light" | "dark";
  ai: AiSettings;
  displayName: string;
  folderName: string | null;
  recents: string[];
  starred: string[];
  view: AppView;
  activeWorkspaceId: string;
  workspaces: Workspace[];
}) {
  const files = filesFromNotes(s.notes);
  const wsId = s.activeWorkspaceId;
  await saveFiles(files, wsId);
  await saveBlobs(s.blobs, wsId);
  await saveEvents(s.events, wsId);
  await saveBoard(s.board, wsId);
  await saveWorkspaceVaultMeta(wsId, {
    hasVault: s.view.kind !== "welcome",
    lastPath: s.folderName ?? undefined,
    recents: s.recents,
    starred: s.starred,
  });
  await saveMeta({
    theme: s.theme,
    ai: s.ai,
    displayName: s.displayName.trim() || "You",
  });
  await saveWorkspacesRegistry({
    activeId: wsId,
    workspaces: s.workspaces,
  });
  if (dirHandle) {
    try {
      await writeVaultToDirectory(dirHandle, files, s.blobs);
    } catch {
      /* permission may have lapsed */
    }
  }
  channel?.postMessage({ type: "vault", tab: TAB_ID, workspaceId: wsId });
}

async function loadWorkspaceIntoState(workspaceId: string) {
  const files = await loadFiles(workspaceId);
  const blobs = await loadBlobs(workspaceId);
  const events = await loadEvents(workspaceId);
  const board = await loadBoard(workspaceId);
  const vaultMeta = await loadWorkspaceVaultMeta(workspaceId);
  const hasContent = Boolean(files && Object.keys(files).length);
  if (vaultMeta.hasVault && hasContent) {
    const notes = notesFromFiles(files!);
    return {
      notes,
      blobs,
      events,
      board,
      folderName: vaultMeta.lastPath ?? null,
      recents: (vaultMeta.recents ?? []).filter((id) => notes.some((n) => n.id === id)),
      starred: (vaultMeta.starred ?? []).filter((id) => notes.some((n) => n.id === id)),
      view: homeView(notes),
    };
  }
  return {
    notes: [] as Note[],
    blobs,
    events,
    board,
    folderName: vaultMeta.lastPath ?? null,
    recents: vaultMeta.recents ?? [],
    starred: vaultMeta.starred ?? [],
    view: { kind: "welcome" as const },
  };
}

export const useApp = create<AppState>((set, get) => {
  const schedule = () => {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      const s = get();
      if (!s.activeWorkspaceId) return;
      void flush(s);
    }, 350);
  };

  return {
    ready: false,
    notes: [],
    blobs: {},
    events: [],
    board: defaultFreeformBoard(),
    view: { kind: "welcome" },
    sidebarOpen: true,
    propsOpen: true,
    theme: "light",
    mode: "wysiwyg",
    displayName: "You",
    peers: [],
    ai: defaultAi(),
    commandOpen: false,
    dumpOpen: false,
    settingsOpen: false,
    plusOpen: false,
    plusContext: "sidebar",
    query: "",
    error: null,
    folderName: null,
    recents: [],
    starred: [],
    workspaces: [],
    activeWorkspaceId: "",
    workspaceSetupOpen: false,
    workspaceSetupId: null,

    hydrate: async () => {
      const { registry, globalMeta, vaultMeta } = await loadOrMigrateWorkspaces();
      applyTheme(globalMeta.theme);
      const loaded = await loadWorkspaceIntoState(registry.activeId);
      const active = registry.workspaces.find((w) => w.id === registry.activeId);
      const tools = active?.tools ?? normalizeWorkspaceTools();
      set({
        ready: true,
        ...loaded,
        view: clampViewToTools(loaded.view, tools),
        theme: globalMeta.theme,
        ai: globalMeta.ai,
        displayName: globalMeta.displayName || "You",
        workspaces: registry.workspaces,
        activeWorkspaceId: registry.activeId,
        folderName: loaded.folderName ?? vaultMeta.lastPath ?? null,
      });
      startCollab();
    },

    startDemo: async () => {
      const notes = notesFromFiles(DEMO_FILES);
      set({
        notes,
        blobs: {},
        events: [],
        board: defaultFreeformBoard(),
        view: { kind: "note", id: "welcome" },
        folderName: "Sample vault",
      });
      schedule();
    },

    startEmpty: () => {
      const tools =
        get().workspaces.find((w) => w.id === get().activeWorkspaceId)?.tools ??
        normalizeWorkspaceTools();
      set({
        notes: [],
        blobs: {},
        events: [],
        board: defaultFreeformBoard(),
        view: clampViewToTools({ kind: "graph" }, tools),
        folderName:
          get().workspaces.find((w) => w.id === get().activeWorkspaceId)?.name ?? "Vault",
      });
      schedule();
    },

    openFolder: async () => {
      try {
        const dir = await pickVaultFolder();
        dirHandle = dir;
        const { files, blobs } = await walkVault(dir);
        const notes = notesFromFiles(files);
        if (!notes.length) {
          const seeded = notesFromFiles(DEMO_FILES);
          set({ notes: seeded, blobs, view: { kind: "note", id: "welcome" }, folderName: dir.name, error: null });
          await writeVaultToDirectory(dir, filesFromNotes(seeded), blobs);
        } else {
          const home = notes.find((n) => n.type === "page") ?? notes[0];
          set({
            notes,
            blobs,
            folderName: dir.name,
            error: null,
            view:
              home.type === "database"
                ? { kind: "database", id: home.id }
                : { kind: "note", id: home.id },
          });
        }
        schedule();
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        set({ error: e instanceof Error ? e.message : "Could not open folder" });
      }
    },

    saveToFolder: async () => {
      try {
        const dir = dirHandle ?? (await pickVaultFolder());
        dirHandle = dir;
        await writeVaultToDirectory(dir, filesFromNotes(get().notes), get().blobs);
        set({ folderName: dir.name, error: null });
        schedule();
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        set({ error: e instanceof Error ? e.message : "Could not write folder" });
      }
    },

    importMarkdown: async () => {
      try {
        const files = (await pickFiles(".md,text/markdown", true)).filter((f) =>
          f.name.toLowerCase().endsWith(".md"),
        );
        if (!files.length) return;

        let notes = get().notes;
        let last: Note | undefined;
        for (const file of files) {
          const raw = await file.text();
          const pathName = file.name.replace(/^.*[/\\]/, "");
          let note = fileToNote(pathName, raw);
          const id = notes.some((n) => n.id === note.id) ? nid() : note.id;
          const path = uniquePath(notes, note.path, id);
          note = { ...note, id, path, updated: todayIso() };
          notes = [...notes.filter((n) => n.id !== note.id && n.path !== note.path), note].sort((a, b) =>
            a.title.localeCompare(b.title),
          );
          last = note;
        }

        if (!last) return;
        set({
          notes,
          error: null,
          view:
            last.type === "database"
              ? { kind: "database", id: last.id }
              : { kind: "note", id: last.id },
        });
        schedule();
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        set({ error: e instanceof Error ? e.message : "Could not import markdown" });
      }
    },

    switchWorkspace: async (id) => {
      const s = get();
      if (!id || id === s.activeWorkspaceId) return;
      if (!s.workspaces.some((w) => w.id === id)) return;
      window.clearTimeout(persistTimer);
      await flush(s);
      dirHandle = null;
      const loaded = await loadWorkspaceIntoState(id);
      const tools =
        s.workspaces.find((w) => w.id === id)?.tools ?? normalizeWorkspaceTools();
      set({
        activeWorkspaceId: id,
        ...loaded,
        view: clampViewToTools(loaded.view, tools),
        query: "",
        dumpOpen: false,
        plusOpen: false,
        workspaceSetupOpen: false,
        workspaceSetupId: null,
        error: null,
      });
      await saveWorkspacesRegistry({ activeId: id, workspaces: get().workspaces });
      ping();
    },

    createWorkspace: async (input) => {
      const s = get();
      window.clearTimeout(persistTimer);
      if (s.activeWorkspaceId) await flush(s);
      dirHandle = null;
      const ws = createWorkspaceDraft({
        name: input.name,
        tools: input.tools,
        aiMode: input.aiMode,
      });
      await saveWorkspaceVaultMeta(ws.id, { hasVault: false, recents: [], starred: [] });
      await saveFiles({}, ws.id);
      await saveBlobs({}, ws.id);
      await saveEvents([], ws.id);
      await saveBoard(defaultFreeformBoard(), ws.id);
      const workspaces = [...s.workspaces, ws];
      set({
        workspaces,
        activeWorkspaceId: ws.id,
        notes: [],
        blobs: {},
        events: [],
        board: defaultFreeformBoard(),
        view: clampViewToTools({ kind: "graph" }, ws.tools),
        folderName: ws.name,
        recents: [],
        starred: [],
        query: "",
        dumpOpen: false,
        plusOpen: false,
        workspaceSetupOpen: false,
        workspaceSetupId: null,
        error: null,
      });
      await saveWorkspacesRegistry({ activeId: ws.id, workspaces });
      await saveWorkspaceVaultMeta(ws.id, { hasVault: true, lastPath: ws.name, recents: [], starred: [] });
      schedule();
    },

    updateWorkspace: (id, patch) => {
      const workspaces = get().workspaces.map((w) => {
        if (w.id !== id) return w;
        return {
          ...w,
          name: patch.name !== undefined ? patch.name.trim() || w.name : w.name,
          tools: patch.tools ? normalizeWorkspaceTools({ ...w.tools, ...patch.tools }) : w.tools,
          aiMode: patch.aiMode ?? w.aiMode,
          updated: todayIso(),
        };
      });
      const active = workspaces.find((w) => w.id === get().activeWorkspaceId);
      const next: Partial<AppState> = { workspaces };
      if (active && id === get().activeWorkspaceId) {
        next.view = clampViewToTools(get().view, active.tools);
        if (patch.name !== undefined) next.folderName = active.name;
      }
      set(next);
      schedule();
    },

    openWorkspaceSetup: (id = null) => {
      set({ workspaceSetupOpen: true, workspaceSetupId: id });
    },
    closeWorkspaceSetup: () => {
      set({ workspaceSetupOpen: false, workspaceSetupId: null });
    },

    setView: (view) => {
      const tools =
        get().workspaces.find((w) => w.id === get().activeWorkspaceId)?.tools ??
        normalizeWorkspaceTools();
      const next = clampViewToTools(view, tools);
      const noteId = viewNoteId(next);
      if (noteId) {
        const recents = [noteId, ...get().recents.filter((x) => x !== noteId)].slice(0, 3);
        set({ view: next, recents });
        schedule();
      } else {
        set({ view: next });
      }
      ping();
    },
    toggleStar: (id) => {
      const starred = get().starred.includes(id)
        ? get().starred.filter((x) => x !== id)
        : [id, ...get().starred];
      set({ starred });
      schedule();
    },
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
      schedule();
    },
    setMode: (mode) => set({ mode }),
    setDisplayName: (displayName) => {
      // Keep raw value while typing; callers commit trim/fallback on blur.
      // Coercing to "You" on every keystroke made the controlled field snap
      // back whenever the input briefly emptied (same class of bug as titles).
      set({ displayName });
      schedule();
      ping();
    },
    setAi: (ai) => {
      set({ ai: { ...get().ai, ...ai } });
      schedule();
    },
    setQuery: (query) => set({ query }),
    setError: (error) => set({ error }),
    toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
    toggleProps: () => set({ propsOpen: !get().propsOpen }),
    setCommandOpen: (commandOpen) => set({ commandOpen }),
    setDumpOpen: (dumpOpen) => set({ dumpOpen }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    setPlusOpen: (plusOpen, context) =>
      set({ plusOpen, plusContext: context ?? get().plusContext }),

    addComment: (noteId, body) => {
      const text = body.trim();
      if (!text) return;
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;
      const comment: NoteComment = {
        id: nid(),
        body: text,
        author: get().displayName.trim() || "You",
        created: todayIso(),
      };
      get().patchNote(noteId, { comments: [...(note.comments ?? []), comment] });
    },
    resolveComment: (noteId, commentId, resolved = true) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note?.comments) return;
      get().patchNote(noteId, {
        comments: note.comments.map((c) => (c.id === commentId ? { ...c, resolved } : c)),
      });
    },
    removeComment: (noteId, commentId) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note?.comments) return;
      get().patchNote(noteId, { comments: note.comments.filter((c) => c.id !== commentId) });
    },

    upsertNote: (note, opts) => {
      const notes = get().notes.filter((n) => n.id !== note.id && n.path !== opts?.renameFrom);
      set({ notes: [...notes, note].sort((a, b) => a.title.localeCompare(b.title)) });
      schedule();
    },

    patchNote: (id, patch) => {
      const notes = get().notes.map((n) =>
        n.id === id ? { ...n, ...patch, updated: todayIso() } : n,
      );
      set({ notes });
      schedule();
    },

    deleteNote: (id) => {
      const notes = get().notes.filter((n) => n.id !== id && n.parent !== id);
      const view = get().view;
      const lost =
        (view.kind === "note" && view.id === id) ||
        (view.kind === "database" && view.id === id);
      set({
        notes,
        view: lost ? (notes[0] ? { kind: "note", id: notes[0].id } : { kind: "graph" }) : view,
      });
      schedule();
    },

    createPage: (opts) => {
      const id = nid();
      const title = opts?.title?.trim() || "Untitled";
      const parent = opts?.parent;
      const parentNote = parent ? get().notes.find((n) => n.id === parent) : undefined;
      const parentDir = parentNote?.path.includes("/")
        ? parentNote.path.replace(/\/[^/]+$/, "")
        : undefined;
      const folder =
        opts?.folder ?? parentDir ?? (parentNote ? slugify(parentNote.title) : undefined);
      let path =
        opts?.path ?? (folder ? `${folder}/${slugify(title)}.md` : `${slugify(title)}.md`);
      path = uniquePath(get().notes, path, id);
      const now = todayIso();
      const note: Note = {
        id,
        path,
        title,
        body: opts?.body ?? "",
        type: "page",
        tags: opts?.tags ?? [],
        parent,
        template: opts?.template,
        props: { ...applyDefaults(parentNote?.schema), ...(opts?.props ?? {}) },
        created: now,
        updated: now,
      };
      get().upsertNote(note);
      if (!opts?.stay) {
        set({
          view: parent ? { kind: "database", id: parent } : { kind: "note", id },
          mode: "wysiwyg",
        });
        if (!parent) set({ view: { kind: "note", id } });
      }
      return id;
    },

    createDatabase: (opts) => {
      const id = nid();
      const title = opts?.title?.trim() || "New database";
      const now = todayIso();
      const views = defaultViews();
      const preferred = opts?.viewType
        ? views.find((v) => v.type === opts.viewType) ?? newView(opts.viewType)
        : views[0];
      const all = views.some((v) => v.id === preferred.id) ? views : [preferred, ...views];
      const basePath = opts?.path
        ? opts.path
        : opts?.folder
          ? `${opts.folder.replace(/\/$/, "")}/${slugify(title)}.database.md`
          : `${slugify(title)}.database.md`;
      const note: Note = {
        id,
        path: uniquePath(get().notes, basePath, id),
        title,
        body: "",
        type: "database",
        tags: [],
        props: {},
        schema: [
          { key: "status", name: "Status", type: "select", options: ["Inbox", "Active", "Done"] },
          { key: "due", name: "Due", type: "date" },
          { key: "related", name: "Related", type: "relation" },
        ],
        views: all,
        created: now,
        updated: now,
      };
      get().upsertNote(note);
      if (!opts?.stay) {
        set({ view: { kind: "database", id, viewId: preferred.id } });
      }
      return id;
    },

    createDaily: () => {
      const date = todayDate();
      const path = `Daily/${date}.md`;
      const existing = get().notes.find((n) => n.path === path || n.title === date);
      if (existing) {
        set({ view: { kind: "note", id: existing.id }, mode: "wysiwyg" });
        return existing.id;
      }
      return get().createPage({ title: date, path, body: `# ${date}\n\n` });
    },

    createEvent: (opts) => {
      const id = nid();
      const now = todayIso();
      const date = (opts.date || todayDate()).slice(0, 10);
      const event: VaultEvent = {
        id,
        title: opts.title.trim() || "Untitled event",
        body: opts.body?.trim() ?? "",
        date,
        project: opts.project?.trim() || undefined,
        tags: opts.tags ?? [],
        created: now,
        updated: now,
      };
      set({ events: [...get().events, event] });
      schedule();
      return id;
    },

    patchEvent: (id, patch) => {
      set({
        events: get().events.map((e) =>
          e.id === id ? { ...e, ...patch, id: e.id, updated: todayIso() } : e,
        ),
      });
      schedule();
    },

    deleteEvent: (id) => {
      set({ events: get().events.filter((e) => e.id !== id) });
      schedule();
    },

    setBoard: (patch) => {
      const cur = get().board;
      set({
        board: {
          ...cur,
          ...patch,
          id: cur.id,
          updated: todayIso(),
        },
      });
      schedule();
    },

    upsertBoardObject: (obj) => {
      const cur = get().board;
      const exists = cur.objects.some((o) => o.id === obj.id);
      set({
        board: {
          ...cur,
          objects: exists
            ? cur.objects.map((o) => (o.id === obj.id ? obj : o))
            : [...cur.objects, obj],
          updated: todayIso(),
        },
      });
      schedule();
    },

    patchBoardObject: (id, patch) => {
      const cur = get().board;
      set({
        board: {
          ...cur,
          objects: cur.objects.map((o) => {
            if (o.id !== id) return o;
            return { ...o, ...patch, id: o.id, type: o.type } as FreeformObject;
          }),
          updated: todayIso(),
        },
      });
      schedule();
    },

    removeBoardObject: (id) => {
      const cur = get().board;
      set({
        board: {
          ...cur,
          objects: cur.objects
            .filter((o) => o.id !== id)
            .map((o) =>
              o.type === "mind" && o.parentId === id ? { ...o, parentId: undefined } : o,
            ),
          connections: (cur.connections ?? []).filter((c) => c.from !== id && c.to !== id),
          updated: todayIso(),
        },
      });
      schedule();
    },

    clearBoard: () => {
      const cur = get().board;
      set({
        board: {
          ...cur,
          objects: [],
          connections: [],
          camera: { x: 0, y: 0, zoom: 1 },
          updated: todayIso(),
        },
      });
      schedule();
    },

    duplicateNote: (id) => {
      const src = get().notes.find((n) => n.id === id);
      if (!src) return get().createPage();
      return get().createPage({
        title: src.title,
        body: src.body,
        tags: src.tags,
        parent: src.parent,
        template: false,
      });
    },

    addDatabaseView: (dbId, type) => {
      const db = get().notes.find((n) => n.id === dbId);
      if (!db) return "";
      const view: DbView = newView(type);
      get().patchNote(dbId, { views: [...(db.views ?? []), view] });
      set({ view: { kind: "database", id: dbId, viewId: view.id } });
      return view.id;
    },

    putBlob: async (file, path, mime) => {
      const data = await file.arrayBuffer();
      set({
        blobs: {
          ...get().blobs,
          [path]: { mime: mime || file.type || "application/octet-stream", data },
        },
      });
      schedule();
      return path;
    },
  };
});

function ping() {
  if (!channel) return;
  const s = useApp.getState();
  channel.postMessage({
    type: "hello",
    tab: TAB_ID,
    name: s.displayName.trim() || "You",
    noteId: viewNoteId(s.view),
    at: Date.now(),
  });
}

function startCollab() {
  if (typeof BroadcastChannel === "undefined" || channel) return;
  channel = new BroadcastChannel("klever-vault");
  channel.onmessage = (ev) => {
    const msg = ev.data as {
      type?: string;
      tab?: string;
      name?: string;
      noteId?: string;
      at?: number;
      workspaceId?: string;
    };
    if (!msg || msg.tab === TAB_ID) return;
    if (msg.type === "vault") {
      void (async () => {
        const wsId = useApp.getState().activeWorkspaceId;
        if (msg.workspaceId && msg.workspaceId !== wsId) return;
        const files = await loadFiles(wsId);
        const blobs = await loadBlobs(wsId);
        const events = await loadEvents(wsId);
        if (files && Object.keys(files).length) {
          useApp.setState({ notes: notesFromFiles(files), blobs, events });
        } else {
          useApp.setState({ events });
        }
      })();
    }
    if (msg.type === "hello" && msg.tab) {
      const now = Date.now();
      const peers = useApp.getState().peers.filter((p) => p.id !== msg.tab && now - p.at < 12000);
      useApp.setState({
        peers: [
          ...peers,
          { id: msg.tab, name: msg.name || "Guest", noteId: msg.noteId, at: msg.at ?? now },
        ],
      });
    }
  };
  window.clearInterval(helloTimer);
  helloTimer = window.setInterval(() => {
    ping();
    const now = Date.now();
    const next = useApp.getState().peers.filter((p) => now - p.at < 12000);
    if (next.length !== useApp.getState().peers.length) useApp.setState({ peers: next });
  }, 4000);
  ping();
}
