import type { GraphEdge, GraphNode } from "@/types";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

export type LatticeHandle = {
  flyTo: (id: string) => void;
  frameAll: () => void;
  zoomBy: (delta: number) => void;
};

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { kind: GraphEdge["kind"]; label?: string };

function edgeEnd(x: string | SimNode | undefined) {
  if (!x) return "";
  return typeof x === "string" ? x : x.id;
}

function nodeRadius(n: GraphNode) {
  if (n.kind === "tag") return 3.5;
  if (n.kind === "database") return 6;
  return 4.5;
}

export const NeuralLattice = forwardRef<
  LatticeHandle,
  {
    nodes: GraphNode[];
    edges: GraphEdge[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onOpen: (node: GraphNode) => void;
    onContext: (node: GraphNode, clientX: number, clientY: number) => void;
  }
>(function NeuralLattice({ nodes, edges, selectedId, onSelect, onOpen, onContext }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 480 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const dragRef = useRef<{
    kind: "pan" | "idle";
    x: number;
    y: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const keyboard = useRef(false);
  const descId = useId();
  const reduceRef = useRef(false);
  const simNodesRef = useRef<SimNode[]>([]);
  simNodesRef.current = simNodes;

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const graphKey = `${nodes.map((n) => n.id).join(",")}|${edges.map((e) => `${e.kind}:${e.source}->${e.target}`).join(",")}`;
  const nodeById = useMemo(() => {
    const m = new Map<string, SimNode>();
    for (const n of simNodes) m.set(n.id, n);
    return m;
  }, [simNodes]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) };
      setSize(next);
      const sim = simRef.current;
      if (sim) {
        sim.force("center", forceCenter(next.w / 2, next.h / 2));
        sim.alpha(0.15).restart();
      }
    });
    ro.observe(el);
    setSize({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) });
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;

  const fitTo = (list: SimNode[], animate = false) => {
    if (!list.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of list) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    if (!Number.isFinite(minX)) return;
    const { w: vw, h: vh } = sizeRef.current;
    const pad = 72;
    const bw = Math.max(80, maxX - minX);
    const bh = Math.max(80, maxY - minY);
    const k = Math.min(2.4, Math.max(0.35, Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh)));
    const next = {
      k,
      x: vw / 2 - ((minX + maxX) / 2) * k,
      y: vh / 2 - ((minY + maxY) / 2) * k,
    };
    if (!animate || reduceRef.current) {
      setView(next);
      return;
    }
    const from = viewRef.current;
    const t0 = performance.now();
    const dur = 280;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - t) ** 3;
      setView({
        k: from.k + (next.k - from.k) * e,
        x: from.x + (next.x - from.x) * e,
        y: from.y + (next.y - from.y) * e,
      });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const panToId = (id: string) => {
    const n = simNodesRef.current.find((x) => x.id === id);
    if (!n || n.x == null || n.y == null) return;
    const k = viewRef.current.k;
    const { w: vw, h: vh } = sizeRef.current;
    setView({
      k,
      x: vw / 2 - n.x * k,
      y: vh / 2 - n.y * k,
    });
  };

  useImperativeHandle(ref, () => ({
    flyTo: (id) => {
      onSelect(id);
      panToId(id);
    },
    frameAll: () => fitTo(simNodesRef.current, true),
    zoomBy: (delta) => {
      const factor = delta > 0 ? 0.88 : 1.14;
      const { w: vw, h: vh } = sizeRef.current;
      setView((v) => {
        const k = Math.min(3.2, Math.max(0.28, v.k * factor));
        const cx = vw / 2;
        const cy = vh / 2;
        return {
          k,
          x: cx - ((cx - v.x) / v.k) * k,
          y: cy - ((cy - v.y) / v.k) * k,
        };
      });
    },
  }));

  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { w: vw, h: vh } = sizeRef.current;
    const seed: SimNode[] = nodes.map((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const ring = 80 + (i % 7) * 28;
      return {
        ...n,
        x: vw / 2 + Math.cos(angle) * ring,
        y: vh / 2 + Math.sin(angle) * ring,
      };
    });
    const links: SimLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
      label: e.label,
    }));

    if (reduceRef.current || seed.length === 0) {
      simRef.current = null;
      setSimNodes(seed);
      requestAnimationFrame(() => fitTo(seed));
      return;
    }

    const sim = forceSimulation(seed)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => (d.kind === "tag" ? 64 : d.kind === "relation" ? 92 : 108))
          .strength(0.55),
      )
      .force("charge", forceManyBody().strength(seed.length > 80 ? -120 : -220))
      .force("center", forceCenter(vw / 2, vh / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => nodeRadius(d) + (d.kind === "tag" ? 22 : 28)),
      )
      .alpha(0.9);
    simRef.current = sim;

    let frame = 0;
    const onTick = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setSimNodes([...seed]);
      });
    };
    sim.on("tick", onTick);
    sim.on("end", () => {
      setSimNodes([...seed]);
      fitTo(seed);
    });

    return () => {
      sim.stop();
      simRef.current = null;
      if (frame) cancelAnimationFrame(frame);
    };
    // Restart layout only when the graph identity changes — resize updates center via sizeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]);

  const neighbor = useMemo(() => {
    const set = new Set<string>();
    const focus = hover || selectedId;
    if (!focus) return set;
    set.add(focus);
    for (const e of edges) {
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    }
    return set;
  }, [edges, hover, selectedId]);

  const focused = nodeById.get(hover || selectedId || "") ?? null;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const rect = wrapRef.current?.getBoundingClientRect();
    const px = e.clientX - (rect?.left ?? 0);
    const py = e.clientY - (rect?.top ?? 0);
    setView((v) => {
      const k = Math.min(3.2, Math.max(0.28, v.k * factor));
      return {
        k,
        x: px - ((px - v.x) / v.k) * k,
        y: py - ((py - v.y) / v.k) * k,
      };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "pan",
      x: e.clientX,
      y: e.clientY,
      vx: view.x,
      vy: view.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setView({ ...view, x: d.vx + dx, y: d.vy + dy });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.moved) return;
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === "Escape") {
      onSelect(null);
      setHover(null);
      return;
    }
    if (ev.key === "Enter" && selectedId) {
      const n = nodes.find((x) => x.id === selectedId);
      if (n) onOpen(n);
      return;
    }
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft" && ev.key !== "ArrowDown" && ev.key !== "ArrowUp") {
      return;
    }
    ev.preventDefault();
    keyboard.current = true;
    const i = Math.max(0, nodeIds.indexOf(selectedId ?? hover ?? nodeIds[0] ?? ""));
    if (!nodeIds.length) return;
    const next =
      ev.key === "ArrowRight" || ev.key === "ArrowDown"
        ? nodeIds[(i + 1) % nodeIds.length]
        : nodeIds[(i - 1 + nodeIds.length) % nodeIds.length];
    onSelect(next);
    setHover(next);
    panToId(next);
  };

  return (
    <div
      ref={wrapRef}
      className="klever-lattice klever-focus relative min-h-0 flex-1 overflow-hidden"
      role="application"
      tabIndex={0}
      aria-labelledby={descId}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <p id={descId} className="sr-only">
        Vault graph. Arrow keys move between pages. Enter opens. Drag to pan. Scroll to zoom.
      </p>
      <div className="sr-only" aria-live="polite">
        {focused
          ? `${focused.title}, ${focused.kind}${
              neighbor.size > 1
                ? `, connected to ${[...neighbor]
                    .filter((id) => id !== focused.id)
                    .map((id) => nodes.find((n) => n.id === id)?.title)
                    .filter(Boolean)
                    .slice(0, 8)
                    .join(", ")}`
                : ""
            }`
          : ""}
      </div>
      <svg width={w} height={h} className="absolute inset-0" aria-hidden="true">
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {edges.map((e, i) => {
            const a = nodeById.get(edgeEnd(e.source));
            const b = nodeById.get(edgeEnd(e.target));
            if (!a || !b || a.x == null || b.x == null || a.y == null || b.y == null) return null;
            const dim = Boolean((hover || selectedId) && !neighbor.has(a.id) && !neighbor.has(b.id));
            return (
              <line
                key={`${e.kind}:${e.source}:${e.target}:${e.label ?? ""}:${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                className={e.kind === "tag" ? "text-tag" : e.kind === "relation" ? "text-prop" : "text-ink"}
                strokeWidth={e.kind === "tag" ? 1 : 1.25}
                strokeDasharray={e.kind === "tag" ? "2 4" : undefined}
                opacity={dim ? 0.1 : e.kind === "tag" ? 0.55 : 0.4}
              />
            );
          })}
          {simNodes.map((n) => {
            if (n.x == null || n.y == null) return null;
            const dim = Boolean((hover || selectedId) && !neighbor.has(n.id));
            const r = nodeRadius(n);
            const on = selectedId === n.id || hover === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.18 : 1}
                className="cursor-pointer"
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (ev.button === 2) return;
                  onSelect(n.id);
                }}
                onDoubleClick={(ev) => {
                  ev.stopPropagation();
                  onOpen(n);
                }}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  onContext(n, ev.clientX, ev.clientY);
                }}
                onPointerEnter={() => {
                  if (!keyboard.current) setHover(n.id);
                }}
                onPointerLeave={() => {
                  if (!keyboard.current) setHover(null);
                }}
              >
                <circle
                  r={Math.max(16, r + 10)}
                  className={on ? "fill-transparent stroke-ring" : "fill-transparent stroke-transparent"}
                  strokeWidth={2}
                />
                <circle r={r} className={n.kind === "tag" ? "fill-tag" : "fill-ink"} />
                <text
                  y={n.kind === "tag" ? 16 : 20}
                  textAnchor="middle"
                  className={
                    n.kind === "tag" ? "fill-tag font-mono text-[9px]" : "fill-ink font-sans text-[12px]"
                  }
                >
                  {n.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
});
