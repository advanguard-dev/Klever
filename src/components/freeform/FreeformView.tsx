import { BoardObject, ShapeGraphic } from "@/components/freeform/BoardObject";
import {
  ArrangeStudio,
  BoardHud,
  BoardMoreMenu,
  BoardSearch,
  type BoardStudio,
  BoardToolRail,
  BoardViewHud,
  HudConnectBtn,
  InkStudio,
  PaintWell,
  ShapeStudio,
  StickyStudio,
  TOOL_BY_KEY,
  TypeStudio,
} from "@/components/freeform/board-chrome";
import { exportBoardJson, exportBoardPng } from "@/components/freeform/board-export";
import { useBoardHistory } from "@/components/freeform/board-history";
import {
  createImage,
  createLink,
  createMention,
  createMind,
  createPath,
  createShape,
  createSticky,
  createTable,
  cameraForObjectFocus,
  createText,
  DROP,
  DEFAULT_HIGHLIGHT_COLOR,
  findConnection,
  HIGHLIGHT_COLORS,
  HIGHLIGHTER_OPACITY,
  hitPathObject,
  clampZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  INK_COLORS,
  type InkTool,
  inkStrokeValue,
  MIND_TEXT_SIZES,
  mindNodeHeight,
  nextZ,
  objectSearchPreview,
  pathBounds,
  pointsToLocal,
  searchBoardObjects,
  stickyContrastTextColor,
  STICKY_TEXT_SIZES,
  TEXT_SIZES,
} from "@/components/freeform/board-model";
import {
  alignObjects,
  applyResizeToObject,
  boxesIntersect,
  cloneSelection,
  GRID,
  hitBoardObjectAt,
  marqueeBox,
  nudgeZ,
  PASTE_OFFSET,
  shapeDraftBox,
  resizeBox,
  snapGroupMove,
  snapResizeBox,
  type AlignEdge,
  type Box,
  type Guide,
  type ResizeHandle,
} from "@/components/freeform/board-ops";
import { ConfirmDialog, MonoLabel, ToolbarBtn } from "@/components/ui";
import { TitleBar } from "@/components/layout/TitleBar";
import { useContextMenu } from "@/components/ContextMenu";
import type { ContextMenuItem } from "@/lib/context-menus";
import { openNote } from "@/components/editor/WikiPeek";
import { cn } from "@/lib/cn";
import { nid } from "@/lib/ids";
import { plainSnippet } from "@/lib/parse";
import { useApp } from "@/store";
import type {
  FreeformConnection,
  FreeformObject,
  FreeformShapeKind,
  FreeformStickyColor,
  FreeformStrokeDash,
  FreeformTool,
} from "@/types";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  File,
  FileText,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const PLACE_TOOLS = new Set<FreeformTool>(["text", "sticky", "link", "table", "mind", "mention", "image"]);
const INSERT_TOOLS = new Set<FreeformTool>([...PLACE_TOOLS]);

type VaultHit = {
  id: string;
  title: string;
  path: string;
  kind: "page" | "database" | "file";
  snippet: string;
};

const KIND_META: Record<
  VaultHit["kind"],
  { label: string; icon: typeof FileText }
> = {
  page: { label: "page", icon: FileText },
  database: { label: "database", icon: Database },
  file: { label: "file", icon: File },
};

type DragState =
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

function pinchOf(pointers: Map<number, { x: number; y: number }>) {
  const pts = [...pointers.values()];
  if (pts.length < 2) return null;
  const [a, b] = pts;
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
    mx: (a.x + b.x) / 2,
    my: (a.y + b.y) / 2,
  };
}

