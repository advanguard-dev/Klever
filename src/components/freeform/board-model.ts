import { cn } from "@/lib/cn";
import { nid } from "@/lib/ids";
import type {
  FreeformConnection,
  FreeformObject,
  FreeformStickyColor,
  PageFont,
} from "@/types";

export const STICKY_COLORS: {
  id: FreeformStickyColor;
  label: string;
  bg: string;
  /** Fixed paper hex — stickies stay light cream even in dark UI theme. */
  hex: string;
}[] = [
  { id: "amber", label: "Amber", bg: "bg-[#f0e2c4]", hex: "#f0e2c4" },
  { id: "sage", label: "Sage", bg: "bg-[#d8e0d0]", hex: "#d8e0d0" },
  { id: "rose", label: "Rose", bg: "bg-[#ead6d4]", hex: "#ead6d4" },
  { id: "sky", label: "Sky", bg: "bg-[#d4dde8]", hex: "#d4dde8" },
  { id: "paper", label: "Paper", bg: "bg-[#ebe8e0]", hex: "#ebe8e0" },
];

export const TEXT_SIZES = [14, 16, 20, 28, 36] as const;
export const STICKY_TEXT_SIZES = [12, 14, 16, 20, 24] as const;

export const TEXT_COLORS: { id: string; label: string; className: string; hex: string }[] = [
  { id: "ink", label: "Ink", className: "text-ink", hex: "#1b1a16" },
  { id: "mute", label: "Soft", className: "text-mute", hex: "#5f5a52" },
  { id: "sepia", label: "Sepia", className: "text-[#6b5344] dark:text-[#c4a882]", hex: "#6b5344" },
  { id: "slate", label: "Slate", className: "text-[#3d4550] dark:text-[#a8b0bc]", hex: "#3d4550" },
];

/** Klever page fonts — Instrument Sans / Serif / IBM Plex Mono. */
export const BOARD_FONTS: { id: PageFont; label: string; className: string }[] = [
  { id: "sans", label: "Sans", className: "font-sans" },
  { id: "serif", label: "Serif", className: "font-serif" },
  { id: "mono", label: "Mono", className: "font-mono" },
];

export type InkTool = "pen" | "highlighter" | "eraser";

export type StrokeSwatch = {
  id: string;
  label: string;
  stroke: string;
  swatch: string;
  hex: string;
};

export const INK_COLORS: StrokeSwatch[] = [
  { id: "ink", label: "Ink", stroke: "var(--color-ink)", swatch: "bg-ink", hex: "#1b1a16" },
  { id: "mute", label: "Soft", stroke: "var(--color-mute)", swatch: "bg-mute", hex: "#5f5a52" },
  { id: "sepia", label: "Sepia", stroke: "#6b5344", swatch: "bg-[#6b5344]", hex: "#6b5344" },
  { id: "slate", label: "Slate", stroke: "#3d4550", swatch: "bg-[#3d4550]", hex: "#3d4550" },
  { id: "rose", label: "Rose", stroke: "#8a5a54", swatch: "bg-[#8a5a54]", hex: "#8a5a54" },
  { id: "sage", label: "Sage", stroke: "#4a6350", swatch: "bg-[#4a6350]", hex: "#4a6350" },
];

/** Soft marker fills — stroke opacity ~0.35 makes them read as translucent highlighter. */
export const HIGHLIGHT_COLORS: StrokeSwatch[] = [
  { id: "hl-yellow", label: "Yellow", stroke: "#e4d26a", swatch: "bg-[#e4d26a]/70", hex: "#e4d26a" },
  { id: "hl-lime", label: "Lime", stroke: "#b5d46e", swatch: "bg-[#b5d46e]/70", hex: "#b5d46e" },
  { id: "hl-pink", label: "Pink", stroke: "#e6a8bc", swatch: "bg-[#e6a8bc]/70", hex: "#e6a8bc" },
  { id: "hl-sky", label: "Sky", stroke: "#8ebfd4", swatch: "bg-[#8ebfd4]/70", hex: "#8ebfd4" },
  { id: "hl-peach", label: "Peach", stroke: "#e6bf9a", swatch: "bg-[#e6bf9a]/70", hex: "#e6bf9a" },
];

export const PEN_WIDTHS = [1.5, 2.5, 4] as const;
export const HIGHLIGHTER_WIDTHS = [12, 18, 24] as const;
export const DEFAULT_HIGHLIGHT_COLOR = "hl-yellow";
export const HIGHLIGHTER_OPACITY = 0.35;

