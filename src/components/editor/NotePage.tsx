import { BlockEditor } from "@/components/editor/BlockEditor";
import { IconChooser } from "@/components/editor/IconChooser";
import { PropertyStrip } from "@/components/editor/PropertyStrip";
import { ConfirmDialog, MonoLabel, Panel, Segmented, TextButton, Toggle, ToolbarBtn } from "@/components/ui";
import { useContextMenu } from "@/components/ContextMenu";
import { noteMenuItems } from "@/lib/context-menus";
import { noteKindIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import {
  registerBodyAppend,
  registerBodyRead,
  registerBodyReplace,
  registerEditorInsert,
  replaceOpenNoteSelection,
} from "@/lib/editor-bridge";
import { pageFontClass } from "@/lib/page-fonts";
import { slugify } from "@/lib/ids";
import { registerBeforeFlush } from "@/lib/save-hooks";
import { useApp } from "@/store";
import type { Note, PageFont, PageWidth } from "@/types";
import { ChevronDown, ChevronRight, GitBranch, Loader2, Mic, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { startTranscription, speechSupported } from "@/lib/speech";
import { WritingEditConfirm } from "@/components/editor/WritingEditConfirm";
import { WritingToolsBar, type PendingWritingEdit } from "@/components/editor/WritingToolsBar";
import { MeetingNotesBlock } from "@/components/ai/MeetingNotesBlock";
import { isMeetingNote } from "@/lib/meetings";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { schemaTarget } from "@/components/db/PropertyManager";
import { writingPagePatch } from "@/lib/ai";
import { useT } from "@/lib/use-t";

export function NotePage({ note, active = true }: { note: Note; active?: boolean }) {
  const t = useT();
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const deleteNote = useApp((s) => s.deleteNote);
  const upsertNote = useApp((s) => s.upsertNote);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const tools = activeWorkspace?.tools ?? defaultWorkspaceTools();
  const aiMode = activeWorkspace?.aiMode ?? "remote";
  const writingEnabled = tools.writingTools && aiMode === "remote";
  const meetingPage = isMeetingNote(note, notes);
  const setError = useApp((s) => s.setError);
  const setView = useApp((s) => s.setView);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const setRelateNoteId = useApp((s) => s.setRelateNoteId);
  const starred = useApp((s) => s.starred);
  const toggleStar = useApp((s) => s.toggleStar);
  const openTabs = useApp((s) => s.openTabs);
  const [body, setBody] = useState(note.body);
  const [baseline, setBaseline] = useState(note.body);
  const [seenId, setSeenId] = useState(note.id);
  const [pendingRewrite, setPendingRewrite] = useState<PendingWritingEdit | null>(null);
  if (note.id !== seenId) {
    setSeenId(note.id);
    setBody(note.body);
    setBaseline(note.body);
    setPendingRewrite(null);
  }
  const dirty = body !== baseline;
  const [busy, setBusy] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [coverHover, setCoverHover] = useState(false);
  const [rewriteFlash, setRewriteFlash] = useState(false);
  const rewriteFlashTimer = useRef<number | undefined>(undefined);
  const pageMenuRef = useRef<HTMLSpanElement>(null);

  const triggerRewriteFlash = () => {
    window.clearTimeout(rewriteFlashTimer.current);
    setRewriteFlash(false);
    requestAnimationFrame(() => {
      setRewriteFlash(true);
      rewriteFlashTimer.current = window.setTimeout(() => setRewriteFlash(false), 1200);
    });
  };

  const acceptRewrite = () => {
    if (!pendingRewrite) return;
    const { result, selection } = pendingRewrite;
    if (selection) {
      replaceOpenNoteSelection(result.body);
    } else {
      setBody(result.body);
    }
    const liveNotes = useApp.getState().notes;
    const live = liveNotes.find((n) => n.id === note.id) ?? note;
    const target = schemaTarget(live, liveNotes);
    const fullSchema = target.schema ?? [];
    const pageResult = writingPagePatch(live, result, fullSchema, liveNotes);
    if (pageResult) {
      const nextSchema = pageResult.schemaAdds.length
        ? [...fullSchema, ...pageResult.schemaAdds]
        : undefined;
      if (target.id === live.id) {
        if (Object.keys(pageResult.patch).length || nextSchema) {
          patchNote(live.id, { ...pageResult.patch, ...(nextSchema ? { schema: nextSchema } : {}) });
        }
      } else {
        if (nextSchema) patchNote(target.id, { schema: nextSchema });
        if (Object.keys(pageResult.patch).length) patchNote(live.id, pageResult.patch);
      }
    }
    setPendingRewrite(null);
    triggerRewriteFlash();
  };
  const discardRewrite = () => setPendingRewrite(null);
  const { open } = useContextMenu();
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [titleSeenId, setTitleSeenId] = useState(note.id);
  if (note.id !== titleSeenId) {
    setTitleSeenId(note.id);
    setDraftTitle(note.title);
  }
  useEffect(() => {
    if (!pageOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pageMenuRef.current?.contains(e.target as Node)) return;
      setPageOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPageOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [pageOpen]);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fitTitleHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    if (document.activeElement === titleInputRef.current) return;
    if (draftTitle === note.title) return;
    setDraftTitle(note.title);
  }, [note.title, note.id, draftTitle]);
  useLayoutEffect(() => {
    const el = titleInputRef.current;
    if (!el) return;
    fitTitleHeight(el);
    const parent = el.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fitTitleHeight(el));
    ro.observe(parent);
    return () => ro.disconnect();
  }, [draftTitle, note.id]);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const bodyUserRef = useRef("");
  const bodySpeechRef = useRef("");
  const skipBodySpeechRef = useRef(false);
  const bodyRef = useRef(body);
  const baselineRef = useRef(baseline);
  const draftTitleRef = useRef(draftTitle);
  bodyRef.current = body;
  baselineRef.current = baseline;
  draftTitleRef.current = draftTitle;

  // Apply remote/store body only when local edits are idle — never while dirty (keystroke fight).
  useEffect(() => {
    if (note.id !== seenId) return;
    if (dirty) return;
    if (note.body === body) return;
    setBody(note.body);
    setBaseline(note.body);
  }, [note.body, note.updated, note.id, seenId, dirty, body]);

  useEffect(() => {
    if (body === note.body) return;
    const t = window.setTimeout(() => {
      patchNote(note.id, { body });
      setBaseline(body);
    }, body.length > 80_000 ? 700 : 220);
    return () => window.clearTimeout(t);
  }, [body, note.body, note.id, patchNote]);

  useEffect(() => {
    const noteId = note.id;
    const noteTitle = note.title;
    const notePath = note.path;
    const noteType = note.type;
    const commitPending = () => {
      const pendingBody = bodyRef.current;
      const pendingBaseline = baselineRef.current;
      if (pendingBody !== pendingBaseline) {
        patchNote(noteId, { body: pendingBody });
      }
      const pendingTitle = draftTitleRef.current.replace(/\s+/g, " ").trim();
      if (pendingTitle !== noteTitle) {
        const current = useApp.getState().notes.find((n) => n.id === noteId);
        if (!current) return;
        const folder = notePath.includes("/") ? notePath.split("/").slice(0, -1).join("/") : "";
        const nextPath = `${folder ? folder + "/" : ""}${slugify(pendingTitle || "untitled")}${
          noteType === "database" ? ".database.md" : ".md"
        }`;
        upsertNote(
          { ...current, title: pendingTitle, path: nextPath, body: pendingBody },
          { renameFrom: notePath },
        );
      }
    };
    return registerBeforeFlush(commitPending);
  }, [note.id, note.title, note.path, note.type, patchNote, upsertNote]);

  useEffect(() => {
    if (!active) return;
    registerEditorInsert((snippet) => {
      setBody((b) => {
        const base = b.trimEnd();
        return base ? `${base}\n\n${snippet}` : snippet;
      });
    });
    registerBodyAppend((snippet) => {
      setBody((b) => {
        const base = b.trimEnd();
        return base ? `${base}\n\n${snippet}` : snippet;
      });
      return true;
    });
    registerBodyReplace((next) => {
      setBody(next);
      return true;
    });
    registerBodyRead(() => bodyRef.current);
    return () => {
      registerEditorInsert(null);
      registerBodyAppend(null);
      registerBodyReplace(null);
      registerBodyRead(null);
    };
  }, [note.id, active]);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      recRef.current = null;
      setListening(false);
      bodySpeechRef.current = "";
      skipBodySpeechRef.current = false;
      return;
    }
    bodyUserRef.current = body.trim() ? `${body.trim()}\n\n` : "";
    bodySpeechRef.current = "";
    skipBodySpeechRef.current = false;
    recRef.current = startTranscription((speech) => {
      if (skipBodySpeechRef.current) return;
      bodySpeechRef.current = speech;
      setBody(bodyUserRef.current + speech);
    }, (msg) => setError(msg));
    setListening(true);
  };

  const onBodyChange = (next: string) => {
    setBody(next);
    if (!listening) return;
    const speech = bodySpeechRef.current;
    if (!speech) {
      bodyUserRef.current = next.trim() ? `${next.trim()}\n\n` : next;
      return;
    }
    if (next.endsWith(speech)) {
      const base = next.slice(0, next.length - speech.length);
      bodyUserRef.current = base;
      return;
    }
    bodyUserRef.current = next.trim() ? `${next.trim()}\n\n` : next;
    bodySpeechRef.current = "";
    skipBodySpeechRef.current = true;
  };

  const pageWidth = note.width ?? "l";
  const width =
    pageWidth === "s" ? "max-w-[560px]" : pageWidth === "m" ? "max-w-[720px]" : "max-w-5xl";
  const font = cn(pageFontClass(note.font) || "font-sans", note.font === "mono" && "text-[15px]");

  return (
    <article
      className={cn("min-h-full group/page", busy && "writing-ai-working")}
      aria-busy={Boolean(busy)}
      onContextMenu={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("input, textarea, [contenteditable], .cm-editor, .ProseMirror, button")) return;
        open(e, noteMenuItems(note));
      }}
    >
      {busy && (
        <div className="writing-ai-working-status" role="status">
          <Loader2 size={12} strokeWidth={1.8} className="animate-spin" aria-hidden />
          {t("writing.withGemini", { tool: busy })}
        </div>
      )}
      <div
        className="relative"
        onMouseEnter={() => setCoverHover(true)}
        onMouseLeave={() => setCoverHover(false)}
      >
        {note.cover ? (
          <div
            className="relative h-36 w-full"
            style={{
              background:
                note.cover.startsWith("#") || note.cover.startsWith("rgb") ? note.cover : undefined,
            }}
          >
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-end gap-1 px-4 py-2 transition-opacity duration-150 md:px-8",
                "bg-gradient-to-t from-ink/25 to-transparent",
                coverHover ? "opacity-100" : "opacity-0",
                "focus-within:opacity-100",
              )}
            >
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-paper px-2 py-1 text-sm font-medium text-mute shadow-sm hover:bg-paper-2 hover:text-ink">
                Change
                <input
                  type="color"
                  className="h-5 w-6 cursor-pointer rounded border border-line bg-transparent p-0"
                  value={toHex(note.cover)}
                  aria-label="Change cover color"
                  onChange={(e) => patchNote(note.id, { cover: e.target.value })}
                />
              </label>
              <TextButton
                className="bg-paper shadow-sm hover:bg-paper-2"
                onClick={() => patchNote(note.id, { cover: undefined })}
              >
                Delete cover
              </TextButton>
            </div>
          </div>
        ) : (
          openTabs.length < 2 && (
            <div
              className={cn(
                "flex h-10 items-end px-4 transition-opacity duration-150 md:px-8",
                coverHover ? "opacity-100" : "opacity-0",
                "focus-within:opacity-100",
              )}
            >
              <TextButton onClick={() => patchNote(note.id, { cover: "#cfc8b8" })}>
                Add cover
              </TextButton>
            </div>
          )
        )}
      </div>

      <div className={cn("relative mx-auto px-5 pb-40 pt-4 md:px-8 lg:px-10", font, note.cover && "pt-8", width)}>
        {note.parent && (
        <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-mute">
          <button
            type="button"
            className="klever-focus rounded-md px-1 hover:bg-ink/[0.06] hover:text-ink"
            onClick={() => setView({ kind: "database", id: note.parent! })}
          >
            {parentTitle(notes, note.parent)}
          </button>
          <ChevronRight size={12} strokeWidth={1.4} className="text-faint" aria-hidden />
          <span className="truncate text-faint">{note.title || "Untitled"}</span>
        </div>
        )}
        <div className="mb-1 flex flex-wrap items-center justify-end gap-2 font-sans text-base">
          <span
            ref={pageMenuRef}
            className="klever-reveal relative z-10 flex flex-wrap items-center justify-end gap-0.5"
            data-open={pageOpen ? "true" : undefined}
          >
            <span className="relative">
              <ToolbarBtn
                label="Display settings"
                aria-label="Display settings"
                aria-expanded={pageOpen}
                active={pageOpen}
                onClick={() => setPageOpen((o) => !o)}
              >
                <ChevronDown size={15} strokeWidth={1.4} />
              </ToolbarBtn>
              {pageOpen && (
                <Panel className="absolute right-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] px-3 py-3 md:right-full md:top-0 md:mt-0 md:mr-2">
                  <div className="mb-2">
                    <MonoLabel>Display</MonoLabel>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <MonoLabel>Font</MonoLabel>
                      <Segmented<PageFont>
                        size="sm"
                        aria-label="Page font"
                        value={note.font ?? "sans"}
                        onChange={(f) => patchNote(note.id, { font: f })}
                        options={[
                          { value: "sans", label: "Sans" },
                          { value: "serif", label: "Serif" },
                          { value: "mono", label: "Mono" },
                        ]}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MonoLabel>Width</MonoLabel>
                      <Segmented<PageWidth>
                        size="sm"
                        aria-label="Page width"
                        value={note.width ?? "l"}
                        onChange={(w) => patchNote(note.id, { width: w })}
                        options={[
                          { value: "s", label: "Narrow" },
                          { value: "m", label: "Medium" },
                          { value: "l", label: "Wide" },
                        ]}
                      />
                    </div>
                    <Toggle
                      checked={Boolean(note.smallText)}
                      onChange={(on) => patchNote(note.id, { smallText: on })}
                      label="Small text"
                    />
                    <label className="inline-flex items-center gap-2 text-sm text-mute">
                      Cover
                      <input
                        type="color"
                        className="h-7 w-8 cursor-pointer rounded-lg border border-line bg-paper p-0.5"
                        value={toHex(note.cover)}
                        onChange={(e) => patchNote(note.id, { cover: e.target.value })}
                      />
                    </label>
                    {note.cover ? (
                      <TextButton onClick={() => patchNote(note.id, { cover: undefined })}>
                        Delete cover
                      </TextButton>
                    ) : (
                      <TextButton onClick={() => patchNote(note.id, { cover: "#cfc8b8" })}>
                        Add cover
                      </TextButton>
                    )}
                  </div>
                </Panel>
              )}
            </span>
            <ToolbarBtn
              label={starred.includes(note.id) ? "Starred" : "Star"}
              aria-label={starred.includes(note.id) ? "Unstar" : "Star"}
              active={starred.includes(note.id)}
              onClick={() => toggleStar(note.id)}
            >
              <Star
                size={15}
                strokeWidth={1.4}
                fill={starred.includes(note.id) ? "currentColor" : "none"}
              />
            </ToolbarBtn>
            <ToolbarBtn label="Insert" aria-label="Insert" onClick={() => setPlusOpen(true, "editor")}>
              <Plus size={15} strokeWidth={1.4} />
            </ToolbarBtn>
            {note.type === "page" && (
              <ToolbarBtn label="Relate" aria-label="Relate" onClick={() => setRelateNoteId(note.id)}>
                <GitBranch size={15} strokeWidth={1.4} />
              </ToolbarBtn>
            )}
            {speechSupported() && (
              <ToolbarBtn
                label={listening ? "Listening" : "Transcribe"}
                aria-label="Transcribe"
                active={listening}
                onClick={toggleMic}
              >
                <Mic size={15} strokeWidth={1.4} />
              </ToolbarBtn>
            )}
            <ToolbarBtn label="Delete" aria-label="Delete page" onClick={() => setPendingDelete(true)}>
              <Trash2 size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          </span>
        </div>

        <div className="mb-3">
          <IconChooser
            value={note.icon}
            onChange={(icon) => patchNote(note.id, { icon })}
            fallback={noteKindIcon(note.type)}
          />
        </div>

        <textarea
          ref={titleInputRef}
          rows={1}
          wrap="soft"
          value={draftTitle}
          onChange={(e) => {
            setDraftTitle(e.target.value);
            fitTitleHeight(e.target);
          }}
          onBlur={() => {
            const title = draftTitle.replace(/\s+/g, " ").trim();
            if (title !== draftTitle) setDraftTitle(title);
            if (title === note.title) return;
            const folder = note.path.includes("/")
              ? note.path.split("/").slice(0, -1).join("/")
              : "";
            const nextPath = `${folder ? folder + "/" : ""}${slugify(title || "untitled")}${
              note.type === "database" ? ".database.md" : ".md"
            }`;
            upsertNote(
              { ...note, title, path: nextPath, body },
              { renameFrom: note.path },
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          className="klever-focus klever-page-title field-sizing-content h-auto w-full resize-none overflow-hidden rounded-md bg-transparent text-ink placeholder:text-faint"
          placeholder="Untitled"
          aria-label="Page title"
        />

        <PropertyStrip note={note} />

        {meetingPage && (
          <div className="mt-6">
            <MeetingNotesBlock note={note} />
          </div>
        )}

        <div
          className={cn(
            meetingPage ? "mt-8" : "mt-10",
            note.smallText && "text-[15px] leading-[1.65]",
            rewriteFlash && "writing-rewrite-flash px-2 -mx-2 py-1",
          )}
        >
          {meetingPage && (
            <div className="mb-3">
              <MonoLabel>Notes</MonoLabel>
            </div>
          )}
          <div
            className={cn(
              "relative",
              pendingRewrite && "writing-edit-source-locked writing-edit-source-hidden",
            )}
          >
            <BlockEditor key={note.id} noteId={note.id} markdown={body} onChange={onBodyChange} bridgeActive={active} />
            {pendingRewrite && (
              <WritingEditConfirm
                pending={pendingRewrite}
                fromText={pendingRewrite.fromText}
                noteTitle={note.title}
                onAccept={acceptRewrite}
                onDiscard={discardRewrite}
              />
            )}
          </div>
        </div>

        {writingEnabled && (
          <WritingToolsBar
            note={note}
            body={body}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onPropose={setPendingRewrite}
            locked={Boolean(pendingRewrite)}
          />
        )}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this page?"
          description="The file is removed from the vault. This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteNote(note.id);
            setPendingDelete(false);
          }}
          onClose={() => setPendingDelete(false)}
        />
      )}
    </article>
  );
}

function parentTitle(notes: Note[], id: string) {
  return notes.find((n) => n.id === id)?.title ?? "Database";
}

function toHex(cover?: string) {
  if (cover && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cover)) return cover;
  return "#cfc8b8";
}
