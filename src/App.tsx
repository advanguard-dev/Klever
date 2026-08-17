import { AppShell } from "@/components/layout/AppShell";
import { Welcome } from "@/components/layout/Welcome";
import { WorkspaceSetup } from "@/components/layout/WorkspaceSetup";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import { nextEditorMode } from "@/types";
import { useEffect } from "react";

export function App() {
  const ready = useApp((s) => s.ready);
  const view = useApp((s) => s.view);
  const hydrate = useApp((s) => s.hydrate);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const setDumpOpen = useApp((s) => s.setDumpOpen);
  const setView = useApp((s) => s.setView);
  const createPage = useApp((s) => s.createPage);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const createDaily = useApp((s) => s.createDaily);
  const setMode = useApp((s) => s.setMode);
  const mode = useApp((s) => s.mode);
  const commandOpen = useApp((s) => s.commandOpen);
  const dumpOpen = useApp((s) => s.dumpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const closeWorkspaceSetup = useApp((s) => s.closeWorkspaceSetup);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const tools =
    workspaces.find((w) => w.id === activeWorkspaceId)?.tools ?? defaultWorkspaceTools();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
      if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createPage();
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "g" && tools.graph) {
        e.preventDefault();
        setView({ kind: "graph" });
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "d" && tools.brainDump) {
        e.preventDefault();
        setDumpOpen(true);
      }
      if (meta && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        createDaily();
      }
      if (meta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setMode(nextEditorMode(mode));
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
        setDumpOpen(false);
        setSettingsOpen(false);
        setPlusOpen(false);
        closeWorkspaceSetup();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    closeWorkspaceSetup,
    commandOpen,
    createDaily,
    createPage,
    dumpOpen,
    mode,
    setCommandOpen,
    setDumpOpen,
    setMode,
    setSettingsOpen,
    setView,
    setPlusOpen,
    toggleSidebar,
    tools.brainDump,
    tools.graph,
  ]);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Vault</span>
        <p className="font-serif text-5xl italic tracking-tight">Klever</p>
      </div>
    );
  }

  if (view.kind === "welcome") {
    return (
      <>
        <Welcome />
        <WorkspaceSetup />
      </>
    );
  }
  return <AppShell />;
}
