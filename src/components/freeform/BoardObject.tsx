import { openNote } from "@/components/editor/WikiPeek";
import {
  boardEmphasisClass,
  boardFontClass,
  inkStrokeValue,
  resolveStickyTextColor,
  stickyClass,
  textColorClass,
} from "@/components/freeform/board-model";
import { Panel } from "@/components/ui";
import { resolveAssetSrc } from "@/lib/assets";
import { cn } from "@/lib/cn";
import { plainSnippet } from "@/lib/parse";
import { useApp } from "@/store";
import type { FreeformObject } from "@/types";
import { Database, ExternalLink, File, FileText, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<FreeformObject>) => void;
  onMindConnect?: (parentId: string) => void;
};

export function BoardObject({
  obj,
  selected,
  editing,
  interactive = true,
  onSelect,
  onEdit,
  onDragStart,
  onRemove,
  onPatch,
  onMindConnect,
}: Props) {
  const blobs = useApp((s) => s.blobs);
  const notes = useApp((s) => s.notes);

  const shell = cn(
    "absolute select-none",
    !interactive && "pointer-events-none",
    selected && "ring-2 ring-ink/30 ring-offset-2 ring-offset-transparent",
  );

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (editing || !interactive) return;
    e.stopPropagation();
    onSelect(obj.id, e.shiftKey);
    onDragStart(e, obj.id);
  };

  const chrome = selected && !editing && interactive && (
    <button
      type="button"
      aria-label="Remove"
      className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-mute shadow-sm hover:text-ink"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onRemove(obj.id);
      }}
    >
      <X size={12} strokeWidth={1.5} />
    </button>
  );

  if (obj.type === "path") {
    const d = obj.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
    return (
      <div
        className={shell}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: obj.z }}
        onPointerDown={handlePointerDown}
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
          "absolute select-none",
          !interactive && "pointer-events-none",
          selected && !editing && "outline outline-1 outline-dashed outline-ink/25 outline-offset-4",
        )}
        style={{ left: obj.x, top: obj.y, width: obj.w, zIndex: obj.z }}
        onPointerDown={handlePointerDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(obj.id);
        }}
      >
        {chrome}
        {editing ? (
          <textarea
            autoFocus
            className={cn(
              "w-full min-h-[1.5em] resize-none bg-transparent outline-none",
              fontCls,
              emphCls,
              colorCls,
            )}
            style={textStyle}
            rows={Math.max(2, obj.text.split("\n").length)}
            value={obj.text}
            onChange={(e) => onPatch(obj.id, { text: e.target.value } as Partial<FreeformObject>)}
            onBlur={() => onEdit(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEdit(null);
            }}
          />
        ) : (
          <p
            className={cn(
              "min-h-[1.5em] whitespace-pre-wrap break-words",
              fontCls,
              emphCls,
              colorCls,
              !obj.text && "min-w-[3rem]",
            )}
            style={textStyle}
          >
            {obj.text}
          </p>
        )}
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
          "rounded-sm border border-ink/10 px-3 py-3 shadow-[2px_3px_0_rgba(0,0,0,0.06)]",
          stickyClass(obj.color),
        )}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: obj.z }}
        onPointerDown={handlePointerDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(obj.id);
        }}
      >
        {chrome}
        {editing ? (
          <textarea
            autoFocus
            className={cn(
              "h-full w-full resize-none bg-transparent leading-snug outline-none",
              fontCls,
              emphCls,
            )}
            style={textStyle}
            value={obj.text}
            onChange={(e) => onPatch(obj.id, { text: e.target.value } as Partial<FreeformObject>)}
            onBlur={() => onEdit(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEdit(null);
            }}
          />
        ) : (
          <p
            className={cn(
              "h-full overflow-hidden whitespace-pre-wrap leading-snug",
              fontCls,
              emphCls,
            )}
            style={textStyle}
          >
            {obj.text || <span className="opacity-40">Sticky note</span>}
          </p>
        )}
      </div>
    );
  }

  if (obj.type === "image") {
    const src = resolveAssetSrc(obj.src, blobs);
    return (
      <div
        className={cn(shell, "overflow-hidden rounded-xl border border-line bg-paper-2")}
        style={{ left: obj.x, top: obj.y, width: obj.w, height: obj.h, zIndex: obj.z }}
        onPointerDown={handlePointerDown}
      >
        {chrome}
        <img src={src} alt={obj.alt} className="h-full w-full object-cover" draggable={false} />
      </div>
    );
  }

  if (obj.type === "link") {
    return (
      <div
        className={cn(shell, "rounded-xl border border-line bg-paper px-3 py-2.5")}
        style={{ left: obj.x, top: obj.y, width: obj.w, zIndex: obj.z }}
        onPointerDown={handlePointerDown}
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
                onPatch(obj.id, { url, title } as Partial<FreeformObject>);
              }}
              onBlur={() => onEdit(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") onEdit(null);
              }}
              placeholder="https://"
            />
          </div>
        ) : (
          <a
            href={obj.url.startsWith("http") ? obj.url : `https://${obj.url}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 text-ink hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} strokeWidth={1.4} className="mt-0.5 shrink-0 text-mute" />
            <span className="min-w-0">
              <span className="block truncate font-serif text-sm">{obj.title || "Link"}</span>
              <span className="block truncate font-mono text-[10px] text-faint">{obj.url}</span>
            </span>
          </a>
        )}
      </div>
    );
  }

  if (obj.type === "table") {
    return (
      <div
        className={cn(shell, "overflow-hidden rounded-xl border border-line bg-paper")}
        style={{ left: obj.x, top: obj.y, width: obj.w, zIndex: obj.z }}
        onPointerDown={handlePointerDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(obj.id);
        }}
      >
        {chrome}
        <table className="w-full border-collapse text-left">
          <tbody>
            {obj.cells.map((row, ri) => (
              <tr
                key={ri}
                className={cn(
                  "border-b border-line last:border-0",
                  obj.headerRow && ri === 0 && "bg-paper-2",
                )}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="border-r border-line p-0 last:border-0">
                    {editing ? (
                      <input
                        className={cn(
                          "w-full bg-transparent px-2 py-1.5 font-mono text-[11px] text-ink outline-none",
                          obj.headerRow && ri === 0 && "font-semibold",
                        )}
                        value={cell}
                        onChange={(e) => {
                          const cells = obj.cells.map((r) => [...r]);
                          cells[ri][ci] = e.target.value;
                          onPatch(obj.id, { cells } as Partial<FreeformObject>);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") onEdit(null);
                        }}
                      />
                    ) : (
                      <span
                        className={cn(
                          "block min-h-[1.75rem] px-2 py-1.5 font-mono text-[11px] text-ink",
                          obj.headerRow && ri === 0 && "font-semibold",
                        )}
                      >
                        {cell || <span className="text-faint">·</span>}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          minHeight: obj.h,
          zIndex: obj.z,
        }}
        onPointerDown={handlePointerDown}
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
            className="absolute -bottom-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-paper font-mono text-[10px] text-mute hover:text-ink"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMindConnect(obj.id);
            }}
          >
            +
          </button>
        )}
        {editing ? (
          <textarea
            autoFocus
            className={cn(
              "w-full resize-none bg-transparent text-center outline-none",
              fontCls,
              emphCls,
              colorCls,
            )}
            style={textStyle}
            rows={lines}
            value={obj.text}
            onChange={(e) => onPatch(obj.id, { text: e.target.value } as Partial<FreeformObject>)}
            onBlur={() => onEdit(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEdit(null);
            }}
          />
        ) : (
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-center",
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
          ? "Open database"
          : "Missing database"
        : kind === "file"
          ? note?.path ?? (blobRec ? obj.noteId : "Missing file")
          : note
            ? "Open page"
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
        style={{ left: obj.x, top: obj.y, width: obj.w, zIndex: obj.z }}
        chrome={chrome}
        onPointerDown={handlePointerDown}
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

function MentionChip({
  shell,
  style,
  chrome,
  onPointerDown,
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
      className={cn(shell, "flex items-center gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2")}
      style={style}
      onPointerDown={onPointerDown}
      onMouseEnter={(e) => {
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
      <KindIcon size={14} strokeWidth={1.4} className="shrink-0 text-mute" />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <span className="block truncate font-serif text-sm text-ink underline-offset-2 hover:underline">
          @{title}
        </span>
        <span className="flex items-center gap-1.5 truncate font-mono text-[10px] text-faint">
          <span className="uppercase tracking-wide">{kind}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{subtitle}</span>
        </span>
      </button>
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
