/** In-memory DEK for the unlocked workspace. Never persisted. */

let dek: CryptoKey | null = null;
let workspaceId: string | null = null;

export function sessionDekFor(id: string | null | undefined): CryptoKey | null {
  if (!id || workspaceId !== id) return null;
  return dek;
}

export function sessionWorkspaceId(): string | null {
  return workspaceId;
}

export function setSessionDek(id: string, key: CryptoKey) {
  workspaceId = id;
  dek = key;
}

export function clearSessionDek() {
  workspaceId = null;
  dek = null;
}

export function isSessionUnlocked(id: string | null | undefined): boolean {
  return Boolean(id && workspaceId === id && dek);
}
