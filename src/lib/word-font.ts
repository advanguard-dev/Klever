import { marked } from "marked";
import type { PageFont } from "@/types";
import { pageFontClass } from "@/lib/page-fonts";

export const WORD_FONT_ATTR = "data-word-font";

/** Inline font wrapper in markdown source: `{font:serif}text{/font}` */
export const WORD_FONT_MD_RE = /\{font:(sans|serif|mono)\}([\s\S]*?)\{\/font\}/g;

export function isPageFont(v: string): v is PageFont {
  return v === "sans" || v === "serif" || v === "mono";
}

/** Convert word-font markdown syntax to HTML spans (inner inline markdown parsed). */
export function wordFontSyntaxToHtml(md: string) {
  return md.replace(WORD_FONT_MD_RE, (_full, font: string, text: string) => {
    const inner = marked.parseInline(text, { async: false });
    const html = typeof inner === "string" ? inner : String(inner);
    return `<span ${WORD_FONT_ATTR}="${font}" class="${pageFontClass(font)}">${html}</span>`;
  });
}
