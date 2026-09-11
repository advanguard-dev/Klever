import { plainSnippet } from "@/lib/parse";
import type { BlobRecord, Note } from "@/types";

export type VaultHit = {
  id: string;
  title: string;
  path: string;
  kind: "page" | "database" | "file";
  snippet: string;
};

export function searchVaultHits(
  notes: Note[],
  blobs: Record<string, BlobRecord>,
  query: string,
  limit = 12,
): VaultHit[] {
  const q = query.trim().toLowerCase();
  const noteHits: VaultHit[] = notes.map((n) => {
    const kind = n.type === "database" ? ("database" as const) : ("page" as const);
    const snippet =
      kind === "database"
        ? `${(n.schema ?? []).length} fields · Database`
        : plainSnippet(n.body, 120) || "Empty page";
    return {
      id: n.id,
      title: n.title || n.path,
      path: n.path,
      kind,
      snippet,
    };
  });
  const notePaths = new Set(notes.map((n) => n.path));
  const fileHits: VaultHit[] = Object.keys(blobs)
    .filter((path) => !notePaths.has(path))
    .map((path) => {
      const rec = blobs[path];
      return {
        id: path,
        title: path.split("/").pop() || path,
        path,
        kind: "file" as const,
        snippet: rec?.mime ? rec.mime : "File",
      };
    });
  const all = [...noteHits, ...fileHits];
  const filtered = !q
    ? all
    : all.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.path.toLowerCase().includes(q) ||
          h.kind.includes(q) ||
          h.snippet.toLowerCase().includes(q),
      );
  return filtered.slice(0, limit);
}
