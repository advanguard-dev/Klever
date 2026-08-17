import { BrainDump, AiSettings } from "@/components/ai/BrainDump";
import { GlobalCalendar } from "@/components/calendar/GlobalCalendar";
import { PlusMenu } from "@/components/insert/PlusMenu";
import { CommandPalette } from "@/components/command/CommandPalette";
import { DatabasePage } from "@/components/db/DatabasePage";
import { NotePage } from "@/components/editor/NotePage";
import { FreeformView } from "@/components/freeform/FreeformView";
import { GraphView } from "@/components/graph/GraphView";
import { RightRail, TagPage } from "@/components/layout/RightRail";
import { Sidebar } from "@/components/layout/Sidebar";
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

  return (
    <div className="flex h-screen flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b border-line px-4">
        {!sidebarOpen && (
          <ToolbarBtn label="Sidebar" aria-label="Open sidebar" onClick={toggleSidebar}>
            <PanelLeft size={15} strokeWidth={1.4} />
          </ToolbarBtn>
        )}
        {view.kind === "note" && (
          <Segmented
            aria-label="Editor mode"
            value={mode}
            onChange={(m) => setMode(m)}
            options={EDITOR_MODES.map((m) => ({
              value: m,
              label: EDITOR_MODE_LABEL[m],
              icon: MODE_ICONS[m],
            }))}
          />
        )}
        <div className="ml-auto flex items-center gap-1">
          <ToolbarBtn label="Today" aria-label="Today's note" title="Today · ⌘⇧T" onClick={() => createDaily()}>
            <NotebookPen size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          {tools.calendar && (
            <ToolbarBtn
              label="Calendar"
              aria-label="Calendar"
              showLabel
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
              active={view.kind === "freeform"}
              onClick={() => setView({ kind: "freeform" })}
            >
              <LayoutDashboard size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
          {tools.brainDump && (
            <ToolbarBtn label="Dump" aria-label="Brain dump" onClick={() => setDumpOpen(true)}>
              <Sparkles size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
          <ToolbarBtn
            label="Import MD"
            aria-label="Import markdown"
            title="Import markdown"
            onClick={() => void importMarkdown()}
          >
            <FileUp size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn label="Settings" aria-label="AI settings" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <span className="mx-2 inline-flex">
            <Toggle
              checked={theme === "dark"}
              onChange={(on) => setTheme(on ? "dark" : "light")}
              label="Dark"
            />
          </span>
          <ToolbarBtn
            label="Context"
            aria-label={propsOpen ? "Hide context" : "Show context"}
            active={propsOpen}
            onClick={toggleProps}
            className="hidden md:inline-flex"
          >
            <PanelRight size={15} strokeWidth={1.4} />
          </ToolbarBtn>
        </div>
      </header>

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
        <main
          className={`relative min-h-0 min-w-0 flex-1 ${
            view.kind === "freeform" || view.kind === "graph" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {view.kind === "note" && note && <NotePage key={note.id} note={note} />}
          {view.kind === "database" && note && (
            <DatabasePage key={note.id} note={note} viewId={view.viewId} />
          )}
          {view.kind === "graph" && tools.graph && <GraphView />}
          {view.kind === "calendar" && tools.calendar && <GlobalCalendar />}
          {view.kind === "freeform" && tools.board && <FreeformView />}
          {view.kind === "tag" && <TagPage tag={view.tag} />}
          {(view.kind === "note" || view.kind === "database") && !note && (
            <EmptyState
              title="This note is gone"
              description="It was deleted or is not in this vault."
            />
          )}
        </main>
        <RightRail />
      </div>

      <footer className="flex h-9 shrink-0 items-center justify-between border-t border-line px-4">
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
