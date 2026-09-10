import { Alert, Field, GhostButton, MonoLabel, Overlay, Panel, SolidButton, Toggle } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MIN_PASSWORD_LENGTH, isEncryptedWorkspace } from "@/lib/workspace-lock";
import { touchIdAvailable } from "@/lib/touch-id";
import { WORKSPACE_TOOL_OPTIONS, defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import type { WorkspaceAiMode, WorkspaceToolId, WorkspaceTools } from "@/types";
import { useEffect, useId, useRef, useState } from "react";

export function WorkspaceSetup() {
  const open = useApp((s) => s.workspaceSetupOpen);
  const setupId = useApp((s) => s.workspaceSetupId);
  const close = useApp((s) => s.closeWorkspaceSetup);
  const workspaces = useApp((s) => s.workspaces);
  const createWorkspace = useApp((s) => s.createWorkspace);
  const updateWorkspace = useApp((s) => s.updateWorkspace);
  const enableWorkspaceLock = useApp((s) => s.enableWorkspaceLock);
  const disableWorkspaceLock = useApp((s) => s.disableWorkspaceLock);
  const changeWorkspacePassword = useApp((s) => s.changeWorkspacePassword);
  const setWorkspaceTouchId = useApp((s) => s.setWorkspaceTouchId);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const unlocked = useApp((s) => s.unlocked);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);

  const editing = setupId ? workspaces.find((w) => w.id === setupId) : null;
  const isCreate = !editing;

  const [name, setName] = useState("Vault");
  const [tools, setTools] = useState<WorkspaceTools>(() => defaultWorkspaceTools());
  const [aiMode, setAiMode] = useState<WorkspaceAiMode>("remote");
  const [busy, setBusy] = useState(false);
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [touchId, setTouchId] = useState(false);
  const [touchOk, setTouchOk] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const errorId = useId();
  const titleId = useId();
  const alertRef = useRef<HTMLDivElement>(null);

  const fail = (err: unknown) => {
    setLocalError(err instanceof Error ? err.message : String(err));
    requestAnimationFrame(() => alertRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setTools({ ...editing.tools });
      setAiMode(editing.aiMode);
    } else {
      setName("New workspace");
      setTools(defaultWorkspaceTools());
      setAiMode("remote");
    }
    setBusy(false);
    setEncrypt(false);
    setPassword("");
    setConfirm("");
    setCurrentPassword("");
    setNewPassword("");
    setNewConfirm("");
    setTouchId(Boolean(editing?.lock?.touchId));
    setLocalError(null);
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void touchIdAvailable().then((ok) => {
      if (alive) setTouchOk(ok);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  const toggleTool = (id: WorkspaceToolId) => {
    setTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const encrypted = isEncryptedWorkspace(editing);
  const canEditLock = Boolean(editing && editing.id === activeWorkspaceId && unlocked);

  const save = async () => {
    if (busy) return;
    const trimmed = name.trim() || "Vault";
    setBusy(true);
    setLocalError(null);
    try {
      if (isCreate) {
        await createWorkspace({
          name: trimmed,
          tools,
          aiMode,
          password: encrypt ? password : undefined,
          touchId: encrypt && touchId && touchOk,
        });
      } else if (editing) {
        updateWorkspace(editing.id, { name: trimmed, tools, aiMode });
        close();
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const runEnable = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await enableWorkspaceLock(password, confirm, touchId && touchOk);
      setPassword("");
      setConfirm("");
      setEncrypt(false);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const runDisable = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await disableWorkspaceLock(currentPassword);
      setCurrentPassword("");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const runChangePassword = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await changeWorkspacePassword(currentPassword, newPassword, newConfirm);
      setCurrentPassword("");
      setNewPassword("");
      setNewConfirm("");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const runTouch = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await setWorkspaceTouchId(on);
      setTouchId(on);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={close} title={isCreate ? "New workspace" : "Edit workspace"} labelledBy={titleId}>
      <Panel className="p-6">
        <MonoLabel>Workspace</MonoLabel>
        <h2 id={titleId} className="mt-2 font-serif text-3xl font-semibold tracking-tight">
          {isCreate ? "New workspace" : "Edit workspace"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          A workspace is a named vault of pages, boards, calendar, and meetings — plus the tools and
          AI mode you choose here.
        </p>

        <div className="mt-6 space-y-6">
          <label className="block">
            <MonoLabel>Name</MonoLabel>
            <Field
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              autoFocus
            />
          </label>

          <div>
            <MonoLabel>Tools</MonoLabel>
            <ul className="mt-2 space-y-1">
              {WORKSPACE_TOOL_OPTIONS.map((opt) => {
                const on = tools[opt.id];
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTool(opt.id)}
                      className={cn(
                        "klever-focus flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                        on
                          ? "border-ink/25 bg-paper-2"
                          : "border-line bg-paper text-mute hover:border-ink/20 hover:text-ink",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border font-mono text-[10px]",
                          on ? "border-ink bg-ink text-paper" : "border-line text-transparent",
                        )}
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{opt.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-mute">
                          {opt.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <MonoLabel>AI</MonoLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    id: "remote" as const,
                    title: "Remote",
                    body: "Gemini for Brain Dump, Meeting, and writing tools. The key stays in Settings.",
                  },
                  {
                    id: "local" as const,
                    title: "Local",
                    body: "No cloud calls. Brain Dump and Meeting use on-device heuristics. Writing tools stay off.",
                  },
                ] as const
              ).map((opt) => {
                const on = aiMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAiMode(opt.id)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition-colors duration-150",
                      on
                        ? "border-ink/25 bg-paper-2"
                        : "border-line bg-paper text-mute hover:border-ink/20 hover:text-ink",
                    )}
                  >
                    <span className="text-sm font-medium text-ink">{opt.title}</span>
                    <span className="mt-1 block text-[12px] leading-snug text-faint">{opt.body}</span>
                  </button>
                );
              })}
            </div>
            {aiMode === "remote" && (
              <button
                type="button"
                className="mt-2 font-mono text-[11px] text-mute underline decoration-line underline-offset-2 hover:text-ink"
                onClick={() => {
                  close();
                  setSettingsOpen(true);
                }}
              >
                Open Gemini settings
              </button>
            )}
          </div>

          <div>
            <MonoLabel>Encryption</MonoLabel>
            {isCreate && (
              <div className="mt-2 space-y-3">
                <p className="text-sm leading-relaxed text-mute">
                  Encrypt the workspace at rest. Unlock with a password
                  {touchOk ? "; Touch ID on this Mac." : "."} There is no recovery key — lose the
                  password and the notes cannot be opened. Encrypted workspaces stay inside Klever;
                  they are not written as readable markdown folders.
                </p>
                <Toggle checked={encrypt} onChange={setEncrypt} label="Encrypt this workspace" />
                {encrypt && (
                  <div className="space-y-3">
                    <label className="block">
                      <MonoLabel>Password</MonoLabel>
                      <Field
                        className="mt-1"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={busy}
                      />
                    </label>
                    <label className="block">
                      <MonoLabel>Confirm password</MonoLabel>
                      <Field
                        className="mt-1"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        disabled={busy}
                      />
                    </label>
                    {touchOk && (
                      <Toggle
                        checked={touchId}
                        onChange={setTouchId}
                        label="Unlock with Touch ID"
                      />
                    )}
                    <p className="font-mono text-[11px] text-faint">
                      At least {MIN_PASSWORD_LENGTH} characters.
                    </p>
                  </div>
                )}
              </div>
            )}
            {!isCreate && encrypted && canEditLock && (
              <div className="mt-2 space-y-4">
                <p className="text-sm leading-relaxed text-mute">
                  This workspace is encrypted. Notes stay unreadable until you unlock with the
                  password
                  {editing?.lock?.touchId ? " or Touch ID" : ""}.
                </p>
                {touchOk && (
                  <Toggle
                    checked={touchId}
                    onChange={(on) => void runTouch(on)}
                    label="Unlock with Touch ID"
                  />
                )}
                <label className="block">
                  <MonoLabel>Current password</MonoLabel>
                  <Field
                    className="mt-1"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={busy}
                    aria-invalid={Boolean(localError)}
                    aria-describedby={localError ? errorId : undefined}
                  />
                </label>
                <div className="space-y-3 border-t border-line pt-4">
                  <MonoLabel>Change password</MonoLabel>
                  <label className="block">
                    <MonoLabel>New password</MonoLabel>
                    <Field
                      className="mt-1"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={busy}
                    />
                  </label>
                  <label className="block">
                    <MonoLabel>Confirm new password</MonoLabel>
                    <Field
                      className="mt-1"
                      type="password"
                      value={newConfirm}
                      onChange={(e) => setNewConfirm(e.target.value)}
                      autoComplete="new-password"
                      disabled={busy}
                    />
                  </label>
                  <GhostButton
                    type="button"
                    onClick={() => void runChangePassword()}
                    disabled={busy || !currentPassword || !newPassword}
                  >
                    Change password
                  </GhostButton>
                </div>
                <div className="space-y-3 border-t border-line pt-4">
                  <MonoLabel>Remove encryption</MonoLabel>
                  <p className="text-[12px] leading-snug text-faint">
                    Decrypts the workspace back into ordinary notes. Uses the current password
                    above.
                  </p>
                  <GhostButton
                    type="button"
                    onClick={() => void runDisable()}
                    disabled={busy || !currentPassword}
                  >
                    Remove encryption
                  </GhostButton>
                </div>
              </div>
            )}
            {!isCreate && !encrypted && canEditLock && (
              <div className="mt-2 space-y-3">
                <p className="text-sm leading-relaxed text-mute">
                  Encrypt this workspace at rest. Any folder already linked on disk is left as it
                  is — move or delete those files yourself.
                </p>
                <Toggle checked={encrypt} onChange={setEncrypt} label="Encrypt this workspace" />
                {encrypt && (
                  <div className="space-y-3">
                    <label className="block">
                      <MonoLabel>Password</MonoLabel>
                      <Field
                        className="mt-1"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={busy}
                      />
                    </label>
                    <label className="block">
                      <MonoLabel>Confirm password</MonoLabel>
                      <Field
                        className="mt-1"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        disabled={busy}
                      />
                    </label>
                    {touchOk && (
                      <Toggle
                        checked={touchId}
                        onChange={setTouchId}
                        label="Unlock with Touch ID"
                      />
                    )}
                    <SolidButton
                      type="button"
                      onClick={() => void runEnable()}
                      disabled={busy || password.length < MIN_PASSWORD_LENGTH}
                    >
                      Encrypt workspace
                    </SolidButton>
                  </div>
                )}
              </div>
            )}
            {!isCreate && editing && !canEditLock && (
              <p className="mt-2 text-sm leading-relaxed text-mute">
                Unlock this workspace to change encryption.
              </p>
            )}
          </div>
        </div>

        {localError && (
          <Alert
            id={errorId}
            ref={alertRef}
            className="mt-6 font-mono text-xs"
            onDismiss={() => setLocalError(null)}
          >
            {localError}
          </Alert>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SolidButton
            onClick={() => void save()}
            disabled={
              busy ||
              (isCreate && encrypt && (password.length < MIN_PASSWORD_LENGTH || password !== confirm))
            }
          >
            {isCreate ? "Create workspace" : "Save"}
          </SolidButton>
          <GhostButton onClick={close} disabled={busy}>
            Cancel
          </GhostButton>
        </div>
      </Panel>
    </Overlay>
  );
}
