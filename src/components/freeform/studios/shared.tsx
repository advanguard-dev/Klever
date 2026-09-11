import { ShapeGraphic } from "@/components/freeform/BoardObject";
import {
  PIGMENTS,
  SHAPE_KINDS,
  STROKE_DASHES,
  fillPickerHex,
  pigmentHex,
  strokePickerHex,
} from "@/components/freeform/board-model";
import { cn } from "@/lib/cn";
import type { FreeformShapeKind, FreeformStrokeDash } from "@/types";
import { useId, type CSSProperties, type ReactNode } from "react";

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

export function CustomHex({
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

export function WeightSlider({
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

export function DashPicker({
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

export function StudioLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{children}</p>
  );
}
