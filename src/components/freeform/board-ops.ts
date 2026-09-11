import { nid } from "@/lib/ids";
import type { FreeformPatch } from "@/lib/freeform-patch";
import type { FreeformConnection, FreeformObject } from "@/types";

export const GRID = 8;
export const SNAP_THRESHOLD = 4;
export const MIN_W = 48;
export const MIN_H = 28;
export const PASTE_OFFSET = 24;

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

export type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Guide = { axis: "x" | "y"; pos: number };

export function snapToGrid(n: number, grid = GRID) {
  return Math.round(n / grid) * grid;
}

export function objectBox(o: Box): Box & { l: number; t: number; r: number; b: number; cx: number; cy: number } {
  return {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    l: o.x,
    t: o.y,
    r: o.x + o.w,
    b: o.y + o.h,
    cx: o.x + o.w / 2,
    cy: o.y + o.h / 2,
  };
}

export function boxesIntersect(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInBox(x: number, y: number, box: Box) {
  return x >= box.x && y >= box.y && x <= box.x + box.w && y <= box.y + box.h;
}

/** Topmost object whose bounds contain the world point (shape/mind bodies included). */
export function hitBoardObjectAt(objects: FreeformObject[], x: number, y: number): FreeformObject | null {
  let best: FreeformObject | null = null;
  for (const o of objects) {
    if (!pointInBox(x, y, o)) continue;
    if (!best || o.z >= best.z) best = o;
  }
  return best;
}

export function unionBoxes(objects: Box[]): Box | null {
  if (!objects.length) return null;
  let l = objects[0].x;
  let t = objects[0].y;
  let r = objects[0].x + objects[0].w;
  let b = objects[0].y + objects[0].h;
  for (const o of objects) {
    l = Math.min(l, o.x);
    t = Math.min(t, o.y);
    r = Math.max(r, o.x + o.w);
    b = Math.max(b, o.y + o.h);
  }
  return { x: l, y: t, w: Math.max(1, r - l), h: Math.max(1, b - t) };
}

export function marqueeBox(x0: number, y0: number, x1: number, y1: number): Box {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/** Drag-to-draw a shape. Shift locks square; Option/Alt expands from the click origin. */
export function shapeDraftBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opts: { shift?: boolean; fromCenter?: boolean } = {},
): Box {
  let dx = x1 - x0;
  let dy = y1 - y0;
  if (opts.shift) {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * s;
    dy = Math.sign(dy || 1) * s;
  }
  if (opts.fromCenter) {
    return { x: x0 - Math.abs(dx), y: y0 - Math.abs(dy), w: Math.abs(dx) * 2, h: Math.abs(dy) * 2 };
  }
  return marqueeBox(x0, y0, x0 + dx, y0 + dy);
}

/** Swap selected objects one z-step toward the front (1) or back (-1). */
export function nudgeZ(objects: FreeformObject[], ids: string[], dir: 1 | -1): FreeformObject[] {
  const idSet = new Set(ids);
  const order = [...objects].sort((a, b) => a.z - b.z).map((o) => o.id);
  if (dir === 1) {
    for (let i = order.length - 2; i >= 0; i--) {
      if (idSet.has(order[i]) && !idSet.has(order[i + 1])) {
        const tmp = order[i];
        order[i] = order[i + 1];
        order[i + 1] = tmp;
      }
    }
  } else {
    for (let i = 1; i < order.length; i++) {
      if (idSet.has(order[i]) && !idSet.has(order[i - 1])) {
        const tmp = order[i];
        order[i] = order[i - 1];
        order[i - 1] = tmp;
      }
    }
  }
  const zOf = new Map(order.map((id, i) => [id, i]));
  return objects.map((o) => {
    const z = zOf.get(o.id);
    return z === undefined || z === o.z ? o : { ...o, z };
  });
}

function clampSize(w: number, h: number) {
  return { w: Math.max(MIN_W, w), h: Math.max(MIN_H, h) };
}

/** Resize a box from a handle by world delta. Shift locks aspect to origin ratio. */
export function resizeBox(
  origin: Box,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  aspectLock: boolean,
): Box {
  let { x, y, w, h } = origin;
  const ratio = origin.w / Math.max(1, origin.h);
  const east = handle.includes("e");
  const west = handle.includes("w");
  const south = handle.includes("s");
  const north = handle.includes("n");

  if (east) w = origin.w + dx;
  if (west) {
    w = origin.w - dx;
    x = origin.x + dx;
  }
  if (south) h = origin.h + dy;
  if (north) {
    h = origin.h - dy;
    y = origin.y + dy;
  }

  if (aspectLock) {
    if (east || west) {
      const nextH = w / ratio;
      if (north) y = origin.y + origin.h - nextH;
      else if (!south && !north) y = origin.y + (origin.h - nextH) / 2;
      h = nextH;
    } else if (north || south) {
      const nextW = h * ratio;
      if (west) x = origin.x + origin.w - nextW;
      else if (!east) x = origin.x + (origin.w - nextW) / 2;
      w = nextW;
    }
  }

  const size = clampSize(w, h);
  if (west) x = origin.x + origin.w - size.w;
  if (north) y = origin.y + origin.h - size.h;
  if (!west && size.w !== w) {
    /* east clamp — x stays */
  }
  if (!north && size.h !== h) {
    /* south clamp — y stays */
  }
  return { x, y, w: size.w, h: size.h };
}

export function snapBox(box: Box, grid = GRID): Box {
  const x = snapToGrid(box.x, grid);
  const y = snapToGrid(box.y, grid);
  return { x, y, w: Math.max(MIN_W, snapToGrid(box.w, grid)), h: Math.max(MIN_H, snapToGrid(box.h, grid)) };
}

export function scalePathPoints(
  obj: Extract<FreeformObject, { type: "path" }>,
  next: Box,
): { x: number; y: number }[] {
  const sx = obj.w ? next.w / obj.w : 1;
  const sy = obj.h ? next.h / obj.h : 1;
  return obj.points.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}

export function applyResizeToObject(
  obj: FreeformObject,
  box: Box,
): FreeformPatch {
  if (obj.type === "path") {
    return {
      ...box,
      points: scalePathPoints(obj, box),
    };
  }
  return box;
}

export { mergeObjectPatch } from "@/lib/freeform-patch";

/**
 * Snap a moving group: alignment to other objects wins, then optional grid.
 * `dx/dy` are raw deltas from origins.
 */
export function snapGroupMove(
  moving: { id: string; origin: Box }[],
  others: Box[],
  dx: number,
  dy: number,
  grid?: number,
): { dx: number; dy: number; guides: Guide[] } {
  const proposed = moving.map((m) => ({
    ...m.origin,
    x: m.origin.x + dx,
    y: m.origin.y + dy,
  }));
  const guides: Guide[] = [];
  let adjX = 0;
  let adjY = 0;
  let bestX = SNAP_THRESHOLD + 1;
  let bestY = SNAP_THRESHOLD + 1;

  const movingEdgesX: number[] = [];
  const movingEdgesY: number[] = [];
  for (const p of proposed) {
    const b = objectBox(p);
    movingEdgesX.push(b.l, b.cx, b.r);
    movingEdgesY.push(b.t, b.cy, b.b);
  }

  for (const o of others) {
    const b = objectBox(o);
    for (const edge of movingEdgesX) {
      for (const target of [b.l, b.cx, b.r]) {
        const d = target - edge;
        if (Math.abs(d) < bestX) {
          bestX = Math.abs(d);
          adjX = d;
        }
      }
    }
    for (const edge of movingEdgesY) {
      for (const target of [b.t, b.cy, b.b]) {
        const d = target - edge;
        if (Math.abs(d) < bestY) {
          bestY = Math.abs(d);
          adjY = d;
        }
      }
    }
  }

  let outDx = dx;
  let outDy = dy;
  if (bestX <= SNAP_THRESHOLD) {
    outDx += adjX;
    const sample = objectBox({ ...proposed[0], x: proposed[0].x + adjX });
    for (const o of others) {
      const b = objectBox(o);
      for (const t of [b.l, b.cx, b.r]) {
        if (Math.abs(sample.l - t) < 0.6 || Math.abs(sample.cx - t) < 0.6 || Math.abs(sample.r - t) < 0.6) {
          guides.push({ axis: "x", pos: t });
        }
      }
    }
  } else if (grid) {
    const snapped = snapToGrid(proposed[0].x, grid);
    outDx += snapped - proposed[0].x;
  }

  if (bestY <= SNAP_THRESHOLD) {
    outDy += adjY;
    const sample = objectBox({ ...proposed[0], y: proposed[0].y + adjY });
    for (const o of others) {
      const b = objectBox(o);
      for (const t of [b.t, b.cy, b.b]) {
        if (Math.abs(sample.t - t) < 0.6 || Math.abs(sample.cy - t) < 0.6 || Math.abs(sample.b - t) < 0.6) {
          guides.push({ axis: "y", pos: t });
        }
      }
    }
  } else if (grid) {
    const snapped = snapToGrid(proposed[0].y, grid);
    outDy += snapped - proposed[0].y;
  }

  const uniq: Guide[] = [];
  for (const g of guides) {
    if (!uniq.some((u) => u.axis === g.axis && Math.abs(u.pos - g.pos) < 0.5)) uniq.push(g);
  }
  return { dx: outDx, dy: outDy, guides: uniq };
}

export function snapResizeBox(box: Box, others: Box[], grid?: number): { box: Box; guides: Guide[] } {
  let next = { ...box };
  if (grid) next = snapBox(next, grid);
  const b = objectBox(next);
  const guides: Guide[] = [];
  for (const o of others) {
    const ob = objectBox(o);
    for (const [edge, target] of [
      [b.l, ob.l],
      [b.r, ob.r],
      [b.cx, ob.cx],
      [b.t, ob.t],
      [b.b, ob.b],
      [b.cy, ob.cy],
    ] as const) {
      if (Math.abs(edge - target) <= SNAP_THRESHOLD) {
        const axis: "x" | "y" = edge === b.l || edge === b.r || edge === b.cx ? "x" : "y";
        if (axis === "x") {
          if (Math.abs(b.l - target) <= SNAP_THRESHOLD) next.x = target;
          else if (Math.abs(b.r - target) <= SNAP_THRESHOLD) next.x = target - next.w;
          else next.x = target - next.w / 2;
        } else {
          if (Math.abs(b.t - target) <= SNAP_THRESHOLD) next.y = target;
          else if (Math.abs(b.b - target) <= SNAP_THRESHOLD) next.y = target - next.h;
          else next.y = target - next.h / 2;
        }
        guides.push({ axis, pos: target });
      }
    }
  }
  return { box: next, guides };
}

export function alignObjects(objects: FreeformObject[], ids: string[], edge: AlignEdge): FreeformObject[] {
  const selected = objects.filter((o) => ids.includes(o.id));
  if (selected.length < 2) return objects;
  const union = unionBoxes(selected);
  if (!union) return objects;
  const u = objectBox(union);
  return objects.map((o) => {
    if (!ids.includes(o.id)) return o;
    let x = o.x;
    let y = o.y;
    if (edge === "left") x = u.l;
    if (edge === "right") x = u.r - o.w;
    if (edge === "center") x = u.cx - o.w / 2;
    if (edge === "top") y = u.t;
    if (edge === "bottom") y = u.b - o.h;
    if (edge === "middle") y = u.cy - o.h / 2;
    return { ...o, x, y };
  });
}

export function cloneSelection(
  objects: FreeformObject[],
  connections: FreeformConnection[],
  ids: string[],
  offset = PASTE_OFFSET,
): { objects: FreeformObject[]; connections: FreeformConnection[] } {
  const set = new Set(ids);
  const idMap = new Map<string, string>();
  let z = objects.reduce((m, o) => Math.max(m, o.z), 0) + 1;
  const cloned: FreeformObject[] = [];
  for (const o of objects) {
    if (!set.has(o.id)) continue;
    const nextId = nid();
    idMap.set(o.id, nextId);
    cloned.push({
      ...structuredClone(o),
      id: nextId,
      x: o.x + offset,
      y: o.y + offset,
      z: z++,
    });
  }
  for (const o of cloned) {
    if (o.type === "mind" && o.parentId && idMap.has(o.parentId)) {
      o.parentId = idMap.get(o.parentId);
    }
  }
  const nextConnections: FreeformConnection[] = [];
  for (const c of connections) {
    const from = idMap.get(c.from);
    const to = idMap.get(c.to);
    if (from && to) nextConnections.push({ id: nid(), from, to });
  }
  return { objects: cloned, connections: nextConnections };
}

export const RESIZE_HANDLES: { handle: ResizeHandle; className: string; hx: string; hy: string }[] = [
  { handle: "nw", className: "left-0 top-0 cursor-nwse-resize", hx: "-50%", hy: "-50%" },
  { handle: "n", className: "left-1/2 top-0 cursor-ns-resize", hx: "-50%", hy: "-50%" },
  { handle: "ne", className: "right-0 top-0 cursor-nesw-resize", hx: "50%", hy: "-50%" },
  { handle: "e", className: "right-0 top-1/2 cursor-ew-resize", hx: "50%", hy: "-50%" },
  { handle: "se", className: "right-0 bottom-0 cursor-nwse-resize", hx: "50%", hy: "50%" },
  { handle: "s", className: "left-1/2 bottom-0 cursor-ns-resize", hx: "-50%", hy: "50%" },
  { handle: "sw", className: "left-0 bottom-0 cursor-nesw-resize", hx: "-50%", hy: "50%" },
  { handle: "w", className: "left-0 top-1/2 cursor-ew-resize", hx: "-50%", hy: "-50%" },
];
