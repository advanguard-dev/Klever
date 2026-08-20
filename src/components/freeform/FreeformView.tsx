import { BoardObject } from "@/components/freeform/BoardObject";
import { exportBoardJson, exportBoardPng } from "@/components/freeform/board-export";
import { useBoardHistory } from "@/components/freeform/board-history";
import {
  BOARD_FONTS,
  createImage,
  createLink,
  createMention,
  createMind,
  createPath,
  createShape,
  createSticky,
  createTable,
  createText,
  DEFAULT_HIGHLIGHT_COLOR,
  defaultTextAlign,
  defaultTextVAlign,
  fillPickerHex,
  fillValue,
  findConnection,
  HIGHLIGHT_COLORS,
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_WIDTHS,
  hitPathObject,
  INK_COLORS,
  type InkTool,
  inkStrokeValue,
  insertParagraphBreak,
  MIND_TEXT_SIZES,
  mindNodeHeight,
  nextZ,
  pathBounds,
  PEN_WIDTHS,
  pointsToLocal,
  SHAPE_FILLS,
  SHAPE_KINDS,
  SHAPE_STROKE_WIDTHS,
  STICKY_COLORS,
  stickyContrastTextColor,
  STICKY_TEXT_SIZES,
  STROKE_DASHES,
  strokeDashArray,
  strokePickerHex,
  resolveStickyTextColor,
  TEXT_COLORS,
  TEXT_SIZES,
  textColorClass,
  textColorHex,
} from "@/components/freeform/board-model";
import {
  alignObjects,
  applyResizeToObject,
  boxesIntersect,
  cloneSelection,
  GRID,
  marqueeBox,
  PASTE_OFFSET,
  resizeBox,
  snapGroupMove,
  snapResizeBox,
  type AlignEdge,
  type Box,
  type Guide,
  type ResizeHandle,
} from "@/components/freeform/board-ops";
import { ConfirmDialog, GhostButton, MonoLabel, TextButton, ToolbarBtn } from "@/components/ui";
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
  PageFont,
  TextAlign,
  TextVAlign,
} from "@/types";
import {
  AtSign,
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowLeft,
  Bold,
  BringToFront,
  Check,
  ChevronDown,
  Database,
  Download,
  Eraser,
  File,
  FileJson,
  FileText,
  Hand,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  Minus,
  MousePointer2,
  Network,
  Pencil,
  Pilcrow,
  Plus,
  Redo2,
  SendToBack,
  Shapes,
  Square,
  Circle,
  Diamond,
  Triangle,
  StickyNote,
  Strikethrough,
  Table2,
  Trash2,
  Type,
  Undo2,
  Waypoints,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

const TOOLS: { id: FreeformTool; label: string; icon: typeof Type; shortcut: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "pan", label: "Pan", icon: Hand, shortcut: "H" },
  { id: "text", label: "Write", icon: Type, shortcut: "T" },
  { id: "draw", label: "Draw", icon: Pencil, shortcut: "P" },
  { id: "shape", label: "Shape", icon: Shapes, shortcut: "O" },
  { id: "sticky", label: "Sticky", icon: StickyNote, shortcut: "S" },
  { id: "image", label: "Image", icon: ImageIcon, shortcut: "I" },
  { id: "link", label: "Link", icon: Link2, shortcut: "L" },
  { id: "table", label: "Table", icon: Table2, shortcut: "B" },
  { id: "mind", label: "Mind map", icon: Network, shortcut: "M" },
  { id: "mention", label: "Page @", icon: AtSign, shortcut: "@" },
];

const TOOL_BY_KEY: Record<string, FreeformTool> = Object.fromEntries(
  TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id]),
) as Record<string, FreeformTool>;

