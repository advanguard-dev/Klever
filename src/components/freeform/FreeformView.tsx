import { BoardObject } from "@/components/freeform/BoardObject";
import { useBoardHistory } from "@/components/freeform/board-history";
import {
  BOARD_FONTS,
  createImage,
  createLink,
  createMention,
  createMind,
  createPath,
  createSticky,
  createTable,
  createText,
  DEFAULT_HIGHLIGHT_COLOR,
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
  resizeTableCells,
  STICKY_COLORS,
  stickyContrastTextColor,
  STICKY_TEXT_SIZES,
  strokePickerHex,
  resolveStickyTextColor,
  tablePixelSize,
  TEXT_COLORS,
  TEXT_SIZES,
  textColorClass,
  textColorHex,
} from "@/components/freeform/board-model";
import { GhostButton, MonoLabel, TextButton, ToolbarBtn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { nid } from "@/lib/ids";
import { plainSnippet } from "@/lib/parse";
import { useApp } from "@/store";
import type {
  FreeformConnection,
  FreeformObject,
  FreeformStickyColor,
  FreeformTool,
  PageFont,
} from "@/types";
import {
  AtSign,
  Bold,
  Database,
  Eraser,
  File,
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
  StickyNote,
  Strikethrough,
  Table2,
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

const TOOLS: { id: FreeformTool; label: string; icon: typeof Type }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "text", label: "Write", icon: Type },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "sticky", label: "Sticky", icon: StickyNote },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "link", label: "Link", icon: Link2 },
  { id: "table", label: "Table", icon: Table2 },
  { id: "mind", label: "Mind map", icon: Network },
  { id: "mention", label: "Page @", icon: AtSign },
];

const MODE_TOOLS = new Set<FreeformTool>(["select", "pan", "draw"]);

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
      kind: "move";
      ids: string[];
      sx: number;
      sy: number;
      origins: Record<string, { x: number; y: number }>;
    }
  | { kind: "draw"; points: { x: number; y: number }[] }
  | { kind: "erase"; pushed: boolean }
  | null;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.5;

