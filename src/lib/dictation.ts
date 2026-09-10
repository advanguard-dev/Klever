import { isMacElectron, isMacOS } from "@/lib/electron";

/** Mac Dictation types into any focused text field (Electron or browser). */
export function macDictationSupported(): boolean {
  return isMacOS();
}

/** One-click Start Dictation via AppKit (desktop app only). */
export function macDictationCommandAvailable(): boolean {
  return isMacElectron() && Boolean(window.kleverDesktop?.startDictation);
}

export async function startMacDictation(el?: HTMLTextAreaElement | HTMLInputElement | null): Promise<boolean> {
  el?.focus();
  const api = window.kleverDesktop;
  if (!api?.startDictation) return false;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  try {
    const result = await api.startDictation();
    return Boolean(result?.ok);
  } catch {
    return false;
  }
}

export async function stopMacDictation(): Promise<void> {
  try {
    await window.kleverDesktop?.stopDictation?.();
  } catch {
    /* already idle */
  }
}
