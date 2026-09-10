export type EditorInsert = (snippet: string, replace?: { from: number; to: number }) => void;

let insert: EditorInsert | null = null;
let slashRange: { from: number; to: number } | null = null;
let wysiwygSnippet: ((md: string, at?: { clientX: number; clientY: number }) => boolean) | null = null;
let wysiwygCommand: ((id: string) => boolean) | null = null;
/** Append markdown to the open note's local draft (survives dirty editor state). */
let bodyAppend: ((md: string) => boolean) | null = null;
/** Replace the open note's whole draft body. */
let bodyReplace: ((md: string) => boolean) | null = null;
/** Read the open note's current draft body, including unsaved edits. */
let bodyRead: (() => string) | null = null;
let linkEmbed: ((opts: { mode: "link" | "embed"; href?: string; text?: string }) => void) | null = null;

export function registerEditorInsert(fn: EditorInsert | null) {
  insert = fn;
}

export function registerWysiwyg(opts: {
  snippet?: ((md: string, at?: { clientX: number; clientY: number }) => boolean) | null;
  command?: ((id: string) => boolean) | null;
} | null) {
  wysiwygSnippet = opts?.snippet ?? null;
  wysiwygCommand = opts?.command ?? null;
}

export function registerBodyAppend(fn: ((md: string) => boolean) | null) {
  bodyAppend = fn;
}

export function registerBodyReplace(fn: ((md: string) => boolean) | null) {
  bodyReplace = fn;
}

export function registerBodyRead(fn: (() => string) | null) {
  bodyRead = fn;
}

/**
 * Swap the open note's entire body.
 *
 * Goes through the editor's own draft state rather than the store: patching
 * the note directly would be overwritten by the editor's pending debounced
 * save of the pre-edit text.
 */
export function replaceOpenNoteBody(md: string) {
  return Boolean(bodyReplace?.(md));
}

/** Draft body of the open note, or null when no editor is mounted. */
export function readOpenNoteBody(): string | null {
  return bodyRead?.() ?? null;
}

/** Insert into TipTap / CodeMirror, or append to the open note draft. */
export function insertInEditor(snippet: string, at?: { clientX: number; clientY: number }) {
  if (wysiwygSnippet?.(snippet, at)) return true;
  if (!insert) {
    if (bodyAppend?.(snippet)) return true;
    return false;
  }
  insert(snippet, slashRange ?? undefined);
  slashRange = null;
  return true;
}

/** Prefer live editor; fall back to open-note draft append. */
export function insertOrAppendToOpenNote(snippet: string, at?: { clientX: number; clientY: number }) {
  if (insertInEditor(snippet, at)) return true;
  return Boolean(bodyAppend?.(snippet));
}

export function insertWysiwygCommand(id: string) {
  return Boolean(wysiwygCommand?.(id));
}

export function setSlashRange(range: { from: number; to: number } | null) {
  slashRange = range;
}

export function getSlashRange() {
  return slashRange;
}

export function registerLinkEmbed(fn: typeof linkEmbed) {
  linkEmbed = fn;
}

export function openLinkEmbed(opts: { mode: "link" | "embed"; href?: string; text?: string }) {
  if (!linkEmbed) return false;
  linkEmbed(opts);
  return true;
}
