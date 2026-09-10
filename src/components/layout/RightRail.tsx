import { ProofreadPanel, SuggestionsPanel } from "@/components/ai/SuggestionsRail";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { WikiPeek } from "@/components/editor/WikiPeek";
import { EmptyState, IconButton, MonoLabel, TextArea, TextButton } from "@/components/ui";
import { useContextMenu } from "@/components/ContextMenu";
import { ChromeIcon, NoteLabel } from "@/lib/chrome-icons";
import { noteMenuItems, tagMenuItems } from "@/lib/context-menus";
import { estimatePageAiCost, formatUsd } from "@/lib/ai-cost";
import { resolveAiModel } from "@/lib/ai";
import { backlinks, relationsTo, unlinkedMentions } from "@/lib/graph";
import { useT } from "@/lib/use-t";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { extractOutline, extractWikilinks, resolveLink, scrollToHeading } from "@/lib/parse";
import { useApp } from "@/store";
import type { Note, NoteComment } from "@/types";
import {
  AtSign,
  Check,
  Coins,
  CornerDownLeft,
  GitBranch,
  Link2,
  List,
  MessageSquare,
  RotateCcw,
  Sparkles,
  SpellCheck2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function RightRail() {
  const view = useApp((s) => s.view);
  const notes = useApp((s) => s.notes);
  const propsOpen = useApp((s) => s.propsOpen);
  const toggleProps = useApp((s) => s.toggleProps);
  const setView = useApp((s) => s.setView);
  const peers = useApp((s) => s.peers);
  const addComment = useApp((s) => s.addComment);
  const resolveComment = useApp((s) => s.resolveComment);
  const removeComment = useApp((s) => s.removeComment);
  const ai = useApp((s) => s.ai);
  const aiModel = resolveAiModel(ai, "writing");
  const aiEndpoint = ai.endpoint;
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const tools = activeWorkspace?.tools ?? defaultWorkspaceTools();
  // Suggestions need a remote model; local workspaces stay offline.
  const suggestionsEnabled = tools.suggestions && (activeWorkspace?.aiMode ?? "remote") === "remote";
  const t = useT();
  const { open } = useContextMenu();

  const id = view.kind === "note" || view.kind === "database" ? view.id : null;
  const note = id ? notes.find((n) => n.id === id) ?? null : null;
  const [editorText, setEditorText] = useState("");
  const [liveWiki, setLiveWiki] = useState("");

  useEffect(() => {
    if (!note) {
      setEditorText("");
      setLiveWiki("");
      return;
    }
    let mo: MutationObserver | null = null;
    let rootMo: MutationObserver | null = null;
    let t = 0;
    const syncFrom = (el: HTMLElement) => {
      const raw = el.textContent || "";
      setEditorText(raw);
      if (raw.length > 80_000) {
        setLiveWiki("");
        return;
      }
      const marks = [...el.querySelectorAll<HTMLElement>("[data-wiki]")]
        .map((node) => node.getAttribute("data-wiki")?.trim())
        .filter((t): t is string => Boolean(t));
      setLiveWiki(marks.map((title) => `[[${title}]]`).join("\n"));
    };
    const attach = () => {
      const el = document.querySelector<HTMLElement>(".ProseMirror, .cm-content");
      if (!el) return false;
      const syncSoon = () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => syncFrom(el), 400);
      };
      syncFrom(el);
      mo?.disconnect();
      mo = new MutationObserver(syncSoon);
      mo.observe(el, { childList: true, subtree: true, characterData: true });
      return true;
    };
    if (!attach()) {
      rootMo = new MutationObserver(() => {
        if (attach()) rootMo?.disconnect();
      });
      const root = document.getElementById("root") ?? document.body;
      rootMo.observe(root, { childList: true, subtree: true });
    }
    return () => {
      window.clearTimeout(t);
      mo?.disconnect();
      rootMo?.disconnect();
    };
  }, [note?.id, note?.body]);

  const prevNoteId = useRef(id);
  useEffect(() => {
    if (prevNoteId.current === id) return;
    prevNoteId.current = id;
    if (window.matchMedia("(max-width: 767px)").matches) {
      useApp.setState({ propsOpen: false });
    }
  }, [id]);

  const frame = (children: React.ReactNode) => (
    <>
      <button
        type="button"
        aria-label="Close context"
        className="absolute inset-0 z-30 bg-ink/20 lg:hidden"
        onClick={toggleProps}
      />
      <aside className="absolute inset-y-0 right-0 z-40 flex h-full w-[min(100%,20rem)] shrink-0 flex-col overflow-y-auto border-l border-line bg-blotter p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:static lg:w-64">
        {children}
      </aside>
    </>
  );

  if (!propsOpen) return null;
  if (!note) {
    return frame(
      <>
        <MonoLabel>Context</MonoLabel>
        <p className="mt-4 text-sm text-mute">Open a page for outline, links, and comments.</p>
      </>,
    );
  }

  const backs = backlinks(note.id, notes);
  const rels = relationsTo(note.id, notes);
  const unlinked = unlinkedMentions(note, notes);
  const linkSource =
    extractWikilinks(liveWiki).length > 0
      ? liveWiki
      : extractWikilinks(note.body).length > 0
        ? note.body
        : extractWikilinks(editorText).length > 0
          ? editorText
          : note.body;
  const linkTargets = [
    ...new Map(
      extractWikilinks(linkSource).map((l) => [l.target.toLowerCase(), l.target] as const),
    ).values(),
  ];
  const outs = linkTargets.map((target) => ({
    target,
    note: resolveLink(target, notes),
  }));
  const outlineSource =
    extractOutline(note.body).length > 0
      ? note.body
      : extractOutline(editorText).length > 0
        ? editorText
        : note.body;
  const outline = extractOutline(outlineSource);
  const here = peers.filter((p) => p.noteId === note.id);

  return frame(
    <>
      <div className="flex items-center justify-between">
        <MonoLabel>Context</MonoLabel>
        <TextButton className="h-7 px-2 py-0 text-xs" onClick={toggleProps}>
          Hide
        </TextButton>
      </div>
      <Rail title="Outline" icon={List}>
        {outline.length ? (
          outline.map((h) => (
            <button
              key={`${h.level}-${h.text}`}
              type="button"
              className="klever-focus block w-full truncate rounded-md py-0.5 text-left text-sm text-mute hover:bg-ink/[0.06] hover:text-ink"
              style={{ paddingLeft: (h.level - 1) * 10 }}
              onClick={() => scrollToHeading(h.text)}
            >
              {h.text}
            </button>
          ))
        ) : (
          <p className="text-sm text-faint">No headings yet. Start a line with #.</p>
        )}
      </Rail>
      <Rail title="Links" icon={Link2}>
        {outs.length ? (
          outs.map(({ target, note: hit }) => (
            <div key={target} className="block min-w-0 truncate">
              <WikiPeek target={target} notes={notes}>
                {hit?.title ?? target}
              </WikiPeek>
            </div>
          ))
        ) : (
          <p className="text-sm text-faint">No links out. Type [[ to add one.</p>
        )}
      </Rail>
      <Rail title="Backlinks" icon={CornerDownLeft}>
        {backs.length ? (
          backs.map((n) => (
            <div key={n.id} className="block min-w-0 truncate">
              <WikiPeek target={n.title} notes={notes}>
                {n.title}
              </WikiPeek>
            </div>
          ))
        ) : (
          <p className="text-sm text-faint">Nothing points here yet.</p>
        )}
      </Rail>
      <Rail title="Unlinked" icon={AtSign}>
        {unlinked.length ? (
          unlinked.map((n) => (
            <button
              key={n.id}
              type="button"
              className="klever-focus block truncate rounded-md py-0.5 text-left text-sm text-mute hover:bg-ink/[0.06] hover:text-ink"
              onClick={() => setView({ kind: "note", id: n.id })}
              onContextMenu={(e) => open(e, noteMenuItems(n))}
            >
              {n.title}
            </button>
          ))
        ) : (
          <p className="text-sm text-faint">No unlinked mentions of this title.</p>
        )}
      </Rail>
      <Rail title="Relations" icon={GitBranch}>
        {rels.length ? (
          rels.map((n) => (
            <button
              key={n.id}
              type="button"
              className="klever-focus block truncate rounded-md py-0.5 text-left text-sm text-mute hover:bg-ink/[0.06] hover:text-ink"
              onClick={() => setView({ kind: "note", id: n.id })}
              onContextMenu={(e) => open(e, noteMenuItems(n))}
            >
              {n.title}
            </button>
          ))
        ) : (
          <p className="text-sm text-faint">No database relations.</p>
        )}
      </Rail>
      {suggestionsEnabled && (
        <>
          <Rail title={t("suggest.title")} icon={Sparkles}>
            <SuggestionsPanel note={note} />
          </Rail>
          <Rail title={t("proof.title")} icon={SpellCheck2}>
            <ProofreadPanel note={note} />
          </Rail>
        </>
      )}
      <AiUsageRail note={note} liveBody={editorText} model={aiModel} endpoint={aiEndpoint} />
      {here.length > 0 && (
        <Rail title="Here" icon={Users}>
          <p className="text-sm text-mute">
            {here.length === 1
              ? here[0].name
              : `${here.length} other tabs on this page`}
          </p>
        </Rail>
      )}
      <CommentsRail
        comments={note.comments ?? []}
        notes={notes}
        onAdd={(body) => addComment(note.id, body)}
        onResolve={(id, resolved) => resolveComment(note.id, id, resolved)}
        onRemove={(id) => removeComment(note.id, id)}
        onOpen={(id) => {
          const hit = notes.find((n) => n.id === id);
          if (!hit) return;
          setView(hit.type === "database" ? { kind: "database", id: hit.id } : { kind: "note", id: hit.id });
        }}
      />
    </>,
  );
}

function AiUsageRail({
  note,
  liveBody,
  model,
  endpoint,
}: {
  note: Note;
  liveBody: string;
  model: string;
  endpoint: string;
}) {
  const estimate = useMemo(
    () => estimatePageAiCost(note, model, endpoint, liveBody),
    [note, model, endpoint, liveBody],
  );
  const tokenLabel = estimate.tokens.toLocaleString();
  const costLine =
    estimate.costUsd == null
      ? "rate unknown"
      : estimate.costUsd === 0
        ? "est. $0"
        : `est. ${formatUsd(estimate.costUsd)}`;

  return (
    <Rail title="AI usage" icon={Coins}>
      <p className="text-sm text-mute">
        {tokenLabel} tokens · {costLine}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10px] text-faint">{estimate.model}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-faint">
        Page size if sent as context, not live API billing. Tokens ≈ characters ÷ 4.
      </p>
    </Rail>
  );
}

