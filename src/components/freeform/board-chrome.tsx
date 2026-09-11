import { ShapeGraphic } from "@/components/freeform/BoardObject";
import { Kbd, ToolbarBtn } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { FreeformShapeKind, FreeformTool } from "@/types";
import {
  AtSign,
  Download,
  Eraser,
  FileJson,
  Grid3x3,
  Hand,
  Image as ImageIcon,
  Layers,
  Link2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Network,
  Pencil,
  Plus,
  Search,
  Shapes,
  StickyNote,
  Table2,
  Type,
  Waypoints,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

export type BoardStudio =
  | "shape"
  | "ink"
  | "sticky"
  | "paint"
  | "type"
  | "arrange"
  | "more"
  | null;

export {
  ArrangeStudio,
  InkStudio,
  PaintWell,
  PigmentGrid,
  ShapeStudio,
  ShapeTray,
  StickyStudio,
  TableStudio,
  TypeStudio,
} from "@/components/freeform/studios";

export const BOARD_TOOLS: {
  id: FreeformTool;
  label: string;
  icon: typeof Type;
  shortcut: string;
  group: "nav" | "make" | "place";
}[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V", group: "nav" },
  { id: "pan", label: "Pan", icon: Hand, shortcut: "H", group: "nav" },
  { id: "text", label: "Write", icon: Type, shortcut: "T", group: "make" },
  { id: "draw", label: "Draw", icon: Pencil, shortcut: "P", group: "make" },
  { id: "shape", label: "Shape", icon: Shapes, shortcut: "O", group: "make" },
  { id: "sticky", label: "Sticky", icon: StickyNote, shortcut: "S", group: "make" },
  { id: "image", label: "Image", icon: ImageIcon, shortcut: "I", group: "place" },
  { id: "link", label: "Link", icon: Link2, shortcut: "L", group: "place" },
  { id: "table", label: "Table", icon: Table2, shortcut: "B", group: "place" },
  { id: "mind", label: "Mind map", icon: Network, shortcut: "M", group: "place" },
  { id: "mention", label: "Page @", icon: AtSign, shortcut: "@", group: "place" },
];

export const TOOL_BY_KEY: Record<string, FreeformTool> = Object.fromEntries(
  BOARD_TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id]),
) as Record<string, FreeformTool>;

const shell =
  "rounded-2xl border border-line bg-paper shadow-[0_12px_40px_-18px_rgba(21,23,22,0.38)]";
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function useDismiss(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const root = ref.current?.parentElement ?? ref.current;
      if (!root?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, ref]);
}

function Flyout({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, onClose, ref);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      className={cn(
        shell,
        "z-40 p-3 motion-safe:animate-[klever-sheet_0.18s_cubic-bezier(0.16,1,0.3,1)_both]",
        className,
      )}
      onPointerDown={stop}
    >
      {children}
    </div>
  );
}

function RailHint({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 opacity-0 shadow-md group-hover:opacity-100 group-focus-visible:opacity-100 max-md:hidden md:flex">
      <span className="whitespace-nowrap text-xs text-ink">{label}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </span>
  );
}

function RailBtn({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span className="group relative">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        aria-keyshortcuts={shortcut}
        title={shortcut ? undefined : label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "klever-focus inline-flex h-10 w-10 items-center justify-center rounded-xl text-mute transition-colors duration-150",
          "hover:bg-paper-2 hover:text-ink active:scale-[0.97]",
          "max-md:h-11 max-md:w-11",
          active && "bg-ink text-paper hover:bg-ink hover:text-paper",
          disabled && "pointer-events-none opacity-35",
        )}
      >
        {children}
      </button>
      <RailHint label={label} shortcut={shortcut} />
    </span>
  );
}

