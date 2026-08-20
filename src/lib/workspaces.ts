import type { Workspace, WorkspaceAiMode, WorkspaceToolId, WorkspaceTools } from "@/types";
import { nid } from "@/lib/ids";

export const WORKSPACE_TOOL_OPTIONS: {
  id: WorkspaceToolId;
  label: string;
  hint: string;
}[] = [
  { id: "brainDump", label: "Brain Dump", hint: "Organize messy notes into pages and events" },
  { id: "board", label: "Board", hint: "Freeform whiteboards" },
  { id: "calendar", label: "Calendar", hint: "Dates and events" },
  { id: "graph", label: "Graph", hint: "Link map of notes" },
  { id: "writingTools", label: "Writing tools", hint: "Rewrite / polish in the editor (remote AI)" },
];

export function defaultWorkspaceTools(): WorkspaceTools {
  return {
    brainDump: true,
    board: true,
    calendar: true,
    graph: true,
    writingTools: true,
  };
}

export function normalizeWorkspaceTools(tools?: Partial<WorkspaceTools> | null): WorkspaceTools {
  const base = defaultWorkspaceTools();
  if (!tools) return base;
  return {
    brainDump: tools.brainDump !== false,
    board: tools.board !== false,
    calendar: tools.calendar !== false,
    graph: tools.graph !== false,
    writingTools: tools.writingTools !== false,
  };
}

export function normalizeAiMode(mode?: string | null): WorkspaceAiMode {
  return mode === "local" ? "local" : "remote";
}

export function createWorkspaceDraft(opts?: {
  name?: string;
  tools?: Partial<WorkspaceTools>;
  aiMode?: WorkspaceAiMode;
}): Workspace {
  const now = new Date().toISOString();
  return {
    id: nid(12),
    name: (opts?.name ?? "Vault").trim() || "Vault",
    tools: normalizeWorkspaceTools(opts?.tools),
    aiMode: normalizeAiMode(opts?.aiMode),
    created: now,
    updated: now,
  };
}

export function normalizeWorkspace(raw: unknown): Workspace | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.id !== "string" || !w.id) return null;
  const now = new Date().toISOString();
  return {
    id: w.id,
    name: typeof w.name === "string" && w.name.trim() ? w.name.trim() : "Vault",
    tools: normalizeWorkspaceTools(w.tools as Partial<WorkspaceTools> | undefined),
    aiMode: normalizeAiMode(typeof w.aiMode === "string" ? w.aiMode : null),
    created: typeof w.created === "string" ? w.created : now,
    updated: typeof w.updated === "string" ? w.updated : now,
  };
}
