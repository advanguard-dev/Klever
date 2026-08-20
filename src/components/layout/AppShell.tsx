import { BrainDump, AiSettings } from "@/components/ai/BrainDump";
import { GlobalCalendar } from "@/components/calendar/GlobalCalendar";
import { PlusMenu } from "@/components/insert/PlusMenu";
import { CommandPalette } from "@/components/command/CommandPalette";
import { DatabasePage } from "@/components/db/DatabasePage";
import { NotePage } from "@/components/editor/NotePage";
import { ReadingView } from "@/components/editor/ReadingView";
import { FreeformView } from "@/components/freeform/FreeformView";
import { GraphView } from "@/components/graph/GraphView";
import { PageTabs } from "@/components/layout/PageTabs";
import { RightRail, TagPage } from "@/components/layout/RightRail";
import { Sidebar } from "@/components/layout/Sidebar";
import { FileDropZone } from "@/components/layout/FileDropZone";
import { TitleBar } from "@/components/layout/TitleBar";
import { WorkspaceSetup } from "@/components/layout/WorkspaceSetup";
import { Alert, EmptyState, Kbd, Segmented, Toggle, ToolbarBtn } from "@/components/ui";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import { EDITOR_MODES, EDITOR_MODE_LABEL } from "@/types";
import { MODE_ICONS } from "@/lib/chrome-icons";
import {
  Calendar,
  FileUp,
  LayoutDashboard,
  NotebookPen,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect } from "react";

