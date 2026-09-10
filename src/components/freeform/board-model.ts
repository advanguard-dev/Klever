import { cn } from "@/lib/cn";
import { nid } from "@/lib/ids";
import { PAGE_FONTS } from "@/lib/page-fonts";
import type {
  FreeformCamera,
  FreeformConnection,
  FreeformObject,
  FreeformShapeKind,
  FreeformStickyColor,
  FreeformStrokeDash,
  PageFont,
  TextAlign,
  TextVAlign,
} from "@/types";

/** Board camera. World strokes thicken with zoom; screen chrome uses `--board-ui-scale`. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 5;

export function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

const OBJECT_KIND_LABEL: Record<FreeformObject["type"], string> = {
  text: "Text",
  sticky: "Sticky",
  shape: "Shape",
  mind: "Mind map",
  table: "Table",
  link: "Link",
  mention: "Page",
  image: "Image",
  path: "Ink",
};

export function objectKindLabel(obj: FreeformObject) {
  return OBJECT_KIND_LABEL[obj.type];
}

/** Visible text used for board find. Paths have none. */
export function objectSearchHaystack(obj: FreeformObject): string {
  switch (obj.type) {
    case "text":
    case "sticky":
    case "shape":
    case "mind":
      return obj.text ?? "";
    case "link":
      return [obj.title, obj.url].filter(Boolean).join(" ");
    case "mention":
      return obj.title ?? "";
    case "table":
      return (obj.cells ?? []).flat().join(" ");
    case "image":
      return obj.alt ?? "";
    case "path":
      return "";
  }
}

export function objectSearchPreview(
  obj: FreeformObject,
  extra = "",
): { kind: string; title: string } {
  const hay = `${objectSearchHaystack(obj)} ${extra}`.replace(/\s+/g, " ").trim();
  return {
    kind: objectKindLabel(obj),
    title: hay.slice(0, 80) || objectKindLabel(obj),
  };
}

const SEARCHABLE_TYPES = new Set<FreeformObject["type"]>([
  "text",
  "sticky",
  "shape",
  "link",
  "mention",
  "table",
  "mind",
]);

export function searchBoardObjects(
  objects: FreeformObject[],
  q: string,
  extraHaystack?: (obj: FreeformObject) => string,
): FreeformObject[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return objects.filter((o) => {
    if (!SEARCHABLE_TYPES.has(o.type)) return false;
    const hay = `${objectSearchHaystack(o)} ${extraHaystack?.(o) ?? ""}`.toLowerCase();
    return hay.trim() && words.every((w) => hay.includes(w));
  });
}

/** Pan to center `obj`; if zoomed out, zoom in to fit + padding, capped at 100%. */
export function cameraForObjectFocus(
  obj: Pick<FreeformObject, "x" | "y" | "w" | "h">,
  viewport: { width: number; height: number },
  currentZoom: number,
): FreeformCamera {
  const pad = 96;
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  const fit = Math.min(vw / Math.max(obj.w + pad * 2, 1), vh / Math.max(obj.h + pad * 2, 1));
  const readable = clampZoom(Math.min(1, fit));
  const z = clampZoom(currentZoom);
  const zoom = z < readable ? readable : z;
  const cx = obj.x + obj.w / 2;
  const cy = obj.y + obj.h / 2;
  return { zoom, x: vw / 2 - cx * zoom, y: vh / 2 - cy * zoom };
}

/**
 * Mineral pigments — gouache on blotting paper, not a UI rainbow.
 * Ids `amber | sage | rose | sky | paper | ink | mute | sepia | slate` stay for existing boards.
 */
export type Pigment = {
  id: string;
  label: string;
  hex: string;
  /** Theme token for ink that must flip in dark UI. */
  css?: string;
  sticky?: boolean;
};

