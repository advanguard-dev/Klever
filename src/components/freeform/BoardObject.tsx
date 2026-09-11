import { BoardTable } from "@/components/freeform/BoardTable";
import { openNote } from "@/components/editor/WikiPeek";
import {
  boardEmphasisClass,
  boardFontClass,
  fillValue,
  inkStrokeValue,
  isNonePaint,
  polyToPointsAttr,
  resolveShapeTextColor,
  resolveStickyTextColor,
  shapeOutline,
  stickyBgHex,
  strokeDashArray,
  textAlignClass,
  textColorClass,
  textVAlignClass,
} from "@/components/freeform/board-model";
import { RESIZE_HANDLES, type ResizeHandle } from "@/components/freeform/board-ops";
import { Panel } from "@/components/ui";
import { resolveAssetSrc } from "@/lib/assets";
import { cn } from "@/lib/cn";
import { plainSnippet } from "@/lib/parse";
import { useApp } from "@/store";
import type { FreeformPatch } from "@/lib/freeform-patch";
import type { FreeformObject, FreeformShapeKind, FreeformStrokeDash } from "@/types";
import { Database, ExternalLink, File, FileText, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  obj: FreeformObject;
  selected: boolean;
  editing: boolean;
  /** When false, object ignores pointer (draw/pan modes). */
  interactive?: boolean;
  onSelect: (id: string, additive?: boolean) => void;
  onEdit: (id: string | null) => void;
  onDragStart: (e: ReactPointerEvent, id: string) => void;
  onResizeStart?: (e: ReactPointerEvent, id: string, handle: ResizeHandle) => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: FreeformPatch) => void;
  onMindConnect?: (parentId: string) => void;
  onContextMenu?: (e: ReactMouseEvent, obj: FreeformObject) => void;
  onTableRange?: (range: { r0: number; c0: number; r1: number; c1: number }) => void;
};

