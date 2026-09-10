import { normalizeTags, type PageSuggestion, type ProposedItem } from "@/lib/ai";
import { noteFolder } from "@/lib/folders";
import { slugify } from "@/lib/ids";
import { useApp } from "@/store";
import type { Note } from "@/types";

export function findDbInFolder(notes: Note[], title: string, folder: string) {
  const want = title.trim().toLowerCase();
  const prefix = `${folder.replace(/\/$/, "")}/`;
  return notes.find(
    (n) =>
      n.type === "database" &&
      n.title.trim().toLowerCase() === want &&
      (n.path.startsWith(prefix) || n.path === `${prefix}${slugify(title)}.database.md`),
  );
}

export function meetingFolder(project: string) {
  const name = slugify(project.trim() || "Untitled meeting");
  return `Meetings/${name}`;
}

function rowProps(due?: string, status?: string) {
  const props: Record<string, unknown> = {};
  if (due) props.due = due;
  if (status) props.status = status;
  return props;
}

export function commitProposedItems(opts: {
  items: ProposedItem[];
  folder: string;
  project: string;
  extraTags?: string[];
  skipProjectClonePage?: boolean;
  summaryIcon?: string;
}): { lastNote: string; lastDb: string; createdEvent: boolean; createdIds: string[] } {
  const { createPage, createDatabase, createEvent } = useApp.getState();
  const extra = opts.extraTags ?? [];
  const project = opts.project.trim();
  let lastNote = "";
  let lastDb = "";
  let createdEvent = false;
  const createdIds: string[] = [];
  let sawPage = false;

  const ensureRemindersDb = (folder: string) => {
    const existing = findDbInFolder(useApp.getState().notes, "Reminders", folder);
    if (existing) return existing.id;
    return createDatabase({ title: "Reminders", viewType: "list", folder, stay: true });
  };

  for (const item of opts.items) {
    const tags = normalizeTags([...item.tags, ...extra], extra.length ? 3 : 2);
    if (item.kind === "page") {
      if (
        opts.skipProjectClonePage &&
        project &&
        item.title.trim().toLowerCase() === project.toLowerCase()
      ) {
        continue;
      }
      const isSummary = !sawPage;
      sawPage = true;
      lastNote = createPage({
        title: item.title,
        body: item.body,
        tags,
        folder: opts.folder,
        icon: isSummary ? opts.summaryIcon : undefined,
        props: rowProps(item.due),
        stay: true,
      });
      createdIds.push(lastNote);
      continue;
    }
    if (item.kind === "reminder") {
      const dbId = ensureRemindersDb(opts.folder);
      lastDb = dbId;
      createdIds.push(dbId);
      createPage({
        parent: dbId,
        title: item.title,
        body: item.body,
        tags,
        folder: opts.folder,
        props: rowProps(item.due, item.status || "Inbox"),
        stay: true,
      });
      continue;
    }
    if (item.kind === "event") {
      createEvent({
        title: item.title,
        body: item.body,
        date: item.due || new Date().toISOString().slice(0, 10),
        project,
        tags,
      });
      createdEvent = true;
      continue;
    }
    if (item.kind === "database") {
      const viewType = item.viewType === "calendar" ? "table" : (item.viewType ?? "table");
      const dbId = createDatabase({
        title: item.title,
        viewType,
        folder: opts.folder,
        stay: true,
      });
      lastDb = dbId;
      createdIds.push(dbId);
      for (const row of item.rows ?? []) {
        createPage({
          parent: dbId,
          title: row.title,
          body: row.body,
          tags: normalizeTags(row.tags.length ? row.tags : tags, 2),
          folder: opts.folder,
          props: rowProps(row.due, row.status || "Inbox"),
          stay: true,
        });
      }
    }
  }

  return { lastNote, lastDb, createdEvent, createdIds };
}

/**
 * Commit one page suggestion next to the page that produced it, with a
 * wikilink back to the source so the new object is not orphaned.
 */
export function commitSuggestion(note: Note, suggestion: PageSuggestion) {
  const backlink = `From [[${note.title}]]`;
  const body = suggestion.item.body.trim();
  return commitProposedItems({
    items: [
      {
        ...suggestion.item,
        body: body ? `${body}\n\n${backlink}` : backlink,
      },
    ],
    folder: noteFolder(note.path),
    project: note.title,
  });
}
