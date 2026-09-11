import type { SplitSide } from "@/types";

/** First heading, else first line, else fallback. */
export function titleFromBody(body: string, fallback: string) {
  const heading = body.match(/^#{1,6}\s+(.+)$/m);
  if (heading?.[1]?.trim()) return heading[1].trim();
  const line = body.split("\n").find((l) => l.trim() && !l.startsWith("#"));
  if (!line) return fallback;
  const text = line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "").trim();
  if (!text) return fallback;
  return text.length > 48 ? `${text.slice(0, 47).trimEnd()}…` : text;
}

export function previewSnippet(body: string, max = 140) {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Cut markdown at a paragraph (or line) near `at`, defaulting to the midpoint. */
export function cutMarkdown(body: string, at?: number): { left: string; right: string } {
  const text = body.replace(/\r\n/g, "\n");
  if (!text.trim()) return { left: "", right: "" };
  let cut = at ?? Math.floor(text.length / 2);
  cut = Math.max(0, Math.min(text.length, cut));
  const paraBefore = text.lastIndexOf("\n\n", cut);
  const paraAfter = text.indexOf("\n\n", cut);
  if (paraBefore >= 8 && paraAfter >= 0) {
    cut = cut - paraBefore <= paraAfter - cut ? paraBefore : paraAfter;
  } else if (paraAfter >= 0 && paraAfter < text.length - 8) {
    cut = paraAfter;
  } else if (paraBefore >= 8) {
    cut = paraBefore;
  } else {
    const nl = text.lastIndexOf("\n", cut);
    if (nl > 0 && nl < text.length - 1) cut = nl;
  }
  return {
    left: text.slice(0, cut).trimEnd(),
    right: text.slice(cut).replace(/^\n+/, "").trimEnd(),
  };
}

export function planPageSplit(
  body: string,
  title: string,
  side: SplitSide,
  at?: number,
): { keepBody: string; nextTitle: string; nextBody: string } | null {
  const { left, right } = cutMarkdown(body, at);
  if (!left.trim() && !right.trim()) return null;
  const fallback = `${title.replace(/\s+\d+$/, "")} 2`.trim() || "Untitled";
  if (side === "left") {
    return {
      keepBody: right,
      nextTitle: titleFromBody(left, fallback),
      nextBody: left,
    };
  }
  return {
    keepBody: left,
    nextTitle: titleFromBody(right, fallback),
    nextBody: right,
  };
}
