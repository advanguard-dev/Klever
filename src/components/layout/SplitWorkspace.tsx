import { DatabasePage } from "@/components/db/DatabasePage";
import { NotePage } from "@/components/editor/NotePage";
import { FileDropZone } from "@/components/layout/FileDropZone";
import { PageTabs } from "@/components/layout/PageTabs";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { isKleverNoteDrag, peekNoteDrag } from "@/lib/dnd";
import { splitEdgeHit } from "@/lib/split-layout";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { Note, SplitCorner, SplitSide } from "@/types";
import { X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const NARROW_MQ = "(max-width: 767px)";

type Preview = { side: SplitSide; corner: SplitCorner };

function noteView(note: Note) {
  return note.type === "database" ? ({ kind: "database" as const, id: note.id } as const) : ({ kind: "note" as const, id: note.id } as const);
}

function WorkspacePage({ noteId, active }: { noteId: string; active: boolean }) {
  const t = useT();
  const notes = useApp((s) => s.notes);
  const view = useApp((s) => s.view);
  const note = notes.find((n) => n.id === noteId);
  if (!note) {
    return <EmptyState title={t("shell.pageGone")} description={t("shell.pageGoneDesc")} />;
  }
  if (note.type === "database") {
    const viewId = view.kind === "database" && view.id === noteId ? view.viewId : undefined;
    return <DatabasePage key={note.id} note={note} viewId={viewId} />;
  }
  return <NotePage key={note.id} note={note} active={active} />;
}

function SplitPane({ noteId, active }: { noteId: string; active: boolean }) {
  const notes = useApp((s) => s.notes);
  const setView = useApp((s) => s.setView);
  const note = notes.find((n) => n.id === noteId);
  return (
    <div
      className={cn("relative min-h-0 min-w-0 flex-1 overflow-y-auto scroll-pt-12 bg-paper", !active && "bg-blotter/40")}
      onPointerDown={() => {
        if (active || !note) return;
        setView(noteView(note));
      }}
    >
      <FileDropZone
        className="min-h-full"
        attachToNoteId={note && note.type !== "database" ? note.id : undefined}
      >
        <WorkspacePage noteId={noteId} active={active} />
      </FileDropZone>
    </div>
  );
}

function GhostPane({
  preview,
  incoming,
}: {
  preview: Preview;
  incoming: Note | undefined;
}) {
  const t = useT();
  const [shown, setShown] = useState(false);
  useLayoutEffect(() => {
    setShown(false);
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [preview.side, preview.corner]);

  const label = preview.side === "left" ? t("split.hintLeft") : t("split.hintRight");
  const origin = `${preview.side} ${preview.corner}`;
  const enter =
    preview.side === "left"
      ? shown
        ? "translate-x-0"
        : "-translate-x-[12%]"
      : shown
        ? "translate-x-0"
        : "translate-x-[12%]";

  return (
    <div
      className={cn(
        "klever-split-ghost pointer-events-none absolute inset-y-0 z-10 flex w-1/2 items-stretch p-3 text-left select-none",
        "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        preview.side === "left" ? "left-0" : "right-0",
        enter,
      )}
      style={{ transformOrigin: origin } as CSSProperties}
      data-side={preview.side}
      data-corner={preview.corner}
      role="status"
    >
      <span
        className={cn(
          "klever-split-ghost-sheet relative flex min-w-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-5 py-6",
          preview.side === "left" ? "border-r-2 border-ring" : "border-l-2 border-ring",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute inset-x-6 h-px bg-line/80",
            preview.corner === "top" ? "top-5" : "bottom-5",
          )}
          aria-hidden
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</span>
        <span className="font-serif text-2xl font-semibold tracking-tight text-ink">
          {incoming?.title?.trim() || t("split.hintNew")}
        </span>
        <span className="text-sm text-mute">{t("split.hintDrop")}</span>
      </span>
    </div>
  );
}

export function SplitWorkspace({ className }: { className?: string }) {
  const t = useT();
  const view = useApp((s) => s.view);
  const notes = useApp((s) => s.notes);
  const split = useApp((s) => s.split);
  const splitPage = useApp((s) => s.splitPage);
  const closeSplit = useApp((s) => s.closeSplit);
  const commandOpen = useApp((s) => s.commandOpen);
  const dumpOpen = useApp((s) => s.dumpOpen);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const plusOpen = useApp((s) => s.plusOpen);
  const relateNoteId = useApp((s) => s.relateNoteId);
  const workspaceSetupOpen = useApp((s) => s.workspaceSetupOpen);
  const pageSplitOpen = useApp((s) => s.pageSplitOpen);

  const paneRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<Preview | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const overlayOpen =
    commandOpen || dumpOpen || settingsOpen || plusOpen || workspaceSetupOpen || pageSplitOpen || Boolean(relateNoteId);
  const currentId = view.kind === "note" || view.kind === "database" ? view.id : null;

  const dismiss = useCallback(() => {
    previewRef.current = null;
    dragIdRef.current = null;
    setPreview(null);
    setDragId(null);
  }, []);

  const hidePreview = useCallback(() => {
    if (!previewRef.current) return;
    previewRef.current = null;
    setPreview(null);
  }, []);

  const commit = useCallback(
    (opts?: { withId?: string; focusIncoming?: boolean }) => {
      const hit = previewRef.current;
      if (!hit || !currentId) return;
      const withId = opts?.withId ?? dragIdRef.current ?? peekNoteDrag() ?? undefined;
      if (!withId || withId === currentId) {
        dismiss();
        return;
      }
      splitPage({
        side: hit.side,
        withId,
        focusIncoming: opts?.focusIncoming ?? true,
      });
      dismiss();
    },
    [currentId, dismiss, splitPage],
  );

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    if (split) dismiss();
  }, [dismiss, split]);

  useEffect(() => {
    const blocked = () =>
      Boolean(split) || overlayOpen || !currentId || window.matchMedia(NARROW_MQ).matches;

    const consider = (clientX: number, clientY: number) => {
      const pane = paneRef.current;
      const nextDragId = peekNoteDrag();
      if (!pane || blocked() || !nextDragId) {
        dismiss();
        return;
      }
      const changed = dragIdRef.current !== nextDragId;
      dragIdRef.current = nextDragId;
      if (changed) setDragId(nextDragId);
      if (nextDragId === currentId) {
        hidePreview();
        return;
      }
      const hit = splitEdgeHit(pane.getBoundingClientRect(), clientX, clientY);
      if (!hit) {
        hidePreview();
        return;
      }
      const current = previewRef.current;
      if (!current || current.side !== hit.side || current.corner !== hit.corner) {
        previewRef.current = hit;
        setPreview(hit);
      }
    };

    const incomingId = () => dragIdRef.current ?? peekNoteDrag() ?? undefined;

    const onDragOver = (e: DragEvent) => {
      if (!isKleverNoteDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      consider(e.clientX, e.clientY);
    };
    const onWindowDrop = (e: DragEvent) => {
      if (!previewRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      commit({ withId: incomingId(), focusIncoming: true });
    };
    const onDragEnd = () => {
      // Electron often fires dragend before drop. Release-on-rail still counts.
      if (previewRef.current && incomingId()) {
        commit({ withId: incomingId(), focusIncoming: true });
        return;
      }
      dismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!previewRef.current && !dragIdRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onWindowDrop, true);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onWindowDrop, true);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [commit, currentId, dismiss, hidePreview, overlayOpen, split]);

  const onDrop = (e: React.DragEvent) => {
    if (!isKleverNoteDrag(e)) return;
    e.preventDefault();
    if (!previewRef.current) return;
    commit({ withId: dragIdRef.current ?? peekNoteDrag() ?? undefined, focusIncoming: true });
  };

  const incoming = dragId ? notes.find((n) => n.id === dragId) : undefined;

  if (split) {
    return (
      <div className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
        <div className="sticky top-0 z-20 shrink-0 bg-paper">
          <PageTabs />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 max-md:flex-col">
          <SplitPane noteId={split.leftId} active={split.focus === "left"} />
          <div className="group/gutter relative z-10 flex w-2 shrink-0 items-stretch justify-center bg-blotter max-md:h-2 max-md:w-full">
            <span className="w-px bg-line" aria-hidden />
            <button
              type="button"
              className="klever-reveal klever-focus absolute top-3 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-paper text-mute shadow-sm hover:text-ink"
              aria-label={t("split.close")}
              title={t("split.close")}
              onClick={closeSplit}
            >
              <X size={12} strokeWidth={1.6} />
            </button>
            <span className="sr-only">{t("split.gutter")}</span>
          </div>
          <SplitPane noteId={split.rightId} active={split.focus === "right"} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}
      onDragOver={(e) => {
        if (!isKleverNoteDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={onDrop}
    >
      {preview && (
        <p className="sr-only" role="status" aria-live="polite">
          {t("split.live", { side: preview.side === "left" ? t("split.sideLeft") : t("split.sideRight") })}
        </p>
      )}
      <div className="sticky top-0 z-20 shrink-0 bg-paper">
        <PageTabs />
      </div>
      <div
        ref={paneRef}
        className={cn("relative min-h-0 min-w-0 flex-1 overflow-hidden", preview && "klever-split-preview")}
      >
        {dragId && (
          <>
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 z-[5] w-20 border-l-2 border-dashed",
                preview?.side === "left" ? "border-ring bg-ring/5" : "border-line/70",
              )}
              aria-hidden
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 z-[5] w-20 border-r-2 border-dashed",
                preview?.side === "right" ? "border-ring bg-ring/5" : "border-line/70",
              )}
              aria-hidden
            />
          </>
        )}
        {preview && <GhostPane key={preview.side} preview={preview} incoming={incoming} />}
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto scroll-pt-12 bg-paper transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            preview?.side === "left" && "translate-x-1/2",
            preview?.side === "right" && "-translate-x-1/2",
          )}
        >
          <FileDropZone className="min-h-full" attachToNoteId={view.kind === "note" ? view.id : undefined}>
            {currentId ? (
              <WorkspacePage noteId={currentId} active />
            ) : (
              <EmptyState title={t("shell.pageGone")} description={t("shell.pageGoneDesc")} />
            )}
          </FileDropZone>
        </div>
      </div>
    </div>
  );
}
