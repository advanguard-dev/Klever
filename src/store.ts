import { create } from "zustand";
import type {
  AiSettings,
  CalendarSource,
  CalSettings,
  AppView,
  BlobRecord,
  DbView,
  DbViewType,
  DevSettings,
  EditorMode,
  FreeformBoard,
  FreeformObject,
  InsertContext,
  Note,
  NoteComment,
  SchemaProp,
  Peer,
  VaultEvent,
  Workspace,
  WorkspaceAiMode,
  WorkspaceLock,
  WorkspaceTools,
} from "@/types";
import { defaultAi } from "@/lib/ai";
import { defaultDevSettings, normalizeDevSettings } from "@/lib/dev-settings";
import { applyDocumentLang, detectBrowserLocale, resolveLocale, type Locale } from "@/lib/i18n";
import {
  defaultCalendarSources,
  defaultSourceName,
  dropEventsForSource,
  inferCalendarKind,
  migrateCalendarSources,
  normalizeFeedUrl,
  syncOneFeed,
} from "@/lib/calendar-sync";
import { defaultCalSettings } from "@/lib/calcom";
import { DEMO_FILES } from "@/lib/demo";
import { assetPathFor, mimeFromPath, pickFiles, pickLocalFiles, refreshBlobFromHandle, refreshBlobsFromDisk, safeFileName } from "@/lib/assets";
import { nid, slugify, todayDate, todayIso } from "@/lib/ids";
import { handleDroppedFiles } from "@/lib/drop-files";
import { isElectron } from "@/lib/electron";
import { filterRemoveKey } from "@/lib/views";
import {
  assertPassword,
  exportDekB64,
  generateDek,
  importDekB64,
  LockedVaultError,
  unwrapDekWithPassword,
  wrapDekWithPassword,
} from "@/lib/vault-crypto";
import { clearSessionDek, isSessionUnlocked, sessionDekFor, setSessionDek } from "@/lib/vault-session";
import { isEncryptedWorkspace, lockFromWrap, wrapFromLock } from "@/lib/workspace-lock";
import { isTouchCancel, touchEncryptSecret, touchUnlockSecret } from "@/lib/touch-id";
import { blobsFromDesktopPayload, blobsToDesktopPayload, externalFileBlob } from "@/lib/open-local-file";
import { localPathFromFile } from "@/lib/local-file-path";
import { fileToNote, normalizeNote, noteToFile, notesFromFiles } from "@/lib/parse";
import { defaultViews, newView } from "@/lib/views";
import {
  canMoveFolder,
  existingFolderPaths,
  filesFromFolderIcons,
  mergeFolderIcons,
  nestedFolderPath,
  nextFolderPath,
  notesToDeleteWithFolder,
  omitFolderIcons,
  remapFolderIcons,
  rewritePathPrefix,
  uniqueFolderPath,
} from "@/lib/folders";
import { createWorkspaceDraft, normalizeWorkspaceTools } from "@/lib/workspaces";
import {
  defaultFreeformBoard,
  loadBlobs,
  loadBoards,
  loadEvents,
  loadFiles,
  loadOrMigrateWorkspaces,
  loadWorkspaceVaultMeta,
  nextBoardTitle,
  pickVaultFolder,
  readBlobFromVault,
  saveBlobs,
  saveBoards,
  saveEvents,
  saveFiles,
  saveMeta,
  saveWorkspaceVaultMeta,
  saveWorkspacesRegistry,
  walkVault,
  writeVaultToDirectory,
} from "@/lib/persist";
import { notifyLocalWebhooks, runAfterSaveHooks, runBeforeFlushHooks } from "@/lib/save-hooks";

let dirHandle: FileSystemDirectoryHandle | null = null;
let vaultRootPath: string | null = null;
let persistTimer: number | undefined;
let flushInFlight: Promise<void> | null = null;
const dirtyBodies = new Map<string, string>();
const TAB_ID = nid();
let channel: BroadcastChannel | null = null;
let helloTimer: number | undefined;

function applyLocalApiConfig(dev: DevSettings) {
  void window.kleverDesktop?.configureLocalApi?.({
    enabled: dev.localApiEnabled,
    port: dev.localApiPort,
    token: dev.localApiToken,
  });
}

function viewNoteId(view: AppView) {
  return view.kind === "note" || view.kind === "database" ? view.id : undefined;
}

const OPEN_TABS_MAX = 16;

function withOpenTab(tabs: string[], id: string) {
  if (tabs.includes(id)) return tabs;
  const next = [...tabs, id];
  return next.length > OPEN_TABS_MAX ? next.slice(next.length - OPEN_TABS_MAX) : next;
}

function noteAppView(note: Note): AppView {
  return note.type === "database" ? { kind: "database", id: note.id } : { kind: "note", id: note.id };
}

function seedOpenTabs(tabs: string[], current: string | undefined, notes: Note[]) {
  const existing = tabs.filter((id) => notes.some((n) => n.id === id));
  if (!current || existing.includes(current) || !notes.some((n) => n.id === current)) return existing;
  return [...existing, current];
}

function filesFromNotes(notes: Note[]) {
  const files: Record<string, string> = {};
  for (const n of notes) files[n.path] = noteToFile(normalizeNote(n));
  return files;
}