export const PIGMENTS: Pigment[] = [
  { id: "bone", label: "Bone", hex: "#f3efe4", sticky: true },
  { id: "paper", label: "Paper", hex: "#ebe8e0", sticky: true },
  { id: "amber", label: "Straw", hex: "#e4cc8a", sticky: true },
  { id: "ochre", label: "Ochre", hex: "#c9923a", sticky: true },
  { id: "clay", label: "Clay", hex: "#c4845c", sticky: true },
  { id: "cinnabar", label: "Cinnabar", hex: "#c45c48", sticky: true },
  { id: "rose", label: "Rose", hex: "#e0b8b4", sticky: true },
  { id: "wisteria", label: "Wisteria", hex: "#8b7aa8", sticky: true },
  { id: "indigo", label: "Indigo", hex: "#3d4f73", sticky: true },
  { id: "sky", label: "Sky", hex: "#b7c6d8", sticky: true },
  { id: "celadon", label: "Celadon", hex: "#4f8a78", sticky: true },
  { id: "sage", label: "Sage", hex: "#c5d4c4", sticky: true },
  { id: "graphite", label: "Graphite", hex: "#3a3d3a" },
  { id: "ink", label: "Ink", hex: "#151716", css: "var(--color-ink)" },
  { id: "mute", label: "Soft", hex: "#5f5a52", css: "var(--color-mute)" },
  { id: "sepia", label: "Sepia", hex: "#6b5344" },
  { id: "slate", label: "Slate", hex: "#3d4550" },
];

export function pigmentById(id?: string): Pigment | undefined {
  if (!id) return undefined;
  return PIGMENTS.find((p) => p.id === id);
}

export function pigmentHex(id?: string, fallback = "#151716"): string {
  if (id && /^#[0-9a-fA-F]{6}$/.test(id)) return id;
  return pigmentById(id)?.hex ?? fallback;
}

export const STICKY_COLORS: {
  id: string;
  label: string;
  bg: string;
  /** Fixed paper hex — stickies stay this pigment even in dark UI theme. */
  hex: string;
}[] = PIGMENTS.filter((p) => p.sticky).map((p) => ({
  id: p.id,
  label: p.label,
  bg: "",
  hex: p.hex,
}));

export const TEXT_SIZES = [14, 16, 20, 28, 36] as const;
export const STICKY_TEXT_SIZES = [12, 14, 16, 20, 24] as const;

export const TEXT_COLORS: { id: string; label: string; className: string; hex: string }[] = [
  { id: "ink", label: "Ink", className: "text-ink", hex: "#151716" },
  { id: "mute", label: "Soft", className: "text-mute", hex: "#5f5a52" },
  { id: "sepia", label: "Sepia", className: "text-[#6b5344] dark:text-[#c4a882]", hex: "#6b5344" },
  { id: "slate", label: "Slate", className: "text-[#3d4550] dark:text-[#a8b0bc]", hex: "#3d4550" },
];

/** @deprecated use PAGE_FONTS */
export const BOARD_FONTS = PAGE_FONTS;

export type InkTool = "pen" | "highlighter" | "eraser";

export type StrokeSwatch = {
  id: string;
  label: string;
  stroke: string;
  swatch: string;
  hex: string;
};

export const INK_COLORS: StrokeSwatch[] = PIGMENTS.map((p) => ({
  id: p.id,
  label: p.label,
  stroke: p.css ?? p.hex,
  swatch: "",
  hex: p.hex,
}));

/** Soft marker fills — stroke opacity ~0.35 makes them read as translucent highlighter. */
export const HIGHLIGHT_COLORS: StrokeSwatch[] = [
  { id: "hl-yellow", label: "Straw", stroke: "#e4cc8a", swatch: "", hex: "#e4cc8a" },
  { id: "hl-lime", label: "Celadon", stroke: "#8fbfa8", swatch: "", hex: "#8fbfa8" },
  { id: "hl-pink", label: "Rose", stroke: "#e0b8b4", swatch: "", hex: "#e0b8b4" },
  { id: "hl-sky", label: "Sky", stroke: "#b7c6d8", swatch: "", hex: "#b7c6d8" },
  { id: "hl-peach", label: "Clay", stroke: "#e0b090", swatch: "", hex: "#e0b090" },
  { id: "hl-wisteria", label: "Wisteria", stroke: "#b5a4cc", swatch: "", hex: "#b5a4cc" },
];

export const PEN_WIDTHS = [1.5, 2.5, 4] as const;
export const HIGHLIGHTER_WIDTHS = [12, 18, 24] as const;
export const DEFAULT_HIGHLIGHT_COLOR = "hl-yellow";
export const HIGHLIGHTER_OPACITY = 0.35;

export const SHAPE_KINDS: { id: FreeformShapeKind; label: string }[] = [
  { id: "rect", label: "Rectangle" },
  { id: "roundrect", label: "Rounded" },
  { id: "ellipse", label: "Ellipse" },
  { id: "diamond", label: "Diamond" },
  { id: "triangle", label: "Triangle" },
  { id: "hexagon", label: "Hexagon" },
  { id: "star", label: "Star" },
  { id: "arrow", label: "Arrow" },
];

export type ShapeOutline =
  | { tag: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { tag: "rect"; x: number; y: number; w: number; h: number; rx: number }
  | { tag: "poly"; points: { x: number; y: number }[] };

/** Local-space outline (origin 0,0) inset by stroke, matching Apple Freeform shape set. */
export function shapeOutline(
  kind: FreeformShapeKind,
  w: number,
  h: number,
  strokeWidth: number,
): ShapeOutline {
  const pad = strokeWidth / 2;
  const iw = Math.max(0, w - strokeWidth);
  const ih = Math.max(0, h - strokeWidth);
  const cx = w / 2;
  const cy = h / 2;

  if (kind === "ellipse") {
    return {
      tag: "ellipse",
      cx,
      cy,
      rx: Math.max(0, w / 2 - pad),
      ry: Math.max(0, h / 2 - pad),
    };
  }
  if (kind === "roundrect") {
    return { tag: "rect", x: pad, y: pad, w: iw, h: ih, rx: Math.min(iw, ih) * 0.22 };
  }
  if (kind === "diamond") {
    return {
      tag: "poly",
      points: [
        { x: cx, y: pad },
        { x: w - pad, y: cy },
        { x: cx, y: h - pad },
        { x: pad, y: cy },
      ],
    };
  }
  if (kind === "triangle") {
    return {
      tag: "poly",
      points: [
        { x: cx, y: pad },
        { x: w - pad, y: h - pad },
        { x: pad, y: h - pad },
      ],
    };
  }
  if (kind === "hexagon") {
    const rx = Math.max(0, w / 2 - pad);
    const ry = Math.max(0, h / 2 - pad);
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    });
    return { tag: "poly", points: pts };
  }
  if (kind === "star") {
    const rx = Math.max(0, w / 2 - pad);
    const ry = Math.max(0, h / 2 - pad);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 180) * (i * 36 - 90);
      const r = i % 2 === 0 ? 1 : 0.4;
      pts.push({ x: cx + rx * r * Math.cos(a), y: cy + ry * r * Math.sin(a) });
    }
    return { tag: "poly", points: pts };
  }
  if (kind === "arrow") {
    const x0 = pad;
    const x1 = w - pad;
    const y0 = pad;
    const y1 = h - pad;
    const mid = cy;
    const shaftT = y0 + ih * 0.28;
    const shaftB = y1 - ih * 0.28;
    const head = x0 + iw * 0.55;
    return {
      tag: "poly",
      points: [
        { x: x0, y: shaftT },
        { x: head, y: shaftT },
        { x: head, y: y0 },
        { x: x1, y: mid },
        { x: head, y: y1 },
        { x: head, y: shaftB },
        { x: x0, y: shaftB },
      ],
    };
  }
  return { tag: "rect", x: pad, y: pad, w: iw, h: ih, rx: 0 };
}