export function FreeformView() {
  const board = useApp((s) => s.board);
  const notes = useApp((s) => s.notes);
  const blobs = useApp((s) => s.blobs);
  const setBoard = useApp((s) => s.setBoard);
  const upsertBoardObject = useApp((s) => s.upsertBoardObject);
  const patchBoardObject = useApp((s) => s.patchBoardObject);
  const removeBoardObject = useApp((s) => s.removeBoardObject);
  const clearBoard = useApp((s) => s.clearBoard);
  const putBlob = useApp((s) => s.putBlob);

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
  /** When set, next object click toggles a connector from this id. */
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState>(null);
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
      if ((e.key === "Delete" || e.key === "Backspace") && selected.length && !editing) {
        if (inField(e.target)) return;
        withHistory(() => {
          selected.forEach(removeBoardObject);
        });
        setSelected([]);
      }
      if (e.key === "Escape") {
        setEditing(null);
        setMentionPos(null);
        setConnectFrom(null);
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
  }, [editing, history, removeBoardObject, selected, tool, withHistory]);

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
      (fileRef.current as HTMLInputElement & { __place?: { x: number; y: number } }).__place = world;
      fileRef.current?.click();
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

  const onPointerDown = (e: ReactPointerEvent) => {
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
    setSelected([]);
    setEditing(null);
    setMentionPos(null);
  };

  /** Select (arrow) tool — and any non-pan/draw mode — can move objects anytime. */
  const onObjectDragStart = (e: ReactPointerEvent, id: string) => {
    if (tool === "pan" || spacePan) return;
    if (tool === "draw") return;
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

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
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
    if (drag.kind === "erase") {
      const w = screenToWorld(e.clientX, e.clientY);
      eraseAt(w.x, w.y, drag);
      return;
    }
    if (drag.kind === "move") {
      const w = screenToWorld(e.clientX, e.clientY);
      const dx = w.x - drag.sx;
      const dy = w.y - drag.sy;
      for (const id of drag.ids) {
        const o = drag.origins[id];
        if (!o) continue;
        patchBoardObject(id, { x: o.x + dx, y: o.y + dy } as Partial<FreeformObject>);
      }
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === "pan") {
      persistCamera(cameraRef.current);
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
    setDraftPath(null);
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

  const selectedAny = useMemo(() => {
    if (selected.length !== 1) return null;
    return board.objects.find((x) => x.id === selected[0]) ?? null;
  }, [board.objects, selected]);

  const selectedTable = useMemo(() => {
    if (selected.length !== 1) return null;
    const o = board.objects.find((x) => x.id === selected[0]);
    return o?.type === "table" ? o : null;
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
    obj: Extract<FreeformObject, { type: "text" | "sticky" | "mind" }>,
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
        : (obj.type === "text" || obj.type === "mind" ? obj.color : undefined) ?? "ink";
    const size =
      obj.fontSize ?? (obj.type === "sticky" ? 14 : obj.type === "mind" ? 14 : 16);
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
      </>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-3 md:px-6">
        <div className="min-w-0">
          <MonoLabel>Mind mapping</MonoLabel>
          <h1 className="font-serif text-2xl italic tracking-tight text-ink md:text-3xl">Board</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <ToolbarBtn
            label="Undo"
            aria-label="Undo"
            disabled={!history.canUndo}
            onClick={() => history.undo()}
          >
            <Undo2 size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Redo"
            aria-label="Redo"
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
                active={tool === t.id}
                onClick={() => onToolClick(t.id)}
              >
                <Icon size={15} strokeWidth={1.4} />
              </ToolbarBtn>
            );
          })}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
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
          <GhostButton
            type="button"
            onClick={() => {
              withHistory(() => clearBoard());
              setSelected([]);
            }}
          >
            <Eraser size={14} strokeWidth={1.4} />
            Clear
          </GhostButton>
        </div>
      </div>

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

      {selectedAny && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
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
        </div>
      )}

      {selectedSticky && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
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
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
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
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Mind</span>
          {typographyStrip(selectedMind, {
            sizeKey: "fontSize",
            colorKey: "color",
            sizes: MIND_TEXT_SIZES,
            showParagraph: true,
          })}
        </div>
      )}

      {selectedTable && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Table</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-faint">Cols</span>
            <ToolbarBtn
              label="Fewer columns"
              onClick={() => {
                const cols = Math.max(1, selectedTable.cols - 1);
                const cells = resizeTableCells(selectedTable.cells, cols, selectedTable.rows);
                const size = tablePixelSize(cols, selectedTable.rows);
                patchWithHistory(selectedTable.id, {
                  cols,
                  cells,
                  w: size.w,
                  h: size.h,
                } as Partial<FreeformObject>);
              }}
            >
              <Minus size={14} strokeWidth={1.4} />
            </ToolbarBtn>
            <span className="min-w-5 text-center font-mono text-[11px] tabular-nums text-mute">
              {selectedTable.cols}
            </span>
            <ToolbarBtn
              label="More columns"
              onClick={() => {
                const cols = Math.min(12, selectedTable.cols + 1);
                const cells = resizeTableCells(selectedTable.cells, cols, selectedTable.rows);
                const size = tablePixelSize(cols, selectedTable.rows);
                patchWithHistory(selectedTable.id, {
                  cols,
                  cells,
                  w: size.w,
                  h: size.h,
                } as Partial<FreeformObject>);
              }}
            >
              <Plus size={14} strokeWidth={1.4} />
            </ToolbarBtn>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-faint">Rows</span>
            <ToolbarBtn
              label="Fewer rows"
              onClick={() => {
                const rows = Math.max(1, selectedTable.rows - 1);
                const cells = resizeTableCells(selectedTable.cells, selectedTable.cols, rows);
                const size = tablePixelSize(selectedTable.cols, rows);
                patchWithHistory(selectedTable.id, {
                  rows,
                  cells,
                  w: size.w,
                  h: size.h,
                } as Partial<FreeformObject>);
              }}
            >
              <Minus size={14} strokeWidth={1.4} />
            </ToolbarBtn>
            <span className="min-w-5 text-center font-mono text-[11px] tabular-nums text-mute">
              {selectedTable.rows}
            </span>
            <ToolbarBtn
              label="More rows"
              onClick={() => {
                const rows = Math.min(20, selectedTable.rows + 1);
                const cells = resizeTableCells(selectedTable.cells, selectedTable.cols, rows);
                const size = tablePixelSize(selectedTable.cols, rows);
                patchWithHistory(selectedTable.id, {
                  rows,
                  cells,
                  w: size.w,
                  h: size.h,
                } as Partial<FreeformObject>);
              }}
            >
              <Plus size={14} strokeWidth={1.4} />
            </ToolbarBtn>
          </div>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          <TextButton
            type="button"
            aria-pressed={!!selectedTable.headerRow}
            onClick={() =>
              patchWithHistory(selectedTable.id, {
                headerRow: !selectedTable.headerRow,
              } as Partial<FreeformObject>)
            }
          >
            Header {selectedTable.headerRow ? "on" : "off"}
          </TextButton>
        </div>
      )}

      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden bg-paper",
          effectivePan
            ? "cursor-grab active:cursor-grabbing"
            : tool === "draw"
              ? inkTool === "eraser"
                ? "cursor-cell"
                : "cursor-crosshair"
              : connectFrom
                ? "cursor-crosshair"
                : "cursor-default",
        )}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
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
          </svg>

          {sorted.map((obj) => (
            <BoardObject
              key={obj.id}
              obj={obj}
              selected={selected.includes(obj.id)}
              editing={editing === obj.id}
              interactive={tool !== "draw" && !spacePan && tool !== "pan"}
              onSelect={selectOne}
              onEdit={setEditing}
              onDragStart={onObjectDragStart}
              onRemove={(id) => {
                removeWithHistory(id);
                setSelected((s) => s.filter((x) => x !== id));
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

        <p className="pointer-events-none absolute bottom-3 left-4 max-w-[min(36rem,calc(100%-5rem))] font-mono text-[10px] leading-relaxed tracking-wide text-faint">
          Space / middle-drag / hand to pan · Scroll pans · Pinch or ⌃/⌘+scroll zooms · Shift+scroll
          pans · Select arrow drags objects · Delete removes · ⌘Z undo
        </p>
        <p className="pointer-events-none absolute bottom-3 right-4 font-mono text-[10px] tabular-nums tracking-wide text-faint">
          {zoomPct}%
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const place =
            (fileRef.current as HTMLInputElement & { __place?: { x: number; y: number } }).__place ??
            nextPlacePos();
          const path = `assets/board/${nid()}-${file.name.replace(/\s+/g, "-")}`;
          await putBlob(file, path, file.type);
          const obj = createImage(place.x, place.y, nextZ(board.objects), path, file.name);
          upsertWithHistory(obj);
          setSelected([obj.id]);
          setTool("select");
        }}
      />
    </div>
  );
}