function Rail({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof List;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <span className="flex items-center gap-1.5">
        {Icon && <ChromeIcon icon={Icon} />}
        <MonoLabel>{title}</MonoLabel>
      </span>
      <div className="mt-3 flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function CommentsRail({
  comments,
  notes,
  onAdd,
  onResolve,
  onRemove,
  onOpen,
}: {
  comments: NoteComment[];
  notes: Note[];
  onAdd: (body: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const mentionQ = draft.match(/@([^\s@]*)$/)?.[1];
  const mentionHits =
    mentionQ !== undefined
      ? notes
          .filter((n) => n.title.toLowerCase().includes(mentionQ.toLowerCase()))
          .slice(0, 6)
      : [];
  const open = comments.filter((c) => !c.resolved);
  const done = comments.filter((c) => c.resolved);

  const submit = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <Rail title="Comments" icon={MessageSquare}>
      {open.length === 0 && done.length === 0 && (
        <p className="text-sm text-faint">Leave a comment. Use @ to mention a page.</p>
      )}
      {open.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          notes={notes}
          onOpen={onOpen}
          onResolve={() => onResolve(c.id, true)}
          onRemove={() => onRemove(c.id)}
        />
      ))}
      {done.length > 0 && (
        <p className="mt-3 font-mono text-[10px] text-faint">{done.length} resolved</p>
      )}
      {done.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          notes={notes}
          onOpen={onOpen}
          onResolve={() => onResolve(c.id, false)}
          onRemove={() => onRemove(c.id)}
        />
      ))}
      <TextArea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Comment… @ to mention a page"
        rows={2}
        className="mt-3 resize-none text-sm"
      />
      {mentionHits.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-line">
          {mentionHits.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="klever-focus flex w-full items-center gap-2 truncate px-2 py-1 text-left text-[11px] text-mute hover:bg-ink/[0.06] hover:text-ink"
                onClick={() => setDraft((d) => d.replace(/@([^\s@]*)$/, `@${n.title} `))}
              >
                <AtSign size={12} strokeWidth={1.4} className="shrink-0 text-faint" />
                {n.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Rail>
  );
}

function CommentItem({
  comment,
  notes,
  onOpen,
  onResolve,
  onRemove,
}: {
  comment: NoteComment;
  notes: Note[];
  onOpen: (id: string) => void;
  onResolve: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`mb-3 ${comment.resolved ? "opacity-50" : ""}`}>
      <p className="flex items-center gap-1 font-mono text-[10px] text-faint">
        <span className="truncate">{comment.author}</span>
        <IconButton
          aria-label={comment.resolved ? "Reopen comment" : "Resolve comment"}
          onClick={onResolve}
        >
          {comment.resolved ? (
            <RotateCcw size={13} strokeWidth={1.4} />
          ) : (
            <Check size={13} strokeWidth={1.4} />
          )}
        </IconButton>
        <IconButton aria-label="Delete comment" onClick={onRemove}>
          <X size={13} strokeWidth={1.4} />
        </IconButton>
      </p>
      <p className="mt-1 text-sm text-mute">
        {comment.body.split(/(@[A-Za-z][\w-]*)/g).map((part, i) => {
          if (!part.startsWith("@")) return <span key={i}>{part}</span>;
          const q = part.slice(1).trim();
          const hit = notes.find((n) => n.title.toLowerCase() === q.toLowerCase());
          if (!hit) return <span key={i}>{part}</span>;
          return (
            <button
              key={i}
              type="button"
              className="text-ink underline decoration-line underline-offset-4"
              onClick={() => onOpen(hit.id)}
            >
              {part}
            </button>
          );
        })}
      </p>
    </div>
  );
}

