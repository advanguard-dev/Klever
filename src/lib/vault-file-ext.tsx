import { FileAttachment } from "@/components/editor/FileAttachment";
import { assetKindFromPath, type AssetKind } from "@/lib/assets";
import { defaultFileDisplay, parseFileDisplay, type FileDisplay } from "@/lib/file-display";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";

function attr(el: HTMLElement, key: string) {
  return el.getAttribute(key) ?? "";
}

function VaultFileView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper>
      <FileAttachment
        src={String(node.attrs.src ?? "")}
        name={String(node.attrs.name ?? "")}
        display={node.attrs.display as FileDisplay}
        readOnly={!editor.isEditable}
        onDisplay={(display) => updateAttributes({ display })}
      />
    </NodeViewWrapper>
  );
}

/** Local attachments with link / preview / card display. */
export const VaultFile = Node.create({
  name: "vaultFile",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      name: { default: "" },
      kind: { default: "file" },
      display: { default: "preview" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-vault-file]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const src = attr(node, "data-src");
          const name = attr(node, "data-name") || src.split("/").pop() || "file";
          const kind = (attr(node, "data-kind") || assetKindFromPath(src, name)) as AssetKind;
          const display = parseFileDisplay(attr(node, "data-display")) ?? defaultFileDisplay(kind);
          return { src, name, kind, display };
        },
      },
      {
        tag: "audio",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          name: "audio",
          kind: "audio",
          display: "preview",
        }),
      },
      {
        tag: "video",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          name: "video",
          kind: "video",
          display: "preview",
        }),
      },
      {
        tag: "iframe[data-vault-pdf]",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          name: (el as HTMLElement).getAttribute("title") || "PDF",
          kind: "pdf",
          display: "preview",
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, name, kind, display } = HTMLAttributes as {
      src?: string;
      name?: string;
      kind?: string;
      display?: string;
    };
    return [
      "div",
      mergeAttributes({
        "data-vault-file": "",
        "data-src": src ?? "",
        "data-name": name ?? "",
        "data-kind": kind ?? "file",
        "data-display": display ?? "preview",
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VaultFileView);
  },
});
