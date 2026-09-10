import { WikiLinkPreview } from "@/components/editor/WikiPeek";
import { parseWikiDisplay, type WikiDisplay } from "@/lib/wiki-display";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";

function WikiLinkView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const target = String(node.attrs.target ?? "");
  const label = String(node.attrs.label || target);
  const display = parseWikiDisplay(node.attrs.display, Boolean(node.attrs.embed));
  return (
    <NodeViewWrapper
      as="span"
      data-wiki={target}
      data-display={display}
      data-embed={display === "card" ? "true" : undefined}
      className={`wiki-node wiki-node--${display}`}
    >
      <WikiLinkPreview
        target={target}
        label={label}
        display={display}
        onDisplay={editor.isEditable ? (next) => updateAttributes({ display: next, embed: next === "card" }) : undefined}
      />
    </NodeViewWrapper>
  );
}

export const WikiLink = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-wiki") ?? "",
        renderHTML: (attrs) => (attrs.target ? { "data-wiki": attrs.target } : {}),
      },
      label: {
        default: "",
        parseHTML: (el) => el.textContent?.trim() || el.getAttribute("data-wiki") || "",
        renderHTML: () => ({}),
      },
      display: {
        default: "mention" as WikiDisplay,
        parseHTML: (el) =>
          parseWikiDisplay(el.getAttribute("data-display"), el.getAttribute("data-embed") === "true"),
        renderHTML: (attrs) => {
          const display = parseWikiDisplay(attrs.display, Boolean(attrs.embed));
          return display === "mention" ? {} : { "data-display": display };
        },
      },
      embed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-embed") === "true",
        renderHTML: (attrs) =>
          parseWikiDisplay(attrs.display, Boolean(attrs.embed)) === "card" ? { "data-embed": "true" } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-wiki]", priority: 60 }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const display = parseWikiDisplay(HTMLAttributes["data-display"] || node.attrs.display, Boolean(node.attrs.embed));
    const label = String(node.attrs.label || node.attrs.target || "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class:
          display === "card" ? "wiki-link wiki-embed" : display === "title" ? "wiki-link wiki-title" : "wiki-link",
        "data-display": display === "mention" ? undefined : display,
      }),
      label,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },
});
