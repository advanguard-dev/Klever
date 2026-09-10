import {
  checkGrammar,
  isAbort,
  suggestPageItems,
  type GrammarFix,
  type PageSuggestion,
} from "@/lib/ai";
import type { AiSettings } from "@/types";
import { useSyncExternalStore } from "react";

/**
 * On-demand page suggestions.
 *
 * Nothing here runs on a timer: a call happens only when the reader asks for
 * one. Results are cached against a hash of the page text, so re-asking about
 * unchanged content costs nothing, and the cached result is marked stale
 * rather than discarded once the page moves on.
 */

export type RunStatus = "idle" | "loading" | "done" | "error";

export type SuggestState = {
  status: RunStatus;
  /** Hash of the page text these results describe. */
  hash: string;
  items: PageSuggestion[];
  error: string | null;
};

export type GrammarState = {
  status: RunStatus;
  hash: string;
  fixes: GrammarFix[];
  error: string | null;
};

const IDLE_SUGGEST: SuggestState = { status: "idle", hash: "", items: [], error: null };
const IDLE_GRAMMAR: GrammarState = { status: "idle", hash: "", fixes: [], error: null };

const suggestByNote = new Map<string, SuggestState>();
const grammarByNote = new Map<string, GrammarState>();
const listeners = new Set<() => void>();

/** One in-flight request per note per kind. A new run cancels the old one. */
const controllers = new Map<string, AbortController>();

function emit() {
  for (const fn of listeners) fn();
}

/** FNV-1a. Cheap, stable, and good enough to detect "the page changed". */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function pageHash(page: { title: string; body: string }): string {
  return hashText(`${page.title}\u0000${page.body}`);
}

/* ---------------------------------------------------------------------------
   Dismissals — remembered so a rejected suggestion does not come back.
--------------------------------------------------------------------------- */

const DISMISS_KEY = "klever.suggestions.dismissed";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

const dismissed = loadDismissed();

function saveDismissed() {
  try {
    // Bound the list so it cannot grow without limit.
    const keep = [...dismissed].slice(-500);
    dismissed.clear();
    for (const k of keep) dismissed.add(k);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(keep));
  } catch {
    /* storage unavailable — dismissals stay in memory only */
  }
}

/** Identity of a suggestion, independent of the surrounding page text. */
export function suggestionKey(noteId: string, s: PageSuggestion): string {
  return `${noteId}:${s.kind}:${hashText(s.item.title.trim().toLowerCase())}`;
}

export function isDismissed(noteId: string, s: PageSuggestion): boolean {
  return dismissed.has(suggestionKey(noteId, s));
}

export function dismissSuggestion(noteId: string, s: PageSuggestion) {
  dismissed.add(suggestionKey(noteId, s));
  saveDismissed();
  const state = suggestByNote.get(noteId);
  if (state) {
    suggestByNote.set(noteId, {
      ...state,
      items: state.items.filter((i) => suggestionKey(noteId, i) !== suggestionKey(noteId, s)),
    });
  }
  emit();
}

/** Drop a suggestion from view without remembering it (used after accepting). */
export function consumeSuggestion(noteId: string, s: PageSuggestion) {
  const state = suggestByNote.get(noteId);
  if (!state) return;
  const key = suggestionKey(noteId, s);
  suggestByNote.set(noteId, {
    ...state,
    items: state.items.filter((i) => suggestionKey(noteId, i) !== key),
  });
  emit();
}

/* ---------------------------------------------------------------------------
   Reads
--------------------------------------------------------------------------- */

export function getSuggestState(noteId: string): SuggestState {
  return suggestByNote.get(noteId) ?? IDLE_SUGGEST;
}

export function getGrammarState(noteId: string): GrammarState {
  return grammarByNote.get(noteId) ?? IDLE_GRAMMAR;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSuggestState(noteId: string | null): SuggestState {
  return useSyncExternalStore(
    subscribe,
    () => (noteId ? getSuggestState(noteId) : IDLE_SUGGEST),
    () => IDLE_SUGGEST,
  );
}

export function useGrammarState(noteId: string | null): GrammarState {
  return useSyncExternalStore(
    subscribe,
    () => (noteId ? getGrammarState(noteId) : IDLE_GRAMMAR),
    () => IDLE_GRAMMAR,
  );
}

/* ---------------------------------------------------------------------------
   Runs
--------------------------------------------------------------------------- */

function begin(slot: string): AbortSignal {
  controllers.get(slot)?.abort();
  const ctrl = new AbortController();
  controllers.set(slot, ctrl);
  return ctrl.signal;
}

function finish(slot: string, signal: AbortSignal) {
  const current = controllers.get(slot);
  if (current && current.signal === signal) controllers.delete(slot);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Suggestions failed.";
}

export async function runPageSuggestions(
  noteId: string,
  page: { title: string; body: string },
  ai: AiSettings,
): Promise<void> {
  const hash = pageHash(page);
  const prev = getSuggestState(noteId);
  // Already answered for exactly this text — reuse it.
  if (prev.status === "done" && prev.hash === hash) return;

  const slot = `suggest:${noteId}`;
  const signal = begin(slot);
  suggestByNote.set(noteId, { status: "loading", hash, items: prev.items, error: null });
  emit();

  try {
    const items = await suggestPageItems(ai, page, { signal });
    const visible = items.filter((s) => !isDismissed(noteId, s));
    suggestByNote.set(noteId, { status: "done", hash, items: visible, error: null });
  } catch (err) {
    if (isAbort(err)) return; // superseded by a newer run
    suggestByNote.set(noteId, { status: "error", hash, items: [], error: message(err) });
  } finally {
    finish(slot, signal);
    emit();
  }
}

export async function runGrammarCheck(
  noteId: string,
  body: string,
  ai: AiSettings,
): Promise<void> {
  const hash = hashText(body);
  const prev = getGrammarState(noteId);
  if (prev.status === "done" && prev.hash === hash) return;

  const slot = `grammar:${noteId}`;
  const signal = begin(slot);
  grammarByNote.set(noteId, { status: "loading", hash, fixes: prev.fixes, error: null });
  emit();

  try {
    const fixes = await checkGrammar(ai, body, { signal });
    grammarByNote.set(noteId, { status: "done", hash, fixes, error: null });
  } catch (err) {
    if (isAbort(err)) return;
    grammarByNote.set(noteId, { status: "error", hash, fixes: [], error: message(err) });
  } finally {
    finish(slot, signal);
    emit();
  }
}

/** Remove one correction from view — after applying it, or on reject. */
export function consumeGrammarFix(noteId: string, fixId: string) {
  const state = grammarByNote.get(noteId);
  if (!state) return;
  grammarByNote.set(noteId, {
    ...state,
    fixes: state.fixes.filter((f) => f.id !== fixId),
  });
  emit();
}

/** Cancel in-flight work and forget cached results for a note. */
export function resetNote(noteId: string) {
  controllers.get(`suggest:${noteId}`)?.abort();
  controllers.get(`grammar:${noteId}`)?.abort();
  controllers.delete(`suggest:${noteId}`);
  controllers.delete(`grammar:${noteId}`);
  suggestByNote.delete(noteId);
  grammarByNote.delete(noteId);
  emit();
}
