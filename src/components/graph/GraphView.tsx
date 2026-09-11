import { EmptyState, Field, GhostButton, IconButton, Segmented, Toggle } from "@/components/ui";
import { NeuralLattice, type LatticeHandle } from "@/components/graph/NeuralLattice";
import { useContextMenu } from "@/components/ContextMenu";
import { noteMenuItems, tagMenuItems } from "@/lib/context-menus";
import { buildGraph } from "@/lib/graph";
import { useApp } from "@/store";
import type { GraphNode } from "@/types";
import { GitBranch, Minus, Plus, Scan } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function edgeId(x: string | { id?: string }) {
  return typeof x === "string" ? x : String(x.id ?? "");
}

export function GraphView() {
  const notes = useApp((s) => s.notes);
  const setView = useApp((s) => s.setView);
  const setRelateNoteId = useApp((s) => s.setRelateNoteId);
  const { open } = useContextMenu();
  const { nodes, edges } = useMemo(() => buildGraph(notes), [notes]);
  const [showTags, setShowTags] = useState(true);
  const [kind, setKind] = useState<"all" | "link" | "relation">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [jumpOpen, setJumpOpen] = useState(false);
  const latticeRef = useRef<LatticeHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => {
      if (e.kind === "tag") return showTags;
      if (kind === "all") return true;
      return e.kind === kind;
    });
  }, [edges, kind, showTags]);

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of nodes) {
      if (n.kind !== "tag") ids.add(n.id);
    }
    for (const e of filteredEdges) {
      ids.add(edgeId(e.source));
      ids.add(edgeId(e.target));
    }
    return ids;
  }, [filteredEdges, nodes]);

  const visNodes = useMemo(
    () => nodes.filter((n) => visibleIds.has(n.id) && (showTags || n.kind !== "tag")),
    [nodes, showTags, visibleIds],
  );

  const visEdges = useMemo(
    () =>
      filteredEdges.filter(
        (e) => visNodes.some((n) => n.id === edgeId(e.source)) && visNodes.some((n) => n.id === edgeId(e.target)),
      ),
    [filteredEdges, visNodes],
  );

  const selected = visNodes.find((n) => n.id === selectedId) ?? null;
  const selectedNote = selected && selected.kind !== "tag" ? notes.find((n) => n.id === selected.id) : null;
  const q = query.trim().toLowerCase();
  const jumpHits = q
    ? visNodes.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 8)
    : visNodes.slice(0, 8);

  const openNode = (n: GraphNode) => {
    if (n.kind === "tag") setView({ kind: "tag", tag: n.title.replace(/^#/, "") });
    else if (n.kind === "database") setView({ kind: "database", id: n.id });
    else setView({ kind: "note", id: n.id });
  };

  const jumpTo = (n: GraphNode) => {
    setSelectedId(n.id);
    latticeRef.current?.flyTo(n.id);
    setQuery("");
    setJumpOpen(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setJumpOpen(true);
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {visNodes.length === 0 ? (
        <EmptyState
          title="No connections yet"
          description="Use Relate on a page, or [[wikilinks]], to grow this lattice."
        />
      ) : (
        <NeuralLattice
          ref={latticeRef}
          nodes={visNodes}
          edges={visEdges}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onOpen={openNode}
          onContext={(n, x, y) => {
            const fake = {
              preventDefault() {},
              stopPropagation() {},
              clientX: x,
              clientY: y,
            };
            if (n.kind === "tag") open(fake, tagMenuItems(n.title.replace(/^#/, "")));
            else {
              const note = notes.find((q) => q.id === n.id);
              if (note) open(fake, noteMenuItems(note));
            }
          }}
        />
      )}
      {visNodes.length > 0 && (
        <div className="klever-lattice-hud">
          <div className="klever-lattice-chip absolute top-3 left-3 w-[min(18rem,calc(100%-6.5rem))] p-1">
            <Field
              ref={searchRef}
              className="border-transparent bg-transparent px-2 py-1.5"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setJumpOpen(true);
              }}
              onFocus={() => setJumpOpen(true)}
              onBlur={() => window.setTimeout(() => setJumpOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && jumpHits[0]) {
                  e.preventDefault();
                  jumpTo(jumpHits[0]);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setQuery("");
                  setJumpOpen(false);
                  searchRef.current?.blur();
                }
              }}
              placeholder="Jump"
              aria-label="Jump to a page"
              autoComplete="off"
            />
            {jumpOpen && jumpHits.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-y-auto">
                {jumpHits.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="klever-focus flex w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-ink hover:bg-paper-2"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => jumpTo(n)}
                    >
                      {n.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="klever-lattice-chip absolute top-3 right-3 p-1">
            <Segmented
              size="sm"
              aria-label="Graph edges"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All" },
                { value: "link", label: "Links" },
                { value: "relation", label: "Relations" },
              ]}
            />
          </div>
          <div className="klever-lattice-chip absolute right-3 bottom-3 flex items-center gap-1 p-0.5 pr-1">
            <Toggle checked={showTags} onChange={setShowTags} label="Tags" className="px-1 text-xs" />
            <IconButton type="button" aria-label="Zoom out" onClick={() => latticeRef.current?.zoomBy(36)}>
              <Minus size={14} strokeWidth={1.4} />
            </IconButton>
            <IconButton type="button" aria-label="Zoom in" onClick={() => latticeRef.current?.zoomBy(-36)}>
              <Plus size={14} strokeWidth={1.4} />
            </IconButton>
            <IconButton type="button" aria-label="Frame field" onClick={() => latticeRef.current?.frameAll()}>
              <Scan size={14} strokeWidth={1.4} />
            </IconButton>
          </div>
          {selected && (
            <div className="klever-lattice-chip absolute bottom-3 left-3 w-[min(20rem,calc(100%-1.5rem))] p-3">
              <p className="font-sans text-sm font-medium text-ink">{selected.title}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                {selected.kind === "tag" ? "Tag" : selected.kind === "database" ? "Database" : "Page"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <GhostButton type="button" className="h-8 px-3 text-xs" onClick={() => openNode(selected)}>
                  Open
                </GhostButton>
                {selectedNote && selectedNote.type === "page" && (
                  <GhostButton type="button" className="h-8 px-3 text-xs" onClick={() => setRelateNoteId(selectedNote.id)}>
                    <GitBranch size={13} strokeWidth={1.4} />
                    Relate
                  </GhostButton>
                )}
              </div>
            </div>
          )}
          {!selected && (
            <p className="absolute right-16 bottom-14 max-w-[14rem] text-right font-mono text-[10px] leading-relaxed text-mute">
              Drag pan · Scroll zoom · Enter opens
            </p>
          )}
        </div>
      )}
    </div>
  );
}
