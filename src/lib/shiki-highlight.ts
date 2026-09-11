/** Lazy Shiki highlighter for fenced code blocks. Languages load on demand. */

let highlighterPromise: Promise<import("shiki").Highlighter> | null = null;

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  "": "text",
};

export const CODE_LANGUAGES = [
  "text",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "python",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "csharp",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "sql",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "toml",
  "markdown",
  "bash",
  "shell",
  "dockerfile",
  "graphql",
  "mermaid",
] as const;

export function normalizeLang(lang?: string | null): string {
  const raw = (lang ?? "text").trim().toLowerCase();
  return (LANG_ALIASES[raw] ?? raw) || "text";
}

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["css-variables"],
        langs: ["text"],
      }),
    );
  }
  return highlighterPromise;
}

export async function highlightCode(code: string, lang?: string | null): Promise<string> {
  const language = normalizeLang(lang);
  if (language === "mermaid") {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
  try {
    const highlighter = await getHighlighter();
    let useLang = language;
    const loaded = highlighter.getLoadedLanguages();
    if (!loaded.includes(useLang as never)) {
      try {
        await highlighter.loadLanguage(useLang as never);
      } catch {
        useLang = "text";
      }
    }
    if (!highlighter.getLoadedLanguages().includes(useLang as never)) useLang = "text";
    return highlighter.codeToHtml(code, {
      lang: useLang,
      theme: "css-variables",
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
