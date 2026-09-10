import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  graphDescription,
  latticeEdges,
  latticeNodes,
  type LatticeNode,
} from "@/content";
import { usePrefersReducedMotion } from "@/lib/motion";

type SimNode = LatticeNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { kind: "link" | "tag" };

const STATIC: Record<string, { x: number; y: number }> = {
  welcome: { x: 0.4, y: 0.48 },
  principles: { x: 0.6, y: 0.34 },
  projects: { x: 0.74, y: 0.54 },
  people: { x: 0.56, y: 0.72 },
  atlas: { x: 0.3, y: 0.7 },
  "tag-klever": { x: 0.2, y: 0.3 },
  "tag-writing": { x: 0.8, y: 0.24 },
  "tag-research": { x: 0.24, y: 0.84 },
};

const NODE_IDS = latticeNodes.map((n) => n.id);

function applyStatic(nodes: SimNode[], w: number, h: number) {
  for (const n of nodes) {
    const p = STATIC[n.id];
    if (!p) continue;
    n.x = p.x * w;
    n.y = p.y * h;
    n.fx = p.x * w;
    n.fy = p.y * h;
  }
}

export function GraphLattice() {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 560, h: 420 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const reduce = usePrefersReducedMotion();
  const descId = useId();
  const keyboard = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) });
    });
    ro.observe(el);
    setSize({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) });
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;

  useEffect(() => {
    const nodes: SimNode[] = latticeNodes.map((n) => ({ ...n }));
    const links: SimLink[] = latticeEdges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));

    if (reduce) {
      applyStatic(nodes, w, h);
      setSimNodes(nodes);
      return;
    }

    applyStatic(nodes, w, h);
    for (const n of nodes) {
      n.fx = undefined;
      n.fy = undefined;
    }

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => (d.kind === "tag" ? 72 : 96))
          .strength(0.55),
      )
      .force("charge", forceManyBody().strength(-240))
      .force("center", forceCenter(w / 2, h / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => (d.kind === "tag" ? 32 : 40)),
      )
      .alpha(0.85);

    sim.on("tick", () => {
      const padX = 48;
      const padY = 36;
      for (const n of nodes) {
        n.x = Math.max(padX, Math.min(w - padX, n.x ?? 0));
        n.y = Math.max(padY, Math.min(h - padY, n.y ?? 0));
      }
      setSimNodes([...nodes]);
    });

    return () => {
      sim.stop();
    };
  }, [w, h, reduce]);

  const neighbor = useMemo(() => {
    const set = new Set<string>();
    if (!hover) return set;
    set.add(hover);
    for (const e of latticeEdges) {
      if (e.source === hover) set.add(e.target);
      if (e.target === hover) set.add(e.source);
    }
    return set;
  }, [hover]);

  const focusedTitle = simNodes.find((n) => n.id === hover)?.title;

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === "Escape") {
      setHover(null);
      ev.currentTarget.blur();
      return;
    }
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft" && ev.key !== "ArrowDown" && ev.key !== "ArrowUp") {
      return;
    }
    ev.preventDefault();
    keyboard.current = true;
    const i = Math.max(0, NODE_IDS.indexOf(hover ?? NODE_IDS[0]));
    const next =
      ev.key === "ArrowRight" || ev.key === "ArrowDown"
        ? NODE_IDS[(i + 1) % NODE_IDS.length]
        : NODE_IDS[(i - 1 + NODE_IDS.length) % NODE_IDS.length];
    setHover(next);
  };

  return (
    <div
      ref={wrap}
      className="relative h-[min(28rem,70vw)] min-h-[18rem] w-full overflow-hidden rounded-lg border border-line bg-paper klever-focus"
      role="group"
      tabIndex={0}
      aria-labelledby={descId}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (!hover) setHover(NODE_IDS[0]);
      }}
      onBlur={() => {
        keyboard.current = false;
        setHover(null);
      }}
    >
      <p id={descId} className="sr-only">
        {graphDescription} Use arrow keys to move between nodes.
      </p>
      <div className="sr-only" aria-live="polite">
        {focusedTitle
          ? `${focusedTitle}, connected to ${[...neighbor]
              .filter((id) => id !== hover)
              .map((id) => latticeNodes.find((n) => n.id === id)?.title)
              .filter(Boolean)
              .join(", ")}`
          : ""}
      </div>
      <svg width={w} height={h} className="absolute inset-0" aria-hidden="true">
        {latticeEdges.map((e, i) => {
          const a = simNodes.find((n) => n.id === e.source);
          const b = simNodes.find((n) => n.id === e.target);
          if (!a || !b || a.x == null || b.x == null || a.y == null || b.y == null) return null;
          const dim = hover && !neighbor.has(a.id) && !neighbor.has(b.id);
          return (
            <line
              key={`${e.kind}:${e.source}:${e.target}:${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              className={e.kind === "tag" ? "text-tag" : "text-ink"}
              strokeWidth={e.kind === "tag" ? 1 : 1.25}
              strokeDasharray={e.kind === "tag" ? "2 4" : undefined}
              opacity={dim ? 0.1 : e.kind === "tag" ? 0.55 : 0.4}
            />
          );
        })}
        {simNodes.map((n) => {
          if (n.x == null || n.y == null) return null;
          const dim = Boolean(hover && !neighbor.has(n.id));
          const r = n.kind === "tag" ? 3.5 : n.kind === "database" ? 6 : 4.5;
          return (
            <g
              key={n.id}
              id={`lattice-${n.id}`}
              transform={`translate(${n.x},${n.y})`}
              opacity={dim ? 0.18 : 1}
              className="lattice-node cursor-pointer"
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => {
                if (!keyboard.current) setHover(null);
              }}
            >
              <circle
                r={Math.max(16, r + 10)}
                className={
                  hover === n.id
                    ? "lattice-hit fill-transparent stroke-ring"
                    : "lattice-hit fill-transparent stroke-transparent"
                }
                strokeWidth={2}
              />
              <circle r={r} className={n.kind === "tag" ? "fill-tag" : "fill-ink"} />
              <text
                y={n.kind === "tag" ? 16 : 20}
                textAnchor="middle"
                className={
                  n.kind === "tag"
                    ? "fill-tag font-mono text-[9px]"
                    : "fill-ink font-sans text-[12px]"
                }
              >
                {n.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
