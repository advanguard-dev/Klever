import { get, set, del } from "idb-keyval";
import type { AiSettings, BlobRecord, CalendarSource, CalSettings, DevSettings, FreeformBoard, FreeformConnection, FreeformObject, VaultEvent, Workspace } from "@/types";
import { defaultAi, migrateAiSettings } from "@/lib/ai";
import { normalizeDevSettings } from "@/lib/dev-settings";
import { parseLocale, type Locale } from "@/lib/i18n";
import { migrateCalendarSources } from "@/lib/calendar-sync";
import { migrateCalSettings } from "@/lib/calcom";
import { mimeFromPath, persistableBlobs } from "@/lib/assets";
import { FOLDER_META_FILE } from "@/lib/folders";
import { nid } from "@/lib/ids";
import {
  decryptJson,
  encryptJson,
  isEncryptedEnvelope,
  LockedVaultError,
} from "@/lib/vault-crypto";
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

function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

type StorableBlob = {
  mime: string;
  dataB64: string;
  external?: boolean;
  localPath?: string;
};

function blobsToStorable(blobs: Record<string, BlobRecord>): Record<string, StorableBlob> {
  const stored = persistableBlobs(blobs);
  const out: Record<string, StorableBlob> = {};
  for (const [path, rec] of Object.entries(stored)) {
    out[path] = {
      mime: rec.mime,
      dataB64: rec.data?.byteLength ? bytesToB64(rec.data) : "",
      ...(rec.external ? { external: true } : {}),
      ...(rec.localPath ? { localPath: rec.localPath } : {}),
    };
  }
  return out;
}

function blobsFromStorable(raw: unknown): Record<string, BlobRecord> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, BlobRecord> = {};
  for (const [path, rec] of Object.entries(raw as Record<string, unknown>)) {
    if (!rec || typeof rec !== "object") continue;
    const r = rec as Record<string, unknown>;
    const dataB64 = typeof r.dataB64 === "string" ? r.dataB64 : "";
    const data =
      dataB64
        ? b64ToBuf(dataB64)
        : r.data instanceof ArrayBuffer
          ? r.data
          : new ArrayBuffer(0);
    out[path] = {
      mime: typeof r.mime === "string" && r.mime ? r.mime : mimeFromPath(path),
      data,
      ...(r.external ? { external: true } : {}),
      ...(typeof r.localPath === "string" && r.localPath ? { localPath: r.localPath } : {}),
    };
  }
  return out;
}

async function writeEncrypted(key: string, data: unknown, dek: CryptoKey | null | undefined) {
  if (dek) await set(key, await encryptJson(data, dek));
  else await set(key, data);
}

async function readEncrypted<T>(
  key: string,
  dek: CryptoKey | null | undefined,
  fallback: T,
  decode: (raw: unknown) => T,
): Promise<T> {
  const raw = await get(key);
  if (raw == null) return fallback;
  if (isEncryptedEnvelope(raw)) {
    if (!dek) throw new LockedVaultError();
    return decode(await decryptJson(raw, dek));
  }
  return decode(raw);
}

/** Global app prefs (shared across workspaces). */
export interface PersistedMeta {
  theme: "light" | "dark";
  ai: AiSettings;
  cal: CalSettings;
  calendarSources?: CalendarSource[];
  displayName?: string;
  /** Stronger :focus-visible rings. Off by default so titles stay quiet. */
  strongFocus?: boolean;
  /** UI chrome locale. Falls back to `ai.locale`, then the browser language. */
  locale?: Locale;
  /** Local developer automation (API, webhooks, semantic search). */
  dev?: DevSettings;
  /** @deprecated migrated into workspaces */
  hasVault?: boolean;
  lastPath?: string;
  recents?: string[];
  starred?: string[];
}

