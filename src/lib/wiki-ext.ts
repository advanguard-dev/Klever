import { Mark, mergeAttributes } from "@tiptap/core";

export const WikiLink = Mark.create({
  name: "wikiLink",
  inclusive: false,
  exitable: true,
  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-wiki"),
        renderHTML: (attrs) => (attrs.target ? { "data-wiki": attrs.target } : {}),
      },
      embed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-embed") === "true",
        renderHTML: (attrs) => (attrs.embed ? { "data-embed": "true" } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-wiki]", priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    const embed = Boolean(HTMLAttributes["data-embed"] || HTMLAttributes.embed);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: embed ? "wiki-link wiki-embed" : "wiki-link",
      }),
      0,
    ];
  },
});
