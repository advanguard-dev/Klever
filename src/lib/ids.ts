import { nanoid } from "nanoid";

export function nid(size = 10) {
  return nanoid(size);
}

export function slugify(title: string) {
  const s = title
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ");
  return s || "untitled";
}

export function todayIso() {
  return new Date().toISOString();
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatShort(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(document.documentElement.lang || undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
