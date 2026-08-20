import type { AiSettings } from "@/types";

/** Google AI Studio OpenAI-compatible base (no trailing slash). */
export const GEMINI_OPENAI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai";

/** Current Flash model for new Gemini API keys (2.5 is blocked for new users). */
export const GEMINI_FLASH_MODEL = "gemini-3.6-flash";

export const defaultAi = (): AiSettings => ({
  endpoint: GEMINI_OPENAI_ENDPOINT,
  model: GEMINI_FLASH_MODEL,
  apiKey: "",
});

/** Move empty Ollama / retired Flash defaults to the current Gemini Flash model. */
export function migrateAiSettings(ai: AiSettings): AiSettings {
  const endpoint = (ai.endpoint || "").trim();
  const model = (ai.model || "").trim();
  const key = (ai.apiKey || "").trim();
  const legacyOllama =
    !key &&
    (/localhost:11434/i.test(endpoint) ||
      model === "llama3.2" ||
      /^llama/i.test(model));
  if (legacyOllama) return defaultAi();

  const retiredFlash =
    /^gemini-2\.5-flash$/i.test(model) ||
    /^gemini-2\.0-flash/i.test(model) ||
    /^gemini-2\.5-flash-lite$/i.test(model);

  return {
    endpoint: endpoint || GEMINI_OPENAI_ENDPOINT,
    model: retiredFlash || !model ? GEMINI_FLASH_MODEL : model,
    apiKey: key,
  };
}

export function applyGeminiFlashPreset(ai: AiSettings): AiSettings {
  return {
    ...ai,
    endpoint: GEMINI_OPENAI_ENDPOINT,
    model: GEMINI_FLASH_MODEL,
  };
}

async function chat(settings: AiSettings, system: string, user: string) {
  const key = settings.apiKey.trim();
  if (!key) {
    throw new Error("Add a Gemini API key in Settings.");
  }
  const base = (settings.endpoint || GEMINI_OPENAI_ENDPOINT).replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: settings.model || GEMINI_FLASH_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text || `AI request failed (${res.status})`;
    try {
      const errJson = JSON.parse(text) as { error?: { message?: string } };
      if (errJson.error?.message) detail = errJson.error.message;
    } catch {
      /* keep raw */
    }
    throw new Error(detail);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty model response");
  return content;
}

export type DumpKind = "page" | "reminder" | "event" | "database";

export type DumpDbView = "table" | "board" | "list" | "calendar" | "gallery" | "card";

export interface ProposedRow {
  title: string;
  body: string;
  tags: string[];
  due?: string;
  status?: string;
}

export interface ProposedItem {
  kind: DumpKind;
  title: string;
  body: string;
  tags: string[];
  /** ISO date YYYY-MM-DD for reminders and events */
  due?: string;
  status?: string;
  /** Preferred view when kind is database */
  viewType?: DumpDbView;
  /** Rows to create inside a new database */
  rows?: ProposedRow[];
}

/** @deprecated Prefer ProposedItem */
export type ProposedNote = ProposedItem;

const KINDS = new Set<DumpKind>(["page", "reminder", "event", "database"]);

/** Structural kinds live in `kind` / folder / DB parent — not as tags. */
const STRUCTURAL_TAGS = new Set(["reminder", "event", "project", "page", "database", "note"]);

const MAX_TAGS_PER_ITEM = 2;

/** Lowercase, strip #, collapse whitespace, drop structural noise, merge near-duplicates, cap. */
export function normalizeTags(raw: unknown, max = MAX_TAGS_PER_ITEM): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .map(String)
    .map((t) =>
      t
        .replace(/^#+/, "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter((t) => t && !STRUCTURAL_TAGS.has(t));

  // Merge near-duplicates (e.g. video / videos, shoot / shooting)
  const merged: string[] = [];
  for (const tag of cleaned) {
    const stem = tag.replace(/(?:ing|s)$/i, "");
    const dupIdx = merged.findIndex((m) => {
      const mStem = m.replace(/(?:ing|s)$/i, "");
      return m === tag || mStem === stem || m.startsWith(tag) || tag.startsWith(m);
    });
    if (dupIdx === -1) merged.push(tag);
    else if (tag.length < merged[dupIdx].length) merged[dupIdx] = tag;
  }

  return [...new Set(merged)].slice(0, Math.max(0, max));
}

function asTags(v: unknown): string[] {
  return normalizeTags(v);
}

function asDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

function normalizeRow(raw: unknown): ProposedRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = String(r.title || "").trim();
  if (!title) return null;
  return {
    title,
    body: String(r.body || "").trim(),
    tags: asTags(r.tags),
    due: asDate(r.due),
    status: r.status != null && String(r.status).trim() ? String(r.status).trim() : undefined,
  };
}

