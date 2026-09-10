import type { AiSettings, Note, PropType, SchemaProp } from "@/types";
import { asChipValues, inferredNameType } from "@/lib/prop-schema";
import { readUsage, recordAiSpend } from "@/lib/ai-cost";
import { parseLocale } from "@/lib/i18n";

/** Google AI Studio OpenAI-compatible base (no trailing slash). */
export const GEMINI_OPENAI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai";

/** Current Flash model for new Gemini API keys (2.5 is blocked for new users). */
export const GEMINI_FLASH_MODEL = "gemini-3.6-flash";

export type AiChatTool = "writing" | "brainDump" | "meeting" | "suggestions" | "grammar";

export const defaultAi = (): AiSettings => ({
  endpoint: GEMINI_OPENAI_ENDPOINT,
  model: GEMINI_FLASH_MODEL,
  writingModel: GEMINI_FLASH_MODEL,
  brainDumpModel: GEMINI_FLASH_MODEL,
  meetingModel: GEMINI_FLASH_MODEL,
  apiKey: "",
});

function isRetiredFlash(model: string) {
  return (
    /^gemini-2\.5-flash$/i.test(model) ||
    /^gemini-2\.0-flash/i.test(model) ||
    /^gemini-2\.5-flash-lite$/i.test(model)
  );
}

function migrateModelId(raw: string | undefined, fallback: string) {
  const model = (raw || "").trim();
  if (!model || isRetiredFlash(model)) return fallback;
  return model;
}

export function resolveAiModel(ai: AiSettings, tool: AiChatTool): string {
  const specific =
    tool === "brainDump"
      ? ai.brainDumpModel
      : tool === "meeting"
        ? ai.meetingModel
        : // writing, suggestions and grammar all ride the writing model.
          ai.writingModel;
  return migrateModelId(specific, migrateModelId(ai.model, GEMINI_FLASH_MODEL));
}

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

  const fallback = migrateModelId(model, GEMINI_FLASH_MODEL);

  const writingPrompts = Object.fromEntries(
    Object.entries(ai.writingPrompts ?? {}).filter(([, v]) => typeof v === "string" && v.trim()),
  );

  const locale = parseLocale(ai.locale);
  return {
    endpoint: endpoint || GEMINI_OPENAI_ENDPOINT,
    model: fallback,
    writingModel: migrateModelId(ai.writingModel, fallback),
    brainDumpModel: migrateModelId(ai.brainDumpModel, fallback),
    meetingModel: migrateModelId(ai.meetingModel, fallback),
    apiKey: key,
    ...(ai.writingSystemPrompt?.trim()
      ? { writingSystemPrompt: ai.writingSystemPrompt.trim() }
      : {}),
    ...(Object.keys(writingPrompts).length ? { writingPrompts } : {}),
    ...(ai.lastCustomPrompt?.trim() ? { lastCustomPrompt: ai.lastCustomPrompt } : {}),
    ...(locale ? { locale } : {}),
  };
}

export function applyGeminiFlashPreset(ai: AiSettings): AiSettings {
  return {
    ...ai,
    endpoint: GEMINI_OPENAI_ENDPOINT,
    model: GEMINI_FLASH_MODEL,
    writingModel: GEMINI_FLASH_MODEL,
    brainDumpModel: GEMINI_FLASH_MODEL,
    meetingModel: GEMINI_FLASH_MODEL,
  };
}

export type AiCallOpts = {
  /** Abort the request when the caller loses interest (page switch, retrigger). */
  signal?: AbortSignal;
  /** Override sampling temperature. Extraction tasks want this near zero. */
  temperature?: number;
};

/** Thrown when a call is cancelled. Callers should swallow this silently. */
export class AiAbortError extends Error {
  constructor() {
    super("AI request cancelled.");
    this.name = "AiAbortError";
  }
}

