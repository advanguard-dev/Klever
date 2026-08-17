import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { DbView, Note, NoteComment, SchemaProp } from "@/types";

const FM_KEYS = new Set([
  "id",
  "title",
  "type",
  "icon",
  "cover",
  "font",
  "width",
  "smallText",
  "template",
  "tags",
  "parent",
  "schema",
  "views",
  "comments",
  "created",
  "updated",
  "props",
]);

export function parseMarkdown(raw: string): { data: Record<string, unknown>; body: string } {
  if (!raw.startsWith("---")) {
    const title = firstHeading(raw);
    return { data: title ? { title } : {}, body: raw };
  }
  const rest = raw.slice(3);
  const end = rest.search(/\n---\s*(?:\n|$)/);
  if (end < 0) return { data: {}, body: raw };
  const yamlText = rest.slice(0, end).trim();
  const body = rest.slice(end).replace(/^\n---\s*/, "").replace(/^\n/, "");
  let data: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(yamlText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = {};
  }
  return { data, body };
}

function firstHeading(body: string) {
  const m = body.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim();
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function asTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);
  }
  return [];
}

export const WIKI_RE = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;
export const EMBED_RE = /!\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
export const TAG_RE = /(^|[\s(])#([A-Za-z][\w-/]*)/g;

export function extractWikilinks(text: string) {
  const links: { target: string; alias?: string }[] = [];
  applyOutsideCode(text, (chunk) => {
    const re = new RegExp(WIKI_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk))) {
      links.push({ target: m[1].trim(), alias: m[2]?.trim() });
    }
    return chunk;
  });
  return links;
}

export function extractInlineTags(text: string) {
  const tags = new Set<string>();
  applyOutsideCode(text, (chunk) => {
    const re = new RegExp(TAG_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk))) tags.add(m[2]);
    return chunk;
  });
  return [...tags];
}

export function applyOutsideCode(md: string, fn: (s: string) => string) {
  const parts = md.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((p, i) => (i % 2 ? p : fn(p))).join("");
}

