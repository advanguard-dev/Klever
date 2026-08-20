/** MIME type for sidebar note drag payloads. */
export const KLEVER_NOTE_DRAG = "application/x-klever-note";

export function noteDragId(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(KLEVER_NOTE_DRAG) || null;
}

export function hasFileTransfer(e: React.DragEvent) {
  return [...e.dataTransfer.types].some((t) => t === "Files" || t === "application/x-moz-file");
}

export function folderDropHighlight(active: boolean) {
  return active ? "bg-smart/10 ring-1 ring-smart/30" : "";
}