export function TagPage({ tag }: { tag: string }) {
  const notes = useApp((s) => s.notes);
  const setView = useApp((s) => s.setView);
  const { open } = useContextMenu();
  const hits = useMemo(() => notes.filter((n) => n.tags.includes(tag)), [notes, tag]);
  return (
    <div
      className="mx-auto max-w-[720px] px-4 py-10 md:px-8 md:py-12"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest("li, button")) return;
        open(e, tagMenuItems(tag));
      }}
    >
      <MonoLabel>Tag</MonoLabel>
      <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-tag">#{tag}</h1>
      {hits.length === 0 ? (
        <EmptyState
          className="px-0 py-8"
          title="No pages with this tag"
          description="Add the tag on a page to collect it here."
        />
      ) : (
      <ul className="mt-10 space-y-8">
        {hits.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="inline-flex max-w-full items-center font-sans text-2xl hover:opacity-70"
              onClick={() =>
                setView(n.type === "database" ? { kind: "database", id: n.id } : { kind: "note", id: n.id })
              }
              onContextMenu={(e) => open(e, noteMenuItems(n))}
            >
              <NoteLabel note={n} size={22} />
            </button>
            <div className="mt-2 line-clamp-4 text-sm text-mute">
              <MarkdownPreview note={n} notes={notes} small />
            </div>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
