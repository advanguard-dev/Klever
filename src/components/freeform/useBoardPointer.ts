import type { BoardStudio } from "@/components/freeform/board-chrome";
import { fitDrop } from "@/components/freeform/board-io";
import {
  clampZoom,
  createPath,
  createShape,
  DROP,
  HIGHLIGHTER_OPACITY,
  hitPathObject,
  nextZ,
  pathBounds,
  pointsToLocal,
  type InkTool,
} from "@/components/freeform/board-model";
import {
  applyResizeToObject,
  boxesIntersect,
  cloneSelection,
  GRID,
  marqueeBox,
  resizeBox,
  shapeDraftBox,
  snapGroupMove,
  snapResizeBox,
  type Box,
  type Guide,
  type ResizeHandle,
} from "@/components/freeform/board-ops";
import {
  PLACE_TOOLS,
  pinchOf,
  type DragState,
} from "@/components/freeform/board-pointer";
import type {
  FreeformConnection,
  FreeformObject,
  FreeformShapeKind,
  FreeformStrokeDash,
  FreeformTool,
} from "@/types";
import type { FreeformPatch } from "@/lib/freeform-patch";
import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";

export type BoardPointerCamera = { x: number; y: number; zoom: number };

export type UseBoardPointerArgs = {
  viewportRef: RefObject<HTMLDivElement | null>;
  objectsRef: MutableRefObject<FreeformObject[]>;
  connectionsRef: MutableRefObject<FreeformConnection[]>;
  cameraRef: MutableRefObject<BoardPointerCamera>;
  selectedRef: MutableRefObject<string[]>;
  tool: FreeformTool;
  spacePan: boolean;
  inkTool: InkTool;
  penColor: string;
  highlighterColor: string;
  penWidth: number;
  highlighterWidth: number;
  shapeKind: FreeformShapeKind;
  shapeFill: string;
  shapeStroke: string;
  shapeWidth: number;
  shapeDash: FreeformStrokeDash;
  connectFrom: string | null;
  pushHistory: () => void;
  upsertWithHistory: (obj: FreeformObject) => void;
  applyCameraLive: (cam: BoardPointerCamera) => void;
  persistCamera: (cam: BoardPointerCamera) => void;
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  placeAt: (world: { x: number; y: number }, activeTool: FreeformTool) => void;
  setBoard: (patch: {
    objects?: FreeformObject[];
    connections?: FreeformConnection[];
  }) => void;
  patchBoardObject: (id: string, patch: FreeformPatch) => void;
  removeBoardObject: (id: string) => void;
  setSelected: Dispatch<SetStateAction<string[]>>;
  setEditing: Dispatch<SetStateAction<string | null>>;
  setMentionPos: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setConnectFrom: Dispatch<SetStateAction<string | null>>;
  setTool: Dispatch<SetStateAction<FreeformTool>>;
  setStudio: Dispatch<SetStateAction<BoardStudio>>;
  setDraftPath: Dispatch<SetStateAction<{ x: number; y: number }[] | null>>;
  setDraftShape: Dispatch<SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
  setGuides: Dispatch<SetStateAction<Guide[]>>;
  setMarquee: Dispatch<SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
};

