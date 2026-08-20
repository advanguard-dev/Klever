import { NotePage } from "@/components/editor/NotePage";
import { TitleBar } from "@/components/layout/TitleBar";
import { IconButton, Panel, ToolbarBtn } from "@/components/ui";
import { NoteIcon, noteKindIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import { noteFolder, readingQueue } from "@/lib/folders";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function ReadingView({ note }: { note: Note }) {
  const notes = useApp((s) => s.notes);
  const setView = useApp((s) => s.setView);
  const setMode = useApp((s) => s.setMode);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const setDumpOpen = useApp((s) => s.setDumpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const closeWorkspaceSetup = useApp((s) => s.closeWorkspaceSetup);

  const queue = useMemo(() => {
    const pages = readingQueue(notes);
    if (pages.some((p) => p.id === note.id)) return pages;
    return [note, ...pages];
  }, [notes, note]);

  const index = Math.max(0, queue.findIndex((p) => p.id === note.id));
  const prev = index > 0 ? queue[index - 1] : null;
  const next = index < queue.length - 1 ? queue[index + 1] : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openPage = (id: string) => {
    setView({ kind: "note", id });
    setMenuOpen(false);
  };

  const leaveRead = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    setMode("wysiwyg");
  };

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [note.id]);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuOpen) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setMenuOpen(false);
          return;
        }
        const s = useApp.getState();
        if (s.commandOpen || s.dumpOpen || s.settingsOpen || s.plusOpen || s.workspaceSetupOpen) {
          setCommandOpen(false);
          setDumpOpen(false);
          setSettingsOpen(false);
          setPlusOpen(false);
          closeWorkspaceSetup();
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        if (document.fullscreenElement) void document.exitFullscreen();
        setMode("wysiwyg");
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        openPage(prev.id);
      }
      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        openPage(next.id);
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    closeWorkspaceSetup,
    menuOpen,
    next,
    prev,
    setCommandOpen,
    setDumpOpen,
    setMode,
    setPlusOpen,
    setSettingsOpen,
  ]);

  const folderLabel = (path: string) => noteFolder(path) || "Vault";

  return (
    <div ref={rootRef} className="flex h-dvh flex-col bg-paper text-ink">
      <TitleBar className="relative">
        <div className="flex min-w-0 flex-1 justify-start">
          <ToolbarBtn label="Write" showLabel shortcut="Esc" onClick={leaveRead}>
            <ArrowLeft size={15} strokeWidth={1.4} />
          </ToolbarBtn>
        </div>

        <div className="relative flex min-w-0 justify-center" ref={menuRef}>
          <div className="flex min-w-0 items-center rounded-xl border border-line bg-paper">
            <IconButton
              aria-label="Previous page"
              title="Previous page"
              disabled={!prev}
              onClick={() => prev && openPage(prev.id)}
            >
              <ChevronLeft size={16} strokeWidth={1.4} />
            </IconButton>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Pages"
              title="Pages"
              className={cn(
                "flex min-w-0 max-w-[min(28rem,calc(100vw-8rem))] items-center gap-1.5 border-x border-line px-3 py-1.5 font-serif text-sm text-ink md:max-w-[min(28rem,calc(100vw-16rem))]",
                "hover:bg-paper-2",
                menuOpen && "bg-paper-2",
              )}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <NoteIcon
                icon={note.icon}
                fallback={noteKindIcon(note.type)}
                size={14}
                className="shrink-0 text-mute"
              />
              <span className="truncate italic tracking-tight">{note.title || "Untitled"}</span>
              <ChevronDown
                size={14}
                strokeWidth={1.4}
                className={cn(
                  "shrink-0 text-mute transition-transform duration-150",
                  menuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <IconButton
              aria-label="Next page"
              title="Next page"
              disabled={!next}
              onClick={() => next && openPage(next.id)}
            >
              <ChevronRight size={16} strokeWidth={1.4} />
            </IconButton>
          </div>
          {menuOpen && (
            <Panel
              role="menu"
              className="absolute left-1/2 top-full z-50 mt-1.5 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 p-1.5 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.28)]"
            >
              <p className="px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                {index + 1} of {queue.length}
              </p>
              <div className="max-h-[min(24rem,calc(100vh-8rem))] overflow-y-auto">
                {queue.map((p) => {
                  const on = p.id === note.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left",
                        on ? "bg-paper-2 text-ink" : "text-mute hover:bg-paper-2 hover:text-ink",
                      )}
                      onClick={() => openPage(p.id)}
                    >
                      <NoteIcon
                        icon={p.icon}
                        fallback={noteKindIcon(p.type)}
                        size={13}
                        className="shrink-0 text-faint"
                      />
                      <span className="min-w-0 flex-1 truncate font-serif text-sm">{p.title || "Untitled"}</span>
                      <span className="max-w-[7rem] truncate font-mono text-[10px] text-faint">
                        {folderLabel(p.path)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>

        <div className="hidden flex-1 justify-end md:flex">
          <ToolbarBtn
            label={fullscreen ? "Exit full screen" : "Full screen"}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            active={fullscreen}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <Minimize2 size={15} strokeWidth={1.4} />
            ) : (
              <Maximize2 size={15} strokeWidth={1.4} />
            )}
          </ToolbarBtn>
        </div>
      </TitleBar>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <NotePage key={note.id} note={note} />
      </div>
    </div>
  );
}
