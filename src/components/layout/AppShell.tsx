import { BrainDump, AiSettings } from "@/components/ai/BrainDump";
import { MeetingView } from "@/components/ai/MeetingView";
import { GlobalCalendar } from "@/components/calendar/GlobalCalendar";
import { PlusMenu } from "@/components/insert/PlusMenu";
import { CommandPalette } from "@/components/command/CommandPalette";
import { DatabasePage } from "@/components/db/DatabasePage";
import { EditorModeSwitch } from "@/components/editor/EditorModeSwitch";
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
import { Alert, EmptyState, ToolbarBtn } from "@/components/ui";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import { Brain, Moon, PanelLeft, PanelRight, Search, Settings, Sun } from "lucide-react";
import { useEffect } from "react";

function SkipLink() {
  const t = useT();
  return (
    <a
      href="#klever-main"
      className="sr-only klever-focus rounded-md bg-paper px-3 py-2 text-sm font-medium text-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-[80]"
    >
      {t("shell.skip")}
    </a>
  );
}

export function AppShell() {
  const t = useT();
  const view = useApp((s) => s.view);
  const notes = useApp((s) => s.notes);
  const sidebarOpen = useApp((s) => s.sidebarOpen);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const setDumpOpen = useApp((s) => s.setDumpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);
  const mode = useApp((s) => s.mode);
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
      <div className="flex h-dvh flex-col bg-blotter text-ink">
        <SkipLink />
        <main id="klever-main" className="flex min-h-0 flex-1 flex-col">
          <ReadingView note={note} />
        </main>
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
      <div className="flex h-dvh flex-col bg-blotter text-ink">
        <SkipLink />
        <main id="klever-main" className="flex min-h-0 flex-1 flex-col">
          <FreeformView key={view.id ?? "board"} />
        </main>
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
    <div className="flex h-dvh flex-col bg-blotter text-ink">
      <SkipLink />
      <TitleBar>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {!sidebarOpen && (
            <ToolbarBtn
              label={t("shell.sidebar")}
              aria-label={t("shell.openSidebar")}
              onClick={toggleSidebar}
            >
              <PanelLeft size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {view.kind === "note" && <EditorModeSwitch />}
          {view.kind === "note" && (
            <span className="mx-1.5 hidden h-4 w-px bg-line sm:block" aria-hidden />
          )}
          <ToolbarBtn
            label={t("shell.search")}
            aria-label={t("shell.search")}
            title={t("shell.searchHint")}
            onClick={() => setCommandOpen(true)}
          >
            <Search size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          {tools.brainDump && (
            <ToolbarBtn
              label={t("shell.brainDump")}
              aria-label={t("shell.brainDump")}
              shortcut="⌘⇧D"
              onClick={() => setDumpOpen(true)}
            >
              <Brain size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          )}
          <ToolbarBtn
            label={t("shell.settings")}
            aria-label={t("shell.settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={15} strokeWidth={1.4} />
          </ToolbarBtn>
          <ToolbarBtn
            label={theme === "dark" ? t("shell.lightTheme") : t("shell.darkTheme")}
            aria-label={theme === "dark" ? t("shell.useLight") : t("shell.useDark")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun size={15} strokeWidth={1.4} />
            ) : (
              <Moon size={15} strokeWidth={1.4} />
            )}
          </ToolbarBtn>
          {(view.kind === "note" || view.kind === "database") && (
            <ToolbarBtn
              label={t("shell.context")}
              aria-label={propsOpen ? t("shell.hideContext") : t("shell.showContext")}
              className="hidden md:inline-flex"
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
              aria-label={t("shell.closeSidebar")}
              className="absolute inset-0 z-30 bg-ink/20 md:hidden"
              onClick={toggleSidebar}
            />
            <Sidebar />
          </>
        )}
        <main id="klever-main" className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <FileDropZone
          className={`relative min-h-0 min-w-0 flex-1 ${
            sidebarOpen ? "klever-sheet" : "bg-paper"
          } ${
            view.kind === "freeform" || view.kind === "graph"
              ? "overflow-hidden"
              : "overflow-y-auto scroll-pt-12"
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
          {view.kind === "meeting" && tools.meeting && <MeetingView />}
          {view.kind === "tag" && <TagPage tag={view.tag} />}
          {(view.kind === "note" || view.kind === "database") && !note && (
            <EmptyState
              title={t("shell.pageGone")}
              description={t("shell.pageGoneDesc")}
            />
          )}
        </FileDropZone>
        </main>
        <RightRail />
      </div>

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
