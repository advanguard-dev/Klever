import { Field, GhostButton, MonoLabel, Overlay, Panel, SolidButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { WORKSPACE_TOOL_OPTIONS, defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import type { WorkspaceAiMode, WorkspaceToolId, WorkspaceTools } from "@/types";
import { useEffect, useState } from "react";

export function WorkspaceSetup() {
  const open = useApp((s) => s.workspaceSetupOpen);
  const setupId = useApp((s) => s.workspaceSetupId);
  const close = useApp((s) => s.closeWorkspaceSetup);
  const workspaces = useApp((s) => s.workspaces);
  const createWorkspace = useApp((s) => s.createWorkspace);
  const updateWorkspace = useApp((s) => s.updateWorkspace);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);

  const editing = setupId ? workspaces.find((w) => w.id === setupId) : null;
  const isCreate = !editing;

  const [name, setName] = useState("Vault");
  const [tools, setTools] = useState<WorkspaceTools>(() => defaultWorkspaceTools());
  const [aiMode, setAiMode] = useState<WorkspaceAiMode>("remote");
  const [busy, setBusy] = useState(false);

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
  }, [open, editing]);

  if (!open) return null;

  const toggleTool = (id: WorkspaceToolId) => {
    setTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const save = async () => {
    if (busy) return;
    const trimmed = name.trim() || "Vault";
    setBusy(true);
    try {
      if (isCreate) {
        await createWorkspace({ name: trimmed, tools, aiMode });
      } else if (editing) {
        updateWorkspace(editing.id, { name: trimmed, tools, aiMode });
        close();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={close}>
      <Panel className="p-6">
        <MonoLabel>Workspace</MonoLabel>
        <h2 className="mt-2 font-serif text-3xl italic tracking-tight">
          {isCreate ? "New workspace" : "Edit workspace"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Each workspace is its own vault of notes, board, and calendar — with tools and AI mode you
          pick here.
        </p>

        <div className="mt-6 space-y-6">
          <label className="block">
            <MonoLabel>Name</MonoLabel>
            <Field
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vault"
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
                      onClick={() => toggleTool(opt.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150",
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
                        <span className="block font-serif text-sm text-ink">{opt.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-faint">
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
                    body: "Gemini API for Organize and writing tools. Key stays in Settings.",
                  },
                  {
                    id: "local" as const,
                    title: "Local",
                    body: "No cloud calls. Brain dump uses on-device heuristics; writing tools stay off.",
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
                      "rounded-xl border px-3 py-3 text-left transition-colors duration-150",
                      on
                        ? "border-ink/25 bg-paper-2"
                        : "border-line bg-paper text-mute hover:border-ink/20 hover:text-ink",
                    )}
                  >
                    <span className="font-serif text-sm text-ink">{opt.title}</span>
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
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SolidButton onClick={() => void save()} disabled={busy}>
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
