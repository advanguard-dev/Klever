import { nextZ } from "@/components/freeform/board-model";
import {
  alignObjects,
  cloneSelection,
  nudgeZ,
  PASTE_OFFSET,
  type AlignEdge,
} from "@/components/freeform/board-ops";
import type { FreeformConnection, FreeformObject } from "@/types";

export type BoardClipboard = {
  objects: FreeformObject[];
  connections: FreeformConnection[];
};

export type ConnectorLink = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: string;
};

export function selectedOfType<T extends FreeformObject["type"]>(
  objects: FreeformObject[],
  selected: string[],
  type: T,
): Extract<FreeformObject, { type: T }> | null {
  if (selected.length !== 1) return null;
  const o = objects.find((x) => x.id === selected[0]);
  return o?.type === type ? (o as Extract<FreeformObject, { type: T }>) : null;
}

export function buildConnectorLinks(
  objects: FreeformObject[],
  connections: FreeformConnection[] | undefined,
): ConnectorLink[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const links: ConnectorLink[] = [];
  const seen = new Set<string>();

  for (const o of objects) {
    if (o.type !== "mind" || !o.parentId) continue;
    const p = byId.get(o.parentId);
    if (!p) continue;
    const key = `mind:${p.id}-${o.id}`;
    seen.add(`${p.id}::${o.id}`);
    links.push({
      key,
      x1: p.x + p.w / 2,
      y1: p.y + p.h,
      x2: o.x + o.w / 2,
      y2: o.y,
    });
  }

  for (const c of connections ?? []) {
    const a = byId.get(c.from);
    const b = byId.get(c.to);
    if (!a || !b) continue;
    const pair = `${c.from}::${c.to}`;
    const rev = `${c.to}::${c.from}`;
    if (seen.has(pair) || seen.has(rev)) continue;
    seen.add(pair);
    links.push({
      key: c.id,
      x1: a.x + a.w / 2,
      y1: a.y + a.h / 2,
      x2: b.x + b.w / 2,
      y2: b.y + b.h / 2,
    });
  }
  return links;
}

export function snapshotSelection(
  objects: FreeformObject[],
  connections: FreeformConnection[],
  ids: string[],
): BoardClipboard | null {
  if (!ids.length) return null;
  const idSet = new Set(ids);
  return {
    objects: objects.filter((o) => idSet.has(o.id)).map((o) => structuredClone(o)),
    connections: connections.filter((c) => idSet.has(c.from) && idSet.has(c.to)),
  };
}

export function pasteFromClipboard(
  clip: BoardClipboard,
  objects: FreeformObject[],
  connections: FreeformConnection[],
  pasteN: number,
): { objects: FreeformObject[]; connections: FreeformConnection[]; ids: string[] } | null {
  if (!clip.objects.length) return null;
  const offset = PASTE_OFFSET * pasteN;
  const cloned = cloneSelection(
    clip.objects,
    clip.connections,
    clip.objects.map((o) => o.id),
    offset,
  );
  let z = nextZ(objects);
  const nextObjects = cloned.objects.map((o) => ({ ...o, z: z++ }));
  return {
    objects: [...objects, ...nextObjects],
    connections: [...connections, ...cloned.connections],
    ids: nextObjects.map((o) => o.id),
  };
}

export function alignSelected(
  objects: FreeformObject[],
  ids: string[],
  edge: AlignEdge,
): FreeformObject[] | null {
  if (ids.length < 2) return null;
  return alignObjects(objects, ids, edge);
}

export function bringIdsFront(objects: FreeformObject[], ids: string[]): FreeformObject[] | null {
  if (!ids.length) return null;
  let z = nextZ(objects);
  return objects.map((o) => (ids.includes(o.id) ? { ...o, z: z++ } : o));
}

export function sendIdsBack(objects: FreeformObject[], ids: string[]): FreeformObject[] | null {
  if (!ids.length) return null;
  const min = objects.reduce((m, o) => Math.min(m, o.z), 0);
  let z = min - ids.length;
  return objects.map((o) => (ids.includes(o.id) ? { ...o, z: z++ } : o));
}

export function nudgeIdsZ(
  objects: FreeformObject[],
  ids: string[],
  dir: 1 | -1,
): FreeformObject[] | null {
  if (!ids.length) return null;
  return nudgeZ(objects, ids, dir);
}