export function extractOutline(body: string) {
  return [...body.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((m) => ({
    level: m[1].length,
    text: m[2].trim(),
  }));
}

export function headingSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function scrollToHeading(text: string) {
  const root = document.querySelector("main");
  if (!root) return;
  const id = headingSlug(text);
  const byId = id ? root.querySelector(`#${CSS.escape(id)}`) : null;
  if (byId) {
    byId.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  for (const h of root.querySelectorAll("h1, h2, h3")) {
    if (h.textContent?.trim() === text.trim()) {
      h.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
}

export function plainSnippet(body: string, n = 180) {
  const t = applyOutsideCode(body, (chunk) =>
    chunk
      .replace(EMBED_RE, "$1")
      .replace(WIKI_RE, (_raw, target: string, alias?: string) => alias?.trim() || target.trim()),
  )
    .replace(/^#+\s+/gm, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n).trim()}…`;
}

export function wikifyForPreview(md: string) {
  return applyOutsideCode(normalizeCallouts(md), (chunk) =>
    chunk
      .replace(EMBED_RE, (_raw, target: string, _heading?: string, alias?: string) => {
        const label = alias?.trim() || target.trim();
        return `[${label}](embed:${encodeURIComponent(target.trim())})`;
      })
      .replace(WIKI_RE, (_raw, target: string, alias?: string) => {
        const label = alias?.trim() || target.trim();
        return `[${label}](wiki:${encodeURIComponent(target.trim())})`;
      }),
  );
}

export function normalizeCallouts(md: string) {
  return applyOutsideCode(md, (chunk) => chunk.replace(/^> \[!(\w+)\][^\n]*$/gm, "> **$1**"));
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

export function wikiToHtmlSpans(md: string) {
  return applyOutsideCode(normalizeCallouts(md), (chunk) =>
    chunk
      .replace(EMBED_RE, (_raw, target: string, _heading?: string, alias?: string) => {
        const t = target.trim();
        const label = alias?.trim() || t;
        return `<span data-wiki="${escHtml(t)}" data-embed="true" class="wiki-link wiki-embed">${escHtml(label)}</span>`;
      })
      .replace(WIKI_RE, (_raw, target: string, alias?: string) => {
        const t = target.trim();
        const label = alias?.trim() || t;
        return `<span data-wiki="${escHtml(t)}" class="wiki-link">${escHtml(label)}</span>`;
      }),
  );
}

export function fileToNote(path: string, raw: string): Note {
  const { data, body } = parseMarkdown(raw);
  const titleFromPath = path.replace(/\.database\.md$|\.md$/i, "").split("/").at(-1) || "Untitled";
  const isDb =
    data.type === "database" || path.endsWith(".database.md") || Array.isArray(data.schema);
  const nestedProps =
    data.props && typeof data.props === "object" && !Array.isArray(data.props)
      ? (data.props as Record<string, unknown>)
      : {};
  const props: Record<string, unknown> = { ...nestedProps };
  for (const [k, v] of Object.entries(data)) {
    if (!FM_KEYS.has(k)) props[k] = v;
  }
  const tags = [
    ...new Set([...asTags(data.tags), ...asTags(props.tags), ...extractInlineTags(body)]),
  ];
  delete props.tags;
  return {
    id: asString(data.id) || path,
    path,
    title: asString(data.title) || titleFromPath,
    body,
    type: isDb ? "database" : "page",
    icon: asString(data.icon),
    cover: asString(data.cover),
    font: data.font === "serif" || data.font === "mono" || data.font === "sans" ? data.font : undefined,
    width: data.width === "s" || data.width === "m" || data.width === "l" ? data.width : undefined,
    smallText: Boolean(data.smallText),
    template: Boolean(data.template),
    tags,
    parent: asString(data.parent),
    props,
    schema: Array.isArray(data.schema) ? (data.schema as SchemaProp[]) : undefined,
    views: Array.isArray(data.views) ? (data.views as DbView[]) : undefined,
    comments: Array.isArray(data.comments) ? (data.comments as NoteComment[]) : undefined,
    created: asString(data.created) || new Date().toISOString(),
    updated: asString(data.updated) || new Date().toISOString(),
  };
}

function cleanFm(note: Note): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    id: note.id,
    title: note.title,
    type: note.type,
    created: note.created,
    updated: note.updated,
  };
  if (note.icon) fm.icon = note.icon;
  if (note.cover) fm.cover = note.cover;
  if (note.font) fm.font = note.font;
  if (note.width) fm.width = note.width;
  if (note.smallText) fm.smallText = true;
  if (note.template) fm.template = true;
  if (note.tags.length) fm.tags = note.tags;
  if (note.parent) fm.parent = note.parent;
  if (note.schema) fm.schema = note.schema;
  if (note.views) fm.views = note.views;
  if (note.comments?.length) fm.comments = note.comments;
  for (const [k, v] of Object.entries(note.props)) {
    if (v !== undefined && v !== null && v !== "") fm[k] = v;
  }
  return fm;
}

export function noteToFile(note: Note): string {
  const yaml = stringifyYaml(cleanFm(note), { lineWidth: 0 }).trim();
  const body = note.body.replace(/^\n+/, "");
  return `---\n${yaml}\n---\n\n${body}`;
}

export function notesFromFiles(files: Record<string, string>): Note[] {
  return Object.entries(files)
    .filter(([path]) => path.endsWith(".md") && !path.split("/").some((p) => p.startsWith(".")))
    .map(([path, raw]) => fileToNote(path, raw))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function resolveLink(target: string, notes: Note[]): Note | undefined {
  const t = target.trim();
  return (
    notes.find((n) => n.title === t) ||
    notes.find((n) => n.id === t) ||
    notes.find((n) => n.path === t || n.path === `${t}.md`) ||
    notes.find((n) => n.title.toLowerCase() === t.toLowerCase())
  );
}

export function outgoingIds(note: Note, notes: Note[]): string[] {
  const ids = new Set<string>();
  for (const { target } of extractWikilinks(note.body)) {
    const hit = resolveLink(target, notes);
    if (hit) ids.add(hit.id);
  }
  for (const v of Object.values(note.props)) {
    const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    for (const item of list) {
      const hit = resolveLink(String(item), notes);
      if (hit) ids.add(hit.id);
    }
  }
  return [...ids];
}
