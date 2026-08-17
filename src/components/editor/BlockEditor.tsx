import { SlashStack } from "@/components/insert/PlusMenu";
import { openNote } from "@/components/editor/WikiPeek";
import { Panel } from "@/components/ui";
import { NoteLabel } from "@/lib/chrome-icons";
import { filterCommands, slashCommands } from "@/lib/commands";
import { registerWysiwyg } from "@/lib/editor-bridge";
import { htmlToMd, mdToHtml } from "@/lib/markdown-io";
import { resolveAssetSrc } from "@/lib/assets";
import { resolveLink } from "@/lib/parse";
import { runCommand } from "@/lib/run-command";
import { useApp } from "@/store";
import { WikiLink } from "@/lib/wiki-ext";
import type { InsertCommand, Note } from "@/types";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { BubbleMenu } from "@tiptap/react/menus";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, Plus, Strikethrough } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

const AssetImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement("img");
      img.alt = node.attrs.alt ?? "";
      img.className = "max-w-full";
      const src = String(node.attrs.src ?? "");
      img.src = resolveAssetSrc(src, useApp.getState().blobs);
      return {
        dom: img,
        update: (n) => {
          img.alt = n.attrs.alt ?? "";
          img.src = resolveAssetSrc(String(n.attrs.src ?? ""), useApp.getState().blobs);
          return true;
        },
      };
    };
  },
});

function applyCommand(editor: Editor, cmd: InsertCommand | string) {
  if (editor.isDestroyed) return false;
  const id = typeof cmd === "string" ? cmd : cmd.id;
  const chain = editor.chain().focus();
  switch (id) {
    case "h1":
      return chain.setHeading({ level: 1 }).run();
    case "h2":
      return chain.setHeading({ level: 2 }).run();
    case "h3":
      return chain.setHeading({ level: 3 }).run();
    case "bullet":
      return chain.toggleBulletList().run();
    case "number":
      return chain.toggleOrderedList().run();
    case "todo":
      return chain.toggleTaskList().run();
    case "quote":
      return chain.toggleBlockquote().run();
    case "callout":
      return chain.insertContent(mdToHtml("> **Note**\n> ")).run();
    case "code":
      return chain.toggleCodeBlock().run();
    case "divider":
      return chain.setHorizontalRule().run();
    case "table":
      return chain.insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
    case "wiki":
      return chain.insertContent("[[").run();
    case "transclude":
      return chain.insertContent("![[").run();
    default: {
      const snippet = typeof cmd === "string" ? undefined : cmd.snippet;
      if (snippet) return chain.insertContent(mdToHtml(snippet)).run();
      return false;
    }
  }
}

