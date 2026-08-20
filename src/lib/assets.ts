import type { BlobRecord, ImageRef } from "@/types";
import { nid } from "@/lib/ids";

const urlCache = new Map<string, { url: string; data: ArrayBuffer }>();

export const IMAGE_EXTS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".jpe",
  ".gif",
  ".webp",
  ".svg",
  ".avif",
  ".bmp",
  ".ico",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".apng",
];

export const AUDIO_EXTS = [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus", ".aiff", ".aif", ".wma"];

export const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".mkv"];

const IMAGE_EXT_RE = /\.(png|jpe?g|jfif|jpe|gif|webp|svg|avif|bmp|ico|tiff?|heic|heif|apng)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|aiff?|wma)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;
const PDF_EXT_RE = /\.pdf$/i;
const TABLE_EXT_RE = /\.(csv|tsv)$/i;
const TEXT_EXT_RE = /\.(txt|md|markdown|json|ya?ml|xml|html?|css|js|ts|tsx|jsx|log|ini|env)$/i;
const DOCUMENT_EXT_RE = /\.(docx?|odt|pages|rtf)$/i;
const SHEET_EXT_RE = /\.(xlsx?|ods|numbers)$/i;
const DECK_EXT_RE = /\.(pptx?|odp|key)$/i;
const ARCHIVE_EXT_RE = /\.(zip|tar|gz|tgz|rar|7z)$/i;

export type AssetKind =
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "text"
  | "table"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "file";

export function mimeFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jfif: "image/jpeg",
    jpe: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
    bmp: "image/bmp",
    ico: "image/x-icon",
    tif: "image/tiff",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heif",
    apng: "image/apng",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac",
    opus: "audio/opus",
    aiff: "audio/aiff",
    aif: "audio/aiff",
    wma: "audio/x-ms-wma",
    pdf: "application/pdf",
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    ogv: "video/ogg",
    mkv: "video/x-matroska",
    txt: "text/plain",
    csv: "text/csv",
    rtf: "application/rtf",
    json: "application/json",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext ?? ""] || "application/octet-stream";
}

export function extFromName(name: string, mime?: string) {
  const fromName = name.split(".").pop();
  if (fromName && fromName !== name) return fromName.toLowerCase();
  const fromMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/heic": "heic",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/flac": "flac",
    "application/pdf": "pdf",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return fromMime[mime ?? ""] || "bin";
}

export function blobUrl(path: string, rec: BlobRecord) {
  const prev = urlCache.get(path);
  if (prev && prev.data === rec.data) return prev.url;
  if (prev) URL.revokeObjectURL(prev.url);
  const url = URL.createObjectURL(new Blob([rec.data], { type: rec.mime }));
  urlCache.set(path, { url, data: rec.data });
  return url;
}

/** Re-read from a live disk/cloud handle when permission is already granted. */
export async function refreshBlobFromHandle(rec: BlobRecord): Promise<BlobRecord> {
  if (!rec.handle) return rec;
  try {
    const queryFn = rec.handle.queryPermission?.bind(rec.handle);
    const requestFn = rec.handle.requestPermission?.bind(rec.handle);
    if (!queryFn) {
      const file = await rec.handle.getFile();
      return { ...rec, mime: file.type || rec.mime, data: await file.arrayBuffer() };
    }
    const query = await queryFn({ mode: "read" });
    let perm = query;
    if (perm === "prompt" && rec.data.byteLength === 0 && requestFn) {
      perm = await requestFn({ mode: "read" });
    }
    if (perm !== "granted") return rec;
    const file = await rec.handle.getFile();
    return {
      ...rec,
      mime: file.type || rec.mime,
      data: await file.arrayBuffer(),
    };
  } catch {
    return rec;
  }
}

export async function refreshBlobsFromDisk(blobs: Record<string, BlobRecord>) {
  const entries = await Promise.all(
    Object.entries(blobs).map(async ([path, rec]) => [path, await refreshBlobFromHandle(rec)] as const),
  );
  return Object.fromEntries(entries);
}

/** Persist blobs to IndexedDB — keep byte data as fallback when handles don't restore. */
export function persistableBlobs(blobs: Record<string, BlobRecord>) {
  const out: Record<string, BlobRecord> = {};
  for (const [path, rec] of Object.entries(blobs)) {
    out[path] = {
      mime: rec.mime,
      data: rec.data,
      ...(rec.external ? { external: true } : {}),
      ...(rec.localPath ? { localPath: rec.localPath } : {}),
      ...(rec.handle ? { handle: rec.handle } : {}),
    };
  }
  return out;
}

