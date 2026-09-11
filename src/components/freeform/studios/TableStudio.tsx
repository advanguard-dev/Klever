import { CustomHex, PigmentGrid, StudioLabel } from "@/components/freeform/studios/shared";
import { BOARD_FONTS, textColorHex } from "@/components/freeform/board-model";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PageFont, TableCellStyle } from "@/types";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
  Italic,
  Minus,
  Plus,
  Strikethrough,
} from "lucide-react";

const TABLE_FNS = ["SUM", "AVERAGE", "MIN", "MAX", "COUNT"] as const;

export function TableStudio({
  style,
  sizes,
  selection,
  onStyle,
  onFn,
}: {
  style: TableCellStyle;
  sizes: readonly number[];
  selection?: string;
  onStyle: (patch: TableCellStyle) => void;
  onFn: (fn: (typeof TABLE_FNS)[number]) => void;
}) {
  const font = style.fontFamily ?? "sans";
  const color = style.color ?? "ink";
  const size = style.fontSize ?? 13;
  const idx = sizes.indexOf(size as (typeof sizes)[number]);
  const at = idx >= 0 ? idx : sizes.findIndex((s) => s >= size);

  return (
    <div className="w-[17rem] space-y-3">
      {selection && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{selection}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Smaller"
          disabled={at <= 0}
          className="klever-focus flex h-8 w-8 items-center justify-center rounded-lg text-mute hover:bg-paper-2 hover:text-ink disabled:opacity-30"
          onClick={() => onStyle({ fontSize: sizes[Math.max(0, at - 1)] })}
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <span className="min-w-10 text-center font-serif text-lg tabular-nums text-ink">{size}</span>
        <button
          type="button"
          aria-label="Larger"
          disabled={at < 0 || at >= sizes.length - 1}
          className="klever-focus flex h-8 w-8 items-center justify-center rounded-lg text-mute hover:bg-paper-2 hover:text-ink disabled:opacity-30"
          onClick={() => onStyle({ fontSize: sizes[Math.min(sizes.length - 1, Math.max(0, at) + 1)] })}
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
              onClick={() => onStyle({ fontFamily: f.id as PageFont })}
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
        onChange={(id) => onStyle({ color: id })}
        extra={<CustomHex value={textColorHex(color)} label="Custom text color" onChange={(hex) => onStyle({ color: hex })} />}
      />
      <div className="flex items-center gap-0.5">
        {(
          [
            { key: "bold" as const, label: "Bold", icon: Bold, on: !!style.bold },
            { key: "italic" as const, label: "Italic", icon: Italic, on: !!style.italic },
            { key: "strike" as const, label: "Strikethrough", icon: Strikethrough, on: !!style.strike },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <IconButton
              key={t.key}
              aria-label={t.label}
              active={t.on}
              onClick={() => onStyle({ [t.key]: !t.on })}
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
          return (
            <IconButton
              key={a.id}
              aria-label={a.label}
              active={(style.align ?? "left") === a.id}
              onClick={() => onStyle({ align: a.id })}
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
          return (
            <IconButton
              key={a.id}
              aria-label={a.label}
              active={(style.valign ?? "middle") === a.id}
              onClick={() => onStyle({ valign: a.id })}
            >
              <Icon size={14} strokeWidth={1.5} />
            </IconButton>
          );
        })}
      </div>
      <div>
        <StudioLabel>Functions</StudioLabel>
        <div className="flex flex-wrap gap-1">
          {TABLE_FNS.map((fn) => (
            <button
              key={fn}
              type="button"
              className="klever-focus rounded-md bg-paper-2 px-2 py-1 font-mono text-[10px] text-mute hover:bg-line hover:text-ink"
              onClick={() => onFn(fn)}
            >
              {fn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
