/** Sync hooks run immediately before vault flush (e.g. commit debounced editor state). */
const beforeFlushHooks = new Set<() => void>();

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