export function resolveAssetSrc(src: string, blobs: Record<string, BlobRecord>) {
  const path = src.replace(/^\.\//, "").trim();
  const rec = blobs[path] ?? blobs[src];
  if (rec?.data?.byteLength) return blobUrl(path, rec);
  return "";
}

export function isImagePath(path: string) {
  return IMAGE_EXT_RE.test(path);
}

export function isAudioPath(path: string) {
  return AUDIO_EXT_RE.test(path);
}

export function isVideoPath(path: string) {
  return VIDEO_EXT_RE.test(path);
}

export function isPdfPath(path: string) {
  return PDF_EXT_RE.test(path);
}

export function assetKindFromPath(path: string, label?: string): AssetKind {
  const hint = (label ?? "").trim().toLowerCase();
  if (isImagePath(path) || hint === "image") return "image";
  if (isAudioPath(path) || hint === "audio") return "audio";
  if (isVideoPath(path) || hint === "video") return "video";
  if (isPdfPath(path)) return "pdf";
  if (TABLE_EXT_RE.test(path)) return "table";
  if (TEXT_EXT_RE.test(path)) return "text";
  if (SHEET_EXT_RE.test(path)) return "spreadsheet";
  if (DECK_EXT_RE.test(path)) return "presentation";
  if (DOCUMENT_EXT_RE.test(path)) return "document";
  if (ARCHIVE_EXT_RE.test(path)) return "archive";
  return "file";
}

export const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

export function parseAlt(alt: string): { caption: string; width?: number } {
  const m = alt.match(/^(.*?)\|(\d+)\s*$/);
  if (m) return { caption: m[1], width: Number(m[2]) };
  return { caption: alt };
}

export function extractImages(body: string): ImageRef[] {
  const out: ImageRef[] = [];
  const re = new RegExp(IMG_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const parsed = parseAlt(m[1]);
    out.push({ alt: m[1], caption: parsed.caption, src: m[2].trim(), width: parsed.width });
  }
  return out;
}

export function firstImageSrc(body: string) {
  return extractImages(body)[0]?.src;
}

export function setImageWidth(body: string, src: string, width: number) {
  return body.replace(new RegExp(IMG_RE.source, "g"), (full, alt: string, url: string, title?: string) => {
    if (url.trim() !== src) return full;
    const { caption } = parseAlt(alt);
    const t = title ? ` "${title}"` : "";
    return `![${caption}|${Math.round(width)}](${url}${t})`;
  });
}

export function replaceImageSrc(body: string, from: string, to: string) {
  return body.replace(new RegExp(IMG_RE.source, "g"), (full, alt: string, url: string) => {
    if (url.trim() !== from) return full;
    return `![${alt}](${to})`;
  });
}

export function originalPath(src: string) {
  const name = src.split("/").pop() ?? src;
  return `assets/.originals/${name}`;
}

export function pickFile(accept: string) {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    const acceptValue = inputAccept(accept);
    if (acceptValue) input.accept = acceptValue;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.click();
  });
}

export type PickedLocalFile = { file: File; handle?: FileSystemFileHandle; localPath?: string };

/** Open a disk/cloud file. Prefer a live handle so we can read in place. */
export async function pickLocalFile(accept: string): Promise<PickedLocalFile | null> {
  if (window.kleverDesktop?.pickLocalFile) {
    const picked = await window.kleverDesktop.pickLocalFile(accept);
    if (!picked) return null;
    return {
      file: new File([], picked.name, { type: picked.mime }),
      localPath: picked.localPath,
    };
  }
  if (typeof window.showOpenFilePicker === "function") {
    try {
      const opts: OpenFilePickerOptions = {
        multiple: false,
        excludeAcceptAllOption: false,
      };
      const types = pickerTypes(accept);
      if (types) opts.types = types;
      const [handle] = await window.showOpenFilePicker(opts);
      const file = await handle.getFile();
      return { file, handle };
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return null;
    }
  }
  const file = await pickFile(accept);
  return file ? { file } : null;
}

function inputAccept(accept: string) {
  if (!accept || accept === "*/*") return "";
  if (accept === "image/*") return IMAGE_EXTS.join(",");
  if (accept === "audio/*") return AUDIO_EXTS.join(",");
  if (accept === "video/*") return VIDEO_EXTS.join(",");
  return accept;
}

function pickerTypes(accept: string): OpenFilePickerOptions["types"] {
  if (!accept || accept === "*/*") return undefined;
  if (accept === "image/*") {
    return [
      {
        description: "Images",
        accept: {
          "image/png": [".png"],
          "image/jpeg": [".jpg", ".jpeg", ".jfif", ".jpe"],
          "image/gif": [".gif"],
          "image/webp": [".webp"],
          "image/svg+xml": [".svg"],
          "image/avif": [".avif"],
          "image/bmp": [".bmp"],
          "image/x-icon": [".ico"],
          "image/tiff": [".tif", ".tiff"],
          "image/heic": [".heic"],
          "image/heif": [".heif"],
          "image/apng": [".apng"],
        },
      },
    ];
  }
  if (accept === "audio/*") {
    return [
      {
        description: "Audio",
        accept: {
          "audio/mpeg": [".mp3"],
          "audio/wav": [".wav"],
          "audio/ogg": [".ogg", ".oga"],
          "audio/mp4": [".m4a"],
          "audio/aac": [".aac"],
          "audio/flac": [".flac"],
          "audio/opus": [".opus"],
          "audio/aiff": [".aiff", ".aif"],
        },
      },
    ];
  }
  if (accept === "video/*") {
    return [
      {
        description: "Video",
        accept: {
          "video/mp4": [".mp4", ".m4v"],
          "video/webm": [".webm"],
          "video/quicktime": [".mov"],
          "video/ogg": [".ogv"],
          "video/x-matroska": [".mkv"],
        },
      },
    ];
  }
  return undefined;
}

export function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim() || "file";
}

export function pickFiles(accept: string, multiple = true) {
  return new Promise<File[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener("change", () => resolve(Array.from(input.files ?? [])), { once: true });
    input.click();
  });
}

export async function cropToBlob(
  rec: BlobRecord,
  crop: { x: number; y: number; w: number; h: number },
): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([rec.data], { type: rec.mime }));
  try {
    const img = await loadImg(url);
    const sx = Math.round(crop.x * img.naturalWidth);
    const sy = Math.round(crop.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(crop.w * img.naturalWidth));
    const sh = Math.max(1, Math.round(crop.h * img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not crop");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const mime = rec.mime.startsWith("image/") && rec.mime !== "image/svg+xml" ? rec.mime : "image/jpeg";
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), mime, 0.92);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImg(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = url;
  });
}

export function assetPathFor(file: File) {
  return `assets/${nid()}.${extFromName(file.name, file.type)}`;
}