export function polyToPointsAttr(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Fill presets for shapes — none plus the pigment box. */
export const SHAPE_FILLS: { id: string; label: string; swatch: string; hex: string }[] = [
  { id: "none", label: "None", swatch: "", hex: "transparent" },
  ...PIGMENTS.filter((p) => p.id !== "mute" && p.id !== "sepia" && p.id !== "slate").map((p) => ({
    id: p.id,
    label: p.label,
    swatch: "",
    hex: p.hex,
  })),
];

export const STROKE_DASHES: { id: FreeformStrokeDash; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
];

export const SHAPE_STROKE_WIDTHS = [1, 2, 3, 4, 6] as const;

/** @deprecated stickies use `stickyBgHex` as an inline background. */
export function stickyClass(_color: FreeformStickyColor) {
  return "";
}

export function stickyBgHex(color: FreeformStickyColor) {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return STICKY_COLORS.find((c) => c.id === color)?.hex ?? pigmentHex(color, "#e4cc8a");
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

/** Paper hex used when a shape has no fill (transparent). */
const BOARD_PAPER_HEX = "#f3efe4";

export function fillIsLight(hex: string) {
  return hexLuminance(hex) > 0.55;
}

export function stickyIsLight(color: FreeformStickyColor) {
  return fillIsLight(stickyBgHex(color));
}

/** Default text token for a filled surface — ink on light, paper on dark. */
export function contrastTextToken(fillHex: string): string {
  return fillIsLight(fillHex) ? "ink" : "#f5f2eb";
}

/** Default text token for a sticky paper — dark on light, light on dark. */
export function stickyContrastTextColor(color: FreeformStickyColor): string {
  return contrastTextToken(stickyBgHex(color));
}

/**
 * Hex used for luminance of a shape fill. Transparent / none contrast against board paper.
 */
export function shapeFillHex(fill?: string): string {
  if (!fill || isNonePaint(fill)) return BOARD_PAPER_HEX;
  if (/^#[0-9a-fA-F]{6}$/.test(fill)) return fill;
  const preset = SHAPE_FILLS.find((c) => c.id === fill);
  if (preset && preset.hex && preset.hex !== "transparent") return preset.hex;
  return pigmentHex(fill, BOARD_PAPER_HEX);
}

/**
 * Resolve text paint against a fill hex.
 * Named ink/mute/sepia/slate map to dark or light variants from fill luminance.
 * Custom `#rrggbb` is a manual override (not remapped).
 * Omit `textColor` (or leave the default `ink`) to auto-contrast.
 */
export function resolveContrastTextColor(
  textColor: string | undefined,
  fillHex: string,
): { color: string } {
  const light = fillIsLight(fillHex);
  const id = textColor || contrastTextToken(fillHex);
  if (/^#[0-9a-fA-F]{6}$/.test(id)) {
    return { color: id };
  }
  const darkNamed: Record<string, string> = {
    ink: "#151716",
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
  if (id in darkNamed) {
    return { color: (light ? darkNamed : lightNamed)[id]! };
  }
  const p = pigmentById(id);
  if (p) return { color: p.hex };
  return { color: light ? "#151716" : "#f5f2eb" };
}

/**
 * Resolve sticky text paint. Theme tokens (`text-ink`) flip light in dark mode;
 * stickies stay cream paper, so named colors map to fixed dark (or light) hexes.
 */
export function resolveStickyTextColor(
  textColor: string | undefined,
  stickyColor: FreeformStickyColor,
): { color: string } {
  return resolveContrastTextColor(textColor, stickyBgHex(stickyColor));
}

/** Shape label color from fill luminance; recalc whenever `fill` changes. */
export function resolveShapeTextColor(
  textColor: string | undefined,
  fill?: string,
): { color: string } {
  return resolveContrastTextColor(textColor, shapeFillHex(fill));
}

export function textColorClass(color?: string) {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
  return TEXT_COLORS.find((c) => c.id === color)?.className ?? "text-ink";
}

export function textColorHex(color?: string): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return TEXT_COLORS.find((c) => c.id === color)?.hex ?? pigmentHex(color, "#151716");
}

export function boardFontClass(font?: PageFont, fallback: PageFont = "serif") {
  const id = font ?? fallback;
  return BOARD_FONTS.find((f) => f.id === id)?.className ?? (fallback === "sans" ? "font-sans" : "font-serif");
}

export function boardEmphasisClass(opts: {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}) {
  return cn(opts.bold && "font-bold", opts.italic && "italic", opts.strike && "line-through");
}

export function defaultTextAlign(type: "text" | "sticky" | "mind" | "shape"): TextAlign {
  return type === "mind" || type === "shape" ? "center" : "left";
}

export function defaultTextVAlign(type: "text" | "sticky" | "mind" | "shape"): TextVAlign {
  return type === "mind" || type === "shape" ? "middle" : "top";
}

export function textAlignClass(align?: TextAlign, type?: "text" | "sticky" | "mind" | "shape") {
  const a = align ?? (type ? defaultTextAlign(type) : "left");
  if (a === "center") return "text-center";
  if (a === "right") return "text-right";
  return "text-left";
}

export function textVAlignClass(valign?: TextVAlign, type?: "text" | "sticky" | "mind" | "shape") {
  const v = valign ?? (type ? defaultTextVAlign(type) : "top");
  if (v === "middle") return "justify-center";
  if (v === "bottom") return "justify-end";
  return "justify-start";
}

export function isNonePaint(id?: string) {
  return id === "none" || id === "transparent";
}

export function inkStrokeValue(id?: string) {
  if (isNonePaint(id)) return "none";
  if (!id || id === "currentColor") return "var(--color-ink)";
  const known =
    INK_COLORS.find((c) => c.id === id) ?? HIGHLIGHT_COLORS.find((c) => c.id === id);
  if (known) return known.stroke;
  const p = pigmentById(id);
  if (p) return p.css ?? p.hex;
  return id;
}

/** Hex for `<input type="color">` — named swatches or raw #rrggbb. */
export function strokePickerHex(id?: string): string {
  if (!id) return "#151716";
  const known =
    INK_COLORS.find((c) => c.id === id) ?? HIGHLIGHT_COLORS.find((c) => c.id === id);
  if (known) return known.hex;
  return pigmentHex(id, "#151716");
}

export function fillValue(fill?: string) {
  if (!fill || isNonePaint(fill)) return "transparent";
  if (/^#[0-9a-fA-F]{6}$/.test(fill)) return fill;
  const sticky = STICKY_COLORS.find((c) => c.id === fill);
  if (sticky) return sticky.hex;
  const p = pigmentById(fill);
  if (p) return p.css ?? p.hex;
  return inkStrokeValue(fill);
}

export function fillPickerHex(fill?: string): string {
  if (!fill || fill === "none") return "#f3efe4";
  const preset = SHAPE_FILLS.find((c) => c.id === fill);
  if (preset && preset.id !== "none" && preset.hex !== "transparent") return preset.hex;
  return pigmentHex(fill, "#f3efe4");
}

export function strokeDashArray(dash?: FreeformStrokeDash): string | undefined {
  if (dash === "dashed") return "8 4";
  if (dash === "dotted") return "2 3";
  return undefined;
}

export type ShapeStyle = {
  shape?: FreeformShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: FreeformStrokeDash;
};

/** World-space defaults. Zoom is camera-only — never multiply these by zoom. */
export const DROP = {
  text: { w: 240, h: 56, fontSize: 16 },
  sticky: { w: 180, h: 160, fontSize: 14 },
  shape: { w: 160, h: 100, fontSize: 14 },
  image: { w: 280, h: 200 },
  link: { w: 240, h: 72 },
  table: { w: 280, h: 160 },
  mind: { w: 180, h: 64, fontSize: 14 },
  mention: { w: 240, h: 56 },
} as const;

export function createShape(
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  style: ShapeStyle = {},
): FreeformObject {
  return {
    id: nid(),
    type: "shape",
    x,
    y,
    w,
    h,
    z,
    shape: style.shape ?? "rect",
    fill: style.fill ?? "paper",
    stroke: style.stroke ?? "ink",
    strokeWidth: style.strokeWidth ?? 2,
    strokeDash: style.strokeDash ?? "solid",
    text: "",
    showLabel: true,
    fontSize: DROP.shape.fontSize,
    fontFamily: "sans",
    align: "center",
    valign: "middle",
  };
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
    w: DROP.text.w,
    h: DROP.text.h,
    z,
    text: "",
    fontSize: DROP.text.fontSize,
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
    w: DROP.sticky.w,
    h: DROP.sticky.h,
    z,
    text: "",
    color,
    fontSize: DROP.sticky.fontSize,
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
  return { id: nid(), type: "image", x, y, w: DROP.image.w, h: DROP.image.h, z, src, alt };
}

export function createLink(x: number, y: number, z: number, url = "https://"): FreeformObject {
  let title = "Link";
  try {
    title = new URL(url).hostname || "Link";
  } catch {
    /* keep default */
  }
  return { id: nid(), type: "link", x, y, w: DROP.link.w, h: DROP.link.h, z, url, title };
}

export function createTable(x: number, y: number, z: number): FreeformObject {
  return {
    id: nid(),
    type: "table",
    x,
    y,
    w: DROP.table.w,
    h: DROP.table.h,
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
    w: DROP.mind.w,
    h: DROP.mind.h,
    z,
    text: parentId ? "Child" : "Idea",
    parentId,
    fontSize: DROP.mind.fontSize,
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
  return { id: nid(), type: "mention", x, y, w: DROP.mention.w, h: DROP.mention.h, z, noteId, title, kind };
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
