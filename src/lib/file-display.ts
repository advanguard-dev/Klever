import { assetKindFromPath, parseAlt, type AssetKind } from "@/lib/assets";

export type FileDisplay = "link" | "card";

const DISPLAYS = new Set<FileDisplay>(["link", "card"]);

const ASSET_MD_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

export function parseFileDisplay(title?: string | null): FileDisplay | undefined {
  const t = title?.trim().toLowerCase();
  if (t === "preview") return "card"; // legacy notes — preview removed
  if (t && DISPLAYS.has(t as FileDisplay)) return t as FileDisplay;
  return undefined;
}

export function defaultFileDisplay(_kind?: AssetKind): FileDisplay {
  return "card";
}

export function fileDisplayOptions(_kind?: AssetKind): { value: FileDisplay; label: string }[] {
  return [
    { value: "link", label: "Link" },
    { value: "card", label: "Card" },
  ];
}

export function kindLabel(kind: AssetKind) {
  const map: Record<AssetKind, string> = {
    image: "Image",
    audio: "Audio",
    video: "Video",
    pdf: "PDF",
    text: "Text",
    table: "Table",
    document: "Document",
    spreadsheet: "Spreadsheet",
    presentation: "Slides",
    archive: "Archive",
    file: "File",
  };
  return map[kind];
}

export function fileNameFromPath(path: string, label?: string) {
  const raw = (label ?? "").trim();
  if (raw && raw !== "audio" && raw !== "video" && raw !== "image") return parseAlt(raw).caption;
  return path.split("/").pop() || "file";
}

export function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${n < 10 * 1024 ? (n / 1024).toFixed(1) : Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function serializeFileMarkdown(opts: {
  src: string;
  name: string;
  kind: AssetKind;
  display: FileDisplay;
  width?: number;
}) {
  const { src, kind, display } = opts;
  const name = opts.name.trim() || fileNameFromPath(src);
  if (kind === "image" && display !== "link") {
    const alt = opts.width ? `${name}|${Math.round(opts.width)}` : name;
    return `![${alt}](${src})`;
  }
  const title = display === defaultFileDisplay(kind) ? "" : ` "${display}"`;
  return `[${name}](${src}${title})`;
}

export function setFileDisplay(body: string, src: string, display: FileDisplay) {
  const re = new RegExp(ASSET_MD_RE.source, "g");
  return body.replace(re, (full, _bang: string, alt: string, url: string) => {
    if (url.trim() !== src) return full;
    const parsed = parseAlt(alt);
    const kind = assetKindFromPath(src, parsed.caption);
    return serializeFileMarkdown({
      src,
      name: fileNameFromPath(src, parsed.caption),
      kind,
      display,
      width: parsed.width,
    });
  });
}

export function isLocalAssetHref(href: string) {
  if (!href) return false;
  if (/^(embed|wiki):/i.test(href) || href.startsWith("#")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(href);
}

/** Local file attachments — not note pages or http urls. */
export function isAttachedFileHref(href: string) {
  if (!isLocalAssetHref(href)) return false;
  if (href.startsWith("ext/") || href.startsWith("assets/")) return true;
  if (/\.(md|markdown)$/i.test(href)) return false;
  return /\.[a-z0-9]{1,8}$/i.test(href.split("/").pop() ?? "");
}
