import Fuse from "fuse.js";
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

export function searchNotes(notes: Note[], q: string) {
  const query = q.trim();
  if (!query) return notes;
  const fuse = new Fuse(notes, {
    keys: [
      { name: "title", weight: 0.5 },
      { name: "tags", weight: 0.2 },
      { name: "body", weight: 0.3 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
  });
  return fuse.search(query).map((r) => r.item);
}