export function stickyClass(color: FreeformStickyColor) {
  return STICKY_COLORS.find((c) => c.id === color)?.bg ?? "bg-[#f0e2c4]";
}

export function stickyBgHex(color: FreeformStickyColor) {
  return STICKY_COLORS.find((c) => c.id === color)?.hex ?? "#f0e2c4";
}

/** Relative luminance 0–1 (sRGB). */
export function hexLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const srgb = [n >> 16, (n >> 8) & 0xff, n & 0xff].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!;
}

export function stickyIsLight(color: FreeformStickyColor) {
  return hexLuminance(stickyBgHex(color)) > 0.55;
}

/** Default text token for a sticky paper — dark on light, light on dark. */
export function stickyContrastTextColor(color: FreeformStickyColor): string {
  return stickyIsLight(color) ? "ink" : "#f5f2eb";
}

/**
 * Resolve sticky text paint. Theme tokens (`text-ink`) flip light in dark mode;
 * stickies stay cream paper, so named colors map to fixed dark (or light) hexes.
 */
export function resolveStickyTextColor(
  textColor: string | undefined,
  stickyColor: FreeformStickyColor,
): { color: string } {
  const light = stickyIsLight(stickyColor);
  const id = textColor || stickyContrastTextColor(stickyColor);
  if (/^#[0-9a-fA-F]{6}$/.test(id)) {
    return { color: id };
  }
  const darkNamed: Record<string, string> = {
    ink: "#1b1a16",
    mute: "#5f5a52",
    sepia: "#6b5344",
    slate: "#3d4550",
  };
  const lightNamed: Record<string, string> = {
    ink: "#f5f2eb",
    mute: "#c4bfb4",
    sepia: "#e8d4b8",
    slate: "#d0d5dc",
  };
  const map = light ? darkNamed : lightNamed;
  return { color: map[id] ?? (light ? "#1b1a16" : "#f5f2eb") };
}

export function textColorClass(color?: string) {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
  return TEXT_COLORS.find((c) => c.id === color)?.className ?? "text-ink";
}

export function textColorHex(color?: string): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return TEXT_COLORS.find((c) => c.id === color)?.hex ?? "#1b1a16";
}

export function boardFontClass(font?: PageFont) {
  return BOARD_FONTS.find((f) => f.id === font)?.className ?? "font-serif";
}

export function boardEmphasisClass(opts: {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}) {
  return cn(opts.bold && "font-bold", opts.italic && "italic", opts.strike && "line-through");
}

export function inkStrokeValue(id?: string) {
  if (!id || id === "currentColor") return "var(--color-ink)";
  return (
    INK_COLORS.find((c) => c.id === id)?.stroke ??
    HIGHLIGHT_COLORS.find((c) => c.id === id)?.stroke ??
    id
  );
}

