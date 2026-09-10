import {
  moonshineReady,
  moonshineSupported,
  startMoonshineTranscription,
  type DumpRecHandler,
  type DumpRecSession,
} from "@/lib/moonshine";
import {
  resolveMoonshineLang,
  resolveWebSpeechLang,
  type SpeechLangPreference,
} from "@/lib/speech-lang";

type RecHandler = (text: string, isFinal: boolean) => void;

interface SpeechRec extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function webSpeechSupported() {
  return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
}

/** Any local transcription path available (Moonshine or Web Speech). */
export function speechSupported() {
  return moonshineSupported() || webSpeechSupported();
}

export { moonshineReady, moonshineSupported };

export function startTranscription(
  onText: RecHandler,
  onError?: (msg: string) => void,
  language: SpeechLangPreference = "auto",
) {
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
  if (!Ctor) {
    onError?.("Speech recognition is not available in this browser.");
    return { stop() {}, backend: "webspeech" as const };
  }
  const rec = new Ctor();
  rec.lang = resolveWebSpeechLang(language);
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (ev) => {
    let interim = "";
    let final = "";
    for (let i = 0; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    onText((final + " " + interim).trim(), Boolean(final) && !interim);
  };
  rec.onerror = (ev) => onError?.(ev.error);
  rec.start();
  return {
    backend: "webspeech" as const,
    stop() {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

/**
 * Brain dump transcription: Moonshine on-device when isolated + language supported,
 * otherwise Web Speech API.
 */
export async function startDumpTranscription(
  onText: DumpRecHandler,
  opts?: {
    language?: SpeechLangPreference;
    onError?: (msg: string) => void;
    onProgress?: (fraction: number, file: string) => void;
    onStatus?: (status: string) => void;
  },
): Promise<DumpRecSession> {
  const language = opts?.language ?? "auto";
  const moonLang = resolveMoonshineLang(language);
  const canMoonshine = moonshineSupported() && moonshineReady() && Boolean(moonLang);

  if (canMoonshine) {
    try {
      return await startMoonshineTranscription(onText, { ...opts, language });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      opts?.onStatus?.("Moonshine unavailable — using browser speech…");
      opts?.onError?.(msg);
    }
  } else if (moonshineSupported() && !moonshineReady() && moonLang) {
    opts?.onStatus?.("Moonshine needs a refreshed Vite server — using browser speech…");
  } else if (moonshineSupported() && moonshineReady() && !moonLang) {
    opts?.onStatus?.("No Moonshine model for this language — using browser speech…");
  }

  if (!webSpeechSupported()) {
    throw new Error("No speech recognition backend is available. Paste or type instead.");
  }
  const webLang = resolveWebSpeechLang(language);
  opts?.onStatus?.(`Listening (browser speech · ${webLang})…`);
  return startTranscription(onText, opts?.onError, language);
}
