/** Lazy Shiki highlighter for fenced code blocks. */

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
        themes: ["github-light", "github-dark"],
        langs: [...CODE_LANGUAGES],
      }),
    );
  }
  return highlighterPromise;
}

export async function highlightCode(code: string, lang?: string | null): Promise<string> {
  const language = normalizeLang(lang);
  try {
    const highlighter = await getHighlighter();
    const loaded = highlighter.getLoadedLanguages();
    const useLang = loaded.includes(language as never) ? language : "text";
    return highlighter.codeToHtml(code, {
      lang: useLang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
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
