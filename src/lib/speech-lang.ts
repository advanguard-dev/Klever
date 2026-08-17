/**
 * Speech language preference for Brain Dump (and other STT entry points).
 * Moonshine loads one language model at a time; Web Speech takes a BCP-47 tag.
 */

/** STT languages Moonshine Voice currently ships (see upstream README). */
export const MOONSHINE_STT = ["en", "es", "zh", "ja", "ko", "vi", "uk", "ar"] as const;

export type MoonshineSttLang = (typeof MOONSHINE_STT)[number];

/** Map common locale tags onto Moonshine STT codes. */
const MOONSHINE_ALIASES: Record<string, MoonshineSttLang> = {
  eng: "en",
  spa: "es",
  "es-419": "es",
  "es-mx": "es",
  "es-es": "es",
  cmn: "zh",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-tw": "zh",
  "zh-hant": "zh",
  "zh-hk": "zh",
  yue: "zh",
  jpn: "ja",
  kor: "ko",
  vie: "vi",
  ukr: "uk",
  ara: "ar",
  "ar-sa": "ar",
  "ar-eg": "ar",
};

/** Prefer these BCP-47 tags when driving the Web Speech API from a short code. */
const WEB_SPEECH_TAGS: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  vi: "vi-VN",
  uk: "uk-UA",
  ar: "ar-SA",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  it: "it-IT",
  nl: "nl-NL",
  ru: "ru-RU",
  pl: "pl-PL",
  tr: "tr-TR",
  hi: "hi-IN",
  sv: "sv-SE",
  da: "da-DK",
  fi: "fi-FI",
  no: "nb-NO",
  nb: "nb-NO",
  cs: "cs-CZ",
  ro: "ro-RO",
  el: "el-GR",
  he: "he-IL",
  id: "id-ID",
  th: "th-TH",
  hu: "hu-HU",
};

export type SpeechLangPreference = "auto" | string;

export const SPEECH_LANG_OPTIONS: { value: SpeechLangPreference; label: string }[] = [
  { value: "auto", label: "Auto (browser)" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "zh", label: "Chinese (Mandarin)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "vi", label: "Vietnamese" },
  { value: "uk", label: "Ukrainian" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "ru", label: "Russian" },
  { value: "pl", label: "Polish" },
  { value: "tr", label: "Turkish" },
  { value: "hi", label: "Hindi" },
  { value: "sv", label: "Swedish" },
];

const STORAGE_KEY = "klever.dumpSpeechLang";

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

/**
 * Moonshine language from browser locale (or explicit preference).
 * Returns null when the preference has no Moonshine model (use Web Speech).
 */
export function resolveMoonshineLang(preference: SpeechLangPreference = "auto"): MoonshineSttLang | null {
  if (preference !== "auto") {
    const code = primaryCode(preference);
    return moonshineSupports(code) ? (code as MoonshineSttLang) : null;
  }
  for (const loc of browserLocales()) {
    const lower = normalizeCode(loc);
    const primary = primaryCode(loc);
    if (MOONSHINE_ALIASES[lower]) return MOONSHINE_ALIASES[lower];
    if (moonshineSupports(lower)) return lower as MoonshineSttLang;
    if (MOONSHINE_ALIASES[primary]) return MOONSHINE_ALIASES[primary];
    if (moonshineSupports(primary)) return primary as MoonshineSttLang;
  }
  return "en";
}

/** BCP-47 tag for the Web Speech API. */
export function resolveWebSpeechLang(preference: SpeechLangPreference = "auto"): string {
  if (preference === "auto") {
    return browserLocales()[0] ?? "en-US";
  }
  const lower = normalizeCode(preference);
  if (WEB_SPEECH_TAGS[lower]) return WEB_SPEECH_TAGS[lower];
  const primary = primaryCode(preference);
  if (WEB_SPEECH_TAGS[primary]) return WEB_SPEECH_TAGS[primary];
  return preference;
}

/** @deprecated Prefer resolveWebSpeechLang */
export function webSpeechLang(preference: SpeechLangPreference = "auto") {
  return resolveWebSpeechLang(preference);
}

/** @deprecated Prefer resolveMoonshineLang */
export function moonshineLang(preference: SpeechLangPreference = "auto") {
  return resolveMoonshineLang(preference) ?? "en";
}

export function loadDumpSpeechLang(): SpeechLangPreference {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return "auto";
    if (v === "auto") return "auto";
    if (SPEECH_LANG_OPTIONS.some((o) => o.value === v)) return v;
  } catch {
    /* private mode */
  }
  return "auto";
}

export function saveDumpSpeechLang(value: SpeechLangPreference) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode */
  }
}
