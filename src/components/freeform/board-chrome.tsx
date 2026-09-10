import { ShapeGraphic } from "@/components/freeform/BoardObject";
import {
  BOARD_FONTS,
  type InkTool,
  HIGHLIGHTER_OPACITY,
  PIGMENTS,
  SHAPE_KINDS,
  STICKY_COLORS,
  STROKE_DASHES,
  fillPickerHex,
  insertParagraphBreak,
  mindNodeHeight,
  pigmentHex,
  resolveShapeTextColor,
  resolveStickyTextColor,
  strokePickerHex,
  textColorHex,
} from "@/components/freeform/board-model";
import type { AlignEdge } from "@/components/freeform/board-ops";
import { IconButton, Kbd, ToolbarBtn } from "@/components/ui";
import { cn } from "@/lib/cn";
import type {
  FreeformObject,
  FreeformShapeKind,
  FreeformStrokeDash,
  FreeformTool,
  PageFont,
  TextAlign,
  TextVAlign,
} from "@/types";
import {
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
  AtSign,
  Bold,
  BringToFront,
  Download,
  Eraser,
  FileJson,
  Grid3x3,
  Hand,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Layers,
  Link2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Network,
  Pencil,
  Pilcrow,
  Plus,
  Search,
  SendToBack,
  Shapes,
  StickyNote,
  Strikethrough,
  Table2,
  Type,
  Waypoints,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
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

function paintCss(id: string | undefined, kind: "fill" | "stroke"): string {
  if (!id || id === "none" || id === "transparent") {
    return "transparent";
  }
  if (kind === "stroke") return strokePickerHex(id);
  if (id === "ink") return "var(--color-ink)";
  if (id === "mute") return "var(--color-mute)";
  return fillPickerHex(id);
}

/** Overlapping fill / stroke wells — one control instead of two swatch rows. */
export function PaintWell({
  fill,
  stroke,
  fillOnly,
  open,
  onToggle,
  label,
}: {
  fill?: string;
  stroke?: string;
  fillOnly?: boolean;
  open?: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const fillCss = paintCss(fill, "fill");
  const strokeNone = !stroke || stroke === "none" || stroke === "transparent";
  const strokeCss = paintCss(stroke ?? "ink", "stroke");
  const none = !fill || fill === "none" || fill === "transparent";
  return (
    <button
      type="button"
      aria-label={label ?? (fillOnly ? "Color" : "Fill and stroke")}
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "klever-focus relative h-10 w-10 shrink-0 rounded-xl transition-colors",
        "hover:bg-paper-2",
        open && "bg-paper-2",
      )}
    >
      {!fillOnly && (
        <span
          className="absolute bottom-1 right-1 h-[22px] w-[22px] overflow-hidden rounded-full bg-paper"
          style={
            strokeNone
              ? { boxShadow: "inset 0 0 0 1.5px color-mix(in srgb, var(--color-ink) 35%, transparent)" }
              : { boxShadow: `inset 0 0 0 5px ${strokeCss}` }
          }
          aria-hidden
        >
          {strokeNone && (
            <span className="absolute inset-x-0 top-1/2 h-px origin-center -rotate-45 bg-ink/45" />
          )}
        </span>
      )}
      <span
        className={cn(
          "absolute rounded-full border border-ink/10",
          fillOnly ? "inset-2" : "left-1.5 top-1.5 h-[18px] w-[18px]",
        )}
        style={{
          background: none
            ? "repeating-conic-gradient(color-mix(in srgb, var(--color-ink) 12%, transparent) 0 25%, transparent 0 50%)"
            : fillCss,
          backgroundSize: none ? "8px 8px" : undefined,
        }}
        aria-hidden
      />
    </button>
  );
}