/** Hex for `<input type="color">` — named swatches or raw #rrggbb. */
export function strokePickerHex(id?: string): string {
  if (!id) return "#1b1a16";
  const known =
    INK_COLORS.find((c) => c.id === id) ?? HIGHLIGHT_COLORS.find((c) => c.id === id);
  if (known) return known.hex;
  if (/^#[0-9a-fA-F]{6}$/.test(id)) return id;
  return "#1b1a16";
}

export function nextZ(objects: FreeformObject[]) {
  return objects.reduce((m, o) => Math.max(m, o.z), 0) + 1;
}

export function emptyTable(cols = 3, rows = 3): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

export function createText(x: number, y: number, z: number): FreeformObject {
  return {
    id: nid(),
    type: "text",
    x,
    y,
    w: 220,
    h: 48,
    z,
    text: "",
    fontSize: 16,
    color: "ink",
    fontFamily: "serif",
  };
}

export function createSticky(
  x: number,
  y: number,
  z: number,
  color: FreeformStickyColor = "amber",
): FreeformObject {
  return {
    id: nid(),
    type: "sticky",
    x,
    y,
    w: 180,
    h: 160,
    z,
    text: "",
    color,
    fontSize: 14,
    textColor: stickyContrastTextColor(color),
    fontFamily: "serif",
  };
}

export type PathStyle = {
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

export function createPath(
  x: number,
  y: number,
  z: number,
  points: { x: number; y: number }[],
  style: PathStyle = {},
): FreeformObject {
  let maxX = 1;
  let maxY = 1;
  for (const p of points) {
    maxX = Math.max(maxX, p.x + 4);
    maxY = Math.max(maxY, p.y + 4);
  }
  return {
    id: nid(),
    type: "path",
    x,
    y,
    w: maxX,
    h: maxY,
    z,
    points,
    stroke: style.stroke ?? "ink",
    strokeWidth: style.strokeWidth ?? 2,
    opacity: style.opacity ?? 1,
  };
}

export function createImage(
  x: number,
  y: number,
  z: number,
  src: string,
  alt = "Image",
): FreeformObject {
  return { id: nid(), type: "image", x, y, w: 280, h: 200, z, src, alt };
}

export function createLink(x: number, y: number, z: number, url = "https://"): FreeformObject {
  let title = "Link";
  try {
    title = new URL(url).hostname || "Link";
  } catch {
    /* keep default */
  }
  return { id: nid(), type: "link", x, y, w: 240, h: 72, z, url, title };
}

export function createTable(x: number, y: number, z: number): FreeformObject {
  return {
    id: nid(),
    type: "table",
    x,
    y,
    w: 280,
    h: 160,
    z,
    cols: 3,
    rows: 3,
    cells: emptyTable(3, 3),
    headerRow: true,
  };
}

/** Resize table grid, preserving existing cell text where possible. */
export function resizeTableCells(
  cells: string[][],
  cols: number,
  rows: number,
): string[][] {
  const next: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(cells[r]?.[c] ?? "");
    }
    next.push(row);
  }
  return next;
}

export function tablePixelSize(cols: number, rows: number) {
  return {
    w: Math.max(160, cols * 88),
    h: Math.max(96, rows * 36 + 8),
  };
}

export function createMind(
  x: number,
  y: number,
  z: number,
  parentId?: string,
): FreeformObject {
  return {
    id: nid(),
    type: "mind",
    x,
    y,
    w: 180,
    h: 64,
    z,
    text: parentId ? "Child" : "Idea",
    parentId,
    fontSize: 14,
    color: "ink",
    fontFamily: "serif",
  };
}

export const MIND_TEXT_SIZES = [12, 14, 16, 20, 24] as const;

/** Grow mind node height with paragraph lines. */
export function mindNodeHeight(text: string, fontSize = 14) {
  const lines = Math.max(1, text.split("\n").length);
  return Math.max(56, 20 + lines * fontSize * 1.45);
}

export function insertParagraphBreak(text: string) {
  if (!text) return "";
  if (text.endsWith("\n\n")) return text;
  if (text.endsWith("\n")) return `${text}\n`;
  return `${text}\n\n`;
}

export function connectionPairKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function findConnection(
  connections: FreeformConnection[],
  a: string,
  b: string,
) {
  return connections.find(
    (c) => (c.from === a && c.to === b) || (c.from === b && c.to === a),
  );
}

export function createMention(
  x: number,
  y: number,
  z: number,
  noteId: string,
  title: string,
  kind: "page" | "database" | "file" = "page",
): FreeformObject {
  return { id: nid(), type: "mention", x, y, w: 240, h: 56, z, noteId, title, kind };
}

export function pathBounds(points: { x: number; y: number }[]) {
  if (!points.length) return { x: 0, y: 0, w: 1, h: 1 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 4;
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(1, maxX - minX + pad * 2),
    h: Math.max(1, maxY - minY + pad * 2),
  };
}

export function pointsToLocal(
  points: { x: number; y: number }[],
  originX: number,
  originY: number,
) {
  return points.map((p) => ({ x: p.x - originX, y: p.y - originY }));
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True when world point is near a path stroke (for eraser). */
export function hitPathObject(
  obj: Extract<FreeformObject, { type: "path" }>,
  wx: number,
  wy: number,
  threshold = 10,
) {
  const pts = obj.points;
  if (pts.length < 2) {
    if (pts.length === 1) {
      return Math.hypot(wx - (obj.x + pts[0].x), wy - (obj.y + pts[0].y)) <= threshold + obj.strokeWidth;
    }
    return false;
  }
  const pad = threshold + obj.strokeWidth / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = distToSegment(wx, wy, obj.x + a.x, obj.y + a.y, obj.x + b.x, obj.y + b.y);
    if (d <= pad) return true;
  }
  return false;
}