const MODE_TOOLS = new Set<FreeformTool>(["select", "pan", "draw", "shape"]);

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

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.5;

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
  const boardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTitle(board?.title ?? "Board");
  }, [board?.id, board?.title]);

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

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextZoom: number, persist: boolean) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cam = cameraRef.current;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
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
      if (!mod && !e.altKey && !inField(e.target) && !editing && !e.repeat) {
        const next = TOOL_BY_KEY[e.key.toLowerCase()];
        if (next) {
          e.preventDefault();
          setMentionPos(null);
          setConnectFrom(null);
          setTool(next);
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
        setEditing(null);
        setMentionPos(null);
        setConnectFrom(null);
        setGuides([]);
        setMarquee(null);
        setTool("select");
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
    copySelection,
    duplicateSelection,
    editing,
    history,
    pasteClipboard,
    removeBoardObject,
    selected,
    setBoard,
    tool,
    withHistory,
  ]);

  useEffect(() => {
    editHistoryRef.current = false;
  }, [editing]);

  const sorted = useMemo(
    () => [...board.objects].sort((a, b) => a.z - b.z),
    [board.objects],
  );

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

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cam = cameraRef.current;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pinchZoom = e.ctrlKey || e.metaKey;
    const shiftPan = e.shiftKey;
    const trackpadPan = !pinchZoom && !shiftPan && Math.abs(e.deltaX) > 0.5;
    const mouseZoom = !pinchZoom && !shiftPan && !trackpadPan;

    if (pinchZoom || mouseZoom) {
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom * factor));
      const wx = (mx - cam.x) / cam.zoom;
      const wy = (my - cam.y) / cam.zoom;
      persistCamera({
        zoom: nextZoom,
        x: mx - wx * nextZoom,
        y: my - wy * nextZoom,
      });
      return;
    }

    persistCamera({
      ...cam,
      x: cam.x - e.deltaX,
      y: cam.y - e.deltaY,
    });
  };

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
    const el = viewportRef.current;
    const cam = cameraRef.current;
    const rect = el?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 240;
    const cy = rect ? rect.height / 2 : 180;
    const stack = placeStackRef.current % 10;
    placeStackRef.current += 1;
    const offset = stack * 28;
    return {
      x: (cx - cam.x) / cam.zoom - 110 + offset,
      y: (cy - cam.y) / cam.zoom - 40 + offset,
    };
  }, []);

  const placeAt = (world: { x: number; y: number }, activeTool: FreeformTool) => {
    const z = nextZ(board.objects);
    if (activeTool === "text") {
      const obj = createText(world.x, world.y, z);
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      setTool("select");
      return;
    }
    if (activeTool === "sticky") {
      const obj = createSticky(world.x, world.y, z, stickyColor);
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      setTool("select");
      return;
    }
    if (activeTool === "link") {
      const obj = createLink(world.x, world.y, z);
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      setTool("select");
      return;
    }
    if (activeTool === "table") {
      const obj = createTable(world.x, world.y, z);
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      setTool("select");
      return;
    }
    if (activeTool === "mind") {
      const parentId = selected.find((id) => board.objects.find((o) => o.id === id)?.type === "mind");
      const obj = createMind(world.x, world.y, z, parentId);
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      setTool("select");
      return;
    }
    if (activeTool === "mention") {
      setMentionPos(world);
      setMentionQ("");
      setTool("select");
      return;
    }
    if (activeTool === "image") {
      imagePlaceRef.current = world;
      void (async () => {
        const path = await linkLocalFile("image/*");
        if (!path) return;
        const place = imagePlaceRef.current ?? nextPlacePos();
        const name = path.split("/").pop() ?? path;
        const obj = createImage(place.x, place.y, nextZ(objectsRef.current), path, name);
        upsertWithHistory(obj);
        setSelected([obj.id]);
        setTool("select");
      })();
      setTool("select");
    }
  };

  const onToolClick = (id: FreeformTool) => {
    setMentionPos(null);
    setConnectFrom(null);
    if (MODE_TOOLS.has(id)) {
      setTool(id);
      return;
    }
    placeAt(nextPlacePos(), id);
  };

  const eraseAt = (wx: number, wy: number, drag: Extract<DragState, { kind: "erase" }>) => {
    const hit = [...objectsRef.current]
      .filter((o): o is Extract<FreeformObject, { type: "path" }> => o.type === "path")
      .reverse()
      .find((o) => hitPathObject(o, wx, wy));
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
      const w = screenToWorld(e.clientX, e.clientY);
      setSelected([]);
      setEditing(null);
      dragRef.current = { kind: "shape", x0: w.x, y0: w.y, x1: w.x, y1: w.y };
      setDraftShape({ x: w.x, y: w.y, w: 0, h: 0 });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
    if (tool !== "select") setTool("select");
    const ids = selectedRef.current.includes(id) ? selectedRef.current : [id];
    const origins: Record<string, { x: number; y: number }> = {};
    for (const oid of ids) {
      const o = objectsRef.current.find((x) => x.id === oid);
      if (o) origins[oid] = { x: o.x, y: o.y };
    }
    pushHistory();
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
    setTool("select");
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
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, drag.cam.zoom * (m.dist / drag.dist)));
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
      setDraftShape(marqueeBox(drag.x0, drag.y0, drag.x1, drag.y1));
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
      const rawDx = w.x - drag.sx;
      const rawDy = w.y - drag.sy;
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
      const box = marqueeBox(drag.x0, drag.y0, drag.x1, drag.y1);
      setDraftShape(null);
      const w = Math.max(24, box.w);
      const h = Math.max(24, box.h);
      const obj = createShape(
        box.w < 8 && box.h < 8 ? box.x - 80 : box.x,
        box.w < 8 && box.h < 8 ? box.y - 50 : box.y,
        box.w < 8 && box.h < 8 ? 160 : w,
        box.w < 8 && box.h < 8 ? 100 : h,
        nextZ(board.objects),
        { shape: shapeKind, fill: shapeFill, stroke: shapeStroke, strokeWidth: shapeWidth, strokeDash: shapeDash },
      );
      upsertWithHistory(obj);
      setSelected([obj.id]);
      setEditing(obj.id);
      return;
    }
    setDraftPath(null);
    setDraftShape(null);
  };

  const addMindChild = (parentId: string) => {
    const parent = board.objects.find((o) => o.id === parentId);
    if (!parent) return;
    const obj = createMind(parent.x + 40, parent.y + parent.h + 48, nextZ(board.objects), parentId);
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
  const strokeWidths = inkTool === "highlighter" ? HIGHLIGHTER_WIDTHS : PEN_WIDTHS;
  const activeWidth = inkTool === "highlighter" ? highlighterWidth : penWidth;
  const strokeColor = inkTool === "highlighter" ? highlighterColor : penColor;
  const setStrokeColor = inkTool === "highlighter" ? setHighlighterColor : setPenColor;
  const strokeSwatches = inkTool === "highlighter" ? HIGHLIGHT_COLORS : INK_COLORS;
  const draftStroke = inkStrokeValue(strokeColor);

  const ColorPickerBtn = ({
    value,
    onChange,
    label = "Custom color",
  }: {
    value: string;
    onChange: (hex: string) => void;
    label?: string;
  }) => {
    const hex = strokePickerHex(value);
    return (
      <label
        title={label}
        className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line"
        style={{ backgroundColor: hex }}
      >
        <span className="sr-only">{label}</span>
        <input
          type="color"
          value={hex}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  };

  const typographyStrip = (
    obj: Extract<FreeformObject, { type: "text" | "sticky" | "mind" | "shape" }>,
    opts: {
      sizeKey: "fontSize";
      colorKey: "color" | "textColor";
      sizes: readonly number[];
      showParagraph?: boolean;
    },
  ) => {
    const font = obj.fontFamily ?? "serif";
    const color =
      opts.colorKey === "textColor"
        ? (obj.type === "sticky" ? obj.textColor : undefined) ?? "ink"
        : (obj.type === "text" || obj.type === "mind" || obj.type === "shape" ? obj.color : undefined) ?? "ink";
    const size =
      obj.fontSize ?? (obj.type === "sticky" ? 14 : obj.type === "mind" || obj.type === "shape" ? 14 : 16);
    const pickerValue =
      opts.colorKey === "textColor" && obj.type === "sticky"
        ? resolveStickyTextColor(obj.textColor, obj.color).color
        : textColorHex(color);

    const applyTextPatch = (patch: Record<string, unknown>) => {
      if (obj.type === "mind" && typeof patch.text === "string") {
        const fontSize =
          typeof patch.fontSize === "number" ? patch.fontSize : (obj.fontSize ?? 14);
        patchWithHistory(obj.id, {
          ...patch,
          h: mindNodeHeight(patch.text, fontSize),
        } as Partial<FreeformObject>);
        return;
      }
      if (obj.type === "mind" && typeof patch.fontSize === "number") {
        patchWithHistory(obj.id, {
          ...patch,
          h: mindNodeHeight(obj.text, patch.fontSize),
        } as Partial<FreeformObject>);
        return;
      }
      patchWithHistory(obj.id, patch as Partial<FreeformObject>);
    };

    return (
      <>
        {opts.showParagraph !== false && (
          <>
            <ToolbarBtn
              label="Paragraph"
              showLabel
              aria-label="Insert paragraph break"
              onClick={() => {
                applyTextPatch({
                  text: insertParagraphBreak(obj.text),
                } as Partial<FreeformObject>);
                setEditing(obj.id);
              }}
            >
              <Pilcrow size={14} strokeWidth={1.5} />
            </ToolbarBtn>
            <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          </>
        )}
        <div className="flex items-center gap-1">
          {opts.sizes.map((s) => {
            const active = size === s;
            return (
              <button
                key={s}
                type="button"
                title={`${s}px`}
                aria-label={`Font size ${s}`}
                aria-pressed={active}
                className={cn(
                  "min-w-7 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-mute transition-colors",
                  "hover:bg-paper-2 hover:text-ink",
                  active && "bg-paper-2 text-ink ring-1 ring-ink/20",
                )}
                onClick={() => applyTextPatch({ fontSize: s } as Partial<FreeformObject>)}
              >
                {s}
              </button>
            );
          })}
        </div>
        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
        <div className="flex items-center gap-1">
          {TEXT_COLORS.map((c) => {
            const active = color === c.id;
            const sampleColor =
              opts.colorKey === "textColor" && obj.type === "sticky"
                ? resolveStickyTextColor(c.id, obj.color).color
                : undefined;
            return (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={active}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper font-serif text-sm",
                  !sampleColor && textColorClass(c.id),
                  active && "ring-2 ring-ink/25",
                )}
                style={sampleColor ? { color: sampleColor } : undefined}
                onClick={() =>
                  applyTextPatch({
                    [opts.colorKey]: c.id,
                  } as Partial<FreeformObject>)
                }
              >
                A
              </button>
            );
          })}
          <ColorPickerBtn
            value={pickerValue}
            label="Custom text color"
            onChange={(hex) =>
              applyTextPatch({
                [opts.colorKey]: hex,
              } as Partial<FreeformObject>)
            }
          />
        </div>
        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
        <div className="flex items-center gap-1">
          {BOARD_FONTS.map((f) => {
            const active = font === f.id;
            return (
              <button
                key={f.id}
                type="button"
                title={f.label}
                aria-label={f.label}
                aria-pressed={active}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] text-mute transition-colors hover:bg-paper-2 hover:text-ink",
                  f.className,
                  active && "bg-paper-2 text-ink ring-1 ring-ink/20",
                )}
                onClick={() =>
                  applyTextPatch({ fontFamily: f.id as PageFont } as Partial<FreeformObject>)
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
        <div className="flex items-center gap-0.5">
          {(
            [
              { key: "bold" as const, label: "Bold", icon: Bold, on: !!obj.bold },
              { key: "italic" as const, label: "Italic", icon: Italic, on: !!obj.italic },
              { key: "strike" as const, label: "Strikethrough", icon: Strikethrough, on: !!obj.strike },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <ToolbarBtn
                key={t.key}
                label={t.label}
                aria-label={t.label}
                active={t.on}
                onClick={() =>
                  applyTextPatch({ [t.key]: !t.on } as Partial<FreeformObject>)
                }
              >
                <Icon size={14} strokeWidth={1.5} />
              </ToolbarBtn>
            );
          })}
        </div>
        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
        <div className="flex items-center gap-0.5">
          {(
            [
              { id: "left" as const, label: "Align left", icon: AlignLeft },
              { id: "center" as const, label: "Align center", icon: AlignCenter },
              { id: "right" as const, label: "Align right", icon: AlignRight },
            ] as const
          ).map((a) => {
            const Icon = a.icon;
            const on = (obj.align ?? defaultTextAlign(obj.type)) === a.id;
            return (
              <ToolbarBtn
                key={a.id}
                label={a.label}
                aria-label={a.label}
                active={on}
                onClick={() => applyTextPatch({ align: a.id as TextAlign })}
              >
                <Icon size={14} strokeWidth={1.5} />
              </ToolbarBtn>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5">
          {(
            [
              { id: "top" as const, label: "Align top", icon: AlignVerticalJustifyStart },
              { id: "middle" as const, label: "Align middle", icon: AlignVerticalJustifyCenter },
              { id: "bottom" as const, label: "Align bottom", icon: AlignVerticalJustifyEnd },
            ] as const
          ).map((a) => {
            const Icon = a.icon;
            const on = (obj.valign ?? defaultTextVAlign(obj.type)) === a.id;
            return (
              <ToolbarBtn
                key={a.id}
                label={a.label}
                aria-label={a.label}
                active={on}
                onClick={() => applyTextPatch({ valign: a.id as TextVAlign })}
              >
                <Icon size={14} strokeWidth={1.5} />
              </ToolbarBtn>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TitleBar className="flex-wrap py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:py-3 md:pl-6 md:pr-6">
        <div className="flex min-w-0 items-center gap-2">
          <ToolbarBtn label="Vault" showLabel onClick={() => leaveBoard()}>
            <ArrowLeft size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
          <div className="relative min-w-0" ref={boardMenuRef}>
            <div className="flex min-w-0 items-center rounded-xl border border-line bg-paper">
              <input
                value={draftTitle}
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
                className="min-w-[7rem] max-w-[14rem] truncate bg-transparent px-3 py-1.5 font-serif text-base italic tracking-tight text-ink outline-none placeholder:text-faint"
              />
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={boardMenu}
                aria-label="Switch board"
                title="Switch board"
                className={cn(
                  "inline-flex h-full items-center gap-1 border-l border-line px-2.5 py-1.5 font-serif text-sm text-mute transition-colors duration-150",
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
                className="absolute left-0 top-full z-40 mt-1 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.35)]"
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
                          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left font-serif text-sm transition-colors",
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
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-serif text-sm text-mute hover:bg-paper-2 hover:text-ink"
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
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <ToolbarBtn
                key={t.id}
                label={t.label}
                aria-label={t.label}
                shortcut={t.shortcut}
                active={tool === t.id}
                onClick={() => onToolClick(t.id)}
              >
                <Icon size={15} strokeWidth={1.4} />
              </ToolbarBtn>
            );
          })}
        </div>
      </TitleBar>

      {tool === "draw" && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Ink</span>
          <div className="flex items-center gap-0.5">
            {(
              [
                { id: "pen" as const, label: "Pen", icon: Pencil },
                { id: "highlighter" as const, label: "Highlighter", icon: Highlighter },
                { id: "eraser" as const, label: "Eraser", icon: Eraser },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <ToolbarBtn
                  key={t.id}
                  label={t.label}
                  showLabel
                  active={inkTool === t.id}
                  onClick={() => setInkTool(t.id)}
                >
                  <Icon size={14} strokeWidth={1.4} />
                </ToolbarBtn>
              );
            })}
          </div>
          {inkTool !== "eraser" && (
            <>
              <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
              <div className="flex items-center gap-1">
                {strokeSwatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={strokeColor === c.id}
                    className={cn(
                      "h-6 w-6 rounded-md border border-line",
                      c.swatch,
                      strokeColor === c.id && "ring-2 ring-ink/25",
                    )}
                    onClick={() => setStrokeColor(c.id)}
                  />
                ))}
                <ColorPickerBtn
                  value={strokeColor}
                  label={inkTool === "highlighter" ? "Custom highlight" : "Custom ink"}
                  onChange={(hex) => setStrokeColor(hex)}
                />
              </div>
              <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
              <div className="flex items-center gap-1">
                {strokeWidths.map((w) => (
                  <button
                    key={w}
                    type="button"
                    title={`${w}px`}
                    aria-label={`Stroke ${w}`}
                    aria-pressed={activeWidth === w}
                    className={cn(
                      "flex h-7 w-8 items-center justify-center rounded-md border border-line",
                      activeWidth === w ? "bg-paper-2 ring-1 ring-ink/20" : "hover:bg-paper-2",
                    )}
                    onClick={() =>
                      inkTool === "highlighter" ? setHighlighterWidth(w) : setPenWidth(w)
                    }
                  >
                    <span
                      className="rounded-full bg-ink"
                      style={{
                        width: Math.min(18, w + 4),
                        height: Math.min(8, w),
                        backgroundColor:
                          inkTool === "highlighter"
                            ? strokePickerHex(highlighterColor)
                            : undefined,
                        opacity: inkTool === "highlighter" ? HIGHLIGHTER_OPACITY + 0.25 : 1,
                      }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tool === "shape" && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Shape</span>
          <div className="flex items-center gap-0.5">
            {SHAPE_KINDS.map((k) => {
              const Icon = { rect: Square, ellipse: Circle, diamond: Diamond, triangle: Triangle }[k.id];
              return (
                <ToolbarBtn
                  key={k.id}
                  label={k.label}
                  active={shapeKind === k.id}
                  onClick={() => setShapeKind(k.id)}
                >
                  <Icon size={14} strokeWidth={1.4} />
                </ToolbarBtn>
              );
            })}
          </div>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Fill</span>
          <div className="flex items-center gap-1">
            {SHAPE_FILLS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={shapeFill === c.id}
                className={cn(
                  "relative h-6 w-6 overflow-hidden rounded-md border border-line",
                  c.swatch,
                  shapeFill === c.id && "ring-2 ring-ink/25",
                )}
                onClick={() => setShapeFill(c.id)}
              >
                {c.id === "none" && (
                  <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-ink/40" />
                )}
              </button>
            ))}
            <ColorPickerBtn value={fillPickerHex(shapeFill)} label="Custom fill" onChange={setShapeFill} />
          </div>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Stroke</span>
          <div className="flex items-center gap-1">
            {INK_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={shapeStroke === c.id}
                className={cn(
                  "h-6 w-6 rounded-md border border-line",
                  c.swatch,
                  shapeStroke === c.id && "ring-2 ring-ink/25",
                )}
                onClick={() => setShapeStroke(c.id)}
              />
            ))}
            <ColorPickerBtn value={shapeStroke} label="Custom stroke" onChange={setShapeStroke} />
          </div>
          <div className="flex items-center gap-1">
            {SHAPE_STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                title={`${w}px`}
                aria-label={`Stroke ${w}`}
                aria-pressed={shapeWidth === w}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded-md border border-line",
                  shapeWidth === w ? "bg-paper-2 ring-1 ring-ink/20" : "hover:bg-paper-2",
                )}
                onClick={() => setShapeWidth(w)}
              >
                <span className="rounded-full bg-ink" style={{ width: 14, height: Math.max(1, w) }} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {STROKE_DASHES.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.label}
                aria-pressed={shapeDash === d.id}
                className={cn(
                  "h-7 rounded-md border border-line px-2 font-mono text-[10px] uppercase tracking-wide",
                  shapeDash === d.id ? "bg-paper-2 text-ink ring-1 ring-ink/20" : "text-mute hover:bg-paper-2",
                )}
                onClick={() => setShapeDash(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 touch-none overflow-hidden bg-paper",
          effectivePan
            ? "cursor-grab active:cursor-grabbing"
            : tool === "draw"
              ? inkTool === "eraser"
                ? "cursor-cell"
                : "cursor-crosshair"
              : tool === "shape" || connectFrom
                ? "cursor-crosshair"
                : "cursor-default",
        )}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
          style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})` }}
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
                strokeWidth={1.5}
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
              <DraftShape
                kind={shapeKind}
                x={draftShape.x}
                y={draftShape.y}
                w={draftShape.w}
                h={draftShape.h}
                fill={shapeFill}
                stroke={shapeStroke}
                strokeWidth={shapeWidth}
                strokeDash={shapeDash}
              />
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
                  strokeWidth={1}
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
                  strokeWidth={1}
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
                strokeDasharray="4 3"
                strokeWidth={1}
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
              className="absolute z-50 w-80 rounded-xl border border-line bg-paper p-2 shadow-sm"
              style={{ left: mentionPos.x, top: mentionPos.y }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                className="mb-2 w-full rounded-md border border-line bg-paper-2 px-2 py-1.5 font-serif text-sm outline-none"
                placeholder="@ page, database, or file…"
                value={mentionQ}
                onChange={(e) => setMentionQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMentionPos(null);
                  if (e.key === "Enter" && mentionHits[0]) {
                    const hit = mentionHits[0];
                    const obj = createMention(
                      mentionPos.x,
                      mentionPos.y,
                      nextZ(board.objects),
                      hit.id,
                      hit.title,
                      hit.kind,
                    );
                    upsertWithHistory(obj);
                    setSelected([obj.id]);
                    setMentionPos(null);
                    setTool("select");
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
                          const obj = createMention(
                            mentionPos.x,
                            mentionPos.y,
                            nextZ(board.objects),
                            hit.id,
                            hit.title,
                            hit.kind,
                          );
                          upsertWithHistory(obj);
                          setSelected([obj.id]);
                          setMentionPos(null);
                          setTool("select");
                        }}
                      >
                        <Icon size={12} strokeWidth={1.4} className="mt-1 shrink-0 text-mute" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-serif text-sm text-ink">{hit.title}</span>
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-faint">
                              {meta.label}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-faint">
                            {hit.path}
                          </span>
                          <span className="mt-1 line-clamp-2 font-serif text-[12px] leading-snug text-mute">
                            {hit.snippet}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!mentionHits.length && (
                  <li className="px-2 py-2 font-mono text-[10px] text-faint">No matching vault items</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex max-h-[42vh] shrink-0 flex-col overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] md:max-h-none md:overflow-visible md:pb-0">
      {selected.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Arrange</span>
          <ToolbarBtn label="Bring front" onClick={bringFront}>
            <BringToFront size={14} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn label="Send back" onClick={sendBack}>
            <SendToBack size={14} strokeWidth={1.4} />
          </ToolbarBtn>
          {selected.length > 1 && (
            <>
              <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Align</span>
              {(
                [
                  { edge: "left" as const, label: "Align left", icon: AlignStartVertical },
                  { edge: "center" as const, label: "Align center", icon: AlignCenterVertical },
                  { edge: "right" as const, label: "Align right", icon: AlignEndVertical },
                  { edge: "top" as const, label: "Align top", icon: AlignStartHorizontal },
                  { edge: "middle" as const, label: "Align middle", icon: AlignCenterHorizontal },
                  { edge: "bottom" as const, label: "Align bottom", icon: AlignEndHorizontal },
                ] as const
              ).map((a) => {
                const Icon = a.icon;
                return (
                  <ToolbarBtn key={a.edge} label={a.label} onClick={() => applyAlign(a.edge)}>
                    <Icon size={14} strokeWidth={1.4} />
                  </ToolbarBtn>
                );
              })}
            </>
          )}
          {selectedAny && (
            <>
              <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Link</span>
              <ToolbarBtn
                label={connectFrom === selectedAny.id ? "Click target…" : "Connect"}
                showLabel
                active={connectFrom === selectedAny.id}
                onClick={() => {
                  setTool("select");
                  setConnectFrom((cur) => (cur === selectedAny.id ? null : selectedAny.id));
                }}
              >
                <Waypoints size={14} strokeWidth={1.4} />
              </ToolbarBtn>
              {connectFrom === selectedAny.id && (
                <span className="font-serif text-sm text-mute">
                  Click another object to connect (or again to unlink). Esc cancels.
                </span>
              )}
            </>
          )}
        </div>
      )}

      {selectedSticky && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Sticky</span>
          <div className="flex items-center gap-1">
            {STICKY_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                className={cn(
                  "h-6 w-6 rounded-md border border-line",
                  c.bg,
                  selectedSticky.color === c.id && "ring-2 ring-ink/25",
                )}
                onClick={() => {
                  setStickyColor(c.id);
                  patchWithHistory(selectedSticky.id, {
                    color: c.id,
                    textColor: stickyContrastTextColor(c.id),
                  } as Partial<FreeformObject>);
                }}
              />
            ))}
          </div>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          {typographyStrip(selectedSticky, {
            sizeKey: "fontSize",
            colorKey: "textColor",
            sizes: STICKY_TEXT_SIZES,
            showParagraph: true,
          })}
        </div>
      )}

      {selectedTextObj && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Text</span>
          {typographyStrip(selectedTextObj, {
            sizeKey: "fontSize",
            colorKey: "color",
            sizes: TEXT_SIZES,
            showParagraph: true,
          })}
        </div>
      )}

      {selectedMind && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Mind</span>
          {typographyStrip(selectedMind, {
            sizeKey: "fontSize",
            colorKey: "color",
            sizes: MIND_TEXT_SIZES,
            showParagraph: true,
          })}
        </div>
      )}

      {selectedShape && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Shape</span>
          <div className="flex items-center gap-0.5">
            {SHAPE_KINDS.map((k) => {
              const Icon = { rect: Square, ellipse: Circle, diamond: Diamond, triangle: Triangle }[k.id];
              return (
                <ToolbarBtn
                  key={k.id}
                  label={k.label}
                  active={selectedShape.shape === k.id}
                  onClick={() => {
                    setShapeKind(k.id);
                    patchWithHistory(selectedShape.id, { shape: k.id } as Partial<FreeformObject>);
                  }}
                >
                  <Icon size={14} strokeWidth={1.4} />
                </ToolbarBtn>
              );
            })}
          </div>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          <div className="flex items-center gap-1">
            {SHAPE_FILLS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                className={cn(
                  "relative h-6 w-6 overflow-hidden rounded-md border border-line",
                  c.swatch,
                  selectedShape.fill === c.id && "ring-2 ring-ink/25",
                )}
                onClick={() => {
                  setShapeFill(c.id);
                  patchWithHistory(selectedShape.id, { fill: c.id } as Partial<FreeformObject>);
                }}
              >
                {c.id === "none" && (
                  <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-ink/40" />
                )}
              </button>
            ))}
            <ColorPickerBtn
              value={fillPickerHex(selectedShape.fill)}
              label="Custom fill"
              onChange={(hex) => {
                setShapeFill(hex);
                patchWithHistory(selectedShape.id, { fill: hex } as Partial<FreeformObject>);
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            {INK_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                className={cn(
                  "h-6 w-6 rounded-md border border-line",
                  c.swatch,
                  selectedShape.stroke === c.id && "ring-2 ring-ink/25",
                )}
                onClick={() => {
                  setShapeStroke(c.id);
                  patchWithHistory(selectedShape.id, { stroke: c.id } as Partial<FreeformObject>);
                }}
              />
            ))}
            <ColorPickerBtn
              value={selectedShape.stroke}
              label="Custom stroke"
              onChange={(hex) => {
                setShapeStroke(hex);
                patchWithHistory(selectedShape.id, { stroke: hex } as Partial<FreeformObject>);
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            {SHAPE_STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                title={`${w}px`}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded-md border border-line",
                  selectedShape.strokeWidth === w ? "bg-paper-2 ring-1 ring-ink/20" : "hover:bg-paper-2",
                )}
                onClick={() => {
                  setShapeWidth(w);
                  patchWithHistory(selectedShape.id, { strokeWidth: w } as Partial<FreeformObject>);
                }}
              >
                <span className="rounded-full bg-ink" style={{ width: 14, height: Math.max(1, w) }} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {STROKE_DASHES.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.label}
                className={cn(
                  "h-7 rounded-md border border-line px-2 font-mono text-[10px] uppercase tracking-wide",
                  selectedShape.strokeDash === d.id
                    ? "bg-paper-2 text-ink ring-1 ring-ink/20"
                    : "text-mute hover:bg-paper-2",
                )}
                onClick={() => {
                  setShapeDash(d.id);
                  patchWithHistory(selectedShape.id, { strokeDash: d.id } as Partial<FreeformObject>);
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          {typographyStrip(selectedShape, {
            sizeKey: "fontSize",
            colorKey: "color",
            sizes: STICKY_TEXT_SIZES,
            showParagraph: true,
          })}
        </div>
      )}
      </div>

      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-6 md:pb-2"
        aria-label="Board settings"
      >
        <MonoLabel>View</MonoLabel>
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-paper px-0.5">
          <ToolbarBtn
            label="Zoom out"
            aria-label="Zoom out"
            onClick={() => {
              const el = viewportRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              zoomAt(r.left + r.width / 2, r.top + r.height / 2, cam.zoom * 0.92, true);
            }}
          >
            <Minus size={14} strokeWidth={1.4} />
          </ToolbarBtn>
          <button
            type="button"
            title="Reset zoom to 100%"
            className="min-w-[3.25rem] px-1 font-mono text-[11px] tabular-nums text-mute hover:text-ink"
            onClick={() => {
              const el = viewportRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1, true);
            }}
          >
            {zoomPct}%
          </button>
          <ToolbarBtn
            label="Zoom in"
            aria-label="Zoom in"
            onClick={() => {
              const el = viewportRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              zoomAt(r.left + r.width / 2, r.top + r.height / 2, cam.zoom * 1.08, true);
            }}
          >
            <Plus size={14} strokeWidth={1.4} />
          </ToolbarBtn>
        </div>
        <TextButton
          type="button"
          onClick={() => setBoard({ dotted: !board.dotted })}
          aria-pressed={board.dotted}
        >
          Dots {board.dotted ? "on" : "off"}
        </TextButton>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <GhostButton
            type="button"
            onClick={() => {
              if (!board.objects.length && !(board.connections ?? []).length) return;
              setConfirmClear(true);
            }}
          >
            <Eraser size={14} strokeWidth={1.4} />
            Clear
          </GhostButton>
          <ToolbarBtn label="Export PNG" onClick={() => void exportBoardPng(board, blobs)}>
            <Download size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn label="Export JSON" onClick={() => exportBoardJson(board)}>
            <FileJson size={15} strokeWidth={1.4} />
          </ToolbarBtn>
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

function DraftShape({
  kind,
  x,
  y,
  w,
  h,
  fill,
  stroke,
  strokeWidth,
  strokeDash,
}: {
  kind: FreeformShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDash: FreeformStrokeDash;
}) {
  const pad = strokeWidth / 2;
  const fillPaint = fillValue(fill);
  const strokePaint = inkStrokeValue(stroke);
  const dash = strokeDashArray(strokeDash);
  const common = {
    fill: fillPaint === "transparent" ? "none" : fillPaint,
    fillOpacity: fillPaint === "transparent" ? 0.08 : 0.55,
    stroke: strokePaint,
    strokeWidth,
    strokeDasharray: dash,
    strokeOpacity: 0.85,
  };
  if (kind === "ellipse") {
    return (
      <ellipse
        cx={x + w / 2}
        cy={y + h / 2}
        rx={Math.max(0, w / 2 - pad)}
        ry={Math.max(0, h / 2 - pad)}
        {...common}
      />
    );
  }
  if (kind === "diamond") {
    return (
      <polygon
        points={`${x + w / 2},${y + pad} ${x + w - pad},${y + h / 2} ${x + w / 2},${y + h - pad} ${x + pad},${y + h / 2}`}
        {...common}
      />
    );
  }
  if (kind === "triangle") {
    return (
      <polygon
        points={`${x + w / 2},${y + pad} ${x + w - pad},${y + h - pad} ${x + pad},${y + h - pad}`}
        {...common}
      />
    );
  }
  return (
    <rect x={x + pad} y={y + pad} width={Math.max(0, w - strokeWidth)} height={Math.max(0, h - strokeWidth)} {...common} />
  );
}