export function AppShell() {
  const view = useApp((s) => s.view);
  const notes = useApp((s) => s.notes);
  const sidebarOpen = useApp((s) => s.sidebarOpen);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const setView = useApp((s) => s.setView);
  const setDumpOpen = useApp((s) => s.setDumpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const createDaily = useApp((s) => s.createDaily);
  const importMarkdown = useApp((s) => s.importMarkdown);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const peers = useApp((s) => s.peers);
  const propsOpen = useApp((s) => s.propsOpen);
  const toggleProps = useApp((s) => s.toggleProps);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const tools =
    workspaces.find((w) => w.id === activeWorkspaceId)?.tools ?? defaultWorkspaceTools();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const collapse = () => {
      if (mq.matches) useApp.setState({ sidebarOpen: false, propsOpen: false });
    };
    collapse();
    mq.addEventListener("change", collapse);
    return () => mq.removeEventListener("change", collapse);
  }, []);

  const note =
    view.kind === "note" || view.kind === "database"
      ? notes.find((n) => n.id === view.id)
      : undefined;

  if (view.kind === "note" && mode === "read" && note) {
    return (
      <div className="flex h-dvh flex-col bg-paper text-ink">
        <ReadingView note={note} />
        {error && (
          <Alert
            className="fixed bottom-12 left-1/2 z-50 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 font-mono text-xs"
            onDismiss={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        <CommandPalette />
        <PlusMenu />
        <BrainDump />
        <AiSettings />
        <WorkspaceSetup />
      </div>
    );
  }

  if (view.kind === "freeform" && tools.board) {
    return (
      <div className="flex h-dvh flex-col bg-paper text-ink">
        <FreeformView key={view.id ?? "board"} />
        {error && (
          <Alert
            className="fixed bottom-12 left-1/2 z-50 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 font-mono text-xs"
            onDismiss={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        <CommandPalette />
        <PlusMenu />
        <BrainDump />
        <AiSettings />
        <WorkspaceSetup />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <TitleBar>
        {!sidebarOpen && (
          <ToolbarBtn label="Sidebar" aria-label="Open sidebar" onClick={toggleSidebar}>
            <PanelLeft size={15} strokeWidth={1.4} />
          </ToolbarBtn>
        )}
        {view.kind === "note" && (
          <Segmented
            aria-label="Editor mode"
            size="sm"
            value={mode}
            onChange={(m) => setMode(m)}
            options={EDITOR_MODES.map((m) => ({
              value: m,
              label: EDITOR_MODE_LABEL[m],
              icon: MODE_ICONS[m],
              iconOnly: m === "markdown",
            }))}
          />
        )}
        <div className="ml-auto flex items-center gap-0.5 md:gap-1">
          <ToolbarBtn
            label="Search"
            aria-label="Search"
            title="Search · ⌘K"
            onClick={() => setCommandOpen(true)}
          >
            <Search size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Today"
            aria-label="Today's note"
            title="Today · ⌘⇧T"
            className="hidden md:inline-flex"
            onClick={() => createDaily()}
          >
            <NotebookPen size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          {tools.calendar && (
            <ToolbarBtn
              label="Calendar"
              aria-label="Calendar"
              showLabel
              className="hidden md:inline-flex"
              active={view.kind === "calendar"}
              onClick={() => setView({ kind: "calendar" })}
            >
              <Calendar size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
          {tools.board && (
            <ToolbarBtn
              label="Board"
              aria-label="Board"
              showLabel
              className="hidden md:inline-flex"
              active={view.kind === "freeform"}
              onClick={() => setView({ kind: "freeform" })}
            >
              <LayoutDashboard size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
          <span className="mx-1 hidden h-5 w-px bg-line md:block" aria-hidden />
          {tools.brainDump && (
            <ToolbarBtn label="Dump" aria-label="Brain dump" onClick={() => setDumpOpen(true)}>
              <Sparkles size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
          <ToolbarBtn
            label="Import MD"
            aria-label="Import markdown"
            title="Import markdown"
            className="hidden md:inline-flex"
            onClick={() => void importMarkdown()}
          >
            <FileUp size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn label="Settings" aria-label="AI settings" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <span className="mx-2 hidden md:inline-flex">
            <Toggle
              checked={theme === "dark"}
              onChange={(on) => setTheme(on ? "dark" : "light")}
              label="Dark"
            />
          </span>
          {(view.kind === "note" || view.kind === "database") && (
            <ToolbarBtn
              label="Context"
              aria-label={propsOpen ? "Hide context" : "Show context"}
              active={propsOpen}
              onClick={toggleProps}
            >
              <PanelRight size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
        </div>
      </TitleBar>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <>
            <button
              type="button"
              aria-label="Close sidebar"
              className="absolute inset-0 z-30 bg-ink/15 md:hidden"
              onClick={toggleSidebar}
            />
            <Sidebar />
          </>
        )}
        <FileDropZone
          className={`relative min-h-0 min-w-0 flex-1 ${
            view.kind === "freeform" || view.kind === "graph" ? "overflow-hidden" : "overflow-y-auto"
          }`}
          attachToNoteId={view.kind === "note" ? view.id : undefined}
        >
          {(view.kind === "note" || view.kind === "database") && (
            <div className="sticky top-0 z-20 bg-paper">
              <PageTabs />
            </div>
          )}
          {view.kind === "note" && note && <NotePage key={note.id} note={note} />}
          {view.kind === "database" && note && (
            <DatabasePage key={note.id} note={note} viewId={view.viewId} />
          )}
          {view.kind === "graph" && tools.graph && <GraphView />}
          {view.kind === "calendar" && tools.calendar && <GlobalCalendar />}
          {view.kind === "tag" && <TagPage tag={view.tag} />}
          {(view.kind === "note" || view.kind === "database") && !note && (
            <EmptyState
              title="This note is gone"
              description="It was deleted or is not in this vault."
            />
          )}
        </FileDropZone>
        <RightRail />
      </div>

      <footer className="hidden h-9 shrink-0 items-center justify-between border-t border-line px-4 pb-[env(safe-area-inset-bottom)] md:flex md:pb-0">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-wide text-mute">
          {notes.length} files · markdown · local
          {peers.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users size={12} strokeWidth={1.4} aria-hidden />
              {peers.length} other tab{peers.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          <Kbd>⌘K</Kbd>
          <Kbd>⌘E</Kbd>
          <Kbd>⌘⇧T today</Kbd>
          {tools.brainDump && <Kbd>⌘⇧D dump</Kbd>}
          {tools.graph && <Kbd>⌘⇧G graph</Kbd>}
        </span>
      </footer>

      {error && (
        <Alert
          className="fixed bottom-12 left-1/2 z-50 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 font-mono text-xs"
          onDismiss={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <CommandPalette />
      <PlusMenu />
      <BrainDump />
      <AiSettings />
      <WorkspaceSetup />
    </div>
  );
}
