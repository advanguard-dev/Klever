import { resolveLink } from "@/lib/parse";
import type { Note, RollupAgg, SchemaProp } from "@/types";

export type ComputeCtx = {
  note: Note;
  notes: Note[];
  schema: SchemaProp[];
  depth?: number;
  stack?: Set<string>;
};

export function displayValue(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map(String).join(", ") || "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  }
  return String(v);
}

export function computeField(note: Note, spec: SchemaProp, notes: Note[], schema: SchemaProp[]): unknown {
  const ctx: ComputeCtx = { note, notes, schema, depth: 0, stack: new Set() };
  return readField(ctx, spec.key);
}

export function cellValue(note: Note, spec: SchemaProp, notes: Note[]): unknown {
  const parent = note.parent ? notes.find((n) => n.id === note.parent) : undefined;
  const schema = parent?.schema ?? note.schema ?? [spec];
  return computeField(note, spec, notes, schema);
}

function readField(ctx: ComputeCtx, key: string): unknown {
  const spec = ctx.schema.find((s) => s.key === key || s.name.toLowerCase() === key.toLowerCase());
  const k = spec?.key ?? key;
  const mark = `${ctx.note.id}:${k}`;
  if (ctx.stack?.has(mark)) return "#CYCLE";
  if ((ctx.depth ?? 0) > 8) return "#DEPTH";
  if (k === "title") return ctx.note.title;
  if (k === "tags") return ctx.note.tags;
  if (k === "created") return ctx.note.created;
  if (k === "updated") return ctx.note.updated;
  if (spec?.type === "formula" && spec.formula) {
    const next = { ...ctx, depth: (ctx.depth ?? 0) + 1, stack: new Set(ctx.stack).add(mark) };
    try {
      return evaluate(spec.formula, next);
    } catch (e) {
      return `#ERROR ${e instanceof Error ? e.message : ""}`.trim();
    }
  }
  if (spec?.type === "rollup" && spec.rollup) {
    const next = { ...ctx, depth: (ctx.depth ?? 0) + 1, stack: new Set(ctx.stack).add(mark) };
    return evalRollup(next, spec);
  }
  return ctx.note.props[k];
}

function relatedNotes(ctx: ComputeCtx, relationKey: string): Note[] {
  const raw = ctx.note.props[relationKey];
  const ids = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
  return ids
    .map((id) => resolveLink(id, ctx.notes))
    .filter((n): n is Note => Boolean(n));
}

function relatedSchema(notes: Note[], related: Note[]): SchemaProp[] {
  const parent = related[0]?.parent ? notes.find((n) => n.id === related[0].parent) : undefined;
  return parent?.schema ?? [];
}

function evalRollup(ctx: ComputeCtx, spec: SchemaProp): unknown {
  const cfg = spec.rollup!;
  const related = relatedNotes(ctx, cfg.relation);
  if (cfg.agg === "count") return related.length;
  const rSchema = relatedSchema(ctx.notes, related);
  const values = related.map((n) =>
    readField({ note: n, notes: ctx.notes, schema: rSchema, depth: ctx.depth, stack: ctx.stack }, cfg.property),
  );
  return aggregate(cfg.agg, values, related);
}