export function PigmentGrid({
  value,
  onChange,
  pigments = PIGMENTS,
  allowNone,
  noneLabel = "None",
  extra,
}: {
  value: string;
  onChange: (id: string) => void;
  pigments?: { id: string; label: string; hex: string }[];
  allowNone?: boolean;
  noneLabel?: string;
  extra?: ReactNode;
}) {
  const noneOn = value === "none" || value === "transparent" || !value;
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button
          type="button"
          title={noneLabel}
          aria-label={noneLabel}
          aria-pressed={noneOn}
          onClick={() => onChange("none")}
          className={cn(
            "klever-focus relative h-7 w-7 overflow-hidden rounded-full border border-line bg-paper",
            noneOn && "ring-2 ring-ink/35 ring-offset-2 ring-offset-paper",
          )}
        >
          <svg viewBox="0 0 28 28" className="absolute inset-0 h-full w-full text-ink/55" aria-hidden>
            <line x1="7" y1="21" x2="21" y2="7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {pigments.map((p) => {
        const on = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            title={p.label}
            aria-label={p.label}
            aria-pressed={on}
            onClick={() => onChange(p.id)}
            className={cn(
              "klever-focus h-7 w-7 rounded-full border border-ink/10 transition-transform duration-150",
              "hover:scale-110 active:scale-95",
              on && "ring-2 ring-ink/35 ring-offset-2 ring-offset-paper",
            )}
            style={{ backgroundColor: p.hex }}
          />
        );
      })}
      {extra}
    </div>
  );
}

