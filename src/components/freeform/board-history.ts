import type { FreeformConnection, FreeformObject } from "@/types";
import { useCallback, useRef, useState } from "react";

const HISTORY_CAP = 80;

export type BoardHistorySlice = {
  objects: FreeformObject[];
  connections: FreeformConnection[];
};

function cloneSlice(slice: BoardHistorySlice): BoardHistorySlice {
  return structuredClone(slice);
}

/** Undo/redo stack for freeform board objects + connector lines. */
export function useBoardHistory(
  getSlice: () => BoardHistorySlice,
  setSlice: (slice: BoardHistorySlice) => void,
) {
  const undoStack = useRef<BoardHistorySlice[]>([]);
  const redoStack = useRef<BoardHistorySlice[]>([]);
  const [version, setVersion] = useState(0);

  const bump = () => setVersion((v) => v + 1);

  const push = useCallback(() => {
    undoStack.current.push(cloneSlice(getSlice()));
    if (undoStack.current.length > HISTORY_CAP) undoStack.current.shift();
    redoStack.current = [];
    bump();
  }, [getSlice]);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(cloneSlice(getSlice()));
    setSlice(prev);
    bump();
  }, [getSlice, setSlice]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(cloneSlice(getSlice()));
    setSlice(next);
    bump();
  }, [getSlice, setSlice]);

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    version,
  };
}