export interface WorkspaceVaultMeta {
  hasVault: boolean;
  lastPath?: string;
  /** Absolute vault folder path (Electron — Finder integration). */
  vaultRootPath?: string;
  recents?: string[];
  starred?: string[];
  openTabs?: string[];
  /** Folder path → icon (emoji or `lucide:{name}`), same values as page `icon` frontmatter. */
  folderIcons?: Record<string, string>;
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
  const ai = migrateAiSettings({ ...defaultAi(), ...meta?.ai });
  const locale = parseLocale(meta?.locale) ?? parseLocale(ai.locale);
  return {
    hasVault: Boolean(meta?.hasVault),
    theme: meta?.theme === "dark" ? "dark" : "light",
    ai: locale ? { ...ai, locale } : ai,
    cal: migrateCalSettings(meta?.cal),
    calendarSources: migrateCalendarSources(meta?.calendarSources),
    displayName: meta?.displayName || "You",
    strongFocus: Boolean(meta?.strongFocus),
    locale,
    dev: normalizeDevSettings(meta?.dev),
    lastPath: meta?.lastPath,
    recents: asIdList(meta?.recents, 3),
    starred: asIdList(meta?.starred, 32),
  };
}

export async function saveMeta(meta: PersistedMeta) {
  const locale = parseLocale(meta.locale) ?? parseLocale(meta.ai.locale);
  await set(META_KEY, {
    theme: meta.theme,
    ai: locale ? { ...meta.ai, locale } : meta.ai,
    cal: meta.cal,
    calendarSources: meta.calendarSources ?? [],
    displayName: meta.displayName,
    strongFocus: Boolean(meta.strongFocus),
    ...(locale ? { locale } : {}),
    dev: normalizeDevSettings(meta.dev),
  } satisfies PersistedMeta);
}

export async function loadWorkspaceVaultMeta(workspaceId: string): Promise<WorkspaceVaultMeta> {
  const meta = (await get(wsVaultMetaKey(workspaceId))) as WorkspaceVaultMeta | undefined;
  return {
    hasVault: Boolean(meta?.hasVault),
    lastPath: meta?.lastPath,
    vaultRootPath: meta?.vaultRootPath,
    recents: asIdList(meta?.recents, 3),
    starred: asIdList(meta?.starred, 32),
    openTabs: asIdList(meta?.openTabs, 16),
    folderIcons: asFolderIcons(meta?.folderIcons),
  };
}

