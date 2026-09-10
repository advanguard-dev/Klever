/** MIME type for sidebar note drag payloads. */
export const KLEVER_NOTE_DRAG = "application/x-klever-note";
/** MIME type for sidebar folder drag payloads. */
export const KLEVER_FOLDER_DRAG = "application/x-klever-folder";

export function noteDragId(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(KLEVER_NOTE_DRAG) || null;
}

export function folderDragPath(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(KLEVER_FOLDER_DRAG) || null;
}

export function isKleverTreeDrag(e: React.DragEvent) {
  const types = e.dataTransfer.types;
  return types.includes(KLEVER_NOTE_DRAG) || types.includes(KLEVER_FOLDER_DRAG);
}

export function hasFileTransfer(e: React.DragEvent) {
  return [...e.dataTransfer.types].some((t) => t === "Files" || t === "application/x-moz-file");
}

export function folderDropHighlight(active: boolean) {
  return active ? "bg-smart/10 ring-1 ring-smart/30" : "";
}
