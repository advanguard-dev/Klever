import { Alert, GhostButton, Kbd, MonoLabel, SolidButton } from "@/components/ui";
import { useApp } from "@/store";

export function Welcome() {
  const openFolder = useApp((s) => s.openFolder);
  const startDemo = useApp((s) => s.startDemo);
  const startGraphFixture = useApp((s) => s.startGraphFixture);
  const startEmpty = useApp((s) => s.startEmpty);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-5 py-12 md:px-8">
      <div className="klever-folio relative w-full max-w-md pl-6 md:pl-8">
        <MonoLabel>Local · Markdown · Private</MonoLabel>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl">
          Klever
        </h1>
        <p className="mt-6 max-w-sm text-base leading-7 text-mute">
          Notes, databases, tags, and a graph. Files stay on disk. Nothing leaves the machine unless
          you send it to a model you choose.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <SolidButton onClick={() => void startDemo()}>Open sample vault</SolidButton>
          {import.meta.env.DEV && (
            <GhostButton onClick={() => void startGraphFixture()}>Open orchard</GhostButton>
          )}
          <GhostButton onClick={() => void openFolder()}>Open folder</GhostButton>
          <GhostButton onClick={() => startEmpty()}>Start empty</GhostButton>
        </div>
        {error && (
          <Alert className="mt-6 font-mono text-xs" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-line pt-8 text-sm text-mute sm:grid-cols-2">
          <p className="flex items-center gap-3">
            <Kbd>⌘K</Kbd> search
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘E</Kbd> block / present
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘⇧T</Kbd> today’s note
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘⇧D</Kbd> brain dump
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘⇧M</Kbd> meetings
          </p>
          <p className="flex items-center gap-3">
            <Kbd>⌘⇧G</Kbd> graph
          </p>
        </div>
      </div>
    </main>
  );
}
