/** Lightweight on-device semantic search via TF-IDF cosine (no cloud, no model download). */

export type SemanticDoc = {
  id: string;
  title: string;
  text: string;
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function tf(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  const n = tokens.length || 1;
  for (const [k, v] of m) m.set(k, v / n);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  if (!na || !nb) return 0;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (w) dot += v * w;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type SemanticHit = { id: string; title: string; score: number };

/** Rank documents by semantic similarity to the query. */
export function semanticSearch(docs: SemanticDoc[], query: string, limit = 20): SemanticHit[] {
  const qTokens = tokenize(query);
  if (!qTokens.length || !docs.length) return [];

  const docTokens = docs.map((d) => tokenize(`${d.title} ${d.title} ${d.text}`));
  const df = new Map<string, number>();
  for (const toks of docTokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = docs.length;
  const idf = (t: string) => Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1;

  const weighted = (tokens: string[]) => {
    const raw = tf(tokens);
    const out = new Map<string, number>();
    for (const [k, v] of raw) out.set(k, v * idf(k));
    return out;
  };

  const qVec = weighted(qTokens);
  const scored = docs.map((d, i) => ({
    id: d.id,
    title: d.title,
    score: cosine(qVec, weighted(docTokens[i]!)),
  }));

  return scored
    .filter((h) => h.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