function asFolderIcons(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [path, icon] of Object.entries(v as Record<string, unknown>)) {
    if (typeof path === "string" && path && typeof icon === "string" && icon.trim()) {
      out[path] = icon.trim();
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export async function saveWorkspaceVaultMeta(workspaceId: string, meta: WorkspaceVaultMeta) {
  await set(wsVaultMetaKey(workspaceId), meta);
}

export async function loadFiles(
  workspaceId?: string,
  dek?: CryptoKey | null,
): Promise<Record<string, string> | null> {
  const key = workspaceId ? wsFilesKey(workspaceId) : FILES_KEY;
  const raw = await get(key);
  if (raw == null) return null;
  if (isEncryptedEnvelope(raw)) {
    if (!dek) throw new LockedVaultError();
    const data = await decryptJson<Record<string, string>>(raw, dek);
    return data && typeof data === "object" ? data : {};
  }
  return (raw as Record<string, string>) ?? null;
}

export async function saveFiles(
  files: Record<string, string>,
  workspaceId?: string,
  dek?: CryptoKey | null,
) {
  const key = workspaceId ? wsFilesKey(workspaceId) : FILES_KEY;
  await writeEncrypted(key, files, dek);
}

export async function loadBlobs(
  workspaceId?: string,
  dek?: CryptoKey | null,
): Promise<Record<string, BlobRecord>> {
  const key = workspaceId ? wsBlobsKey(workspaceId) : BLOBS_KEY;
  const raw = await get(key);
  if (raw == null) return {};
  if (isEncryptedEnvelope(raw)) {
    if (!dek) throw new LockedVaultError();
    return blobsFromStorable(await decryptJson(raw, dek));
  }
  return (raw as Record<string, BlobRecord>) ?? {};
}

export async function saveBlobs(
  blobs: Record<string, BlobRecord>,
  workspaceId?: string,
  dek?: CryptoKey | null,
) {
  const key = workspaceId ? wsBlobsKey(workspaceId) : BLOBS_KEY;
  if (dek) await set(key, await encryptJson(blobsToStorable(blobs), dek));
  else await set(key, persistableBlobs(blobs));
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

function normalizeEvent(raw: unknown): VaultEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.title !== "string" || typeof e.date !== "string") return null;
  const calUrl = typeof e.calUrl === "string" && e.calUrl.trim() ? e.calUrl.trim() : undefined;
  const calBookingUid =
    typeof e.calBookingUid === "string" && e.calBookingUid.trim() ? e.calBookingUid.trim() : undefined;
  const sourceId = typeof e.sourceId === "string" && e.sourceId.trim() ? e.sourceId.trim() : undefined;
  const uid = typeof e.uid === "string" && e.uid.trim() ? e.uid.trim() : undefined;
  const sourceKind = e.sourceKind === "google" || e.sourceKind === "ics" ? e.sourceKind : undefined;
  return {
    id: e.id,
    title: e.title,
    body: typeof e.body === "string" ? e.body : "",
    date: e.date,
    project: typeof e.project === "string" && e.project.trim() ? e.project : undefined,
    tags: Array.isArray(e.tags) ? e.tags.filter((t): t is string => typeof t === "string") : [],
    ...(calUrl ? { calUrl } : {}),
    ...(calBookingUid ? { calBookingUid } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(uid ? { uid } : {}),
    ...(sourceKind ? { sourceKind } : {}),
    created: typeof e.created === "string" ? e.created : "",
    updated: typeof e.updated === "string" ? e.updated : "",
  };
}

export async function loadEvents(
  workspaceId?: string,
  dek?: CryptoKey | null,
): Promise<VaultEvent[]> {
  const key = workspaceId ? wsEventsKey(workspaceId) : EVENTS_KEY;
  const raw = await readEncrypted<unknown>(key, dek, [], (v) => v);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEvent).filter((e): e is VaultEvent => Boolean(e));
}

export async function saveEvents(
  events: VaultEvent[],
  workspaceId?: string,
  dek?: CryptoKey | null,
) {
  const key = workspaceId ? wsEventsKey(workspaceId) : EVENTS_KEY;
  await writeEncrypted(key, events, dek);
}

function isFreeformObject(o: unknown): o is FreeformObject {
  if (!o || typeof o !== "object") return false;
  const obj = o as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.type === "string";
}

export function defaultFreeformBoard(init?: { id?: string; title?: string }): FreeformBoard {
  return {
    id: init?.id ?? "main",
    title: init?.title ?? "Board",
    objects: [],
    connections: [],
    dotted: true,
    camera: { x: 0, y: 0, zoom: 1 },
    updated: new Date().toISOString(),
  };
}

export function nextBoardTitle(boards: FreeformBoard[]): string {
  const used = new Set(boards.map((b) => b.title.trim().toLowerCase()));
  if (!used.has("board")) return "Board";
  let n = 2;
  while (used.has(`board ${n}`)) n += 1;
  return `Board ${n}`;
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

function normalizeBoard(raw: unknown): FreeformBoard | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (Array.isArray(b.boards) && !("objects" in b)) return null;
  const cam = b.camera && typeof b.camera === "object" ? (b.camera as Record<string, unknown>) : {};
  return {
    id: typeof b.id === "string" && b.id ? b.id : nid(),
    title: typeof b.title === "string" && b.title.trim() ? b.title : "Board",
    objects: Array.isArray(b.objects) ? b.objects.filter(isFreeformObject) : [],
    connections: normalizeConnections(b.connections),
    dotted: b.dotted !== false,
    camera: {
      x: typeof cam.x === "number" ? cam.x : 0,
      y: typeof cam.y === "number" ? cam.y : 0,
      zoom: typeof cam.zoom === "number" && cam.zoom > 0 ? Math.min(5, Math.max(0.25, cam.zoom)) : 1,
    },
    updated: typeof b.updated === "string" ? b.updated : new Date().toISOString(),
  };
}

function ensureUniqueBoardIds(list: FreeformBoard[]): FreeformBoard[] {
  const seen = new Set<string>();
  return list.map((b, i) => {
    let id = b.id;
    if (!id || seen.has(id)) id = i === 0 && !seen.has("main") ? "main" : nid();
    seen.add(id);
    return id === b.id ? b : { ...b, id };
  });
}

export function normalizeBoards(raw: unknown): FreeformBoard[] {
  if (Array.isArray(raw)) {
    const list = raw.map(normalizeBoard).filter((b): b is FreeformBoard => Boolean(b));
    return list.length ? ensureUniqueBoardIds(list) : [defaultFreeformBoard()];
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.boards)) return normalizeBoards(obj.boards);
    const one = normalizeBoard(raw);
    if (one) return [one];
  }
  return [defaultFreeformBoard()];
}

