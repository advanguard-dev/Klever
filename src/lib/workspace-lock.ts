import type { Workspace, WorkspaceLock } from "@/types";
import {
  MIN_PASSWORD_LENGTH,
  PBKDF2_ITERATIONS,
  type WrappedDek,
} from "@/lib/vault-crypto";

export { MIN_PASSWORD_LENGTH };

export function isEncryptedWorkspace(w?: Workspace | null): boolean {
  return Boolean(w?.lock?.enabled);
}

export function normalizeWorkspaceLock(raw: unknown): WorkspaceLock | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const l = raw as Record<string, unknown>;
  if (l.enabled !== true) return undefined;
  if (typeof l.saltB64 !== "string" || !l.saltB64) return undefined;
  if (typeof l.wrappedDekB64 !== "string" || !l.wrappedDekB64) return undefined;
  if (typeof l.wrappedDekIvB64 !== "string" || !l.wrappedDekIvB64) return undefined;
  const iterations =
    typeof l.iterations === "number" && l.iterations >= 100_000 ? Math.floor(l.iterations) : PBKDF2_ITERATIONS;
  return {
    enabled: true,
    kdf: "pbkdf2-sha256",
    iterations,
    saltB64: l.saltB64,
    wrappedDekB64: l.wrappedDekB64,
    wrappedDekIvB64: l.wrappedDekIvB64,
    touchId: l.touchId === true,
    touchWrappedB64: typeof l.touchWrappedB64 === "string" && l.touchWrappedB64 ? l.touchWrappedB64 : undefined,
  };
}

export function lockFromWrap(wrap: WrappedDek, extra?: Partial<WorkspaceLock>): WorkspaceLock {
  return {
    enabled: true,
    kdf: wrap.kdf,
    iterations: wrap.iterations,
    saltB64: wrap.saltB64,
    wrappedDekB64: wrap.wrappedDekB64,
    wrappedDekIvB64: wrap.wrappedDekIvB64,
    touchId: extra?.touchId,
    touchWrappedB64: extra?.touchWrappedB64,
  };
}

export function wrapFromLock(lock: WorkspaceLock): WrappedDek {
  return {
    kdf: lock.kdf,
    iterations: lock.iterations,
    saltB64: lock.saltB64,
    wrappedDekB64: lock.wrappedDekB64,
    wrappedDekIvB64: lock.wrappedDekIvB64,
  };
}
