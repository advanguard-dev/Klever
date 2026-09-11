/** Glyphs that exist in Instrument Serif / Geist so the cipher does not jump fonts. */
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function keepChar(ch: string | undefined) {
  return !ch || ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
}

function glyphAt(index: number, tick: number): string {
  return GLYPHS[(index * 131 + tick * 17 + 7) % GLYPHS.length]!;
}

export const SCRAMBLE_CHAR_CAP = 6000;

export function scrambleDurationMs(charCount: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const n = clamp(charCount, 0, SCRAMBLE_CHAR_CAP);
  return Math.round(clamp(560 + n * 0.55, 680, 1480));
}

/** Encrypt the source, then decrypt into `to` with a left-to-right resolve wave. */
export function scrambleFrame(from: string, to: string, progress: number, tick: number): string {
  const p = clamp(progress, 0, 1);
  if (p >= 1) return to;

  const src = from.length > SCRAMBLE_CHAR_CAP ? from.slice(0, SCRAMBLE_CHAR_CAP) : from;
  const dst = to.length > SCRAMBLE_CHAR_CAP ? to.slice(0, SCRAMBLE_CHAR_CAP) : to;

  const encryptEnd = 0.16;
  if (p < encryptEnd) {
    const intensity = p / encryptEnd;
    let out = "";
    for (let i = 0; i < src.length; i++) {
      const ch = src[i]!;
      if (keepChar(ch)) {
        out += ch;
        continue;
      }
      const flicker = ((i * 13 + tick * 7) % 10) / 10;
      out += flicker < intensity * 0.9 + 0.08 ? glyphAt(i, tick) : ch;
    }
    return out;
  }

  const decryptP = easeOutCubic((p - encryptEnd) / (1 - encryptEnd));
  const len = Math.round(src.length + (dst.length - src.length) * decryptP);
  let out = "";
  for (let i = 0; i < len; i++) {
    const next = dst[i];
    const prev = src[i];
    if (keepChar(next) || (!next && keepChar(prev))) {
      out += next ?? prev ?? "";
      continue;
    }
    const resolveAt = (i / Math.max(len - 1, 1)) * 0.84;
    if (decryptP >= resolveAt + 0.1) out += next ?? "";
    else out += glyphAt(i, tick);
  }
  return out;
}
