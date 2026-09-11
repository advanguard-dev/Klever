/** UI chrome locales. Note bodies and stored property names stay as written. */
import { en, type MessageKey } from "@/lib/i18n-en";
import { fr } from "@/lib/i18n-fr";

export type { MessageKey };

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_OPTIONS: { id: Locale; nativeName: string }[] = [
  { id: "en", nativeName: "English" },
  { id: "fr", nativeName: "Français" },
];

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, fr };

const PROP_TYPE_KEYS = {
  text: "prop.type.text",
  number: "prop.type.number",
  select: "prop.type.select",
  multi_select: "prop.type.multi_select",
  date: "prop.type.date",
  checkbox: "prop.type.checkbox",
  url: "prop.type.url",
  relation: "prop.type.relation",
  people: "prop.type.people",
  location: "prop.type.location",
  tags: "prop.type.tags",
  files: "prop.type.files",
  formula: "prop.type.formula",
  rollup: "prop.type.rollup",
} as const;

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "fr";
}

/** Accept stored tags and loose BCP-47 (`fr-FR` → fr). */
export function parseLocale(v: unknown): Locale | undefined {
  if (isLocale(v)) return v;
  if (typeof v !== "string" || !v.trim()) return undefined;
  const low = v.trim().toLowerCase();
  if (low === "fr" || low.startsWith("fr-") || low.startsWith("fr_")) return "fr";
  if (low === "en" || low.startsWith("en-") || low.startsWith("en_")) return "en";
  return undefined;
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const tags = [...(navigator.languages ?? []), navigator.language];
  for (const raw of tags) {
    const hit = parseLocale(raw);
    if (hit === "fr") return "fr";
  }
  return "en";
}

/** Stored pick wins; otherwise browser `navigator.language` (fr* → fr, else en). */
export function resolveLocale(stored?: unknown): Locale {
  return parseLocale(stored) ?? detectBrowserLocale();
}

export function localeBcp47(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function applyDocumentLang(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key]),
  );
}

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const table = catalogs[locale] ?? catalogs.en;
  return interpolate(table[key] ?? catalogs.en[key] ?? key, vars);
}

export function writingToolLabel(locale: Locale, id: string): string {
  const key = `writing.${id}` as MessageKey;
  if (key in catalogs.en) return t(locale, key);
  return id;
}

export function propTypeMessageKey(
  type: keyof typeof PROP_TYPE_KEYS,
): (typeof PROP_TYPE_KEYS)[keyof typeof PROP_TYPE_KEYS] {
  return PROP_TYPE_KEYS[type];
}

export function insertCommandKey(id: string): MessageKey | undefined {
  const key = `insert.${id}` as MessageKey;
  return key in catalogs.en ? key : undefined;
}

export function insertSectionKey(
  section: "pages" | "databases" | "blocks" | "media" | "ai" | "current",
): MessageKey {
  return `insert.section.${section}`;
}
