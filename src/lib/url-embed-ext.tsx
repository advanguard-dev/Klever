import { mediaEmbedSrc, urlHostname } from "@/lib/url-embed";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ExternalLink } from "lucide-react";

function UrlEmbedView({ node }: ReactNodeViewProps) {
  const href = String(node.attrs.src ?? "");
  const name = String(node.attrs.name ?? "") || urlHostname(href);
  const media = mediaEmbedSrc(href);

  return (
    <NodeViewWrapper data-drag-handle="" className="url-embed-node my-4">
      <figure className="overflow-hidden rounded-xl border border-line bg-paper-2">
        {media ? (
          <div className="relative aspect-video bg-blotter">
            <iframe
              title={name}
              src={media}
              {...{ credentialless: true }}
              referrerPolicy="no-referrer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : null}
        <figcaption className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{name}</p>
            <p className="truncate font-mono text-[11px] text-faint">{urlHostname(href)}</p>
          </div>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="klever-focus inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-smart hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} strokeWidth={1.5} />
            Open
          </a>
        </figcaption>
      </figure>
    </NodeViewWrapper>
  );
}

export const UrlEmbed = Node.create({
  name: "urlEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      name: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-url-embed]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const src = node.getAttribute("data-src") ?? "";
          const name = node.getAttribute("data-name") || urlHostname(src);
          return { src, name };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, name } = HTMLAttributes as { src?: string; name?: string };
    return [
      "div",
      mergeAttributes({
        "data-url-embed": "",
        "data-src": src ?? "",
        "data-name": name ?? "",
      }),
      "\u200b",
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(UrlEmbedView);
  },
});
