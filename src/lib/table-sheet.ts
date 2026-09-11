import type { FreeformObject, PageFont, TableCellStyle, TextAlign, TextVAlign } from "@/types";

export const TABLE_MAX_COLS = 16;
export const TABLE_MAX_ROWS = 32;
export const TABLE_TEXT_SIZES = [12, 13, 14, 16, 18, 20] as const;
export const TABLE_DEFAULT_SIZE = 13;

export type TableRange = { r0: number; c0: number; r1: number; c1: number };
export type TableFn = "SUM" | "AVERAGE" | "MIN" | "MAX" | "COUNT" | "COUNTA";

export function cellKey(r: number, c: number) {
  return `${r},${c}`;
}

export function indexToCol(i: number) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colToIndex(letters: string) {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    if (ch < "A" || ch > "Z") return -1;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function a1(r: number, c: number) {
  return `${indexToCol(c)}${r + 1}`;
}

export function parseA1(ref: string): { r: number; c: number } | null {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const c = colToIndex(m[1]!);
  const r = Number(m[2]) - 1;
  if (c < 0 || r < 0) return null;
  return { r, c };
}

export function a1Range(range: TableRange) {
  const n = normRange(range);
  const a = a1(n.r0, n.c0);
  const b = a1(n.r1, n.c1);
  return a === b ? a : `${a}:${b}`;
}

export function normRange(range: TableRange): TableRange {
  return {
    r0: Math.min(range.r0, range.r1),
    c0: Math.min(range.c0, range.c1),
    r1: Math.max(range.r0, range.r1),
    c1: Math.max(range.c0, range.c1),
  };
}

export function inRange(range: TableRange, r: number, c: number) {
  const n = normRange(range);
  return r >= n.r0 && r <= n.r1 && c >= n.c0 && c <= n.c1;
}

export function rangeCells(range: TableRange) {
  const n = normRange(range);
  const out: { r: number; c: number }[] = [];
  for (let r = n.r0; r <= n.r1; r++) {
    for (let c = n.c0; c <= n.c1; c++) out.push({ r, c });
  }
  return out;
}

export function rangeCount(range: TableRange) {
  const n = normRange(range);
  return (n.r1 - n.r0 + 1) * (n.c1 - n.c0 + 1);
}

export function clampRange(range: TableRange, rows: number, cols: number): TableRange {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return {
    r0: clamp(range.r0, rows - 1),
    c0: clamp(range.c0, cols - 1),
    r1: clamp(range.r1, rows - 1),
    c1: clamp(range.c1, cols - 1),
  };
}

export function mergeCellStyle(base: TableCellStyle, over?: TableCellStyle): TableCellStyle {
  if (!over) return { ...base };
  return { ...base, ...over };
}

export function tableDefaultStyle(opts: {
  fontSize?: number;
  color?: string;
  fontFamily?: PageFont;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  align?: TextAlign;
  valign?: TextVAlign;
  header?: boolean;
}): TableCellStyle {
  return {
    fontSize: opts.fontSize ?? TABLE_DEFAULT_SIZE,
    color: opts.color ?? "ink",
    fontFamily: opts.fontFamily ?? "sans",
    bold: opts.bold ?? Boolean(opts.header),
    italic: opts.italic,
    strike: opts.strike,
    align: opts.align ?? "left",
    valign: opts.valign ?? "middle",
  };
}

export function resolveCellStyle(
  defaults: TableCellStyle,
  map: Record<string, TableCellStyle> | undefined,
  r: number,
  c: number,
  header?: boolean,
): TableCellStyle {
  const base = header ? mergeCellStyle(defaults, { bold: defaults.bold ?? true }) : defaults;
  return mergeCellStyle(base, map?.[cellKey(r, c)]);
}

export function applyStyleToRange(
  map: Record<string, TableCellStyle> | undefined,
  range: TableRange,
  patch: TableCellStyle,
): Record<string, TableCellStyle> {
  const next = { ...(map ?? {}) };
  for (const { r, c } of rangeCells(range)) {
    const key = cellKey(r, c);
    next[key] = { ...next[key], ...patch };
  }
  return next;
}

export function remapCellStyle(
  map: Record<string, TableCellStyle> | undefined,
  remap: (r: number, c: number) => { r: number; c: number } | null,
): Record<string, TableCellStyle> | undefined {
  if (!map) return map;
  const next: Record<string, TableCellStyle> = {};
  for (const [key, style] of Object.entries(map)) {
    const [rs, cs] = key.split(",");
    const r = Number(rs);
    const c = Number(cs);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    const dest = remap(r, c);
    if (!dest) continue;
    next[cellKey(dest.r, dest.c)] = style;
  }
  return next;
}

export function insertRow(cells: string[][], at: number, cols: number) {
  const next = cells.map((row) => [...row]);
  const row = Array.from({ length: cols }, () => "");
  next.splice(Math.max(0, Math.min(at, next.length)), 0, row);
  return next;
}

export function insertCol(cells: string[][], at: number) {
  return cells.map((row) => {
    const next = [...row];
    next.splice(Math.max(0, Math.min(at, next.length)), 0, "");
    return next;
  });
}

export function deleteRow(cells: string[][], at: number) {
  if (cells.length <= 1) return cells.map((row) => [...row]);
  return cells.filter((_, i) => i !== at);
}

export function deleteCol(cells: string[][], at: number) {
  if ((cells[0]?.length ?? 0) <= 1) return cells.map((row) => [...row]);
  return cells.map((row) => row.filter((_, i) => i !== at));
}

export function tsvFromRange(cells: string[][], range: TableRange) {
  const n = normRange(range);
  const lines: string[] = [];
  for (let r = n.r0; r <= n.r1; r++) {
    const row: string[] = [];
    for (let c = n.c0; c <= n.c1; c++) {
      const raw = cells[r]?.[c] ?? "";
      row.push(raw.includes("\t") || raw.includes("\n") ? `"${raw.replace(/"/g, '""')}"` : raw);
    }
    lines.push(row.join("\t"));
  }
  return lines.join("\n");
}

export function parseTsv(text: string): string[][] {
  const rows = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (rows.length && rows[rows.length - 1] === "") rows.pop();
  return rows.map((line) => line.split("\t"));
}

export function pasteTsv(
  cells: string[][],
  start: { r: number; c: number },
  grid: string[][],
  maxRows = TABLE_MAX_ROWS,
  maxCols = TABLE_MAX_COLS,
) {
  const rows = Math.max(cells.length, start.r + grid.length);
  const cols = Math.max(cells[0]?.length ?? 0, start.c + (grid[0]?.length ?? 0));
  const nextRows = Math.min(maxRows, rows);
  const nextCols = Math.min(maxCols, cols);
  const next: string[][] = [];
  for (let r = 0; r < nextRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < nextCols; c++) row.push(cells[r]?.[c] ?? "");
    next.push(row);
  }
  for (let r = 0; r < grid.length; r++) {
    const rr = start.r + r;
    if (rr >= nextRows) break;
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      const cc = start.c + c;
      if (cc >= nextCols) break;
      next[rr]![cc] = grid[r]![c] ?? "";
    }
  }
  return { cells: next, rows: nextRows, cols: nextCols };
}