function aggregate(agg: RollupAgg, values: unknown[], related: Note[]): unknown {
  const nums = values.map(toNum).filter((n): n is number => n !== null);
  const texts = values.map((v) => (v === undefined || v === null ? "" : String(v))).filter(Boolean);
  const bools = values.map((v) => v === true || v === "true" || v === "Yes");
  const dates = values.map(toTime).filter((n): n is number => n !== null);
  switch (agg) {
    case "count":
      return related.length;
    case "count_unique":
      return new Set(texts).size;
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case "min":
      return nums.length ? Math.min(...nums) : undefined;
    case "max":
      return nums.length ? Math.max(...nums) : undefined;
    case "show":
      return related.map((n) => n.title).slice(0, 8);
    case "show_unique":
      return [...new Set(texts)];
    case "checked":
      return bools.filter(Boolean).length;
    case "percent_checked":
      return values.length ? Math.round((bools.filter(Boolean).length / values.length) * 100) : 0;
    case "earliest":
      return dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : undefined;
    case "latest":
      return dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : undefined;
    default:
      return related.length;
  }
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function toTime(v: unknown): number | null {
  if (!v) return null;
  const t = new Date(String(v)).getTime();
  return Number.isNaN(t) ? null : t;
}

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      let s = "";
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") i++;
        s += src[i++] ?? "";
      }
      i++;
      out.push({ t: "str", v: s });
      continue;
    }
    if (/[0-9.]/.test(c) && !(c === "." && src[i + 1] && /[a-z]/i.test(src[i + 1]))) {
      const m = src.slice(i).match(/^[0-9]*\.?[0-9]+/);
      if (m) {
        out.push({ t: "num", v: Number(m[0]) });
        i += m[0].length;
        continue;
      }
    }
    if ("(),".includes(c)) {
      out.push(c === "(" ? { t: "lp" } : c === ")" ? { t: "rp" } : { t: "comma" });
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two === "&&" ? "and" : two === "||" ? "or" : two });
      i += 2;
      continue;
    }
    if ("+-*/%<>".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    const m = src.slice(i).match(/^[A-Za-z_][\w]*/);
    if (m) {
      const w = m[0];
      const kw = w.toLowerCase();
      if (["and", "or", "not"].includes(kw)) out.push({ t: "op", v: kw });
      else out.push({ t: "id", v: w });
      i += w.length;
      continue;
    }
    throw new Error(`Unexpected ${c}`);
  }
  return out;
}

export function evaluate(src: string, ctx: ComputeCtx): unknown {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const take = () => toks[p++];
  const want = (t: Tok["t"], v?: string) => {
    const x = take();
    if (!x || x.t !== t || (v && (x as { v?: string }).v !== v)) throw new Error("Syntax");
    return x;
  };

  function parseOr(): unknown {
    let left = parseAnd();
    while (peek()?.t === "op" && peek()?.t === "op" && (peek() as { v: string }).v === "or") {
      take();
      left = truthy(left) || truthy(parseAnd());
    }
    return left;
  }
  function parseAnd(): unknown {
    let left = parseEq();
    while (peek()?.t === "op" && (peek() as { v: string }).v === "and") {
      take();
      left = truthy(left) && truthy(parseEq());
    }
    return left;
  }
  function parseEq(): unknown {
    let left = parseAdd();
    while (peek()?.t === "op" && ["==", "!=", ">", "<", ">=", "<="].includes((peek() as { v: string }).v)) {
      const op = (take() as { v: string }).v;
      const right = parseAdd();
      left = cmp(left, right, op);
    }
    return left;
  }
  function parseAdd(): unknown {
    let left = parseMul();
    while (peek()?.t === "op" && ["+", "-"].includes((peek() as { v: string }).v)) {
      const op = (take() as { v: string }).v;
      const right = parseMul();
      if (op === "+" && (typeof left === "string" || typeof right === "string")) left = String(left ?? "") + String(right ?? "");
      else left = (toNum(left) ?? 0) + (op === "+" ? 1 : -1) * (toNum(right) ?? 0);
    }
    return left;
  }
  function parseMul(): unknown {
    let left = parseUnary();
    while (peek()?.t === "op" && ["*", "/", "%"].includes((peek() as { v: string }).v)) {
      const op = (take() as { v: string }).v;
      const right = parseUnary();
      const a = toNum(left) ?? 0;
      const b = toNum(right) ?? 0;
      left = op === "*" ? a * b : op === "/" ? (b === 0 ? "#DIV0" : a / b) : b === 0 ? "#DIV0" : a % b;
    }
    return left;
  }
  function parseUnary(): unknown {
    if (peek()?.t === "op" && (peek() as { v: string }).v === "-") {
      take();
      return -(toNum(parseUnary()) ?? 0);
    }
    if (peek()?.t === "op" && (peek() as { v: string }).v === "not") {
      take();
      return !truthy(parseUnary());
    }
    return parsePrimary();
  }
  function parsePrimary(): unknown {
    const t = peek();
    if (!t) throw new Error("Unexpected end");
    if (t.t === "num") {
      take();
      return t.v;
    }
    if (t.t === "str") {
      take();
      return t.v;
    }
    if (t.t === "lp") {
      take();
      const e = parseOr();
      want("rp");
      return e;
    }
    if (t.t === "id") {
      take();
      const name = t.v;
      if (peek()?.t === "lp") {
        take();
        const args: unknown[] = [];
        if (peek()?.t !== "rp") {
          args.push(parseOr());
          while (peek()?.t === "comma") {
            take();
            args.push(parseOr());
          }
        }
        want("rp");
        return call(name, args, ctx);
      }
      const low = name.toLowerCase();
      if (low === "true") return true;
      if (low === "false") return false;
      if (low === "now") return new Date().toISOString();
      return readField(ctx, name);
    }
    throw new Error("Syntax");
  }

  const val = parseOr();
  if (p < toks.length) throw new Error("Trailing input");
  return val;
}

