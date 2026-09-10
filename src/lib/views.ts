import { computeField } from "@/lib/compute";
import type { DbView, FilterNode, FilterOp, Note, SchemaProp, ViewFilter, ViewSort } from "@/types";
import { nid } from "@/lib/ids";

export function defaultViews(): DbView[] {
  return [
    { id: "table", name: "Table", type: "table" },
    { id: "board", name: "Board", type: "board", groupBy: "status" },
    { id: "gallery", name: "Gallery", type: "gallery", cover: "page", cardSize: "m" },
    { id: "card", name: "Cards", type: "card", cover: "page", cardSize: "m" },
    { id: "list", name: "List", type: "list" },
    { id: "calendar", name: "Calendar", type: "calendar", dateProp: "due" },
    { id: "timeline", name: "Timeline", type: "timeline", dateProp: "due" },
  ];
}

export function newView(type: DbView["type"], name?: string): DbView {
  return {
    id: nid(6),
    name: name ?? type[0].toUpperCase() + type.slice(1),
    type,
    groupBy: type === "board" ? "status" : undefined,
    dateProp: type === "calendar" || type === "timeline" ? "due" : undefined,
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

/** Normalize legacy flat filters into a FilterNode tree. */
export function resolveFilter(view: DbView): FilterNode | null {
  if (view.filter) return view.filter;
  const flat = view.filters ?? [];
  if (!flat.length) return null;
  return {
    type: "group",
    op: "and",
    children: flat.map(
      (f): FilterNode => ({ type: "rule", key: f.key, op: f.op, value: f.value }),
    ),
  };
}

export function filterRemoveKey(node: FilterNode | undefined, key: string): FilterNode | undefined {
  if (!node) return undefined;
  if (node.type === "rule") return node.key === key ? undefined : node;
  const children = node.children
    .map((c) => filterRemoveKey(c, key))
    .filter((c): c is FilterNode => Boolean(c));
  if (!children.length) return undefined;
  return { ...node, children };
}

export function legacyFiltersFromNode(node: FilterNode | null | undefined): ViewFilter[] | undefined {
  if (!node) return undefined;
  if (node.type === "rule") return [{ key: node.key, op: node.op, value: node.value }];
  if (node.op === "and" && node.children.every((c) => c.type === "rule")) {
    return node.children.map((c) =>
      c.type === "rule" ? { key: c.key, op: c.op, value: c.value } : { key: "title", op: "eq" as FilterOp },
    );
  }
  return undefined;
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

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = asText(v).trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isFinite(n)) return n;
  const d = Date.parse(t);
  return Number.isFinite(d) ? d : null;
}

function matchesRule(note: Note, f: ViewFilter, notes: Note[], schema: SchemaProp[]) {
  const raw = propVal(note, f.key, notes, schema);
  const text = asText(raw).toLowerCase();
  const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && !raw.length);
  if (f.op === "empty") return empty;
  if (f.op === "not_empty") return !empty;
  const want = asText(f.value).toLowerCase();
  if (f.op === "eq") return text === want;
  if (f.op === "neq") return text !== want;
  if (f.op === "contains") return text.includes(want);
  const a = asNum(raw);
  const b = asNum(f.value);
  if (a == null || b == null) return false;
  if (f.op === "gt") return a > b;
  if (f.op === "lt") return a < b;
  if (f.op === "gte") return a >= b;
  if (f.op === "lte") return a <= b;
  return true;
}

function matchesNode(note: Note, node: FilterNode, notes: Note[], schema: SchemaProp[]): boolean {
  if (node.type === "rule") {
    return matchesRule(note, { key: node.key, op: node.op, value: node.value }, notes, schema);
  }
  if (!node.children.length) return true;
  if (node.op === "or") return node.children.some((c) => matchesNode(note, c, notes, schema));
  return node.children.every((c) => matchesNode(note, c, notes, schema));
}

function compare(a: Note, b: Note, sort: ViewSort, notes: Note[], schema: SchemaProp[]) {
  const av = asText(propVal(a, sort.key, notes, schema));
  const bv = asText(propVal(b, sort.key, notes, schema));
  const c = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
  return sort.dir === "desc" ? -c : c;
}

export function applyView(rows: Note[], view: DbView, notes: Note[] = rows, schema: SchemaProp[] = []) {
  const filter = resolveFilter(view);
  let out = filter
    ? rows.filter((r) => matchesNode(r, filter, notes, schema))
    : rows;
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

export function emptyFilterGroup(op: "and" | "or" = "and"): FilterNode {
  return { type: "group", op, children: [] };
}

export function emptyFilterRule(key = "title"): FilterNode {
  return { type: "rule", key, op: "eq", value: "" };
}
