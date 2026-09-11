import { mergeFolderIcons } from "@/lib/folders";
import { notesFromFiles } from "@/lib/parse";
import {
  saveBlobs,
  saveBoards,
  saveEvents,
  saveFiles,
  saveWorkspaceVaultMeta,
  saveWorkspacesRegistry,
} from "@/lib/persist";
import { sessionDekFor } from "@/lib/vault-session";
import { isEncryptedWorkspace } from "@/lib/workspace-lock";
import { createWorkspaceDraft, defaultWorkspaceTools } from "@/lib/workspaces";
import type { FreeformBoard, Note, Workspace } from "@/types";

type FixtureStoreSlice = {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
};

/** Dev-only Orchard lattice fixture — load notes/boards into a disposable workspace. */
export async function bootGraphFixture(opts: {
  get: () => FixtureStoreSlice;
  /** Full app snapshot for flush — typed loosely to avoid coupling to AppState. */
  flush: (s: FixtureStoreSlice & Record<string, unknown>) => Promise<void>;
  clearPersistTimer: () => void;
  detachVault: () => void;
  vaultFiles: (notes: Note[], folderIcons: Record<string, string>) => Record<string, string>;
  set: (partial: Record<string, unknown>) => void;
  schedule: () => void;
}): Promise<void> {
  if (!import.meta.env.DEV) return;
  const {
    GRAPH_FIXTURE_BOARDS,
    GRAPH_FIXTURE_FILES,
    GRAPH_FIXTURE_NAME,
    GRAPH_FIXTURE_STARRED,
  } = await import("@/lib/graph-fixture");

  opts.clearPersistTimer();
  const s = opts.get();
  if (s.activeWorkspaceId) await opts.flush(s as FixtureStoreSlice & Record<string, unknown>);

  opts.detachVault();

  const notes = notesFromFiles(GRAPH_FIXTURE_FILES);
  const boards: FreeformBoard[] = GRAPH_FIXTURE_BOARDS;
  const folderIcons = mergeFolderIcons(GRAPH_FIXTURE_FILES);
  const starred = GRAPH_FIXTURE_STARRED.filter((id) => notes.some((n) => n.id === id));
  const openTabs = ["welcome", "atlas"].filter((id) => notes.some((n) => n.id === id));

  const reusable = s.workspaces.find(
    (w) => w.name === GRAPH_FIXTURE_NAME && !isEncryptedWorkspace(w),
  );
  const ws =
    reusable ??
    createWorkspaceDraft({
      name: GRAPH_FIXTURE_NAME,
      tools: defaultWorkspaceTools(),
      aiMode: "local",
    });
  const workspaces = reusable ? s.workspaces : [...s.workspaces, ws];
  const dek = sessionDekFor(ws.id) ?? null;

  await saveFiles(opts.vaultFiles(notes, folderIcons), ws.id, dek);
  await saveBlobs({}, ws.id, dek);
  await saveEvents([], ws.id, dek);
  await saveBoards(boards, ws.id, dek);
  await saveWorkspaceVaultMeta(ws.id, {
    hasVault: true,
    lastPath: GRAPH_FIXTURE_NAME,
    recents: starred,
    starred,
    openTabs,
    folderIcons,
  });

  opts.set({
    workspaces,
    activeWorkspaceId: ws.id,
    notes,
    blobs: {},
    events: [],
    boards,
    view: { kind: "graph" },
    folderName: GRAPH_FIXTURE_NAME,
    recents: starred,
    starred,
    openTabs,
    split: null,
    folderIcons,
    query: "",
    dumpOpen: false,
    relateNoteId: null,
    plusOpen: false,
    workspaceSetupOpen: false,
    workspaceSetupId: null,
    error: null,
    unlocked: true,
    mode: "wysiwyg",
    presenting: false,
  });
  await saveWorkspacesRegistry({ activeId: ws.id, workspaces });
  opts.schedule();
}
