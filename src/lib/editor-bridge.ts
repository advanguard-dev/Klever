export type EditorInsert = (snippet: string, replace?: { from: number; to: number }) => void;

let insert: EditorInsert | null = null;
let slashRange: { from: number; to: number } | null = null;
let wysiwygSnippet: ((md: string) => boolean) | null = null;
let wysiwygCommand: ((id: string) => boolean) | null = null;

export function registerEditorInsert(fn: EditorInsert | null) {
  insert = fn;
}

export function registerWysiwyg(opts: {
  snippet?: ((md: string) => boolean) | null;
  command?: ((id: string) => boolean) | null;
} | null) {
  wysiwygSnippet = opts?.snippet ?? null;
  wysiwygCommand = opts?.command ?? null;
}

export function insertInEditor(snippet: string) {
  if (wysiwygSnippet?.(snippet)) return true;
  if (!insert) return false;
  insert(snippet, slashRange ?? undefined);
  slashRange = null;
  return true;
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

export function hasWysiwyg() {
  return Boolean(wysiwygCommand || wysiwygSnippet);
}