export function FreeformView() {
  const boards = useApp((s) => s.boards);
  const board = useApp((s) => {
    const id = s.view.kind === "freeform" ? s.view.id : undefined;
    return s.boards.find((b) => b.id === id) ?? s.boards[0]!;
  });
  const notes = useApp((s) => s.notes);
  const blobs = useApp((s) => s.blobs);
  const setBoard = useApp((s) => s.setBoard);
  const upsertBoardObject = useApp((s) => s.upsertBoardObject);
  const patchBoardObject = useApp((s) => s.patchBoardObject);
  const removeBoardObject = useApp((s) => s.removeBoardObject);
  const clearBoard = useApp((s) => s.clearBoard);
  const createBoard = useApp((s) => s.createBoard);
  const deleteBoard = useApp((s) => s.deleteBoard);
  const leaveBoard = useApp((s) => s.leaveBoard);
  const linkLocalFile = useApp((s) => s.linkLocalFile);
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();

  const [draftTitle, setDraftTitle] = useState(board?.title ?? "Board");
  const [boardMenu, setBoardMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const boardMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const [titleGlyphW, setTitleGlyphW] = useState(0);

  useEffect(() => {
    setDraftTitle(board?.title ?? "Board");
  }, [board?.id, board?.title]);

  useLayoutEffect(() => {
    const node = titleMeasureRef.current;
    if (!node) return;
    setTitleGlyphW(Math.ceil(node.getBoundingClientRect().width) + 1);
  }, [draftTitle]);

  useEffect(() => {
    if (!boardMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!boardMenuRef.current?.contains(e.target as Node)) setBoardMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBoardMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [boardMenu]);

  const objectsRef = useRef(board.objects);
  objectsRef.current = board.objects;
  const connectionsRef = useRef<FreeformConnection[]>(board.connections ?? []);
  connectionsRef.current = board.connections ?? [];

  const getSlice = useCallback(
    () => ({
      objects: objectsRef.current,
      connections: connectionsRef.current,
    }),
    [],
  );
  const setSlice = useCallback(
    (slice: { objects: FreeformObject[]; connections: FreeformConnection[] }) =>
      setBoard({ objects: slice.objects, connections: slice.connections }),
    [setBoard],
  );
  const history = useBoardHistory(getSlice, setSlice);

  const [tool, setTool] = useState<FreeformTool>("select");
  const [studio, setStudio] = useState<BoardStudio>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [stickyColor, setStickyColor] = useState<FreeformStickyColor>("amber");
  const [spacePan, setSpacePan] = useState(false);
  const [mentionQ, setMentionQ] = useState("");
  const [mentionPos, setMentionPos] = useState<{ x: number; y: number } | null>(null);
  const [draftPath, setDraftPath] = useState<{ x: number; y: number }[] | null>(null);
  const [inkTool, setInkTool] = useState<InkTool>("pen");
  const [penColor, setPenColor] = useState("ink");
  const [highlighterColor, setHighlighterColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [penWidth, setPenWidth] = useState<number>(2.5);
  const [highlighterWidth, setHighlighterWidth] = useState<number>(18);
  const [shapeKind, setShapeKind] = useState<FreeformShapeKind>("rect");
  const [shapeFill, setShapeFill] = useState("paper");
  const [shapeStroke, setShapeStroke] = useState("ink");
  const [shapeWidth, setShapeWidth] = useState(2);
  const [shapeDash, setShapeDash] = useState<FreeformStrokeDash>("solid");
  const [draftShape, setDraftShape] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  /** When set, next object click toggles a connector from this id. */
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const clipboardRef = useRef<{
    objects: FreeformObject[];
    connections: FreeformConnection[];
  } | null>(null);
  const pasteNRef = useRef(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imagePlaceRef = useRef<{ x: number; y: number } | null>(null);
  const onToolClickRef = useRef<(id: FreeformTool) => void>(() => {});
  const dragRef = useRef<DragState>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const cameraRef = useRef(board.camera);
  const placeStackRef = useRef(0);
  const toolBeforeSpaceRef = useRef<FreeformTool>("select");
  const editHistoryRef = useRef(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    cameraRef.current = board.camera;
  }, [board.camera]);

  const applyCameraLive = useCallback((cam: typeof board.camera) => {
    cameraRef.current = cam;
    if (viewportRef.current) {
      const layer = viewportRef.current.querySelector("[data-board-layer]") as HTMLElement | null;
      if (layer) {
        layer.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`;
        layer.style.setProperty("--board-zoom", String(cam.zoom));
      }
      const dots = viewportRef.current.querySelector("[data-board-dots]") as HTMLElement | null;
      if (dots) {
        dots.style.backgroundSize = `${22 * cam.zoom}px ${22 * cam.zoom}px`;
        dots.style.backgroundPosition = `${cam.x}px ${cam.y}px`;
      }
    }
  }, []);

  const persistCamera = useCallback(
    (cam: typeof board.camera) => {
      cameraRef.current = cam;
      setBoard({ camera: cam });
    },
    [setBoard],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQ("");
    setSearchIndex(0);
  }, []);

  const focusObject = useCallback(
    (id: string) => {
      const obj = objectsRef.current.find((o) => o.id === id);
      const el = viewportRef.current;
      if (!obj || !el) return;
      const r = el.getBoundingClientRect();
      const next = cameraForObjectFocus(
        obj,
        { width: r.width, height: r.height },
        cameraRef.current.zoom,
      );
      applyCameraLive(next);
      persistCamera(next);
      setSelected([id]);
      setEditing(null);
      closeSearch();
    },
    [applyCameraLive, closeSearch, persistCamera],
  );

  useEffect(() => {
    if (!searchOpen) return;
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let persistTimer = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cam = cameraRef.current;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const pinchZoom = e.ctrlKey || e.metaKey;
      let next = cam;
      if (pinchZoom) {
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        const nextZoom = clampZoom(cam.zoom * factor);
        const wx = (mx - cam.x) / cam.zoom;
        const wy = (my - cam.y) / cam.zoom;
        next = {
          zoom: nextZoom,
          x: mx - wx * nextZoom,
          y: my - wy * nextZoom,
        };
      } else {
        next = {
          ...cam,
          x: cam.x - e.deltaX,
          y: cam.y - e.deltaY,
        };
      }
      applyCameraLive(next);
      window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => persistCamera(cameraRef.current), 80);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.clearTimeout(persistTimer);
      el.removeEventListener("wheel", onWheel);
    };
  }, [applyCameraLive, persistCamera]);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextZoom: number, persist: boolean) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cam = cameraRef.current;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const z = clampZoom(nextZoom);
      const wx = (mx - cam.x) / cam.zoom;
      const wy = (my - cam.y) / cam.zoom;
      const next = { zoom: z, x: mx - wx * z, y: my - wy * z };
      if (persist) persistCamera(next);
      else {
        applyCameraLive(next);
        setBoard({ camera: next });
      }
    },
    [applyCameraLive, persistCamera, setBoard],
  );

  const pushHistory = history.push;

  const withHistory = useCallback(
    (fn: () => void) => {
      pushHistory();
      fn();
    },
    [pushHistory],
  );

  const patchWithHistory = useCallback(
    (id: string, patch: Partial<FreeformObject>, coalesceEdit = false) => {
      if (coalesceEdit) {
        if (!editHistoryRef.current) {
          pushHistory();
          editHistoryRef.current = true;
        }
      } else {
        pushHistory();
      }
      patchBoardObject(id, patch);
    },
    [patchBoardObject, pushHistory],
  );

  const removeWithHistory = useCallback(
    (id: string) => {
      pushHistory();
      removeBoardObject(id);
    },
    [pushHistory, removeBoardObject],
  );

  const upsertWithHistory = useCallback(
    (obj: FreeformObject) => {
      pushHistory();
      upsertBoardObject(obj);
    },
    [pushHistory, upsertBoardObject],
  );

  const copySelection = useCallback(() => {
    const ids = selectedRef.current;
    if (!ids.length) return false;
    const idSet = new Set(ids);
    clipboardRef.current = {
      objects: objectsRef.current.filter((o) => idSet.has(o.id)).map((o) => structuredClone(o)),
      connections: connectionsRef.current.filter((c) => idSet.has(c.from) && idSet.has(c.to)),
    };
    pasteNRef.current = 0;
    return true;
  }, []);

  const pasteClipboard = useCallback(
    (asDuplicate = false) => {
      const clip = clipboardRef.current;
      if (!clip?.objects.length) return;
      pasteNRef.current += 1;
      const offset = PASTE_OFFSET * pasteNRef.current;
      const cloned = cloneSelection(
        clip.objects,
        clip.connections,
        clip.objects.map((o) => o.id),
        offset,
      );
      let z = nextZ(objectsRef.current);
      const objects = cloned.objects.map((o) => ({ ...o, z: z++ }));
      withHistory(() => {
        setBoard({
          objects: [...objectsRef.current, ...objects],
          connections: [...connectionsRef.current, ...cloned.connections],
        });
      });
      setSelected(objects.map((o) => o.id));
      setTool("select");
      if (asDuplicate) pasteNRef.current = 0;
    },
    [setBoard, withHistory],
  );

  const duplicateSelection = useCallback(() => {
    if (!copySelection()) return;
    pasteClipboard(true);
  }, [copySelection, pasteClipboard]);

  const applyAlign = useCallback(
    (edge: AlignEdge) => {
      const ids = selectedRef.current;
      if (ids.length < 2) return;
      withHistory(() => {
        setBoard({ objects: alignObjects(objectsRef.current, ids, edge) });
      });
    },
    [setBoard, withHistory],
  );

  const bringFront = useCallback(() => {
    const ids = selectedRef.current;
    if (!ids.length) return;
    let z = nextZ(objectsRef.current);
    withHistory(() => {
      setBoard({
        objects: objectsRef.current.map((o) => (ids.includes(o.id) ? { ...o, z: z++ } : o)),
      });
    });
  }, [setBoard, withHistory]);

  const sendBack = useCallback(() => {
    const ids = selectedRef.current;
    if (!ids.length) return;
    const min = objectsRef.current.reduce((m, o) => Math.min(m, o.z), 0);
    let z = min - ids.length;
    withHistory(() => {
      setBoard({
        objects: objectsRef.current.map((o) => (ids.includes(o.id) ? { ...o, z: z++ } : o)),
      });
    });
  }, [setBoard, withHistory]);

  const bringForward = useCallback(() => {
    const ids = selectedRef.current;
    if (!ids.length) return;
    withHistory(() => {
      setBoard({ objects: nudgeZ(objectsRef.current, ids, 1) });
    });
  }, [setBoard, withHistory]);

  const sendBackward = useCallback(() => {
    const ids = selectedRef.current;
    if (!ids.length) return;
    withHistory(() => {
      setBoard({ objects: nudgeZ(objectsRef.current, ids, -1) });
    });
  }, [setBoard, withHistory]);

  useEffect(() => {
    const inField = (t: EventTarget | null) =>
      !!(t as HTMLElement)?.closest?.("input,textarea,[contenteditable]");

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
      if (mod && e.key.toLowerCase() === "c" && !inField(e.target)) {
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && !inField(e.target)) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && !inField(e.target)) {
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
      if (!mod && !e.altKey && !inField(e.target) && !editing && !e.repeat) {
        const next = TOOL_BY_KEY[e.key.toLowerCase()];
        if (next) {
          e.preventDefault();
          onToolClickRef.current(next);
          return;
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.length && !editing) {
        if (inField(e.target)) return;
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
        !inField(e.target)
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
    closeSearch,
    copySelection,
    duplicateSelection,
    editing,
    history,
    pasteClipboard,
    removeBoardObject,
    searchOpen,
    selected,
    sendBackward,
    setBoard,
    tool,
    withHistory,
    zoomAt,
  ]);

  useEffect(() => {
    editHistoryRef.current = false;
  }, [editing]);

  const sorted = useMemo(
    () => [...board.objects].sort((a, b) => a.z - b.z),
    [board.objects],
  );

  const searchHits = useMemo(() => {
    const extra = (o: FreeformObject) => {
      if (o.type !== "mention") return "";
      const n = notes.find((note) => note.id === o.noteId);
      return n?.title ?? "";
    };
    return searchBoardObjects(board.objects, searchQ, extra).map((o) => ({
      id: o.id,
      ...objectSearchPreview(o, extra(o)),
    }));
  }, [board.objects, notes, searchQ]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQ]);

  const connectorLinks = useMemo(() => {
    const byId = new Map(board.objects.map((o) => [o.id, o]));
    const links: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    const seen = new Set<string>();

    for (const o of board.objects) {
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

    for (const c of board.connections ?? []) {
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
  }, [board.objects, board.connections]);

  const toggleConnection = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      withHistory(() => {
        const cur = connectionsRef.current;
        const existing = findConnection(cur, from, to);
        if (existing) {
          setBoard({ connections: cur.filter((c) => c.id !== existing.id) });
        } else {
          setBoard({
            connections: [...cur, { id: nid(), from, to }],
          });
        }
      });
    },
    [setBoard, withHistory],
  );
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: (clientX - rect.left - cam.x) / cam.zoom,
      y: (clientY - rect.top - cam.y) / cam.zoom,
    };
  }, []);

  const selectOne = (id: string, additive?: boolean) => {
    if (connectFrom) {
      if (id !== connectFrom) toggleConnection(connectFrom, id);
      setConnectFrom(null);
      setSelected([id]);
      setTool("select");
      return;
    }
    setSelected((prev) => {
      if (additive) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return [id];
    });
  };

  const nextPlacePos = useCallback(() => {
    const cam = cameraRef.current;
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 240;
    const cy = rect ? rect.height / 2 : 180;
    const stack = placeStackRef.current % 10;
    placeStackRef.current += 1;
    const offset = stack * 28;
    return {
      x: (cx - cam.x) / cam.zoom + offset,
      y: (cy - cam.y) / cam.zoom + offset,
    };
  }, []);

  /** Center on the drop point. Do not scale w/h/fontSize — zoom is camera-only. */
  const fitDrop = (obj: FreeformObject, center = true) => {
    if (!center) return obj;
    return { ...obj, x: obj.x - obj.w / 2, y: obj.y - obj.h / 2 };
  };

  const finishInsert = () => {
    setTool("select");
    setStudio(null);
    setConnectFrom(null);
  };

  const placeAt = (
    world: { x: number; y: number },
    activeTool: FreeformTool,
    extras?: { shape?: FreeformShapeKind },
  ) => {
    const z = nextZ(board.objects);
    if (activeTool === "text") {
      const obj = fitDrop(createText(world.x, world.y, z));
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      finishInsert();
      return;
    }
    if (activeTool === "sticky") {
      const obj = fitDrop(createSticky(world.x, world.y, z, stickyColor));
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      finishInsert();
      return;
    }
    if (activeTool === "link") {
      const obj = fitDrop(createLink(world.x, world.y, z));
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      finishInsert();
      return;
    }
    if (activeTool === "table") {
      const obj = fitDrop(createTable(world.x, world.y, z));
      upsertWithHistory(obj);
      setSelected([obj.id]);
      finishInsert();
      return;
    }
    if (activeTool === "mind") {
      const parentId = selected.find((id) => board.objects.find((o) => o.id === id)?.type === "mind");
      const obj = fitDrop(createMind(world.x, world.y, z, parentId));
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      finishInsert();
      return;
    }
    if (activeTool === "shape") {
      const obj = createShape(world.x, world.y, DROP.shape.w, DROP.shape.h, z, {
        shape: extras?.shape ?? shapeKind,
        fill: shapeFill,
        stroke: shapeStroke,
        strokeWidth: shapeWidth,
        strokeDash: shapeDash,
      });
      const placed = fitDrop(obj);
      upsertWithHistory(placed);
      setSelected([placed.id]);
      finishInsert();
      return;
    }
    if (activeTool === "mention") {
      setMentionPos(world);
      setMentionQ("");
      finishInsert();
      return;
    }
    if (activeTool === "image") {
      imagePlaceRef.current = world;
      finishInsert();
      void (async () => {
        const path = await linkLocalFile("image/*");
        if (!path) return;
        const place = imagePlaceRef.current ?? nextPlacePos();
        const name = path.split("/").pop() ?? path;
        const obj = fitDrop(createImage(place.x, place.y, nextZ(objectsRef.current), path, name));
        upsertWithHistory(obj);
        setSelected([obj.id]);
        setTool("select");
      })();
    }
  };

  const onToolClick = (id: FreeformTool) => {
    setMentionPos(null);
    setConnectFrom(null);
    if (id === "shape") {
      if (tool === "shape" && studio === "shape") {
        setTool("select");
        setStudio(null);
        return;
      }
      setTool("shape");
      setStudio("shape");
      return;
    }
    if (INSERT_TOOLS.has(id)) {
      placeAt(nextPlacePos(), id);
      return;
    }
    setTool(id);
    setStudio(id === "draw" ? "ink" : null);
  };
  onToolClickRef.current = onToolClick;

  const eraseAt = (wx: number, wy: number, drag: Extract<DragState, { kind: "erase" }>) => {
    const hit = [...objectsRef.current]
      .filter((o): o is Extract<FreeformObject, { type: "path" }> => o.type === "path")
      .reverse()
      .find((o) => hitPathObject(o, wx, wy, 10 / cameraRef.current.zoom));
    if (!hit) return;
    if (!drag.pushed) {
      pushHistory();
      drag.pushed = true;
    }
    removeBoardObject(hit.id);
    setSelected((s) => s.filter((x) => x !== hit.id));
  };

  const startPinch = (pointerId: number) => {
    const m = pinchOf(pointersRef.current);
    if (!m) return false;
    dragRef.current = {
      kind: "pinch",
      dist: m.dist,
      mx: m.mx,
      my: m.my,
      cam: { ...cameraRef.current },
    };
    setMarquee(null);
    setDraftPath(null);
    setDraftShape(null);
    setGuides([]);
    try {
      viewportRef.current?.setPointerCapture(pointerId);
    } catch {
      /* already captured */
    }
    return true;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      e.preventDefault();
      startPinch(e.pointerId);
      return;
    }
    if (e.button === 1 || e.button === 2 || tool === "pan" || spacePan) {
      if (e.button === 2) e.preventDefault();
      e.preventDefault();
      const cam = cameraRef.current;
      dragRef.current = { kind: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "draw") {
      const w = screenToWorld(e.clientX, e.clientY);
      if (inkTool === "eraser") {
        dragRef.current = { kind: "erase", pushed: false };
        eraseAt(w.x, w.y, dragRef.current);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      dragRef.current = { kind: "draw", points: [w] };
      setDraftPath([w]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "shape") {
      setStudio(null);
      setTool("select");
      setDraftShape(null);
      setSelected([]);
      setEditing(null);
      return;
    }
    if (PLACE_TOOLS.has(tool) && e.button === 0) {
      e.preventDefault();
      const w = screenToWorld(e.clientX, e.clientY);
      placeAt(w, tool);
      return;
    }
    if (connectFrom) {
      setConnectFrom(null);
      setSelected([]);
      setEditing(null);
      return;
    }
    setSelected([]);
    setEditing(null);
    setMentionPos(null);
    if (tool === "select" && e.button === 0) {
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        const cam = cameraRef.current;
        dragRef.current = { kind: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      const w = screenToWorld(e.clientX, e.clientY);
      dragRef.current = { kind: "marquee", x0: w.x, y0: w.y, x1: w.x, y1: w.y };
      setMarquee({ x: w.x, y: w.y, w: 0, h: 0 });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  /** Select (arrow) tool — and any non-pan/draw mode — can move objects anytime. */
  const onObjectDragStart = (e: ReactPointerEvent, id: string) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      startPinch(e.pointerId);
      return;
    }
    if (tool === "pan" || spacePan) return;
    if (tool === "draw" || tool === "shape") return;
    let ids = selectedRef.current.includes(id) ? selectedRef.current : [id];
    let origins: Record<string, { x: number; y: number }> = {};
    pushHistory();
    if (e.altKey) {
      const cloned = cloneSelection(objectsRef.current, connectionsRef.current, ids, 0);
      setBoard({
        objects: [...objectsRef.current, ...cloned.objects],
        connections: [...connectionsRef.current, ...cloned.connections],
      });
      ids = cloned.objects.map((o) => o.id);
      for (const o of cloned.objects) origins[o.id] = { x: o.x, y: o.y };
      setSelected(ids);
    } else {
      for (const oid of ids) {
        const o = objectsRef.current.find((x) => x.id === oid);
        if (o) origins[oid] = { x: o.x, y: o.y };
      }
    }
    const w = screenToWorld(e.clientX, e.clientY);
    dragRef.current = { kind: "move", ids, sx: w.x, sy: w.y, origins };
    (viewportRef.current as HTMLElement | null)?.setPointerCapture(e.pointerId);
  };

  const onResizeStart = (e: ReactPointerEvent, id: string, handle: ResizeHandle) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      startPinch(e.pointerId);
      return;
    }
    if (tool === "pan" || spacePan || tool === "draw" || tool === "shape") return;
    const o = objectsRef.current.find((x) => x.id === id);
    if (!o) return;
    setSelected([id]);
    pushHistory();
    const w = screenToWorld(e.clientX, e.clientY);
    dragRef.current = {
      kind: "resize",
      id,
      handle,
      sx: w.x,
      sy: w.y,
      origin: { x: o.x, y: o.y, w: o.w, h: o.h },
      source: structuredClone(o),
    };
    (viewportRef.current as HTMLElement | null)?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pinch") {
      const m = pinchOf(pointersRef.current);
      const el = viewportRef.current;
      if (!m || !el) return;
      const rect = el.getBoundingClientRect();
      const nextZoom = clampZoom(drag.cam.zoom * (m.dist / drag.dist));
      const wx = (drag.mx - rect.left - drag.cam.x) / drag.cam.zoom;
      const wy = (drag.my - rect.top - drag.cam.y) / drag.cam.zoom;
      applyCameraLive({
        zoom: nextZoom,
        x: m.mx - rect.left - wx * nextZoom,
        y: m.my - rect.top - wy * nextZoom,
      });
      return;
    }
    if (drag.kind === "pan") {
      const next = {
        ...cameraRef.current,
        x: drag.cx + (e.clientX - drag.sx),
        y: drag.cy + (e.clientY - drag.sy),
      };
      applyCameraLive(next);
      return;
    }
    if (drag.kind === "draw") {
      const w = screenToWorld(e.clientX, e.clientY);
      const points = [...drag.points, w];
      drag.points = points;
      setDraftPath(points);
      return;
    }
    if (drag.kind === "shape") {
      const w = screenToWorld(e.clientX, e.clientY);
      drag.x1 = w.x;
      drag.y1 = w.y;
      setDraftShape(shapeDraftBox(drag.x0, drag.y0, drag.x1, drag.y1, { shift: e.shiftKey, fromCenter: e.altKey }));
      return;
    }
    if (drag.kind === "erase") {
      const w = screenToWorld(e.clientX, e.clientY);
      eraseAt(w.x, w.y, drag);
      return;
    }
    if (drag.kind === "marquee") {
      const w = screenToWorld(e.clientX, e.clientY);
      drag.x1 = w.x;
      drag.y1 = w.y;
      setMarquee(marqueeBox(drag.x0, drag.y0, drag.x1, drag.y1));
      return;
    }
    if (drag.kind === "move") {
      const w = screenToWorld(e.clientX, e.clientY);
      let rawDx = w.x - drag.sx;
      let rawDy = w.y - drag.sy;
      if (e.shiftKey) {
        if (Math.abs(rawDx) >= Math.abs(rawDy)) rawDy = 0;
        else rawDx = 0;
      }
      const moving = drag.ids
        .map((id) => {
          const o = objectsRef.current.find((x) => x.id === id);
          const origin = drag.origins[id];
          if (!o || !origin) return null;
          return { id, origin: { x: origin.x, y: origin.y, w: o.w, h: o.h } };
        })
        .filter((m): m is { id: string; origin: Box } => Boolean(m));
      const others = objectsRef.current
        .filter((o) => !drag.ids.includes(o.id))
        .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
      const snapped = snapGroupMove(moving, others, rawDx, rawDy, GRID);
      setGuides(snapped.guides);
      for (const id of drag.ids) {
        const o = drag.origins[id];
        if (!o) continue;
        patchBoardObject(id, { x: o.x + snapped.dx, y: o.y + snapped.dy } as Partial<FreeformObject>);
      }
      return;
    }
    if (drag.kind === "resize") {
      const w = screenToWorld(e.clientX, e.clientY);
      const box = resizeBox(drag.origin, drag.handle, w.x - drag.sx, w.y - drag.sy, e.shiftKey);
      const others = objectsRef.current
        .filter((o) => o.id !== drag.id)
        .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
      const snapped = snapResizeBox(box, others, GRID);
      setGuides(snapped.guides);
      patchBoardObject(drag.id, applyResizeToObject(drag.source, snapped.box));
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    const drag = dragRef.current;
    if (drag?.kind === "pinch") {
      if (pointersRef.current.size < 2) {
        persistCamera(cameraRef.current);
        dragRef.current = null;
        const leftover = [...pointersRef.current.values()][0];
        if (leftover) {
          dragRef.current = {
            kind: "pan",
            sx: leftover.x,
            sy: leftover.y,
            cx: cameraRef.current.x,
            cy: cameraRef.current.y,
          };
        }
      }
      return;
    }
    dragRef.current = null;
    setGuides([]);
    if (drag?.kind === "pan") {
      persistCamera(cameraRef.current);
      return;
    }
    if (drag?.kind === "marquee") {
      const box = marqueeBox(drag.x0, drag.y0, drag.x1, drag.y1);
      setMarquee(null);
      if (box.w < 4 && box.h < 4) return;
      setSelected(
        objectsRef.current
          .filter((o) => boxesIntersect(box, { x: o.x, y: o.y, w: o.w, h: o.h }))
          .map((o) => o.id),
      );
      return;
    }
    if (drag?.kind === "draw" && drag.points.length > 1) {
      const bounds = pathBounds(drag.points);
      const local = pointsToLocal(drag.points, bounds.x, bounds.y);
      const isHi = inkTool === "highlighter";
      upsertWithHistory(
        createPath(bounds.x, bounds.y, nextZ(board.objects), local, {
          stroke: isHi ? highlighterColor : penColor,
          strokeWidth: isHi ? highlighterWidth : penWidth,
          opacity: isHi ? HIGHLIGHTER_OPACITY : 1,
        }),
      );
      setDraftPath(null);
      return;
    }
    if (drag?.kind === "shape") {
      const box = shapeDraftBox(drag.x0, drag.y0, drag.x1, drag.y1, {
        shift: e.shiftKey,
        fromCenter: e.altKey,
      });
      setDraftShape(null);
      const w = Math.max(24, box.w);
      const h = Math.max(24, box.h);
      const tiny = box.w < 8 && box.h < 8;
      const obj = createShape(
        tiny ? box.x : box.x,
        tiny ? box.y : box.y,
        tiny ? DROP.shape.w : w,
        tiny ? DROP.shape.h : h,
        nextZ(board.objects),
        { shape: shapeKind, fill: shapeFill, stroke: shapeStroke, strokeWidth: shapeWidth, strokeDash: shapeDash },
      );
      upsertWithHistory(tiny ? fitDrop(obj) : obj);
      setSelected([obj.id]);
      setTool("select");
      setStudio(null);
      return;
    }
    setDraftPath(null);
    setDraftShape(null);
  };

  const addMindChild = (parentId: string) => {
    const parent = board.objects.find((o) => o.id === parentId);
    if (!parent) return;
    const obj = fitDrop(
      createMind(parent.x + 40, parent.y + parent.h + 48, nextZ(board.objects), parentId),
      false,
    );
    upsertWithHistory(obj);
    setSelected([obj.id]);
    setEditing(obj.id);
  };

  const mentionHits = useMemo(() => {
    const q = mentionQ.trim().toLowerCase();
    const noteHits: VaultHit[] = notes.map((n) => {
      const kind = n.type === "database" ? ("database" as const) : ("page" as const);
      const snippet =
        kind === "database"
          ? `${(n.schema ?? []).length} fields · Database`
          : plainSnippet(n.body, 120) || "Empty page";
      return {
        id: n.id,
        title: n.title || n.path,
        path: n.path,
        kind,
        snippet,
      };
    });
    const notePaths = new Set(notes.map((n) => n.path));
    const fileHits: VaultHit[] = Object.keys(blobs)
      .filter((path) => !notePaths.has(path))
      .map((path) => {
        const rec = blobs[path];
        return {
          id: path,
          title: path.split("/").pop() || path,
          path,
          kind: "file" as const,
          snippet: rec?.mime ? rec.mime : "File",
        };
      });
    const all = [...noteHits, ...fileHits];
    const filtered = !q
      ? all
      : all.filter(
          (h) =>
            h.title.toLowerCase().includes(q) ||
            h.path.toLowerCase().includes(q) ||
            h.kind.includes(q) ||
            h.snippet.toLowerCase().includes(q),
        );
    return filtered.slice(0, 12);
  }, [blobs, mentionQ, notes]);

  const selectedSticky = useMemo(() => {
    const id = selected[0];
    if (!id || selected.length !== 1) return null;
    const o = board.objects.find((x) => x.id === id);
    return o?.type === "sticky" ? o : null;
  }, [board.objects, selected]);

  const selectedTextObj = useMemo(() => {
    if (selected.length !== 1) return undefined;
    const o = board.objects.find((x) => x.id === selected[0]);
    return o?.type === "text" ? o : undefined;
  }, [board.objects, selected]);

  const selectedMind = useMemo(() => {
    if (selected.length !== 1) return null;
    const o = board.objects.find((x) => x.id === selected[0]);
    return o?.type === "mind" ? o : null;
  }, [board.objects, selected]);

  const selectedShape = useMemo(() => {
    if (selected.length !== 1) return null;
    const o = board.objects.find((x) => x.id === selected[0]);
    return o?.type === "shape" ? o : null;
  }, [board.objects, selected]);

  const selectedAny = useMemo(() => {
    if (selected.length !== 1) return null;
    return board.objects.find((x) => x.id === selected[0]) ?? null;
  }, [board.objects, selected]);

  const cam = board.camera;
  const effectivePan = tool === "pan" || spacePan;
  const zoomPct = Math.round(cam.zoom * 100);
  const activeWidth = inkTool === "highlighter" ? highlighterWidth : penWidth;
  const strokeColor = inkTool === "highlighter" ? highlighterColor : penColor;
  const setStrokeColor = inkTool === "highlighter" ? setHighlighterColor : setPenColor;
  const strokeSwatches = inkTool === "highlighter" ? HIGHLIGHT_COLORS : INK_COLORS;
  const draftStroke = inkStrokeValue(strokeColor);

  const typeObj = selectedSticky ?? selectedTextObj ?? selectedMind ?? selectedShape;
  const typeSizes = selectedSticky || selectedShape
    ? STICKY_TEXT_SIZES
    : selectedMind
      ? MIND_TEXT_SIZES
      : TEXT_SIZES;
  const typeColorKey = selectedSticky ? ("textColor" as const) : ("color" as const);

  const viewHud = (
    <BoardViewHud
      zoomPct={zoomPct}
      minPct={Math.round(ZOOM_MIN * 100)}
      maxPct={Math.round(ZOOM_MAX * 100)}
      dotted={board.dotted}
      onZoomOut={() => {
        const el = viewportRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, cam.zoom * 0.92, true);
      }}
      onZoomReset={() => {
        const el = viewportRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1, true);
      }}
      onZoomIn={() => {
        const el = viewportRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, cam.zoom * 1.08, true);
      }}
      onZoomPct={(pct) => {
        const el = viewportRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, pct / 100, true);
      }}
      onDots={() => setBoard({ dotted: !board.dotted })}
    />
  );

  const hud = selected.length > 0 ? (
    <BoardHud
      studio={studio}
      onStudio={setStudio}
      paint={
        <PaintWell
          fill={selectedSticky?.color ?? selectedShape?.fill}
          stroke={selectedShape?.stroke ?? "ink"}
          fillOnly={Boolean(selectedSticky)}
          open={studio === "paint"}
          onToggle={() => setStudio(studio === "paint" ? null : "paint")}
        />
      }
      paintOpen={studio === "paint"}
      paintPanel={
        selectedSticky ? (
          <StickyStudio
            color={selectedSticky.color}
            onColor={(id) => {
              setStickyColor(id as FreeformStickyColor);
              patchWithHistory(selectedSticky.id, {
                color: id,
                textColor: stickyContrastTextColor(id),
              } as Partial<FreeformObject>);
            }}
          />
        ) : selectedShape ? (
          <ShapeStudio
            kind={selectedShape.shape}
            fill={selectedShape.fill}
            stroke={selectedShape.stroke}
            width={selectedShape.strokeWidth}
            dash={selectedShape.strokeDash}
            onKind={(k) => {
              setShapeKind(k);
              patchWithHistory(selectedShape.id, { shape: k } as Partial<FreeformObject>);
            }}
            onFill={(id) => {
              setShapeFill(id);
              patchWithHistory(selectedShape.id, { fill: id } as Partial<FreeformObject>);
            }}
            onStroke={(id) => {
              setShapeStroke(id);
              patchWithHistory(selectedShape.id, { stroke: id } as Partial<FreeformObject>);
            }}
            onWidth={(n) => {
              setShapeWidth(n);
              patchWithHistory(selectedShape.id, { strokeWidth: n } as Partial<FreeformObject>);
            }}
            onDash={(d) => {
              setShapeDash(d);
              patchWithHistory(selectedShape.id, { strokeDash: d } as Partial<FreeformObject>);
            }}
            showLabel={selectedShape.showLabel !== false}
            onShowLabel={(on) => {
              patchWithHistory(selectedShape.id, { showLabel: on } as Partial<FreeformObject>);
            }}
          />
        ) : null
      }
      hasPaint={Boolean(selectedSticky || selectedShape)}
      hasType={Boolean(typeObj)}
      typePanel={
        typeObj ? (
          <TypeStudio
            obj={typeObj}
            sizes={typeSizes}
            colorKey={typeColorKey}
            onPatch={(id, patch) => patchWithHistory(id, patch)}
            onEdit={(id) => setEditing(id)}
          />
        ) : null
      }
      arrangePanel={
        <ArrangeStudio
          multi={selected.length > 1}
          onForward={bringForward}
          onFront={bringFront}
          onBackward={sendBackward}
          onBack={sendBack}
          onAlign={applyAlign}
        />
      }
      connect={
        selectedAny ? (
          <HudConnectBtn
            active={connectFrom === selectedAny.id}
            onClick={() => {
              setTool("select");
              setConnectFrom((cur) => (cur === selectedAny.id ? null : selectedAny.id));
            }}
          />
        ) : null
      }
    />
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TitleBar>
        <div className="flex w-max min-w-0 shrink-0 items-center gap-1.5">
          <ToolbarBtn className="pr-1.5" label="Vault" showLabel onClick={() => leaveBoard()}>
            <ArrowLeft size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <span className="hidden mx-0.5 h-5 w-px shrink-0 bg-line sm:block" aria-hidden />
          <div className="relative inline-flex w-max max-w-full shrink-0" ref={boardMenuRef}>
            <div className="inline-flex w-max max-w-full items-center rounded-md border border-line bg-paper">
              <label className="relative inline-flex w-max max-w-[14rem] shrink-0 items-center px-2 py-1.5">
                <span
                  ref={titleMeasureRef}
                  aria-hidden
                  className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre font-serif text-base font-semibold tracking-tight"
                >
                  {draftTitle || " "}
                </span>
                <input
                  value={draftTitle}
                  size={1}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => {
                    const next = draftTitle.trim() || "Board";
                    setDraftTitle(next);
                    if (next !== board.title) setBoard({ title: next });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      setDraftTitle(board.title);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  aria-label="Board name"
                  title="Rename this board"
                  style={{ width: titleGlyphW > 0 ? titleGlyphW : undefined }}
                  className="klever-focus box-content max-w-full min-w-0 truncate rounded-sm bg-transparent p-0 font-serif text-base font-semibold tracking-tight text-ink placeholder:text-faint"
                />
              </label>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={boardMenu}
                aria-label="Switch board"
                title="Switch board"
                className={cn(
                  "inline-flex w-auto shrink-0 items-center gap-0.5 border-l border-line py-1.5 pl-2 pr-1.5 text-sm font-medium text-mute transition-colors duration-150",
                  "hover:bg-paper-2 hover:text-ink",
                  boardMenu && "bg-paper-2 text-ink",
                )}
                onClick={() => setBoardMenu((o) => !o)}
              >
                <span className="hidden sm:inline">Boards</span>
                <ChevronDown
                  size={14}
                  strokeWidth={1.4}
                  className={cn("transition-transform duration-150", boardMenu && "rotate-180")}
                  aria-hidden
                />
              </button>
            </div>
            {boardMenu && (
              <div
                role="menu"
                className="absolute left-0 top-full z-40 mt-1 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-lg"
              >
                <p className="px-3 pb-1 pt-2">
                  <MonoLabel>Boards</MonoLabel>
                </p>
                {boards.map((b) => {
                  const active = b.id === board.id;
                  return (
                    <div key={b.id} className="flex items-center gap-0.5 px-1">
                      <button
                        type="button"
                        role="menuitem"
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          active ? "bg-paper-2 text-ink" : "text-mute hover:bg-paper-2 hover:text-ink",
                        )}
                        onClick={() => {
                          setBoardMenu(false);
                          setView({ kind: "freeform", id: b.id });
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{b.title}</span>
                        {active && <Check size={14} strokeWidth={1.4} className="shrink-0" />}
                      </button>
                      {boards.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Delete ${b.title}`}
                          className="rounded-lg p-1.5 text-faint hover:bg-paper-2 hover:text-ink"
                          onClick={() => {
                            deleteBoard(b.id);
                            if (b.id === board.id) setBoardMenu(false);
                          }}
                        >
                          <Trash2 size={13} strokeWidth={1.4} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mute hover:bg-paper-2 hover:text-ink"
                  onClick={() => {
                    setBoardMenu(false);
                    createBoard();
                  }}
                >
                  <Plus size={14} strokeWidth={1.4} />
                  New board
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <BoardSearch
            open={searchOpen}
            query={searchQ}
            hits={searchHits}
            activeIndex={Math.min(searchIndex, Math.max(0, searchHits.length - 1))}
            inputRef={searchInputRef}
            onOpen={() => setSearchOpen(true)}
            onClose={closeSearch}
            onQuery={setSearchQ}
            onActiveIndex={setSearchIndex}
            onPick={focusObject}
          />
          <ToolbarBtn
            label="Undo"
            aria-label="Undo"
            shortcut="⌘Z"
            disabled={!history.canUndo}
            onClick={() => history.undo()}
          >
            <Undo2 size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Redo"
            aria-label="Redo"
            shortcut="⌘⇧Z"
            disabled={!history.canRedo}
            onClick={() => history.redo()}
          >
            <Redo2 size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <BoardMoreMenu
            open={studio === "more"}
            onToggle={() => setStudio(studio === "more" ? null : "more")}
            onClose={() => setStudio(null)}
            onExportPng={() => void exportBoardPng(board, blobs)}
            onExportJson={() => exportBoardJson(board)}
            onClear={() => {
              if (!board.objects.length && !(board.connections ?? []).length) return;
              setConfirmClear(true);
            }}
            canClear={Boolean(board.objects.length || (board.connections ?? []).length)}
          />
        </div>
      </TitleBar>

      <div className="relative min-h-0 flex-1">
      <div
        ref={viewportRef}
        className={cn(
          "absolute inset-0 touch-none overflow-hidden bg-paper",
          effectivePan
            ? "cursor-grab active:cursor-grabbing"
            : tool === "draw"
              ? inkTool === "eraser"
                ? "cursor-cell"
                : "cursor-crosshair"
            : tool === "shape" || connectFrom || PLACE_TOOLS.has(tool)
                ? "cursor-crosshair"
                : "cursor-default",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (e.button !== 0) return;
          if (tool !== "select") return;
          const w = screenToWorld(e.clientX, e.clientY);
          const hit = hitBoardObjectAt(objectsRef.current, w.x, w.y);
          if (hit && (hit.type === "shape" || hit.type === "mind")) {
            e.preventDefault();
            e.stopPropagation();
            if (hit.type === "shape" && hit.showLabel === false) {
              patchWithHistory(hit.id, { showLabel: true } as Partial<FreeformObject>);
            }
            setSelected([hit.id]);
            setEditing(hit.id);
            return;
          }
          if (hit) return;
          if ((e.target as HTMLElement).closest("[data-board-object], [data-board-shape]")) return;
          const obj = fitDrop(createText(w.x, w.y, nextZ(objectsRef.current)), false);
          upsertWithHistory(obj);
          setSelected([obj.id]);
          setEditing(obj.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const items: ContextMenuItem[] = [
            {
              id: "paste",
              label: "Paste",
              hint: "⌘V",
              disabled: !clipboardRef.current?.objects.length,
              onSelect: () => pasteClipboard(),
            },
          ];
          if (selectedRef.current.length) {
            items.unshift(
              { id: "dup", label: "Duplicate", hint: "⌘D", onSelect: duplicateSelection },
              { id: "copy", label: "Copy", hint: "⌘C", onSelect: () => copySelection() },
              { type: "sep" },
            );
          }
          open(e, items);
        }}
      >
        <div
          data-board-dots
          className="pointer-events-none absolute inset-0"
          style={
            board.dotted
              ? {
                  backgroundImage:
                    "radial-gradient(circle, color-mix(in oklab, var(--color-ink) 18%, transparent) 1px, transparent 1px)",
                  backgroundSize: `${22 * cam.zoom}px ${22 * cam.zoom}px`,
                  backgroundPosition: `${cam.x}px ${cam.y}px`,
                }
              : undefined
          }
          aria-hidden
        />

        <div
          data-board-layer
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`,
            ["--board-zoom" as string]: String(cam.zoom),
          }}
        >
          <svg
            className="pointer-events-none absolute overflow-visible text-mute"
            style={{ left: 0, top: 0, width: 1, height: 1 }}
            aria-hidden
          >
            {connectorLinks.map((l) => (
              <line
                key={l.key}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="currentColor"
                strokeWidth={1.5 / cam.zoom}
                strokeOpacity={0.45}
              />
            ))}
            {draftPath && draftPath.length > 1 && (
              <path
                d={draftPath.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke={draftStroke}
                strokeWidth={inkTool === "highlighter" ? highlighterWidth : penWidth}
                strokeOpacity={inkTool === "highlighter" ? HIGHLIGHTER_OPACITY : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {draftShape && draftShape.w + draftShape.h > 2 && (
              <g transform={`translate(${draftShape.x}, ${draftShape.y})`}>
                <ShapeGraphic
                  preview
                  kind={shapeKind}
                  w={draftShape.w}
                  h={draftShape.h}
                  fill={shapeFill}
                  stroke={shapeStroke}
                  strokeWidth={shapeWidth}
                  strokeDash={shapeDash}
                />
              </g>
            )}
            {guides.map((g, i) =>
              g.axis === "x" ? (
                <line
                  key={`gx-${i}-${g.pos}`}
                  x1={g.pos}
                  y1={-4000}
                  x2={g.pos}
                  y2={4000}
                  stroke="currentColor"
                  className="text-ink"
                  strokeWidth={1 / cam.zoom}
                  strokeOpacity={0.35}
                />
              ) : (
                <line
                  key={`gy-${i}-${g.pos}`}
                  x1={-4000}
                  y1={g.pos}
                  x2={4000}
                  y2={g.pos}
                  stroke="currentColor"
                  className="text-ink"
                  strokeWidth={1 / cam.zoom}
                  strokeOpacity={0.35}
                />
              ),
            )}
            {marquee && marquee.w + marquee.h > 2 && (
              <rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.w}
                height={marquee.h}
                fill="currentColor"
                className="text-ink"
                fillOpacity={0.06}
                stroke="currentColor"
                strokeOpacity={0.4}
                strokeDasharray={`${4 / cam.zoom} ${3 / cam.zoom}`}
                strokeWidth={1 / cam.zoom}
              />
            )}
          </svg>

          {sorted.map((obj) => (
            <BoardObject
              key={obj.id}
              obj={obj}
              selected={selected.includes(obj.id)}
              editing={editing === obj.id}
              interactive={tool !== "draw" && tool !== "shape" && !spacePan && tool !== "pan"}
              onSelect={selectOne}
              onEdit={setEditing}
              onDragStart={onObjectDragStart}
              onResizeStart={onResizeStart}
              onRemove={(id) => {
                removeWithHistory(id);
                setSelected((s) => s.filter((x) => x !== id));
              }}
              onContextMenu={(e, obj) => {
                if (!selectedRef.current.includes(obj.id)) {
                  selectedRef.current = [obj.id];
                  setSelected([obj.id]);
                }
                const note =
                  obj.type === "mention" ? notes.find((n) => n.id === obj.noteId) : undefined;
                const items: ContextMenuItem[] = [
                  {
                    id: "open",
                    label: "Open page",
                    hidden: !note,
                    onSelect: () => note && openNote(note),
                  },
                  { id: "dup", label: "Duplicate", hint: "⌘D", onSelect: duplicateSelection },
                  { id: "copy", label: "Copy", hint: "⌘C", onSelect: () => copySelection() },
                  { type: "sep" },
                  { id: "front", label: "Bring to front", onSelect: bringFront },
                  { id: "forward", label: "Bring forward", hint: "⌘]", onSelect: bringForward },
                  { id: "backward", label: "Send backward", hint: "⌘[", onSelect: sendBackward },
                  { id: "back", label: "Send to back", onSelect: sendBack },
                  { type: "sep" },
                  {
                    id: "delete",
                    label: "Delete",
                    danger: true,
                    onSelect: () => {
                      for (const id of [...selectedRef.current]) removeWithHistory(id);
                      setSelected([]);
                    },
                  },
                ];
                open(e, items);
              }}
              onPatch={(id, patch) => {
                const target = board.objects.find((o) => o.id === id);
                const bag = patch as Record<string, unknown>;
                const isTextBody =
                  "text" in bag || "cells" in bag || "url" in bag || "title" in bag;
                if (target?.type === "mind" && typeof bag.text === "string") {
                  const fontSize =
                    typeof bag.fontSize === "number" ? bag.fontSize : (target.fontSize ?? 14);
                  patchWithHistory(
                    id,
                    {
                      ...patch,
                      h: mindNodeHeight(bag.text, fontSize),
                    } as Partial<FreeformObject>,
                    isTextBody && editing === id,
                  );
                  return;
                }
                patchWithHistory(id, patch, isTextBody && editing === id);
              }}
              onMindConnect={addMindChild}
            />
          ))}

          {mentionPos && (
            <div
              className="absolute z-50 w-80 rounded-lg border border-line bg-paper p-2 shadow-lg"
              style={{ left: mentionPos.x, top: mentionPos.y }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                className="klever-focus mb-2 w-full rounded-md border border-line bg-paper-2 px-2 py-1.5 text-sm"
                aria-label="Mention a page, database, or file"
                placeholder="@ page, database, or file…"
                value={mentionQ}
                onChange={(e) => setMentionQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMentionPos(null);
                  if (e.key === "Enter" && mentionHits[0]) {
                    const hit = mentionHits[0];
                    const obj = fitDrop(
                      createMention(
                        mentionPos.x,
                        mentionPos.y,
                        nextZ(board.objects),
                        hit.id,
                        hit.title,
                        hit.kind,
                      ),
                    );
                    upsertWithHistory(obj);
                    setSelected([obj.id]);
                    setMentionPos(null);
                  }
                }}
              />
              <ul className="max-h-64 overflow-y-auto">
                {mentionHits.map((hit) => {
                  const meta = KIND_META[hit.kind];
                  const Icon = meta.icon;
                  return (
                    <li key={`${hit.kind}:${hit.id}`}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-paper-2"
                        onClick={() => {
                          const obj = fitDrop(
                            createMention(
                              mentionPos.x,
                              mentionPos.y,
                              nextZ(board.objects),
                              hit.id,
                              hit.title,
                              hit.kind,
                            ),
                          );
                          upsertWithHistory(obj);
                          setSelected([obj.id]);
                          setMentionPos(null);
                        }}
                      >
                        <Icon size={12} strokeWidth={1.4} className="mt-1 shrink-0 text-mute" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm text-ink">{hit.title}</span>
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-faint">
                              {meta.label}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-faint">
                            {hit.path}
                          </span>
                          <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-mute">
                            {hit.snippet}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!mentionHits.length && (
                  <li className="px-2 py-2 font-mono text-[10px] text-faint">Nothing matches.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 md:bottom-auto md:left-3 md:top-1/2 md:translate-x-0 md:-translate-y-1/2">
          <BoardToolRail
            tool={tool}
            studio={studio}
            onTool={onToolClick}
            onStudio={setStudio}
            shape={
              <ShapeStudio
                kind={shapeKind}
                fill={shapeFill}
                stroke={shapeStroke}
                width={shapeWidth}
                dash={shapeDash}
                onKind={(k) => {
                  setShapeKind(k);
                  placeAt(nextPlacePos(), "shape", { shape: k });
                }}
                onFill={setShapeFill}
                onStroke={setShapeStroke}
                onWidth={setShapeWidth}
                onDash={setShapeDash}
              />
            }
            ink={
              <InkStudio
                tool={inkTool}
                color={strokeColor}
                width={activeWidth}
                swatches={strokeSwatches}
                minW={inkTool === "highlighter" ? 8 : 1}
                maxW={inkTool === "highlighter" ? 32 : 6}
                onTool={setInkTool}
                onColor={setStrokeColor}
                onWidth={(n) =>
                  inkTool === "highlighter" ? setHighlighterWidth(n) : setPenWidth(n)
                }
              />
            }
            sticky={
              <StickyStudio
                color={stickyColor}
                onColor={(id) => setStickyColor(id as FreeformStickyColor)}
              />
            }
          />
        </div>
        {hud && (
          <div className="absolute bottom-[4.75rem] left-1/2 z-20 -translate-x-1/2 md:bottom-4">
            {hud}
          </div>
        )}
        <div className="absolute right-3 top-3 z-20 md:bottom-4 md:right-4 md:top-auto">{viewHud}</div>
      </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear this board?"
          description="Every object and connection on this board is removed. You can undo with ⌘Z."
          confirmLabel="Clear board"
          onConfirm={() => {
            withHistory(() => clearBoard());
            setSelected([]);
            setConfirmClear(false);
          }}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
