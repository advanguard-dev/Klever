import { SlashStack } from "@/components/insert/PlusMenu";
import { openNote } from "@/components/editor/WikiPeek";
import { contextMenuFromKey, useContextMenu } from "@/components/ContextMenu";
import type { ContextMenuItem } from "@/lib/context-menus";
import { Panel } from "@/components/ui";
import { NoteLabel } from "@/lib/chrome-icons";
import { copyFromTipTap, cutFromTipTap, insertClipboardIntoTipTap, pasteIntoTipTap } from "@/lib/clipboard-editing";
import { htmlLooksExplosive, sanitizePastedHtml } from "@/lib/paste-guard";
import { registerBeforeFlush } from "@/lib/save-hooks";
import { registerLinkEmbed, registerWysiwyg } from "@/lib/editor-bridge";
import { coerceHttpUrl, urlEmbedHtml, urlHostname } from "@/lib/url-embed";
import { UrlEmbed } from "@/lib/url-embed-ext";
import { LinkEmbedDialog } from "@/components/editor/LinkEmbedDialog";
import { resolveAssetSrc } from "@/lib/assets";
import { hasFileTransfer } from "@/lib/dnd";
import { handleDroppedFiles } from "@/lib/drop-files";
import { filesFromFileList } from "@/lib/local-file-path";
import { htmlToMd, mdToHtml } from "@/lib/markdown-io";
import { resolveLink } from "@/lib/parse";
import { runCommand } from "@/lib/run-command";
import { useApp } from "@/store";
import { VaultFile } from "@/lib/vault-file-ext";
import { GrammarMarks } from "@/lib/grammar-ext";
import { WordFont } from "@/lib/word-font-ext";
import { WikiLink } from "@/lib/wiki-ext";
import { KleverCodeBlock } from "@/lib/code-block-ext";
import { PAGE_FONTS } from "@/lib/page-fonts";
import type { PageFont } from "@/types";
import type { InsertCommand, Note } from "@/types";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { BubbleMenu } from "@tiptap/react/menus";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, GripVertical, Heading2, Italic, Link2, Plus, Strikethrough } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";

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
  const { open } = useContextMenu();
  const [linkUi, setLinkUi] = useState<{ mode: "link" | "embed"; href: string; text: string } | null>(null);
  const closeLinkUi = useCallback(() => setLinkUi(null), []);
  const [slash, setSlash] = useState<{ query: string } | null>(null);
  const [wiki, setWiki] = useState<{ query: string; embed: boolean } | null>(null);
  const [slashI, setSlashI] = useState(0);
  const [wikiI, setWikiI] = useState(0);
  const slashRef = useRef(slash);
  const slashIRef = useRef(slashI);
  const wikiRef = useRef(wiki);
  const wikiIRef = useRef(wikiI);
  const editorRef = useRef<Editor | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gutterDomRef = useRef<HTMLElement | null>(null);
  const [gutter, setGutter] = useState<{ top: number; dom: HTMLElement } | null>(null);
  const gutterStateRef = useRef(gutter);
  gutterStateRef.current = gutter;
  const [dropLine, setDropLine] = useState<number | null>(null);
  const dragRef = useRef<{ from: number; size: number } | null>(null);
  const lastEmitted = useRef(markdown);
  const syncingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const mdTimerRef = useRef<number>(0);
  onChangeRef.current = onChange;
  slashRef.current = slash;
  slashIRef.current = slashI;
  wikiRef.current = wiki;
  wikiIRef.current = wikiI;

  const wikiHits = useMemo(() => (wiki ? wikiMatches(notes, wiki.query) : []), [notes, wiki]);
  const hitsRef = useRef<InsertCommand[]>([]);
  const wikiHitsRef = useRef(wikiHits);
  wikiHitsRef.current = wikiHits;

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: false,
          codeBlock: false,
          dropcursor: { color: "var(--color-ink)", width: 2 },
        }),
        KleverCodeBlock,
        WikiLink,
        WordFont,
        UrlEmbed,
        Link.configure({
          openOnClick: false,
          autolink: false,
          HTMLAttributes: { rel: "noreferrer noopener" },
          isAllowedUri: (url, ctx) => {
            if (!url) return false;
            if (ctx.defaultValidate(url)) return true;
            if (url.startsWith("./") || url.startsWith("/")) return true;
            return !/^[a-z][a-z0-9+.-]*:/i.test(url);
          },
        }),
        Placeholder.configure({ placeholder: "Type / for blocks, @ to link" }),
        AssetImage.configure({ inline: false }),
        VaultFile,
        GrammarMarks.configure({ noteId }),
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
        transformPastedHTML: (html) => sanitizePastedHtml(html) || html,
        handlePaste: (_view, event) => {
          const html = event.clipboardData?.getData("text/html") ?? "";
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (!html && !text) return false;
          if (!htmlLooksExplosive(html, text) && html.length + text.length < 24_000) return false;
          event.preventDefault();
          const ed = editorRef.current;
          if (ed && !ed.isDestroyed) void insertClipboardIntoTipTap(ed, html, text);
          return true;
        },
        handleClick: (_view, _pos, event) => {
          const wikiEl = (event.target as HTMLElement | null)?.closest("[data-wiki]") as HTMLElement | null;
          if (wikiEl) {
            const target = wikiEl.getAttribute("data-wiki");
            if (!target) return false;
            const hit = resolveLink(target, useApp.getState().notes);
            if (hit) openNote(hit);
            else {
              const id = useApp.getState().createPage({ title: target });
              useApp.getState().setView({ kind: "note", id });
            }
            return true;
          }
          const a = (event.target as HTMLElement | null)?.closest("a");
          if (a) {
            const href = a.getAttribute("href") ?? "";
            if (!href) return false;
            const blobs = useApp.getState().blobs;
            const path = href.replace(/^\.\//, "");
            if (blobs[path] || blobs[href]) {
              void import("@/lib/open-local-file").then(({ openLocalFile }) =>
                openLocalFile(path, blobs[path] ?? blobs[href]),
              );
              return true;
            }
            if (/^https?:/i.test(href)) {
              window.open(href, "_blank", "noreferrer");
              return true;
            }
          }
          return false;
        },
        handleDrop: (editorView, event, _slice, moved) => {
          if (moved) return false;
          if (!hasFileTransfer(event as unknown as React.DragEvent)) return false;
          const list = event.dataTransfer?.files;
          if (!list?.length) return false;
          event.preventDefault();
          event.stopPropagation();
          const files = filesFromFileList(list);
          const at = { clientX: event.clientX, clientY: event.clientY };
          const coords = editorView.posAtCoords({ left: event.clientX, top: event.clientY });
          if (coords) {
            const $pos = editorView.state.doc.resolve(coords.pos);
            editorView.dispatch(editorView.state.tr.setSelection(TextSelection.near($pos)));
          }
          const appView = useApp.getState().view;
          const noteId = appView.kind === "note" ? appView.id : undefined;
          void handleDroppedFiles(files, { attachToNoteId: noteId, at });
          return true;
        },
        handleKeyDown: (_view, event) => {
          if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            const ed = editorRef.current;
            if (ed && moveBlock(ed, event.key === "ArrowDown" ? 1 : -1)) {
              event.preventDefault();
              return true;
            }
          }
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
      },
      onUpdate: ({ editor: ed }) => {
        if (syncingRef.current) return;
        const large = ed.state.doc.nodeSize > 5_000;
        if (large) {
          setWiki(null);
          setSlash(null);
        } else {
          const w = detectWiki(ed);
          if (w) {
            setWiki(w);
            setSlash(null);
          } else {
            setWiki(null);
            detectSlash(ed, setSlash);
          }
        }
        window.clearTimeout(mdTimerRef.current);
        mdTimerRef.current = window.setTimeout(() => {
          if (ed.isDestroyed || syncingRef.current) return;
          const md = htmlToMd(ed.getHTML());
          lastEmitted.current = md;
          onChangeRef.current(md);
        }, large ? 480 : 140);
      },
      immediatelyRender: false,
    },
    [noteId],
  );

  editorRef.current = editor;

  useEffect(() => {
    const commit = () => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed || syncingRef.current) return;
      window.clearTimeout(mdTimerRef.current);
      const md = htmlToMd(ed.getHTML());
      lastEmitted.current = md;
      onChangeRef.current(md);
    };
    return registerBeforeFlush(commit);
  }, [editor]);

  useEffect(() => {
    return () => window.clearTimeout(mdTimerRef.current);
  }, []);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    registerLinkEmbed((opts) => {
      const ed = editorRef.current;
      const selected =
        ed && !ed.state.selection.empty
          ? ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to)
          : "";
      const asUrl = selected ? coerceHttpUrl(selected) : null;
      setLinkUi({
        mode: opts.mode,
        href: opts.href ?? asUrl ?? "",
        text: opts.text ?? (asUrl ? "" : selected),
      });
    });
    return () => registerLinkEmbed(null);
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    registerWysiwyg({
      snippet: (md, at) => {
        if (editor.isDestroyed) return false;
        if (at) {
          const coords = editor.view.posAtCoords({ left: at.clientX, top: at.clientY });
          if (coords) {
            const $pos = editor.state.doc.resolve(coords.pos);
            editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near($pos)));
          }
        }
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

  // htmlToMd always ends with a single newline — avoid resetting the editor on that alone.
  const mdMatches = (a: string, b: string) => {
    if (a === b) return true;
    const norm = (s: string) => (s.trim() ? `${s.trim()}\n` : "");
    return norm(a) === norm(b);
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
  }, [editor, noteId]);

  // Apply external body changes (writing tools, remote sync). Skip when it matches what we emitted.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (mdMatches(markdown, lastEmitted.current)) return;
    applyMarkdown(editor, markdown);
  }, [editor, markdown]);

  useEffect(() => setSlashI(0), [slash?.query]);
  useEffect(() => setWikiI(0), [wiki?.query]);

  const placeGutter = (block: HTMLElement | null) => {
    const wrap = wrapRef.current;
    if (gutterDomRef.current && gutterDomRef.current !== block) {
      gutterDomRef.current.classList.remove("klever-block-hover");
    }
    gutterDomRef.current = block;
    if (!wrap || !block) {
      setGutter(null);
      return;
    }
    block.classList.add("klever-block-hover");
    const wr = wrap.getBoundingClientRect();
    const br = block.getBoundingClientRect();
    setGutter({ top: br.top - wr.top + wrap.scrollTop, dom: block });
  };

  const onWrapMouseMove = (e: ReactMouseEvent) => {
    if (dragRef.current) return;
    const t = e.target as HTMLElement;
    if (t.closest("[data-block-gutter]")) return;
    const ed = editorRef.current;
    if (!ed) return;
    const block = closestBlock(t, ed.view.dom);
    placeGutter(block);
  };

  const endDrag = () => {
    const wrap = wrapRef.current;
    wrap?.classList.remove("klever-editor-dragging");
    gutterDomRef.current?.classList.remove("klever-block-dragging");
    dragRef.current = null;
    setDropLine(null);
  };

  useEffect(() => {
    if (!editable || !editor) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      const handle = t?.closest("[data-block-gutter]") as HTMLElement | null;
      if (!handle) return;
      if (t?.closest("[data-block-insert]")) return;
      const ed = editorRef.current;
      const wrap = wrapRef.current;
      if (!ed || !wrap) return;
      const block = gutterStateRef.current?.dom ?? gutterDomRef.current;
      const range =
        (block ? blockRangeFromDom(ed.view, block) : null) ??
        dropAnchor(ed.view, wrap, handle.getBoundingClientRect().top + 8);
      if (!range) return;
      const from = range.from;
      const $from = ed.state.doc.resolve(from);
      const node = $from.nodeAfter;
      if (!node) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { from, size: node.nodeSize };
      block?.classList.add("klever-block-dragging");
      wrap.classList.add("klever-editor-dragging");
      const pointerId = e.pointerId;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId || !dragRef.current) return;
        const drop = dropAnchor(ed.view, wrap, ev.clientY);
        setDropLine(drop?.line ?? null);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
        const drag = dragRef.current;
        const drop = dropAnchor(ed.view, wrap, ev.clientY);
        endDrag();
        if (!drag || !drop) return;
        relocateBlock(ed, drag.from, drag.size, drop.dest);
      };
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    };

    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [editable, editor]);

  if (!editor) return <p className="text-mute">Loading editor…</p>;

  return (
    <div
      ref={wrapRef}
      className="relative outline-none md:-ml-8 md:pl-8"
      onContextMenu={(e) => {
        if (!editable) return;
        const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (coords) editor.chain().focus().setTextSelection(coords.pos).run();
        open(e, blockMenuItems(editor, () => setPlusOpen(true, "editor")));
      }}
      onMouseMove={onWrapMouseMove}
      onMouseLeave={(e) => {
        if (dragRef.current) return;
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        gutterDomRef.current?.classList.remove("klever-block-hover");
        gutterDomRef.current = null;
        setGutter(null);
      }}
    >
      {editable && gutter && (
        <div
          data-block-gutter
          className="absolute left-0 z-10 hidden h-6 w-8 touch-none items-center md:flex [&_svg]:pointer-events-none"
          style={{ top: gutter.top + 2, cursor: "grab" }}
        >
          <button
            type="button"
            data-block-insert
            aria-label="Insert block"
            title="Insert"
            className="klever-focus flex h-6 w-4 items-center justify-center rounded-md text-mute hover:bg-paper-2 hover:text-ink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().run();
              setPlusOpen(true, "editor");
            }}
          >
            <Plus size={13} strokeWidth={1.4} />
          </button>
          <span
            role="button"
            tabIndex={0}
            aria-label="Move block. Drag, or Option Up and Option Down"
            title="Move · ⌥↑ ⌥↓"
            className="klever-focus flex h-6 w-4 items-center justify-center rounded-md text-mute hover:bg-paper-2 hover:text-ink"
            onKeyDown={(e) =>
              contextMenuFromKey(e, (ev) =>
                open(ev, blockMenuItems(editor, () => setPlusOpen(true, "editor"))),
              )
            }
          >
            <GripVertical size={14} strokeWidth={1.4} />
          </span>
        </div>
      )}
      {editable && dropLine != null && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-20 h-0.5 rounded-full bg-ink md:left-8"
          style={{ top: dropLine }}
        />
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
                const selected = editor.state.selection.empty
                  ? ""
                  : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);
                const existing = String(editor.getAttributes("link").href ?? "");
                const asUrl = selected ? coerceHttpUrl(selected) : null;
                setLinkUi({
                  mode: "link",
                  href: existing || asUrl || "",
                  text: asUrl ? "" : selected,
                });
              }}
            >
              <Link2 size={13} strokeWidth={1.4} />
            </MarkBtn>
            <span className="mx-0.5 w-px self-stretch bg-line" aria-hidden />
            {PAGE_FONTS.map((f) => (
              <FontBtn
                key={f.id}
                label={f.label}
                className={f.className}
                active={editor.isActive("wordFont", { font: f.id })}
                onClick={() => {
                  if (editor.isActive("wordFont", { font: f.id })) {
                    editor.chain().focus().unsetMark("wordFont").run();
                  } else {
                    editor.chain().focus().setMark("wordFont", { font: f.id as PageFont }).run();
                  }
                }}
              />
            ))}
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      {slash && (
        <SlashStack
          query={slash.query}
          index={slashI}
          onIndex={setSlashI}
          onFiltered={(cmds) => {
            hitsRef.current = cmds;
          }}
          onClose={() => setSlash(null)}
          onRun={(cmd) => {
            eatSlash(editor);
            void runCommand(cmd);
          }}
          className="absolute z-20 w-72"
          style={caretMenuStyle(editor, wrapRef.current)}
        />
      )}
      {linkUi && (
        <LinkEmbedDialog
          initialHref={linkUi.href}
          initialText={linkUi.text}
          initialMode={linkUi.mode}
          onClose={closeLinkUi}
          onApply={({ href, text, mode }) => {
            const ed = editorRef.current;
            if (!ed || ed.isDestroyed) return;
            if (mode === "embed") {
              ed.chain().focus().insertContent(urlEmbedHtml(href, text)).run();
              return;
            }
            if (!ed.state.selection.empty) {
              ed.chain().focus().setLink({ href }).run();
              return;
            }
            const label = text || urlHostname(href);
            ed.chain()
              .focus()
              .insertContent({
                type: "text",
                text: label,
                marks: [{ type: "link", attrs: { href } }],
              })
              .run();
          }}
        />
      )}
      {wiki && (
        <Panel
          className="absolute z-20 max-h-72 w-72 overflow-y-auto"
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
                className={`flex w-full items-center justify-between border-l-2 px-3 py-1.5 text-left text-sm ${
                  idx === wikiI ? "border-ring bg-paper-2 text-ink" : "border-transparent text-mute"
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

function currentBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const parent = $from.node(depth - 1);
    if (parent.type.spec.tableRole) continue;
    const node = $from.node(depth);
    if (node.isBlock) return { pos: $from.before(depth), node };
  }
  return null;
}

function duplicateBlock(editor: Editor) {
  const b = currentBlock(editor);
  if (!b) return;
  editor.commands.insertContentAt(b.pos + b.node.nodeSize, b.node.toJSON());
}

function deleteBlock(editor: Editor) {
  const b = currentBlock(editor);
  if (!b) return;
  editor.chain().focus().deleteRange({ from: b.pos, to: b.pos + b.node.nodeSize }).run();
}

function blockMenuItems(editor: Editor, insert: () => void): ContextMenuItem[] {
  const hasSel = !editor.state.selection.empty;
  return [
    {
      id: "cut",
      label: "Cut",
      hint: "⌘X",
      disabled: !hasSel,
      onSelect: () => void cutFromTipTap(editor),
    },
    {
      id: "copy",
      label: "Copy",
      hint: "⌘C",
      disabled: !hasSel,
      onSelect: () => void copyFromTipTap(editor),
    },
    {
      id: "paste",
      label: "Paste",
      hint: "⌘V",
      onSelect: () => void pasteIntoTipTap(editor),
    },
    { type: "sep" },
    { id: "dup", label: "Duplicate block", onSelect: () => duplicateBlock(editor) },
    { id: "up", label: "Move up", hint: "⌥↑", onSelect: () => moveBlock(editor, -1) },
    { id: "down", label: "Move down", hint: "⌥↓", onSelect: () => moveBlock(editor, 1) },
    { type: "sep" },
    { id: "p", label: "Turn into paragraph", onSelect: () => editor.chain().focus().setParagraph().run() },
    { id: "h1", label: "Turn into heading 1", onSelect: () => applyCommand(editor, "h1") },
    { id: "h2", label: "Turn into heading 2", onSelect: () => applyCommand(editor, "h2") },
    { id: "bullet", label: "Turn into list", onSelect: () => applyCommand(editor, "bullet") },
    { id: "quote", label: "Turn into quote", onSelect: () => applyCommand(editor, "quote") },
    { type: "sep" },
    { id: "insert", label: "Insert…", onSelect: insert },
    {
      id: "delete",
      label: "Delete block",
      danger: true,
      onSelect: () => deleteBlock(editor),
    },
  ];
}

/** Swap the current block with its neighbor (Craft-style ⌥↑ / ⌥↓). */
function moveBlock(editor: Editor, dir: -1 | 1) {
  const { state } = editor;
  const $from = state.selection.$from;
  for (let depth = $from.depth; depth > 0; depth--) {
    const parent = $from.node(depth - 1);
    if (parent.type.spec.tableRole) continue;
    const idx = $from.index(depth - 1);
    const swap = idx + dir;
    if (swap < 0 || swap >= parent.childCount) continue;
    const current = parent.child(idx);
    const other = parent.child(swap);
    const currentPos = $from.before(depth);
    const fromPos = dir > 0 ? currentPos : currentPos - other.nodeSize;
    const toPos = dir > 0 ? currentPos + current.nodeSize + other.nodeSize : currentPos + current.nodeSize;
    const first = dir > 0 ? other : current;
    const second = dir > 0 ? current : other;
    const tr = state.tr.replaceWith(fromPos, toPos, Fragment.from([first, second]));
    editor.view.dispatch(tr.scrollIntoView());
    return true;
  }
  return false;
}

function closestBlock(target: HTMLElement | null, viewDom: HTMLElement): HTMLElement | null {
  if (!target || !viewDom.contains(target)) return null;
  const li = target.closest("li");
  if (li instanceof HTMLElement && viewDom.contains(li)) return li;
  const top = target.closest(".ProseMirror > *");
  if (top instanceof HTMLElement && viewDom.contains(top)) return top;
  return null;
}

function blockRangeFromDom(view: EditorView, dom: HTMLElement) {
  const fromPos = (pos: number) => {
    const $pos = view.state.doc.resolve(pos);
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      const parent = $pos.node(d - 1);
      if (
        parent.type.name === "doc" ||
        node.type.name === "listItem" ||
        node.type.name === "taskItem"
      ) {
        const from = $pos.before(d);
        return { from, size: node.nodeSize, node };
      }
    }
    return null;
  };
  try {
    const found = fromPos(view.posAtDOM(dom, 0));
    if (found) return found;
  } catch {
    /* fall through */
  }
  const r = dom.getBoundingClientRect();
  const hit = view.posAtCoords({ left: r.left + Math.min(24, r.width / 2), top: r.top + 8 });
  return hit ? fromPos(hit.pos) : null;
}

/** Drop target from Y. Prefer the DOM block (so list items win over the whole list). */
function dropAnchor(
  view: EditorView,
  wrap: HTMLElement,
  clientY: number,
): { dest: number; line: number; from: number; size: number } | null {
  const wr = wrap.getBoundingClientRect();
  const lineOf = (top: number, bottom: number, from: number, size: number) => {
    const before = clientY < (top + bottom) / 2;
    return {
      dest: before ? from : from + size,
      line: (before ? top : bottom) - wr.top + wrap.scrollTop,
      from,
      size,
    };
  };
  const box = view.dom.getBoundingClientRect();
  const x = Math.min(box.left + 48, box.right - 8);
  const y = Math.max(box.top + 2, Math.min(clientY, box.bottom - 2));
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const block = closestBlock(el, view.dom);
  if (block) {
    const range = blockRangeFromDom(view, block);
    if (range) {
      const r = block.getBoundingClientRect();
      return lineOf(r.top, r.bottom, range.from, range.size);
    }
  }
  const hit = view.posAtCoords({ left: x, top: y });
  if (!hit) return null;
  const $pos = view.state.doc.resolve(hit.pos);
  let found: { from: number; size: number } | null = null;
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "listItem" || node.type.name === "taskItem") {
      found = { from: $pos.before(d), size: node.nodeSize };
      break;
    }
  }
  if (!found) {
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d - 1).type.name === "doc") {
        const node = $pos.node(d);
        found = { from: $pos.before(d), size: node.nodeSize };
        break;
      }
    }
  }
  if (!found) return null;
  let top = y;
  let bottom = y;
  try {
    top = view.coordsAtPos(Math.min(found.from + 1, view.state.doc.content.size)).top;
    bottom = view.coordsAtPos(Math.max(found.from + 1, found.from + found.size - 1)).bottom;
  } catch {
    /* keep y */
  }
  return lineOf(top, bottom, found.from, found.size);
}

function relocateBlock(editor: Editor, from: number, _size: number, dest: number) {
  const $from = editor.state.doc.resolve(from);
  const node = $from.nodeAfter;
  if (!node) return;
  const sz = node.nodeSize;
  if (dest >= from && dest <= from + sz) return;
  const insertAt = dest < from ? dest : dest - sz;
  const tr = editor.state.tr.delete(from, from + sz);
  if (insertAt < 0 || insertAt > tr.doc.content.size) return;
  const $ins = tr.doc.resolve(insertAt);
  if (!$ins.parent.canReplaceWith($ins.index(), $ins.index(), node.type)) return;
  tr.insert(insertAt, node);
  editor.view.dispatch(tr.scrollIntoView());
}

function FontBtn({
  label,
  className,
  active,
  onClick,
}: {
  label: string;
  className: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Font ${label}`}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
      className={`klever-focus inline-flex h-8 min-w-8 items-center justify-center px-1.5 text-[11px] ${className} ${
        active ? "bg-paper-2 text-ink ring-1 ring-ink/15" : "text-mute hover:bg-paper-2 hover:text-ink"
      }`}
    >
      {label}
    </button>
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
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`klever-focus inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium ${
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

function wikiTrigger(text: string) {
  const wiki = text.match(/(!?)\[\[([^\]]*)$/);
  if (wiki) return { query: wiki[2], embed: wiki[1] === "!", length: wiki[0].length };
  const at = text.match(/@([^\s[]*)$/);
  if (!at) return null;
  const start = text.length - at[0].length;
  if (start > 0 && !/\s/.test(text[start - 1]!)) return null;
  return { query: at[1], embed: false, length: at[0].length };
}

function detectWiki(editor: Editor) {
  const { $from } = editor.state.selection;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const m = wikiTrigger(text);
  if (!m) return null;
  return { query: m.query, embed: m.embed };
}

function insertWiki(editor: Editor, title: string, embed: boolean) {
  const { $from } = editor.state.selection;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const m = wikiTrigger(text);
  if (!m) return;
  const from = editor.state.selection.from - m.length;
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
