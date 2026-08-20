/** Normalize user-entered URL for href (bare domains get https). */
export function normalizePropUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  if (/^\/\./.test(s) || s.startsWith("/")) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
  return null;
}

export function looksLikeUrl(raw: string): boolean {
  return normalizePropUrl(raw) !== null;
}
