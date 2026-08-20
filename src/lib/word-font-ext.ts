import { pageFontClass } from "@/lib/page-fonts";
import type { PageFont } from "@/types";
import { Mark, mergeAttributes } from "@tiptap/core";
import { WORD_FONT_ATTR } from "@/lib/word-font";

export const WordFont = Mark.create({
  name: "wordFont",
  inclusive: true,
  addAttributes() {
    return {
      font: {
        default: "sans" as PageFont,
        parseHTML: (el) => (el as HTMLElement).getAttribute(WORD_FONT_ATTR) ?? "sans",
        renderHTML: (attrs) => ({ [WORD_FONT_ATTR]: attrs.font }),
      },
    };
  },
  parseHTML() {
    return [{ tag: `span[${WORD_FONT_ATTR}]`, priority: 65 }];
  },
  renderHTML({ HTMLAttributes }) {
    const font = (HTMLAttributes[WORD_FONT_ATTR] ?? HTMLAttributes.font ?? "sans") as PageFont;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        [WORD_FONT_ATTR]: font,
        class: pageFontClass(font),
      }),
      0,
    ];
  },
});