export function isFormula(raw: string) {
  return raw.trimStart().startsWith("=");
}

function asNumber(value: string): number | null {
  const t = value.trim();
  if (!t || t.startsWith("#")) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

type Getter = (r: number, c: number, visiting: Set<string>) => string;

class Parser {
  s: string;
  i = 0;
  get: Getter;
  rawAt: (r: number, c: number) => string;
  visiting: Set<string>;
  rows: number;
  cols: number;

  constructor(
    src: string,
    get: Getter,
    rawAt: (r: number, c: number) => string,
    visiting: Set<string>,
    rows: number,
    cols: number,
  ) {
    this.s = src.trim().replace(/^\s*=\s*/, "");
    this.get = get;
    this.rawAt = rawAt;
    this.visiting = visiting;
    this.rows = rows;
    this.cols = cols;
  }

  peek() {
    return this.s[this.i] ?? "";
  }

  eat() {
    const ch = this.s[this.i] ?? "";
    this.i += 1;
    return ch;
  }

  skip() {
    while (this.peek() === " ") this.i += 1;
  }

  fail(code: string): never {
    throw new Error(code);
  }

  parse(): number {
    this.skip();
    const v = this.expr();
    this.skip();
    if (this.i < this.s.length) this.fail("#VALUE!");
    return v;
  }

  expr(): number {
    this.skip();
    let v = this.term();
    this.skip();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.eat();
      const r = this.term();
      v = op === "+" ? v + r : v - r;
      this.skip();
    }
    return v;
  }

  term(): number {
    this.skip();
    let v = this.factor();
    this.skip();
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.eat();
      const r = this.factor();
      if (op === "/") {
        if (r === 0) this.fail("#DIV/0!");
        v /= r;
      } else v *= r;
      this.skip();
    }
    return v;
  }

  factor(): number {
    this.skip();
    if (this.peek() === "+") {
      this.eat();
      return this.factor();
    }
    if (this.peek() === "-") {
      this.eat();
      return -this.factor();
    }
    if (this.peek() === "(") {
      this.eat();
      const v = this.expr();
      this.skip();
      if (this.peek() !== ")") this.fail("#VALUE!");
      this.eat();
      return v;
    }
    const ident = this.readIdent();
    if (ident) {
      this.skip();
      if (this.peek() === "(") return this.call(ident);
      const cell = parseA1(ident);
      if (!cell) this.fail("#NAME?");
      return this.cellNum(cell.r, cell.c);
    }
    if ((this.peek() >= "0" && this.peek() <= "9") || this.peek() === ".") return this.number();
    this.fail("#VALUE!");
  }

  readIdent() {
    const start = this.i;
    while (/[A-Za-z]/.test(this.peek())) this.eat();
    while (/[0-9]/.test(this.peek())) this.eat();
    return this.s.slice(start, this.i);
  }

  number() {
    const start = this.i;
    while (/[0-9.]/.test(this.peek())) this.eat();
    const n = Number(this.s.slice(start, this.i));
    if (!Number.isFinite(n)) this.fail("#VALUE!");
    return n;
  }

  call(name: string) {
    this.eat();
    this.skip();
    const argStart = this.i;
    let depth = 1;
    while (this.i < this.s.length && depth) {
      const ch = this.eat();
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
    }
    if (depth) this.fail("#VALUE!");
    const inside = this.s.slice(argStart, this.i - 1).trim();
    const fn = name.toUpperCase() as TableFn | "ABS" | "ROUND";
    if (fn === "ABS") return Math.abs(this.evalArg(inside));
    if (fn === "ROUND") {
      const [raw, digits] = splitArgs(inside);
      const n = this.evalArg(raw);
      const d = digits ? Math.round(this.evalArg(digits)) : 0;
      const p = 10 ** d;
      return Math.round(n * p) / p;
    }
    const nums = this.numsFromArg(inside);
    if (fn === "SUM") return nums.reduce((a, b) => a + b, 0);
    if (fn === "AVERAGE") {
      if (!nums.length) this.fail("#DIV/0!");
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    if (fn === "MIN") {
      if (!nums.length) this.fail("#VALUE!");
      return Math.min(...nums);
    }
    if (fn === "MAX") {
      if (!nums.length) this.fail("#VALUE!");
      return Math.max(...nums);
    }
    if (fn === "COUNT") return nums.length;
    if (fn === "COUNTA") return this.countA(inside);
    this.fail("#NAME?");
  }

  evalArg(src: string) {
    return new Parser(src.startsWith("=") ? src : `=${src}`, this.get, this.rawAt, this.visiting, this.rows, this.cols).parse();
  }

  numsFromArg(src: string) {
    const out: number[] = [];
    for (const part of splitArgs(src)) {
      const range = parseRangeArg(part);
      if (range) {
        for (const { r, c } of rangeCells(range)) {
          const n = asNumber(this.cellRaw(r, c));
          if (n != null) out.push(n);
        }
        continue;
      }
      const n = this.evalArg(part);
      if (Number.isFinite(n)) out.push(n);
    }
    return out;
  }

  countA(src: string) {
    let n = 0;
    for (const part of splitArgs(src)) {
      const range = parseRangeArg(part);
      if (range) {
        for (const { r, c } of rangeCells(range)) {
          if ((this.getRawOnly(r, c) || "").trim()) n += 1;
        }
        continue;
      }
      if (part.trim()) n += 1;
    }
    return n;
  }

  getRawOnly(r: number, c: number) {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return "";
    return this.rawAt(r, c);
  }

  cellRaw(r: number, c: number) {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) this.fail("#REF!");
    return this.get(r, c, this.visiting);
  }

  cellNum(r: number, c: number) {
    const raw = this.cellRaw(r, c);
    if (!raw.trim()) return 0;
    const n = asNumber(raw);
    if (n == null) this.fail("#VALUE!");
    return n;
  }
}

