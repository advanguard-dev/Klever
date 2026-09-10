import { Panel } from "@/components/ui";
import { contextMenuFromKey, useContextMenu } from "@/components/ContextMenu";
import { wikiMenuItems } from "@/lib/context-menus";
import { NoteIcon, NoteLabel, noteKindIcon } from "@/lib/chrome-icons";
import { coverSource } from "@/components/db/RecordCard";
import { resolveAssetSrc } from "@/lib/assets";
import { plainSnippet, resolveLink } from "@/lib/parse";
import { parseWikiDisplay, type WikiDisplay } from "@/lib/wiki-display";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function openNote(note: Note) {
  useApp.getState().setView(
    note.type === "database" ? { kind: "database", id: note.id } : { kind: "note", id: note.id },
  );
}

function goToTarget(target: string, hit: Note | undefined, createPage: (opts: { title: string }) => string) {
  if (hit) openNote(hit);
  else {
    const id = createPage({ title: target });
    useApp.getState().setView({ kind: "note", id });
  }
}

export function WikiLinkPreview({
  target,
  label,
  display: displayProp,
  onDisplay,
}: {
  target: string;
  label?: string;
  display?: WikiDisplay | string | null;
  onDisplay?: (display: WikiDisplay) => void;
}) {
  const notes = useApp((s) => s.notes);
  const blobs = useApp((s) => s.blobs);
  const createPage = useApp((s) => s.createPage);
  const { open } = useContextMenu();
  const hit = resolveLink(target, notes);
  const display = parseWikiDisplay(displayProp);
  const text = label?.trim() || hit?.title || target;

  const onMenu = (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => {
    e.stopPropagation();
    open(e, wikiMenuItems(target, hit, { display, onDisplay: onDisplay ? (d) => onDisplay(d) : undefined }));
  };

  if (display === "card") {
    const cover = hit ? coverSource(hit, "page") : null;
    const coverUrl = cover?.src ? resolveAssetSrc(cover.src, blobs) : "";
    const Fallback = noteKindIcon(hit?.type === "database" ? "database" : "page");
    return (
      <span className="wiki-bento" onContextMenu={onMenu}>
        <button
          type="button"
          className={`wiki-bento-card klever-focus ${hit ? "" : "wiki-bento-card--missing"}`}
          onClick={() => goToTarget(target, hit, createPage)}
          onKeyDown={(e) => contextMenuFromKey(e, onMenu)}
        >
          {coverUrl ? (
            <span className="wiki-bento-cover">
              <img src={coverUrl} alt="" />
            </span>
          ) : cover?.color ? (
            <span className="wiki-bento-cover" style={{ background: cover.color }} />
          ) : null}
          <span className="wiki-bento-body">
            <span className="wiki-bento-title">
              {hit?.icon ? (
                <NoteIcon icon={hit.icon} size={15} className="shrink-0 text-faint" />
              ) : (
                <Fallback size={15} strokeWidth={1.4} className="shrink-0 text-faint" aria-hidden />
              )}
              <span className="truncate">{text}</span>
            </span>
            <span className="wiki-bento-snippet">{hit ? plainSnippet(hit.body, 90) || "Empty page." : "New page"}</span>
          </span>
        </button>
      </span>
    );
  }

  return (
    <span onContextMenu={onMenu}>
      <button
        type="button"
        className={[
          "wiki-link",
          !hit && "wiki-missing",
          display === "title" && "wiki-title",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => goToTarget(target, hit, createPage)}
        onKeyDown={(e) => contextMenuFromKey(e, onMenu)}
      >
        {display === "title" && hit ? <NoteLabel note={hit} size={13} /> : text}
      </button>
    </span>
  );
}

export function WikiPeek({
  target,
  notes,
  display,
  onDisplay,
  children,
}: {
  target: string;
  notes: Note[];
  display?: WikiDisplay | string | null;
  onDisplay?: (display: WikiDisplay) => void;
  children: ReactNode;
}) {
  const createPage = useApp((s) => s.createPage);
  const { open } = useContextMenu();
  const hit = resolveLink(target, notes);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef(0);
  const mode = parseWikiDisplay(display);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (mode === "card" || mode === "title") {
    return (
      <WikiLinkPreview
        target={target}
        label={typeof children === "string" ? children : undefined}
        display={mode}
        onDisplay={onDisplay}
      />
    );
  }

  return (
    <span
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
      <button
        type="button"
        className={hit ? "wiki-link" : "wiki-link wiki-missing"}
        onClick={() => goToTarget(target, hit, createPage)}
        onContextMenu={(e) =>
          open(e, wikiMenuItems(target, hit, { display: mode, onDisplay }))
        }
        onKeyDown={(e) =>
          contextMenuFromKey(e, (ev) => open(ev, wikiMenuItems(target, hit, { display: mode, onDisplay })))
        }
      >
        {children}
      </button>
      {pos &&
        hit &&
        createPortal(
          <Panel
            className="pointer-events-none fixed z-[80] w-64 p-3"
            style={{ left: Math.min(pos.x, window.innerWidth - 280), top: pos.y }}
          >
            <p className="font-sans text-sm text-ink">
              <NoteLabel note={hit} size={14} />
            </p>
            <p className="mt-1 line-clamp-4 text-sm text-mute">{plainSnippet(hit.body) || "Empty page."}</p>
          </Panel>,
          document.body,
        )}
    </span>
  );
}
