import { aiChat, isAbort, parseAiJson, type AiCallOpts } from "@/lib/ai";
import { nid } from "@/lib/ids";
import { applyOutsideCode } from "@/lib/parse";
import type { AiSettings, Note } from "@/types";

export const PRESENT_TEMPLATE_IDS = [
  "folio",
  "lecture",
  "chalk",
  "atlas",
  "signal",
  "vellum",
] as const;

export type PresentTemplateId = (typeof PRESENT_TEMPLATE_IDS)[number];
export type PresentRatio = "16:9" | "4:3" | "16:10";
export type PresentDensity = "sparse" | "balanced" | "dense";
export type PresentAlign = "left" | "center";
export type PresentOrigin = "outline" | "ai";

export type PresentSlideKind =
  | "title"
  | "section"
  | "bullets"
  | "quote"
  | "statement"
  | "split"
  | "figure"
  | "closing";

export interface PresentSlide {
  id: string;
  kind: PresentSlideKind;
  kicker?: string;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  quote?: string;
  attribution?: string;
  image?: string;
}

export interface PresentDeck {
  noteId: string;
  fingerprint: string;
  origin: PresentOrigin;
  slides: PresentSlide[];
  generatedAt: string;
}

export interface PresentPrefs {
  template: PresentTemplateId;
  ratio: PresentRatio;
  density: PresentDensity;
  align: PresentAlign;
  showNumbers: boolean;
  showProgress: boolean;
  footer: boolean;
}

export const PRESENT_RATIOS: Record<PresentRatio, string> = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "16:10": "16 / 10",
};

export const PRESENT_BULLET_CAP: Record<PresentDensity, number> = {
  sparse: 3,
  balanced: 5,
  dense: 8,
};

export const DEFAULT_PRESENT_PREFS: PresentPrefs = {
  template: "folio",
  ratio: "16:9",
  density: "balanced",
  align: "left",
  showNumbers: true,
  showProgress: true,
  footer: true,
};

const PREFS_KEY = "klever.presentPrefs";
const DECK_KEY = "klever.presentDeck";

const SLIDE_KINDS = new Set<PresentSlideKind>([
  "title",
  "section",
  "bullets",
  "quote",
  "statement",
  "split",
  "figure",
  "closing",
]);

type MdBlock =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "img"; src: string; alt: string }
  | { type: "hr" };

export function isPresentTemplateId(v: unknown): v is PresentTemplateId {
  return typeof v === "string" && (PRESENT_TEMPLATE_IDS as readonly string[]).includes(v);
}

export function deckFingerprint(note: Pick<Note, "id" | "title" | "body">, density: PresentDensity) {
  return `${note.id}\n${density}\n${note.title}\n${note.body}`;
}

export function loadPresentPrefs(): PresentPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PRESENT_PREFS };
    const p = JSON.parse(raw) as Partial<PresentPrefs>;
    return {
      template: isPresentTemplateId(p.template) ? p.template : DEFAULT_PRESENT_PREFS.template,
      ratio: p.ratio === "4:3" || p.ratio === "16:10" || p.ratio === "16:9" ? p.ratio : "16:9",
      density:
        p.density === "sparse" || p.density === "dense" || p.density === "balanced" ? p.density : "balanced",
      align: p.align === "center" || p.align === "left" ? p.align : "left",
      showNumbers: p.showNumbers !== false,
      showProgress: p.showProgress !== false,
      footer: p.footer !== false,
    };
  } catch {
    return { ...DEFAULT_PRESENT_PREFS };
  }
}

