import { StudioLabel } from "@/components/freeform/studios/shared";
import type { AlignEdge } from "@/components/freeform/board-ops";
import { IconButton } from "@/components/ui";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BringToFront,
  Layers,
  SendToBack,
} from "lucide-react";

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
