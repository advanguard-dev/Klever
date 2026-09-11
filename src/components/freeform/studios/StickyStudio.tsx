import { CustomHex, PigmentGrid, StudioLabel } from "@/components/freeform/studios/shared";
import { pigmentHex, STICKY_COLORS } from "@/components/freeform/board-model";

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
