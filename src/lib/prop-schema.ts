import type { CSSProperties } from "react";
import type { Note, PropType, SchemaProp } from "@/types";

/** Field names that should be people, not hashtag tags. */
export const PEOPLE_PROP_NAME_RE =
  /\b(attendees?|participants?|people|persons?|present|guests?|invitees?)\b/i;

/** Field names that should be a place, not hashtag tags. */
export const LOCATION_PROP_NAME_RE =
  /\b(lieu|location|place|venue|address|where)\b/i;

export function inferredNameType(name: string): PropType | undefined {
  if (PEOPLE_PROP_NAME_RE.test(name)) return "people";
  if (LOCATION_PROP_NAME_RE.test(name)) return "location";
  return undefined;
}

/**
 * Existing notes often stored Participants/Lieu as `tags`.
 * Render those as people/location without rewriting schema.
 */
export function effectivePropType(spec: Pick<SchemaProp, "type" | "name">): PropType {
  if (spec.type === "tags") return inferredNameType(spec.name) ?? spec.type;
  return spec.type;
}

/** Names, emails, or place parts — no `#` prefix. */
export function asChipValues(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map(String)
    : String(raw ?? "")
        .split(/[,;]/)
        .map((x) => x.trim());
  const cleaned = list.map((t) => t.replace(/^#+/, "").trim()).filter(Boolean);
  return [...new Set(cleaned)];
}

export const PROP_SWATCHES: { id: string; label: string; hex: string }[] = [
  { id: "", label: "Default", hex: "" },
  { id: "rose", label: "Rose", hex: "#c17b7b" },
  { id: "clay", label: "Clay", hex: "#c4956a" },
  { id: "gold", label: "Gold", hex: "#c4a35a" },
  { id: "sage", label: "Sage", hex: "#6f9e86" },
  { id: "sky", label: "Sky", hex: "#6e90b8" },
  { id: "violet", label: "Violet", hex: "#8b7eae" },
  { id: "slate", label: "Slate", hex: "#808480" },
];

export function propSwatchHex(color?: string): string | undefined {
  if (!color) return undefined;
  const hit = PROP_SWATCHES.find((s) => s.id === color);
  return hit?.hex || undefined;
}

export function propAccentStyle(color?: string): { color: string } | undefined {
  const hex = propSwatchHex(color);
  return hex ? { color: hex } : undefined;
}

export function propChipStyle(color?: string): CSSProperties | undefined {
  const hex = propSwatchHex(color);
  if (!hex) return undefined;
  return {
    color: hex,
    borderColor: `${hex}66`,
    backgroundColor: `${hex}1f`,
  };
}

export function itemColorId(colors: Record<string, string> | undefined, item: string): string | undefined {
  const id = colors?.[item];
  return id || undefined;
}

export function setItemColor(
  colors: Record<string, string> | undefined,
  item: string,
  color?: string,
): Record<string, string> | undefined {
  const next = { ...colors };
  if (!color) delete next[item];
  else next[item] = color;
  return Object.keys(next).length ? next : undefined;
}

export function remapItemColorKey(
  colors: Record<string, string> | undefined,
  from: string,
  to: string,
): Record<string, string> | undefined {
  if (!colors || from === to) return colors;
  if (!(from in colors)) return colors;
  const next = { ...colors };
  if (to) next[to] = next[from];
  delete next[from];
  return Object.keys(next).length ? next : undefined;
}

export function nextItemSwatch(colors: Record<string, string> | undefined): string {
  const used = new Set(Object.values(colors ?? {}));
  const ids = PROP_SWATCHES.map((s) => s.id).filter(Boolean);
  return ids.find((id) => !used.has(id)) ?? ids[(used.size) % ids.length] ?? "sage";
}

export function seedItemColors(
  options: string[],
  existing?: Record<string, string>,
): Record<string, string> | undefined {
  let colors = { ...(existing ?? {}) };
  for (const o of options) {
    if (o && !colors[o]) colors = setItemColor(colors, o, nextItemSwatch(colors)) ?? {};
  }
  return Object.keys(colors).length ? colors : undefined;
}

export function schemaTarget(note: Note, notes: Note[]) {
  if (note.type === "database") return note;
  if (note.parent) return notes.find((n) => n.id === note.parent) ?? note;
  return note;
}

export function schemaWithItemColor(
  schema: SchemaProp[],
  field: string,
  item: string,
  color?: string,
): SchemaProp[] {
  return schema.map((p) =>
    p.key === field ? { ...p, itemColors: setItemColor(p.itemColors, item, color) } : p,
  );
}
