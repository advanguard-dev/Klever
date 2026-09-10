import { Alert, Field, GhostButton, MonoLabel, SolidButton } from "@/components/ui";
import { isEncryptedWorkspace } from "@/lib/workspace-lock";
import { touchIdAvailable } from "@/lib/touch-id";
import { useApp } from "@/store";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export function UnlockWorkspace() {
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const unlockWorkspace = useApp((s) => s.unlockWorkspace);
  const unlockWorkspaceWithTouchId = useApp((s) => s.unlockWorkspaceWithTouchId);
  const openWorkspaceSetup = useApp((s) => s.openWorkspaceSetup);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [touch, setTouch] = useState(false);
  const promptedFor = useRef<string | null>(null);
  const errorId = useId();
  const alertRef = useRef<HTMLDivElement>(null);

  const canTouch = Boolean(ws?.lock?.touchId && ws.lock.touchWrappedB64);

  useEffect(() => {
    let alive = true;
    void touchIdAvailable().then((ok) => {
      if (alive) setTouch(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!canTouch || !touch || !activeWorkspaceId) return;
    if (promptedFor.current === activeWorkspaceId) return;
    promptedFor.current = activeWorkspaceId;
    void runTouch();
  }, [activeWorkspaceId, canTouch, touch]);

  const runUnlock = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlockWorkspace(password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  const runTouch = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlockWorkspaceWithTouchId();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-paper px-5 py-12 md:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,color-mix(in_srgb,var(--color-paper-2)_90%,transparent),transparent_55%),radial-gradient(ellipse_at_90%_80%,color-mix(in_srgb,var(--color-line)_55%,transparent),transparent_45%)]"
      />
      <div className="klever-folio relative w-full max-w-md pl-6 md:pl-8">
        <MonoLabel>Encrypted</MonoLabel>
        <h1 className="mt-5 flex items-center gap-3 font-serif text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl">
          Locked
        </h1>
        <p className="mt-8 max-w-sm text-[1.05rem] leading-relaxed text-mute">
          <span className="text-ink">{ws?.name ?? "This workspace"}</span> is locked until you unlock
          it. The password works everywhere
          {canTouch ? "; on this Mac, Touch ID can unlock it too." : "."} There is no recovery — lose
          the password and the notes cannot be read.
        </p>

        <form
          className="mt-10 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void runUnlock();
          }}
        >
          <label className="block">
            <MonoLabel>Password</MonoLabel>
            <Field
              className="mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <SolidButton type="submit" disabled={busy || !password}>
              {busy ? (
                <>
                  <Loader2 size={14} strokeWidth={1.6} className="animate-spin" aria-hidden />
                  Unlocking…
                </>
              ) : (
                <>
                  <Lock size={14} strokeWidth={1.4} aria-hidden />
                  Unlock
                </>
              )}
            </SolidButton>
            {canTouch && touch && (
              <GhostButton type="button" onClick={() => void runTouch()} disabled={busy}>
                <Fingerprint size={14} strokeWidth={1.4} aria-hidden />
                Touch ID
              </GhostButton>
            )}
          </div>
        </form>

        {error && (
          <Alert
            id={errorId}
            ref={alertRef}
            className="mt-6 font-mono text-xs"
            onDismiss={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {workspaces.length > 1 && (
          <div className="mt-12 border-t border-line pt-8">
            <MonoLabel>Other workspaces</MonoLabel>
            <ul className="mt-3 space-y-1">
              {workspaces
                .filter((w) => w.id !== activeWorkspaceId)
                .map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      className="klever-focus flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-mute transition-colors hover:bg-paper-2 hover:text-ink"
                      onClick={() => void switchWorkspace(w.id)}
                      disabled={busy}
                    >
                      {isEncryptedWorkspace(w) && (
                        <Lock size={13} strokeWidth={1.4} className="shrink-0 text-faint" aria-hidden />
                      )}
                      <span className="truncate">{w.name}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          className="klever-focus mt-6 rounded-md font-mono text-[11px] text-mute underline decoration-line underline-offset-2 hover:text-ink"
          onClick={() => openWorkspaceSetup(null)}
          disabled={busy}
        >
          New workspace
        </button>
      </div>
    </main>
  );
}
