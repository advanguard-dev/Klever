import { EmptyState, MonoLabel, Segmented, Toggle } from "@/components/ui";
import { useContextMenu } from "@/components/ContextMenu";
import { noteMenuItems, tagMenuItems } from "@/lib/context-menus";
import { buildGraph } from "@/lib/graph";
import { useApp } from "@/store";
import type { GraphEdge, GraphNode } from "@/types";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";

type SimNode = GraphNode & SimulationNodeDatum;

export function GraphView() {
  const notes = useApp((s) => s.notes);
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const { nodes, edges } = useMemo(() => buildGraph(notes), [notes]);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(true);
  const [kind, setKind] = useState<"all" | "link" | "relation">("all");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => {
      if (e.kind === "tag") return showTags;
      if (kind === "all") return true;
      return e.kind === kind;
    });
  }, [edges, kind, showTags]);

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of filteredEdges) {
      ids.add(e.source as unknown as string);
      ids.add(e.target as unknown as string);
    }
    if (!filteredEdges.length) nodes.filter((n) => n.kind !== "tag").forEach((n) => ids.add(n.id));
    return ids;
  }, [filteredEdges, nodes]);

  const visNodes = useMemo(
    () => nodes.filter((n) => visibleIds.has(n.id) && (showTags || n.kind !== "tag")),
    [nodes, showTags, visibleIds],
  );

  useEffect(() => {
    const ns: SimNode[] = visNodes.map((n) => ({ ...n }));
    const ls = filteredEdges
      .filter(
        (e) =>
          visNodes.some((n) => n.id === edgeId(e.source)) &&
          visNodes.some((n) => n.id === edgeId(e.target)),
      )
      .map((e) => ({
        kind: e.kind,
        source: edgeId(e.source),
        target: edgeId(e.target),
      }));

    // Tags add many hub nodes; give the layout more room so page links stay readable.
    const tagCount = visNodes.filter((n) => n.kind === "tag").length;
    const density = Math.max(0, visNodes.length - 8);
    const charge = -(280 + density * 12 + tagCount * 28);
    const collide = 30 + Math.min(18, tagCount * 1.5);
    const tagDist = 95 + Math.min(40, tagCount * 2);
    const pageDist = 130 + Math.min(50, density * 2);

    const sim = forceSimulation(ns)
      .force(
        "link",
        forceLink(ls)
          .id((d) => (d as SimNode).id)
          .distance((d) => ((d as GraphEdge).kind === "tag" ? tagDist : pageDist))
          .strength((d) => ((d as GraphEdge).kind === "tag" ? 0.28 : 0.45)),
      )
      .force("charge", forceManyBody().strength(charge).distanceMax(420))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force(
        "collide",
        forceCollide<SimNode>()
          .radius((d) => (d.kind === "tag" ? collide * 0.75 : collide))
          .strength(0.85),
      )
      .on("tick", () => setSimNodes(ns.map((n) => ({ ...n }))));

    // Seed positions immediately so the first paint is never an empty canvas.
    for (let i = 0; i < 80; i++) sim.tick();
    setSimNodes(ns.map((n) => ({ ...n })));

    return () => {
      sim.on("tick", null);
      sim.stop();
    };
  }, [visNodes, filteredEdges, size.w, size.h]);

  const neighbor = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    for (const e of filteredEdges) {
      const a = edgeId(e.source);
      const b = edgeId(e.target);
      if (a === hover) s.add(b);
      if (b === hover) s.add(a);
    }
    return s;
  }, [filteredEdges, hover]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-4 px-4 py-5 md:px-8 md:py-6">
        <div>
          <MonoLabel>Graph</MonoLabel>
          <h1 className="mt-1 font-serif text-2xl italic tracking-tight md:text-3xl">Atlas</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Segmented
            aria-label="Graph edges"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All" },
              { value: "link", label: "Links" },
              { value: "relation", label: "Relations" },
            ]}
          />
          <Toggle checked={showTags} onChange={setShowTags} label="Tags" />
        </div>
      </div>
      <div ref={wrap} className="relative min-h-[20rem] flex-1">
        {visNodes.length === 0 ? (
          <EmptyState
            title="No connections yet"
            description="Link pages with [[wikilinks]] or database relations to populate the atlas."
          />
        ) : (
        <svg width={size.w} height={size.h} className="absolute inset-0">
          {filteredEdges.map((e, i) => {
            const a = simNodes.find((n) => n.id === edgeId(e.source));
            const b = simNodes.find((n) => n.id === edgeId(e.target));
            if (!a || !b || a.x == null || b.x == null) return null;
            const dim = hover && !neighbor.has(a.id) && !neighbor.has(b.id);
            // text-line is a border token (~paper) — invisible as stroke. Use ink/mute instead.
            const strokeClass =
              e.kind === "tag" ? "text-tag" : e.kind === "relation" ? "text-mute" : "text-ink";
            return (
              <line
                key={`${e.kind}:${edgeId(e.source)}->${edgeId(e.target)}:${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                className={strokeClass}
                strokeWidth={e.kind === "relation" ? 1.4 : e.kind === "link" ? 1.25 : 1}
                strokeDasharray={e.kind === "tag" ? "2 4" : undefined}
                opacity={dim ? 0.1 : e.kind === "tag" ? 0.55 : 0.45}
              />
            );
          })}
          {simNodes.map((n) => {
            if (n.x == null || n.y == null) return null;
            const dim = hover && !neighbor.has(n.id);
            const r = n.kind === "tag" ? 3.5 : n.kind === "database" ? 6 : 4.5;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.18 : 1}
                className="cursor-pointer"
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  if (n.kind === "tag") setView({ kind: "tag", tag: n.title.replace(/^#/, "") });
                  else if (n.kind === "database") setView({ kind: "database", id: n.id });
                  else setView({ kind: "note", id: n.id });
                }}
                onContextMenu={(e) => {
                  if (n.kind === "tag") open(e, tagMenuItems(n.title.replace(/^#/, "")));
                  else {
                    const note = notes.find((x) => x.id === n.id);
                    if (note) open(e, noteMenuItems(note));
                  }
                }}
              >
                <circle r={Math.max(14, r + 8)} className="fill-transparent" />
                <circle r={r} className={n.kind === "tag" ? "fill-tag" : "fill-ink"} />
                <text
                  y={n.kind === "tag" ? 16 : 18}
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
        )}
      </div>
    </div>
  );
}

function edgeId(x: string | { id?: string }) {
  return typeof x === "string" ? x : String(x.id ?? "");
}
