/** Extensible save / mutation hooks — local automation without cloud webhooks. */

const beforeFlushHooks = new Set<() => void>();
const afterSaveHooks = new Set<(payload: AfterSavePayload) => void | Promise<void>>();

export type AfterSavePayload = {
  workspaceId: string | null;
  noteCount: number;
  at: number;
};

export function registerBeforeFlush(fn: () => void): () => void {
  beforeFlushHooks.add(fn);
  return () => {
    void beforeFlushHooks.delete(fn);
  };
}

export function runBeforeFlushHooks() {
  for (const fn of beforeFlushHooks) {
    try {
      fn();
    } catch (err) {
      console.error("Klever beforeFlush hook failed", err);
    }
  }
}

export function registerAfterSave(fn: (payload: AfterSavePayload) => void | Promise<void>): () => void {
  afterSaveHooks.add(fn);
  return () => {
    void afterSaveHooks.delete(fn);
  };
}

export async function runAfterSaveHooks(payload: AfterSavePayload) {
  for (const fn of afterSaveHooks) {
    try {
      await fn(payload);
    } catch (err) {
      console.error("Klever afterSave hook failed", err);
    }
  }
}

/** POST JSON to localhost webhook URLs (127.0.0.1 / localhost only). */
export async function notifyLocalWebhooks(urls: string[], payload: AfterSavePayload) {
  for (const raw of urls) {
    const url = raw.trim();
    if (!url) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
      console.warn("Klever skipped non-localhost webhook", url);
      continue;
    }
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "vault.save", ...payload }),
      });
    } catch (err) {
      console.warn("Klever webhook failed", url, err);
    }
  }
}
