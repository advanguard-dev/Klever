import type { BlobRecord } from "@/types";
import { assetKindFromPath, parseAlt, type AssetKind } from "@/lib/assets";

export type FileDisplay = "link" | "preview" | "card";

const DISPLAYS = new Set<FileDisplay>(["link", "preview", "card"]);

const ASSET_MD_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

export function parseFileDisplay(title?: string | null): FileDisplay | undefined {
  const t = title?.trim().toLowerCase();
  if (t && DISPLAYS.has(t as FileDisplay)) return t as FileDisplay;
  return undefined;
}

export function defaultFileDisplay(_kind: AssetKind): FileDisplay {
  return "card";
}

export function canPreviewKind(kind: AssetKind) {
  return (
    kind === "image" ||
    kind === "audio" ||
    kind === "video" ||
    kind === "pdf" ||
    kind === "text" ||
    kind === "table"
  );
}

export function fileDisplayOptions(kind: AssetKind): { value: FileDisplay; label: string }[] {
  const all: { value: FileDisplay; label: string }[] = [
    { value: "link", label: "Link" },
    { value: "preview", label: "Preview" },
    { value: "card", label: "Card" },
  ];
  return canPreviewKind(kind) ? all : all.filter((o) => o.value !== "preview");
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

export function decodeTextSnippet(rec: BlobRecord, max = 1200) {
  if (!rec.data.byteLength) return "";
  const text = new TextDecoder("utf-8", { fatal: false }).decode(rec.data.slice(0, max * 2));
  return text.replace(/\u0000/g, "").slice(0, max);
}

export function tableRowsFromText(text: string, maxRows = 6, maxCols = 8) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .slice(0, maxRows)
    .map((line) => line.split(/[\t,]/).slice(0, maxCols));
}

export function serializeFileMarkdown(opts: {
  src: string;
  name: string;
  kind: AssetKind;
  display: FileDisplay;
  width?: number;
}) {
  const { src, kind, display, width } = opts;
  const name = opts.name.trim() || fileNameFromPath(src);
  const title = display === defaultFileDisplay(kind) ? "" : ` "${display}"`;
  if (kind === "image" && display !== "link") {
    const alt = width ? `${name}|${Math.round(width)}` : name;
    return `![${alt}](${src}${title})`;
  }
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
