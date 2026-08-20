/** Electron adds an absolute path on File objects from drag-drop or native pickers. */
export type FileWithPath = File & { path?: string };

export function localPathFromFile(file: File): string | undefined {
  const p = (file as FileWithPath).path;
  if (typeof p === "string" && p.length > 1 && (p.startsWith("/") || /^[A-Za-z]:\\/.test(p))) {
    return p;
  }
  return undefined;
}