export function savePresentPrefs(prefs: PresentPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function loadCachedDeck(noteId: string): PresentDeck | null {
  try {
    const raw = localStorage.getItem(`${DECK_KEY}.${noteId}`);
    if (!raw) return null;
    const deck = JSON.parse(raw) as Partial<PresentDeck>;
    if (!deck || deck.noteId !== noteId || !Array.isArray(deck.slides)) return null;
    const slides = deck.slides.map(normalizeSlide).filter((s): s is PresentSlide => Boolean(s));
    if (!slides.length) return null;
    return {
      noteId,
      fingerprint: typeof deck.fingerprint === "string" ? deck.fingerprint : "",
      origin: deck.origin === "ai" ? "ai" : "outline",
      slides,
      generatedAt: typeof deck.generatedAt === "string" ? deck.generatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveCachedDeck(deck: PresentDeck) {
  try {
    localStorage.setItem(`${DECK_KEY}.${deck.noteId}`, JSON.stringify(deck));
  } catch {
    /* ignore */
  }
}

export function deckFromNote(note: Note, density: PresentDensity): PresentDeck {
  return {
    noteId: note.id,
    fingerprint: deckFingerprint(note, density),
    origin: "outline",
    slides: slidesFromMarkdown(note, density),
    generatedAt: new Date().toISOString(),
  };
}

export async function polishDeckWithAi(
  settings: AiSettings,
  note: Note,
  density: PresentDensity,
  opts?: AiCallOpts,
): Promise<PresentDeck> {
  const cap = PRESENT_BULLET_CAP[density];
  const target =
    density === "sparse" ? "8–14" : density === "dense" ? "12–22" : "10–18";
  const raw = await aiChat(
    settings,
    [
      "You turn a markdown note into a spoken keynote. Return JSON only.",
      'Shape: {"slides":[{...}]}',
      "Each slide: kind, title, and optional kicker, subtitle, body, bullets, quote, attribution, image.",
      'kind is one of: title, section, bullets, quote, statement, split, figure, closing.',
      "Rules:",
      "- Do not invent facts, numbers, names, or images that are not in the note.",
      "- Condense. One idea per slide. Short titles. No markdown in fields.",
      `- Density is ${density}: about ${target} slides, at most ${cap} bullets on a bullets slide.`,
      "- Start with a title slide. End with a closing slide when the note has a conclusion or next step.",
      "- Use section slides for major headings with no supporting points.",
      "- statement is a single sentence with no bullets.",
      "- split is a title plus a short body paragraph.",
      "- figure.image must be a path already in the note (markdown image src).",
      "- Preserve the author's language. Do not translate.",
    ].join("\n"),
    `Title: ${note.title || "Untitled"}\nDensity: ${density}\n\n${note.body.slice(0, 24_000)}`,
    "writing",
    { ...opts, temperature: 0.35 },
  );
  const slides = slidesFromAi(raw, note);
  if (!slides.length) throw new Error("DeepSeek returned an empty deck.");
  return {
    noteId: note.id,
    fingerprint: deckFingerprint(note, density),
    origin: "ai",
    slides,
    generatedAt: new Date().toISOString(),
  };
}

export { isAbort };

export function slidesFromMarkdown(note: Note, density: PresentDensity): PresentSlide[] {
  const cap = PRESENT_BULLET_CAP[density];
  const blocks = parseBlocks(note.body);
  const slides: PresentSlide[] = [];
  const kicker = note.tags.slice(0, 3).map((t) => `#${t}`).join("  ");

  const firstPara = blocks.find((b) => b.type === "p")?.text;
  slides.push(
    makeSlide({
      kind: "title",
      kicker: kicker || undefined,
      title: note.title.trim() || "Untitled",
      subtitle: firstPara && firstPara.length <= (density === "dense" ? 220 : 140) ? firstPara : undefined,
    }),
  );

  let pending: {
    kind: PresentSlideKind;
    kicker?: string;
    title: string;
    bullets: string[];
    body: string[];
    quote?: string;
    image?: string;
    alt?: string;
  } | null = null;

  const flush = () => {
    if (!pending) return;
    const slide = pendingToSlide(pending, cap);
    if (slide) slides.push(slide);
    pending = null;
  };

  for (const block of blocks) {
    if (block.type === "hr") {
      flush();
      continue;
    }
    if (block.type === "h") {
      flush();
      pending = {
        kind: block.level === 1 ? "section" : "split",
        title: block.text,
        bullets: [],
        body: [],
      };
      continue;
    }
    if (block.type === "img") {
      if (pending && !pending.image && !pending.bullets.length && pending.body.length === 0) {
        pending.kind = "figure";
        pending.image = block.src;
        pending.alt = block.alt;
        continue;
      }
      flush();
      slides.push(
        makeSlide({
          kind: "figure",
          title: block.alt || pending?.title || note.title || "Untitled",
          image: block.src,
          subtitle: block.alt || undefined,
        }),
      );
      continue;
    }
    if (block.type === "quote") {
      if (pending && !pending.quote && !pending.bullets.length && pending.body.length === 0) {
        pending.kind = "quote";
        pending.quote = block.text;
        continue;
      }
      flush();
      const split = splitQuote(block.text);
      slides.push(
        makeSlide({
          kind: "quote",
          title: "",
          quote: split.quote,
          attribution: split.attribution,
        }),
      );
      continue;
    }
    if (block.type === "ul" || block.type === "ol") {
      if (!pending) {
        pending = { kind: "bullets", title: note.title.trim() || "Untitled", bullets: [], body: [] };
      }
      pending.kind = "bullets";
      for (const item of block.items) {
        if (pending.bullets.length >= cap) {
          flush();
          pending = {
            kind: "bullets",
            title: slides.at(-1)?.title || note.title.trim() || "Untitled",
            bullets: [],
            body: [],
          };
        }
        pending.bullets.push(item);
      }
      continue;
    }
    if (block.type === "p") {
      if (!pending) {
        const asStatement = density === "sparse" || block.text.length <= 110;
        slides.push(
          makeSlide({
            kind: asStatement ? "statement" : "split",
            title: asStatement ? block.text : note.title.trim() || "Untitled",
            body: asStatement ? undefined : block.text,
          }),
        );
        continue;
      }
      if (pending.kind === "section" || pending.kind === "split") {
        pending.body.push(block.text);
        if (density === "sparse" && pending.body.join(" ").length > 180) {
          flush();
        } else if (density !== "dense" && pending.body.join(" ").length > 360) {
          flush();
        }
        continue;
      }
      if (pending.kind === "bullets" && pending.bullets.length === 0) {
        pending.body.push(block.text);
        continue;
      }
      flush();
      slides.push(
        makeSlide({
          kind: block.text.length <= 110 ? "statement" : "split",
          title: block.text.length <= 110 ? block.text : pending?.title || note.title.trim() || "Untitled",
          body: block.text.length <= 110 ? undefined : block.text,
        }),
      );
    }
  }
  flush();

  if (slides.length === 1 && firstPara && slides[0].subtitle === firstPara) {
    /* title-only page is fine */
  } else if (slides.length === 1 && note.body.trim()) {
    const leftover = inlinePlain(note.body).slice(0, 280);
    if (leftover && leftover !== slides[0].title) {
      slides.push(makeSlide({ kind: "statement", title: leftover }));
    }
  }

  const last = slides.at(-1);
  if (slides.length >= 3 && last && last.kind !== "closing" && last.kind !== "title") {
    const looksLikeEnd = /^(thanks|thank you|next|close|fin|end|conclusion|wrap)\b/i.test(last.title);
    if (looksLikeEnd) last.kind = "closing";
  }

  return slides.slice(0, 40);
}

function pendingToSlide(
  pending: {
    kind: PresentSlideKind;
    kicker?: string;
    title: string;
    bullets: string[];
    body: string[];
    quote?: string;
    image?: string;
    alt?: string;
  },
  cap: number,
): PresentSlide | null {
  if (pending.image) {
    return makeSlide({
      kind: "figure",
      title: pending.title,
      subtitle: pending.alt,
      image: pending.image,
    });
  }
  if (pending.quote) {
    const split = splitQuote(pending.quote);
    return makeSlide({
      kind: "quote",
      title: pending.title,
      quote: split.quote,
      attribution: split.attribution,
    });
  }
  if (pending.bullets.length) {
    return makeSlide({
      kind: "bullets",
      title: pending.title,
      bullets: pending.bullets.slice(0, cap),
      body: pending.body.length ? pending.body.join(" ") : undefined,
    });
  }
  const body = pending.body.join(" ").trim();
  if (!pending.title && !body) return null;
  if (!body) {
    return makeSlide({ kind: pending.kind === "section" ? "section" : "statement", title: pending.title });
  }
  if (body.length <= 110 && !pending.title) {
    return makeSlide({ kind: "statement", title: body });
  }
  return makeSlide({
    kind: pending.kind === "section" ? "split" : "split",
    title: pending.title,
    body,
  });
}

function makeSlide(partial: Omit<PresentSlide, "id">): PresentSlide {
  return { id: nid(8), ...partial, title: (partial.title || "").trim() };
}

function parseBlocks(body: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (trimmed.startsWith("```")) {
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) i += 1;
      i += 1;
      continue;
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length as 1 | 2 | 3, text: inlinePlain(heading[2]) });
      i += 1;
      continue;
    }
    const img = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
    if (img) {
      blocks.push({ type: "img", alt: inlinePlain(img[1]), src: img[2].trim() });
      i += 1;
      continue;
    }
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        quoteLines.push(lines[i]!.replace(/^\s*>\s?/, ""));
        i += 1;
      }
      const text = inlinePlain(quoteLines.join(" ").replace(/^\[![^\]]+\]\s*/, ""));
      if (text) blocks.push({ type: "quote", text });
      continue;
    }
    const ul = trimmed.match(/^[-*+]\s+(.+)/);
    const ol = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (ul || ol) {
      const items: string[] = [];
      const ordered = Boolean(ol);
      while (i < lines.length) {
        const row = lines[i]!.trim();
        const m = ordered ? row.match(/^\d+[.)]\s+(.+)/) : row.match(/^[-*+]\s+(.+)/);
        if (!m) break;
        const task = m[1].replace(/^\[[ xX]\]\s+/, "");
        items.push(inlinePlain(task));
        i += 1;
      }
      if (items.length) blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const row = lines[i] ?? "";
      const t = row.trim();
      if (!t) break;
      if (
        t.startsWith("#") ||
        t.startsWith(">") ||
        t.startsWith("```") ||
        t.startsWith("![") ||
        /^[-*+]\s+/.test(t) ||
        /^\d+[.)]\s+/.test(t) ||
        /^---+$/.test(t)
      ) {
        break;
      }
      para.push(t);
      i += 1;
    }
    const text = inlinePlain(para.join(" "));
    if (text) blocks.push({ type: "p", text });
  }
  return blocks;
}

