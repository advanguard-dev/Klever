/** True when running inside the Klever desktop app (preload bridge), not Cursor/Chrome. */
export function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.kleverDesktop);
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
  root.classList.toggle("electron", isElectron());
  root.classList.toggle("electron-mac", isMacElectron());
}

if (typeof document !== "undefined") applyElectronPlatformClass();