export function isAbort(err: unknown): boolean {
  return (
    err instanceof AiAbortError ||
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

async function chat(
  settings: AiSettings,
  system: string,
  user: string,
  tool: AiChatTool,
  opts?: AiCallOpts,
) {
  const key = settings.apiKey.trim();
  if (!key) {
    throw new Error("Add a Gemini API key in Settings.");
  }
  if (opts?.signal?.aborted) throw new AiAbortError();
  const base = (settings.endpoint || GEMINI_OPENAI_ENDPOINT).replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const model = resolveAiModel(settings, tool);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: opts?.signal,
      body: JSON.stringify({
        model,
        temperature: opts?.temperature ?? 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (err) {
    if (isAbort(err)) throw new AiAbortError();
    throw err;
  }
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
  const usage = readUsage(json);
  if (usage) recordAiSpend(tool, usage, model, settings.endpoint);
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Gemini returned nothing. Try again.");
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
  const raw = await chat(settings, system, dump, "brainDump");
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

  if (!json || typeof json !== "object") throw new Error("Gemini did not return a dump. Try again.");
  const obj = json as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.notes) ? obj.notes : null;
  if (!rawItems) throw new Error("Gemini did not return items. Try again.");
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

/** JSON shape writing tools must return so title + PropertyStrip fields can be patched. */
export const WRITING_STRUCTURED_FORMAT = `Return ONLY a JSON object:
{
  "title": string,
  "properties": object,
  "body": string
}

"body" is the rewritten markdown (the selection if one was provided, otherwise the full page). No preamble outside JSON.
Set "title" to a concise page title inferred from the text. Keep the current title when it already fits.
"properties" maps field keys or names to values. Fill existing schema fields when the text implies them. You may add a few new properties when the content clearly warrants them (dates, people, location, status, links, amounts, checkboxes). Use short labels like "Due", "Status", "Participants", "Lieu", "URL". At most 8 new fields. Skip empty, generic, or uncertain fields. Use ISO dates (YYYY-MM-DD), booleans for checkboxes, numbers for amounts, string arrays of names/emails for people (attendees, participants — never hashtag tags), string arrays of place parts for location/lieu/venue/address (venue then city, no #), and string arrays for topical tags only.`;

export const DEFAULT_WRITING_SYSTEM_PROMPT = `You are a precise writing tool for a markdown notes app.

${WRITING_STRUCTURED_FORMAT}

Preserve [[wikilinks]] and #tags unless asked otherwise.`;

export function writingSystemPrompt(settings: AiSettings): string {
  return settings.writingSystemPrompt?.trim() || DEFAULT_WRITING_SYSTEM_PROMPT;
}

export function writingInstruction(settings: AiSettings, toolId: string, fallback: string): string {
  return settings.writingPrompts?.[toolId]?.trim() || fallback;
}

export interface WritingRewriteContext {
  title?: string;
  schema?: Pick<SchemaProp, "key" | "name" | "type" | "options">[];
  selected?: boolean;
}

export interface WritingRewriteResult {
  body: string;
  title?: string;
  properties?: Record<string, unknown>;
}

export function promptAsksForStructuredWriting(text: string): boolean {
  const t = text.toLowerCase();
  const hasJson = t.includes("json");
  const hasTitle = t.includes("title");
  const hasProps = t.includes("properties") || t.includes('"props"') || /\bprops\b/.test(t);
  const hasBody = t.includes("body") || t.includes("markdown");
  return hasJson && hasTitle && hasProps && hasBody;
}

function formatWritingContext(ctx?: WritingRewriteContext): string {
  const lines: string[] = [];
  const title = ctx?.title?.trim();
  if (title) lines.push(`Current page title: ${title}`);
  const schema = ctx?.schema ?? [];
  if (!schema.length) {
    lines.push(
      'Page schema: none. Propose short-label properties in "properties" when the content warrants them (dates, people, location, status, links). Attendees/participants → people (names/emails, not tags). Lieu/venue/address → location (not tags).',
    );
  } else {
    lines.push("Page schema (fill these when implied):");
    for (const s of schema) {
      const opts = s.options?.length ? ` [${s.options.join(", ")}]` : "";
      lines.push(`- ${s.key} (${s.name}): ${s.type}${opts}`);
    }
    lines.push(
      "You may add further short-label properties when the content clearly warrants them.",
    );
  }
  if (ctx?.selected) {
    lines.push(
      'The source below is a text selection. Put the rewritten selection in "body" (not the whole page). Title and properties still apply to the page when the selection implies them.',
    );
  }
  return lines.join("\n");
}

export async function rewrite(
  settings: AiSettings,
  text: string,
  instruction: string,
  ctx?: WritingRewriteContext,
): Promise<WritingRewriteResult> {
  let system = writingSystemPrompt(settings);
  if (!promptAsksForStructuredWriting(`${system}\n${instruction}`)) {
    system = `${system.trim()}\n\n${WRITING_STRUCTURED_FORMAT}`;
  }
  const header = formatWritingContext(ctx);
  const user = [header, instruction, "---", text].filter((s) => s.trim()).join("\n\n");
  const raw = await chat(settings, system, user, "writing");
  const parsed = parseWritingRewrite(raw);
  if (!parsed.body.trim()) return { ...parsed, body: text };
  return parsed;
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

const WRITING_BODY_KEYS = ["body", "markdown", "content", "text", "notes"];
const WRITING_TITLE_KEYS = ["title", "name", "heading"];
const WRITING_PROP_BAG_KEYS = ["properties", "props", "fields"];

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const hit = Object.entries(obj).find(([k]) => k.toLowerCase() === key);
    const v = hit?.[1];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function asPropMap(v: unknown): Record<string, unknown> | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) {
    const out: Record<string, unknown> = {};
    for (const item of v) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const k = String(row.key || row.name || row.field || "").trim();
      if (!k) continue;
      out[k] = row.value ?? row.val;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return Object.keys(obj).length ? obj : undefined;
  }
  return undefined;
}

function headingTitle(body: string): string | undefined {
  const m = body.match(/^#\s+(.+)/);
  const title = m?.[1]?.trim();
  return title || undefined;
}

function stripMatchingHeading(body: string, title?: string): string {
  if (!title) return body;
  const m = body.match(/^#\s+(.+)\n*/);
  if (m && m[1].trim() === title.trim()) return body.slice(m[0].length);
  return body;
}

function fromWritingObject(obj: Record<string, unknown>): WritingRewriteResult {
  let title = firstString(obj, WRITING_TITLE_KEYS);
  let body = firstString(obj, WRITING_BODY_KEYS) ?? "";
  let properties = asPropMap(
    obj.properties ?? obj.props ?? obj.fields ?? obj.property,
  );

  const reserved = new Set(
    [...WRITING_TITLE_KEYS, ...WRITING_BODY_KEYS, ...WRITING_PROP_BAG_KEYS, "schema", "property"].map((k) =>
      k.toLowerCase(),
    ),
  );
  if (!properties) {
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (reserved.has(k.toLowerCase())) continue;
      extra[k] = v;
    }
    if (Object.keys(extra).length) properties = extra;
  }

  if (!title) title = headingTitle(body);
  body = stripMatchingHeading(body, title);

  return {
    body,
    ...(title ? { title } : {}),
    ...(properties && Object.keys(properties).length ? { properties } : {}),
  };
}

const WRITING_KV_LINE = /^([A-Za-z][\w\s/-]{0,40}):\s+(.+)$/;

function fromWritingMarkdown(text: string): WritingRewriteResult {
  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";
  const headingStart = first.match(/^#\s+(.+)$/);
  if (headingStart) {
    const title = headingStart[1].trim();
    return { body: stripMatchingHeading(text, title), ...(title ? { title } : {}) };
  }

  const firstKv = first.match(WRITING_KV_LINE);
  const looksPreamble = Boolean(firstKv && /^(title|name|heading)$/i.test(firstKv[1].trim()));
  if (!looksPreamble) return { body: text };

  const properties: Record<string, unknown> = {};
  let title: string | undefined;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      break;
    }
    const heading = line.match(/^#\s+(.+)$/);
    if (heading) {
      if (!title) title = heading[1].trim();
      i += 1;
      break;
    }
    const kv = line.match(WRITING_KV_LINE);
    if (!kv) break;
    const key = kv[1].trim();
    const value = kv[2].trim();
    if (/^(title|name|heading)$/i.test(key)) {
      if (!title) title = value;
    } else {
      properties[key] = value;
    }
    i += 1;
  }
  const body = stripMatchingHeading(lines.slice(i).join("\n").replace(/^\n+/, ""), title);
  return {
    body,
    ...(title ? { title } : {}),
    ...(Object.keys(properties).length ? { properties } : {}),
  };
}

/**
 * Pull title, properties, and body from a writing-tool model response.
 * Prefers JSON (`title` / `properties`|`props`|`fields` / `body`); falls back to
 * `Title:` / `Field:` preamble lines and a leading `# heading`.
 */
export function parseWritingRewrite(raw: string): WritingRewriteResult {
  const trimmed = raw.trim();
  if (!trimmed) return { body: "" };
  try {
    const json = extractJson(trimmed);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return fromWritingObject(json as Record<string, unknown>);
    }
  } catch {
    /* plain markdown / preamble */
  }
  return fromWritingMarkdown(trimmed);
}

function coercePropValue(spec: SchemaProp, raw: unknown, notes?: Note[]): unknown {
  if (raw === undefined || raw === null) return undefined;
  if (spec.type === "files" || spec.type === "formula" || spec.type === "rollup") return undefined;

  if (spec.type === "checkbox") {
    if (typeof raw === "boolean") return raw;
    const s = String(raw).trim().toLowerCase();
    if (["true", "yes", "on", "1", "checked"].includes(s)) return true;
    if (["false", "no", "off", "0", "unchecked"].includes(s)) return false;
    return undefined;
  }

  if (spec.type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    return Number.isFinite(n) ? n : undefined;
  }

  if (spec.type === "date") {
    return asDate(raw);
  }

  if (spec.type === "select") {
    const s = String(raw).trim();
    if (!s) return undefined;
    const opts = spec.options ?? [];
    if (!opts.length) return s;
    const hit = opts.find((o) => o.toLowerCase() === s.toLowerCase());
    return hit;
  }

  if (spec.type === "multi_select" || spec.type === "tags") {
    const list = Array.isArray(raw)
      ? raw.map(String)
      : String(raw)
          .split(/[,;]/)
          .map((x) => x.trim());
    const cleaned = list
      .map((t) => t.replace(/^#+/, "").trim())
      .filter(Boolean);
    const opts = spec.options ?? [];
    if (!opts.length) return cleaned.length ? cleaned : undefined;
    const matched = cleaned
      .map((t) => opts.find((o) => o.toLowerCase() === t.toLowerCase()))
      .filter((t): t is string => Boolean(t));
    return matched.length ? [...new Set(matched)] : undefined;
  }

  if (spec.type === "people" || spec.type === "location") {
    const cleaned = asChipValues(raw);
    return cleaned.length ? cleaned : undefined;
  }

  if (spec.type === "relation") {
    const list = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const ids = list
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (!notes?.length) return item;
        const hit =
          notes.find((n) => n.id === item) ||
          notes.find((n) => n.title === item) ||
          notes.find((n) => n.title.toLowerCase() === item.toLowerCase());
        return hit?.id ?? item;
      });
    return ids.length ? ids : undefined;
  }

  const s = String(raw).trim();
  return s || undefined;
}

/** Keep only values that match writable schema fields (by key or display name). */
export function matchWritingProperties(
  raw: Record<string, unknown> | undefined,
  schema: SchemaProp[],
  notes?: Note[],
): Record<string, unknown> {
  if (!raw || !schema.length) return {};
  const writable = schema.filter(
    (s) => !s.hidden && s.type !== "formula" && s.type !== "rollup",
  );
  const byKey = new Map(writable.map((s) => [s.key.toLowerCase(), s]));
  const byName = new Map(writable.map((s) => [s.name.trim().toLowerCase(), s]));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const lower = k.trim().toLowerCase();
    const slug = writingPropKey(k);
    const spec =
      byKey.get(lower) ??
      byName.get(lower) ??
      (slug ? byKey.get(slug) : undefined) ??
      (slug ? byName.get(slug.replace(/_/g, " ")) : undefined);
    if (!spec) continue;
    const coerced = coercePropValue(spec, v, notes);
    if (coerced !== undefined) out[spec.key] = coerced;
  }
  return out;
}

export const MAX_NEW_WRITING_PROPS = 8;

const WRITING_JUNK_LABELS = new Set([
  "property",
  "field",
  "value",
  "data",
  "item",
  "info",
  "misc",
  "other",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "extra",
  "metadata",
  "custom",
  "stuff",
  "thing",
  "content",
  "body",
  "title",
  "markdown",
  "notes",
  "text",
  "schema",
  "props",
  "properties",
  "fields",
  "key",
  "heading",
  "name",
]);

const WRITING_RESERVED_KEYS = new Set(
  [
    ...WRITING_TITLE_KEYS,
    ...WRITING_BODY_KEYS,
    ...WRITING_PROP_BAG_KEYS,
    "schema",
    "property",
    "id",
    "transcript",
    "summary",
    "actions",
    "kleverkind",
    "eventid",
  ].map((k) => k.toLowerCase()),
);

const SELECT_NAME_RE = /\b(status|priority|stage|state|kind|category|severity|mood)\b/i;
const TAGS_NAME_RE = /\b(tags|labels|authors|topics|keywords|assignees)\b/i;
const FLAG_NAME_RE = /\b(done|checked|complete|completed|enabled|paid|published|flag|ok)\b/i;

function writingLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const spaced = t
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^[a-z0-9]+( [a-z0-9]+)+$/i.test(spaced) && spaced === spaced.toLowerCase()) {
    return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (/^[a-z]+$/.test(spaced)) {
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
  return spaced;
}

function writingPropKey(label: string): string {
  return label
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

function uniqueWritingKey(base: string, used: Set<string>): string {
  let key = base || "prop";
  if (/^\d/.test(key)) key = `prop_${key}`;
  if (!used.has(key) && !WRITING_RESERVED_KEYS.has(key)) return key;
  let i = 2;
  while (used.has(`${key}_${i}`) || WRITING_RESERVED_KEYS.has(`${key}_${i}`)) i += 1;
  return `${key}_${i}`;
}

/** Short field labels only — skip sentences and generic junk. */
export function isUsefulWritingLabel(raw: string): boolean {
  const name = writingLabel(raw);
  if (!name) return false;
  if (name.length < 2 || name.length > 40) return false;
  const words = name.split(/\s+/);
  if (words.length > 5) return false;
  if (!/^[A-Za-z]/.test(name)) return false;
  if (/[?]/.test(name) || /[.!]$/.test(name)) return false;
  if (!/^[A-Za-z][A-Za-z0-9 _/-]*$/.test(name)) return false;
  if (WRITING_JUNK_LABELS.has(name.toLowerCase())) return false;
  return true;
}

function isEmptyWritingValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "boolean") return false;
  if (typeof v === "number") return !Number.isFinite(v);
  if (typeof v === "string") return !v.trim();
  if (Array.isArray(v)) return v.length === 0 || v.every((x) => String(x).trim() === "");
  return true;
}

function looksLikeWritingUrl(s: string): boolean {
  if (/^https?:\/\//i.test(s) || /^www\./i.test(s) || /^mailto:/i.test(s)) return true;
  return /^[\w.-]+\.(com|org|net|io|dev|co|app|ai|edu|gov)(\/[\w./?%&=-]*)?$/i.test(s);
}

function looksLikeShortLabel(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 32) return false;
  const words = t.split(/\s+/);
  return words.length <= 3 && !looksLikeWritingUrl(t) && !asDate(t);
}

function asTagList(raw: unknown): string[] | undefined {
  const list = Array.isArray(raw)
    ? raw.map(String)
    : String(raw)
        .split(/[,;]/)
        .map((x) => x.trim());
  const cleaned = list
    .map((t) => t.replace(/^#+/, "").trim())
    .filter(Boolean);
  return cleaned.length ? [...new Set(cleaned)] : undefined;
}

/**
 * Infer a writable schema type from a proposed value (and name hints).
 * Order: checkbox → number → named people/location → tags (arrays) → date → url →
 * number string → select (status-like names) → people/location (names) →
 * tags (lists / list-like names) → text.
 */
export function inferWritingPropType(name: string, raw: unknown): PropType | undefined {
  if (isEmptyWritingValue(raw)) return undefined;
  if (typeof raw === "boolean") return "checkbox";
  if (typeof raw === "number" && Number.isFinite(raw)) return "number";

  const named = inferredNameType(name);
  if (Array.isArray(raw)) {
    if (named) return named;
    return asTagList(raw) ? "tags" : undefined;
  }

  const s = String(raw).trim();
  if (!s) return undefined;

  const flag = ["true", "false", "checked", "unchecked", "on", "off"].includes(s.toLowerCase());
  const yesNo = ["yes", "no"].includes(s.toLowerCase());
  if (flag || (yesNo && FLAG_NAME_RE.test(name))) return "checkbox";

  if (asDate(s)) return "date";
  if (named) return named;
  if (looksLikeWritingUrl(s)) return "url";

  const n = Number(s);
  if (s !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(s)) return "number";

  if (SELECT_NAME_RE.test(name) && looksLikeShortLabel(s)) return "select";

  if (!Array.isArray(raw) && /[,;]/.test(s)) {
    const tags = asTagList(s);
    if (tags && tags.length >= 2 && tags.every((t) => t.length <= 32 && t.split(/\s+/).length <= 4)) {
      return "tags";
    }
  }
  if (TAGS_NAME_RE.test(name)) return "tags";

  return "text";
}

export function proposeWritingProperties(
  raw: Record<string, unknown> | undefined,
  schema: SchemaProp[],
  notes?: Note[],
): { fields: SchemaProp[]; values: Record<string, unknown> } {
  const fields: SchemaProp[] = [];
  const values: Record<string, unknown> = {};
  if (!raw) return { fields, values };

  const usedKeys = new Set(schema.map((s) => s.key.toLowerCase()));
  const usedNames = new Set(schema.map((s) => s.name.trim().toLowerCase()));
  const taken = new Set(schema.map((s) => s.key.toLowerCase()));

  for (const [k, v] of Object.entries(raw)) {
    if (fields.length >= MAX_NEW_WRITING_PROPS) break;
    const trimmed = k.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (usedKeys.has(lower) || usedNames.has(lower)) continue;
    if (WRITING_RESERVED_KEYS.has(lower)) continue;
    if (isEmptyWritingValue(v)) continue;
    if (!isUsefulWritingLabel(trimmed)) continue;

    const name = writingLabel(trimmed);
    const slug = writingPropKey(name) || writingPropKey(trimmed);
    if (usedNames.has(name.toLowerCase()) || (slug && usedKeys.has(slug))) continue;
    const type = inferWritingPropType(name, v);
    if (!type) continue;

    const spec: SchemaProp = {
      key: uniqueWritingKey(writingPropKey(name) || writingPropKey(trimmed), taken),
      name,
      type,
    };
    if (type === "select") {
      const option = String(Array.isArray(v) ? v[0] : v).trim();
      spec.options = option ? [option] : undefined;
    } else if (type === "tags") {
      spec.options = asTagList(v);
    }

    const coerced = coercePropValue(spec, v, notes);
    if (coerced === undefined) continue;

    taken.add(spec.key.toLowerCase());
    usedKeys.add(spec.key.toLowerCase());
    usedNames.add(name.toLowerCase());
    fields.push(spec);
    values[spec.key] = coerced;
  }

  return { fields, values };
}

/** Patch for `patchNote`: title, existing schema props, and newly inferred fields. */
export function writingPagePatch(
  note: Note,
  parsed: WritingRewriteResult,
  schema: SchemaProp[],
  notes?: Note[],
): { patch: Partial<Note>; schemaAdds: SchemaProp[] } | null {
  const patch: Partial<Note> = {};
  const title = parsed.title?.replace(/\s+/g, " ").trim();
  if (title && title !== note.title) patch.title = title;
  const existing = matchWritingProperties(parsed.properties, schema, notes);
  const proposed = proposeWritingProperties(parsed.properties, schema, notes);
  const props = { ...existing, ...proposed.values };
  if (Object.keys(props).length) patch.props = { ...note.props, ...props };
  if (!Object.keys(patch).length && !proposed.fields.length) return null;
  return { patch, schemaAdds: proposed.fields };
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

export interface MeetingActionItem {
  title: string;
  owner?: string;
  due?: string;
}

export interface MeetingNotesResult {
  title: string;
  date?: string;
  attendees: string[];
  summary: string;
  actions: MeetingActionItem[];
}

export interface MeetingAnalyzeOpts {
  title?: string;
  date?: string;
  notes?: string;
  existingTitles?: string[];
}

function asAttendees(v: unknown): string[] {
  const raw =
    typeof v === "string"
      ? v.split(/[,;]/)
      : Array.isArray(v)
        ? v.map(String)
        : [];
  return [...new Set(raw.map((s) => s.trim()).filter(Boolean))].slice(0, 24);
}

function asMeetingActions(v: unknown): MeetingActionItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (typeof item === "string") {
        const title = item.replace(/^\[[ xX]\]\s*/, "").trim();
        return title ? { title } : null;
      }
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title || row.task || row.action || "").trim();
      if (!title) return null;
      const owner = String(row.owner || row.assignee || "").trim();
      const due = asDate(row.due ?? row.date);
      return { title, ...(owner ? { owner } : {}), ...(due ? { due } : {}) };
    })
    .filter((a): a is MeetingActionItem => Boolean(a))
    .slice(0, 20);
}