function vaultFiles(notes: Note[], folderIcons: Record<string, string> = {}) {
  return { ...filesFromNotes(notes), ...filesFromFolderIcons(folderIcons) };
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

function fallbackToolView(tools: WorkspaceTools, boards?: FreeformBoard[]): AppView {
  if (tools.graph) return { kind: "graph" };
  if (tools.calendar) return { kind: "calendar" };
  if (tools.meeting) return { kind: "meeting" };
  if (tools.board) return { kind: "freeform", id: boards?.[0]?.id };
  return { kind: "welcome" };
}

function clampViewToTools(view: AppView, tools: WorkspaceTools, boards?: FreeformBoard[]): AppView {
  if (view.kind === "unlock" || view.kind === "welcome") return view;
  if (view.kind === "calendar" && !tools.calendar) return fallbackToolView(tools, boards);
  if (view.kind === "meeting" && !tools.meeting) return fallbackToolView(tools, boards);
  if (view.kind === "freeform") {
    if (!tools.board) return fallbackToolView(tools, boards);
    const id =
      (view.id && boards?.some((b) => b.id === view.id) && view.id) ||
      boards?.[0]?.id ||
      "main";
    return { kind: "freeform", id };
  }
  if (view.kind === "graph" && !tools.graph) return fallbackToolView(tools, boards);
  return view;
}

function activeBoardId(s: { view: AppView; boards: FreeformBoard[] }): string {
  if (s.view.kind === "freeform") {
    const id = s.view.id;
    if (id && s.boards.some((b) => b.id === id)) return id;
  }
  return s.boards[0]?.id ?? "main";
}

function withActiveBoard(
  s: { view: AppView; boards: FreeformBoard[] },
  fn: (b: FreeformBoard) => FreeformBoard,
): FreeformBoard[] {
  const id = activeBoardId(s);
  const boards = s.boards.length ? s.boards : [defaultFreeformBoard({ id })];
  if (!boards.some((b) => b.id === id)) {
    return [...boards, { ...fn(defaultFreeformBoard({ id })), id, updated: todayIso() }];
  }
  return boards.map((b) => (b.id === id ? { ...fn(b), id: b.id, updated: todayIso() } : b));
}

interface AppState {
  ready: boolean;
  notes: Note[];
  blobs: Record<string, BlobRecord>;
  events: VaultEvent[];
  boards: FreeformBoard[];
  view: AppView;
  sidebarOpen: boolean;
  propsOpen: boolean;
  theme: "light" | "dark";
  mode: EditorMode;
  strongFocus: boolean;
  /** UI chrome locale. Note bodies are not translated. */
  locale: Locale;
  displayName: string;
  peers: Peer[];
  ai: AiSettings;
  cal: CalSettings;
  calendarSources: CalendarSource[];
  calendarSyncing: boolean;
  dev: DevSettings;
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
  openTabs: string[];
  /** Vault folder path → icon (emoji or lucide:name). */
  folderIcons: Record<string, string>;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  workspaceSetupOpen: boolean;
  workspaceSetupId: string | null;
  /** False while an encrypted workspace is waiting for password / Touch ID. */
  unlocked: boolean;
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
    password?: string;
    touchId?: boolean;
  }) => Promise<void>;
  updateWorkspace: (
    id: string,
    patch: { name?: string; tools?: Partial<WorkspaceTools>; aiMode?: WorkspaceAiMode; lock?: WorkspaceLock | null },
  ) => void;
  enableWorkspaceLock: (password: string, confirm: string, touchId?: boolean) => Promise<void>;
  disableWorkspaceLock: (password: string) => Promise<void>;
  changeWorkspacePassword: (current: string, next: string, confirm: string) => Promise<void>;
  setWorkspaceTouchId: (enabled: boolean) => Promise<void>;
  lockWorkspace: () => Promise<void>;
  unlockWorkspace: (password: string) => Promise<void>;
  unlockWorkspaceWithTouchId: () => Promise<void>;
  openWorkspaceSetup: (id?: string | null) => void;
  closeWorkspaceSetup: () => void;
  setView: (view: AppView) => void;
  closeOpenTab: (id: string) => void;
  toggleStar: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setStrongFocus: (on: boolean) => void;
  setLocale: (locale: Locale) => void;
  setMode: (mode: EditorMode) => void;
  setDisplayName: (name: string) => void;
  addComment: (noteId: string, body: string) => void;
  resolveComment: (noteId: string, commentId: string, resolved?: boolean) => void;
  removeComment: (noteId: string, commentId: string) => void;
  setAi: (ai: Partial<AiSettings>) => void;
  setCal: (cal: Partial<CalSettings>) => void;
  setDev: (p: Partial<DevSettings>) => void;
  addCalendarSource: (opts: { url: string; name?: string; kind?: CalendarSource["kind"] }) => Promise<void>;
  connectCalendarProvider: (kind: "google" | "apple", url: string) => Promise<void>;
  removeCalendarSource: (id: string) => void;
  syncCalendarFeeds: (opts?: { sourceId?: string }) => Promise<void>;
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
  /** Remove a schema property and any stored values on that database’s rows. */
  deleteProperty: (schemaNoteId: string, key: string) => void;
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
    icon?: string;
    props?: Record<string, unknown>;
  }) => string;
  createDatabase: (opts?: {
    viewType?: DbViewType;
    title?: string;
    stay?: boolean;
    folder?: string;
    path?: string;
    icon?: string;
    schema?: SchemaProp[];
    views?: DbView[];
  }) => string;
  createDaily: () => string;
  createEvent: (opts: {
    title: string;
    body?: string;
    date: string;
    project?: string;
    tags?: string[];
    calUrl?: string;
    calBookingUid?: string;
  }) => string;
  patchEvent: (id: string, patch: Partial<VaultEvent>) => void;
  deleteEvent: (id: string) => void;
  setBoard: (patch: Partial<FreeformBoard>) => void;
  upsertBoardObject: (obj: FreeformObject) => void;
  patchBoardObject: (id: string, patch: Partial<FreeformObject>) => void;
  removeBoardObject: (id: string) => void;
  clearBoard: () => void;
  createBoard: (title?: string) => string;
  deleteBoard: (id: string) => void;
  leaveBoard: () => void;
  duplicateNote: (id: string) => string;
  addDatabaseView: (dbId: string, type: DbViewType) => string;
  putBlob: (file: Blob, path: string, mime?: string) => Promise<string>;
  /** Load blob bytes when missing — from handle, vault folder, or disk. */
  ensureBlob: (path: string) => Promise<void>;
  /** Attach a disk/cloud file by reading it in place — no vault copy. */
  linkLocalFile: (accept?: string) => Promise<string | null>;
  /** Attach one or more disk files (multi-select). Returns vault paths. */
  linkLocalFiles: (accept?: string) => Promise<string[]>;
  /** Flush pending edits to IndexedDB (and linked folder if open). */
  flushNow: () => Promise<void>;
  /** Move a vault page/database to another folder (path-based tree). */
  moveNoteToFolder: (id: string, folder: string) => void;
  /** Nest a folder under another (or vault root when dest is ""). */
  moveFolder: (from: string, dest: string) => string | undefined;
  renameFolder: (path: string, name: string) => string | undefined;
  deleteFolder: (path: string) => void;
  setFolderIcon: (path: string, icon: string | undefined) => void;
  /** Store a File from drag-and-drop into vault blobs. */
  storeFileFromDrop: (file: File) => Promise<string>;
  /** Import dropped files — markdown as pages, others attach at cursor / drop point. */
  importDroppedFiles: (
    files: File[],
    opts?: { folder?: string; attachToNoteId?: string; at?: { clientX: number; clientY: number } },
  ) => Promise<void>;
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyStrongFocus(on: boolean) {
  document.documentElement.classList.toggle("klever-a11y-focus", on);
}

function applyLocale(locale: Locale) {
  applyDocumentLang(locale);
}

function lockedShell(folderName: string | null) {
  return {
    notes: [] as Note[],
    blobs: {} as Record<string, BlobRecord>,
    events: [] as VaultEvent[],
    boards: [defaultFreeformBoard()],
    recents: [] as string[],
    starred: [] as string[],
    openTabs: [] as string[],
    query: "",
    dumpOpen: false,
    plusOpen: false,
    commandOpen: false,
    settingsOpen: false,
    workspaceSetupOpen: false,
    workspaceSetupId: null as string | null,
    view: { kind: "unlock" as const },
    unlocked: false,
    folderName,
    folderIcons: {} as Record<string, string>,
  };
}

async function bindVaultFolder(workspaceId: string, encrypted: boolean) {
  dirHandle = null;
  if (encrypted) {
    vaultRootPath = null;
    if (window.kleverDesktop?.setVaultRoot) void window.kleverDesktop.setVaultRoot("");
    return;
  }
  const meta = await loadWorkspaceVaultMeta(workspaceId);
  vaultRootPath = meta.vaultRootPath ?? null;
  if (vaultRootPath && window.kleverDesktop?.setVaultRoot) {
    void window.kleverDesktop.setVaultRoot(vaultRootPath);
  }
}

