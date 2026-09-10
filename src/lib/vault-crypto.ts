/** AES-GCM vault crypto. Keys stay in Web Crypto; only wrapped forms are persisted. */

export const ENC_MARK = "klever.enc.v1";
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

export type EncryptedEnvelope = {
  _enc: typeof ENC_MARK;
  iv: string;
  ct: string;
};

export class LockedVaultError extends Error {
  constructor() {
    super("Workspace is locked");
    this.name = "LockedVaultError";
  }
}

export function isEncryptedEnvelope(raw: unknown): raw is EncryptedEnvelope {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return o._enc === ENC_MARK && typeof o.iv === "string" && typeof o.ct === "string";
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportDekB64(dek: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", dek));
  return bytesToB64(raw);
}

export async function importDekB64(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", asSource(b64ToBytes(b64)), { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function deriveKek(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asSource(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(data: unknown, dek: CryptoKey): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asSource(iv) }, dek, pt);
  return { _enc: ENC_MARK, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptJson<T>(envelope: EncryptedEnvelope, dek: CryptoKey): Promise<T> {
  const iv = b64ToBytes(envelope.iv);
  const ct = b64ToBytes(envelope.ct);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asSource(iv) }, dek, asSource(ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export type WrappedDek = {
  kdf: "pbkdf2-sha256";
  iterations: number;
  saltB64: string;
  wrappedDekB64: string;
  wrappedDekIvB64: string;
};

export async function wrapDekWithPassword(
  dek: CryptoKey,
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<WrappedDek> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKek(password, salt, iterations);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", dek));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asSource(iv) }, kek, asSource(raw));
  return {
    kdf: "pbkdf2-sha256",
    iterations,
    saltB64: bytesToB64(salt),
    wrappedDekB64: bytesToB64(new Uint8Array(ct)),
    wrappedDekIvB64: bytesToB64(iv),
  };
}

export async function unwrapDekWithPassword(wrap: WrappedDek, password: string): Promise<CryptoKey> {
  const kek = await deriveKek(password, b64ToBytes(wrap.saltB64), wrap.iterations);
  const iv = b64ToBytes(wrap.wrappedDekIvB64);
  const ct = b64ToBytes(wrap.wrappedDekB64);
  try {
    const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asSource(iv) }, kek, asSource(ct));
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  } catch {
    throw new Error("Wrong password");
  }
}

export function assertPassword(password: string, confirm?: string) {
  const p = password.trim();
  if (p.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (confirm !== undefined && p !== confirm) {
    throw new Error("Passwords do not match.");
  }
  return p;
}