function actionsFromCheckboxes(md: string): MeetingActionItem[] {
  const out: MeetingActionItem[] = [];
  for (const m of md.matchAll(/^[\s]*[-*+]\s+\[[ xX]\]\s+(.+)$/gm)) {
    const line = m[1].trim();
    if (!line) continue;
    const due = asDate(line.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]);
    out.push({
      title: line.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || line.slice(0, 120),
      ...(due ? { due } : {}),
    });
  }
  return out.slice(0, 20);
}

function actionsFromBullets(md: string): MeetingActionItem[] {
  const out: MeetingActionItem[] = [];
  for (const m of md.matchAll(/^[\s]*[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/gm)) {
    const line = m[1].trim();
    if (!line) continue;
    const due = asDate(line.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]);
    const owner = line.match(/\b(?:owner|assignee)\s*[:—–-]\s*([^,;]+)/i)?.[1]?.trim();
    out.push({
      title: line.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || line.slice(0, 120),
      ...(owner ? { owner } : {}),
      ...(due ? { due } : {}),
    });
  }
  return out.slice(0, 20);
}

function normalizeMeetingNotes(obj: Record<string, unknown>, opts?: MeetingAnalyzeOpts): MeetingNotesResult {
  const today = new Date().toISOString().slice(0, 10);
  const title =
    opts?.title?.trim() ||
    String(obj.title || obj.project || "").trim() ||
    "Untitled";
  const summary = String(obj.summary || obj.notes || obj.body || "").trim();
  let actions = asMeetingActions(obj.actions ?? obj.action_items ?? obj.todos);
  if (!actions.length && summary) actions = actionsFromCheckboxes(summary);
  return {
    title,
    date: asDate(opts?.date) || asDate(obj.date) || today,
    attendees: asAttendees(obj.attendees ?? obj.participants ?? obj.present),
    summary: summary || "No summary.",
    actions,
  };
}