async function flush(s: {
  notes: Note[];
  blobs: Record<string, BlobRecord>;
  events: VaultEvent[];
  boards: FreeformBoard[];
  theme: "light" | "dark";
  strongFocus: boolean;
  locale: Locale;
  ai: AiSettings;
  cal: CalSettings;
  calendarSources: CalendarSource[];
  displayName: string;
  folderName: string | null;
  recents: string[];
  starred: string[];
  openTabs: string[];
  folderIcons: Record<string, string>;
  view: AppView;
  activeWorkspaceId: string;
  workspaces: Workspace[];
  dev: DevSettings;
}) {
  const wsId = s.activeWorkspaceId;
  if (!wsId) return;
  const ws = s.workspaces.find((w) => w.id === wsId);
  const encrypted = isEncryptedWorkspace(ws);
  const dek = sessionDekFor(wsId);

  await saveMeta({
    theme: s.theme,
    ai: { ...s.ai, locale: s.locale },
    cal: s.cal,
    calendarSources: s.calendarSources,
    displayName: s.displayName.trim() || "You",
    strongFocus: s.strongFocus,
    locale: s.locale,
    dev: s.dev,
  });
  await saveWorkspacesRegistry({
    activeId: wsId,
    workspaces: s.workspaces,
  });

  // Locked screen holds empty in-memory notes — never overwrite ciphertext with that.
  if (encrypted && !dek) return;

  const files = vaultFiles(s.notes, s.folderIcons);
  await saveFiles(files, wsId, dek);
  await saveBlobs(s.blobs, wsId, dek);
  await saveEvents(s.events, wsId, dek);
  await saveBoards(s.boards, wsId, dek);
  await saveWorkspaceVaultMeta(wsId, {
    hasVault: s.view.kind !== "welcome" && s.view.kind !== "unlock",
    lastPath: s.folderName ?? undefined,
    vaultRootPath: encrypted ? undefined : vaultRootPath ?? undefined,
    recents: s.recents,
    starred: s.starred,
    openTabs: s.openTabs,
    folderIcons: Object.keys(s.folderIcons).length ? s.folderIcons : undefined,
  });

  if (!encrypted) {
    if (dirHandle) {
      try {
        await writeVaultToDirectory(dirHandle, files, s.blobs);
      } catch {
        /* permission may have lapsed */
      }
    } else if (vaultRootPath && window.kleverDesktop?.writeVault) {
      try {
        await window.kleverDesktop.writeVault(vaultRootPath, files, blobsToDesktopPayload(s.blobs));
      } catch {
        /* disk write may have failed */
      }
    }
  }
  channel?.postMessage({ type: "vault", tab: TAB_ID, workspaceId: wsId });
  dirtyBodies.clear();
  const afterSave = {
    workspaceId: wsId,
    noteCount: s.notes.length,
    at: Date.now(),
  };
  await runAfterSaveHooks(afterSave);
  await notifyLocalWebhooks(s.dev.webhookUrls, afterSave);
}

async function flushNowInternal(getState: () => AppState) {
  window.clearTimeout(persistTimer);
  persistTimer = undefined;
  runBeforeFlushHooks();
  window.clearTimeout(persistTimer);
  persistTimer = undefined;
  const s = getState();
  if (!s.activeWorkspaceId) return;
  await flush(s);
}

