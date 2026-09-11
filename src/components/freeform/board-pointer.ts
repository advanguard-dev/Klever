import type { Box, ResizeHandle } from "@/components/freeform/board-ops";
import type { FreeformObject, FreeformTool } from "@/types";

export const PLACE_TOOLS = new Set<FreeformTool>([
  "text",
  "sticky",
  "link",
  "table",
  "mind",
  "mention",
  "image",
]);
export const INSERT_TOOLS = new Set<FreeformTool>([...PLACE_TOOLS]);

export type DragState =
  | { kind: "pan"; sx: number; sy: number; cx: number; cy: number }
  | {
      kind: "pinch";
      dist: number;
      mx: number;
      my: number;
      cam: { x: number; y: number; zoom: number };
    }
  | {
      kind: "move";
      ids: string[];
      sx: number;
      sy: number;
      origins: Record<string, { x: number; y: number }>;
    }
  | {
      kind: "resize";
      id: string;
      handle: ResizeHandle;
      sx: number;
      sy: number;
      origin: Box;
      source: FreeformObject;
    }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "draw"; points: { x: number; y: number }[] }
  | { kind: "shape"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "erase"; pushed: boolean }
  | null;

export function pinchOf(pointers: Map<number, { x: number; y: number }>) {
  const pts = [...pointers.values()];
  if (pts.length < 2) return null;
  const [a, b] = pts;
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
    mx: (a.x + b.x) / 2,
    my: (a.y + b.y) / 2,
  };
}
