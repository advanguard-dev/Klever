/**
 * Word/Google HTML is often 10–50× the visible text (nested spans, styles, MSO tags).
 * ProseMirror then builds one node/mark per span — that is what freezes the renderer,
 * not a character quota. Plain text of the same length is fine.
 *
 * DOMParser on multi‑megabyte HTML can OOM; only then we strip tags with a regex.
 */
const HTML_PARSE_SOFT_MAX = 1_500_000;

export function isOfficeClipboardHtml(html: string): boolean {
  return /urn:schemas-microsoft-com:office|schemas-microsoft-com:office:word|StartFragment|docs-internal-guid/i.test(
    html,
  );
}

export function htmlLooksExplosive(html: string, text: string): boolean {
  if (!html.trim()) return false;
  if (html.length > HTML_PARSE_SOFT_MAX) return true;
  if (isOfficeClipboardHtml(html) && html.length > 8_000) return true;
  if (text && html.length > Math.max(text.length * 5, 12_000)) return true;
  const spans = html.split(/<span/i).length - 1;
  return spans > 400;
}

export function htmlToPlainFallback(html: string): string {
  if (!html) return "";
  if (html.length > HTML_PARSE_SOFT_MAX) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.innerText || "").replace(/\u00a0/g, " ");
  } catch {
    return html.replace(/<[^>]+>/g, " ");
  }
}

export function sanitizePastedHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed.length > HTML_PARSE_SOFT_MAX) return "";
  try {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    doc.querySelectorAll("style, script, meta, link, xml, noscript").forEach((n) => n.remove());
    const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    const doomed: Element[] = [];
    while (walk.nextNode()) {
      const el = walk.currentNode as Element;
      el.removeAttribute("style");
      el.removeAttribute("class");
      el.removeAttribute("id");
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || name.startsWith("o:") || name.startsWith("xmlns") || name === "width" || name === "height") {
          el.removeAttribute(attr.name);
        }
      }
      if (/^O:|^V:|^W:/i.test(el.tagName)) doomed.push(el);
    }
    for (const el of doomed) el.replaceWith(...el.childNodes);
    return doc.body.innerHTML;
  } catch {
    return "";
  }
}

export function pastePayload(html: string, text: string): { html: string | null; text: string } {
  const plain = (text || htmlToPlainFallback(html)).replace(/\r\n/g, "\n");
  if (htmlLooksExplosive(html, plain) || !html.trim()) {
    return { html: null, text: plain };
  }
  const clean = sanitizePastedHtml(html);
  return { html: clean || null, text: plain };
}
