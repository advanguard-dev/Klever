import {
  boardEmphasisClass,
  boardFontClass,
  pigmentHex,
  resizeTableCells,
  textAlignClass,
  textColorClass,
  textVAlignClass,
} from "@/components/freeform/board-model";
import { useContextMenu } from "@/components/ContextMenu";
import { cn } from "@/lib/cn";
import {
  a1,
  a1Range,
  applyStyleToRange,
  clampRange,
  deleteCol,
  deleteRow,
  evalSheet,
  formulaAnchor,
  formulaForSelection,
  inRange,
  indexToCol,
  insertCol,
  insertRow,
  isFormula,
  normRange,
  parseTsv,
  pasteTsv,
  rangeCount,
  remapCellStyle,
  resolveCellStyle,
  TABLE_MAX_COLS,
  TABLE_MAX_ROWS,
  tableDefaultStyle,
  tsvFromRange,
  type TableFn,
  type TableRange,
} from "@/lib/table-sheet";
import type { FreeformPatch } from "@/lib/freeform-patch";
import type { FreeformObject, TableCellStyle } from "@/types";
import { Minus, Plus } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const CELL_CLICK_SLOP = 6;

type BoardTableObject = Extract<FreeformObject, { type: "table" }>;

function rangeCellsSafe(range: TableRange, rows: number, cols: number) {
  const a = normRange(clampRange(range, rows, cols));
  const out: { r: number; c: number }[] = [];
  for (let r = a.r0; r <= a.r1; r++) {
    for (let c = a.c0; c <= a.c1; c++) out.push({ r, c });
  }
  return out;
}

function cellTextPaint(color?: string) {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return { color };
  const className = textColorClass(color);
  if (color && color !== "ink" && className === "text-ink") return { color: pigmentHex(color) };
  return { className };
}

