import type { GraphEdge, GraphNode, Note } from "@/types";
import { applyOutsideCode, extractWikilinks, resolveLink, WIKI_RE } from "@/lib/parse";

export function buildGraph(notes: Note[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    kind: n.type,
    tags: n.tags,
  }));
  const tags = new Set<string>();
  for (const n of notes) n.tags.forEach((t) => tags.add(t));
  for (const t of tags) {
    nodes.push({ id: `tag:${t}`, title: `#${t}`, kind: "tag", tags: [t] });
  }

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const add = (source: string, target: string, kind: GraphEdge["kind"]) => {
    if (source === target) return;
    const key = `${kind}:${source}->${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind });
  };

  for (const note of notes) {
    for (const { target } of extractWikilinks(note.body)) {
      const hit = resolveLink(target, notes);
      if (hit) add(note.id, hit.id, "link");
    }
    for (const [key, val] of Object.entries(note.props)) {
      const schema =
        notes.find((n) => n.id === note.parent)?.schema?.find((s) => s.key === key) ??
        note.schema?.find((s) => s.key === key);
      const isRel =
        schema?.type === "relation" ||
        schema?.type === "people" ||
        key === "related" ||
        key === "people";
      if (!isRel) continue;
      const list = Array.isArray(val) ? val : val ? [val] : [];
      for (const item of list) {
        const hit = resolveLink(String(item), notes);
        if (hit) add(note.id, hit.id, "relation");
      }
    }
    for (const t of note.tags) add(note.id, `tag:${t}`, "tag");
  }

  return { nodes, edges };
}

export function backlinks(noteId: string, notes: Note[]): Note[] {
  return notes.filter((n) => {
    if (n.id === noteId) return false;
    return extractWikilinks(n.body).some((l) => resolveLink(l.target, notes)?.id === noteId);
  });
}

export function unlinkedMentions(note: Note, notes: Note[]): Note[] {
  const title = note.title.trim();
  if (title.length < 3) return [];
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\[\\w])${escaped}(?![\\w\\]])`, "i");
  const linked = new Set(backlinks(note.id, notes).map((n) => n.id));
  return notes.filter((n) => {
    if (n.id === note.id) return false;
    if (linked.has(n.id)) return false;
    const stripped = applyOutsideCode(n.body, (chunk) => chunk.replace(WIKI_RE, " "));
    return re.test(stripped);
  });
}

export function relationsTo(noteId: string, notes: Note[]): Note[] {
  const note = notes.find((n) => n.id === noteId);
  return notes.filter((n) => {
    if (n.id === noteId) return false;
    return Object.entries(n.props).some(([key, val]) => {
      const schema =
        notes.find((d) => d.id === n.parent)?.schema?.find((s) => s.key === key) ??
        n.schema?.find((s) => s.key === key);
      if (
        schema &&
        schema.type !== "relation" &&
        schema.type !== "people" &&
        key !== "related" &&
        key !== "people"
      ) {
        return false;
      }
      const list = Array.isArray(val) ? val : val ? [val] : [];
      return list.some((item) => resolveLink(String(item), notes)?.id === noteId || String(item) === note?.title);
    });
  });
}