export async function summarizeMeeting(
  settings: AiSettings,
  transcript: string,
  opts?: MeetingAnalyzeOpts,
): Promise<MeetingNotesResult> {
  const today = new Date().toISOString().slice(0, 10);
  const knownTitle = opts?.title?.trim();
  const knownDate = asDate(opts?.date);
  const prep = opts?.notes?.trim();
  const existing = (opts?.existingTitles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 40);
  const system = `You write meeting notes from a transcript and any prep notes the user typed.
Today's date is ${today}. Resolve relative dates ("tomorrow", "next Tuesday") to YYYY-MM-DD.

Return ONLY a JSON object:
{
  "title": string,
  "date": "YYYY-MM-DD",
  "attendees": string[],
  "summary": string,
  "actions": [{ "title": string, "owner"?: string, "due"?: "YYYY-MM-DD" }]
}

The summary is markdown for an AI notes block on the meeting page — not a new vault page.
Typical headings (omit empty ones): Discussion, Decisions, Open questions.
Pull names, dates, numbers, and wording from the source; do not invent.
Actions are concrete next steps only. Include owner and due when stated.
Prefer [[wikilinks]] to existing vault pages listed below; do not recreate them.
Keep speaker language (French transcript → French notes).
Do not invent attendees, decisions, or facts that are not in the source.`;

  const header = [
    knownTitle ? `Meeting title: ${knownTitle}` : "Infer the meeting title.",
    knownDate ? `Meeting date: ${knownDate}` : "Infer the meeting date when stated; otherwise use today.",
    existing.length
      ? `Existing vault pages (wikilink these when relevant):\n${existing.map((t) => `- ${t}`).join("\n")}`
      : "",
    prep ? `User notes (agenda / handwritten — weigh these with the transcript):\n${prep}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await chat(settings, system, `${header}\n\n---\n${transcript || "(no transcript)"}`, "meeting");
  const json = extractJson(raw);
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Gemini did not return meeting notes. Try again.");
  }
  const result = normalizeMeetingNotes(json as Record<string, unknown>, opts);
  if (!result.summary || result.summary === "No summary.") {
    throw new Error("Gemini did not return a summary. Try again.");
  }
  return result;
}

export function heuristicMeetingNotes(source: string, opts?: MeetingAnalyzeOpts): MeetingNotesResult {
  const today = new Date().toISOString().slice(0, 10);
  const text = [opts?.notes, source].filter((s) => s?.trim()).join("\n\n").trim();
  const first = text.split("\n").find((l) => l.trim()) ?? "";
  const heading = first.replace(/^#+\s*/, "").slice(0, 80).trim();
  const title = opts?.title?.trim() || heading || "Untitled";
  const date = asDate(opts?.date) || text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || today;
  const attMatch = text.match(/^\s*(?:attendees|present|participants)\s*[:—–-]\s*(.+)$/im);
  const attendees = attMatch
    ? attMatch[1]
        .split(/[,;&]| and /i)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 24)
    : [];

  const actionRe =
    /(?:^|\n)#{1,3}\s+(?:action items|actions|todos?|next steps|à faire)\b[\s\S]*?(?=\n#{1,3}\s+|\s*$)/i;
  const actionSection = text.match(actionRe)?.[0] ?? "";
  const leftover = actionSection ? text.replace(actionSection, "\n").trim() : text;
  const actions = actionsFromBullets(actionSection || "");

  return {
    title,
    date,
    attendees,
    summary: leftover || text || "No summary.",
    actions,
  };
}

/* ---------------------------------------------------------------------------
   Page suggestions — read the current page and propose vault objects.
   Reuses ProposedItem so results commit through commitProposedItems().
--------------------------------------------------------------------------- */

export type SuggestionKind = "event" | "reminder" | "list";

const SUGGESTION_KINDS = new Set<SuggestionKind>(["event", "reminder", "list"]);

export interface PageSuggestion {
  kind: SuggestionKind;
  /** Ready to hand to commitProposedItems(). */
  item: ProposedItem;
  /** Verbatim line from the page that motivated this, for the review UI. */
  evidence: string;
}

/** Shortest page worth spending a call on. */
export const MIN_SUGGEST_CHARS = 80;

const SUGGEST_SYSTEM = (today: string) => `You read one page from a local markdown vault and propose vault objects the writer clearly implied but has not created yet.
Today's date is ${today}. Resolve relative dates ("tomorrow", "next Tuesday", "vendredi") to YYYY-MM-DD.

Return ONLY a JSON object:
{
  "suggestions": [
    {
      "kind": "event" | "reminder" | "list",
      "title": string,
      "body": string,
      "due": "YYYY-MM-DD",
      "tags": string[],
      "rows": [{ "title": string, "body": string, "due": "YYYY-MM-DD" }],
      "evidence": string
    }
  ]
}

Rules:
- "event" — something happening at a specific date. Requires "due". Never suggest an event without a date.
- "reminder" — an action the writer must take. "due" only when the page states or implies one.
- "list" — three or more comparable items that belong in a structured table. Put them in "rows". Fewer than three items is not a list.
- "evidence" must be a VERBATIM substring copied from the page. Never paraphrase it.
- Precision over recall. Propose nothing rather than something the writer did not mean. An empty array is a correct answer.
- Never restate what the page already is. Suggest only NEW objects.
- Skip anything already written as a completed markdown checkbox.
- At most 6 suggestions, ordered by how clearly the page implies them.
- Keep "title" under 80 characters. Keep "body" to one short sentence or empty.`;

function normalizeSuggestion(raw: unknown): PageSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const kind = String(s.kind || "").toLowerCase() as SuggestionKind;
  if (!SUGGESTION_KINDS.has(kind)) return null;

  // Map the suggestion vocabulary onto the existing dump vocabulary so the
  // commit pipeline needs no changes.
  const item = normalizeProposedItem({
    ...s,
    kind: kind === "list" ? "database" : kind,
    viewType: kind === "list" ? "table" : undefined,
  });
  if (!item) return null;

  // An event with no resolvable date is not actionable.
  if (kind === "event" && !item.due) return null;
  // A list needs enough rows to be worth a database.
  if (kind === "list" && (item.rows?.length ?? 0) < 3) return null;

  return {
    kind,
    item,
    evidence: String(s.evidence || "").trim().slice(0, 240),
  };
}

export async function suggestPageItems(
  settings: AiSettings,
  page: { title: string; body: string },
  opts?: AiCallOpts,
): Promise<PageSuggestion[]> {
  const body = page.body.trim();
  if (body.length < MIN_SUGGEST_CHARS) return [];
  const today = new Date().toISOString().slice(0, 10);
  const user = [`# ${page.title}`.trim(), body].filter(Boolean).join("\n\n");
  const raw = await chat(settings, SUGGEST_SYSTEM(today), user, "suggestions", {
    ...opts,
    temperature: 0,
  });
  const parsed = extractJson(raw) as { suggestions?: unknown };
  const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  const out: PageSuggestion[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    const suggestion = normalizeSuggestion(entry);
    if (!suggestion) continue;
    const dedupe = `${suggestion.kind}:${suggestion.item.title.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(suggestion);
    if (out.length >= 6) break;
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Grammar — structured corrections only.

   The model returns the text to replace, never character offsets: models
   count characters unreliably, and a wrong offset would corrupt the document.
   Offsets are resolved locally in locateGrammarFixes(), which silently drops
   any correction whose "before" text is not actually present on the page.
--------------------------------------------------------------------------- */

export type GrammarCategory = "spelling" | "grammar" | "punctuation" | "style";

const GRAMMAR_CATEGORIES = new Set<GrammarCategory>([
  "spelling",
  "grammar",
  "punctuation",
  "style",
]);

export interface GrammarFix {
  /** Stable within one check — used as a React key and for dismissals. */
  id: string;
  category: GrammarCategory;
  /** Exact source substring to replace. */
  before: string;
  after: string;
  /** Short human reason, e.g. "subject-verb agreement". */
  reason: string;
  /** Character offsets into the source text, resolved locally. */
  from: number;
  to: number;
}

const GRAMMAR_SYSTEM = `You proofread one page from a markdown vault and return only the corrections.

Return ONLY a JSON object:
{
  "fixes": [
    {
      "category": "spelling" | "grammar" | "punctuation" | "style",
      "before": string,
      "after": string,
      "reason": string
    }
  ]
}

Rules:
- NEVER return the corrected page. Return only the spans that change.
- "before" must be a VERBATIM substring of the page, copied exactly, including case and punctuation.
- Keep "before" as short as possible while staying unique enough to locate — usually a word or short phrase, never a whole paragraph.
- List fixes in the order they appear in the page.
- Do not correct inside code blocks, inline code, URLs, wikilinks ([[…]]), or YAML frontmatter.
- Do not change markdown syntax, heading levels, list markers, or intentional style.
- Do not rewrite for taste. Only report clear errors. "style" is for genuine mistakes like doubled words, not preferences.
- Preserve the author's voice, dialect, and terminology. British and American spellings are both correct.
- "reason" is at most 6 words.
- An empty array is a correct answer for clean text.`;

/**
 * Resolve model-reported spans to real offsets in `source`.
 *
 * Scans forward so repeated phrases map to successive occurrences, drops
 * corrections whose text is absent, and drops overlaps so the resulting
 * ranges are safe to use as editor decorations.
 */
export function locateGrammarFixes(
  source: string,
  raw: { category?: unknown; before?: unknown; after?: unknown; reason?: unknown }[],
): GrammarFix[] {
  const out: GrammarFix[] = [];
  let cursor = 0;
  for (const entry of raw) {
    const before = String(entry.before ?? "");
    const after = String(entry.after ?? "");
    if (!before || before === after) continue;

    // Prefer the next occurrence after the last fix; fall back to the first
    // if the model returned fixes out of document order.
    let idx = source.indexOf(before, cursor);
    if (idx < 0) idx = source.indexOf(before);
    if (idx < 0) continue; // not on the page — treat as a hallucination

    const from = idx;
    const to = idx + before.length;
    if (out.length && from < out[out.length - 1].to) continue; // overlapping

    const category = String(entry.category || "grammar").toLowerCase() as GrammarCategory;
    out.push({
      id: `${from}-${to}-${after.slice(0, 24)}`,
      category: GRAMMAR_CATEGORIES.has(category) ? category : "grammar",
      before,
      after,
      reason: String(entry.reason ?? "").trim().slice(0, 60),
      from,
      to,
    });
    cursor = to;
  }
  return out;
}

/** Apply fixes to `source`. Offsets are applied back-to-front so they stay valid. */
export function applyGrammarFixes(source: string, fixes: GrammarFix[]): string {
  let out = source;
  for (const fix of [...fixes].sort((a, b) => b.from - a.from)) {
    if (out.slice(fix.from, fix.to) !== fix.before) continue; // page moved under us
    out = out.slice(0, fix.from) + fix.after + out.slice(fix.to);
  }
  return out;
}

export async function checkGrammar(
  settings: AiSettings,
  source: string,
  opts?: AiCallOpts,
): Promise<GrammarFix[]> {
  const text = source.trim();
  if (!text) return [];
  const raw = await chat(settings, GRAMMAR_SYSTEM, source, "grammar", {
    ...opts,
    temperature: 0,
  });
  const parsed = extractJson(raw) as { fixes?: unknown };
  const list = Array.isArray(parsed?.fixes) ? parsed.fixes : [];
  return locateGrammarFixes(source, list as Parameters<typeof locateGrammarFixes>[1]);
}
