import { highlightCode, normalizeLang } from "@/lib/shiki-highlight";
import { MermaidBlock } from "@/lib/mermaid-block";
import { useEffect, useState } from "react";

/** Highlighted read-only code (or Mermaid) for MarkdownPreview. */
export function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const lang = normalizeLang(language);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (lang === "mermaid") return;
    let cancelled = false;
    void highlightCode(code, lang).then((h) => {
      if (!cancelled) setHtml(h);
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (lang === "mermaid") {
    return <MermaidBlock source={code} />;
  }

  if (!html) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-line bg-paper-2 p-3 font-mono text-[13px]">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="klever-shiki my-3 overflow-x-auto rounded-lg border border-line text-[13px] [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
