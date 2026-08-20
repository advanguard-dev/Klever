/** True when running inside an Electron renderer. */
export function isElectron(): boolean {
  return typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent);
}

/** True on macOS (browser or Electron). */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.userAgentData?.platform ?? navigator.platform;
  return /mac/i.test(platform);
}

/** True in the Klever desktop app on macOS — needs traffic-light inset + drag region. */
export function isMacElectron(): boolean {
  return isElectron() && isMacOS();
}

/** Tag `<html>` so CSS can target Electron / macOS chrome without JS in every bar. */
export function applyElectronPlatformClass(): void {
  const root = document.documentElement;
  if (isElectron()) root.classList.add("electron");
  if (isMacElectron()) root.classList.add("electron-mac");
}
