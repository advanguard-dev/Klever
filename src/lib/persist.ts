import { get, set, del } from "idb-keyval";
import type { AiSettings, BlobRecord, FreeformBoard, FreeformConnection, FreeformObject, VaultEvent, Workspace } from "@/types";
import { defaultAi, migrateAiSettings } from "@/lib/ai";
import { mimeFromPath } from "@/lib/assets";
import { createWorkspaceDraft, normalizeWorkspace } from "@/lib/workspaces";

const FILES_KEY = "klever.files";
const BLOBS_KEY = "klever.blobs";
const META_KEY = "klever.meta";
const EVENTS_KEY = "klever.events";
const BOARD_KEY = "klever.board";
const WORKSPACES_KEY = "klever.workspaces";

function wsFilesKey(id: string) {
  return `klever.ws.${id}.files`;
}
function wsBlobsKey(id: string) {
  return `klever.ws.${id}.blobs`;
}
function wsEventsKey(id: string) {
  return `klever.ws.${id}.events`;
}
function wsBoardKey(id: string) {
  return `klever.ws.${id}.board`;
}
function wsVaultMetaKey(id: string) {
  return `klever.ws.${id}.meta`;
}

/** Global app prefs (shared across workspaces). */
export interface PersistedMeta {
  theme: "light" | "dark";
  ai: AiSettings;
  displayName?: string;
  /** @deprecated migrated into workspaces */
  hasVault?: boolean;
  lastPath?: string;
  recents?: string[];
  starred?: string[];
}

export interface WorkspaceVaultMeta {
  hasVault: boolean;
  lastPath?: string;
  recents?: string[];
  starred?: string[];
}

export interface WorkspacesRegistry {
  activeId: string;
  workspaces: Workspace[];
}

export interface VaultData {
  files: Record<string, string>;
  blobs: Record<string, BlobRecord>;
}

function asIdList(v: unknown, max: number) {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, max);
}

export async function loadMeta(): Promise<PersistedMeta> {
  const meta = (await get(META_KEY)) as PersistedMeta | undefined;
  return {
    hasVault: Boolean(meta?.hasVault),
    theme: meta?.theme === "dark" ? "dark" : "light",
    ai: migrateAiSettings({ ...defaultAi(), ...meta?.ai }),
    lastPath: meta?.lastPath,
    displayName: meta?.displayName || "You",
    recents: asIdList(meta?.recents, 3),
    starred: asIdList(meta?.starred, 32),
  };
}

export async function saveMeta(meta: PersistedMeta) {
  await set(META_KEY, {
    theme: meta.theme,
    ai: meta.ai,
    displayName: meta.displayName,
  } satisfies PersistedMeta);
}

export async function loadWorkspaceVaultMeta(workspaceId: string): Promise<WorkspaceVaultMeta> {
  const meta = (await get(wsVaultMetaKey(workspaceId))) as WorkspaceVaultMeta | undefined;
  return {
    hasVault: Boolean(meta?.hasVault),
    lastPath: meta?.lastPath,
    recents: asIdList(meta?.recents, 3),
    starred: asIdList(meta?.starred, 32),
  };
}

export async function saveWorkspaceVaultMeta(workspaceId: string, meta: WorkspaceVaultMeta) {
  await set(wsVaultMetaKey(workspaceId), meta);
}

export async function loadFiles(workspaceId?: string): Promise<Record<string, string> | null> {
  if (workspaceId) {
    return ((await get(wsFilesKey(workspaceId))) as Record<string, string> | undefined) ?? null;
  }
  return (await get(FILES_KEY)) ?? null;
}

export async function saveFiles(files: Record<string, string>, workspaceId?: string) {
  if (workspaceId) await set(wsFilesKey(workspaceId), files);
  else await set(FILES_KEY, files);
}

export async function loadBlobs(workspaceId?: string): Promise<Record<string, BlobRecord>> {
  const key = workspaceId ? wsBlobsKey(workspaceId) : BLOBS_KEY;
  return ((await get(key)) as Record<string, BlobRecord> | undefined) ?? {};
}

