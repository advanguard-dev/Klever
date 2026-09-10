import {
  defaultTextAlign,
  defaultTextVAlign,
  fillValue,
  inkStrokeValue,
  isNonePaint,
  resolveShapeTextColor,
  resolveStickyTextColor,
  shapeOutline,
  stickyBgHex,
  STICKY_COLORS,
  textColorHex,
} from "@/components/freeform/board-model";
import { unionBoxes } from "@/components/freeform/board-ops";
import { resolveAssetSrc } from "@/lib/assets";
import type { BlobRecord, FreeformBoard, FreeformObject, FreeformShapeKind, FreeformStrokeDash, PageFont, TextAlign, TextVAlign } from "@/types";

function cssToken(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportBoardJson(board: FreeformBoard) {
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
  downloadBlob(`klever-board-${board.updated.slice(0, 10)}.json`, blob);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function fontFor(family: PageFont | undefined, size: number, bold?: boolean, italic?: boolean) {
  const stack =
    family === "sans"
      ? '"Geist Variable", sans-serif'
      : family === "mono"
        ? '"Fira Code", monospace'
        : '"Instrument Serif", serif';
  const weight = bold ? "700" : "400";
  const style = italic ? "italic" : "normal";
  return `${style} ${weight} ${size}px ${stack}`;
}

function alignedTextOrigin(
  x: number,
  y: number,
  w: number,
  h: number,
  padX: number,
  padY: number,
  align: TextAlign,
  valign: TextVAlign,
  lineCount: number,
  lineHeight: number,
) {
  const blockH = Math.max(lineHeight, lineCount * lineHeight);
  let ty = y + padY;
  if (valign === "middle") ty = y + (h - blockH) / 2;
  if (valign === "bottom") ty = y + h - padY - blockH;
  let tx = x + padX;
  let textAlign: CanvasTextAlign = "left";
  if (align === "center") {
    tx = x + w / 2;
    textAlign = "center";
  } else if (align === "right") {
    tx = x + w - padX;
    textAlign = "right";
  }
  return { tx, ty, textAlign };
}

function canvasDash(dash?: FreeformStrokeDash): number[] {
  if (dash === "dashed") return [8, 4];
  if (dash === "dotted") return [2, 3];
  return [];
}

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: FreeformShapeKind,
  strokeWidth: number,
) {
  const geom = shapeOutline(kind, w, h, strokeWidth);
  ctx.beginPath();
  if (geom.tag === "ellipse") {
    ctx.ellipse(x + geom.cx, y + geom.cy, geom.rx, geom.ry, 0, 0, Math.PI * 2);
    return;
  }
  if (geom.tag === "rect") {
    if (geom.rx > 0 && typeof ctx.roundRect === "function") {
      ctx.roundRect(x + geom.x, y + geom.y, geom.w, geom.h, geom.rx);
    } else {
      ctx.rect(x + geom.x, y + geom.y, geom.w, geom.h);
    }
    return;
  }
  geom.points.forEach((p, i) => {
    const px = x + p.x;
    const py = y + p.y;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function strokeColor(id: string, ink: string) {
  const raw = inkStrokeValue(id);
  if (raw.startsWith("var(")) return ink;
  return raw;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function exportBoardPng(
  board: FreeformBoard,
  blobs: Record<string, BlobRecord>,
) {
  const pad = 48;
  const union = unionBoxes(board.objects) ?? { x: 0, y: 0, w: 640, h: 400 };
  const width = Math.ceil(union.w + pad * 2);
  const height = Math.ceil(union.h + pad * 2);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  const paper = cssToken("--color-paper", "#f3f1eb");
  const ink = cssToken("--color-ink", "#1b1a16");
  const mute = cssToken("--color-mute", "#5f5a52");
  const line = cssToken("--color-line", "#ddd8ce");

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  const ox = pad - union.x;
  const oy = pad - union.y;

  if (board.dotted) {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.14;
    for (let x = (ox % 22) - 22; x < width + 22; x += 22) {
      for (let y = (oy % 22) - 22; y < height + 22; y += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  const byId = new Map(board.objects.map((o) => [o.id, o]));
  ctx.strokeStyle = mute;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.45;
  const drawn = new Set<string>();
  const drawLink = (a: FreeformObject, b: FreeformObject) => {
    ctx.beginPath();
    ctx.moveTo(a.x + a.w / 2 + ox, a.y + a.h / 2 + oy);
    ctx.lineTo(b.x + b.w / 2 + ox, b.y + b.h / 2 + oy);
    ctx.stroke();
  };
  for (const o of board.objects) {
    if (o.type === "mind" && o.parentId) {
      const p = byId.get(o.parentId);
      if (p) {
        drawn.add(`${p.id}::${o.id}`);
        ctx.beginPath();
        ctx.moveTo(p.x + p.w / 2 + ox, p.y + p.h + oy);
        ctx.lineTo(o.x + o.w / 2 + ox, o.y + oy);
        ctx.stroke();
      }
    }
  }
  for (const c of board.connections ?? []) {
    const a = byId.get(c.from);
    const b = byId.get(c.to);
    if (!a || !b) continue;
    if (drawn.has(`${c.from}::${c.to}`) || drawn.has(`${c.to}::${c.from}`)) continue;
    drawLink(a, b);
  }
  ctx.globalAlpha = 1;

  const sorted = [...board.objects].sort((a, b) => a.z - b.z);
  for (const obj of sorted) {
    await paintObject(ctx, obj, ox, oy, { paper, ink, line, blobs });
  }

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(`klever-board-${board.updated.slice(0, 10)}.png`, blob);
      resolve();
    }, "image/png");
  });
}

async function paintObject(
  ctx: CanvasRenderingContext2D,
  obj: FreeformObject,
  ox: number,
  oy: number,
  colors: {
    paper: string;
    ink: string;
    line: string;
    blobs: Record<string, BlobRecord>;
  },
) {
  const x = obj.x + ox;
  const y = obj.y + oy;
  const { w, h } = obj;
  const { paper, ink, line, blobs } = colors;

  const roundRect = (rx: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rx);
  };

  if (obj.type === "path") {
    if (obj.points.length < 2) return;
    ctx.beginPath();
    obj.points.forEach((p, i) => {
      const px = x + p.x;
      const py = y + p.y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = strokeColor(obj.stroke, ink);
    ctx.lineWidth = obj.strokeWidth;
    ctx.globalAlpha = obj.opacity ?? 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  if (obj.type === "shape") {
    const noneStroke = isNonePaint(obj.stroke);
    const sw = noneStroke ? 0 : obj.strokeWidth;
    ctx.fillStyle = fillValue(obj.fill);
    ctx.strokeStyle = strokeColor(obj.stroke, ink);
    ctx.lineWidth = sw;
    ctx.setLineDash(noneStroke ? [] : canvasDash(obj.strokeDash));
    drawShapePath(ctx, x, y, w, h, obj.shape, sw);
    if (obj.fill && obj.fill !== "none") ctx.fill();
    if (!noneStroke) ctx.stroke();
    ctx.setLineDash([]);
    if (obj.showLabel !== false && obj.text) {
      ctx.fillStyle = resolveShapeTextColor(obj.color, obj.fill).color;
      ctx.font = fontFor(obj.fontFamily ?? "sans", obj.fontSize ?? 14, obj.bold, obj.italic);
      ctx.textBaseline = "top";
      const fs = obj.fontSize ?? 14;
      const lh = fs * 1.45;
      const lines = wrapText(ctx, obj.text, w - 16);
      const origin = alignedTextOrigin(
        x,
        y,
        w,
        h,
        8,
        8,
        obj.align ?? defaultTextAlign("shape"),
        obj.valign ?? defaultTextVAlign("shape"),
        Math.min(lines.length, 12),
        lh,
      );
      ctx.textAlign = origin.textAlign;
      lines.slice(0, 12).forEach((ln, i) => {
        const ly = origin.ty + i * lh;
        ctx.fillText(ln, origin.tx, ly);
        if (obj.strike) {
          const tw = ctx.measureText(ln).width;
          let sx = origin.tx;
          if (origin.textAlign === "center") sx = origin.tx - tw / 2;
          if (origin.textAlign === "right") sx = origin.tx - tw;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, ly + fs * 0.55);
          ctx.lineTo(sx + tw, ly + fs * 0.55);
          ctx.stroke();
        }
      });
    }
    return;
  }

  if (obj.type === "sticky") {
    ctx.fillStyle = stickyBgHex(obj.color) || STICKY_COLORS[0].hex;
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    roundRect(4);
    ctx.fill();
    ctx.stroke();
    const paint = resolveStickyTextColor(obj.textColor, obj.color);
    ctx.fillStyle = paint.color;
    ctx.font = fontFor(obj.fontFamily, obj.fontSize ?? 14, obj.bold, obj.italic);
    ctx.textBaseline = "top";
    const fs = obj.fontSize ?? 14;
    const lh = fs * 1.4;
    const lines = wrapText(ctx, obj.text || "Sticky note", w - 24);
    const origin = alignedTextOrigin(
      x,
      y,
      w,
      h,
      12,
      12,
      obj.align ?? defaultTextAlign("sticky"),
      obj.valign ?? defaultTextVAlign("sticky"),
      Math.min(lines.length, 12),
      lh,
    );
    ctx.textAlign = origin.textAlign;
    lines.slice(0, 12).forEach((ln, i) => {
      const ly = origin.ty + i * lh;
      ctx.fillText(ln, origin.tx, ly);
      if (obj.strike) {
        const tw = ctx.measureText(ln).width;
        let sx = origin.tx;
        if (origin.textAlign === "center") sx = origin.tx - tw / 2;
        if (origin.textAlign === "right") sx = origin.tx - tw;
        ctx.strokeStyle = paint.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, ly + fs * 0.55);
        ctx.lineTo(sx + tw, ly + fs * 0.55);
        ctx.stroke();
      }
    });
    ctx.textAlign = "left";
    return;
  }

  if (obj.type === "image") {
    const src = resolveAssetSrc(obj.src, blobs);
    const img = await loadImage(src);
    roundRect(12);
    ctx.save();
    ctx.clip();
    if (img) ctx.drawImage(img, x, y, w, h);
    else {
      ctx.fillStyle = paper;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    roundRect(12);
    ctx.stroke();
    return;
  }

  if (obj.type === "table") {
    ctx.fillStyle = paper;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    roundRect(12);
    ctx.fill();
    ctx.stroke();
    const cols = Math.max(1, obj.cols);
    const rows = Math.max(1, obj.rows);
    const cw = w / cols;
    const rh = h / rows;
    ctx.font = '400 11px "Fira Code", monospace';
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    for (let r = 0; r < rows; r++) {
      if (obj.headerRow && r === 0) {
        ctx.fillStyle = cssToken("--color-paper-2", "#ebe8e0");
        ctx.fillRect(x, y + r * rh, w, rh);
        ctx.fillStyle = ink;
        ctx.font = '600 11px "Fira Code", monospace';
      } else {
        ctx.font = '400 11px "Fira Code", monospace';
      }
      for (let c = 0; c < cols; c++) {
        ctx.strokeStyle = line;
        ctx.strokeRect(x + c * cw, y + r * rh, cw, rh);
        const cell = obj.cells[r]?.[c] ?? "";
        ctx.fillText(cell.slice(0, 24), x + c * cw + 6, y + r * rh + rh / 2, cw - 10);
      }
    }
    return;
  }

  const isCard = obj.type === "link" || obj.type === "mention" || obj.type === "mind" || obj.type === "text";
  if (isCard && obj.type !== "text") {
    ctx.fillStyle = obj.type === "mention" ? cssToken("--color-paper-2", "#ebe8e0") : paper;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    roundRect(obj.type === "mind" ? 16 : 12);
    ctx.fill();
    ctx.stroke();
  }

  if (obj.type === "text" || obj.type === "mind" || obj.type === "link" || obj.type === "mention") {
    const size = obj.type === "text" || obj.type === "mind" ? (obj.fontSize ?? 16) : 14;
    const family = obj.type === "text" || obj.type === "mind" ? obj.fontFamily : "serif";
    const bold = obj.type === "text" || obj.type === "mind" ? obj.bold : false;
    const italic = obj.type === "text" || obj.type === "mind" ? obj.italic : false;
    const color =
      obj.type === "text" || obj.type === "mind"
        ? /^#/.test(obj.color ?? "")
          ? obj.color!
          : textColorHex(obj.color)
        : ink;
    ctx.fillStyle = color;
    ctx.font = fontFor(family, obj.type === "link" || obj.type === "mention" ? 14 : size, bold, italic);
    ctx.textBaseline = "top";
    const label =
      obj.type === "text"
        ? obj.text
        : obj.type === "mind"
          ? obj.text || "Idea"
          : obj.type === "link"
            ? obj.title || obj.url
            : `@${obj.title}`;
    const padX = obj.type === "text" ? 0 : 12;
    const padY = obj.type === "text" ? 0 : 10;
    const lh = (obj.type === "text" || obj.type === "mind" ? size : 14) * 1.45;
    const lines = wrapText(ctx, label, w - padX * 2);
    const align =
      obj.type === "text" || obj.type === "mind"
        ? (obj.align ?? defaultTextAlign(obj.type))
        : "left";
    const valign =
      obj.type === "text" || obj.type === "mind"
        ? (obj.valign ?? defaultTextVAlign(obj.type))
        : "top";
    const origin = alignedTextOrigin(
      x,
      y,
      w,
      h,
      padX,
      padY,
      align,
      valign,
      Math.min(lines.length, 10),
      lh,
    );
    ctx.textAlign = origin.textAlign;
    lines.slice(0, 10).forEach((ln, i) => {
      ctx.fillText(ln, origin.tx, origin.ty + i * lh);
    });
    ctx.textAlign = "left";
  }
}
