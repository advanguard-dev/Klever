import { Alert, GhostButton, Kbd, MonoLabel, SolidButton } from "@/components/ui";
import { useApp } from "@/store";

export function Welcome() {
  const openFolder = useApp((s) => s.openFolder);
  const startDemo = useApp((s) => s.startDemo);
  const startEmpty = useApp((s) => s.startEmpty);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12 md:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,color-mix(in_srgb,var(--color-paper-2)_90%,transparent),transparent_55%),radial-gradient(ellipse_at_90%_80%,color-mix(in_srgb,var(--color-line)_55%,transparent),transparent_45%)]"
      />
      <div className="relative w-full max-w-md">
        <MonoLabel>Local · Markdown · Private</MonoLabel>
        <h1 className="mt-5 font-serif text-[3.25rem] italic leading-[0.88] tracking-tight sm:text-[4.75rem]">Klever</h1>
        <p className="mt-8 max-w-sm text-[1.05rem] leading-relaxed text-mute">
          Notes, databases, tags, and a graph. Files on disk. Nothing leaves the machine unless you send it to a model you choose.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <SolidButton onClick={() => void startDemo()}>Open sample vault</SolidButton>
          <GhostButton onClick={() => void openFolder()}>Open folder</GhostButton>
          <GhostButton onClick={() => startEmpty()}>Start empty</GhostButton>
        </div>
        {error && (
          <Alert className="mt-6 font-mono text-xs" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <div className="mt-16 space-y-3 border-t border-line pt-8 font-serif text-sm text-mute">
          <p className="flex items-center gap-3">
            <Kbd>⌘K</Kbd> command palette
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘E</Kbd> block / source / read
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘⇧T</Kbd> today’s note
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘⇧D</Kbd> brain dump
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘⇧G</Kbd> graph
          </p>
        </div>
      </div>
    </main>
  );
}