function splitArgs(src: string) {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of src) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function parseRangeArg(src: string): TableRange | null {
  const [a, b] = src.split(":");
  const start = parseA1(a ?? "");
  if (!start) return null;
  if (!b) return { r0: start.r, c0: start.c, r1: start.r, c1: start.c };
  const end = parseA1(b);
  if (!end) return null;
  return { r0: start.r, c0: start.c, r1: end.r, c1: end.c };
}

export function evalCell(
  raw: string,
  get: Getter,
  rawAt: (r: number, c: number) => string,
  r: number,
  c: number,
  rows: number,
  cols: number,
  visiting: Set<string>,
) {
  const text = raw.trim();
  if (!isFormula(text)) return raw;
  const key = cellKey(r, c);
  if (visiting.has(key)) return "#CYCLE!";
  visiting.add(key);
  try {
    const n = new Parser(text, get, rawAt, visiting, rows, cols).parse();
    visiting.delete(key);
    if (!Number.isFinite(n)) return "#VALUE!";
    return formatNum(n);
  } catch (err) {
    visiting.delete(key);
    const msg = err instanceof Error ? err.message : "#VALUE!";
    return msg.startsWith("#") ? msg : "#VALUE!";
  }
}

export function evalSheet(cells: string[][]) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const memo = new Map<string, string>();
  const rawAt = (r: number, c: number) => cells[r]?.[c] ?? "";
  const get: Getter = (r, c, visiting) => {
    const key = cellKey(r, c);
    const hit = memo.get(key);
    if (hit != null) return hit;
    const out = evalCell(rawAt(r, c), get, rawAt, r, c, rows, cols, visiting);
    memo.set(key, out);
    return out;
  };
  const display: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(get(r, c, new Set()));
    display.push(row);
  }
  return display;
}