function inlinePlain(raw: string) {
  return applyOutsideCode(raw, (chunk) =>
    chunk
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) =>
        (alias || target).trim(),
      )
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/^>\s*/gm, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function splitQuote(text: string) {
  const m = text.match(/^(.*?)\s*[—–-]\s+(.+)$/);
  if (m && m[1].length > 12) return { quote: m[1].trim(), attribution: m[2].trim() };
  return { quote: text, attribution: undefined as string | undefined };
}

function slidesFromAi(raw: string, note: Note): PresentSlide[] {
  let parsed: unknown;
  try {
    parsed = parseAiJson(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { slides?: unknown }).slides)
      ? (parsed as { slides: unknown[] }).slides
      : [];
  const allowedImages = new Set(
    [...note.body.matchAll(/!\[[^\]]*]\(([^)\s]+)/g)].map((m) => m[1]),
  );
  const slides: PresentSlide[] = [];
  for (const item of list) {
    const slide = normalizeSlide(item);
    if (!slide) continue;
    if (slide.image && !allowedImages.has(slide.image)) delete slide.image;
    slides.push(slide);
  }
  if (!slides.length) return [];
  if (slides[0].kind !== "title") {
    slides.unshift(
      makeSlide({
        kind: "title",
        title: note.title.trim() || slides[0].title || "Untitled",
      }),
    );
  }
  return slides.slice(0, 40);
}

