import { refreshBlobFromHandle, resolveAssetSrc } from "@/lib/assets";
import { isMacOS } from "@/lib/electron";
import type { BlobRecord } from "@/types";

export type OpenLocalFileMode = "reveal" | "open";

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Label for reveal-in-finder vs show-in-folder menu items. */
export function revealFileLabel() {
  return isMacOS() ? "Reveal in Finder" : "Show in folder";
}

/** Open the original file on disk — not a Klever copy. */
export async function openLocalFile(
  vaultPath: string,
  rec: BlobRecord | undefined,
  opts?: { mode?: OpenLocalFileMode; label?: string },
) {
  const path = vaultPath.replace(/^\.\//, "");
  const mode = opts?.mode ?? "open";
  const desktop = window.kleverDesktop;

  if (desktop && rec?.localPath) {
    const abs =
      mode === "open"
        ? await desktop.openAbsolute(rec.localPath)
        : await desktop.revealAbsolute(rec.localPath);
    if (abs?.ok) return;
  }

  if (desktop) {
    const disk =
      mode === "open" ? await desktop.openFile(path) : await desktop.revealFile(path);
    if (disk?.ok) return;
  }

  if (rec?.handle) {
    const refreshed = await refreshBlobFromHandle(rec);
    if (refreshed.localPath && desktop) {
      const abs =
        mode === "open"
          ? await desktop.openAbsolute(refreshed.localPath)
          : await desktop.revealAbsolute(refreshed.localPath);
      if (abs?.ok) return;
    }
  }

  const url = rec?.data?.byteLength ? resolveAssetSrc(path, { [path]: rec }) : "";
  if (url) window.open(url, "_blank", "noreferrer");
}

export function blobsToDesktopPayload(blobs: Record<string, BlobRecord>) {
  const out: Record<
    string,
    { mime: string; dataBase64?: string; external?: boolean; localPath?: string }
  > = {};
  for (const [path, rec] of Object.entries(blobs)) {
    if (rec.external || rec.localPath) {
      out[path] = {
        mime: rec.mime,
        external: true,
        ...(rec.localPath ? { localPath: rec.localPath } : {}),
      };
      continue;
    }
    if (!rec.data.byteLength) continue;
    out[path] = { mime: rec.mime, dataBase64: arrayBufferToBase64(rec.data) };
  }
  return out;
}

export function blobsFromDesktopPayload(
  blobs: Record<
    string,
    { mime: string; dataBase64?: string; external?: boolean; localPath?: string }
  >,
) {
  const out: Record<string, BlobRecord> = {};
  for (const [path, rec] of Object.entries(blobs)) {
    if (rec.external || rec.localPath) {
      out[path] = {
        mime: rec.mime,
        data: new ArrayBuffer(0),
        external: true,
        ...(rec.localPath ? { localPath: rec.localPath } : {}),
      };
      continue;
    }
    if (!rec.dataBase64) continue;
    const binary = atob(rec.dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    out[path] = { mime: rec.mime, data: bytes.buffer };
  }
  return out;
}

/** Register an external file reference without copying bytes into the vault. */
export function externalFileBlob(
  file: File,
  opts?: { localPath?: string; handle?: FileSystemFileHandle },
): BlobRecord {
  return {
    mime: file.type || "application/octet-stream",
    data: new ArrayBuffer(0),
    external: true,
    ...(opts?.localPath ? { localPath: opts.localPath } : {}),
    ...(opts?.handle ? { handle: opts.handle } : {}),
  };
}