function formatNum(n: number) {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

export function formulaForSelection(fn: TableFn, range: TableRange) {
  return `=${fn}(${a1Range(range)})`;
}

/** Place a formula next to a multi-cell selection (below a column, right of a row). */
export function formulaAnchor(range: TableRange, rows: number, cols: number) {
  const n = normRange(range);
  const tall = n.r1 - n.r0 >= n.c1 - n.c0;
  if (tall) {
    const r = n.r1 + 1;
    const c = n.c0;
    return {
      r: Math.min(r, TABLE_MAX_ROWS - 1),
      c,
      rows: Math.min(TABLE_MAX_ROWS, Math.max(rows, r + 1)),
      cols,
    };
  }
  const r = n.r0;
  const c = n.c1 + 1;
  return {
    r,
    c: Math.min(c, TABLE_MAX_COLS - 1),
    rows,
    cols: Math.min(TABLE_MAX_COLS, Math.max(cols, c + 1)),
  };
}

type BoardTableObject = Extract<FreeformObject, { type: "table" }>;

function resizeCells(cells: string[][], cols: number, rows: number): string[][] {
  const next: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(cells[r]?.[c] ?? "");
    next.push(row);
  }
  return next;
}

export function tableActiveStyle(obj: BoardTableObject, range: TableRange | null): TableCellStyle {
  const r = range ? normRange(range).r0 : 0;
  const c = range ? normRange(range).c0 : 0;
  return resolveCellStyle(
    tableDefaultStyle({
      fontSize: obj.fontSize,
      color: obj.color,
      fontFamily: obj.fontFamily,
      bold: obj.bold,
      italic: obj.italic,
      strike: obj.strike,
      align: obj.align,
      valign: obj.valign,
      header: !!obj.headerRow && r === 0,
    }),
    obj.cellStyle,
    r,
    c,
    !!obj.headerRow && r === 0,
  );
}

export function applyTableStyle(
  obj: BoardTableObject,
  range: TableRange | null,
  patch: TableCellStyle,
): Partial<BoardTableObject> {
  const target = range ?? { r0: 0, c0: 0, r1: 0, c1: 0 };
  return { cellStyle: applyStyleToRange(obj.cellStyle, target, patch) };
}

export function insertTableFn(
  obj: BoardTableObject,
  range: TableRange | null,
  fn: TableFn,
): Partial<BoardTableObject> {
  const cols = Math.max(1, obj.cols);
  const rows = Math.max(1, obj.rows);
  const cells = resizeCells(obj.cells, cols, rows);
  const sel = range ?? { r0: 0, c0: 0, r1: 0, c1: 0 };
  const dest = formulaAnchor(sel, rows, cols);
  const grown = resizeCells(cells, dest.cols, dest.rows);
  grown[dest.r][dest.c] = formulaForSelection(fn, sel);
  return { cells: grown, cols: dest.cols, rows: dest.rows };
}
