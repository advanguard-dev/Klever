import type { BlobRecord, ImageRef } from "@/types";
import { nid } from "@/lib/ids";

const urlCache = new Map<string, { url: string; data: ArrayBuffer }>();

export function mimeFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    pdf: "application/pdf",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
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
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "application/pdf": "pdf",
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

export function resolveAssetSrc(src: string, blobs: Record<string, BlobRecord>) {
  const path = src.replace(/^\.\//, "").trim();
  const rec = blobs[path] ?? blobs[src];
  if (rec) return blobUrl(path, rec);
  return src;
}

export function isImagePath(path: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path);
}

export function isAudioPath(path: string) {
  return /\.(mp3|wav|ogg|m4a)$/i.test(path);
}

export const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

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
  return body.replace(new RegExp(IMG_RE.source, "g"), (full, alt: string, url: string) => {
    if (url.trim() !== src) return full;
    const { caption } = parseAlt(alt);
    return `![${caption}|${Math.round(width)}](${url})`;
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
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.click();
  });
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