function CustomHex({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (hex: string) => void;
}) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : pigmentHex(value);
  return (
    <label
      title={label}
      className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-dashed border-ink/25"
      style={{
        background:
          "conic-gradient(from 90deg, #c45c48, #c9923a, #4f8a78, #3d4f73, #8b7aa8, #c45c48)",
      }}
    >
      <span className="sr-only">{label}</span>
      <span className="absolute inset-[5px] rounded-full bg-paper" style={{ backgroundColor: hex }} />
      <input
        type="color"
        value={hex}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function WeightSlider({
  value,
  min,
  max,
  step = 0.5,
  onChange,
  sample,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  sample?: CSSProperties;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-8 shrink-0 rounded-full bg-ink"
        style={{ height: Math.max(1, Math.min(10, value)), ...sample }}
        aria-hidden
      />
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label="Weight"
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-line accent-ink"
      />
      <span className="w-8 font-mono text-[10px] tabular-nums text-faint">{value}</span>
    </div>
  );
}

function DashPicker({
  value,
  onChange,
}: {
  value: FreeformStrokeDash;
  onChange: (d: FreeformStrokeDash) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Line">
      {STROKE_DASHES.map((d) => {
        const on = value === d.id;
        const dash = d.id === "dashed" ? "6 4" : d.id === "dotted" ? "1.5 3" : undefined;
        return (
          <button
            key={d.id}
            type="button"
            title={d.label}
            aria-label={d.label}
            aria-pressed={on}
            onClick={() => onChange(d.id)}
            className={cn(
              "klever-focus flex h-8 w-12 items-center justify-center rounded-lg border border-line",
              on ? "bg-paper-2 ring-1 ring-ink/15" : "hover:bg-paper-2",
            )}
          >
            <svg width="28" height="8" aria-hidden>
              <line
                x1="2"
                y1="4"
                x2="26"
                y2="4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeDasharray={dash}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export function ShapeTray({
  value,
  onChange,
}: {
  value: FreeformShapeKind;
  onChange: (k: FreeformShapeKind) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1" role="listbox" aria-label="Shape">
      {SHAPE_KINDS.map((k) => {
        const on = value === k.id;
        return (
          <button
            key={k.id}
            type="button"
            role="option"
            aria-selected={on}
            title={k.label}
            aria-label={k.label}
            onClick={() => onChange(k.id)}
            className={cn(
              "klever-focus flex h-12 items-center justify-center rounded-xl border border-transparent transition-colors",
              on ? "border-line bg-paper-2" : "hover:bg-paper-2/80",
            )}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
              <ShapeGraphic
                kind={k.id}
                w={28}
                h={28}
                fill={on ? "ink" : "none"}
                stroke="ink"
                strokeWidth={1.4}
                strokeDash="solid"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function StudioLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{children}</p>
  );
}

export function ShapeStudio({
  kind,
  fill,
  stroke,
  width,
  dash,
  onKind,
  onFill,
  onStroke,
  onWidth,
  onDash,
  showGeometry = true,
  showLabel,
  onShowLabel,
}: {
  kind: FreeformShapeKind;
  fill: string;
  stroke: string;
  width: number;
  dash: FreeformStrokeDash;
  onKind: (k: FreeformShapeKind) => void;
  onFill: (id: string) => void;
  onStroke: (id: string) => void;
  onWidth: (n: number) => void;
  onDash: (d: FreeformStrokeDash) => void;
  showGeometry?: boolean;
  showLabel?: boolean;
  onShowLabel?: (on: boolean) => void;
}) {
  const [layer, setLayer] = useState<"fill" | "stroke">("fill");
  return (
    <div className="w-[17.5rem]">
      {showGeometry && (
        <>
          <StudioLabel>Geometry</StudioLabel>
          <ShapeTray value={kind} onChange={onKind} />
        </>
      )}
      <div className={cn("flex rounded-xl bg-paper-2 p-0.5", showGeometry && "mt-3")}>
        {(
          [
            { id: "fill" as const, label: "Fill" },
            { id: "stroke" as const, label: "Stroke" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={layer === t.id}
            onClick={() => setLayer(t.id)}
            className={cn(
              "klever-focus flex-1 rounded-[10px] py-1.5 font-serif text-sm",
              layer === t.id ? "bg-paper text-ink shadow-sm" : "text-mute hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <PigmentGrid
          value={layer === "fill" ? fill : stroke}
          onChange={layer === "fill" ? onFill : onStroke}
          allowNone
          noneLabel={layer === "fill" ? "None" : "No stroke"}
          extra={
            <CustomHex
              value={layer === "fill" ? fillPickerHex(fill) : strokePickerHex(stroke)}
              label={layer === "fill" ? "Custom fill" : "Custom stroke"}
              onChange={layer === "fill" ? onFill : onStroke}
            />
          }
        />
      </div>
      {layer === "stroke" && stroke !== "none" && stroke !== "transparent" && (
        <div className="mt-3 space-y-2.5">
          <WeightSlider value={width} min={1} max={8} step={1} onChange={onWidth} />
          <DashPicker value={dash} onChange={onDash} />
        </div>
      )}
      {onShowLabel && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Label</p>
          <button
            type="button"
            role="switch"
            aria-checked={showLabel !== false}
            aria-label="Show shape label"
            onClick={() => onShowLabel(!(showLabel !== false))}
            className={cn(
              "klever-focus relative h-6 w-10 shrink-0 rounded-full transition-colors",
              showLabel !== false ? "bg-ink" : "bg-line",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform",
                showLabel !== false && "translate-x-4",
              )}
            />
          </button>
        </div>
      )}
    </div>
  );
}

export function InkStudio({
  tool,
  color,
  width,
  swatches,
  minW,
  maxW,
  onTool,
  onColor,
  onWidth,
}: {
  tool: InkTool;
  color: string;
  width: number;
  swatches: { id: string; label: string; hex: string }[];
  minW: number;
  maxW: number;
  onTool: (t: InkTool) => void;
  onColor: (id: string) => void;
  onWidth: (n: number) => void;
}) {
  return (
    <div className="w-[16.5rem]">
      <div className="mb-3 flex gap-0.5 rounded-xl bg-paper-2 p-0.5">
        {(
          [
            { id: "pen" as const, label: "Pen", icon: Pencil },
            { id: "highlighter" as const, label: "Marker", icon: Highlighter },
            { id: "eraser" as const, label: "Eraser", icon: Eraser },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const on = tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onTool(t.id)}
              className={cn(
                "klever-focus flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-xs font-medium",
                on ? "bg-paper text-ink shadow-sm" : "text-mute hover:text-ink",
              )}
            >
              <Icon size={13} strokeWidth={1.5} />
              {t.label}
            </button>
          );
        })}
      </div>
      {tool !== "eraser" && (
        <>
          <PigmentGrid
            value={color}
            onChange={onColor}
            pigments={swatches}
            extra={<CustomHex value={strokePickerHex(color)} label="Custom ink" onChange={onColor} />}
          />
          <div className="mt-3">
            <WeightSlider
              value={width}
              min={minW}
              max={maxW}
              step={tool === "highlighter" ? 2 : 0.5}
              onChange={onWidth}
              sample={
                tool === "highlighter"
                  ? { backgroundColor: strokePickerHex(color), opacity: HIGHLIGHTER_OPACITY + 0.35 }
                  : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

export function StickyStudio({
  color,
  onColor,
}: {
  color: string;
  onColor: (id: string) => void;
}) {
  return (
    <div className="w-[16rem]">
      <StudioLabel>Paper</StudioLabel>
      <PigmentGrid
        value={color}
        onChange={onColor}
        pigments={STICKY_COLORS}
        extra={<CustomHex value={pigmentHex(color)} label="Custom paper" onChange={onColor} />}
      />
    </div>
  );
}

type TextObj = Extract<FreeformObject, { type: "text" | "sticky" | "mind" | "shape" }>;

export function TypeStudio({
  obj,
  sizes,
  colorKey,
  onPatch,
  onEdit,
}: {
  obj: TextObj;
  sizes: readonly number[];
  colorKey: "color" | "textColor";
  onPatch: (id: string, patch: Partial<FreeformObject>) => void;
  onEdit: (id: string) => void;
}) {
  const font = obj.fontFamily ?? (obj.type === "shape" ? "sans" : "serif");
  const color =
    colorKey === "textColor"
      ? (obj.type === "sticky" ? obj.textColor : undefined) ?? "ink"
      : (obj.type === "text" || obj.type === "mind" || obj.type === "shape" ? obj.color : undefined) ??
        "ink";
  const size =
    obj.fontSize ?? (obj.type === "text" ? 16 : 14);
  const pickerValue =
    colorKey === "textColor" && obj.type === "sticky"
      ? resolveStickyTextColor(obj.textColor, obj.color).color
      : obj.type === "shape"
        ? resolveShapeTextColor(obj.color, obj.fill).color
        : textColorHex(color);

  const apply = (patch: Record<string, unknown>) => {
    if (obj.type === "mind" && typeof patch.text === "string") {
      onPatch(obj.id, {
        ...patch,
        h: mindNodeHeight(patch.text, typeof patch.fontSize === "number" ? patch.fontSize : (obj.fontSize ?? 14)),
      } as Partial<FreeformObject>);
      return;
    }
    if (obj.type === "mind" && typeof patch.fontSize === "number") {
      onPatch(obj.id, {
        ...patch,
        h: mindNodeHeight(obj.text, patch.fontSize),
      } as Partial<FreeformObject>);
      return;
    }
    onPatch(obj.id, patch as Partial<FreeformObject>);
  };

  const idx = sizes.indexOf(size as (typeof sizes)[number]);
  const at = idx >= 0 ? idx : sizes.findIndex((s) => s >= size);

  return (
    <div className="w-[17rem] space-y-3">
      {obj.type === "shape" && (
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Label</p>
          <button
            type="button"
            role="switch"
            aria-checked={obj.showLabel !== false}
            aria-label="Show shape label"
            onClick={() => apply({ showLabel: obj.showLabel === false })}
            className={cn(
              "klever-focus relative h-6 w-10 shrink-0 rounded-full transition-colors",
              obj.showLabel !== false ? "bg-ink" : "bg-line",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform",
                obj.showLabel !== false && "translate-x-4",
              )}
            />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Smaller"
          disabled={at <= 0}
          className="klever-focus flex h-8 w-8 items-center justify-center rounded-lg text-mute hover:bg-paper-2 hover:text-ink disabled:opacity-30"
          onClick={() => apply({ fontSize: sizes[Math.max(0, at - 1)] })}
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <span className="min-w-10 text-center font-serif text-lg tabular-nums text-ink">{size}</span>
        <button
          type="button"
          aria-label="Larger"
          disabled={at < 0 || at >= sizes.length - 1}
          className="klever-focus flex h-8 w-8 items-center justify-center rounded-lg text-mute hover:bg-paper-2 hover:text-ink disabled:opacity-30"
          onClick={() => apply({ fontSize: sizes[Math.min(sizes.length - 1, Math.max(0, at) + 1)] })}
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
        <span className="ml-auto flex rounded-lg bg-paper-2 p-0.5">
          {BOARD_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              title={f.label}
              aria-pressed={font === f.id}
              onClick={() => apply({ fontFamily: f.id as PageFont })}
              className={cn(
                "klever-focus rounded-md px-2 py-1 text-[11px] text-mute",
                f.className,
                font === f.id && "bg-paper text-ink shadow-sm",
              )}
            >
              {f.label}
            </button>
          ))}
        </span>
      </div>
      <PigmentGrid
        value={color}
        onChange={(id) => apply({ [colorKey]: id })}
        extra={<CustomHex value={pickerValue} label="Custom text color" onChange={(hex) => apply({ [colorKey]: hex })} />}
      />
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
            <IconButton
              key={t.key}
              aria-label={t.label}
              active={t.on}
              onClick={() => apply({ [t.key]: !t.on })}
            >
              <Icon size={14} strokeWidth={1.5} />
            </IconButton>
          );
        })}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        {(
          [
            { id: "left" as const, label: "Align left", icon: AlignLeft },
            { id: "center" as const, label: "Align center", icon: AlignCenter },
            { id: "right" as const, label: "Align right", icon: AlignRight },
          ] as const
        ).map((a) => {
          const Icon = a.icon;
          const def = obj.type === "mind" || obj.type === "shape" ? "center" : "left";
          return (
            <IconButton
              key={a.id}
              aria-label={a.label}
              active={(obj.align ?? def) === a.id}
              onClick={() => apply({ align: a.id as TextAlign })}
            >
              <Icon size={14} strokeWidth={1.5} />
            </IconButton>
          );
        })}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        {(
          [
            { id: "top" as const, label: "Top", icon: AlignVerticalJustifyStart },
            { id: "middle" as const, label: "Middle", icon: AlignVerticalJustifyCenter },
            { id: "bottom" as const, label: "Bottom", icon: AlignVerticalJustifyEnd },
          ] as const
        ).map((a) => {
          const Icon = a.icon;
          const def = obj.type === "mind" || obj.type === "shape" ? "middle" : "top";
          return (
            <IconButton
              key={a.id}
              aria-label={a.label}
              active={(obj.valign ?? def) === a.id}
              onClick={() => apply({ valign: a.id as TextVAlign })}
            >
              <Icon size={14} strokeWidth={1.5} />
            </IconButton>
          );
        })}
      </div>
      <button
        type="button"
        className="klever-focus inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-mute hover:bg-paper-2 hover:text-ink"
        onClick={() => {
          apply({ text: insertParagraphBreak(obj.text) });
          onEdit(obj.id);
        }}
      >
        <Pilcrow size={12} strokeWidth={1.5} />
        New paragraph
      </button>
    </div>
  );
}

export function ArrangeStudio({
  multi,
  onForward,
  onFront,
  onBackward,
  onBack,
  onAlign,
}: {
  multi: boolean;
  onForward: () => void;
  onFront: () => void;
  onBackward: () => void;
  onBack: () => void;
  onAlign: (edge: AlignEdge) => void;
}) {
  return (
    <div className="w-52 space-y-2">
      <StudioLabel>Stack</StudioLabel>
      <div className="flex gap-0.5">
        <IconButton aria-label="Bring forward" onClick={onForward}>
          <Layers size={14} strokeWidth={1.5} />
        </IconButton>
        <IconButton aria-label="Bring to front" onClick={onFront}>
          <BringToFront size={14} strokeWidth={1.5} />
        </IconButton>
        <IconButton aria-label="Send backward" onClick={onBackward}>
          <SendToBack size={14} strokeWidth={1.5} className="rotate-180" />
        </IconButton>
        <IconButton aria-label="Send to back" onClick={onBack}>
          <SendToBack size={14} strokeWidth={1.5} />
        </IconButton>
      </div>
      {multi && (
        <>
          <StudioLabel>Align</StudioLabel>
          <div className="flex flex-wrap gap-0.5">
            {(
              [
                { edge: "left" as const, label: "Left", icon: AlignStartVertical },
                { edge: "center" as const, label: "Center", icon: AlignCenterVertical },
                { edge: "right" as const, label: "Right", icon: AlignEndVertical },
                { edge: "top" as const, label: "Top", icon: AlignStartHorizontal },
                { edge: "middle" as const, label: "Middle", icon: AlignCenterHorizontal },
                { edge: "bottom" as const, label: "Bottom", icon: AlignEndHorizontal },
              ] as const
            ).map((a) => {
              const Icon = a.icon;
              return (
                <IconButton key={a.edge} aria-label={a.label} onClick={() => onAlign(a.edge)}>
                  <Icon size={14} strokeWidth={1.5} />
                </IconButton>
              );
            })}
          </div>
        </>
      )}
    </div>
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