export async function loadBoards(
  workspaceId?: string,
  dek?: CryptoKey | null,
): Promise<FreeformBoard[]> {
  const key = workspaceId ? wsBoardKey(workspaceId) : BOARD_KEY;
  const raw = await get(key);
  if (raw == null) return [defaultFreeformBoard()];
  if (isEncryptedEnvelope(raw)) {
    if (!dek) throw new LockedVaultError();
    return normalizeBoards(await decryptJson(raw, dek));
  }
  return normalizeBoards(raw);
}

export async function saveBoards(
  boards: FreeformBoard[],
  workspaceId?: string,
  dek?: CryptoKey | null,
) {
  const list = boards.length ? boards : [defaultFreeformBoard()];
  const key = workspaceId ? wsBoardKey(workspaceId) : BOARD_KEY;
  await writeEncrypted(key, list, dek);
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
    await saveWorkspaceVaultMeta(ws.id, { hasVault: false, recents: [], starred: [], openTabs: [] });
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

export async function walkVault(
  dir: FileSystemDirectoryHandle,
  prefix = "",
): Promise<VaultData> {
  const files: Record<string, string> = {};
  const blobs: Record<string, BlobRecord> = {};
  for await (const [name, handle] of dirEntries(dir)) {
    if (name.startsWith(".") && name !== ".originals" && name !== FOLDER_META_FILE) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      const nested = await walkVault(handle as FileSystemDirectoryHandle, path);
      Object.assign(files, nested.files);
      Object.assign(blobs, nested.blobs);
    } else if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      if (name.endsWith(".md")) {
        files[path] = await file.text();
      } else {
        blobs[path] = {
          mime: file.type || mimeFromPath(path),
          data: await file.arrayBuffer(),
          handle: handle as FileSystemFileHandle,
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
    // Linked originals stay on disk/cloud — Klever only writes files it created.
    if (rec.external || rec.handle || rec.localPath) continue;
    await writePath(root, path, rec.data);
  }
}

export async function readBlobFromVault(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<BlobRecord | null> {
  try {
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) return null;
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]!);
    }
    const handle = await dir.getFileHandle(parts[parts.length - 1]!);
    const file = await handle.getFile();
    return {
      mime: file.type || mimeFromPath(path),
      data: await file.arrayBuffer(),
      handle,
    };
  } catch {
    return null;
  }
}

export async function pickVaultFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error("This browser cannot open a local folder. Use Chrome or Edge, or stay on the sample vault.");
  }
  return window.showDirectoryPicker({ id: "klever-vault", mode: "readwrite" });
}
