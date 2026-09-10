import {
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";

interface FolderProps {
  color?: string;
  size?: number;
  items?: ReactNode[];
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
}

function darkenColor(hex: string, percent: number): string {
  let color = hex.startsWith("#") ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(color.slice(0, 6), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** React Bits Folder — TS + Tailwind, recolored for Klever paper/ink. */
export default function Folder({
  color = "#6b5e4e",
  size = 1,
  items = [],
  className = "",
  open: openProp,
  onOpenChange,
  label = "Sample vault folder",
}: FolderProps) {
  const reduce = usePrefersReducedMotion();
  const [uncontrolled, setUncontrolled] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolled;

  const maxItems = 3;
  const papers = items.slice(0, maxItems);
  while (papers.length < maxItems) papers.push(null);

  const [paperOffsets, setPaperOffsets] = useState(
    Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })),
  );

  const folderBackColor = darkenColor(color, 0.08);
  const paper1 = "#e9ebe6";
  const paper2 = "#f4f5f2";
  const paper3 = "#f7f8f5";

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolled(next);
    onOpenChange?.(next);
    if (!next) {
      setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })));
    }
  };

  const handleClick = () => setOpen(!open);

  const handlePaperMouseMove = (e: MouseEvent<HTMLDivElement>, index: number) => {
    if (!open || reduce) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = (e.clientX - (rect.left + rect.width / 2)) * 0.15;
    const offsetY = (e.clientY - (rect.top + rect.height / 2)) * 0.15;
    setPaperOffsets((prev) => {
      const next = [...prev];
      next[index] = { x: offsetX, y: offsetY };
      return next;
    });
  };

  const handlePaperMouseLeave = (_e: MouseEvent<HTMLDivElement>, index: number) => {
    setPaperOffsets((prev) => {
      const next = [...prev];
      next[index] = { x: 0, y: 0 };
      return next;
    });
  };

  const duration = reduce ? "duration-0" : "duration-300";

  const getOpenTransform = (index: number) => {
    if (index === 0) return "translate(-120%, -70%) rotate(-15deg)";
    if (index === 1) return "translate(10%, -70%) rotate(15deg)";
    if (index === 2) return "translate(-50%, -100%) rotate(5deg)";
    return "";
  };

  return (
    <div className={cn("inline-block", className)} style={{ transform: `scale(${size})` }}>
      <button
        type="button"
        className={cn(
          "group relative rounded-md border-0 bg-transparent p-0 transition-transform ease-out klever-focus",
          duration,
          !open && !reduce && "hover:-translate-y-2",
          open && !reduce && "-translate-y-2",
        )}
        style={
          {
            "--folder-color": color,
            "--folder-back-color": folderBackColor,
          } as CSSProperties
        }
        onClick={handleClick}
        aria-expanded={open}
        aria-label={open ? `Close ${label}` : `Open ${label}`}
      >
        <div
          className="relative h-[80px] w-[100px] rounded-br-[10px] rounded-tr-[10px] rounded-bl-[10px]"
          style={{ backgroundColor: folderBackColor }}
        >
          <span
            className="absolute bottom-[98%] left-0 z-0 h-[10px] w-[30px] rounded-tl-[5px] rounded-tr-[5px]"
            style={{ backgroundColor: folderBackColor }}
          />
          {papers.map((item, i) => {
            const sizeClasses =
              i === 0
                ? "w-[70%] h-[80%]"
                : i === 1
                  ? "w-[80%] h-[80%]"
                  : "w-[90%] h-[80%]";
            const closedHeight = i === 0 ? "h-[80%]" : i === 1 ? "h-[70%]" : "h-[60%]";
            const transformStyle = open
              ? `${getOpenTransform(i)} translate(${paperOffsets[i].x}px, ${paperOffsets[i].y}px)`
              : undefined;

            return (
              <div
                key={i}
                onMouseMove={(e) => handlePaperMouseMove(e, i)}
                onMouseLeave={(e) => handlePaperMouseLeave(e, i)}
                className={cn(
                  "absolute bottom-[10%] left-1/2 z-20 overflow-hidden rounded-[10px] transition-all ease-in-out",
                  duration,
                  !open && "-translate-x-1/2 translate-y-[10%] group-hover:translate-y-0",
                  open && "hover:scale-110",
                  sizeClasses,
                  !open && closedHeight,
                )}
                style={{
                  ...(open ? { transform: transformStyle } : {}),
                  backgroundColor: i === 0 ? paper1 : i === 1 ? paper2 : paper3,
                }}
              >
                {item}
              </div>
            );
          })}
          <div
            className={cn(
              "absolute z-30 h-full w-full origin-bottom transition-all ease-in-out",
              duration,
              !open && !reduce && "group-hover:[transform:skew(15deg)_scaleY(0.6)]",
            )}
            style={{
              backgroundColor: color,
              borderRadius: "5px 10px 10px 10px",
              ...(open ? { transform: "skew(15deg) scaleY(0.6)" } : {}),
            }}
          />
          <div
            className={cn(
              "absolute z-30 h-full w-full origin-bottom transition-all ease-in-out",
              duration,
              !open && !reduce && "group-hover:[transform:skew(-15deg)_scaleY(0.6)]",
            )}
            style={{
              backgroundColor: color,
              borderRadius: "5px 10px 10px 10px",
              ...(open ? { transform: "skew(-15deg) scaleY(0.6)" } : {}),
            }}
          />
        </div>
      </button>
    </div>
  );
}
