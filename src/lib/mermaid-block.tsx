import { useEffect, useId, useState } from "react";

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

async function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((m) => {
      const mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: "inherit",
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

/** Renders a Mermaid diagram from source; shows a clear error on failure. */
export function MermaidBlock({ source }: { source: string }) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 8)}`;
    void (async () => {
      try {
        const mermaid = await getMermaid();
        const { svg: out } = await mermaid.render(id, source.trim());
        if (!cancelled) {
          setSvg(out);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setSvg(null);
          setError(e instanceof Error ? e.message : "Invalid Mermaid diagram");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, reactId]);

  if (error) {
    return (
      <div className="my-3 rounded-lg border border-rule bg-paper-2 p-3 font-mono text-[12px] text-mute">
        <div className="mb-1 text-[10px] uppercase tracking-wide">Mermaid error</div>
        <div>{error}</div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-ink/70">{source}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 rounded-lg border border-dashed border-rule px-3 py-6 text-center font-mono text-[11px] text-mute">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="klever-mermaid my-3 flex justify-center overflow-x-auto rounded-lg border border-rule bg-paper p-4 [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
