import { ContextMenuHost } from "@/components/ContextMenu";
import { AppShell } from "@/components/layout/AppShell";
import { Welcome } from "@/components/layout/Welcome";
import { UnlockWorkspace } from "@/components/layout/UnlockWorkspace";
import { WorkspaceSetup } from "@/components/layout/WorkspaceSetup";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { applyDocumentLang } from "@/lib/i18n";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import { nextEditorMode } from "@/types";
import { useEffect } from "react";

declare global {
  interface Window {
    __kleverFlush?: () => Promise<void>;
  }
}

export function App() {
  const t = useT();
  const ready = useApp((s) => s.ready);
  const locale = useApp((s) => s.locale);
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
  const flushNow = useApp((s) => s.flushNow);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const tools =
    workspaces.find((w) => w.id === activeWorkspaceId)?.tools ?? defaultWorkspaceTools();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    applyDocumentLang(locale);
  }, [locale]);

  useEffect(() => {
    window.__kleverFlush = flushNow;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      void flushNow();
    };
    const onPageHide = () => {
      void flushNow();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      delete window.__kleverFlush;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flushNow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (view.kind === "welcome" || view.kind === "unlock") {
        if (e.key === "Escape") closeWorkspaceSetup();
        return;
      }
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
      if (meta && e.shiftKey && e.key.toLowerCase() === "m" && tools.meeting) {
        e.preventDefault();
        setView({ kind: "meeting" });
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
        if (mode === "read") return;
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
    tools.meeting,
    view.kind,
  ]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{t("shell.vault")}</span>
        <p className="font-serif text-5xl font-semibold tracking-tight">Klever</p>
      </div>
    );
  }

  if (view.kind === "welcome") {
    return (
      <ContextMenuHost>
        <Welcome />
        <WorkspaceSetup />
      </ContextMenuHost>
    );
  }
  if (view.kind === "unlock") {
    return (
      <ContextMenuHost>
        <UnlockWorkspace />
        <WorkspaceSetup />
      </ContextMenuHost>
    );
  }
  return (
    <ContextMenuHost>
      <AppShell />
    </ContextMenuHost>
  );
}
