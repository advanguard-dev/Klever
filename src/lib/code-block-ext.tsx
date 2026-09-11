import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { CODE_LANGUAGES, normalizeLang } from "@/lib/shiki-highlight";
import { MermaidBlock } from "@/lib/mermaid-block";
import { Select } from "@/components/ui";
import { useEffect, useState } from "react";

function CodeBlockView({
  node,
  updateAttributes,
  editor,
  getPos,
}: {
  node: { textContent: string; attrs: { language?: string | null } };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  editor: { isEditable: boolean };
  getPos: () => number | undefined;
}) {
  const lang = normalizeLang(node.attrs.language);
  const isMermaid = lang === "mermaid";
  const [preview, setPreview] = useState(isMermaid);

  useEffect(() => {
    setPreview(isMermaid);
  }, [isMermaid]);

  return (
    <NodeViewWrapper className="klever-code-block relative my-3" data-language={lang}>
      {editor.isEditable && (
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-1"
          contentEditable={false}
        >
          {isMermaid && (
            <button
              type="button"
              className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] text-mute"
              aria-label={preview ? "Edit diagram source" : "Preview diagram"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Edit" : "Preview"}
            </button>
          )}
          <Select
            aria-label="Code language"
            className="min-w-[7rem] text-[10px]"
            value={lang}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      )}
      {isMermaid && preview ? (
        <div contentEditable={false}>
          <MermaidBlock source={node.textContent} />
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg border border-line bg-paper-2 p-3 pt-8 font-mono text-[13px] leading-relaxed">
          <code className={`language-${lang}`}>
            <NodeViewContent />
          </code>
        </pre>
      )}
      {/* keep pos stable for ProseMirror */}
      <span className="hidden">{typeof getPos === "function" ? "" : ""}</span>
    </NodeViewWrapper>
  );
}

/** TipTap code block with language attribute (disable StarterKit codeBlock). */
export const KleverCodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  isolating: true,

  addOptions() {
    return {
      languageClassPrefix: "language-",
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      language: {
        default: "text",
        parseHTML: (element: HTMLElement) => {
          const fromData = element.getAttribute("data-language");
          if (fromData) return normalizeLang(fromData);
          const cls = typeof element.className === "string" ? element.className : "";
          const match = /language-([\w+-]+)/.exec(cls);
          if (match) return normalizeLang(match[1]);
          const code = element.querySelector("code");
          const codeCls = code ? String(code.className) : "";
          const m2 = /language-([\w+-]+)/.exec(codeCls);
          return normalizeLang(m2?.[1]);
        },
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: "pre", preserveWhitespace: "full" as const }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const lang = normalizeLang(node.attrs.language);
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-language": lang,
        class: `language-${lang}`,
      }),
      ["code", { class: `language-${lang}` }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  addCommands() {
    return {
      setCodeBlock:
        (attributes?: { language?: string }) =>
        ({ commands }) =>
          commands.setNode(this.name, attributes),
      toggleCodeBlock:
        (attributes?: { language?: string }) =>
        ({ commands }) =>
          commands.toggleNode(this.name, "paragraph", attributes),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => this.editor.commands.toggleCodeBlock(),
    };
  },
});
