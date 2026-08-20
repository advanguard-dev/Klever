import { FileAttachment } from "@/components/editor/FileAttachment";
import { ImageBlock } from "@/components/editor/ImageBlock";
import { WikiPeek, openNote } from "@/components/editor/WikiPeek";
import { useContextMenu } from "@/components/ContextMenu";
import { NoteLabel } from "@/lib/chrome-icons";
import { tagMenuItems, wikiMenuItems } from "@/lib/context-menus";
import { parseAlt, replaceImageSrc, setImageWidth } from "@/lib/assets";
import { isAttachedFileHref, isLocalAssetHref, setFileDisplay } from "@/lib/file-display";
import { headingSlug, plainSnippet, resolveLink, wikifyForPreview } from "@/lib/parse";
import { isPageFont, wordFontSyntaxToHtml } from "@/lib/word-font";
import { pageFontClass } from "@/lib/page-fonts";
import type { Note } from "@/types";
import rehypeRaw from "rehype-raw";
import { useApp } from "@/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

export function MarkdownPreview({
  note,
  notes,
  small,
  depth = 0,
  reading = false,
}: {
  note: Note;
  notes: Note[];
  small?: boolean;
  depth?: number;
  /** Calm long-form reader styles; strips image edit chrome. */
  reading?: boolean;
}) {
  const setView = useApp((s) => s.setView);
  const patchNote = useApp((s) => s.patchNote);
  const { open } = useContextMenu();
  const source = wordFontSyntaxToHtml(wikifyForPreview(note.body || "*Empty page.*"));

  const heading = (Tag: "h1" | "h2" | "h3") =>
    function Heading({ children }: { children?: ReactNode }) {
      const text = nodeText(children);
      return <Tag id={headingSlug(text)}>{children}</Tag>;
    };

  const components: Components = {
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    blockquote({ children }) {
      const kind = calloutKind(children);
      return (
        <blockquote className={kind ? "callout" : undefined} data-callout={kind ?? undefined}>
          {children}
        </blockquote>
      );
    },
    span({ node, children, className, ...props }) {
      const attrs = node?.properties as Record<string, unknown> | undefined;
      const raw = attrs?.dataWordFont ?? attrs?.["data-word-font"];
      const font = typeof raw === "string" && isPageFont(raw) ? raw : null;
      if (font) {
        return (
          <span {...props} data-word-font={font} className={[pageFontClass(font), className].filter(Boolean).join(" ")}>
            {children}
          </span>
        );
      }
      return (
        <span className={className} {...props}>
          {children}
        </span>
      );
    },
    a({ href, title, children }) {
      if (href?.startsWith("embed:")) {
        const target = decodeURIComponent(href.slice(6));
        return <NoteEmbed target={target} notes={notes} depth={depth} reading={reading} />;
      }
      if (href?.startsWith("wiki:")) {
        const target = decodeURIComponent(href.slice(5));
        return <WikiPeek target={target} notes={notes}>{children}</WikiPeek>;
      }
      if (href?.startsWith("#")) {
        const tag = href.slice(1);
        return (
          <button
            type="button"
            className="hash-tag"
            onClick={() => setView({ kind: "tag", tag })}
            onContextMenu={(e) => open(e, tagMenuItems(tag, { noteId: note.id }))}
          >
            {children}
          </button>
        );
      }
      const path = href?.replace(/^\.\//, "") ?? "";
      if (href && isAttachedFileHref(path)) {
        return (
          <FileAttachment
            src={path}
            name={nodeText(children)}
            title={title}
            readOnly={reading}
            onDisplay={
              reading ? undefined : (display) => patchNote(note.id, { body: setFileDisplay(note.body, path, display) })
            }
            onWidth={reading ? undefined : (w) => patchNote(note.id, { body: setImageWidth(note.body, path, w) })}
            onReplaceSrc={
              reading ? undefined : (next) => patchNote(note.id, { body: replaceImageSrc(note.body, path, next) })
            }
          />
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
    img({ src, alt, title }) {
      if (!src) return null;
      const parsed = parseAlt(alt ?? "");
      if (isLocalAssetHref(src) || isAttachedFileHref(src.replace(/^\.\//, ""))) {
        const path = src.replace(/^\.\//, "");
        return (
          <FileAttachment
            src={path}
            name={alt}
            title={title}
            readOnly={reading}
            onDisplay={
              reading ? undefined : (display) => patchNote(note.id, { body: setFileDisplay(note.body, path, display) })
            }
            onWidth={reading ? undefined : (w) => patchNote(note.id, { body: setImageWidth(note.body, path, w) })}
            onReplaceSrc={
              reading ? undefined : (next) => patchNote(note.id, { body: replaceImageSrc(note.body, path, next) })
            }
          />
        );
      }
      return (
        <ImageBlock
          src={src}
          caption={parsed.caption}
          width={parsed.width}
          readOnly={reading}
          onWidth={
            reading
              ? undefined
              : (w) => patchNote(note.id, { body: setImageWidth(note.body, src, w) })
          }
          onReplaceSrc={
            reading
              ? undefined
              : (next) => patchNote(note.id, { body: replaceImageSrc(note.body, src, next) })
          }
        />
      );
    },
  };

  return (
    <div
      className={[
        "prose-klever",
        reading && "prose-klever-read",
        small && !reading && "text-[15px] leading-7",
        reading && small && "prose-klever-read--small",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

function NoteEmbed({
  target,
  notes,
  depth,
  reading,
}: {
  target: string;
  notes: Note[];
  depth: number;
  reading?: boolean;
}) {
  const hit = resolveLink(target, notes);
  const { open } = useContextMenu();
  if (!hit) return <WikiPeek target={target} notes={notes}>{target}</WikiPeek>;
  const lines = hit.body.split("\n");
  const clipped = lines.length > 36 ? `${lines.slice(0, 36).join("\n")}\n\n…` : hit.body;
  return (
    <figure className="embed-note my-4 rounded-xl border border-line bg-paper-2 px-4 py-3">
      <button
        type="button"
        className="mb-2 font-serif text-sm text-mute hover:bg-paper-2 hover:text-ink"
        onClick={() => openNote(hit)}
        onContextMenu={(e) => open(e, wikiMenuItems(target, hit))}
      >
        <NoteLabel note={hit} size={14} />
      </button>
      {depth < 1 ? (
        <MarkdownPreview
          note={{ ...hit, body: clipped }}
          notes={notes}
          small
          depth={depth + 1}
          reading={reading}
        />
      ) : (
        <p className="text-sm text-mute">{plainSnippet(hit.body, 140)}</p>
      )}
    </figure>
  );
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return nodeText(props?.children);
  }
  return "";
}

function calloutKind(children: ReactNode): string | null {
  const text = nodeText(children).trim();
  const m = text.match(/^\[!(\w+)\]/i) || text.match(/^(note|tip|warning|info|caution)\b/i);
  return m ? m[1].toLowerCase() : null;
}
