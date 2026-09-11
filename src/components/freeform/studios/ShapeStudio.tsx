import {
  CustomHex,
  DashPicker,
  PigmentGrid,
  ShapeTray,
  StudioLabel,
  WeightSlider,
} from "@/components/freeform/studios/shared";
import { fillPickerHex, strokePickerHex } from "@/components/freeform/board-model";
import { cn } from "@/lib/cn";
import type { FreeformShapeKind, FreeformStrokeDash } from "@/types";
import { useState } from "react";

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
