import type { Workspace, WorkspaceAiMode, WorkspaceToolId, WorkspaceTools } from "@/types";
import { nid } from "@/lib/ids";
import { normalizeWorkspaceLock } from "@/lib/workspace-lock";

export const WORKSPACE_TOOL_OPTIONS: {
  id: WorkspaceToolId;
  label: string;
  hint: string;
}[] = [
  { id: "brainDump", label: "Brain Dump", hint: "Turn a dump into pages, lists, and events" },
  { id: "meeting", label: "Meetings", hint: "A list of meeting pages, with transcription on each page" },
  { id: "board", label: "Board", hint: "A freeform canvas" },
  { id: "calendar", label: "Calendar", hint: "Dates and events" },
  { id: "graph", label: "Graph", hint: "A map of linked pages" },
  { id: "writingTools", label: "Writing tools", hint: "Rewrite and polish in the editor" },
  {
    id: "suggestions",
    label: "Suggestions",
    hint: "Read a page for events, reminders, lists, and proofreading",
  },
];

export function defaultWorkspaceTools(): WorkspaceTools {
  return {
    brainDump: true,
    meeting: true,
    board: true,
    calendar: true,
    graph: true,
    writingTools: true,
    suggestions: true,
  };
}

export function normalizeWorkspaceTools(tools?: Partial<WorkspaceTools> | null): WorkspaceTools {
  const base = defaultWorkspaceTools();
  if (!tools) return base;
  return {
    brainDump: tools.brainDump !== false,
    meeting: tools.meeting !== false,
    board: tools.board !== false,
    calendar: tools.calendar !== false,
    graph: tools.graph !== false,
    writingTools: tools.writingTools !== false,
    suggestions: tools.suggestions !== false,
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
    lock: normalizeWorkspaceLock(w.lock),
  };
}
