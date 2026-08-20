import { assetKindFromPath } from "@/lib/assets";
import { defaultFileDisplay, serializeFileMarkdown } from "@/lib/file-display";
import { insertInEditor } from "@/lib/editor-bridge";
import { fileToNote, normalizeNote } from "@/lib/parse";
import { noteFolder } from "@/lib/folders";
import { nid, slugify } from "@/lib/ids";
import { useApp } from "@/store";
import type { Note } from "@/types";

function isMarkdown(name: string) {
  return name.toLowerCase().endsWith(".md") || name.toLowerCase().endsWith(".markdown");
}

function uniquePathLocal(notes: Note[], path: string, id: string) {
  if (!notes.some((n) => n.path === path && n.id !== id)) return path;
  return path.replace(/(\.database)?\.md$/, (m) => `-${id.slice(0, 8)}${m}`);
}

/** Import / attach files dropped from Finder or the OS file manager. */
export async function handleDroppedFiles(
  files: FileList | File[],
  opts?: { folder?: string; attachToNoteId?: string },
) {
  const list = [...files].filter((f) => f.name && f.size >= 0);
  if (!list.length) return;

  const app = useApp.getState();
  const mdFiles = list.filter((f) => isMarkdown(f.name));
  const assetFiles = list.filter((f) => !isMarkdown(f.name));

  let lastImported: Note | undefined;

  for (const file of mdFiles) {
    const raw = await file.text();
    const baseName = file.name.replace(/^.*[/\\]/, "");
    let note = normalizeNote(fileToNote(baseName, raw));
    const notes = useApp.getState().notes;
    const id = notes.some((n) => n.id === note.id) ? nid() : note.id;
    const slug = slugify(note.title || baseName.replace(/\.md$/i, "") || "untitled");
    const ext = note.path.endsWith(".database.md") ? ".database.md" : ".md";
    const fileName = `${slug}${ext}`;
    const path = opts?.folder ? `${opts.folder}/${fileName}` : fileName;
    note = { ...note, id, path: uniquePathLocal(notes, path, id), updated: new Date().toISOString() };
    app.upsertNote(note);
    lastImported = note;
  }

  if (lastImported) {
    app.setView(
      lastImported.type === "database"
        ? { kind: "database", id: lastImported.id }
        : { kind: "note", id: lastImported.id },
    );
  }

  const snippets: string[] = [];
  for (const file of assetFiles) {
    const path = await app.storeFileFromDrop(file);
    if (!path) continue;
    const name = file.name || path.split("/").pop() || "file";
    const kind = assetKindFromPath(path, name);
    snippets.push(serializeFileMarkdown({ src: path, name, kind, display: defaultFileDisplay(kind) }));
  }

  if (!snippets.length) return;

  const joined = `${snippets.join("\n\n")}\n`;
  const targetId = opts?.attachToNoteId ?? (app.view.kind === "note" ? app.view.id : null);

  if (targetId) {
    const note = app.notes.find((n) => n.id === targetId);
    if (note) {
      const body = note.body.trimEnd();
      app.patchNote(targetId, { body: body ? `${body}\n\n${joined}` : joined });
      return;
    }
  }
  if (insertInEditor(joined)) return;

  app.createPage({
    title: assetFiles[0]?.name?.replace(/\.[^.]+$/, "") || "Attachments",
    body: joined,
    folder: opts?.folder,
  });
}

/** Move note drag payload to a folder path (sidebar). */
export function dropNoteToFolder(draggedId: string, folder: string) {
  if (!draggedId) return;
  const app = useApp.getState();
  const dragged = app.notes.find((n) => n.id === draggedId);
  if (!dragged) return;
  if (dragged.id === draggedId && noteFolder(dragged.path) === folder && !folder) return;
  app.moveNoteToFolder(draggedId, folder);
}

export function dropNoteNearNote(draggedId: string, target: Note) {
  dropNoteToFolder(draggedId, noteFolder(target.path));
}
