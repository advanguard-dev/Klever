import type { PageSplit, SplitSide } from "@/types";
import type { Note } from "@/types";

export function sanitizeSplit(split: PageSplit | null, notes: Note[]): PageSplit | null {
  if (!split) return null;
  if (split.leftId === split.rightId) return null;
  if (!notes.some((n) => n.id === split.leftId)) return null;
  if (!notes.some((n) => n.id === split.rightId)) return null;
  return split;
}

export function pickSplitMate(current: string, notes: Note[], recents: string[], openTabs: string[]) {
  const ok = (id: string) => id !== current && notes.some((n) => n.id === id);
  return recents.find(ok) ?? openTabs.find(ok);
}

/**
 * Navigation inside a split only updates focus.
 * Opening a note outside the split leaves panes unchanged (caller keeps split as-is).
 */
export function splitAfterNavigate(split: PageSplit, noteId: string): PageSplit {
  if (noteId === split.leftId) return { ...split, focus: "left" };
  if (noteId === split.rightId) return { ...split, focus: "right" };
  return split;
}

export function buildSplit(
  current: string,
  other: string,
  side: SplitSide,
  focusIncoming: boolean,
): PageSplit {
  const leftId = side === "left" ? other : current;
  const rightId = side === "left" ? current : other;
  const focus: SplitSide = focusIncoming ? side : side === "left" ? "right" : "left";
  return { leftId, rightId, focus };
}
