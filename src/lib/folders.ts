import { slugify } from "@/lib/ids";
import { parseMarkdown } from "@/lib/parse";
import type { Note } from "@/types";
import { stringify as stringifyYaml } from "yaml";

/** Sidecar next to vault pages. Same YAML `icon` key as page frontmatter. */
export const FOLDER_META_FILE = ".klever-folder.md";

export function noteFolder(path: string) {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function isFolderMetaPath(path: string) {
  return path === FOLDER_META_FILE || path.endsWith(`/${FOLDER_META_FILE}`);
}

export function folderMetaPath(folderPath: string) {
  return `${folderPath}/${FOLDER_META_FILE}`;
}

export function folderFromMetaPath(path: string) {
  if (path === FOLDER_META_FILE) return "";
  return path.slice(0, -(FOLDER_META_FILE.length + 1));
}

export function noteIsInFolder(notePath: string, folder: string) {
  if (!folder) return false;
  return notePath.startsWith(`${folder}/`);
}

export function notesToDeleteWithFolder(notes: Note[], folder: string): Note[] {
  const ids = new Set(notes.filter((n) => noteIsInFolder(n.path, folder)).map((n) => n.id));
  let size = 0;
  while (size !== ids.size) {
    size = ids.size;
    for (const n of notes) {
      if (n.parent && ids.has(n.parent)) ids.add(n.id);
    }
  }
  return notes.filter((n) => ids.has(n.id));
}

export function existingFolderPaths(notes: Note[]) {
  const set = new Set<string>();
  for (const n of notes) {
    for (const p of folderAncestors(n.path)) set.add(p);
  }
  return set;
}

export function uniqueFolderPath(occupied: Iterable<string>, desired: string) {
  const taken = new Set(occupied);
  if (!taken.has(desired)) return desired;
  let i = 2;
  while (taken.has(`${desired} ${i}`)) i += 1;
  return `${desired} ${i}`;
}

export function nextFolderPath(notes: Note[], oldPath: string, name: string) {
  const segment = slugify(name);
  const parent = noteFolder(oldPath);
  const desired = parent ? `${parent}/${segment}` : segment;
  if (desired === oldPath) return oldPath;
  const occupied: string[] = [];
  for (const p of existingFolderPaths(notes)) {
    if (p === oldPath || p.startsWith(`${oldPath}/`)) continue;
    occupied.push(p);
  }
  return uniqueFolderPath(occupied, desired);
}

export function rewritePathPrefix(path: string, oldFolder: string, newFolder: string) {
  if (path === oldFolder) return newFolder;
  if (path.startsWith(`${oldFolder}/`)) return `${newFolder}${path.slice(oldFolder.length)}`;
  return path;
}

/** False if dest is empty-invalid, same, already the parent, or inside the dragged folder. */
export function canMoveFolder(from: string, dest: string) {
  if (!from.trim()) return false;
  if (from === dest) return false;
  if (dest.startsWith(`${from}/`)) return false;
  return noteFolder(from) !== dest;
}

export function nestedFolderPath(from: string, dest: string) {
  const name = from.includes("/") ? from.slice(from.lastIndexOf("/") + 1) : from;
  return dest ? `${dest}/${name}` : name;
}

export function remapFolderIcons(
  icons: Record<string, string>,
  oldFolder: string,
  newFolder: string,
) {
  const next: Record<string, string> = {};
  for (const [path, icon] of Object.entries(icons)) {
    next[rewritePathPrefix(path, oldFolder, newFolder)] = icon;
  }
  return next;
}

export function omitFolderIcons(icons: Record<string, string>, folder: string) {
  const next: Record<string, string> = {};
  for (const [path, icon] of Object.entries(icons)) {
    if (path === folder || path.startsWith(`${folder}/`)) continue;
    next[path] = icon;
  }
  return next;
}

export function parseFolderIconsFromFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, raw] of Object.entries(files)) {
    if (!isFolderMetaPath(path)) continue;
    const folder = folderFromMetaPath(path);
    if (!folder) continue;
    const { data } = parseMarkdown(raw);
    const icon = typeof data.icon === "string" && data.icon.trim() ? data.icon.trim() : undefined;
    if (icon) out[folder] = icon;
  }
  return out;
}

export function filesFromFolderIcons(icons: Record<string, string>): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [folder, icon] of Object.entries(icons)) {
    if (!folder || !icon) continue;
    const yaml = stringifyYaml({ icon }, { lineWidth: 0 }).trim();
    files[folderMetaPath(folder)] = `---\n${yaml}\n---\n`;
  }
  return files;
}

export function mergeFolderIcons(
  files: Record<string, string> | null | undefined,
  meta?: Record<string, string> | null,
) {
  return { ...(meta ?? {}), ...(files ? parseFolderIconsFromFiles(files) : {}) };
}

export interface VaultFolder {
  name: string;
  path: string;
  folders: VaultFolder[];
  notes: Note[];
}

export function buildVaultTree(notes: Note[]): VaultFolder {
  const root: VaultFolder = { name: "", path: "", folders: [], notes: [] };
  const map = new Map<string, VaultFolder>([["", root]]);

  const ensure = (folderPath: string): VaultFolder => {
    const hit = map.get(folderPath);
    if (hit) return hit;
    const parentPath = noteFolder(folderPath);
    const parent = ensure(parentPath);
    const name = folderPath.slice(parentPath ? parentPath.length + 1 : 0);
    const node: VaultFolder = { name, path: folderPath, folders: [], notes: [] };
    parent.folders.push(node);
    map.set(folderPath, node);
    return node;
  };

  for (const n of notes) {
    ensure(noteFolder(n.path)).notes.push(n);
  }

  const sort = (f: VaultFolder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name));
    f.notes.sort((a, b) => a.title.localeCompare(b.title));
    f.folders.forEach(sort);
  };
  sort(root);
  return root;
}

/** Depth-first notes in sidebar order: a folder’s pages, then its subfolders. */
export function flattenVaultNotes(root: VaultFolder): Note[] {
  const out: Note[] = [];
  const walk = (f: VaultFolder) => {
    out.push(...f.notes);
    f.folders.forEach(walk);
  };
  walk(root);
  return out;
}

/** Pages in vault order for Read mode prev/next and the page menu. */
export function readingQueue(notes: Note[]): Note[] {
  return flattenVaultNotes(buildVaultTree(notes.filter((n) => n.type === "page")));
}

export function folderAncestors(path: string) {
  const folder = noteFolder(path);
  if (!folder) return [];
  const parts = folder.split("/");
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** Ensure folder nodes exist even when they only contain hidden draft notes. */
export function ensureFolderPaths(root: VaultFolder, folderPaths: string[]) {
  const map = new Map<string, VaultFolder>();
  const index = (f: VaultFolder) => {
    map.set(f.path, f);
    f.folders.forEach(index);
  };
  index(root);

  const ensure = (folderPath: string): VaultFolder => {
    const hit = map.get(folderPath);
    if (hit) return hit;
    const parentPath = noteFolder(folderPath);
    const parent = ensure(parentPath);
    const name = folderPath.slice(parentPath ? parentPath.length + 1 : 0);
    const node: VaultFolder = { name, path: folderPath, folders: [], notes: [] };
    parent.folders.push(node);
    map.set(folderPath, node);
    return node;
  };

  for (const p of folderPaths) {
    if (p) ensure(p);
  }

  const sort = (f: VaultFolder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name));
    f.folders.forEach(sort);
  };
  sort(root);
}
