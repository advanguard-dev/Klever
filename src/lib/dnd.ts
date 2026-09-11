/** MIME type for sidebar note drag payloads. */
export const KLEVER_NOTE_DRAG = "application/x-klever-note";
/** MIME type for sidebar folder drag payloads. */
export const KLEVER_FOLDER_DRAG = "application/x-klever-folder";

/** HTML5 DnD hides `getData` until drop — keep the id for edge-split preview. */
let noteDragPayload: string | null = null;
/** Electron often fires `dragend` before `drop`; keep the id for one tick. */
let lastNoteDrag: string | null = null;
let endNoteDragTimer: ReturnType<typeof setTimeout> | null = null;

function cancelEndNoteDragTimer() {
  if (!endNoteDragTimer) return;
  clearTimeout(endNoteDragTimer);
  endNoteDragTimer = null;
}

export function beginNoteDrag(id: string) {
  cancelEndNoteDragTimer();
  noteDragPayload = id;
  lastNoteDrag = id;
}

export function endNoteDrag() {
  noteDragPayload = null;
  cancelEndNoteDragTimer();
  if (typeof window === "undefined") {
    lastNoteDrag = null;
    return;
  }
  endNoteDragTimer = setTimeout(() => {
    lastNoteDrag = null;
    endNoteDragTimer = null;
  }, 80);
}

export function peekNoteDrag() {
  return noteDragPayload ?? lastNoteDrag;
}

/** Chromium/Electron reject custom MIME types unless `text/plain` is also set. */
export function writeNoteDrag(dt: DataTransfer | null, id: string) {
  beginNoteDrag(id);
  if (!dt) return;
  dt.effectAllowed = "copyMove";
  try {
    dt.setData("text/plain", id);
  } catch {
    /* some hosts lock the store after the first type */
  }
  try {
    dt.setData(KLEVER_NOTE_DRAG, id);
  } catch {
    /* custom types can be rejected; peekNoteDrag still works */
  }
}

export function noteDragId(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(KLEVER_NOTE_DRAG) || peekNoteDrag();
}

export function folderDragPath(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(KLEVER_FOLDER_DRAG) || null;
}

export function isKleverTreeDrag(e: React.DragEvent) {
  const types = e.dataTransfer.types;
  return types.includes(KLEVER_NOTE_DRAG) || types.includes(KLEVER_FOLDER_DRAG);
}

export function isKleverNoteDrag(e: { dataTransfer?: DataTransfer | null }) {
  const types = e.dataTransfer?.types;
  return Boolean(peekNoteDrag()) || Boolean(types && [...types].includes(KLEVER_NOTE_DRAG));
}

export function hasFileTransfer(e: React.DragEvent) {
  return [...e.dataTransfer.types].some((t) => t === "Files" || t === "application/x-moz-file");
}

export function folderDropHighlight(active: boolean) {
  return active ? "bg-smart/10 ring-1 ring-smart/30" : "";
}
