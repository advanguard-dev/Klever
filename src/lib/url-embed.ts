import { normalizePropUrl } from "@/lib/prop-url";

export function isHttpUrl(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

export function urlHostname(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export function youtubeEmbedSrc(href: string): string | null {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
    else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      id = u.searchParams.get("v") ?? "";
      if (!id && u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? "";
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

export function vimeoEmbedSrc(href: string): string | null {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const id = u.pathname.split("/").filter(Boolean).pop() ?? "";
    if (!/^\d+$/.test(id)) return null;
    return `https://player.vimeo.com/video/${id}`;
  } catch {
    return null;
  }
}

export function mediaEmbedSrc(href: string): string | null {
  return youtubeEmbedSrc(href) ?? vimeoEmbedSrc(href);
}

export function serializeUrlEmbedMarkdown(href: string, name?: string) {
  const label = (name ?? "").trim() || urlHostname(href);
  return `[${label}](${href} "embed")`;
}

export function urlEmbedHtml(href: string, name?: string) {
  const src = href.trim();
  const label = (name ?? "").trim() || urlHostname(src);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<div data-url-embed data-src="${esc(src)}" data-name="${esc(label)}">&#8203;</div>`;
}

export function coerceHttpUrl(raw: string): string | null {
  const n = normalizePropUrl(raw);
  if (!n || !isHttpUrl(n)) return null;
  return n;
}
