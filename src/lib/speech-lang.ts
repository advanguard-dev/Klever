/**
 * Speech language preference for Brain Dump / meeting STT.
 * Supported: English and French only.
 */

/** STT languages Moonshine Voice ships that we use (English only — no French model). */
export const MOONSHINE_STT = ["en"] as const;

export type MoonshineSttLang = (typeof MOONSHINE_STT)[number];

/** Prefer these BCP-47 tags when driving the Web Speech API. */
const WEB_SPEECH_TAGS: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
};

export type SpeechLangPreference = "auto" | "en" | "fr";

export const SPEECH_LANG_OPTIONS: { value: SpeechLangPreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
];

const STORAGE_KEY = "klever.dumpSpeechLang";
const ALLOWED = new Set<string>(SPEECH_LANG_OPTIONS.map((o) => o.value));

export function browserLocales(): string[] {
  if (typeof navigator === "undefined") return ["en"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(navigator.languages ?? []), navigator.language]) {
    const t = (raw || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length ? out : ["en"];
}

export function moonshineSupports(code: string) {
  return (MOONSHINE_STT as readonly string[]).includes(code.toLowerCase());
}

function normalizeCode(raw: string): string {
  return raw.toLowerCase().replace(/_/g, "-");
}

function primaryCode(raw: string): string {
  return normalizeCode(raw).split("-")[0] ?? "en";
}

/** Resolve preference to en | fr (never other languages). */
export function resolveDumpLang(preference: SpeechLangPreference = "auto"): "en" | "fr" {
  if (preference === "en" || preference === "fr") return preference;
  for (const loc of browserLocales()) {
    const p = primaryCode(loc);
    if (p === "fr") return "fr";
    if (p === "en") return "en";
  }
  return "en";
}

/**
 * Moonshine language from preference.
 * Returns null when French (no model) — callers should use dictation / Web Speech.
 */
export function resolveMoonshineLang(preference: SpeechLangPreference = "auto"): MoonshineSttLang | null {
  return resolveDumpLang(preference) === "en" ? "en" : null;
}

/** BCP-47 tag for the Web Speech API (en-US or fr-FR). */
export function resolveWebSpeechLang(preference: SpeechLangPreference = "auto"): string {
  const lang = resolveDumpLang(preference);
  return WEB_SPEECH_TAGS[lang] ?? "en-US";
}

export function loadDumpSpeechLang(): SpeechLangPreference {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return "auto";
    if (ALLOWED.has(v)) return v as SpeechLangPreference;
    // Migrate older multi-language prefs → closest EN/FR/auto
    const primary = primaryCode(v);
    if (primary === "fr") return "fr";
    if (primary === "en") return "en";
  } catch {
    /* private mode */
  }
  return "auto";
}

export function saveDumpSpeechLang(value: SpeechLangPreference) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, ALLOWED.has(value) ? value : "auto");
  } catch {
    /* private mode */
  }
}
