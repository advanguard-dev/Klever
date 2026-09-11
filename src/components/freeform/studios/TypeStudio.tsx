import { CustomHex, PigmentGrid } from "@/components/freeform/studios/shared";
import {
  BOARD_FONTS,
  insertParagraphBreak,
  mindNodeHeight,
  resolveShapeTextColor,
  resolveStickyTextColor,
  textColorHex,
} from "@/components/freeform/board-model";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type {
  FreeformObject,
  PageFont,
  TextAlign,
  TextVAlign,
} from "@/types";
import type { FreeformPatch } from "@/lib/freeform-patch";
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
  Pilcrow,
  Plus,
  Strikethrough,
} from "lucide-react";

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
  onPatch: (id: string, patch: FreeformPatch) => void;
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

  const apply = (patch: FreeformPatch) => {
    const bag = patch as { text?: unknown; fontSize?: unknown };
    if (obj.type === "mind" && typeof bag.text === "string") {
      onPatch(obj.id, {
        ...patch,
        h: mindNodeHeight(
          bag.text,
          typeof bag.fontSize === "number" ? bag.fontSize : (obj.fontSize ?? 14),
        ),
      });
      return;
    }
    if (obj.type === "mind" && typeof bag.fontSize === "number") {
      onPatch(obj.id, {
        ...patch,
        h: mindNodeHeight(obj.text, bag.fontSize),
      });
      return;
    }
    onPatch(obj.id, patch);
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