async function loadWorkspaceIntoState(workspaceId: string) {
  const dek = sessionDekFor(workspaceId);
  try {
    const files = await loadFiles(workspaceId, dek);
    const blobs = await refreshBlobsFromDisk(await loadBlobs(workspaceId, dek));
    const events = await loadEvents(workspaceId, dek);
    const boards = await loadBoards(workspaceId, dek);
    const vaultMeta = await loadWorkspaceVaultMeta(workspaceId);
    const hasContent = Boolean(files && Object.keys(files).length);
    if (vaultMeta.hasVault && hasContent) {
      const notes = notesFromFiles(files!).map(normalizeNote);
      return {
        notes,
        blobs,
        events,
        boards,
        folderName: vaultMeta.lastPath ?? null,
        folderIcons: mergeFolderIcons(files, vaultMeta.folderIcons),
        recents: (vaultMeta.recents ?? []).filter((id) => notes.some((n) => n.id === id)),
        starred: (vaultMeta.starred ?? []).filter((id) => notes.some((n) => n.id === id)),
        openTabs: seedOpenTabs(vaultMeta.openTabs ?? [], viewNoteId(homeView(notes)), notes),
        view: homeView(notes),
        unlocked: true,
      };
    }
    return {
      notes: [] as Note[],
      blobs,
      events,
      boards,
      folderName: vaultMeta.lastPath ?? null,
      folderIcons: mergeFolderIcons(files, vaultMeta.folderIcons),
      recents: vaultMeta.recents ?? [],
      starred: vaultMeta.starred ?? [],
      openTabs: vaultMeta.openTabs ?? [],
      view: { kind: "welcome" as const },
      unlocked: true,
    };
  } catch (err) {
    if (err instanceof LockedVaultError) {
      const vaultMeta = await loadWorkspaceVaultMeta(workspaceId);
      return lockedShell(vaultMeta.lastPath ?? null);
    }
    throw err;
  }
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

  const flushNow = () => {
    if (!flushInFlight) {
      flushInFlight = flushNowInternal(get).finally(() => {
        flushInFlight = null;
      });
    }
    return flushInFlight;
  };

  return {
    ready: false,
    notes: [],
    blobs: {},
    events: [],
    boards: [defaultFreeformBoard()],
    view: { kind: "welcome" },
    sidebarOpen: true,
    propsOpen: false,
    theme: "light",
    strongFocus: false,
    locale: detectBrowserLocale(),
    mode: "wysiwyg",
    displayName: "You",
    peers: [],
    ai: defaultAi(),
    cal: defaultCalSettings(),
    calendarSources: defaultCalendarSources(),
    calendarSyncing: false,
    dev: defaultDevSettings(),
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
    openTabs: [],
    folderIcons: {},
    workspaces: [],
    activeWorkspaceId: "",
    workspaceSetupOpen: false,
    workspaceSetupId: null,
    unlocked: true,

    flushNow,

    hydrate: async () => {
      try {
        const { registry, globalMeta, vaultMeta } = await loadOrMigrateWorkspaces();
        applyTheme(globalMeta.theme);
        applyStrongFocus(Boolean(globalMeta.strongFocus));
        const locale = resolveLocale(globalMeta.locale ?? globalMeta.ai.locale);
        applyLocale(locale);
        const active = registry.workspaces.find((w) => w.id === registry.activeId);
        const encrypted = isEncryptedWorkspace(active);
        const dev = normalizeDevSettings(globalMeta.dev);
        if (encrypted && !isSessionUnlocked(registry.activeId)) {
          set({
            ready: true,
            ...lockedShell(active?.name ?? vaultMeta.lastPath ?? null),
            theme: globalMeta.theme,
            strongFocus: Boolean(globalMeta.strongFocus),
            locale,
            ai: { ...globalMeta.ai, locale },
            cal: globalMeta.cal,
            calendarSources: migrateCalendarSources(globalMeta.calendarSources),
            displayName: globalMeta.displayName || "You",
            dev,
            workspaces: registry.workspaces,
            activeWorkspaceId: registry.activeId,
          });
          applyLocalApiConfig(dev);
          startCollab();
          return;
        }
        const loaded = await loadWorkspaceIntoState(registry.activeId);
        const tools = active?.tools ?? normalizeWorkspaceTools();
        set({
          ready: true,
          ...loaded,
          view: clampViewToTools(loaded.view, tools, loaded.boards),
          theme: globalMeta.theme,
          strongFocus: Boolean(globalMeta.strongFocus),
          locale,
          ai: { ...globalMeta.ai, locale },
          cal: globalMeta.cal,
          calendarSources: migrateCalendarSources(globalMeta.calendarSources),
          displayName: globalMeta.displayName || "You",
          dev,
          workspaces: registry.workspaces,
          activeWorkspaceId: registry.activeId,
          folderName: loaded.folderName ?? vaultMeta.lastPath ?? null,
          unlocked: true,
        });
        applyLocalApiConfig(dev);
        if (!encrypted && vaultMeta.vaultRootPath && window.kleverDesktop?.setVaultRoot) {
          vaultRootPath = vaultMeta.vaultRootPath;
          void window.kleverDesktop.setVaultRoot(vaultMeta.vaultRootPath);
        }
        startCollab();
      } catch (err) {
        console.error("Klever failed to hydrate", err);
        set({
          ready: true,
          view: { kind: "welcome" },
          unlocked: true,
          error: err instanceof Error ? err.message : "Could not load this vault",
        });
      }
    },

    startDemo: async () => {
      const notes = notesFromFiles(DEMO_FILES);
      set({
        notes,
        blobs: {},
        events: [],
        boards: [defaultFreeformBoard()],
        view: { kind: "note", id: "welcome" },
        openTabs: ["welcome"],
        folderName: "Sample vault",
        folderIcons: mergeFolderIcons(DEMO_FILES),
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
        boards: [defaultFreeformBoard()],
        view: clampViewToTools({ kind: "graph" }, tools, [defaultFreeformBoard()]),
        openTabs: [],
        folderIcons: {},
        folderName:
          get().workspaces.find((w) => w.id === get().activeWorkspaceId)?.name ?? "Vault",
      });
      schedule();
    },

    openFolder: async () => {
      try {
        const active = get().workspaces.find((w) => w.id === get().activeWorkspaceId);
        if (isEncryptedWorkspace(active)) {
          set({
            error:
              "Encrypted workspaces stay inside Klever. They are not written as readable markdown folders.",
          });
          return;
        }
        if (isElectron() && window.kleverDesktop?.pickVault) {
          const picked = await window.kleverDesktop.pickVault();
          if (!picked) return;
          vaultRootPath = picked.path;
          dirHandle = null;
          const blobs: Record<string, BlobRecord> = {
            ...blobsFromDesktopPayload(picked.blobs),
          };
          for (const [path, rec] of Object.entries(get().blobs)) {
            if (rec.external && !(path in blobs)) blobs[path] = rec;
          }
          const live = await refreshBlobsFromDisk(blobs);
          const notes = notesFromFiles(picked.files);
          if (!notes.length) {
            const seeded = notesFromFiles(DEMO_FILES);
            set({
              notes: seeded,
              blobs: live,
              view: { kind: "note", id: "welcome" },
              openTabs: ["welcome"],
              folderName: picked.name,
              folderIcons: mergeFolderIcons(DEMO_FILES),
              error: null,
            });
            await window.kleverDesktop.writeVault(
              picked.path,
              vaultFiles(seeded, mergeFolderIcons(DEMO_FILES)),
              blobsToDesktopPayload(live),
            );
          } else {
            const home = notes.find((n) => n.type === "page") ?? notes[0];
            set({
              notes,
              blobs: live,
              folderName: picked.name,
              folderIcons: mergeFolderIcons(picked.files),
              error: null,
              view:
                home.type === "database"
                  ? { kind: "database", id: home.id }
                  : { kind: "note", id: home.id },
              openTabs: [home.id],
            });
          }
          schedule();
          return;
        }

        const dir = await pickVaultFolder();
        dirHandle = dir;
        vaultRootPath = null;
        const { files, blobs: vaultBlobs } = await walkVault(dir);
        const blobs: Record<string, BlobRecord> = { ...vaultBlobs };
        for (const [path, rec] of Object.entries(get().blobs)) {
          if (rec.external && !(path in blobs)) blobs[path] = rec;
        }
        const live = await refreshBlobsFromDisk(blobs);
        const notes = notesFromFiles(files);
        if (!notes.length) {
          const seeded = notesFromFiles(DEMO_FILES);
          set({
            notes: seeded,
            blobs: live,
            view: { kind: "note", id: "welcome" },
            openTabs: ["welcome"],
            folderName: dir.name,
            folderIcons: mergeFolderIcons(DEMO_FILES),
            error: null,
          });
          await writeVaultToDirectory(dir, vaultFiles(seeded, mergeFolderIcons(DEMO_FILES)), live);
        } else {
          const home = notes.find((n) => n.type === "page") ?? notes[0];
          set({
            notes,
            blobs: live,
            folderName: dir.name,
            folderIcons: mergeFolderIcons(files),
            error: null,
            view:
              home.type === "database"
                ? { kind: "database", id: home.id }
                : { kind: "note", id: home.id },
            openTabs: [home.id],
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
        const active = get().workspaces.find((w) => w.id === get().activeWorkspaceId);
        if (isEncryptedWorkspace(active)) {
          set({
            error:
              "Encrypted workspaces stay inside Klever. They are not written as readable markdown folders.",
          });
          return;
        }
        const dir = dirHandle ?? (await pickVaultFolder());
        dirHandle = dir;
        await writeVaultToDirectory(dir, vaultFiles(get().notes, get().folderIcons), get().blobs);
        set({ folderName: dir.name, error: null });
        schedule();
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        set({ error: e instanceof Error ? e.message : "Could not write to that folder" });
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
        set({ error: e instanceof Error ? e.message : "Could not import those files" });
      }
    },

    switchWorkspace: async (id) => {
      const s = get();
      if (!id || id === s.activeWorkspaceId) return;
      if (!s.workspaces.some((w) => w.id === id)) return;
      window.clearTimeout(persistTimer);
      await flush(s);
      clearSessionDek();
      const target = s.workspaces.find((w) => w.id === id);
      const encrypted = isEncryptedWorkspace(target);
      await bindVaultFolder(id, encrypted);
      if (encrypted) {
        set({
          activeWorkspaceId: id,
          ...lockedShell(target?.name ?? null),
          error: null,
        });
        await saveWorkspacesRegistry({ activeId: id, workspaces: get().workspaces });
        ping();
        return;
      }
      const loaded = await loadWorkspaceIntoState(id);
      const tools = target?.tools ?? normalizeWorkspaceTools();
      set({
        activeWorkspaceId: id,
        ...loaded,
        view: clampViewToTools(loaded.view, tools, loaded.boards),
        query: "",
        dumpOpen: false,
        plusOpen: false,
        workspaceSetupOpen: false,
        workspaceSetupId: null,
        error: null,
        unlocked: true,
      });
      await saveWorkspacesRegistry({ activeId: id, workspaces: get().workspaces });
      ping();
    },

    createWorkspace: async (input) => {
      const s = get();
      window.clearTimeout(persistTimer);
      if (s.activeWorkspaceId) await flush(s);
      dirHandle = null;
      vaultRootPath = null;
      const ws = createWorkspaceDraft({
        name: input.name,
        tools: input.tools,
        aiMode: input.aiMode,
      });
      let dek: CryptoKey | null = null;
      if (input.password) {
        const password = assertPassword(input.password);
        dek = await generateDek();
        let lock = lockFromWrap(await wrapDekWithPassword(dek, password));
        if (input.touchId) {
          lock = {
            ...lock,
            touchId: true,
            touchWrappedB64: await touchEncryptSecret(await exportDekB64(dek)),
          };
        }
        ws.lock = lock;
        setSessionDek(ws.id, dek);
      } else {
        clearSessionDek();
      }
      await saveWorkspaceVaultMeta(ws.id, { hasVault: false, recents: [], starred: [], openTabs: [] });
      await saveFiles({}, ws.id, dek);
      await saveBlobs({}, ws.id, dek);
      await saveEvents([], ws.id, dek);
      await saveBoards([defaultFreeformBoard()], ws.id, dek);
      const workspaces = [...s.workspaces, ws];
      set({
        workspaces,
        activeWorkspaceId: ws.id,
        notes: [],
        blobs: {},
        events: [],
        boards: [defaultFreeformBoard()],
        view: clampViewToTools({ kind: "graph" }, ws.tools),
        folderName: ws.name,
        recents: [],
        starred: [],
        openTabs: [],
        folderIcons: {},
        query: "",
        dumpOpen: false,
        plusOpen: false,
        workspaceSetupOpen: false,
        workspaceSetupId: null,
        error: null,
        unlocked: true,
      });
      await saveWorkspacesRegistry({ activeId: ws.id, workspaces });
      await saveWorkspaceVaultMeta(ws.id, { hasVault: true, lastPath: ws.name, recents: [], starred: [], openTabs: [] });
      schedule();
    },

    updateWorkspace: (id, patch) => {
      const workspaces = get().workspaces.map((w) => {
        if (w.id !== id) return w;
        const lock =
          patch.lock === null ? undefined : patch.lock !== undefined ? patch.lock : w.lock;
        return {
          ...w,
          name: patch.name !== undefined ? patch.name.trim() || w.name : w.name,
          tools: patch.tools ? normalizeWorkspaceTools({ ...w.tools, ...patch.tools }) : w.tools,
          aiMode: patch.aiMode ?? w.aiMode,
          lock,
          updated: todayIso(),
        };
      });
      const active = workspaces.find((w) => w.id === get().activeWorkspaceId);
      const next: Partial<AppState> = { workspaces };
      if (active && id === get().activeWorkspaceId) {
        next.view = clampViewToTools(get().view, active.tools, get().boards);
        if (patch.name !== undefined) next.folderName = active.name;
      }
      set(next);
      schedule();
    },

    enableWorkspaceLock: async (password, confirm, touchId) => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (!ws) throw new Error("No workspace is selected.");
      if (isEncryptedWorkspace(ws)) throw new Error("This workspace is already encrypted.");
      if (!s.unlocked) throw new Error("Unlock this workspace first.");
      const pw = assertPassword(password, confirm);
      const dek = await generateDek();
      let lock = lockFromWrap(await wrapDekWithPassword(dek, pw));
      if (touchId) {
        lock = {
          ...lock,
          touchId: true,
          touchWrappedB64: await touchEncryptSecret(await exportDekB64(dek)),
        };
      }
      setSessionDek(ws.id, dek);
      dirHandle = null;
      vaultRootPath = null;
      const workspaces = s.workspaces.map((w) =>
        w.id === ws.id ? { ...w, lock, updated: todayIso() } : w,
      );
      set({ workspaces });
      await flush({ ...get(), workspaces });
    },

    disableWorkspaceLock: async (password) => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (!ws?.lock?.enabled) throw new Error("This workspace is not encrypted.");
      await unwrapDekWithPassword(wrapFromLock(ws.lock), assertPassword(password));
      const workspaces = s.workspaces.map((w) => {
        if (w.id !== ws.id) return w;
        const next = { ...w, updated: todayIso() };
        delete next.lock;
        return next;
      });
      clearSessionDek();
      set({ workspaces, unlocked: true });
      await flush({ ...get(), workspaces });
    },

    changeWorkspacePassword: async (current, next, confirm) => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (!ws?.lock?.enabled) throw new Error("This workspace is not encrypted.");
      const dek = await unwrapDekWithPassword(wrapFromLock(ws.lock), assertPassword(current));
      const pw = assertPassword(next, confirm);
      let lock = lockFromWrap(await wrapDekWithPassword(dek, pw), {
        touchId: ws.lock.touchId,
        touchWrappedB64: ws.lock.touchWrappedB64,
      });
      if (lock.touchId) {
        lock = {
          ...lock,
          touchWrappedB64: await touchEncryptSecret(await exportDekB64(dek)),
        };
      }
      setSessionDek(ws.id, dek);
      const workspaces = s.workspaces.map((w) =>
        w.id === ws.id ? { ...w, lock, updated: todayIso() } : w,
      );
      set({ workspaces });
      await saveWorkspacesRegistry({ activeId: ws.id, workspaces });
    },

    setWorkspaceTouchId: async (enabled) => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (!ws?.lock?.enabled) throw new Error("This workspace is not encrypted.");
      const dek = sessionDekFor(ws.id);
      if (!dek) throw new Error("Unlock this workspace first.");
      let lock: WorkspaceLock = { ...ws.lock };
      if (enabled) {
        lock = {
          ...lock,
          touchId: true,
          touchWrappedB64: await touchEncryptSecret(await exportDekB64(dek)),
        };
      } else {
        lock = { ...lock, touchId: false, touchWrappedB64: undefined };
      }
      const workspaces = s.workspaces.map((w) =>
        w.id === ws.id ? { ...w, lock, updated: todayIso() } : w,
      );
      set({ workspaces });
      await saveWorkspacesRegistry({ activeId: ws.id, workspaces });
    },

    lockWorkspace: async () => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (!isEncryptedWorkspace(ws)) return;
      window.clearTimeout(persistTimer);
      await flush(s);
      clearSessionDek();
      set({
        ...lockedShell(ws?.name ?? s.folderName),
        error: null,
      });
    },

    unlockWorkspace: async (password) => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (!ws?.lock?.enabled) return;
      const dek = await unwrapDekWithPassword(wrapFromLock(ws.lock), password);
      setSessionDek(ws.id, dek);
      const loaded = await loadWorkspaceIntoState(ws.id);
      const tools = ws.tools;
      set({
        ...loaded,
        view: clampViewToTools(loaded.view, tools, loaded.boards),
        error: null,
        unlocked: true,
      });
      ping();
    },

    unlockWorkspaceWithTouchId: async () => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (!ws?.lock?.enabled || !ws.lock.touchWrappedB64) {
        throw new Error("Touch ID is not set up for this workspace.");
      }
      try {
        const raw = await touchUnlockSecret(ws.lock.touchWrappedB64, `Unlock ${ws.name}`);
        const dek = await importDekB64(raw);
        setSessionDek(ws.id, dek);
        const loaded = await loadWorkspaceIntoState(ws.id);
        set({
          ...loaded,
          view: clampViewToTools(loaded.view, ws.tools, loaded.boards),
          error: null,
          unlocked: true,
        });
        ping();
      } catch (err) {
        if (isTouchCancel(err)) return;
        throw err;
      }
    },

    openWorkspaceSetup: (id = null) => {
      set({ workspaceSetupOpen: true, workspaceSetupId: id });
    },
    closeWorkspaceSetup: () => {
      set({ workspaceSetupOpen: false, workspaceSetupId: null });
    },

    setView: (view) => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      if (isEncryptedWorkspace(ws) && !s.unlocked) {
        set({ view: { kind: "unlock" } });
        return;
      }
      const tools = ws?.tools ?? normalizeWorkspaceTools();
      const next = clampViewToTools(view, tools, get().boards);
      const noteId = viewNoteId(next);
      if (noteId) {
        const recents = [noteId, ...get().recents.filter((x) => x !== noteId)].slice(0, 3);
        const openTabs = withOpenTab(get().openTabs, noteId);
        set({ view: next, recents, openTabs });
        schedule();
      } else {
        set({ view: next });
      }
      ping();
    },
    closeOpenTab: (id) => {
      const prev = get().openTabs;
      const i = prev.indexOf(id);
      if (i < 0) return;
      const openTabs = prev.filter((x) => x !== id);
      const current = viewNoteId(get().view);
      set({ openTabs });
      if (current === id) {
        const neighborId = openTabs[i] ?? openTabs[i - 1];
        const neighbor = neighborId ? get().notes.find((n) => n.id === neighborId) : undefined;
        if (neighbor) get().setView(noteAppView(neighbor));
      }
      schedule();
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
    setStrongFocus: (strongFocus) => {
      applyStrongFocus(strongFocus);
      set({ strongFocus });
      schedule();
    },
    setLocale: (locale) => {
      applyLocale(locale);
      set({ locale, ai: { ...get().ai, locale } });
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
      const next: AiSettings = { ...get().ai, ...ai };
      if ("writingSystemPrompt" in ai && !ai.writingSystemPrompt) delete next.writingSystemPrompt;
      if ("writingPrompts" in ai && !ai.writingPrompts) delete next.writingPrompts;
      if ("lastCustomPrompt" in ai && !ai.lastCustomPrompt) delete next.lastCustomPrompt;
      set({ ai: next });
      schedule();
    },
    setCal: (cal) => {
      set({ cal: { ...get().cal, ...cal } });
      schedule();
    },
    setDev: (p) => {
      const next = normalizeDevSettings({ ...get().dev, ...p });
      set({ dev: next });
      const s = get();
      void saveMeta({
        theme: s.theme,
        ai: { ...s.ai, locale: s.locale },
        cal: s.cal,
        calendarSources: s.calendarSources,
        displayName: s.displayName.trim() || "You",
        strongFocus: s.strongFocus,
        locale: s.locale,
        dev: next,
      });
      applyLocalApiConfig(next);
    },
    addCalendarSource: async (opts) => {
      const url = normalizeFeedUrl(opts.url);
      if (!url) {
        set({ error: "Paste an iCal URL first." });
        return;
      }
      try {
        new URL(url);
      } catch {
        set({ error: "That calendar URL is not valid." });
        return;
      }
      const kind = opts.kind ?? inferCalendarKind(url);
      if (kind === "google" || kind === "apple") {
        await get().connectCalendarProvider(kind, url);
        return;
      }
      const source: CalendarSource = {
        id: nid(),
        kind,
        url,
        name: opts.name?.trim() || defaultSourceName(kind),
      };
      set({ calendarSources: [...get().calendarSources, source], error: null });
      schedule();
      await get().syncCalendarFeeds({ sourceId: source.id });
    },
    connectCalendarProvider: async (kind, url) => {
      const href = normalizeFeedUrl(url);
      if (!href) {
        set({ error: "Paste a calendar URL first." });
        return;
      }
      try {
        new URL(href);
      } catch {
        set({ error: "That calendar URL is not valid." });
        return;
      }
      const inferred = inferCalendarKind(href);
      if (kind === "google" && inferred !== "google") {
        set({
          error: "Use a Google Calendar secret or public iCal URL (calendar.google.com).",
        });
        return;
      }
      if (kind === "apple" && inferred === "google") {
        set({
          error: "That looks like Google Calendar. Use the Google row instead.",
        });
        return;
      }
      const existing = get().calendarSources.find((s) => s.kind === kind);
      const source: CalendarSource = existing
        ? { ...existing, url: href, name: existing.name || defaultSourceName(kind), lastError: undefined }
        : {
            id: nid(),
            kind,
            url: href,
            name: defaultSourceName(kind),
          };
      set({
        calendarSources: existing
          ? get().calendarSources.map((s) => (s.id === existing.id ? source : s))
          : [...get().calendarSources, source],
        error: null,
      });
      schedule();
      await get().syncCalendarFeeds({ sourceId: source.id });
    },
    removeCalendarSource: (id) => {
      set({
        calendarSources: get().calendarSources.filter((s) => s.id !== id),
        events: dropEventsForSource(get().events, id),
      });
      schedule();
    },
    syncCalendarFeeds: async (opts) => {
      if (get().calendarSyncing) return;
      const sources = opts?.sourceId
        ? get().calendarSources.filter((s) => s.id === opts.sourceId)
        : get().calendarSources;
      if (sources.length === 0) return;
      set({ calendarSyncing: true });
      let events = get().events;
      const nextSources = [...get().calendarSources];
      const errors: string[] = [];
      try {
        for (const source of sources) {
          const result = await syncOneFeed(source, events);
          events = result.events;
          const idx = nextSources.findIndex((s) => s.id === source.id);
          if (idx >= 0) nextSources[idx] = result.source;
          if (result.source.lastError) {
            errors.push(`${result.source.name}: ${result.source.lastError}`);
          }
        }
        set({
          events,
          calendarSources: nextSources,
          error: errors.length ? errors.join(" ") : get().error,
        });
        schedule();
      } finally {
        set({ calendarSyncing: false });
      }
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
      if (typeof patch.body === "string") dirtyBodies.set(id, patch.body);
      const notes = get().notes.map((n) =>
        n.id === id ? { ...n, ...patch, updated: todayIso() } : n,
      );
      set({ notes });
      const largeBody = typeof patch.body === "string" && patch.body.length > 80_000;
      window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        const s = get();
        if (!s.activeWorkspaceId) return;
        void flush(s);
      }, largeBody ? 900 : 350);
    },

    deleteProperty: (schemaNoteId, key) => {
      const notes = get().notes;
      const owner = notes.find((n) => n.id === schemaNoteId);
      if (!owner) return;
      const schema = (owner.schema ?? []).filter((p) => p.key !== key);
      const views = owner.views?.map((v) => ({
        ...v,
        groupBy: v.groupBy === key ? undefined : v.groupBy,
        dateProp: v.dateProp === key ? undefined : v.dateProp,
        endDateProp: v.endDateProp === key ? undefined : v.endDateProp,
        visible: v.visible?.filter((k) => k !== key),
        filters: v.filters?.filter((f) => f.key !== key),
        filter: filterRemoveKey(v.filter, key),
        sorts: v.sorts?.filter((s) => s.key !== key),
      }));
      const next = notes.map((n) => {
        const ownsSchema = n.id === schemaNoteId;
        const isRow = n.parent === schemaNoteId || n.id === schemaNoteId;
        if (!ownsSchema && !isRow) return n;
        let props = n.props;
        if (isRow && key in n.props) {
          const { [key]: _removed, ...rest } = n.props;
          props = rest;
        }
        return {
          ...n,
          props,
          ...(ownsSchema ? { schema, views } : {}),
          updated: todayIso(),
        };
      });
      set({ notes: next });
      schedule();
    },

    deleteNote: (id) => {
      const notes = get().notes.filter((n) => n.id !== id && n.parent !== id);
      const openTabs = get().openTabs.filter((tid) => notes.some((n) => n.id === tid));
      const view = get().view;
      const lost =
        (view.kind === "note" && view.id === id) ||
        (view.kind === "database" && view.id === id);
      let nextView = view;
      if (lost) {
        const fallbackId = openTabs[0] ?? notes[0]?.id;
        const fallback = fallbackId ? notes.find((n) => n.id === fallbackId) : undefined;
        nextView = fallback ? noteAppView(fallback) : { kind: "graph" };
      }
      set({ notes, openTabs, view: nextView });
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
        icon: opts?.icon,
        tags: opts?.tags ?? [],
        parent,
        template: opts?.template,
        props: { ...applyDefaults(parentNote?.schema), ...(opts?.props ?? {}) },
        created: now,
        updated: now,
      };
      get().upsertNote(note);
      if (!opts?.stay) {
        set({ mode: "wysiwyg" });
        get().setView(parent ? { kind: "database", id: parent } : { kind: "note", id });
      }
      return id;
    },

    createDatabase: (opts) => {
      const id = nid();
      const title = opts?.title?.trim() || "New database";
      const now = todayIso();
      const baseViews = opts?.views?.length ? opts.views : defaultViews();
      const preferred = opts?.viewType
        ? baseViews.find((v) => v.type === opts.viewType) ?? newView(opts.viewType)
        : baseViews[0];
      const all = baseViews.some((v) => v.id === preferred.id) ? baseViews : [preferred, ...baseViews];
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
        icon: opts?.icon,
        tags: [],
        props: {},
        schema: opts?.schema ?? [
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
        get().setView({ kind: "database", id, viewId: preferred.id });
      }
      return id;
    },

    createDaily: () => {
      const date = todayDate();
      const path = `Daily/${date}.md`;
      const existing = get().notes.find((n) => n.path === path || n.title === date);
      if (existing) {
        set({ mode: "wysiwyg" });
        get().setView({ kind: "note", id: existing.id });
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
        ...(opts.calUrl?.trim() ? { calUrl: opts.calUrl.trim() } : {}),
        ...(opts.calBookingUid?.trim() ? { calBookingUid: opts.calBookingUid.trim() } : {}),
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
      const event = get().events.find((e) => e.id === id);
      if (event?.sourceId && event.uid) {
        set({
          events: get().events.filter((e) => e.id !== id),
          calendarSources: get().calendarSources.map((s) =>
            s.id === event.sourceId
              ? { ...s, hiddenUids: [...new Set([...(s.hiddenUids ?? []), event.uid!])] }
              : s,
          ),
        });
      } else {
        set({ events: get().events.filter((e) => e.id !== id) });
      }
      schedule();
    },

    setBoard: (patch) => {
      set({ boards: withActiveBoard(get(), (cur) => ({ ...cur, ...patch })) });
      schedule();
    },

    upsertBoardObject: (obj) => {
      set({
        boards: withActiveBoard(get(), (cur) => {
          const exists = cur.objects.some((o) => o.id === obj.id);
          return {
            ...cur,
            objects: exists
              ? cur.objects.map((o) => (o.id === obj.id ? obj : o))
              : [...cur.objects, obj],
          };
        }),
      });
      schedule();
    },

    patchBoardObject: (id, patch) => {
      set({
        boards: withActiveBoard(get(), (cur) => ({
          ...cur,
          objects: cur.objects.map((o) => {
            if (o.id !== id) return o;
            return { ...o, ...patch, id: o.id, type: o.type } as FreeformObject;
          }),
        })),
      });
      schedule();
    },

    removeBoardObject: (id) => {
      set({
        boards: withActiveBoard(get(), (cur) => ({
          ...cur,
          objects: cur.objects
            .filter((o) => o.id !== id)
            .map((o) =>
              o.type === "mind" && o.parentId === id ? { ...o, parentId: undefined } : o,
            ),
          connections: (cur.connections ?? []).filter((c) => c.from !== id && c.to !== id),
        })),
      });
      schedule();
    },

    clearBoard: () => {
      set({
        boards: withActiveBoard(get(), (cur) => ({
          ...cur,
          objects: [],
          connections: [],
          camera: { x: 0, y: 0, zoom: 1 },
        })),
      });
      schedule();
    },

    createBoard: (title) => {
      const s = get();
      const board = defaultFreeformBoard({
        id: nid(),
        title: title?.trim() || nextBoardTitle(s.boards),
      });
      set({
        boards: [...s.boards, board],
        view: { kind: "freeform", id: board.id },
      });
      schedule();
      return board.id;
    },

    deleteBoard: (id) => {
      const s = get();
      if (s.boards.length <= 1) return;
      const boards = s.boards.filter((b) => b.id !== id);
      const view =
        s.view.kind === "freeform" && s.view.id === id
          ? ({ kind: "freeform", id: boards[0]!.id } as const)
          : s.view;
      set({ boards, view });
      schedule();
    },

    leaveBoard: () => {
      const s = get();
      const tools =
        s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.tools ?? normalizeWorkspaceTools();
      set({ view: clampViewToTools(homeView(s.notes), tools, s.boards) });
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

    ensureBlob: async (path) => {
      const key = path.replace(/^\.\//, "");
      const rec = get().blobs[key] ?? get().blobs[path];
      if (rec?.data?.byteLength) return;

      if (rec?.handle) {
        const refreshed = await refreshBlobFromHandle(rec);
        if (refreshed.data.byteLength) {
          set({ blobs: { ...get().blobs, [key]: refreshed } });
          schedule();
          return;
        }
      }

      if (dirHandle) {
        const fromVault = await readBlobFromVault(dirHandle, key);
        if (fromVault) {
          set({
            blobs: {
              ...get().blobs,
              [key]: {
                ...fromVault,
                ...(rec?.external ? { external: true } : {}),
                ...(rec?.localPath ? { localPath: rec.localPath } : {}),
              },
            },
          });
          schedule();
        }
      }
    },

    storeFileFromDrop: async (file) => {
      const localPath = localPathFromFile(file);
      // Prefer linking the original path — never copy into assets/ when we know where it lives.
      if (localPath) {
        const vaultPath = `ext/${nid()}/${safeFileName(file.name)}`;
        set({
          blobs: {
            ...get().blobs,
            [vaultPath]: {
              mime: file.type || mimeFromPath(file.name),
              data: new ArrayBuffer(0),
              external: true,
              localPath,
            },
          },
        });
        schedule();
        return vaultPath;
      }
      // Browser / missing path — keep a vault copy so the attachment still works.
      const path = assetPathFor(file);
      await get().putBlob(file, path, file.type || mimeFromPath(file.name));
      return path;
    },

    importDroppedFiles: async (files, opts) => {
      await handleDroppedFiles(files, opts);
    },

    moveNoteToFolder: (id, folder) => {
      const note = get().notes.find((n) => n.id === id);
      if (!note) return;
      const fileName = note.path.includes("/") ? note.path.slice(note.path.lastIndexOf("/") + 1) : note.path;
      const targetFolder = folder.trim();
      const nextPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
      if (nextPath === note.path) return;
      const path = uniquePath(get().notes, nextPath, id);
      const moved = normalizeNote({ ...note, path, parent: undefined });
      get().upsertNote(moved, { renameFrom: note.path });
    },

    moveFolder: (from, dest) => {
      const oldPath = from.trim();
      const destPath = dest.trim();
      if (!canMoveFolder(oldPath, destPath)) return;
      const occupied: string[] = [];
      for (const p of existingFolderPaths(get().notes)) {
        if (p === oldPath || p.startsWith(`${oldPath}/`)) continue;
        occupied.push(p);
      }
      for (const p of Object.keys(get().folderIcons)) {
        if (p === oldPath || p.startsWith(`${oldPath}/`)) continue;
        occupied.push(p);
      }
      const nextFolder = uniqueFolderPath(occupied, nestedFolderPath(oldPath, destPath));
      if (nextFolder === oldPath) return nextFolder;
      const notes = get().notes;
      const moving = notes.filter((n) => n.path.startsWith(`${oldPath}/`));
      const staying = notes.filter((n) => !n.path.startsWith(`${oldPath}/`));
      let acc = [...staying];
      const updated = moving.map((n) => {
        const rewritten = rewritePathPrefix(n.path, oldPath, nextFolder);
        const nextPath = uniquePath(acc, rewritten, n.id);
        const next = normalizeNote({ ...n, path: nextPath, updated: todayIso() });
        acc = [...acc, next];
        return next;
      });
      set({
        notes: [...staying, ...updated].sort((a, b) => a.title.localeCompare(b.title)),
        folderIcons: remapFolderIcons(get().folderIcons, oldPath, nextFolder),
      });
      schedule();
      return nextFolder;
    },

    renameFolder: (path, name) => {
      const oldPath = path.trim();
      if (!oldPath) return;
      const nextFolder = nextFolderPath(get().notes, oldPath, name);
      if (nextFolder === oldPath) return nextFolder;
      const notes = get().notes;
      const moving = notes.filter((n) => n.path.startsWith(`${oldPath}/`));
      const staying = notes.filter((n) => !n.path.startsWith(`${oldPath}/`));
      let acc = [...staying];
      const updated = moving.map((n) => {
        const rewritten = rewritePathPrefix(n.path, oldPath, nextFolder);
        const nextPath = uniquePath(acc, rewritten, n.id);
        const next = normalizeNote({ ...n, path: nextPath, updated: todayIso() });
        acc = [...acc, next];
        return next;
      });
      set({
        notes: [...staying, ...updated].sort((a, b) => a.title.localeCompare(b.title)),
        folderIcons: remapFolderIcons(get().folderIcons, oldPath, nextFolder),
      });
      schedule();
      return nextFolder;
    },

    deleteFolder: (path) => {
      const folder = path.trim();
      if (!folder) return;
      const doomed = notesToDeleteWithFolder(get().notes, folder);
      const ids = new Set(doomed.map((n) => n.id));
      const notes = get().notes.filter((n) => !ids.has(n.id));
      const openTabs = get().openTabs.filter((tid) => notes.some((n) => n.id === tid));
      const view = get().view;
      const lost =
        (view.kind === "note" && ids.has(view.id)) ||
        (view.kind === "database" && ids.has(view.id));
      let nextView = view;
      if (lost) {
        const fallbackId = openTabs[0] ?? notes[0]?.id;
        const fallback = fallbackId ? notes.find((n) => n.id === fallbackId) : undefined;
        nextView = fallback ? noteAppView(fallback) : { kind: "graph" };
      }
      set({
        notes,
        openTabs,
        view: nextView,
        folderIcons: omitFolderIcons(get().folderIcons, folder),
      });
      schedule();
    },

    setFolderIcon: (path, icon) => {
      const folder = path.trim();
      if (!folder) return;
      const folderIcons = { ...get().folderIcons };
      if (icon?.trim()) folderIcons[folder] = icon.trim();
      else delete folderIcons[folder];
      set({ folderIcons });
      schedule();
    },

    linkLocalFile: async (accept = "*/*") => {
      const paths = await get().linkLocalFiles(accept);
      return paths[0] ?? null;
    },

    linkLocalFiles: async (accept = "*/*") => {
      const picked = await pickLocalFiles(accept, true);
      if (!picked.length) return [];
      const paths: string[] = [];
      const nextBlobs = { ...get().blobs };

      for (const item of picked) {
        const { file, handle, localPath } = item;
        const mime = file.type || mimeFromPath(file.name);

        if (localPath) {
          const vaultPath = `ext/${nid()}/${safeFileName(file.name)}`;
          nextBlobs[vaultPath] = externalFileBlob(file, { localPath });
          paths.push(vaultPath);
          continue;
        }

        if (handle && dirHandle && typeof dirHandle.resolve === "function") {
          try {
            const rel = await dirHandle.resolve(handle);
            if (rel?.length) {
              const vaultPath = rel.join("/");
              nextBlobs[vaultPath] = {
                mime: mime || mimeFromPath(vaultPath),
                data: new ArrayBuffer(0),
                handle,
              };
              paths.push(vaultPath);
              continue;
            }
          } catch {
            /* not in this vault */
          }
        }

        const vaultPath = `ext/${nid()}/${safeFileName(file.name)}`;
        nextBlobs[vaultPath] = externalFileBlob(file, { handle });
        paths.push(vaultPath);
      }

      set({ blobs: nextBlobs });
      schedule();
      return paths;
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
        const dek = sessionDekFor(wsId);
        const ws = useApp.getState().workspaces.find((w) => w.id === wsId);
        if (isEncryptedWorkspace(ws) && !dek) return;
        try {
          const files = await loadFiles(wsId, dek);
          const blobs = await refreshBlobsFromDisk(await loadBlobs(wsId, dek));
          const events = await loadEvents(wsId, dek);
          if (files && Object.keys(files).length) {
            const notes = notesFromFiles(files).map((n) => {
              const dirty = dirtyBodies.get(n.id);
              return dirty !== undefined ? { ...n, body: dirty } : n;
            });
            useApp.setState({
              notes,
              blobs,
              events,
              folderIcons: mergeFolderIcons(files, useApp.getState().folderIcons),
            });
          } else {
            useApp.setState({ events });
          }
        } catch (err) {
          if (err instanceof LockedVaultError) return;
          console.error("Klever failed to apply vault update", err);
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