export function normalizeProposedItem(raw: unknown): ProposedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  const title = String(n.title || "").trim();
  if (!title) return null;
  let kind = String(n.kind || "page").toLowerCase() as DumpKind;
  if (!KINDS.has(kind)) {
    // Back-compat: untyped objects are pages
    kind = "page";
  }
  const viewRaw = String(n.viewType || n.view || "").toLowerCase();
  const viewType = (
    ["table", "board", "list", "calendar", "gallery", "card"] as DumpDbView[]
  ).includes(viewRaw as DumpDbView)
    ? (viewRaw as DumpDbView)
    : kind === "event"
      ? "calendar"
      : kind === "database"
        ? "table"
        : undefined;

  const rows = Array.isArray(n.rows)
    ? n.rows.map(normalizeRow).filter((r): r is ProposedRow => Boolean(r))
    : undefined;

  return {
    kind,
    title,
    body: String(n.body || "").trim(),
    tags: asTags(n.tags),
    due: asDate(n.due),
    status: n.status != null && String(n.status).trim() ? String(n.status).trim() : undefined,
    viewType,
    rows,
  };
}

export interface DumpResult {
  project: string;
  items: ProposedItem[];
}

export async function brainDump(settings: AiSettings, dump: string): Promise<DumpResult> {
  const today = new Date().toISOString().slice(0, 10);
  const system = `You turn messy brain dumps (often from speech) into a compact, high-signal project for a local markdown vault.
Today's date is ${today}. Resolve relative dates ("tomorrow", "next Tuesday", "vendredi") to YYYY-MM-DD.

Return ONLY a JSON object:
{
  "project": string,   // short folder name (e.g. "Atelier Élodie") — NOT duplicated as a page title
  "items": [ ... ]     // ideally 2–6 items total
}

Each item MUST include "kind":
- "page" — synthesis notes only (strategy, brief, overview, context, decisions). Prefer FEWER pages: usually 1, max 2 unless the dump clearly needs another distinct write-up. NEVER emit a one-line stub page. Each page body MUST be substantial, actionable markdown: use ## headings and bullets where useful (adapt sections to the dump — e.g. Context, Goals / intent, Key details, Decisions, Next steps, Open questions; omit empty sections). Pull concrete facts, names, constraints, and wording from the dump; do not invent. Depth beats breadth: one dense page is better than several thin ones.
- "reminder" — short todos (1–3 lines). Prefer "due". Go into Reminders DB. Keep body brief.
- "event" — dated meetings/shoots/appointments. Require "due" (YYYY-MM-DD). These become calendar events in the app Calendar UI — NEVER vault pages, NEVER a Calendar database. Keep body brief (location/agenda line is enough).
- "database" — ANY list of similar short items (shot types, formats, people, checklist, plans). Put them as "rows", NOT as separate pages. Row bodies stay short (one line or two).

Item shape:
{ "kind": "page"|"reminder"|"event"|"database", "title": string, "body": string, "tags": string[], "due"?: "YYYY-MM-DD", "status"?: string, "viewType"?: "table"|"board"|"list", "rows"?: [{ "title", "body?", "due?", "status?", "tags?" }] }

HARD RULES (anti-spam):
- Do NOT create a page titled the same as "project".
- Do NOT explode one topic into many pages. Example: video shot types → ONE database with rows, not 8 pages.
- Prefer 1 rich overview page + 1 database of related rows + a few reminders/events over many thin pages.
- Max 6 top-level items. Prefer fewer. Quality over quantity.
- Titles short. Body markdown: pages = multi-section and dense; reminders/events/DB rows = short.
- Tags (bridges, not taxonomy): Prefer 0–2 tags for the WHOLE dump, reused on related pages/rows/DBs so they link in the graph. Same few shared theme tags — NOT a unique tag per item, NOT a topic list. Empty tags is fine. Do NOT invent tags for kind ("reminder", "event", "project") — kind already encodes that. Lowercase, no #.
- Keep speaker language (French dump → French text).
- Do NOT create a "Calendar" database. Do NOT turn events into pages.`;
  const raw = await chat(settings, system, dump);
  const json = extractJson(raw);

  // Back-compat: bare array → invent project from first page title
  if (Array.isArray(json)) {
    const items = coerceDumpKinds(
      consolidateDumpItems(
        json.map(normalizeProposedItem).filter((n): n is ProposedItem => Boolean(n)),
      ),
    );
    const project =
      items.find((i) => i.kind === "page")?.title ||
      items[0]?.title ||
      "Brain dump";
    return { project, items: stripProjectClone(project, items) };
  }

  if (!json || typeof json !== "object") throw new Error("Model did not return a dump object");
  const obj = json as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.notes) ? obj.notes : null;
  if (!rawItems) throw new Error("Model did not return items");
  const project =
    String(obj.project || obj.folder || obj.title || "").trim() ||
    "Brain dump";
  const items = stripProjectClone(
    project,
    coerceDumpKinds(
      consolidateDumpItems(rawItems.map(normalizeProposedItem).filter((n): n is ProposedItem => Boolean(n))),
    ),
  );
  return { project, items };
}