export async function saveBlobs(blobs: Record<string, BlobRecord>, workspaceId?: string) {
  if (workspaceId) await set(wsBlobsKey(workspaceId), blobs);
  else await set(BLOBS_KEY, blobs);
}

export async function clearFiles(workspaceId?: string) {
  if (workspaceId) {
    await del(wsFilesKey(workspaceId));
    await del(wsBlobsKey(workspaceId));
    return;
  }
  await del(FILES_KEY);
  await del(BLOBS_KEY);
}

export async function loadEvents(workspaceId?: string): Promise<VaultEvent[]> {
  const key = workspaceId ? wsEventsKey(workspaceId) : EVENTS_KEY;
  const raw = (await get(key)) as VaultEvent[] | undefined;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e) =>
      e &&
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      typeof e.date === "string",
  );
}

export async function saveEvents(events: VaultEvent[], workspaceId?: string) {
  if (workspaceId) await set(wsEventsKey(workspaceId), events);
  else await set(EVENTS_KEY, events);
}

function isFreeformObject(o: unknown): o is FreeformObject {
  if (!o || typeof o !== "object") return false;
  const obj = o as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.type === "string";
}

export function defaultFreeformBoard(): FreeformBoard {
  return {
    id: "main",
    title: "Board",
    objects: [],
    connections: [],
    dotted: true,
    camera: { x: 0, y: 0, zoom: 1 },
    updated: new Date().toISOString(),
  };
}

function normalizeConnections(raw: unknown): FreeformConnection[] {
  if (!Array.isArray(raw)) return [];
  const out: FreeformConnection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.from !== "string" || typeof c.to !== "string") continue;
    if (c.from === c.to) continue;
    out.push({ id: c.id, from: c.from, to: c.to });
  }
  return out;
}

export async function loadBoard(workspaceId?: string): Promise<FreeformBoard> {
  const key = workspaceId ? wsBoardKey(workspaceId) : BOARD_KEY;
  const raw = (await get(key)) as FreeformBoard | undefined;
  if (!raw || typeof raw !== "object") return defaultFreeformBoard();
  return {
    id: typeof raw.id === "string" ? raw.id : "main",
    title: typeof raw.title === "string" ? raw.title : "Board",
    objects: Array.isArray(raw.objects) ? raw.objects.filter(isFreeformObject) : [],
    connections: normalizeConnections(raw.connections),
    dotted: raw.dotted !== false,
    camera: {
      x: typeof raw.camera?.x === "number" ? raw.camera.x : 0,
      y: typeof raw.camera?.y === "number" ? raw.camera.y : 0,
      zoom: typeof raw.camera?.zoom === "number" && raw.camera.zoom > 0 ? raw.camera.zoom : 1,
    },
    updated: typeof raw.updated === "string" ? raw.updated : new Date().toISOString(),
  };
}

export async function saveBoard(board: FreeformBoard, workspaceId?: string) {
  if (workspaceId) await set(wsBoardKey(workspaceId), board);
  else await set(BOARD_KEY, board);
}

export async function deleteWorkspaceStorage(workspaceId: string) {
  await del(wsFilesKey(workspaceId));
  await del(wsBlobsKey(workspaceId));
  await del(wsEventsKey(workspaceId));
  await del(wsBoardKey(workspaceId));
  await del(wsVaultMetaKey(workspaceId));
}

export async function saveWorkspacesRegistry(reg: WorkspacesRegistry) {
  await set(WORKSPACES_KEY, reg);
}

/**
 * Load workspace registry, migrating legacy single-vault IDB keys into the first workspace.
 */