export function BoardTable({
  obj,
  selected,
  editing,
  interactive,
  shell,
  chrome,
  onPointerDown,
  onContextMenu,
  onEdit,
  onPatch,
  onRangeChange,
}: {
  obj: BoardTableObject;
  selected: boolean;
  editing: boolean;
  interactive: boolean;
  shell: string;
  chrome: ReactNode;
  onPointerDown: (e: ReactPointerEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onEdit: (id: string | null) => void;
  onPatch: (id: string, patch: FreeformPatch) => void;
  onRangeChange?: (range: TableRange) => void;
}) {
  const { open } = useContextMenu();
  const cols = Math.max(1, obj.cols);
  const rows = Math.max(1, obj.rows);
  const cells = resizeTableCells(obj.cells, cols, rows);
  const display = useMemo(() => evalSheet(cells), [cells]);
  const [range, setRange] = useState<TableRange>({ r0: 0, c0: 0, r1: 0, c1: 0 });
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const [focusCell, setFocusCell] = useState({ r: 0, c: 0 });
  const dragSel = useRef<{ r: number; c: number } | null>(null);
  const pendingMove = useRef<{ r: number; c: number; x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = { r: focusCell.r, c: focusCell.c };
  const defaults = tableDefaultStyle({
    fontSize: obj.fontSize,
    color: obj.color,
    fontFamily: obj.fontFamily,
    bold: obj.bold,
    italic: obj.italic,
    strike: obj.strike,
    align: obj.align,
    valign: obj.valign,
  });

  const commitRange = (next: TableRange, focus?: { r: number; c: number }, skipFocus?: boolean) => {
    const clamped = clampRange(next, rows, cols);
    rangeRef.current = clamped;
    setRange(clamped);
    const f = focus ?? { r: clamped.r1, c: clamped.c1 };
    setFocusCell({
      r: Math.max(0, Math.min(rows - 1, f.r)),
      c: Math.max(0, Math.min(cols - 1, f.c)),
    });
    onRangeChange?.(clamped);
    if (interactive && !skipFocus) rootRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    onRangeChange?.(clampRange(rangeRef.current, rows, cols));
  }, [obj.id, onRangeChange, rows, cols]);

  const patchCells = (nextCells: string[][], extra?: FreeformPatch) => {
    onPatch(obj.id, {
      cells: nextCells,
      cols: nextCells[0]?.length ?? cols,
      rows: nextCells.length,
      ...extra,
    });
  };

  const patchCell = (ri: number, ci: number, value: string) => {
    const next = resizeTableCells(obj.cells, cols, rows);
    next[ri][ci] = value;
    patchCells(next);
  };

  const beginEditAt = (r: number, c: number) => {
    commitRange({ r0: r, c0: c, r1: r, c1: c }, { r, c });
    onEdit(obj.id);
  };

  const applyStyle = (patch: TableCellStyle) => {
    onPatch(obj.id, {
      cellStyle: applyStyleToRange(obj.cellStyle, rangeRef.current, patch),
    });
  };

  const insertFn = (fn: TableFn) => {
    const sel = normRange(rangeRef.current);
    const dest = formulaAnchor(sel, rows, cols);
    const grown = resizeTableCells(obj.cells, dest.cols, dest.rows);
    grown[dest.r][dest.c] = formulaForSelection(fn, sel);
    patchCells(grown, { cols: dest.cols, rows: dest.rows });
    commitRange({ r0: dest.r, c0: dest.c, r1: dest.r, c1: dest.c }, dest);
    onEdit(obj.id);
  };

  const clearRange = () => {
    const next = resizeTableCells(obj.cells, cols, rows);
    let styles = obj.cellStyle;
    for (const { r, c } of rangeCellsSafe(rangeRef.current, rows, cols)) {
      next[r][c] = "";
      if (styles) {
        const nextStyles = { ...styles };
        delete nextStyles[`${r},${c}`];
        styles = nextStyles;
      }
    }
    patchCells(next, { cellStyle: styles });
  };

  const copyRange = async () => {
    const text = tsvFromRange(cells, rangeRef.current);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
  };

  const pasteAt = async () => {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    if (!text) return;
    const grid = parseTsv(text);
    const start = { r: normRange(rangeRef.current).r0, c: normRange(rangeRef.current).c0 };
    const next = pasteTsv(cells, start, grid);
    patchCells(next.cells, { cols: next.cols, rows: next.rows });
    commitRange({
      r0: start.r,
      c0: start.c,
      r1: start.r + grid.length - 1,
      c1: start.c + (grid[0]?.length ?? 1) - 1,
    });
  };

  const mutateGrid = (kind: "row-in" | "row-del" | "col-in" | "col-del", at: number) => {
    let nextCells = cells;
    let nextCols = cols;
    let nextRows = rows;
    let nextStyle = obj.cellStyle;
    if (kind === "row-in") {
      if (rows >= TABLE_MAX_ROWS) return;
      nextCells = insertRow(cells, at, cols);
      nextRows = nextCells.length;
      nextStyle = remapCellStyle(obj.cellStyle, (r, c) => (r >= at ? { r: r + 1, c } : { r, c }));
    } else if (kind === "row-del") {
      nextCells = deleteRow(cells, at);
      nextRows = nextCells.length;
      nextStyle = remapCellStyle(obj.cellStyle, (r, c) => (r === at ? null : r > at ? { r: r - 1, c } : { r, c }));
    } else if (kind === "col-in") {
      if (cols >= TABLE_MAX_COLS) return;
      nextCells = insertCol(cells, at);
      nextCols = nextCells[0]?.length ?? cols;
      nextStyle = remapCellStyle(obj.cellStyle, (r, c) => (c >= at ? { r, c: c + 1 } : { r, c }));
    } else {
      nextCells = deleteCol(cells, at);
      nextCols = nextCells[0]?.length ?? 1;
      nextStyle = remapCellStyle(obj.cellStyle, (r, c) => (c === at ? null : c > at ? { r, c: c - 1 } : { r, c }));
    }
    patchCells(nextCells, { cols: nextCols, rows: nextRows, cellStyle: nextStyle });
  };

  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      dragSel.current = null;
      const pending = pendingMove.current;
      pendingMove.current = null;
      if (!pending || selected) return;
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > CELL_CLICK_SLOP) return;
      commitRange({ r0: pending.r, c0: pending.c, r1: pending.r, c1: pending.c }, pending);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragSel.current) return;
      const el = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-table-cell]") as HTMLElement | null;
      if (!el) return;
      const r = Number(el.dataset.tableRow);
      const c = Number(el.dataset.tableCol);
      if (!Number.isFinite(r) || !Number.isFinite(c)) return;
      commitRange({ r0: dragSel.current.r, c0: dragSel.current.c, r1: r, c1: c }, { r, c }, true);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointermove", onMove);
    };
  }, [selected, rows, cols]);

  useEffect(() => {
    if (!editing) return;
    const el = gridRef.current?.querySelector<HTMLInputElement>(
      `input[data-table-row="${focusCell.r}"][data-table-col="${focusCell.c}"]`,
    );
    el?.focus();
    el?.select();
  }, [editing, focusCell.c, focusCell.r]);

  const resolveActive = () =>
    resolveCellStyle(defaults, obj.cellStyle, active.r, active.c, !!obj.headerRow && active.r === 0);

  const onGridKey = (e: ReactKeyboardEvent) => {
    if (!selected || !interactive) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "c") {
      e.preventDefault();
      void copyRange();
      return;
    }
    if (meta && e.key.toLowerCase() === "x") {
      e.preventDefault();
      void copyRange().then(clearRange);
      return;
    }
    if (meta && e.key.toLowerCase() === "v") {
      e.preventDefault();
      void pasteAt();
      return;
    }
    if (editing) return;
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      beginEditAt(active.r, active.c);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      clearRange();
      return;
    }
    if (e.key.length === 1 && !meta && !e.altKey) {
      e.preventDefault();
      patchCell(active.r, active.c, e.key);
      beginEditAt(active.r, active.c);
      return;
    }
    const move = (dr: number, dc: number, extend: boolean) => {
      const r = Math.max(0, Math.min(rows - 1, (extend ? range.r1 : active.r) + dr));
      const c = Math.max(0, Math.min(cols - 1, (extend ? range.c1 : active.c) + dc));
      if (extend) commitRange({ ...range, r1: r, c1: c }, { r, c });
      else commitRange({ r0: r, c0: c, r1: r, c1: c }, { r, c });
    };
    if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1, 0, e.shiftKey);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1, 0, e.shiftKey);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(0, -1, e.shiftKey);
    } else if (e.key === "ArrowRight" || e.key === "Tab") {
      e.preventDefault();
      move(0, e.shiftKey && e.key === "Tab" ? -1 : 1, e.key !== "Tab" && e.shiftKey);
    }
  };

  const openCellMenu = (e: ReactMouseEvent, r: number, c: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inRange(range, r, c)) commitRange({ r0: r, c0: c, r1: r, c1: c }, { r, c });
    const sel = normRange(rangeRef.current);
    const multi = rangeCount(sel) > 1;
    open(e, [
      { id: "cut", label: "Cut", hint: "⌘X", onSelect: () => void copyRange().then(clearRange) },
      { id: "copy", label: "Copy", hint: "⌘C", onSelect: () => void copyRange() },
      { id: "paste", label: "Paste", hint: "⌘V", onSelect: () => void pasteAt() },
      { id: "clear", label: "Clear", hint: "⌫", onSelect: clearRange },
      { type: "sep" },
      { id: "row-above", label: "Insert row above", onSelect: () => mutateGrid("row-in", sel.r0) },
      { id: "row-below", label: "Insert row below", onSelect: () => mutateGrid("row-in", sel.r1 + 1) },
      { id: "col-left", label: "Insert column left", onSelect: () => mutateGrid("col-in", sel.c0) },
      { id: "col-right", label: "Insert column right", onSelect: () => mutateGrid("col-in", sel.c1 + 1) },
      { id: "row-del", label: "Delete row", danger: true, onSelect: () => mutateGrid("row-del", sel.r0) },
      { id: "col-del", label: "Delete column", danger: true, onSelect: () => mutateGrid("col-del", sel.c0) },
      { type: "sep" },
      { id: "sum", label: multi ? `SUM(${a1Range(sel)})` : "Insert SUM", onSelect: () => insertFn("SUM") },
      { id: "avg", label: multi ? `AVERAGE(${a1Range(sel)})` : "Insert AVERAGE", onSelect: () => insertFn("AVERAGE") },
      { id: "min", label: "MIN", onSelect: () => insertFn("MIN") },
      { id: "max", label: "MAX", onSelect: () => insertFn("MAX") },
      { id: "count", label: "COUNT", onSelect: () => insertFn("COUNT") },
      { type: "sep" },
      { id: "bold", label: "Bold", onSelect: () => applyStyle({ bold: !resolveActive().bold }) },
      { id: "left", label: "Align left", onSelect: () => applyStyle({ align: "left" }) },
      { id: "center", label: "Align center", onSelect: () => applyStyle({ align: "center" }) },
      { id: "right", label: "Align right", onSelect: () => applyStyle({ align: "right" }) },
    ]);
  };

  const rawActive = cells[active.r]?.[active.c] ?? "";
  const shownActive = display[active.r]?.[active.c] ?? "";

  return (
    <div
      ref={rootRef}
      className={cn(shell, "rounded-xl border border-line bg-paper", (selected || editing) && "select-text")}
      style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: obj.z }}
      data-board-object=""
      data-board-table=""
      tabIndex={selected && interactive ? 0 : -1}
      onPointerDown={(e) => {
        if (editing) {
          e.stopPropagation();
          return;
        }
        onPointerDown(e);
      }}
      onContextMenu={(e) => {
        const cell = (e.target as HTMLElement).closest("[data-table-cell]") as HTMLElement | null;
        if (cell && interactive) {
          openCellMenu(e, Number(cell.dataset.tableRow), Number(cell.dataset.tableCol));
          return;
        }
        onContextMenu(e);
      }}
      onKeyDown={onGridKey}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const cell = (e.target as HTMLElement).closest("[data-table-cell]");
        const r = Number((cell as HTMLElement | null)?.dataset.tableRow);
        const c = Number((cell as HTMLElement | null)?.dataset.tableCol);
        beginEditAt(Number.isFinite(r) ? r : 0, Number.isFinite(c) ? c : 0);
      }}
    >
      {chrome}
      {selected && interactive && (
        <TableChrome
          cols={cols}
          rows={rows}
          headerRow={!!obj.headerRow}
          onCols={(n) =>
            patchCells(resizeTableCells(obj.cells, n, rows), {
              cols: n,
              cellStyle: remapCellStyle(obj.cellStyle, (r, c) => (c >= n ? null : { r, c })),
            })
          }
          onRows={(n) =>
            patchCells(resizeTableCells(obj.cells, cols, n), {
              rows: n,
              cellStyle: remapCellStyle(obj.cellStyle, (r, c) => (r >= n ? null : { r, c })),
            })
          }
          onHeader={() => onPatch(obj.id, { headerRow: !obj.headerRow })}
        />
      )}
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
        {selected && interactive && (
          <div
            className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-paper-2 px-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="font-mono text-[10px] font-medium text-mute">fx</span>
            <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-faint">{a1(active.r, active.c)}</span>
            <input
              aria-label="Formula"
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none"
              value={editing ? rawActive : isFormula(rawActive) ? rawActive : shownActive}
              onChange={(e) => patchCell(active.r, active.c, e.target.value)}
              onFocus={() => beginEditAt(active.r, active.c)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEdit(null);
                  const r = Math.min(rows - 1, active.r + 1);
                  commitRange({ r0: r, c0: active.c, r1: r, c1: active.c }, { r, c: active.c });
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onEdit(null);
                }
              }}
            />
          </div>
        )}
        <div
          ref={gridRef}
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns: `28px repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `22px repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          <div
            className="border-b border-r border-line bg-paper-2 cursor-cell"
            title="Select all"
            onPointerDown={(e) => {
              if (e.button !== 0 || !selected || !interactive) return;
              e.stopPropagation();
              commitRange({ r0: 0, c0: 0, r1: rows - 1, c1: cols - 1 });
            }}
          />
          {Array.from({ length: cols }, (_, ci) => (
            <div
              key={`h-${ci}`}
              className={cn(
                "flex items-center justify-center border-b border-line bg-paper-2 font-mono text-[10px] font-medium text-mute",
                ci < cols - 1 && "border-r",
                active.c === ci && selected && "text-ink",
                selected && interactive && "cursor-cell",
              )}
              onPointerDown={(e) => {
                if (e.button !== 0 || !selected || !interactive) return;
                e.stopPropagation();
                if (e.shiftKey) commitRange({ ...range, c1: ci, r0: 0, r1: rows - 1 });
                else commitRange({ r0: 0, c0: ci, r1: rows - 1, c1: ci });
              }}
            >
              {indexToCol(ci)}
            </div>
          ))}
          {cells.map((row, ri) => (
            <div key={`row-${ri}`} className="contents">
              <div
                className={cn(
                  "flex items-center justify-center border-r border-line bg-paper-2 font-mono text-[10px] tabular-nums text-mute",
                  ri < rows - 1 && "border-b",
                  active.r === ri && selected && "text-ink",
                  selected && interactive && "cursor-cell",
                )}
                onPointerDown={(e) => {
                  if (e.button !== 0 || !selected || !interactive) return;
                  e.stopPropagation();
                  if (e.shiftKey) commitRange({ ...range, r1: ri, c0: 0, c1: cols - 1 });
                  else commitRange({ r0: ri, c0: 0, r1: ri, c1: cols - 1 });
                }}
              >
                {ri + 1}
              </div>
              {row.map((cell, ci) => {
                const style = resolveCellStyle(defaults, obj.cellStyle, ri, ci, !!obj.headerRow && ri === 0);
                const paint = cellTextPaint(style.color);
                const shown = display[ri]?.[ci] ?? "";
                const err = shown.startsWith("#") && shown.endsWith("!");
                const on = selected && inRange(range, ri, ci);
                const live = editing && focusCell.r === ri && focusCell.c === ci;
                return (
                  <div
                    key={`${ri}-${ci}`}
                    data-table-cell=""
                    data-table-row={ri}
                    data-table-col={ci}
                    className={cn(
                      "relative min-h-0 min-w-0 border-line",
                      ci < cols - 1 && "border-r",
                      ri < rows - 1 && "border-b",
                      obj.headerRow && ri === 0 && "bg-paper-2",
                      on && "bg-ring/10",
                      live && "ring-1 ring-inset ring-ring",
                      (selected || editing) && interactive && "cursor-cell",
                    )}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (editing) {
                        e.stopPropagation();
                        return;
                      }
                      if (selected && interactive) {
                        e.stopPropagation();
                        dragSel.current = { r: ri, c: ci };
                        if (e.shiftKey) commitRange({ ...range, r1: ri, c1: ci }, { r: ri, c: ci });
                        else commitRange({ r0: ri, c0: ci, r1: ri, c1: ci }, { r: ri, c: ci });
                        return;
                      }
                      pendingMove.current = { r: ri, c: ci, x: e.clientX, y: e.clientY };
                    }}
                  >
                    {live ? (
                      <input
                        data-table-row={ri}
                        data-table-col={ci}
                        autoFocus
                        className={cn(
                          "absolute inset-0 min-w-0 bg-transparent px-2 py-1 outline-none select-text",
                          boardFontClass(style.fontFamily, "sans"),
                          boardEmphasisClass(style),
                          paint.className,
                          textAlignClass(style.align),
                        )}
                        style={{
                          fontSize: `${style.fontSize ?? 13}px`,
                          lineHeight: 1.35,
                          touchAction: "manipulation",
                          ...(paint.color ? { color: paint.color } : {}),
                        }}
                        value={cell}
                        onChange={(e) => patchCell(ri, ci, e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={() => setFocusCell({ r: ri, c: ci })}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            onEdit(null);
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onEdit(null);
                            const r = Math.min(rows - 1, ri + 1);
                            commitRange({ r0: r, c0: ci, r1: r, c1: ci }, { r, c: ci });
                          }
                          if (e.key === "Tab") {
                            e.preventDefault();
                            onEdit(null);
                            const c = e.shiftKey ? Math.max(0, ci - 1) : Math.min(cols - 1, ci + 1);
                            commitRange({ r0: ri, c0: c, r1: ri, c1: c }, { r: ri, c });
                          }
                        }}
                      />
                    ) : (
                      <span
                        className={cn(
                          "absolute inset-0 flex overflow-hidden px-2 py-1",
                          boardFontClass(style.fontFamily, "sans"),
                          boardEmphasisClass(style),
                          textAlignClass(style.align),
                          textVAlignClass(style.valign),
                          err ? "text-smart" : paint.className,
                        )}
                        style={{
                          fontSize: `${style.fontSize ?? 13}px`,
                          lineHeight: 1.35,
                          ...(!err && paint.color ? { color: paint.color } : {}),
                        }}
                      >
                        <span className="min-w-0 truncate">{shown || <span className="text-faint">·</span>}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableChrome({
  cols,
  rows,
  headerRow,
  onCols,
  onRows,
  onHeader,
}: {
  cols: number;
  rows: number;
  headerRow: boolean;
  onCols: (n: number) => void;
  onRows: (n: number) => void;
  onHeader: () => void;
}) {
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  const btn =
    "flex h-6 w-6 items-center justify-center rounded-full text-mute hover:bg-paper-2 hover:text-ink";

  return (
    <>
      <div
        className="absolute left-1/2 z-30 flex items-center gap-1 rounded-full border border-line bg-paper px-1 py-0.5 shadow-sm"
        style={{
          top: -38,
          transform: "translateX(-50%) scale(var(--board-ui-scale))",
          transformOrigin: "center bottom",
        }}
        title="Columns"
        onPointerDown={stop}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span className="pl-1.5 font-mono text-[9px] uppercase tracking-wide text-faint">Cols</span>
        <button type="button" aria-label="Fewer columns" className={btn} onClick={() => onCols(Math.max(1, cols - 1))}>
          <Minus size={12} strokeWidth={1.5} />
        </button>
        <span className="min-w-4 text-center font-mono text-[11px] tabular-nums text-mute">{cols}</span>
        <button
          type="button"
          aria-label="More columns"
          className={btn}
          onClick={() => onCols(Math.min(TABLE_MAX_COLS, cols + 1))}
        >
          <Plus size={12} strokeWidth={1.5} />
        </button>
        <span className="h-3.5 w-px bg-line" aria-hidden />
        <button
          type="button"
          aria-pressed={headerRow}
          aria-label={headerRow ? "Header row on" : "Header row off"}
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
            headerRow ? "bg-paper-2 text-ink" : "text-mute hover:text-ink",
          )}
          onClick={onHeader}
        >
          Header
        </button>
      </div>
      <div
        className="absolute top-1/2 z-30 flex flex-col items-center gap-0.5 rounded-full border border-line bg-paper px-0.5 py-1 shadow-sm"
        style={{
          right: -38,
          transform: "translateY(-50%) scale(var(--board-ui-scale))",
          transformOrigin: "left center",
        }}
        title="Rows"
        onPointerDown={stop}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Fewer rows" className={btn} onClick={() => onRows(Math.max(1, rows - 1))}>
          <Minus size={12} strokeWidth={1.5} />
        </button>
        <span className="min-h-4 text-center font-mono text-[11px] tabular-nums text-mute">{rows}</span>
        <button
          type="button"
          aria-label="More rows"
          className={btn}
          onClick={() => onRows(Math.min(TABLE_MAX_ROWS, rows + 1))}
        >
          <Plus size={12} strokeWidth={1.5} />
        </button>
      </div>
    </>
  );
}
