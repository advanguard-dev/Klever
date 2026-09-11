import { TOOL_BY_KEY } from "@/components/freeform/board-chrome";
import { GRID, type Guide } from "@/components/freeform/board-ops";
import type { BoardClipboard } from "@/components/freeform/board-selection";
import type { FreeformObject, FreeformTool } from "@/types";
import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";

type HistoryApi = { undo: () => void; redo: () => void };

export type UseBoardHotkeysArgs = {
  tool: FreeformTool;
  editing: string | null;
  searchOpen: boolean;
  selected: string[];
  history: HistoryApi;
  toolBeforeSpaceRef: MutableRefObject<FreeformTool>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  clipboardRef: MutableRefObject<BoardClipboard | null>;
  pasteFromOsRef: MutableRefObject<() => void>;
  onToolClickRef: MutableRefObject<(id: FreeformTool) => void>;
  objectsRef: MutableRefObject<FreeformObject[]>;
  viewportRef: RefObject<HTMLDivElement | null>;
  cameraRef: MutableRefObject<{ zoom: number }>;
  setSpacePan: Dispatch<SetStateAction<boolean>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSelected: Dispatch<SetStateAction<string[]>>;
  setEditing: Dispatch<SetStateAction<string | null>>;
  setMentionPos: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setConnectFrom: Dispatch<SetStateAction<string | null>>;
  setGuides: Dispatch<SetStateAction<Guide[]>>;
  setMarquee: Dispatch<SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
  copySelection: () => boolean;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  closeSearch: () => void;
  withHistory: (fn: () => void) => void;
  removeBoardObject: (id: string) => void;
  setBoard: (patch: { objects: FreeformObject[] }) => void;
  zoomAt: (clientX: number, clientY: number, nextZoom: number, persist: boolean) => void;
};

export function useBoardHotkeys(args: UseBoardHotkeysArgs) {
  const {
    tool,
    editing,
    searchOpen,
    selected,
    history,
    toolBeforeSpaceRef,
    searchInputRef,
    clipboardRef,
    pasteFromOsRef,
    onToolClickRef,
    objectsRef,
    viewportRef,
    cameraRef,
    setSpacePan,
    setSearchOpen,
    setSelected,
    setEditing,
    setMentionPos,
    setConnectFrom,
    setGuides,
    setMarquee,
    copySelection,
    pasteClipboard,
    duplicateSelection,
    bringForward,
    sendBackward,
    closeSearch,
    withHistory,
    removeBoardObject,
    setBoard,
    zoomAt,
  } = args;

  useEffect(() => {
    const inField = (t: EventTarget | null) =>
      !!(t as HTMLElement)?.closest?.("input,textarea,[contenteditable]");
    const inTableSheet = (t: EventTarget | null) =>
      !!(t as HTMLElement)?.closest?.("[data-board-table]");

    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !inField(e.target) && !e.repeat) {
        e.preventDefault();
        toolBeforeSpaceRef.current = tool;
        setSpacePan(true);
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "f") {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.("[data-note-find],.cm-editor,.ProseMirror,[data-note-page]")) {
          return;
        }
        e.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 0);
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !inField(e.target)) {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y" && !inField(e.target)) {
        e.preventDefault();
        history.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "c" && !inField(e.target) && !inTableSheet(e.target)) {
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && !inField(e.target) && !inTableSheet(e.target)) {
        e.preventDefault();
        if (clipboardRef.current?.objects.length) pasteClipboard();
        else pasteFromOsRef.current();
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && !inField(e.target) && !inTableSheet(e.target)) {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && e.key === "]" && !inField(e.target) && !editing) {
        e.preventDefault();
        bringForward();
        return;
      }
      if (mod && e.key === "[" && !inField(e.target) && !editing) {
        e.preventDefault();
        sendBackward();
        return;
      }
      if (!mod && !e.altKey && !inField(e.target) && !inTableSheet(e.target) && !editing && !e.repeat) {
        const next = TOOL_BY_KEY[e.key.toLowerCase()];
        if (next) {
          e.preventDefault();
          onToolClickRef.current(next);
          return;
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.length && !editing) {
        if (inField(e.target) || inTableSheet(e.target)) return;
        withHistory(() => {
          selected.forEach(removeBoardObject);
        });
        setSelected([]);
      }
      if (
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown") &&
        selected.length &&
        !editing &&
        !searchOpen &&
        !inField(e.target) &&
        !inTableSheet(e.target)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? GRID : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        withHistory(() => {
          setBoard({
            objects: objectsRef.current.map((o) =>
              selected.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o,
            ),
          });
        });
      }
      if (e.key === "Escape") {
        if (searchOpen) {
          e.preventDefault();
          closeSearch();
          return;
        }
        setEditing(null);
        setMentionPos(null);
        setConnectFrom(null);
        setGuides([]);
        setMarquee(null);
        if (selected.length) setSelected([]);
      }
      if (mod && !inField(e.target) && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0")) {
        e.preventDefault();
        const el = viewportRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const z = cameraRef.current.zoom;
        if (e.key === "0") zoomAt(cx, cy, 1, true);
        else if (e.key === "-") zoomAt(cx, cy, z * 0.92, true);
        else zoomAt(cx, cy, z * 1.08, true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePan(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [
    bringForward,
    cameraRef,
    clipboardRef,
    closeSearch,
    copySelection,
    duplicateSelection,
    editing,
    history,
    objectsRef,
    onToolClickRef,
    pasteClipboard,
    pasteFromOsRef,
    removeBoardObject,
    searchInputRef,
    searchOpen,
    selected,
    sendBackward,
    setBoard,
    setConnectFrom,
    setEditing,
    setGuides,
    setMarquee,
    setMentionPos,
    setSearchOpen,
    setSelected,
    setSpacePan,
    tool,
    toolBeforeSpaceRef,
    viewportRef,
    withHistory,
    zoomAt,
  ]);
}
