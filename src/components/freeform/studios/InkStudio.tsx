import { CustomHex, PigmentGrid, WeightSlider } from "@/components/freeform/studios/shared";
import {
  type InkTool,
  HIGHLIGHTER_OPACITY,
  strokePickerHex,
} from "@/components/freeform/board-model";
import { cn } from "@/lib/cn";
import { Eraser, Highlighter, Pencil } from "lucide-react";

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
