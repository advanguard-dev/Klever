import type { Note } from "@/types";

export function noteFolder(path: string) {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
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