export async function loadOrMigrateWorkspaces(): Promise<{
  registry: WorkspacesRegistry;
  globalMeta: PersistedMeta;
  vaultMeta: WorkspaceVaultMeta;
}> {
  const globalMeta = await loadMeta();
  const raw = (await get(WORKSPACES_KEY)) as WorkspacesRegistry | undefined;
  const list = Array.isArray(raw?.workspaces)
    ? raw!.workspaces.map(normalizeWorkspace).filter((w): w is Workspace => Boolean(w))
    : [];

  if (list.length && raw?.activeId) {
    const activeId = list.some((w) => w.id === raw.activeId) ? raw.activeId : list[0].id;
    const registry: WorkspacesRegistry = { activeId, workspaces: list };
    if (activeId !== raw.activeId || list.length !== raw.workspaces.length) {
      await saveWorkspacesRegistry(registry);
    }
    const vaultMeta = await loadWorkspaceVaultMeta(activeId);
    return { registry, globalMeta, vaultMeta };
  }

  const legacyFiles = (await get(FILES_KEY)) as Record<string, string> | undefined;
  const hasLegacy =
    Boolean(globalMeta.hasVault) ||
    (legacyFiles != null && Object.keys(legacyFiles).length > 0);

  const ws = createWorkspaceDraft({
    name: globalMeta.lastPath?.trim() || "Vault",
    aiMode: "remote",
  });
  const registry: WorkspacesRegistry = { activeId: ws.id, workspaces: [ws] };
  await saveWorkspacesRegistry(registry);

  if (hasLegacy) {
    const blobs = ((await get(BLOBS_KEY)) as Record<string, BlobRecord> | undefined) ?? {};
    const events = ((await get(EVENTS_KEY)) as VaultEvent[] | undefined) ?? [];
    const board = (await get(BOARD_KEY)) as FreeformBoard | undefined;
    await set(wsFilesKey(ws.id), legacyFiles ?? {});
    await set(wsBlobsKey(ws.id), blobs);
    await set(wsEventsKey(ws.id), Array.isArray(events) ? events : []);
    if (board) await set(wsBoardKey(ws.id), board);
    await saveWorkspaceVaultMeta(ws.id, {
      hasVault: true,
      lastPath: globalMeta.lastPath,
      recents: globalMeta.recents,
      starred: globalMeta.starred,
    });
  } else {
    await saveWorkspaceVaultMeta(ws.id, { hasVault: false, recents: [], starred: [] });
  }

  await saveMeta(globalMeta);
  const vaultMeta = await loadWorkspaceVaultMeta(ws.id);
  return { registry, globalMeta, vaultMeta };
}

function dirEntries(dir: FileSystemDirectoryHandle) {
  return (
    dir as FileSystemDirectoryHandle & {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }
  ).entries();
}

const BINARY_RE = /\.(png|jpe?g|gif|webp|svg|avif|mp3|wav|ogg|m4a|pdf|zip|mov|mp4|webm|txt)$/i;

export async function walkVault(
  dir: FileSystemDirectoryHandle,
  prefix = "",
): Promise<VaultData> {
  const files: Record<string, string> = {};
  const blobs: Record<string, BlobRecord> = {};
  for await (const [name, handle] of dirEntries(dir)) {
    if (name.startsWith(".") && name !== ".originals") continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      const nested = await walkVault(handle as FileSystemDirectoryHandle, path);
      Object.assign(files, nested.files);
      Object.assign(blobs, nested.blobs);
    } else if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      if (name.endsWith(".md")) {
        files[path] = await file.text();
      } else if (BINARY_RE.test(name) || prefix.startsWith("assets")) {
        blobs[path] = {
          mime: file.type || mimeFromPath(path),
          data: await file.arrayBuffer(),
        };
      }
    }
  }
  return { files, blobs };
}

async function ensureDir(root: FileSystemDirectoryHandle, parts: string[]) {
  let dir = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  return dir;
}

async function writePath(
  root: FileSystemDirectoryHandle,
  path: string,
  data: BufferSource | string,
) {
  const parts = path.split("/");
  const filename = parts.pop();
  if (!filename) return;
  const dir = parts.length ? await ensureDir(root, parts) : root;
  const handle = await dir.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function writeVaultToDirectory(
  root: FileSystemDirectoryHandle,
  files: Record<string, string>,
  blobs: Record<string, BlobRecord>,
) {
  for (const [path, content] of Object.entries(files)) {
    await writePath(root, path, content);
  }
  for (const [path, rec] of Object.entries(blobs)) {
    await writePath(root, path, rec.data);
  }
}

export async function pickVaultFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error("This browser cannot open a local folder. Use Chrome or Edge, or stay on the sample vault.");
  }
  return window.showDirectoryPicker({ id: "klever-vault", mode: "readwrite" });
}