export function BoardObject({
  obj,
  selected,
  editing,
  interactive = true,
  onSelect,
  onEdit,
  onDragStart,
  onResizeStart,
  onRemove,
  onPatch,
  onMindConnect,
  onContextMenu,
  onTableRange,
}: Props) {
  const blobs = useApp((s) => s.blobs);
  const notes = useApp((s) => s.notes);
  const ensureBlob = useApp((s) => s.ensureBlob);

  const shell = cn(
    "absolute overflow-visible select-none",
    !interactive && "pointer-events-none",
    selected && "is-board-sel",
  );

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (editing || !interactive) return;
    e.stopPropagation();
    onSelect(obj.id, e.shiftKey);
    onDragStart(e, obj.id);
  };

  const handleContextMenu = (e: ReactMouseEvent) => {
    if (!interactive) return;
    onContextMenu?.(e, obj);
  };

  const chrome = selected && interactive && (obj.type === "table" || !editing) && (
    <>
      <button
        type="button"
        aria-label="Remove"
        data-board-ui=""
        className="klever-focus pointer-events-auto absolute left-full top-0 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper text-mute shadow-sm hover:text-ink"
        style={{
          transform: "translate(6px, calc(-100% - 6px)) scale(var(--board-ui-scale))",
          transformOrigin: "bottom left",
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(obj.id);
        }}
      >
        <X size={12} strokeWidth={1.5} />
      </button>
      {onResizeStart && (
        <ResizeHandles
          onPointerDown={(e, handle) => onResizeStart(e, obj.id, handle)}
        />
      )}
    </>
  );

  if (obj.type === "path") {
    const d = obj.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
    return (
      <div
        className={shell}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: obj.z }}
        data-board-object=""
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
      >
        {chrome}
        <svg width={obj.w} height={obj.h} className="overflow-visible">
          <path
            d={d}
            fill="none"
            stroke={inkStrokeValue(obj.stroke)}
            strokeWidth={obj.strokeWidth}
            strokeOpacity={obj.opacity ?? 1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (obj.type === "text") {
    const fontSize = obj.fontSize ?? 16;
    const colorCls = textColorClass(obj.color);
    const fontCls = boardFontClass(obj.fontFamily);
    const emphCls = boardEmphasisClass(obj);
    const customHex = obj.color && /^#[0-9a-fA-F]{6}$/.test(obj.color) ? obj.color : undefined;
    const textStyle = {
      fontSize: `${fontSize}px`,
      lineHeight: 1.45,
      ...(customHex ? { color: customHex } : {}),
    } as const;

    return (
      <div
        className={cn(
          "absolute overflow-visible select-none",
          !interactive && "pointer-events-none",
          selected && !editing && "is-board-sel-dash",
        )}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, minHeight: obj.h, zIndex: obj.z }}
        data-board-object=""
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(obj.id);
        }}
      >
        {chrome}
        <div
          className={cn(
            "flex h-full w-full flex-col",
            textAlignClass(obj.align, "text"),
            textVAlignClass(obj.valign, "text"),
          )}
        >
        {editing ? (
          <textarea
            autoFocus
            className={cn(
              "h-full min-h-[2.75rem] w-full min-w-[12rem] resize-none rounded-md bg-paper/70 px-1.5 py-1 outline-none ring-1 ring-ink/25",
              fontCls,
              emphCls,
              colorCls,
              textAlignClass(obj.align, "text"),
            )}
            style={textStyle}
            rows={Math.max(2, obj.text.split("\n").length)}
            value={obj.text}
            onChange={(e) => onPatch(obj.id, { text: e.target.value })}
            onBlur={() => onEdit(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEdit(null);
            }}
          />
        ) : (
          <p
            className={cn(
              "min-h-[2.75rem] w-full min-w-[12rem] whitespace-pre-wrap break-words rounded-md px-1.5 py-1",
              fontCls,
              emphCls,
              colorCls,
              !obj.text && "ring-1 ring-ink/20 bg-paper/50",
            )}
            style={textStyle}
          >
            {obj.text}
          </p>
        )}
        </div>
      </div>
    );
  }

  if (obj.type === "sticky") {
    const fontSize = obj.fontSize ?? 14;
    const fontCls = boardFontClass(obj.fontFamily);
    const emphCls = boardEmphasisClass(obj);
    const stickyPaint = resolveStickyTextColor(obj.textColor, obj.color);
    const textStyle = {
      fontSize: `${fontSize}px`,
      lineHeight: 1.4,
      color: stickyPaint.color,
    } as const;

    return (
      <div
        className={cn(
          shell,
          "rounded-xl px-3 py-3 shadow-[0_1px_0_rgba(21,23,22,0.06),0_14px_28px_-18px_rgba(21,23,22,0.35)]",
        )}
        style={{
          left: obj.x,
          top: obj.y,
          width: obj.w,
          height: obj.h,
          zIndex: obj.z,
          backgroundColor: stickyBgHex(obj.color),
        }}
        data-board-object=""
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(obj.id);
        }}
      >
        {chrome}
        <div
          className={cn(
            "flex h-full w-full min-h-0 flex-col",
            textAlignClass(obj.align, "sticky"),
            textVAlignClass(obj.valign, "sticky"),
          )}
        >
        {editing ? (
          <textarea
            autoFocus
            className={cn(
              "h-full w-full resize-none bg-transparent leading-snug outline-none",
              fontCls,
              emphCls,
              textAlignClass(obj.align, "sticky"),
            )}
            style={textStyle}
            value={obj.text}
            onChange={(e) => onPatch(obj.id, { text: e.target.value })}
            onBlur={() => onEdit(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEdit(null);
            }}
          />
        ) : (
          <p
            className={cn(
              "w-full overflow-hidden whitespace-pre-wrap leading-snug",
              fontCls,
              emphCls,
            )}
            style={textStyle}
          >
            {obj.text || <span className="opacity-40">Sticky note</span>}
          </p>
        )}
        </div>
      </div>
    );
  }

  if (obj.type === "image") {
    return (
      <BoardImage
        obj={obj}
        src={resolveAssetSrc(obj.src, blobs)}
        ensureBlob={ensureBlob}
        shell={shell}
        chrome={chrome}
        handlePointerDown={handlePointerDown}
        handleContextMenu={handleContextMenu}
      />
    );
  }

  if (obj.type === "link") {
    return (
      <div
        className={cn(shell, "rounded-xl border border-line bg-paper px-3 py-2.5")}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, minHeight: obj.h, zIndex: obj.z }}
        data-board-object=""
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(obj.id);
        }}
      >
        {chrome}
        {editing ? (
          <div className="space-y-1.5" onPointerDown={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="w-full rounded-md border border-line bg-paper-2 px-2 py-1 font-mono text-xs text-ink outline-none"
              value={obj.url}
              onChange={(e) => {
                const url = e.target.value;
                let title = obj.title;
                try {
                  title = new URL(url).hostname || title;
                } catch {
                  /* keep */
                }
                onPatch(obj.id, { url, title });
              }}
              onBlur={() => onEdit(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") onEdit(null);
              }}
              placeholder="https://"
            />
          </div>
        ) : (
          <div className="flex items-start gap-2 text-ink">
            <ExternalLink size={14} strokeWidth={1.4} className="pointer-events-none mt-0.5 shrink-0 text-mute" />
            <span className="min-w-0">
              <a
                href={obj.url.startsWith("http") ? obj.url : `https://${obj.url}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-serif text-sm underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {obj.title || "Link"}
              </a>
              <span className="block truncate font-mono text-[10px] text-faint">{obj.url}</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  if (obj.type === "table") {
    return (
      <BoardTable
        obj={obj}
        selected={selected}
        editing={editing}
        interactive={interactive}
        shell={shell}
        chrome={chrome}
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onEdit={onEdit}
        onPatch={onPatch}
        onRangeChange={onTableRange}
      />
    );
  }

  if (obj.type === "mind") {
    const fontSize = obj.fontSize ?? 14;
    const fontCls = boardFontClass(obj.fontFamily);
    const emphCls = boardEmphasisClass(obj);
    const colorCls = textColorClass(obj.color);
    const customHex = obj.color && /^#[0-9a-fA-F]{6}$/.test(obj.color) ? obj.color : undefined;
    const textStyle = {
      fontSize: `${fontSize}px`,
      lineHeight: 1.45,
      ...(customHex ? { color: customHex } : {}),
    } as const;
    const lines = Math.max(2, obj.text.split("\n").length);

    return (
      <div
        className={cn(
          shell,
          "rounded-2xl border border-line bg-paper px-3 py-2 shadow-[1px_2px_0_rgba(0,0,0,0.04)]",
        )}
        style={{
          left: obj.x,
          top: obj.y,
          width: obj.w,
          height: obj.h,
          minHeight: obj.h,
          zIndex: obj.z,
        }}
        data-board-object=""
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(obj.id);
        }}
      >
        {chrome}
        {selected && onMindConnect && interactive && (
          <button
            type="button"
            title="Add child node"
            className="absolute -bottom-2 left-1/2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-paper font-mono text-[10px] text-mute hover:text-ink"
            style={{
              transform: "translateX(-50%) scale(var(--board-ui-scale))",
              transformOrigin: "center top",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMindConnect(obj.id);
            }}
          >
            +
          </button>
        )}
        <div
          className={cn(
            "flex h-full w-full flex-col",
            textAlignClass(obj.align, "mind"),
            textVAlignClass(obj.valign, "mind"),
          )}
        >
        {editing ? (
          <textarea
            autoFocus
            className={cn(
              "w-full resize-none bg-transparent outline-none",
              fontCls,
              emphCls,
              colorCls,
              textAlignClass(obj.align, "mind"),
            )}
            style={textStyle}
            rows={lines}
            value={obj.text}
            onChange={(e) => onPatch(obj.id, { text: e.target.value })}
            onBlur={() => onEdit(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEdit(null);
            }}
          />
        ) : (
          <p
            className={cn(
              "w-full whitespace-pre-wrap break-words",
              fontCls,
              emphCls,
              colorCls,
            )}
            style={textStyle}
          >
            {obj.text || "Idea"}
          </p>
        )}
        </div>
      </div>
    );
  }

  if (obj.type === "shape") {
    const fontSize = obj.fontSize ?? 14;
    const fontCls = boardFontClass(obj.fontFamily, "sans");
    const emphCls = boardEmphasisClass(obj);
    const shapePaint = resolveShapeTextColor(obj.color, obj.fill);
    const textStyle = {
      fontSize: `${fontSize}px`,
      lineHeight: 1.45,
      color: shapePaint.color,
    } as const;

    return (
      <div
        className={shell}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: obj.z }}
        data-board-object=""
        data-board-shape=""
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (obj.showLabel === false) {
            onPatch(obj.id, { showLabel: true });
          }
          onEdit(obj.id);
        }}
      >
        {chrome}
        <svg
          className="pointer-events-auto absolute inset-0"
          width={obj.w}
          height={obj.h}
          aria-hidden
        >
          <rect width={obj.w} height={obj.h} fill="transparent" />
          <ShapeGraphic
            kind={obj.shape}
            w={obj.w}
            h={obj.h}
            fill={obj.fill}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            strokeDash={obj.strokeDash}
          />
        </svg>
        {(editing || obj.showLabel !== false) && (
        <div
          className={cn(
            "pointer-events-auto absolute inset-0 flex min-h-0 min-w-0 flex-col items-center overflow-hidden px-2 py-1.5",
            textAlignClass(obj.align, "shape"),
            textVAlignClass(obj.valign, "shape"),
          )}
        >
          {editing ? (
            <textarea
              autoFocus
              className={cn(
                "field-sizing-content h-auto max-h-full w-full resize-none overflow-hidden bg-transparent p-0 text-center outline-none placeholder:text-center placeholder:text-current placeholder:opacity-100",
                fontCls,
                emphCls,
                textAlignClass(obj.align, "shape"),
              )}
              style={textStyle}
              rows={Math.max(1, (obj.text || "Label").split("\n").length)}
              value={obj.text}
              placeholder="Label"
              onChange={(e) => onPatch(obj.id, { text: e.target.value })}
              onBlur={() => onEdit(null)}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") onEdit(null);
              }}
            />
          ) : (
            <p
              className={cn(
                "w-full text-center whitespace-pre-wrap break-words",
                fontCls,
                emphCls,
                textAlignClass(obj.align, "shape"),
              )}
              style={textStyle}
            >
              {obj.text || "Label"}
            </p>
          )}
        </div>
        )}
      </div>
    );
  }

  if (obj.type === "mention") {
    const note = notes.find((n) => n.id === obj.noteId);
    const kind =
      obj.kind ??
      (note?.type === "database" ? "database" : note ? "page" : blobs[obj.noteId] ? "file" : "page");
    const blobRec = blobs[obj.noteId];
    const KindIcon = kind === "database" ? Database : kind === "file" ? File : FileText;
    const subtitle =
      kind === "database"
        ? note
          ? `${(note.schema ?? []).length} fields`
          : "Missing database"
        : kind === "file"
          ? note?.path ?? (blobRec ? obj.noteId : "Missing file")
          : note
            ? note.path
            : "Missing page";
    const peekSnippet =
      kind === "database"
        ? note
          ? `${(note.schema ?? []).length} fields · Database`
          : "Missing database"
        : kind === "file"
          ? blobRec?.mime || obj.noteId
          : note
            ? plainSnippet(note.body, 160) || "Empty page."
            : "Missing page";

    return (
      <MentionChip
        shell={shell}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, minHeight: obj.h, zIndex: obj.z }}
        chrome={chrome}
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        title={note?.title ?? obj.title}
        kind={kind}
        subtitle={subtitle}
        peekSnippet={peekSnippet}
        KindIcon={KindIcon}
        disabled={kind === "file" ? !note && !blobRec : !note}
        onOpen={() => {
          if (note) {
            openNote(note);
            return;
          }
          if (kind === "file" && blobRec) {
            const url = resolveAssetSrc(obj.noteId, blobs);
            window.open(url, "_blank", "noopener,noreferrer");
          }
        }}
      />
    );
  }

  return null;
}

export function ShapeGraphic({
  kind,
  w,
  h,
  fill,
  stroke,
  strokeWidth,
  strokeDash,
  preview,
}: {
  kind: FreeformShapeKind;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDash: FreeformStrokeDash;
  preview?: boolean;
}) {
  const fillPaint = fillValue(fill);
  const noneStroke = isNonePaint(stroke);
  const strokePaint = noneStroke ? "none" : inkStrokeValue(stroke);
  const dash = noneStroke ? undefined : strokeDashArray(strokeDash);
  const lineWidth = noneStroke ? 0 : strokeWidth;
  const geom = shapeOutline(kind, w, h, lineWidth);
  const common = {
    fill: fillPaint === "transparent" ? "none" : fillPaint,
    fillOpacity: preview ? (fillPaint === "transparent" ? 0.08 : 0.55) : 1,
    stroke: strokePaint,
    strokeWidth: lineWidth,
    strokeDasharray: dash,
    strokeOpacity: preview ? 0.85 : 1,
  };
  const hit = { ...common, pointerEvents: "all" as const };
  if (geom.tag === "ellipse") {
    return <ellipse cx={geom.cx} cy={geom.cy} rx={geom.rx} ry={geom.ry} {...hit} />;
  }
  if (geom.tag === "rect") {
    return (
      <rect x={geom.x} y={geom.y} width={geom.w} height={geom.h} rx={geom.rx} ry={geom.rx} {...hit} />
    );
  }
  return <polygon points={polyToPointsAttr(geom.points)} {...hit} />;
}

function ResizeHandles({
  onPointerDown,
}: {
  onPointerDown: (e: ReactPointerEvent, handle: ResizeHandle) => void;
}) {
  return (
    <>
      {RESIZE_HANDLES.map(({ handle, className, hx, hy }) => (
        <button
          key={handle}
          type="button"
          aria-label={`Resize ${handle}`}
          data-board-handle=""
          className={cn(
            "absolute z-20 flex h-11 w-11 items-center justify-center md:h-2.5 md:w-2.5",
            className,
          )}
          style={{ ["--hx" as string]: hx, ["--hy" as string]: hy }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onPointerDown(e, handle);
          }}
        >
          <span className="h-2.5 w-2.5 rounded-sm border border-ink/50 bg-paper shadow-sm md:h-full md:w-full" />
        </button>
      ))}
    </>
  );
}

function MentionChip({
  shell,
  style,
  chrome,
  onPointerDown,
  onContextMenu,
  title,
  kind,
  subtitle,
  peekSnippet,
  KindIcon,
  disabled,
  onOpen,
}: {
  shell: string;
  style: CSSProperties;
  chrome: React.ReactNode;
  onPointerDown: (e: ReactPointerEvent) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  title: string;
  kind: string;
  subtitle: string;
  peekSnippet: string;
  KindIcon: typeof FileText;
  disabled: boolean;
  onOpen: () => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      data-board-object=""
      className={cn(shell, "flex items-center gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2")}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => {
        if (window.matchMedia("(hover: none)").matches) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPos({ x: r.left, y: r.bottom + 6 }), 280);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setPos(null);
      }}
    >
      {chrome}
      <KindIcon size={14} strokeWidth={1.4} className="pointer-events-none shrink-0 text-mute" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block max-w-full truncate text-left font-serif text-sm text-ink underline-offset-2 hover:underline disabled:no-underline"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          @{title}
        </button>
        <span className="flex items-center gap-1.5 truncate font-mono text-[10px] text-faint">
          <span className="uppercase tracking-wide">{kind}</span>
          {subtitle && subtitle.toLowerCase() !== kind ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{subtitle}</span>
            </>
          ) : null}
        </span>
      </div>
      {pos &&
        createPortal(
          <Panel
            className="pointer-events-none fixed z-[80] w-64 p-3"
            style={{ left: Math.min(pos.x, window.innerWidth - 280), top: pos.y }}
          >
            <p className="font-serif text-sm text-ink">@{title}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">{kind}</p>
            <p className="mt-1 line-clamp-4 font-serif text-sm text-mute">{peekSnippet}</p>
          </Panel>,
          document.body,
        )}
    </div>
  );
}

function BoardImage({
  obj,
  src,
  ensureBlob,
  shell,
  chrome,
  handlePointerDown,
  handleContextMenu,
}: {
  obj: Extract<FreeformObject, { type: "image" }>;
  src: string;
  ensureBlob: (path: string) => Promise<void>;
  shell: string;
  chrome: ReactNode;
  handlePointerDown: (e: ReactPointerEvent) => void;
  handleContextMenu: (e: ReactMouseEvent) => void;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src, obj.src]);

  useEffect(() => {
    if (src || !obj.src) return;
    void ensureBlob(obj.src.replace(/^\.\//, ""));
  }, [src, obj.src, ensureBlob]);

  return (
    <div
      className={cn(shell, "rounded-xl border border-line bg-paper-2")}
      style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: obj.z }}
      data-board-object=""
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
    >
      {chrome}
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
        {src && !broken ? (
          <img
            src={src}
            alt={obj.alt}
            className="h-full w-full object-cover"
            draggable={false}
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="px-3 text-center font-mono text-[10px] text-mute">
            {broken ? obj.alt || "Image could not be displayed" : "Loading image…"}
          </span>
        )}
      </div>
    </div>
  );
}