export function useBoardPointer(args: UseBoardPointerArgs) {
  const dragRef = useRef<DragState>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const argsRef = useRef(args);
  argsRef.current = args;

  const eraseAt = useCallback(
    (wx: number, wy: number, drag: Extract<DragState, { kind: "erase" }>) => {
      const a = argsRef.current;
      const hit = [...a.objectsRef.current]
        .filter((o): o is Extract<FreeformObject, { type: "path" }> => o.type === "path")
        .reverse()
        .find((o) => hitPathObject(o, wx, wy, 10 / a.cameraRef.current.zoom));
      if (!hit) return;
      if (!drag.pushed) {
        a.pushHistory();
        drag.pushed = true;
      }
      a.removeBoardObject(hit.id);
      a.setSelected((s) => s.filter((x) => x !== hit.id));
    },
    [],
  );

  const startPinch = useCallback((pointerId: number) => {
    const a = argsRef.current;
    const m = pinchOf(pointersRef.current);
    if (!m) return false;
    dragRef.current = {
      kind: "pinch",
      dist: m.dist,
      mx: m.mx,
      my: m.my,
      cam: { ...a.cameraRef.current },
    };
    a.setMarquee(null);
    a.setDraftPath(null);
    a.setDraftShape(null);
    a.setGuides([]);
    try {
      a.viewportRef.current?.setPointerCapture(pointerId);
    } catch {
      /* already captured */
    }
    return true;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const a = argsRef.current;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size >= 2) {
        e.preventDefault();
        startPinch(e.pointerId);
        return;
      }
      if (e.button === 1 || e.button === 2 || a.tool === "pan" || a.spacePan) {
        if (e.button === 2) e.preventDefault();
        e.preventDefault();
        const cam = a.cameraRef.current;
        dragRef.current = { kind: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      if (a.tool === "draw") {
        const w = a.screenToWorld(e.clientX, e.clientY);
        if (a.inkTool === "eraser") {
          dragRef.current = { kind: "erase", pushed: false };
          eraseAt(w.x, w.y, dragRef.current);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
        dragRef.current = { kind: "draw", points: [w] };
        a.setDraftPath([w]);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      if (a.tool === "shape") {
        a.setStudio(null);
        a.setTool("select");
        a.setDraftShape(null);
        a.setSelected([]);
        a.setEditing(null);
        return;
      }
      if (PLACE_TOOLS.has(a.tool) && e.button === 0) {
        e.preventDefault();
        const w = a.screenToWorld(e.clientX, e.clientY);
        a.placeAt(w, a.tool);
        return;
      }
      if (a.connectFrom) {
        a.setConnectFrom(null);
        a.setSelected([]);
        a.setEditing(null);
        return;
      }
      a.setSelected([]);
      a.setEditing(null);
      a.setMentionPos(null);
      if (a.tool === "select" && e.button === 0) {
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          const cam = a.cameraRef.current;
          dragRef.current = { kind: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
        const w = a.screenToWorld(e.clientX, e.clientY);
        dragRef.current = { kind: "marquee", x0: w.x, y0: w.y, x1: w.x, y1: w.y };
        a.setMarquee({ x: w.x, y: w.y, w: 0, h: 0 });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [eraseAt, startPinch],
  );

  /** Select (arrow) tool — and any non-pan/draw mode — can move objects anytime. */
  const onObjectDragStart = useCallback(
    (e: ReactPointerEvent, id: string) => {
      const a = argsRef.current;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size >= 2) {
        startPinch(e.pointerId);
        return;
      }
      if (a.tool === "pan" || a.spacePan) return;
      if (a.tool === "draw" || a.tool === "shape") return;
      let ids = a.selectedRef.current.includes(id) ? a.selectedRef.current : [id];
      let origins: Record<string, { x: number; y: number }> = {};
      a.pushHistory();
      if (e.altKey) {
        const cloned = cloneSelection(a.objectsRef.current, a.connectionsRef.current, ids, 0);
        a.setBoard({
          objects: [...a.objectsRef.current, ...cloned.objects],
          connections: [...a.connectionsRef.current, ...cloned.connections],
        });
        ids = cloned.objects.map((o) => o.id);
        for (const o of cloned.objects) origins[o.id] = { x: o.x, y: o.y };
        a.setSelected(ids);
      } else {
        for (const oid of ids) {
          const o = a.objectsRef.current.find((x) => x.id === oid);
          if (o) origins[oid] = { x: o.x, y: o.y };
        }
      }
      const w = a.screenToWorld(e.clientX, e.clientY);
      dragRef.current = { kind: "move", ids, sx: w.x, sy: w.y, origins };
      (a.viewportRef.current as HTMLElement | null)?.setPointerCapture(e.pointerId);
    },
    [startPinch],
  );

  const onResizeStart = useCallback(
    (e: ReactPointerEvent, id: string, handle: ResizeHandle) => {
      const a = argsRef.current;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size >= 2) {
        startPinch(e.pointerId);
        return;
      }
      if (a.tool === "pan" || a.spacePan || a.tool === "draw" || a.tool === "shape") return;
      const o = a.objectsRef.current.find((x) => x.id === id);
      if (!o) return;
      a.setSelected([id]);
      a.pushHistory();
      const w = a.screenToWorld(e.clientX, e.clientY);
      dragRef.current = {
        kind: "resize",
        id,
        handle,
        sx: w.x,
        sy: w.y,
        origin: { x: o.x, y: o.y, w: o.w, h: o.h },
        source: structuredClone(o),
      };
      (a.viewportRef.current as HTMLElement | null)?.setPointerCapture(e.pointerId);
    },
    [startPinch],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const a = argsRef.current;
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.kind === "pinch") {
        const m = pinchOf(pointersRef.current);
        const el = a.viewportRef.current;
        if (!m || !el) return;
        const rect = el.getBoundingClientRect();
        const nextZoom = clampZoom(drag.cam.zoom * (m.dist / drag.dist));
        const wx = (drag.mx - rect.left - drag.cam.x) / drag.cam.zoom;
        const wy = (drag.my - rect.top - drag.cam.y) / drag.cam.zoom;
        a.applyCameraLive({
          zoom: nextZoom,
          x: m.mx - rect.left - wx * nextZoom,
          y: m.my - rect.top - wy * nextZoom,
        });
        return;
      }
      if (drag.kind === "pan") {
        const next = {
          ...a.cameraRef.current,
          x: drag.cx + (e.clientX - drag.sx),
          y: drag.cy + (e.clientY - drag.sy),
        };
        a.applyCameraLive(next);
        return;
      }
      if (drag.kind === "draw") {
        const w = a.screenToWorld(e.clientX, e.clientY);
        const points = [...drag.points, w];
        drag.points = points;
        a.setDraftPath(points);
        return;
      }
      if (drag.kind === "shape") {
        const w = a.screenToWorld(e.clientX, e.clientY);
        drag.x1 = w.x;
        drag.y1 = w.y;
        a.setDraftShape(
          shapeDraftBox(drag.x0, drag.y0, drag.x1, drag.y1, {
            shift: e.shiftKey,
            fromCenter: e.altKey,
          }),
        );
        return;
      }
      if (drag.kind === "erase") {
        const w = a.screenToWorld(e.clientX, e.clientY);
        eraseAt(w.x, w.y, drag);
        return;
      }
      if (drag.kind === "marquee") {
        const w = a.screenToWorld(e.clientX, e.clientY);
        drag.x1 = w.x;
        drag.y1 = w.y;
        a.setMarquee(marqueeBox(drag.x0, drag.y0, drag.x1, drag.y1));
        return;
      }
      if (drag.kind === "move") {
        const w = a.screenToWorld(e.clientX, e.clientY);
        let rawDx = w.x - drag.sx;
        let rawDy = w.y - drag.sy;
        if (e.shiftKey) {
          if (Math.abs(rawDx) >= Math.abs(rawDy)) rawDy = 0;
          else rawDx = 0;
        }
        const moving = drag.ids
          .map((id) => {
            const o = a.objectsRef.current.find((x) => x.id === id);
            const origin = drag.origins[id];
            if (!o || !origin) return null;
            return { id, origin: { x: origin.x, y: origin.y, w: o.w, h: o.h } };
          })
          .filter((m): m is { id: string; origin: Box } => Boolean(m));
        const others = a.objectsRef.current
          .filter((o) => !drag.ids.includes(o.id))
          .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
        const snapped = snapGroupMove(moving, others, rawDx, rawDy, GRID);
        a.setGuides(snapped.guides);
        for (const id of drag.ids) {
          const o = drag.origins[id];
          if (!o) continue;
          a.patchBoardObject(id, { x: o.x + snapped.dx, y: o.y + snapped.dy });
        }
        return;
      }
      if (drag.kind === "resize") {
        const w = a.screenToWorld(e.clientX, e.clientY);
        const box = resizeBox(drag.origin, drag.handle, w.x - drag.sx, w.y - drag.sy, e.shiftKey);
        const others = a.objectsRef.current
          .filter((o) => o.id !== drag.id)
          .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
        const snapped = snapResizeBox(box, others, GRID);
        a.setGuides(snapped.guides);
        a.patchBoardObject(drag.id, applyResizeToObject(drag.source, snapped.box));
      }
    },
    [eraseAt],
  );

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    const a = argsRef.current;
    pointersRef.current.delete(e.pointerId);
    const drag = dragRef.current;
    if (drag?.kind === "pinch") {
      if (pointersRef.current.size < 2) {
        a.persistCamera(a.cameraRef.current);
        dragRef.current = null;
        const leftover = [...pointersRef.current.values()][0];
        if (leftover) {
          dragRef.current = {
            kind: "pan",
            sx: leftover.x,
            sy: leftover.y,
            cx: a.cameraRef.current.x,
            cy: a.cameraRef.current.y,
          };
        }
      }
      return;
    }
    dragRef.current = null;
    a.setGuides([]);
    if (drag?.kind === "pan") {
      a.persistCamera(a.cameraRef.current);
      return;
    }
    if (drag?.kind === "marquee") {
      const box = marqueeBox(drag.x0, drag.y0, drag.x1, drag.y1);
      a.setMarquee(null);
      if (box.w < 4 && box.h < 4) return;
      a.setSelected(
        a.objectsRef.current
          .filter((o) => boxesIntersect(box, { x: o.x, y: o.y, w: o.w, h: o.h }))
          .map((o) => o.id),
      );
      return;
    }
    if (drag?.kind === "draw" && drag.points.length > 1) {
      const bounds = pathBounds(drag.points);
      const local = pointsToLocal(drag.points, bounds.x, bounds.y);
      const isHi = a.inkTool === "highlighter";
      a.upsertWithHistory(
        createPath(bounds.x, bounds.y, nextZ(a.objectsRef.current), local, {
          stroke: isHi ? a.highlighterColor : a.penColor,
          strokeWidth: isHi ? a.highlighterWidth : a.penWidth,
          opacity: isHi ? HIGHLIGHTER_OPACITY : 1,
        }),
      );
      a.setDraftPath(null);
      return;
    }
    if (drag?.kind === "shape") {
      const box = shapeDraftBox(drag.x0, drag.y0, drag.x1, drag.y1, {
        shift: e.shiftKey,
        fromCenter: e.altKey,
      });
      a.setDraftShape(null);
      const w = Math.max(24, box.w);
      const h = Math.max(24, box.h);
      const tiny = box.w < 8 && box.h < 8;
      const obj = createShape(
        tiny ? box.x : box.x,
        tiny ? box.y : box.y,
        tiny ? DROP.shape.w : w,
        tiny ? DROP.shape.h : h,
        nextZ(a.objectsRef.current),
        {
          shape: a.shapeKind,
          fill: a.shapeFill,
          stroke: a.shapeStroke,
          strokeWidth: a.shapeWidth,
          strokeDash: a.shapeDash,
        },
      );
      a.upsertWithHistory(tiny ? fitDrop(obj) : obj);
      a.setSelected([obj.id]);
      a.setTool("select");
      a.setStudio(null);
      return;
    }
    a.setDraftPath(null);
    a.setDraftShape(null);
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onObjectDragStart,
    onResizeStart,
  };
}
