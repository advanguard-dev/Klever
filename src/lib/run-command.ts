import { assetKindFromPath } from "@/lib/assets";
import { defaultFileDisplay, serializeFileMarkdown } from "@/lib/file-display";
import { insertInEditor, insertWysiwygCommand, openLinkEmbed } from "@/lib/editor-bridge";
import { speechSupported, startTranscription } from "@/lib/speech";
import { attachMeetingNotes, createMeetingNote } from "@/lib/meetings";
import { useApp } from "@/store";
import type { InsertCommand } from "@/types";

function currentNoteId() {
  const { view } = useApp.getState();
  return view.kind === "note" ? view.id : null;
}

function currentDbId() {
  const { view } = useApp.getState();
  return view.kind === "database" ? view.id : null;
}

function appendOrInsert(snippet: string) {
  if (insertInEditor(snippet)) return;
  const app = useApp.getState();
  const id = currentNoteId();
  if (id) {
    const note = app.notes.find((n) => n.id === id);
    if (note) {
      const body = note.body.trimEnd();
      app.patchNote(id, { body: body ? `${body}\n${snippet}` : snippet });
      return;
    }
  }
  app.createPage({ body: snippet });
}

async function insertAsset(accept: string, kind: "image" | "audio" | "file") {
  const paths = await useApp.getState().linkLocalFiles(accept);
  if (!paths.length) return;
  const blocks = paths.map((path) => {
    const name = path.split("/").pop() ?? path;
    const detected = kind === "file" ? assetKindFromPath(path, name) : kind;
    return serializeFileMarkdown({ src: path, name, kind: detected, display: defaultFileDisplay(detected) });
  });
  appendOrInsert(`${blocks.join("\n\n")}\n`);
}

export async function runCommand(cmd: InsertCommand) {
  const app = useApp.getState();
  app.setPlusOpen(false);

  switch (cmd.action) {
    case "page":
      app.createPage();
      return;
    case "split-page":
      if (currentNoteId()) app.setPageSplitOpen(true);
      return;
    case "daily":
      app.createDaily();
      return;
    case "new-template":
      app.createPage({ title: "Template", template: true, body: "This page is a template. Duplicate it from +.\n" });
      return;
    case "from-template":
      if (cmd.templateId) app.duplicateNote(cmd.templateId);
      return;
    case "database":
      app.createDatabase({ viewType: cmd.viewType });
      return;
    case "row": {
      const db = currentDbId();
      if (db) app.createPage({ parent: db, stay: true });
      return;
    }
    case "add-view": {
      const db = currentDbId();
      if (db && cmd.viewType) app.addDatabaseView(db, cmd.viewType);
      return;
    }
    case "snippet":
      if (insertWysiwygCommand(cmd.id)) return;
      appendOrInsert(cmd.snippet ?? "");
      return;
    case "embed": {
      if (openLinkEmbed({ mode: "embed" })) return;
      const url = window.prompt("URL to embed");
      if (url?.trim()) appendOrInsert(`<${url.trim()}>\n`);
      return;
    }
    case "image":
      await insertAsset("image/*", "image");
      return;
    case "audio":
      await insertAsset("audio/*", "audio");
      return;
    case "file":
      await insertAsset("*/*", "file");
      return;
    case "dump":
      app.setDumpOpen(true);
      return;
    case "meeting":
      app.setView({ kind: "meeting" });
      return;
    case "meeting-notes": {
      const id = currentNoteId();
      if (id) attachMeetingNotes(id);
      else createMeetingNote();
      return;
    }
    case "transcribe": {
      if (!speechSupported()) {
        app.setError("Speech recognition is not available. Paste or type instead.");
        return;
      }
      let id = currentNoteId();
      if (!id) id = app.createPage({ title: "Transcript" });
      const rec = startTranscription((text) => {
        const n = useApp.getState().notes.find((x) => x.id === id);
        if (n) useApp.getState().patchNote(n.id, { body: (n.body.trim() ? n.body.trim() + "\n\n" : "") + text });
      }, (m) => app.setError(m));
      window.setTimeout(() => rec.stop(), 60000);
      return;
    }
    default:
      return;
  }
}