export function BoardToolRail({
  tool,
  studio,
  onTool,
  onStudio,
  shape,
  ink,
  sticky,
}: {
  tool: FreeformTool;
  studio: BoardStudio;
  onTool: (id: FreeformTool) => void;
  onStudio: (s: BoardStudio) => void;
  shape: ReactNode;
  ink: ReactNode;
  sticky: ReactNode;
}) {
  const groups: Array<"nav" | "make" | "place"> = ["nav", "make", "place"];
  const openFor = (id: FreeformTool): BoardStudio =>
    id === "shape" ? "shape" : id === "draw" ? "ink" : id === "sticky" ? "sticky" : null;

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-0.5 p-1.5",
        shell,
        "max-md:flex-row",
        "md:flex-col",
      )}
      onPointerDown={stop}
    >
      {groups.map((g, i) => (
        <div key={g} className={cn("flex gap-0.5 max-md:flex-row md:flex-col", i > 0 && "max-md:pl-1 md:pt-1")}>
          {i > 0 && <span className="hidden bg-line max-md:mx-0.5 max-md:h-8 max-md:w-px md:mx-auto md:mb-1 md:block md:h-px md:w-7" aria-hidden />}
          {BOARD_TOOLS.filter((t) => t.group === g).map((t) => {
            const Icon = t.icon;
            const fly = openFor(t.id);
            const open = tool === t.id && studio === fly;
            return (
              <span key={t.id} className="relative">
                <RailBtn
                  label={t.label}
                  shortcut={t.shortcut}
                  active={tool === t.id}
                  onClick={() => {
                    if (t.id === "shape") {
                      onTool(t.id);
                      return;
                    }
                    onTool(t.id);
                    if (t.id === "draw") onStudio(open ? null : "ink");
                    else onStudio(null);
                  }}
                >
                  <Icon size={16} strokeWidth={1.4} />
                </RailBtn>
                {t.id === "shape" && (
                  <Flyout
                    open={open}
                    onClose={() => {
                      onStudio(null);
                      if (tool === "shape") onTool("select");
                    }}
                    className="absolute max-md:bottom-full max-md:left-1/2 max-md:mb-2 max-md:-translate-x-1/2 md:left-full md:top-0 md:ml-3"
                  >
                    {shape}
                  </Flyout>
                )}
                {t.id === "draw" && (
                  <Flyout
                    open={open}
                    onClose={() => onStudio(null)}
                    className="absolute max-md:bottom-full max-md:left-1/2 max-md:mb-2 max-md:-translate-x-1/2 md:left-full md:top-0 md:ml-3"
                  >
                    {ink}
                  </Flyout>
                )}
                {t.id === "sticky" && (
                  <Flyout
                    open={open}
                    onClose={() => onStudio(null)}
                    className="absolute max-md:bottom-full max-md:left-1/2 max-md:mb-2 max-md:-translate-x-1/2 md:left-full md:top-0 md:ml-3"
                  >
                    {sticky}
                  </Flyout>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function BoardHud({
  studio,
  onStudio,
  paint,
  paintOpen,
  paintPanel,
  typePanel,
  arrangePanel,
  connect,
  hasType,
  hasPaint,
  hasShape,
  shapeThumb,
}: {
  studio: BoardStudio;
  onStudio: (s: BoardStudio) => void;
  paint: ReactNode;
  paintOpen: boolean;
  paintPanel: ReactNode;
  typePanel?: ReactNode;
  arrangePanel: ReactNode;
  connect: ReactNode;
  hasType: boolean;
  hasPaint: boolean;
  hasShape?: boolean;
  shapeThumb?: ReactNode;
}) {
  return (
    <div
      className={cn("pointer-events-auto relative flex items-center gap-0.5 px-1.5 py-1", shell)}
      onPointerDown={stop}
    >
      {hasPaint && (
        <span className="relative">
          {paint}
          <Flyout
            open={paintOpen}
            onClose={() => onStudio(null)}
            className="absolute bottom-full left-0 mb-2"
          >
            {paintPanel}
          </Flyout>
        </span>
      )}
      {hasShape && shapeThumb}
      {hasType && (
        <span className="relative">
          <RailBtn
            label="Type"
            active={studio === "type"}
            onClick={() => onStudio(studio === "type" ? null : "type")}
          >
            <span className="font-serif text-[15px] leading-none">Aa</span>
          </RailBtn>
          <Flyout
            open={studio === "type"}
            onClose={() => onStudio(null)}
            className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2"
          >
            {typePanel}
          </Flyout>
        </span>
      )}
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
      <span className="relative">
        <RailBtn
          label="Arrange"
          active={studio === "arrange"}
          onClick={() => onStudio(studio === "arrange" ? null : "arrange")}
        >
          <Layers size={15} strokeWidth={1.4} />
        </RailBtn>
        <Flyout
          open={studio === "arrange"}
          onClose={() => onStudio(null)}
          className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2"
        >
          {arrangePanel}
        </Flyout>
      </span>
      {connect}
    </div>
  );
}

export function BoardViewHud({
  zoomPct,
  minPct = 25,
  maxPct = 500,
  dotted,
  onZoomOut,
  onZoomReset,
  onZoomIn,
  onZoomPct,
  onDots,
}: {
  zoomPct: number;
  minPct?: number;
  maxPct?: number;
  dotted: boolean;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
  onZoomPct?: (pct: number) => void;
  onDots: () => void;
}) {
  return (
    <div
      className={cn("pointer-events-auto flex items-center gap-0.5 p-1", shell)}
      onPointerDown={stop}
    >
      <RailBtn label="Zoom out" onClick={onZoomOut} disabled={zoomPct <= minPct}>
        <Minus size={14} strokeWidth={1.4} />
      </RailBtn>
      <button
        type="button"
        title="Reset zoom to 100%"
        onClick={onZoomReset}
        className="klever-focus min-w-[3rem] rounded-lg px-1 font-mono text-[11px] tabular-nums text-mute hover:text-ink"
      >
        {zoomPct}%
      </button>
      <RailBtn label="Zoom in" onClick={onZoomIn} disabled={zoomPct >= maxPct}>
        <Plus size={14} strokeWidth={1.4} />
      </RailBtn>
      {onZoomPct && (
        <input
          type="range"
          min={minPct}
          max={maxPct}
          step={1}
          value={Math.min(maxPct, Math.max(minPct, zoomPct))}
          aria-label={`Zoom ${minPct}–${maxPct}%`}
          title={`${minPct}–${maxPct}%`}
          onChange={(e) => onZoomPct(Number(e.target.value))}
          className="mx-1 h-1 w-16 cursor-pointer appearance-none rounded-full bg-line accent-ink md:w-20"
        />
      )}
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
      <RailBtn label={dotted ? "Hide dots" : "Show dots"} active={dotted} onClick={onDots}>
        <Grid3x3 size={14} strokeWidth={1.4} />
      </RailBtn>
    </div>
  );
}

export type BoardSearchHit = {
  id: string;
  kind: string;
  title: string;
};

export function BoardSearch({
  open,
  query,
  hits,
  activeIndex,
  inputRef,
  onOpen,
  onClose,
  onQuery,
  onActiveIndex,
  onPick,
}: {
  open: boolean;
  query: string;
  hits: BoardSearchHit[];
  activeIndex: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onQuery: (q: string) => void;
  onActiveIndex: (i: number) => void;
  onPick: (id: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const q = query.trim();
  useDismiss(open, onClose, rootRef);

  return (
    <div ref={rootRef} className="relative z-30" onPointerDown={stop}>
      {!open ? (
        <ToolbarBtn label="Find on board" shortcut="⌘F" onClick={onOpen}>
          <Search size={15} strokeWidth={1.4} />
        </ToolbarBtn>
      ) : (
        <div className={cn("relative w-[min(18rem,calc(100vw-6rem))]", shell)}>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Search size={14} strokeWidth={1.4} className="shrink-0 text-mute" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Find on board…"
              aria-label="Find on board"
              aria-keyshortcuts="Meta+F Control+F"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded
              className="klever-focus min-w-0 flex-1 bg-transparent py-1 text-sm text-ink outline-none placeholder:text-faint"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                  return;
                }
                if (e.key === "ArrowDown" && hits.length) {
                  e.preventDefault();
                  onActiveIndex((activeIndex + 1) % hits.length);
                  return;
                }
                if (e.key === "ArrowUp" && hits.length) {
                  e.preventDefault();
                  onActiveIndex((activeIndex - 1 + hits.length) % hits.length);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const hit = hits[activeIndex] ?? hits[0];
                  if (hit) onPick(hit.id);
                }
              }}
            />
            <Kbd>esc</Kbd>
          </div>
          {q ? (
            <ul
              id={listId}
              role="listbox"
              className="max-h-56 overflow-y-auto border-t border-line py-1"
            >
              {hits.length === 0 ? (
                <li className="px-3 py-3 text-sm text-mute">No objects match</li>
              ) : (
                hits.map((hit, i) => (
                  <li key={hit.id} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left",
                        i === activeIndex ? "bg-paper-2 text-ink" : "text-ink hover:bg-paper-2",
                      )}
                      onMouseEnter={() => onActiveIndex(i)}
                      onClick={() => onPick(hit.id)}
                    >
                      <span className="w-full truncate text-sm">{hit.title}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
                        {hit.kind}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <p className="border-t border-line px-3 py-2 text-xs text-mute">
              Search text, stickies, labels, pages…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BoardMoreMenu({
  open,
  onToggle,
  onClose,
  onExportPng,
  onExportJson,
  onClear,
  canClear,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onExportPng: () => void;
  onExportJson: () => void;
  onClear: () => void;
  canClear: boolean;
}) {
  return (
    <span className="relative">
      <RailBtn label="Board" active={open} onClick={onToggle}>
        <MoreHorizontal size={16} strokeWidth={1.4} />
      </RailBtn>
      <Flyout open={open} onClose={onClose} className="absolute right-0 top-full mt-2 w-44 p-1">
        <button
          type="button"
          className="klever-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-paper-2"
          onClick={() => {
            onExportPng();
            onClose();
          }}
        >
          <Download size={14} strokeWidth={1.4} />
          Export image
        </button>
        <button
          type="button"
          className="klever-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-paper-2"
          onClick={() => {
            onExportJson();
            onClose();
          }}
        >
          <FileJson size={14} strokeWidth={1.4} />
          Export JSON
        </button>
        <button
          type="button"
          disabled={!canClear}
          className="klever-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-mute hover:bg-paper-2 hover:text-ink disabled:opacity-40"
          onClick={() => {
            onClear();
            onClose();
          }}
        >
          <Eraser size={14} strokeWidth={1.4} />
          Clear board
        </button>
      </Flyout>
    </span>
  );
}

export function HudConnectBtn({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <RailBtn label={active ? "Click a target" : "Connect"} active={active} onClick={onClick}>
      <Waypoints size={15} strokeWidth={1.4} />
    </RailBtn>
  );
}

export function HudShapeThumb({
  kind,
  onClick,
  open,
}: {
  kind: FreeformShapeKind;
  onClick: () => void;
  open?: boolean;
}) {
  return (
    <RailBtn label="Shape" active={open} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <ShapeGraphic
          kind={kind}
          w={18}
          h={18}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeDash="solid"
        />
      </svg>
    </RailBtn>
  );
}
