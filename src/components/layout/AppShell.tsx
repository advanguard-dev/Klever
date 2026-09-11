import { BrainDump, AiSettings } from "@/components/ai/BrainDump";
import { MeetingView } from "@/components/ai/MeetingView";
import { GlobalCalendar } from "@/components/calendar/GlobalCalendar";
import { PlusMenu } from "@/components/insert/PlusMenu";
import { CommandPalette } from "@/components/command/CommandPalette";
import { EditorModeSwitch } from "@/components/editor/EditorModeSwitch";
import { PresentView } from "@/components/editor/PresentView";
import { RelateDialog } from "@/components/editor/RelateDialog";
import { FreeformView } from "@/components/freeform/FreeformView";
import { RightRail, TagPage } from "@/components/layout/RightRail";
import { Sidebar } from "@/components/layout/Sidebar";
import { FileDropZone } from "@/components/layout/FileDropZone";
import { SplitPageDialog } from "@/components/layout/SplitPageDialog";
import { SplitWorkspace } from "@/components/layout/SplitWorkspace";
import { TitleBar } from "@/components/layout/TitleBar";
import { WorkspaceSetup } from "@/components/layout/WorkspaceSetup";
import { Alert, ToolbarBtn } from "@/components/ui";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import { Brain, Columns2, Moon, PanelLeft, PanelRight, Search, Settings, Sun } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";

const GraphView = lazy(() =>
  import("@/components/graph/GraphView").then((m) => ({ default: m.GraphView })),
);

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
  const presenting = useApp((s) => s.presenting);
  const propsOpen = useApp((s) => s.propsOpen);
  const toggleProps = useApp((s) => s.toggleProps);
  const split = useApp((s) => s.split);
  const closeSplit = useApp((s) => s.closeSplit);
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

  const present = view.kind === "note" && presenting && note;

  return (
    <div className="flex h-dvh flex-col bg-blotter text-ink">
      <SkipLink />
      {present ? (
        <main id="klever-main" className="flex min-h-0 flex-1 flex-col">
          <PresentView note={present} />
        </main>
      ) : view.kind === "freeform" && tools.board ? (
        <main id="klever-main" className="flex min-h-0 flex-1 flex-col">
          <FreeformView key={view.id ?? "board"} />
        </main>
      ) : (
        <>
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
              {split && (
                <ToolbarBtn
                  label={t("split.close")}
                  aria-label={t("split.close")}
                  active
                  onClick={closeSplit}
                >
                  <Columns2 size={15} strokeWidth={1.4} />
                </ToolbarBtn>
              )}
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
              {view.kind === "note" || view.kind === "database" ? (
                <SplitWorkspace className={sidebarOpen ? "klever-sheet" : "bg-paper"} />
              ) : (
                <FileDropZone
                  className={`relative min-h-0 min-w-0 flex-1 ${
                    sidebarOpen ? "klever-sheet" : "bg-paper"
                  } ${
                    view.kind === "freeform" || view.kind === "graph"
                      ? "overflow-hidden"
                      : "overflow-y-auto scroll-pt-12"
                  }`}
                >
                  {view.kind === "graph" && tools.graph && (
                    <Suspense fallback={null}>
                      <GraphView />
                    </Suspense>
                  )}
                  {view.kind === "calendar" && tools.calendar && <GlobalCalendar />}
                  {view.kind === "meeting" && tools.meeting && <MeetingView />}
                  {view.kind === "tag" && <TagPage tag={view.tag} />}
                </FileDropZone>
              )}
            </main>
            <RightRail />
          </div>
        </>
      )}

      {error && (
        <Alert
          className="fixed bottom-12 left-1/2 z-[70] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 font-mono text-xs"
          tone="danger"
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
      <RelateHost />
      <SplitPageDialog />
    </div>
  );
}

function RelateHost() {
  const notes = useApp((s) => s.notes);
  const relateNoteId = useApp((s) => s.relateNoteId);
  const setRelateNoteId = useApp((s) => s.setRelateNoteId);
  const relateNote = relateNoteId ? notes.find((n) => n.id === relateNoteId) : undefined;
  if (!relateNote) return null;
  return <RelateDialog note={relateNote} open onClose={() => setRelateNoteId(null)} />;
}
