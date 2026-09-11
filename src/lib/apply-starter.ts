import { STARTERS, starterCopy, type Starter } from "@/lib/starters";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import type { Note } from "@/types";

function uniqueBoardTitle(title: string, existing: string[]) {
  const used = new Set(existing.map((t) => t.trim().toLowerCase()));
  const base = title.trim() || "Board";
  if (!used.has(base.toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

function seedDatabase(starter: Starter, title: string) {
  const app = useApp.getState();
  const locale = app.locale;
  const seed = starter.seed;
  if (seed.type !== "database" && seed.type !== "pack") return "";
  const dbId = app.createDatabase({
    title,
    icon: seed.type === "pack" ? seed.databaseIcon : starter.icon,
    schema: seed.schema(locale),
    views: seed.views,
    viewType: seed.viewType,
    stay: true,
  });
  for (const row of seed.rows?.(locale) ?? []) {
    app.createPage({
      parent: dbId,
      title: row.title,
      body: row.body,
      icon: row.icon,
      props: row.props,
      stay: true,
    });
  }
  return dbId;
}

export function runStarter(id: string) {
  const starter = STARTERS.find((s) => s.id === id);
  if (!starter) return;
  const app = useApp.getState();
  const locale = app.locale;
  const copy = starterCopy(starter, locale);
  const tools =
    app.workspaces.find((w) => w.id === app.activeWorkspaceId)?.tools ?? defaultWorkspaceTools();
  if (starter.kind === "board" && !tools.board) {
    app.setError("Boards are off in this workspace.");
    return;
  }

  const seed = starter.seed;
  if (starter.blank) {
    if (seed.type === "page") {
      app.createPage({ icon: starter.icon });
      return;
    }
    if (seed.type === "database") {
      const dbId = app.createDatabase({
        schema: seed.schema(locale),
        viewType: seed.viewType,
        views: seed.views,
        icon: starter.icon,
      });
      app.setView({ kind: "database", id: dbId });
      return;
    }
    if (seed.type === "board") {
      app.createBoard();
      return;
    }
  }
  if (seed.type === "page") {
    app.createPage({
      title: copy.title,
      icon: starter.icon,
      tags: seed.tags,
      body: seed.body(locale),
    });
    return;
  }
  if (seed.type === "database") {
    const dbId = seedDatabase(starter, copy.title);
    if (!dbId) return;
    const db = useApp.getState().notes.find((n) => n.id === dbId);
    const viewId =
      db?.views?.find((v) => v.type === seed.viewType)?.id ?? db?.views?.[0]?.id;
    app.setView({ kind: "database", id: dbId, viewId });
    return;
  }
  if (seed.type === "board") {
    const built = seed.build(locale);
    app.createBoard(uniqueBoardTitle(copy.title, app.boards.map((b) => b.title)), {
      objects: built.objects,
      connections: built.connections,
    });
    return;
  }
  const dbTitle = seed.databaseTitle(locale);
  const dbId = seedDatabase(starter, dbTitle);
  const db = useApp.getState().notes.find((n) => n.id === dbId);
  app.createPage({
    title: copy.title,
    icon: starter.icon,
    tags: seed.tags,
    body: seed.pageBody(locale, db?.title ?? dbTitle),
  });
}

export function runVaultTemplate(note: Note) {
  useApp.getState().duplicateNote(note.id);
}