/** Drop a page that only duplicates the project folder name. */
function stripProjectClone(project: string, items: ProposedItem[]): ProposedItem[] {
  const p = project.trim().toLowerCase();
  return items.filter((item) => {
    if (item.kind !== "page") return true;
    return item.title.trim().toLowerCase() !== p;
  });
}

/**
 * Model sometimes emits dated meetings as pages or a "Calendar" DB.
 * Coerce those into first-class events (never vault pages).
 */
export function coerceDumpKinds(items: ProposedItem[]): ProposedItem[] {
  const out: ProposedItem[] = [];
  for (const item of items) {
    if (item.kind === "database") {
      const title = item.title.trim().toLowerCase();
      const isCalendarDb =
        title === "calendar" ||
        title === "calendrier" ||
        title === "agenda" ||
        item.viewType === "calendar";
      const rows = item.rows ?? [];
      if (isCalendarDb && rows.length > 0 && rows.every((r) => r.due || !r.body || r.body.length < 200)) {
        for (const row of rows) {
          if (!row.due && !row.title) continue;
          out.push({
            kind: "event",
            title: row.title,
            body: row.body ?? "",
            tags: normalizeTags(row.tags.length ? row.tags : item.tags, 2),
            due: row.due,
          });
        }
        continue;
      }
      out.push({
        ...item,
        viewType: item.viewType === "calendar" ? "table" : item.viewType,
      });
      continue;
    }

    if (item.kind === "page" && item.due && looksLikeEvent(item)) {
      out.push({ ...item, kind: "event" });
      continue;
    }

    out.push(item);
  }
  return out;
}

/** Unstructured stubs under this length may be folded into a database. */
const SHORT_PAGE_BODY = 280;
/** Bodies at or above this length count as substantial write-ups. */
const SUBSTANTIAL_PAGE_BODY = 400;

function looksLikeEvent(item: ProposedItem) {
  if (isSubstantialPage(item)) return false;
  const t = item.title.toLowerCase();
  const eventHint =
    /\b(rdv|réunion|reunion|meeting|call|shoot|tournage|interview|atelier|workshop|demo|démo|appointment|visite|lunch|diner|dîner|café|cafe)\b/i.test(
      t,
    ) ||
    /\b(rdv|réunion|reunion|meeting|call|shoot)\b/i.test(item.body);
  const short = (item.body?.length ?? 0) < SHORT_PAGE_BODY;
  return short && (eventHint || (item.body?.length ?? 0) < 120);
}

/**
 * If the model emitted many short sibling pages, fold them into one database
 * so the vault does not explode with near-duplicate files.
 * Structured / dense pages are preserved (not treated as list stubs).
 */
