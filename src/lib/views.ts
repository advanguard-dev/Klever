import { computeField } from "@/lib/compute";
import type { DbView, Note, SchemaProp, ViewFilter, ViewSort } from "@/types";
import { nid } from "@/lib/ids";

export function defaultViews(): DbView[] {
  return [
    { id: "table", name: "Table", type: "table" },
    { id: "board", name: "Board", type: "board", groupBy: "status" },
    { id: "gallery", name: "Gallery", type: "gallery", cover: "page", cardSize: "m" },
    { id: "card", name: "Cards", type: "card", cover: "page", cardSize: "m" },
    { id: "list", name: "List", type: "list" },
    { id: "calendar", name: "Calendar", type: "calendar", dateProp: "due" },
  ];
}

export function newView(type: DbView["type"], name?: string): DbView {
  return {
    id: nid(6),
    name: name ?? type[0].toUpperCase() + type.slice(1),
    type,
    groupBy: type === "board" ? "status" : undefined,
    dateProp: type === "calendar" ? "due" : undefined,
    cover: type === "gallery" || type === "card" ? "page" : undefined,
    cardSize: type === "gallery" || type === "card" ? "m" : undefined,
  };
}

export function visibleSchema(schema: SchemaProp[], view: DbView) {
  const shown = schema.filter((s) => !s.hidden);
  if (!view.visible?.length) return shown;
  return view.visible
    .map((k) => shown.find((s) => s.key === k))
    .filter((s): s is SchemaProp => Boolean(s));
}

function propVal(note: Note, key: string, notes: Note[], schema: SchemaProp[]) {
  if (key === "title") return note.title;
  if (key === "tags") return note.tags.join(" ");
  const spec = schema.find((s) => s.key === key);
  if (spec) return computeField(note, spec, notes, schema);
  return note.props[key];
}

function asText(v: unknown) {
  if (Array.isArray(v)) return v.join(" ");
  if (v === undefined || v === null) return "";
  return String(v);
}

function matches(note: Note, f: ViewFilter, notes: Note[], schema: SchemaProp[]) {
  const raw = propVal(note, f.key, notes, schema);
  const text = asText(raw).toLowerCase();
  const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && !raw.length);
  if (f.op === "empty") return empty;
  if (f.op === "not_empty") return !empty;
  const want = asText(f.value).toLowerCase();
  if (f.op === "eq") return text === want;
  if (f.op === "neq") return text !== want;
  if (f.op === "contains") return text.includes(want);
  return true;
}

function compare(a: Note, b: Note, sort: ViewSort, notes: Note[], schema: SchemaProp[]) {
  const av = asText(propVal(a, sort.key, notes, schema));
  const bv = asText(propVal(b, sort.key, notes, schema));
  const c = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
  return sort.dir === "desc" ? -c : c;
}

export function applyView(rows: Note[], view: DbView, notes: Note[] = rows, schema: SchemaProp[] = []) {
  let out = rows.filter((r) => (view.filters ?? []).every((f) => matches(r, f, notes, schema)));
  const sorts = view.sorts ?? [];
  if (sorts.length) {
    out = [...out].sort((a, b) => {
      for (const s of sorts) {
        const c = compare(a, b, s, notes, schema);
        if (c) return c;
      }
      return a.title.localeCompare(b.title);
    });
  }
  return out;
}

export function snippet(body: string, n = 140) {
  const text = body.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/[#>*_`[\]]/g, "").trim();
  return text.length > n ? text.slice(0, n).trim() + "…" : text;
}
