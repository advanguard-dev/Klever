import katex from "katex";
import "katex/dist/katex.min.css";
import { applyOutsideCode } from "@/lib/parse";

export function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      output: "htmlAndMathml",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "KaTeX error";
    return `<span class="katex-error" title="${escapeAttr(msg)}">${escapeHtml(tex)}</span>`;
  }
}

/** Convert `$...$` / `$$...$$` in markdown to HTML before marked (preview-friendly). */
export function mathSyntaxToHtml(md: string): string {
  return applyOutsideCode(md, (chunk) => {
    let out = chunk.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
      const t = tex.trim();
      return `\n<div class="klever-math-block" data-math="block" data-tex="${escapeAttr(t)}">${renderKatex(t, true)}</div>\n`;
    });
    out = out.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_m, tex: string) => {
      const t = tex.trim();
      return `<span class="klever-math-inline" data-math="inline" data-tex="${escapeAttr(t)}">${renderKatex(t, false)}</span>`;
    });
    return out;
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

export function KatexInline({ tex }: { tex: string }) {
  return (
    <span
      className="klever-math-inline"
      data-math="inline"
      data-tex={tex}
      dangerouslySetInnerHTML={{ __html: renderKatex(tex, false) }}
    />
  );
}

export function KatexBlock({ tex }: { tex: string }) {
  return (
    <div
      className="klever-math-block my-3 overflow-x-auto text-center"
      data-math="block"
      data-tex={tex}
      dangerouslySetInnerHTML={{ __html: renderKatex(tex, true) }}
    />
  );
}
