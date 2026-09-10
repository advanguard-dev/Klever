/** Electron used to put an absolute path on File; Electron 32+ removed it. */
export type FileWithPath = File & { path?: string };

function looksLikeAbsPath(p: string) {
  return p.length > 1 && (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p));
}

/** Absolute disk path for a dropped / picked File, when available. */
export function localPathFromFile(file: File): string | undefined {
  const fromDesktop = window.kleverDesktop?.getPathForFile?.(file);
  if (typeof fromDesktop === "string" && looksLikeAbsPath(fromDesktop)) return fromDesktop;

  const legacy = (file as FileWithPath).path;
  if (typeof legacy === "string" && looksLikeAbsPath(legacy)) return legacy;

  return undefined;
}

/**
 * Snapshot FileList with absolute paths resolved synchronously at drop time
 * (before async work). Uses Electron webUtils via preload.
 */
export function filesFromFileList(list: FileList | File[]): File[] {
  const out: File[] = [];
  const len = list.length;
  for (let i = 0; i < len; i++) {
    const file = "item" in list && typeof list.item === "function" ? list.item(i) : (list as File[])[i];
    if (!file) continue;
    const localPath = localPathFromFile(file);
    if (localPath) {
      try {
        Object.defineProperty(file, "path", { value: localPath, configurable: true });
      } catch {
        /* File may be sealed — localPathFromFile still reads via getPathForFile */
      }
    }
    out.push(file);
  }
  return out;
}
