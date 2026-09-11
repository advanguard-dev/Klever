import { MicTranscriber, ModelArch } from "@moonshine-ai/moonshine-wasm";
import { resolveMoonshineLang, type SpeechLangPreference } from "@/lib/speech-lang";

export type DumpRecHandler = (text: string, isFinal: boolean) => void;

export type DumpRecSession = {
  stop: () => void;
  backend: "moonshine" | "webspeech";
};

/** Klever-flavored terms so Moonshine prefers them while dictating. */
const DUMP_KEYTERMS = [
  "Klever",
  "wikilink",
  "wikilinks",
  "brain dump",
  "Atlas",
  "markdown",
  "vault",
];

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

/**
 * On-device streaming STT via Moonshine WASM.
 * Models download once from Moonshine CDN and cache in the browser.
 */
export async function startMoonshineTranscription(
  onText: DumpRecHandler,
  opts?: {
    language?: SpeechLangPreference;
    onError?: (msg: string) => void;
    onProgress?: (fraction: number, file: string) => void;
    onStatus?: (status: string) => void;
  },
): Promise<DumpRecSession> {
  if (!moonshineSupported()) {
    throw new Error("Microphone access is not available in this browser.");
  }
  if (!moonshineReady()) {
    throw new Error(
      "Moonshine needs a cross-origin isolated page (restart the Vite dev server so COOP/COEP credentialless headers apply).",
    );
  }

  const lang = resolveMoonshineLang(opts?.language ?? "auto");
  if (!lang) {
    throw new Error("Moonshine has no model for this language — use browser speech.");
  }
  opts?.onStatus?.(`Loading Moonshine (${lang})…`);
  const finals: string[] = [];
  let interim = "";

  const publish = (isFinal: boolean) => {
    const body = [...finals, interim].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    onText(body, isFinal);
  };

  // Tiny streaming is English-oriented; other STT languages use the default streaming arch.
  const mic = new MicTranscriber().language(lang);
  if (lang === "en") mic.modelArch(ModelArch.TinyStreaming);

  mic
    .onProgress((fraction, file) => {
      opts?.onProgress?.(fraction, file);
      if (fraction < 1) {
        opts?.onStatus?.(
          `Downloading Moonshine (${lang})… ${Math.round(fraction * 100)}%${file ? ` (${file})` : ""}`,
        );
      }
    })
    .onText((text) => {
      interim = text.trim();
      publish(false);
    })
    .onLine((line) => {
      const t = line.text.trim();
      if (t) finals.push(t);
      interim = "";
      publish(true);
    })
    .onError((err) => {
      opts?.onError?.(err.message || String(err));
    });

  await mic.load();
  try {
    mic.setKeyterms(DUMP_KEYTERMS);
  } catch {
    /* keyterms optional on some builds */
  }
  opts?.onStatus?.(`Listening with Moonshine (${lang})…`);
  await mic.start();

  let stopped = false;
  return {
    backend: "moonshine",
    stop() {
      if (stopped) return;
      stopped = true;
      void mic.stop().finally(() => {
        try {
          mic.close();
        } catch {
          /* already closed */
        }
      });
    },
  };
}