function normalizeSlide(raw: unknown): PresentSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = typeof o.kind === "string" && SLIDE_KINDS.has(o.kind as PresentSlideKind)
    ? (o.kind as PresentSlideKind)
    : inferKind(o);
  const title = asText(o.title) || asText(o.heading) || "";
  const quote = asText(o.quote);
  const bullets = asStringList(o.bullets ?? o.points);
  if (!title && !quote && !bullets.length && !asText(o.body) && !asText(o.image)) return null;
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : nid(8),
    kind,
    kicker: asText(o.kicker) || undefined,
    title,
    subtitle: asText(o.subtitle) || undefined,
    body: asText(o.body) || undefined,
    bullets: bullets.length ? bullets : undefined,
    quote: quote || undefined,
    attribution: asText(o.attribution) || asText(o.cite) || undefined,
    image: asText(o.image) || asText(o.src) || undefined,
  };
}

function inferKind(o: Record<string, unknown>): PresentSlideKind {
  if (asText(o.quote)) return "quote";
  if (asText(o.image) || asText(o.src)) return "figure";
  if (asStringList(o.bullets ?? o.points).length) return "bullets";
  if (asText(o.body) && asText(o.title)) return "split";
  if (String(o.kind || "").toLowerCase().includes("close")) return "closing";
  if (String(o.kind || "").toLowerCase().includes("section")) return "section";
  return asText(o.body) ? "split" : "statement";
}

function asText(v: unknown) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function asStringList(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.map(asText).filter(Boolean).slice(0, 8);
}
