import { BlockEditor } from "@/components/editor/BlockEditor";
import { IconChooser } from "@/components/editor/IconChooser";
import { ImageBlock } from "@/components/editor/ImageBlock";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { PropertyManager, schemaTarget } from "@/components/db/PropertyManager";
import { PropInput } from "@/components/editor/PropInput";
import { SlashStack } from "@/components/insert/PlusMenu";
import { Chip, ConfirmDialog, GhostButton, MenuTrigger, MonoLabel, Panel, Segmented, TextButton, Toggle, ToolbarBtn } from "@/components/ui";
import { ChromeIcon, ICON_LG, NoteIcon, noteKindIcon, PROP_ICONS } from "@/lib/chrome-icons";
import { extractImages, setImageWidth } from "@/lib/assets";
import { cn } from "@/lib/cn";
import { filterCommands, slashCommands } from "@/lib/commands";
import { registerEditorInsert, setSlashRange } from "@/lib/editor-bridge";
import { slugify } from "@/lib/ids";
import { runCommand } from "@/lib/run-command";
import { useApp } from "@/store";
import type { Note, PageFont, PageWidth } from "@/types";
import { markdown } from "@codemirror/lang-markdown";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { ChevronRight, Loader2, Mic, Plus, Settings2, Sparkles, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { startTranscription, speechSupported } from "@/lib/speech";
import { rewrite, WRITING_TOOLS } from "@/lib/ai";
import { defaultWorkspaceTools } from "@/lib/workspaces";

const cmTheme = EditorView.theme({
  "&": { fontSize: "16px", color: "var(--color-ink)", backgroundColor: "transparent" },
  ".cm-content": {
    caretColor: "var(--color-ink)",
    fontFamily: "Instrument Sans, sans-serif",
    minHeight: "50vh",
    color: "var(--color-ink)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-ink)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--color-ink) 16%, transparent) !important",
  },
  ".cm-line": { lineHeight: "1.75" },
  ".cm-activeLine": { backgroundColor: "transparent" },
});

export function NotePage({ note }: { note: Note }) {
  const notes = useApp((s) => s.notes);
  const mode = useApp((s) => s.mode);
  const patchNote = useApp((s) => s.patchNote);
  const deleteNote = useApp((s) => s.deleteNote);
  const upsertNote = useApp((s) => s.upsertNote);
  const ai = useApp((s) => s.ai);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const tools = activeWorkspace?.tools ?? defaultWorkspaceTools();
  const aiMode = activeWorkspace?.aiMode ?? "remote";
  const writingEnabled = tools.writingTools && aiMode === "remote";
  const setError = useApp((s) => s.setError);
  const setView = useApp((s) => s.setView);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const starred = useApp((s) => s.starred);
  const toggleStar = useApp((s) => s.toggleStar);
  const [body, setBody] = useState(note.body);
  const [baseline, setBaseline] = useState(note.body);
  const [seenId, setSeenId] = useState(note.id);
  if (note.id !== seenId) {
    setSeenId(note.id);
    setBody(note.body);
    setBaseline(note.body);
  }
  const dirty = body !== baseline;
  const [busy, setBusy] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [slash, setSlash] = useState<{ from: number; to: number; query: string } | null>(null);
  const [slashI, setSlashI] = useState(0);
  const [manageProps, setManageProps] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [coverHover, setCoverHover] = useState(false);
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [titleSeenId, setTitleSeenId] = useState(note.id);
  if (note.id !== titleSeenId) {
    setTitleSeenId(note.id);
    setDraftTitle(note.title);
  }
  // Keep draft in sync when title changes externally (not while focused — blur commits).
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (document.activeElement === titleInputRef.current) return;
    if (draftTitle === note.title) return;
    setDraftTitle(note.title);
  }, [note.title, note.id, draftTitle]);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const bodyUserRef = useRef("");
  const bodySpeechRef = useRef("");
  const skipBodySpeechRef = useRef(false);
  const viewRef = useRef<EditorView | null>(null);
  const slashRef = useRef(slash);
  const slashIRef = useRef(slashI);
  slashRef.current = slash;
  slashIRef.current = slashI;
  const slashHits = useMemo(
    () => (slash ? filterCommands(slashCommands(notes), slash.query) : []),
    [notes, slash],
  );
  const slashHitsRef = useRef(slashHits);
  slashHitsRef.current = slashHits;

  useEffect(() => setSlashI(0), [slash?.query]);

  useEffect(() => {
    if (mode !== "markdown") viewRef.current = null;
  }, [mode]);

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
    }, 220);
    return () => window.clearTimeout(t);
  }, [body, note.body, note.id, patchNote]);

  useEffect(() => {
    registerEditorInsert((snippet, replace) => {
      const view = viewRef.current;
      if (view) {
        if (replace) {
          view.dispatch({
            changes: { from: replace.from, to: replace.to, insert: snippet },
            selection: { anchor: replace.from + snippet.length },
          });
        } else {
          const pos = view.state.selection.main.from;
          view.dispatch({ changes: { from: pos, to: pos, insert: snippet } });
        }
        setBody(view.state.doc.toString());
        view.focus();
      } else {
        setBody((b) => b + snippet);
      }
      setSlash(null);
      setSlashRange(null);
    });
    return () => registerEditorInsert(null);
  }, [note.id]);

  const detectSlash = (view: EditorView) => {
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);
    const m = before.match(/(?:^|\s)(\/([^\s]*))$/);
    if (!m) {
      setSlash(null);
      setSlashRange(null);
      return;
    }
    const token = m[1];
    const from = line.from + before.length - token.length;
    const next = { from, to: pos, query: m[2] };
    setSlash(next);
    setSlashRange({ from, to: pos });
  };

  const slashKeys = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: "ArrowDown",
            run: () => {
              if (!slashRef.current) return false;
              setSlashI((x) => Math.min(slashHitsRef.current.length - 1, x + 1));
              return true;
            },
          },
          {
            key: "ArrowUp",
            run: () => {
              if (!slashRef.current) return false;
              setSlashI((x) => Math.max(0, x - 1));
              return true;
            },
          },
          {
            key: "Enter",
            run: () => {
              const s = slashRef.current;
              const cmd = slashHitsRef.current[slashIRef.current];
              if (!s || !cmd) return false;
              void runCommand(cmd).then(() => {
                setSlash(null);
                setSlashRange(null);
              });
              return true;
            },
          },
          {
            key: "Escape",
            run: () => {
              if (!slashRef.current) return false;
              setSlash(null);
              setSlashRange(null);
              return true;
            },
          },
        ]),
      ),
    [],
  );

  const completions = useMemo(
    () =>
      autocompletion({
        override: [
          (ctx: CompletionContext) => {
            const word = ctx.matchBefore(/\[\[[^\]|]*/);
            if (!word) return null;
            const q = word.text.replace(/^\[\[/, "").toLowerCase();
            return {
              from: word.from + 2,
              options: notes
                .filter((n) => n.title.toLowerCase().includes(q))
                .slice(0, 12)
                .map((n) => ({ label: n.title, type: "text" })),
            };
          },
        ],
      }),
    [notes],
  );

  const listener = useMemo(
    () =>
      EditorView.updateListener.of((u) => {
        if (u.docChanged || u.selectionSet) detectSlash(u.view);
      }),
    [],
  );

  const applyTool = async (id: string) => {
    const tool = WRITING_TOOLS.find((t) => t.id === id);
    if (!tool || busy) return;
    const view = viewRef.current;
    const selected = view
      ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
      : "";
    const source = selected || body;
    if (!source.trim()) {
      setError("Select text or write something before using a writing tool.");
      return;
    }
    if (aiMode === "local") {
      setError("This workspace uses local AI — switch to remote AI in workspace settings for writing tools.");
      return;
    }
    if (!tools.writingTools) {
      setError("Writing tools are turned off for this workspace.");
      return;
    }
    if (!ai.apiKey.trim()) {
      setError("Add a Gemini API key in Settings to use AI writing tools.");
      return;
    }
    setBusy(tool.label);
    setError(null);
    try {
      const next = await rewrite(ai, source, tool.instruction);
      if (selected && view) {
        const { from, to } = view.state.selection.main;
        view.dispatch({ changes: { from, to, insert: next } });
        setBody(view.state.doc.toString());
      } else {
        setBody(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Writing tool failed");
    } finally {
      setBusy(null);
    }
  };

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

  const images = extractImages(body);
  const isRead = mode === "read";
  const width = isRead
    ? note.width === "s"
      ? "max-w-[60ch]"
      : note.width === "l"
        ? "max-w-[75ch]"
        : "max-w-[68ch]"
    : note.width === "s"
      ? "max-w-[560px]"
      : note.width === "l"
        ? "max-w-5xl"
        : "max-w-[720px]";
  const font = isRead
    ? "font-serif"
    : note.font === "serif"
      ? "font-serif"
      : note.font === "mono"
        ? "font-mono text-[15px]"
        : "font-sans";

  return (
    <article className={cn("min-h-full group/page", isRead && "reading-mode")}>
      <div
        className="relative"
        onMouseEnter={() => !isRead && setCoverHover(true)}
        onMouseLeave={() => setCoverHover(false)}
      >
        {note.cover ? (
          <div
            className={cn("w-full", isRead ? "h-44" : "h-36")}
            style={{
              background:
                note.cover.startsWith("#") || note.cover.startsWith("rgb") ? note.cover : undefined,
            }}
            aria-hidden
          />
        ) : (
          !isRead && (
            <div
              className={cn(
                "flex h-10 items-end px-8 transition-opacity duration-150",
                coverHover ? "opacity-100" : "opacity-0",
              )}
            >
              <TextButton onClick={() => patchNote(note.id, { cover: "#cfc8b8" })}>
                Add cover
              </TextButton>
            </div>
          )
        )}
      </div>

      <div
        className={cn(
          "mx-auto px-8 pb-32",
          note.cover ? (isRead ? "pt-10" : "pt-8") : isRead ? "pt-10" : "pt-4",
          width,
          isRead && "motion-safe:animate-sheet",
        )}
      >
        <div
          className={cn(
            "mb-2 flex flex-wrap items-center gap-1 text-[11px] text-mute",
            isRead && "opacity-70",
          )}
        >
          {note.parent ? (
            <>
              <button
                type="button"
                className="font-serif hover:bg-paper-2 hover:text-ink"
                onClick={() => setView({ kind: "database", id: note.parent! })}
              >
                {parentTitle(notes, note.parent)}
              </button>
              <ChevronRight size={12} strokeWidth={1.4} className="text-faint" aria-hidden />
              <span className="truncate text-faint">{note.title || "Untitled"}</span>
            </>
          ) : (
            <MonoLabel>{isRead ? "Reading" : note.template ? "Template" : "Page"}</MonoLabel>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-1">
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
            {!isRead && (
              <>
                <ToolbarBtn label="Insert" aria-label="Insert" onClick={() => setPlusOpen(true, "editor")}>
                  <Plus size={15} strokeWidth={1.4} />
                </ToolbarBtn>
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
                <ToolbarBtn label="Delete" aria-label="Delete note" onClick={() => setPendingDelete(true)}>
                  <Trash2 size={15} strokeWidth={1.4} />
                </ToolbarBtn>
              </>
            )}
          </span>
        </div>

        <div className={cn("mb-3", isRead && "mb-5")}>
          {isRead ? (
            <div
              className="inline-flex items-center justify-center"
              style={{ width: ICON_LG + 12, height: ICON_LG + 12 }}
            >
              <NoteIcon
                icon={note.icon}
                fallback={noteKindIcon(note.type)}
                size={ICON_LG}
                className="text-ink"
              />
            </div>
          ) : (
            <IconChooser
              value={note.icon}
              onChange={(icon) => patchNote(note.id, { icon })}
              fallback={noteKindIcon(note.type)}
            />
          )}
        </div>

        {isRead ? (
          <h1 className="w-full font-serif text-[2.5rem] leading-[1.15] tracking-tight text-ink md:text-[2.75rem]">
            {note.title || "Untitled"}
          </h1>
        ) : (
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => {
              const title = draftTitle;
              if (title === note.title) return;
              const folder = note.path.includes("/")
                ? note.path.split("/").slice(0, -1).join("/")
                : "";
              const nextPath = `${folder ? folder + "/" : ""}${slugify(title || "untitled")}${
                note.type === "database" ? ".database.md" : ".md"
              }`;
              // Include local body — upsert replaces the whole note and must not wipe unsaved edits.
              upsertNote(
                { ...note, title, path: nextPath, body },
                { renameFrom: note.path },
              );
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full bg-transparent font-sans text-4xl leading-tight tracking-tight text-ink placeholder:text-faint focus-visible:outline-none"
            placeholder="Untitled"
          />
        )}

        {isRead ? (
          note.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {note.tags.map((t) => (
                <Chip
                  key={t}
                  selected
                  onClick={() => setView({ kind: "tag", tag: t })}
                  className="font-mono"
                >
                  #{t}
                </Chip>
              ))}
            </div>
          )
        ) : (
          <PropertyStrip note={note} onManage={() => setManageProps(true)} />
        )}

        {!isRead && (
          <div className="mt-4">
            <MenuTrigger open={pageOpen} onClick={() => setPageOpen((o) => !o)}>
              <Settings2 size={13} strokeWidth={1.4} />
              Page style
            </MenuTrigger>
            {pageOpen && (
              <Panel className="mt-2 flex flex-wrap items-center gap-4 px-3 py-3">
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
                    value={note.width ?? "m"}
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
                <label className="inline-flex items-center gap-2 font-serif text-sm text-mute">
                  Cover
                  <input
                    type="color"
                    className="h-7 w-8 cursor-pointer rounded-lg border border-line bg-paper p-0.5"
                    value={toHex(note.cover)}
                    onChange={(e) => patchNote(note.id, { cover: e.target.value })}
                  />
                </label>
                {note.cover && (
                  <TextButton onClick={() => patchNote(note.id, { cover: undefined })}>
                    Remove cover
                  </TextButton>
                )}
              </Panel>
            )}
          </div>
        )}

        <div
          className={cn(
            isRead ? "mt-12" : "mt-10",
            font,
            !isRead && note.smallText && "text-[14px] leading-7",
          )}
        >
          {isRead ? (
            <MarkdownPreview
              note={{ ...note, body }}
              notes={notes}
              small={note.smallText}
              reading
            />
          ) : mode === "wysiwyg" ? (
            <BlockEditor key={note.id} noteId={note.id} markdown={body} onChange={onBodyChange} />
          ) : (
            <>
              <p className="mb-3 font-mono text-[10px] text-faint">Type / for blocks · [[ to link</p>
              <CodeMirror
                value={body}
                height="auto"
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                extensions={[markdown(), completions, cmTheme, slashKeys, listener]}
                onChange={onBodyChange}
                onCreateEditor={(view) => {
                  viewRef.current = view;
                }}
              />
              {slash && (
                <SlashStack
                  query={slash.query}
                  index={slashI}
                  onIndex={setSlashI}
                  onClose={() => {
                    setSlash(null);
                    setSlashRange(null);
                  }}
                  onRun={(cmd) => void runCommand(cmd)}
                />
              )}
              {images.length > 0 && (
                <div className="mt-8 border-t border-line pt-6">
                  <MonoLabel>Images</MonoLabel>
                  {images.map((img) => (
                    <ImageBlock
                      key={img.src}
                      src={img.src}
                      caption={img.caption}
                      width={img.width}
                      onWidth={(w) => setBody(setImageWidth(body, img.src, w))}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!isRead && writingEnabled && (
          <div
            className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-4"
            aria-busy={Boolean(busy)}
          >
            {busy ? (
              <Loader2 size={13} strokeWidth={1.6} className="animate-spin text-faint" aria-hidden />
            ) : (
              <Sparkles size={13} strokeWidth={1.4} className="text-faint" aria-hidden />
            )}
            {busy && (
              <span className="font-mono text-[11px] text-mute" role="status">
                {busy} with Gemini…
              </span>
            )}
            {WRITING_TOOLS.map((t) => (
              <GhostButton
                key={t.id}
                className="border-0 px-2 py-1 text-[12px] text-mute"
                disabled={Boolean(busy)}
                aria-pressed={busy === t.label}
                onClick={() => void applyTool(t.id)}
              >
                {busy === t.label ? `${t.label}…` : t.label}
              </GhostButton>
            ))}
          </div>
        )}
      </div>
      {manageProps && <PropertyManager note={note} onClose={() => setManageProps(false)} />}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this page?"
          description="The file is removed from the vault. This cannot be undone."
          confirmLabel="Delete"
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

function PropertyStrip({ note, onManage }: { note: Note; onManage: () => void }) {
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const setView = useApp((s) => s.setView);
  const target = schemaTarget(note, notes);
  const schema = (target.schema ?? []).filter((s) => !s.hidden);

  return (
    <div className="mt-8 space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {note.tags.map((t) => (
            <Chip
              key={t}
              selected
              onClick={() => setView({ kind: "tag", tag: t })}
              className="font-mono"
            >
              #{t}
            </Chip>
        ))}
        <input
          placeholder="add tag"
          className="w-24 bg-transparent font-mono text-[11px] text-mute placeholder:text-faint focus-visible:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = e.currentTarget.value.replace(/^#/, "").trim();
              if (v && !note.tags.includes(v)) patchNote(note.id, { tags: [...note.tags, v] });
              e.currentTarget.value = "";
            }
          }}
        />
        <TextButton onClick={onManage}>
          <Plus size={13} strokeWidth={1.4} />
          property
        </TextButton>
      </div>
      {schema.map((s) => (
        <div key={s.key} className="grid grid-cols-[140px_1fr] items-center gap-3 py-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <ChromeIcon icon={PROP_ICONS[s.type]} />
            <MonoLabel>{s.name}</MonoLabel>
          </span>
          <PropInput
            note={note}
            field={s.key}
            type={s.type}
            options={s.options}
            relationTo={s.relationTo}
            spec={s}
          />
        </div>
      ))}
    </div>
  );
}