export function consolidateDumpItems(items: ProposedItem[]): ProposedItem[] {
  if (items.length <= 6) {
    // Still fold clusters of stub pages when there are 4+ of them
    const shortPages = items.filter(
      (i) =>
        i.kind === "page" &&
        (i.body?.length ?? 0) < SHORT_PAGE_BODY &&
        !i.due &&
        !isSubstantialPage(i),
    );
    if (shortPages.length < 4) return items.slice(0, 8);
  }

  const keep: ProposedItem[] = [];
  const fold: ProposedItem[] = [];

  for (const item of items) {
    const shortPage =
      item.kind === "page" &&
      (item.body?.length ?? 0) < SHORT_PAGE_BODY &&
      !item.due &&
      !isSubstantialPage(item);
    if (shortPage) fold.push(item);
    else keep.push(item);
  }

  // Keep up to 2 substantial pages; fold the rest of short pages into a DB
  const pages = keep.filter((i) => i.kind === "page");
  const nonPages = keep.filter((i) => i.kind !== "page");
  const substantial = pages.slice(0, 2);
  const overflowPages = pages.slice(2);
  const toFold = [...fold, ...overflowPages];

  if (toFold.length >= 3) {
    const existingDb = nonPages.find((i) => i.kind === "database");
    const rows = toFold.map((p) => ({
      title: p.title,
      body: p.body,
      tags: p.tags,
      due: p.due,
      status: p.status,
    }));
    if (existingDb && existingDb.kind === "database") {
      existingDb.rows = [...(existingDb.rows ?? []), ...rows];
      return [...substantial, ...nonPages].slice(0, 8);
    }
    nonPages.push({
      kind: "database",
      title: "Items",
      body: "",
      tags: [],
      viewType: "table",
      rows,
    });
    return [...substantial, ...nonPages].slice(0, 8);
  }

  return [...substantial, ...overflowPages, ...fold, ...nonPages].slice(0, 8);
}

/** True when a page looks like a real write-up (not a list stub to fold into a DB). */
function isSubstantialPage(item: ProposedItem) {
  const body = item.body ?? "";
  if (body.length >= SUBSTANTIAL_PAGE_BODY) return true;
  const t = item.title.toLowerCase();
  if (
    /strat|brief|overview|plan|synthèse|synthese|strategie|stratégie|contexte|context|notes|décision|decision/.test(
      t,
    )
  ) {
    return true;
  }
  const headings = body.match(/^#{1,3}\s+/gm)?.length ?? 0;
  const bullets = body.match(/^[-*+]\s+/gm)?.length ?? 0;
  if (headings >= 2) return true;
  if (headings >= 1 && bullets >= 3) return true;
  if (bullets >= 6 && body.length >= 180) return true;
  return false;
}

export const DEFAULT_WRITING_SYSTEM_PROMPT = `You are a precise writing tool for a markdown notes app.
Return ONLY the rewritten markdown. No preamble. Preserve [[wikilinks]] and #tags unless asked otherwise.`;

export function writingSystemPrompt(settings: AiSettings): string {
  return settings.writingSystemPrompt?.trim() || DEFAULT_WRITING_SYSTEM_PROMPT;
}

export function writingInstruction(settings: AiSettings, toolId: string, fallback: string): string {
  return settings.writingPrompts?.[toolId]?.trim() || fallback;
}

export async function rewrite(
  settings: AiSettings,
  text: string,
  instruction: string,
) {
  const system = writingSystemPrompt(settings);
  return chat(settings, system, `${instruction}\n\n---\n${text}`);
}

export const WRITING_TOOLS: { id: string; label: string; instruction: string }[] = [
  { id: "correct", label: "Correct", instruction: "Fix spelling, grammar, and punctuation. Keep the voice." },
  { id: "clarify", label: "Clarify", instruction: "Make this clearer and tighter without losing meaning." },
  { id: "shorten", label: "Shorten", instruction: "Cut this to the essential lines. Keep markdown structure." },
  {
    id: "expand",
    label: "Expand",
    instruction:
      "Expand with concrete detail and clear structure (headings and bullets where helpful). Stay focused — no filler.",
  },
  { id: "formal", label: "Formal", instruction: "Rewrite in a calm, formal register." },
  { id: "plain", label: "Plain", instruction: "Rewrite in plain, direct language." },
];

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced?.[1] ?? text;
  const start = src.search(/[[{]/);
  if (start < 0) throw new Error("No JSON in response");
  return JSON.parse(src.slice(start));
}

export function heuristicDump(dump: string): ProposedItem[] {
  const chunks = dump
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (!chunks.length) return [];
  return chunks.map((chunk) => {
    const lines = chunk.split("\n");
    const title = lines[0].replace(/^#+\s*/, "").slice(0, 80) || "Untitled";
    const tags = [...chunk.matchAll(/#([A-Za-z][\w-/]*)/g)].map((m) => m[1]);
    const body = lines.length > 1 ? lines.slice(1).join("\n").trim() : chunk;
    return { kind: "page" as const, title, body, tags: normalizeTags(tags) };
  });
}

export const DUMP_KIND_LABEL: Record<DumpKind, string> = {
  page: "Page",
  reminder: "Reminder",
  event: "Event",
  database: "Database",
};