function call(name: string, args: unknown[], ctx: ComputeCtx): unknown {
  const n = name.toLowerCase();
  if (n === "prop") return readField(ctx, String(args[0] ?? ""));
  if (n === "title") return ctx.note.title;
  if (n === "if") return truthy(args[0]) ? args[1] : args[2];
  if (n === "empty") return args[0] === undefined || args[0] === null || args[0] === "" || (Array.isArray(args[0]) && !args[0].length);
  if (n === "not") return !truthy(args[0]);
  if (n === "and") return args.every(truthy);
  if (n === "or") return args.some(truthy);
  if (n === "len" || n === "length") {
    const v = args[0];
    if (Array.isArray(v)) return v.length;
    if (typeof v === "string") return v.length;
    return v == null ? 0 : 1;
  }
  if (n === "number") return toNum(args[0]) ?? 0;
  if (n === "str" || n === "string") return displayValue(args[0]);
  if (n === "contains") return String(args[0] ?? "").toLowerCase().includes(String(args[1] ?? "").toLowerCase());
  if (n === "concat") return args.map((a) => (a == null ? "" : String(a))).join("");
  if (n === "abs") return Math.abs(toNum(args[0]) ?? 0);
  if (n === "round") return Math.round(toNum(args[0]) ?? 0);
  if (n === "min") return Math.min(...args.map((a) => toNum(a) ?? Infinity));
  if (n === "max") return Math.max(...args.map((a) => toNum(a) ?? -Infinity));
  if (n === "now") return new Date().toISOString();
  if (n === "days") {
    const a = toTime(args[0]);
    const b = toTime(args[1] ?? new Date().toISOString());
    if (a == null || b == null) return undefined;
    return Math.round((b - a) / 86400000);
  }
  if (n === "lower") return String(args[0] ?? "").toLowerCase();
  if (n === "upper") return String(args[0] ?? "").toUpperCase();
  if (n === "slice") {
    const s = String(args[0] ?? "");
    const start = Number(args[1] ?? 0);
    const end = args[2] === undefined ? undefined : Number(args[2]);
    return s.slice(start, end);
  }
  if (n === "replace") {
    const s = String(args[0] ?? "");
    const pattern = String(args[1] ?? "");
    const repl = String(args[2] ?? "");
    try {
      return s.replace(new RegExp(pattern, "g"), repl);
    } catch {
      return s.split(pattern).join(repl);
    }
  }
  if (n === "match") {
    const s = String(args[0] ?? "");
    const pattern = String(args[1] ?? "");
    try {
      return new RegExp(pattern).test(s);
    } catch {
      return s.includes(pattern);
    }
  }
  if (n === "formatdate" || n === "format_date") {
    const t = toTime(args[0]);
    if (t == null) return "";
    const fmt = String(args[1] ?? "YYYY-MM-DD");
    const d = new Date(t);
    const pad = (x: number) => String(x).padStart(2, "0");
    return fmt
      .replace(/YYYY/g, String(d.getFullYear()))
      .replace(/MM/g, pad(d.getMonth() + 1))
      .replace(/DD/g, pad(d.getDate()))
      .replace(/HH/g, pad(d.getHours()))
      .replace(/mm/g, pad(d.getMinutes()));
  }
  throw new Error(`Unknown ${name}`);
}

function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

function cmp(a: unknown, b: unknown, op: string): boolean {
  if (op === "==") return String(a ?? "") === String(b ?? "");
  if (op === "!=") return String(a ?? "") !== String(b ?? "");
  const an = toNum(a);
  const bn = toNum(b);
  if (an != null && bn != null) {
    if (op === ">") return an > bn;
    if (op === "<") return an < bn;
    if (op === ">=") return an >= bn;
    if (op === "<=") return an <= bn;
  }
  const as = String(a ?? "");
  const bs = String(b ?? "");
  if (op === ">") return as > bs;
  if (op === "<") return as < bs;
  if (op === ">=") return as >= bs;
  return as <= bs;
}
