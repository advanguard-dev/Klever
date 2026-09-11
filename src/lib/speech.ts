import {
  resolveDumpLang,
  resolveMoonshineLang,
  resolveWebSpeechLang,
  type SpeechLangPreference,
} from "@/lib/speech-lang";

type RecHandler = (text: string, isFinal: boolean) => void;

export function moonshineReady() {
  return typeof window !== "undefined" && Boolean(window.crossOriginIsolated);
}

export function moonshineSupported() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

interface SpeechRec extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
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

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission denied. Allow mic access for Klever, then try again.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Browser speech needs a network connection (or use Mac Dictation).";
    case "no-speech":
      return "No speech heard — try again.";
    case "aborted":
      return "";
    default:
      return code ? `Speech error: ${code}` : "Speech recognition failed.";
  }
}

/** Ask for mic access so Chromium / Electron prompts before STT starts. */
async function ensureMicrophone(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  if (window.kleverDesktop?.askMicrophone) {
    const ok = await window.kleverDesktop.askMicrophone();
    if (!ok) throw new Error("Microphone permission denied. Allow mic access for Klever in System Settings.");
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

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

  let active = true;
  let restarting = false;

  const restart = () => {
    if (!active || restarting) return;
    restarting = true;
    try {
      rec.start();
    } catch {
      /* already started */
    } finally {
      restarting = false;
    }
  };

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
  rec.onerror = (ev) => {
    const msg = speechErrorMessage(ev.error);
    if (ev.error === "aborted" || ev.error === "no-speech") {
      // Continuous sessions often end with no-speech; keep listening.
      return;
    }
    if (msg) onError?.(msg);
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "network") {
      active = false;
    }
  };
  rec.onend = () => {
    if (active) restart();
  };

  try {
    rec.start();
  } catch (err) {
    onError?.(err instanceof Error ? err.message : String(err));
  }

  return {
    backend: "webspeech" as const,
    stop() {
      active = false;
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

/**
 * Brain dump transcription: Moonshine (English, when isolated) → Web Speech (EN/FR).
 * Prefer Mac Dictation from the UI when available — it is more reliable in Electron.
 */
export async function startDumpTranscription(
  onText: RecHandler,
  opts?: {
    language?: SpeechLangPreference;
    onError?: (msg: string) => void;
    onProgress?: (fraction: number, file: string) => void;
    onStatus?: (status: string) => void;
  },
): Promise<{ stop: () => void; backend: "moonshine" | "webspeech" }> {
  const language = opts?.language ?? "auto";
  const dumpLang = resolveDumpLang(language);
  const moonLang = resolveMoonshineLang(language);
  const canMoonshine = moonshineSupported() && moonshineReady() && Boolean(moonLang);

  if (canMoonshine) {
    try {
      const { startMoonshineTranscription } = await import("@/lib/moonshine");
      return await startMoonshineTranscription(onText, { ...opts, language });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      opts?.onStatus?.("Moonshine unavailable — trying browser speech…");
      opts?.onError?.(msg);
    }
  } else if (dumpLang === "fr") {
    opts?.onStatus?.("French · browser speech (Moonshine is English-only)…");
  } else if (moonshineSupported() && !moonshineReady() && moonLang) {
    opts?.onStatus?.("Moonshine needs isolation — using browser speech…");
  }

  if (!webSpeechSupported()) {
    throw new Error("No speech recognition backend is available. Use Mac Dictation, or paste/type instead.");
  }

  try {
    await ensureMicrophone();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  const webLang = resolveWebSpeechLang(language);
  opts?.onStatus?.(`Listening (browser speech · ${webLang})…`);
  return startTranscription(onText, opts?.onError, language);
}
