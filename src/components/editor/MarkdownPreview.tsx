import { ImageBlock } from "@/components/editor/ImageBlock";
import { WikiPeek, openNote } from "@/components/editor/WikiPeek";
import { NoteLabel } from "@/lib/chrome-icons";
import { parseAlt, resolveAssetSrc, setImageWidth, isAudioPath } from "@/lib/assets";
import { headingSlug, plainSnippet, resolveLink, wikifyForPreview } from "@/lib/parse";
import type { Note } from "@/types";
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
  const blobs = useApp((s) => s.blobs);
  const source = wikifyForPreview(note.body || "*Empty page.*");

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
    a({ href, children }) {
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
          <button type="button" className="hash-tag" onClick={() => setView({ kind: "tag", tag })}>
            {children}
          </button>
        );
      }
      const path = href?.replace(/^\.\//, "") ?? "";
      if (href && blobs[path]) {
        if (isAudioPath(path)) {
          return <audio controls src={resolveAssetSrc(path, blobs)} className="my-4 w-full" />;
        }
        const url = resolveAssetSrc(path, blobs);
        return (
          <a href={url} download={path.split("/").pop()}>
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
    img({ src, alt }) {
      if (!src) return null;
      const parsed = parseAlt(alt ?? "");
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
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
  if (!hit) return <WikiPeek target={target} notes={notes}>{target}</WikiPeek>;
  const lines = hit.body.split("\n");
  const clipped = lines.length > 36 ? `${lines.slice(0, 36).join("\n")}\n\n…` : hit.body;
  return (
    <figure className="embed-note my-4 rounded-xl border border-line bg-paper-2 px-4 py-3">
      <button
        type="button"
        className="mb-2 font-serif text-sm text-mute hover:bg-paper-2 hover:text-ink"
        onClick={() => openNote(hit)}
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
