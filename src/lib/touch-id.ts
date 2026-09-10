import { isElectron, isMacOS } from "@/lib/electron";

export function touchIdSupported(): boolean {
  return isElectron() && isMacOS() && Boolean(window.kleverDesktop?.touchAvailable);
}

export async function touchIdAvailable(): Promise<boolean> {
  if (!touchIdSupported()) return false;
  try {
    return Boolean(await window.kleverDesktop?.touchAvailable?.());
  } catch {
    return false;
  }
}

export async function touchEncryptSecret(plaintext: string): Promise<string> {
  const api = window.kleverDesktop;
  if (!api?.touchEncrypt) throw new Error("Keychain is not available.");
  return api.touchEncrypt(plaintext);
}

export async function touchUnlockSecret(cipherB64: string, reason: string): Promise<string> {
  const api = window.kleverDesktop;
  if (!api?.touchUnlock) throw new Error("Touch ID is not available.");
  return api.touchUnlock(cipherB64, reason);
}

export function isTouchCancel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /cancel/i.test(msg);
}
