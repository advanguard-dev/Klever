import Fuse from "fuse.js";
import { semanticSearch } from "@/lib/semantic-search";
import type { Note } from "@/types";

export function searchSnippet(body: string, q: string, radius = 72) {
  const query = q.trim();
  if (!query) return "";
  const lower = body.toLowerCase();
  const i = lower.indexOf(query.toLowerCase());
  if (i < 0) return "";
  const from = Math.max(0, i - radius);
  const to = Math.min(body.length, i + query.length + radius);
  const slice = body.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${slice}${to < body.length ? "…" : ""}`;
}

let cached: { notes: Note[]; fuse: Fuse<Note> } | null = null;

export function searchNotes(notes: Note[], q: string, opts?: { semantic?: boolean }) {
  const query = q.trim();
  if (!query) return notes;

  if (opts?.semantic) {
    const hits = semanticSearch(
      notes.map((n) => ({ id: n.id, title: n.title, text: `${n.tags.join(" ")} ${n.body}` })),
      query,
      40,
    );
    if (hits.length) {
      const byId = new Map(notes.map((n) => [n.id, n]));
      return hits.map((h) => byId.get(h.id)).filter((n): n is Note => Boolean(n));
    }
  }

  if (!cached || cached.notes !== notes) {
    cached = {
      notes,
      fuse: new Fuse(notes, {
        keys: [
          { name: "title", weight: 0.5 },
          { name: "tags", weight: 0.2 },
          { name: "body", weight: 0.3 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
      }),
    };
  }
  return cached.fuse.search(query).map((r) => r.item);
}
