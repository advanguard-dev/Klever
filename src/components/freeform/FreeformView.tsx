import { BoardObject, ShapeGraphic } from "@/components/freeform/BoardObject";
import { BoardFloatingChrome } from "@/components/freeform/BoardFloatingChrome";
import { BoardMentionPicker } from "@/components/freeform/BoardMentionPicker";
import {
  BoardMoreMenu,
  BoardSearch,
  type BoardStudio,
} from "@/components/freeform/board-chrome";
import { exportBoardJson, exportBoardPng } from "@/components/freeform/board-export";
import { useBoardHistory } from "@/components/freeform/board-history";
import {
  buildImageObjects,
  fitDrop,
  readClipboardImageFiles,
  resolveImageFiles,
} from "@/components/freeform/board-io";
import {
  createImage,
  createLink,
  createMention,
  createMind,
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
  searchBoardObjects,
  STICKY_TEXT_SIZES,
  TEXT_SIZES,
} from "@/components/freeform/board-model";
import {
  GRID,
  hitBoardObjectAt,
  type AlignEdge,
  type Guide,
} from "@/components/freeform/board-ops";
import { INSERT_TOOLS, PLACE_TOOLS } from "@/components/freeform/board-pointer";
import {
  alignSelected,
  bringIdsFront,
  buildConnectorLinks,
  nudgeIdsZ,
  pasteFromClipboard,
  selectedOfType,
  sendIdsBack,
  snapshotSelection,
} from "@/components/freeform/board-selection";
import { useBoardHotkeys } from "@/components/freeform/useBoardHotkeys";
import { useBoardPointer } from "@/components/freeform/useBoardPointer";
import { searchVaultHits, type VaultHit } from "@/components/freeform/board-vault";
import { ConfirmDialog, EmptyState, MonoLabel, ToolbarBtn } from "@/components/ui";
import { TitleBar } from "@/components/layout/TitleBar";
import { useContextMenu } from "@/components/ContextMenu";
import type { ContextMenuItem } from "@/lib/context-menus";
import { openNote } from "@/components/editor/WikiPeek";
import { cn } from "@/lib/cn";
import { hasFileTransfer } from "@/lib/dnd";
import { isImageAsset } from "@/lib/assets";
import { filesFromFileList } from "@/lib/local-file-path";
import { nid } from "@/lib/ids";
import type { TableRange } from "@/lib/table-sheet";
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
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import type { FreeformPatch } from "@/lib/freeform-patch";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";


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
  const storeFileFromDrop = useApp((s) => s.storeFileFromDrop);
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
  const [tableRange, setTableRange] = useState<TableRange | null>(null);
  const clipboardRef = useRef<{
    objects: FreeformObject[];
    connections: FreeformConnection[];
  } | null>(null);
  const pasteNRef = useRef(0);
  const pasteFromOsRef = useRef<() => void>(() => {});

  const viewportRef = useRef<HTMLDivElement>(null);
  const imagePlaceRef = useRef<{ x: number; y: number } | null>(null);
  const onToolClickRef = useRef<(id: FreeformTool) => void>(() => {});
  const placeAtRef = useRef<(world: { x: number; y: number }, activeTool: FreeformTool) => void>(() => {});
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
    (id: string, patch: FreeformPatch, coalesceEdit = false) => {
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
    const snap = snapshotSelection(objectsRef.current, connectionsRef.current, selectedRef.current);
    if (!snap) return false;
    clipboardRef.current = snap;
    pasteNRef.current = 0;
    return true;
  }, []);

  const pasteClipboard = useCallback(
    (asDuplicate = false) => {
      const clip = clipboardRef.current;
      if (!clip?.objects.length) return;
      pasteNRef.current += 1;
      const pasted = pasteFromClipboard(
        clip,
        objectsRef.current,
        connectionsRef.current,
        pasteNRef.current,
      );
      if (!pasted) return;
      withHistory(() => {
        setBoard({ objects: pasted.objects, connections: pasted.connections });
      });
      setSelected(pasted.ids);
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
      const next = alignSelected(objectsRef.current, selectedRef.current, edge);
      if (!next) return;
      withHistory(() => {
        setBoard({ objects: next });
      });
    },
    [setBoard, withHistory],
  );

  const bringFront = useCallback(() => {
    const next = bringIdsFront(objectsRef.current, selectedRef.current);
    if (!next) return;
    withHistory(() => {
      setBoard({ objects: next });
    });
  }, [setBoard, withHistory]);

  const sendBack = useCallback(() => {
    const next = sendIdsBack(objectsRef.current, selectedRef.current);
    if (!next) return;
    withHistory(() => {
      setBoard({ objects: next });
    });
  }, [setBoard, withHistory]);

  const bringForward = useCallback(() => {
    const next = nudgeIdsZ(objectsRef.current, selectedRef.current, 1);
    if (!next) return;
    withHistory(() => {
      setBoard({ objects: next });
    });
  }, [setBoard, withHistory]);

  const sendBackward = useCallback(() => {
    const next = nudgeIdsZ(objectsRef.current, selectedRef.current, -1);
    if (!next) return;
    withHistory(() => {
      setBoard({ objects: next });
    });
  }, [setBoard, withHistory]);

  useBoardHotkeys({
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
  });

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

  const connectorLinks = useMemo(
    () => buildConnectorLinks(board.objects, board.connections),
    [board.objects, board.connections],
  );

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

  const placeImagePaths = (world: { x: number; y: number }, items: { path: string; name: string }[]) => {
    if (!items.length) return;
    const placed = buildImageObjects(world, items, nextZ(objectsRef.current));
    withHistory(() => {
      setBoard({ objects: [...objectsRef.current, ...placed] });
    });
    setSelected(placed.map((o) => o.id));
    setTool("select");
  };

  const placeImageFiles = async (world: { x: number; y: number }, files: File[]) => {
    const items = await resolveImageFiles(files, storeFileFromDrop);
    placeImagePaths(world, items);
  };

  const pasteOsImages = async (world: { x: number; y: number }) => {
    const files = await readClipboardImageFiles();
    if (files.length) await placeImageFiles(world, files);
  };

  pasteFromOsRef.current = () => {
    void pasteOsImages(nextPlacePos());
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
      setEditing(obj.id);
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

  placeAtRef.current = placeAt;

  const { onPointerDown, onPointerMove, onPointerUp, onObjectDragStart, onResizeStart } = useBoardPointer({
    viewportRef,
    objectsRef,
    connectionsRef,
    cameraRef,
    selectedRef,
    tool,
    spacePan,
    inkTool,
    penColor,
    highlighterColor,
    penWidth,
    highlighterWidth,
    shapeKind,
    shapeFill,
    shapeStroke,
    shapeWidth,
    shapeDash,
    connectFrom,
    pushHistory,
    upsertWithHistory,
    applyCameraLive,
    persistCamera,
    screenToWorld,
    placeAt: (world, activeTool) => placeAtRef.current(world, activeTool),
    setBoard,
    patchBoardObject,
    removeBoardObject,
    setSelected,
    setEditing,
    setMentionPos,
    setConnectFrom,
    setTool,
    setStudio,
    setDraftPath,
    setDraftShape,
    setGuides,
    setMarquee,
  });

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

  const mentionHits = useMemo(
    () => searchVaultHits(notes, blobs, mentionQ),
    [blobs, mentionQ, notes],
  );

  const selectedSticky = useMemo(
    () => selectedOfType(board.objects, selected, "sticky"),
    [board.objects, selected],
  );
  const selectedTextObj = useMemo(
    () => selectedOfType(board.objects, selected, "text") ?? undefined,
    [board.objects, selected],
  );
  const selectedMind = useMemo(
    () => selectedOfType(board.objects, selected, "mind"),
    [board.objects, selected],
  );
  const selectedShape = useMemo(
    () => selectedOfType(board.objects, selected, "shape"),
    [board.objects, selected],
  );
  const selectedTable = useMemo(
    () => selectedOfType(board.objects, selected, "table"),
    [board.objects, selected],
  );

  useEffect(() => {
    setTableRange(null);
  }, [selectedTable?.id]);

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

  const pickMention = (hit: VaultHit) => {
    if (!mentionPos) return;
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
  };

  const zoomFromCenter = (nextZoom: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, nextZoom, true);
  };

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
      {!board.objects.length && !(board.connections ?? []).length && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <EmptyState
            title="Blank board"
            description="Drop a page onto the blotter, or pick a tool and place something."
          />
        </div>
      )}
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
        onDragOver={(e) => {
          if (!hasFileTransfer(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          if (!hasFileTransfer(e)) return;
          const files = filesFromFileList(e.dataTransfer.files).filter((f) => isImageAsset(f.name, f.type));
          if (!files.length) return;
          e.preventDefault();
          e.stopPropagation();
          void placeImageFiles(screenToWorld(e.clientX, e.clientY), files);
        }}
        onDoubleClick={(e) => {
          if (e.button !== 0) return;
          if (tool !== "select") return;
          const w = screenToWorld(e.clientX, e.clientY);
          const hit = hitBoardObjectAt(objectsRef.current, w.x, w.y);
          if (hit && (hit.type === "shape" || hit.type === "mind" || hit.type === "table")) {
            e.preventDefault();
            e.stopPropagation();
            if (hit.type === "shape" && hit.showLabel === false) {
              patchWithHistory(hit.id, { showLabel: true });
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
              onSelect: () => {
                if (clipboardRef.current?.objects.length) pasteClipboard();
                else pasteFromOsRef.current();
              },
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
              onTableRange={obj.type === "table" && selected.includes(obj.id) ? setTableRange : undefined}
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
                    },
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
            <BoardMentionPicker
              pos={mentionPos}
              query={mentionQ}
              hits={mentionHits}
              onQuery={setMentionQ}
              onClose={() => setMentionPos(null)}
              onPick={pickMention}
            />
          )}
        </div>
      </div>

      <BoardFloatingChrome
        tool={tool}
        studio={studio}
        onTool={onToolClick}
        onStudio={setStudio}
        shapeKind={shapeKind}
        shapeFill={shapeFill}
        shapeStroke={shapeStroke}
        shapeWidth={shapeWidth}
        shapeDash={shapeDash}
        onShapeKind={setShapeKind}
        onShapeFill={setShapeFill}
        onShapeStroke={setShapeStroke}
        onShapeWidth={setShapeWidth}
        onShapeDash={setShapeDash}
        placeShape={(k) => placeAt(nextPlacePos(), "shape", { shape: k })}
        inkTool={inkTool}
        strokeColor={strokeColor}
        activeWidth={activeWidth}
        strokeSwatches={strokeSwatches}
        onInkTool={setInkTool}
        onStrokeColor={setStrokeColor}
        onStrokeWidth={(n) =>
          inkTool === "highlighter" ? setHighlighterWidth(n) : setPenWidth(n)
        }
        stickyColor={stickyColor}
        onStickyColor={setStickyColor}
        selectedCount={selected.length}
        selectedSticky={selectedSticky}
        selectedShape={selectedShape}
        selectedTable={selectedTable}
        selectedAny={selectedAny}
        typeObj={typeObj}
        typeSizes={typeSizes}
        typeColorKey={typeColorKey}
        tableRange={tableRange}
        connectFrom={connectFrom}
        onPatch={(id, patch) => patchWithHistory(id, patch)}
        onEdit={setEditing}
        onBringForward={bringForward}
        onBringFront={bringFront}
        onSendBackward={sendBackward}
        onSendBack={sendBack}
        onAlign={applyAlign}
        onConnectToggle={(id) =>
          setConnectFrom((cur) => (cur === id ? null : id))
        }
        onSetTool={setTool}
        zoomPct={zoomPct}
        minZoomPct={Math.round(ZOOM_MIN * 100)}
        maxZoomPct={Math.round(ZOOM_MAX * 100)}
        dotted={board.dotted}
        onZoomOut={() => zoomFromCenter(cam.zoom * 0.92)}
        onZoomReset={() => zoomFromCenter(1)}
        onZoomIn={() => zoomFromCenter(cam.zoom * 1.08)}
        onZoomPct={(pct) => zoomFromCenter(pct / 100)}
        onDots={() => setBoard({ dotted: !board.dotted })}
      />
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear this board?"
          description="Every object and connection on this board is removed. You can undo with ⌘Z."
          confirmLabel="Clear board"
          danger
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
