import type { SplitCorner, SplitSide } from "@/types";

/** Full-height left/right rails — not just the four corners. */
export const SPLIT_EDGE_PX = 88;

export type SplitEdgeHit = { side: SplitSide; corner: SplitCorner };

/** Side-by-side drop target while dragging a note onto the page pane. */
export function splitEdgeHit(rect: DOMRect, x: number, y: number): SplitEdgeHit | null {
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const distL = x - rect.left;
  const distR = rect.right - x;
  const nearL = distL <= SPLIT_EDGE_PX;
  const nearR = distR <= SPLIT_EDGE_PX;
  if (!nearL && !nearR) return null;
  const side: SplitSide = nearL && nearR ? (distL <= distR ? "left" : "right") : nearL ? "left" : "right";
  const corner: SplitCorner = y < (rect.top + rect.bottom) / 2 ? "top" : "bottom";
  return { side, corner };
}