export function BlockEditor({
  noteId,
  markdown,
  onChange,
  editable = true,
}: {
  noteId: string;
  markdown: string;
  onChange: (md: string) => void;
  editable?: boolean;
}) {
  const notes = useApp((s) => s.notes);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const [slash, setSlash] = useState<{ query: string } | null>(null);
  const [wiki, setWiki] = useState<{ query: string; embed: boolean } | null>(null);
  const [slashI, setSlashI] = useState(0);
  const [wikiI, setWikiI] = useState(0);
  const [gutter, setGutter] = useState<{ top: number } | null>(null);
  const slashRef = useRef(slash);
  const slashIRef = useRef(slashI);
  const wikiRef = useRef(wiki);
  const wikiIRef = useRef(wikiI);
  const editorRef = useRef<Editor | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(markdown);
  const syncingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  slashRef.current = slash;
  slashIRef.current = slashI;
  wikiRef.current = wiki;
  wikiIRef.current = wikiI;

  const hits = useMemo(
    () => (slash ? filterCommands(slashCommands(notes), slash.query) : []),
    [notes, slash],
  );
  const wikiHits = useMemo(() => (wiki ? wikiMatches(notes, wiki.query) : []), [notes, wiki]);
  const hitsRef = useRef(hits);
  const wikiHitsRef = useRef(wikiHits);
  hitsRef.current = hits;
  wikiHitsRef.current = wikiHits;

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: false,
        }),
        WikiLink,
        Placeholder.configure({ placeholder: "Type / for blocks, [[ to link" }),
        AssetImage.configure({ inline: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TableKit.configure({ table: { resizable: false } }),
      ],
      content: mdToHtml(markdown),
      editable,
      editorProps: {
        attributes: {
          class: "prose-klever tiptap min-h-[50vh]",
        },
        handleClick: (_view, _pos, event) => {
          const el = (event.target as HTMLElement | null)?.closest("[data-wiki]") as HTMLElement | null;
          if (!el) return false;
          const target = el.getAttribute("data-wiki");
          if (!target) return false;
          const hit = resolveLink(target, useApp.getState().notes);
          if (hit) openNote(hit);
          else {
            const id = useApp.getState().createPage({ title: target });
            useApp.getState().setView({ kind: "note", id });
          }
          return true;
        },
        handleKeyDown: (_view, event) => {
          if (wikiRef.current) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setWikiI((x) => Math.min(wikiHitsRef.current.length - 1, x + 1));
              return true;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setWikiI((x) => Math.max(0, x - 1));
              return true;
            }
            if (event.key === "Enter") {
              const hit = wikiHitsRef.current[wikiIRef.current];
              const ed = editorRef.current;
              if (hit && ed) {
                event.preventDefault();
                insertWiki(ed, hit.title, wikiRef.current.embed);
                setWiki(null);
                return true;
              }
            }
            if (event.key === "Escape") {
              setWiki(null);
              return true;
            }
          }
          if (!slashRef.current) return false;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSlashI((x) => Math.min(hitsRef.current.length - 1, x + 1));
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSlashI((x) => Math.max(0, x - 1));
            return true;
          }
          if (event.key === "Enter") {
            const cmd = hitsRef.current[slashIRef.current];
            const ed = editorRef.current;
            if (cmd && ed) {
              event.preventDefault();
              eatSlash(ed);
              void runCommand(cmd);
              setSlash(null);
              return true;
            }
          }
          if (event.key === "Escape") {
            setSlash(null);
            return true;
          }
          return false;
        },
        handleDOMEvents: {
          mouseover: (view, event) => {
            const target = event.target as HTMLElement | null;
            if (!target || !wrapRef.current) return false;
            const block = target.closest(".ProseMirror > *") as HTMLElement | null;
            if (!block || !view.dom.contains(block)) {
              setGutter(null);
              return false;
            }
            const wrapRect = wrapRef.current.getBoundingClientRect();
            const blockRect = block.getBoundingClientRect();
            setGutter({ top: blockRect.top - wrapRect.top + wrapRef.current.scrollTop });
            return false;
          },
          mouseleave: () => {
            setGutter(null);
            return false;
          },
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (syncingRef.current) return;
        const md = htmlToMd(ed.getHTML());
        lastEmitted.current = md;
        onChangeRef.current(md);
        const w = detectWiki(ed);
        if (w) {
          setWiki(w);
          setSlash(null);
        } else {
          setWiki(null);
          detectSlash(ed, setSlash);
        }
      },
      immediatelyRender: false,
    },
    [noteId],
  );

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    registerWysiwyg({
      snippet: (md) => {
        if (editor.isDestroyed) return false;
        editor.chain().focus().insertContent(mdToHtml(md)).run();
        return true;
      },
      command: (id) => applyCommand(editor, id),
    });
    return () => registerWysiwyg(null);
  }, [editor]);

  const applyMarkdown = (ed: Editor, md: string) => {
    syncingRef.current = true;
    try {
      ed.commands.setContent(mdToHtml(md), { emitUpdate: false });
      hydrateWikiMarks(ed);
      lastEmitted.current = htmlToMd(ed.getHTML());
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    applyMarkdown(editor, markdown);
    // Normalize parent if HTML round-trip differs (e.g. trailing newline).
    if (lastEmitted.current !== markdown) {
      onChangeRef.current(lastEmitted.current);
    }
    setSlash(null);
    setWiki(null);
    setGutter(null);
  }, [editor, noteId]);

  // Apply external body changes (writing tools, remote sync). Skip when it matches what we emitted.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (markdown === lastEmitted.current) return;
    applyMarkdown(editor, markdown);
  }, [editor, markdown]);

  useEffect(() => setSlashI(0), [slash?.query]);
  useEffect(() => setWikiI(0), [wiki?.query]);

  if (!editor) return <p className="text-mute">Loading editor…</p>;

  return (
    <div ref={wrapRef} className="relative outline-none">
      {editable && gutter && (
        <button
          type="button"
          aria-label="Insert block"
          title="Insert"
          className="absolute left-0 z-10 -ml-8 flex h-6 w-6 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:bg-paper-2 hover:text-ink"
          style={{ top: gutter.top }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.chain().focus().run();
            setPlusOpen(true, "editor");
          }}
        >
          <Plus size={14} strokeWidth={1.4} />
        </button>
      )}
      {editable && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: ed, state }) =>
            ed.isEditable && !state.selection.empty && !slashRef.current && !wikiRef.current
          }
        >
          <div className="flex overflow-hidden rounded-xl border border-line bg-paper">
            <MarkBtn
              label="Bold"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={13} strokeWidth={1.4} />
            </MarkBtn>
            <MarkBtn
              label="Italic"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={13} strokeWidth={1.4} />
            </MarkBtn>
            <MarkBtn
              label="Strike"
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough size={13} strokeWidth={1.4} />
            </MarkBtn>
            <MarkBtn
              label="Heading"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 size={13} strokeWidth={1.4} />
            </MarkBtn>
            <MarkBtn
              label="Link"
              active={editor.isActive("link")}
              onClick={() => {
                const href = window.prompt("URL", editor.getAttributes("link").href ?? "https://");
                if (href === null) return;
                if (!href.trim()) editor.chain().focus().unsetLink().run();
                else editor.chain().focus().setLink({ href: href.trim() }).run();
              }}
            >
              <Link2 size={13} strokeWidth={1.4} />
            </MarkBtn>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      {slash && (
        <SlashStack
          query={slash.query}
          index={slashI}
          onIndex={setSlashI}
          onClose={() => setSlash(null)}
          onRun={(cmd) => {
            eatSlash(editor);
            void runCommand(cmd);
          }}
          className="absolute z-20 w-72"
          style={caretMenuStyle(editor, wrapRef.current)}
        />
      )}
      {wiki && (
        <Panel
          className="absolute z-20 max-h-72 w-72 overflow-y-auto font-serif"
          style={caretMenuStyle(editor, wrapRef.current)}
        >
        <ul>
          {wikiHits.map((n, idx) => (
            <li key={n.id}>
              <button
                type="button"
                onMouseEnter={() => setWikiI(idx)}
                onClick={() => {
                  insertWiki(editor, n.title, wiki.embed);
                  setWiki(null);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  idx === wikiI ? "bg-paper-2 text-ink" : "text-mute"
                }`}
              >
                <span className="truncate">
                  <NoteLabel note={n} />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                  {n.type === "database" ? "Database" : wiki.embed ? "Embed" : "Link"}
                </span>
              </button>
            </li>
          ))}
          {wiki.query.trim() && !wikiHits.some((n) => n.title.toLowerCase() === wiki.query.trim().toLowerCase()) && (
            <li>
              <button
                type="button"
                onClick={() => {
                  const title = wiki.query.trim();
                  useApp.getState().createPage({ title, stay: true });
                  insertWiki(editor, title, wiki.embed);
                  setWiki(null);
                }}
                className="flex w-full px-3 py-1.5 text-left text-sm text-mute hover:bg-paper-2 hover:text-ink"
              >
                Create “{wiki.query.trim()}”
              </button>
            </li>
          )}
          {!wikiHits.length && !wiki.query.trim() && (
            <li className="px-3 py-2 text-sm text-faint">Type a title</li>
          )}
        </ul>
        </Panel>
      )}
    </div>
  );
}

function MarkBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center font-serif text-sm ${
        active ? "bg-paper-2 text-ink" : "text-mute hover:bg-paper-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function wikiMatches(notes: Note[], q: string) {
  const query = q.trim().toLowerCase();
  const list = query
    ? notes.filter((n) => n.title.toLowerCase().includes(query) || n.path.toLowerCase().includes(query))
    : notes;
  return list.slice(0, 12);
}

function detectWiki(editor: Editor) {
  const { $from } = editor.state.selection;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const m = text.match(/(!?)\[\[([^\]]*)$/);
  if (!m) return null;
  return { query: m[2], embed: m[1] === "!" };
}

function insertWiki(editor: Editor, title: string, embed: boolean) {
  const { $from } = editor.state.selection;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const m = text.match(/(!?)\[\[([^\]]*)$/);
  if (!m) return;
  const from = editor.state.selection.from - m[0].length;
  const to = editor.state.selection.from;
  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContent({
      type: "text",
      text: title,
      marks: [{ type: "wikiLink", attrs: { target: title, embed } }],
    })
    .insertContent(" ")
    .run();
}

/** Turn leftover [[target]] text into wikiLink marks after HTML load. */
function hydrateWikiMarks(editor: Editor) {
  if (editor.isDestroyed) return;
  const markType = editor.schema.marks.wikiLink;
  if (!markType) return;
  const re = /(!?)\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;
  const reps: { from: number; to: number; target: string; label: string; embed: boolean }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (markType.isInSet(node.marks)) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text))) {
      const target = m[2].trim();
      if (!target) continue;
      reps.push({
        from: pos + m.index,
        to: pos + m.index + m[0].length,
        target,
        label: m[3]?.trim() || target,
        embed: m[1] === "!",
      });
    }
  });
  if (!reps.length) return;
  let { tr } = editor.state;
  for (const r of reps.sort((a, b) => b.from - a.from)) {
    const mark = markType.create({ target: r.target, embed: r.embed });
    tr = tr.replaceWith(r.from, r.to, editor.schema.text(r.label, [mark]));
  }
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

/** Viewport caret → coords relative to the editor wrap (for absolute menus). */
function caretMenuStyle(editor: Editor, wrap: HTMLElement | null): CSSProperties | undefined {
  if (!wrap) return undefined;
  try {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    const wrapRect = wrap.getBoundingClientRect();
    return {
      top: coords.bottom - wrapRect.top + wrap.scrollTop + 6,
      left: Math.max(0, coords.left - wrapRect.left),
    };
  } catch {
    return undefined;
  }
}

function detectSlash(editor: Editor, setSlash: (s: { query: string } | null) => void) {
  const { $from } = editor.state.selection;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const m = text.match(/(?:^|\s)(\/([^\s]*))$/);
  if (!m) setSlash(null);
  else setSlash({ query: m[2] });
}

function eatSlash(editor: Editor) {
  const { $from } = editor.state.selection;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const m = text.match(/(?:^|\s)(\/([^\s]*))$/);
  if (!m) return;
  const from = editor.state.selection.from - m[1].length;
  editor.chain().focus().deleteRange({ from, to: editor.state.selection.from }).run();
}
