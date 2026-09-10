import { todayDate } from "@/lib/ids";
import { useApp } from "@/store";
import type { DbView, Note, SchemaProp, VaultEvent } from "@/types";

export const MEETINGS_FOLDER = "Meetings";
export const MEETINGS_DB_TITLE = "Meetings";

export const MEETING_STATUSES = ["Scheduled", "In progress", "Done"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_INTERNAL_KEYS = new Set([
  "transcript",
  "summary",
  "actions",
  "kleverKind",
  "eventId",
]);

export interface MeetingAction {
  title: string;
  owner?: string;
  due?: string;
  done?: boolean;
}

export const MEETING_SCHEMA: SchemaProp[] = [
  { key: "date", name: "Date", type: "date" },
  { key: "attendees", name: "Attendees", type: "people" },
  { key: "status", name: "Status", type: "select", options: [...MEETING_STATUSES] },
];

export const MEETING_VIEWS: DbView[] = [
  {
    id: "list",
    name: "List",
    type: "list",
    sorts: [{ key: "date", dir: "desc" }],
    visible: ["date", "attendees", "status"],
  },
  {
    id: "table",
    name: "Table",
    type: "table",
    visible: ["date", "attendees", "status"],
  },
  {
    id: "calendar",
    name: "Calendar",
    type: "calendar",
    dateProp: "date",
  },
];

export function findMeetingsDatabase(notes: Note[]): Note | undefined {
  return notes.find(
    (n) =>
      n.type === "database" &&
      (n.id === "meetings" ||
        n.path === "Meetings.database.md" ||
        n.title.trim().toLowerCase() === "meetings"),
  );
}

export function isMeetingNote(note: Note, notes: Note[]): boolean {
  if (note.type !== "page") return false;
  if (note.props.kleverKind === "meeting") return true;
  const db = findMeetingsDatabase(notes);
  if (db && note.parent === db.id) return true;
  if (note.tags.some((t) => t.toLowerCase() === "meeting")) return true;
  const path = note.path.replace(/\\/g, "/");
  if (path === "Meetings.md" || path.startsWith("Meetings/")) {
    if (note.parent) {
      const parent = notes.find((n) => n.id === note.parent);
      if (parent?.type === "database" && parent.title.trim().toLowerCase() !== "meetings") {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function meetingDate(note: Note): string | undefined {
  const raw = note.props.date ?? note.props.due;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return undefined;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

export function meetingAttendees(note: Note): string[] {
  const raw = note.props.attendees;
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function meetingStatus(note: Note): MeetingStatus | string {
  const raw = String(note.props.status ?? "").trim();
  if (MEETING_STATUSES.includes(raw as MeetingStatus)) return raw;
  return raw;
}

export function meetingTranscript(note: Note): string {
  return typeof note.props.transcript === "string" ? note.props.transcript : "";
}

export function meetingSummary(note: Note): string {
  return typeof note.props.summary === "string" ? note.props.summary : "";
}

export function meetingActions(note: Note): MeetingAction[] {
  const raw = note.props.actions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      const action: MeetingAction = { title };
      const owner = String(row.owner ?? "").trim();
      if (owner) action.owner = owner;
      const due = String(row.due ?? "").trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(due)) action.due = due.slice(0, 10);
      if (row.done) action.done = true;
      return action;
    })
    .filter((a): a is MeetingAction => Boolean(a));
}

export function formatMeetingWhen(isoDate?: string, today = todayDate()): string {
  if (!isoDate) return "";
  if (isoDate === today) return "Today";
  const t = new Date(`${today}T12:00:00`);
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function listMeetingNotes(notes: Note[]): Note[] {
  return notes.filter((n) => isMeetingNote(n, notes));
}

export function groupMeetings(notes: Note[], today = todayDate()) {
  const meetings = listMeetingNotes(notes);
  const todayList: Note[] = [];
  const upcoming: Note[] = [];
  const recent: Note[] = [];
  for (const n of meetings) {
    const d = meetingDate(n);
    if (d === today) todayList.push(n);
    else if (d && d > today) upcoming.push(n);
    else recent.push(n);
  }
  const byDateAsc = (a: Note, b: Note) => (meetingDate(a) ?? "").localeCompare(meetingDate(b) ?? "");
  const byDateDesc = (a: Note, b: Note) => {
    const da = meetingDate(a) ?? "";
    const db = meetingDate(b) ?? "";
    if (da && db && da !== db) return db.localeCompare(da);
    return a.updated < b.updated ? 1 : -1;
  };
  todayList.sort(byDateAsc);
  upcoming.sort(byDateAsc);
  recent.sort(byDateDesc);
  return { today: todayList, upcoming, recent };
}

export function eventsNeedingNotes(events: VaultEvent[], notes: Note[]): VaultEvent[] {
  const linked = new Set(
    notes
      .map((n) => (typeof n.props.eventId === "string" ? n.props.eventId : ""))
      .filter(Boolean),
  );
  return events.filter((e) => !linked.has(e.id));
}

export function meetingForEvent(notes: Note[], eventId: string): Note | undefined {
  return notes.find((n) => n.props.eventId === eventId && isMeetingNote(n, notes));
}

function mergeSchema(existing: SchemaProp[] | undefined): SchemaProp[] {
  const schema = [...(existing ?? [])];
  const keys = new Set(schema.map((s) => s.key));
  for (const prop of MEETING_SCHEMA) {
    if (!keys.has(prop.key)) {
      schema.push(prop);
      continue;
    }
    const i = schema.findIndex((s) => s.key === prop.key);
    if (i < 0) continue;
    if (prop.type === "people" && schema[i].type === "tags") {
      schema[i] = { ...schema[i], type: "people" };
    }
  }
  return schema;
}

export function ensureMeetingsDatabase(): string {
  const { notes, createDatabase, patchNote } = useApp.getState();
  const existing = findMeetingsDatabase(notes);
  if (existing) {
    const schema = mergeSchema(existing.schema);
    const views = (existing.views ?? MEETING_VIEWS).map((v) =>
      v.type === "calendar" && v.dateProp !== "date" ? { ...v, dateProp: "date" } : v,
    );
    const schemaChanged =
      schema.length !== (existing.schema?.length ?? 0) ||
      schema.some(
        (p, i) => p.key !== existing.schema?.[i]?.key || p.type !== existing.schema?.[i]?.type,
      );
    const viewsChanged = JSON.stringify(views) !== JSON.stringify(existing.views ?? []);
    if (schemaChanged || viewsChanged || !existing.icon) {
      patchNote(existing.id, {
        schema,
        views,
        icon: existing.icon || "lucide:audio-lines",
      });
    }
    return existing.id;
  }
  return createDatabase({
    title: MEETINGS_DB_TITLE,
    folder: MEETINGS_FOLDER,
    viewType: "list",
    stay: true,
    icon: "lucide:audio-lines",
    schema: MEETING_SCHEMA,
    views: MEETING_VIEWS,
  });
}

export function createMeetingNote(opts?: {
  title?: string;
  date?: string;
  attendees?: string[];
  eventId?: string;
  body?: string;
  stay?: boolean;
}): string {
  const dbId = ensureMeetingsDatabase();
  const { createPage, setView } = useApp.getState();
  const title = opts?.title?.trim() || "Untitled";
  const date = (opts?.date || todayDate()).slice(0, 10);
  const id = createPage({
    parent: dbId,
    title,
    folder: MEETINGS_FOLDER,
    icon: "lucide:audio-lines",
    tags: ["meeting"],
    body: opts?.body ?? "",
    props: {
      date,
      attendees: opts?.attendees ?? [],
      status: "Scheduled",
      kleverKind: "meeting",
      ...(opts?.eventId ? { eventId: opts.eventId } : {}),
    },
    stay: true,
  });
  if (!opts?.stay) {
    useApp.setState({ mode: "wysiwyg" });
    setView({ kind: "note", id });
  }
  return id;
}

export function attachMeetingNotes(noteId: string): void {
  const { notes, patchNote, setView } = useApp.getState();
  const note = notes.find((n) => n.id === noteId);
  if (!note || note.type !== "page") {
    createMeetingNote();
    return;
  }
  if (isMeetingNote(note, notes)) {
    setView({ kind: "note", id: noteId });
    return;
  }
  const attendees = meetingAttendees(note);
  patchNote(noteId, {
    tags: note.tags.includes("meeting") ? note.tags : [...note.tags, "meeting"],
    icon: note.icon || "lucide:audio-lines",
    props: {
      ...note.props,
      date: meetingDate(note) || todayDate(),
      attendees,
      status: meetingStatus(note) || "Scheduled",
      kleverKind: "meeting",
    },
  });
  setView({ kind: "note", id: noteId });
}

export function openOrCreateNotesForEvent(event: VaultEvent): string {
  const { notes, setView } = useApp.getState();
  const existing = meetingForEvent(notes, event.id);
  if (existing) {
    setView({ kind: "note", id: existing.id });
    return existing.id;
  }
  return createMeetingNote({
    title: event.title,
    date: event.date,
    eventId: event.id,
    body: event.body,
  });
}

export function applyMeetingNotes(
  note: Note,
  patch: {
    title?: string;
    date?: string;
    attendees?: string[];
    transcript?: string;
    summary?: string;
    actions?: MeetingAction[];
    status?: string;
  },
) {
  const { patchNote } = useApp.getState();
  const untitled = !note.title.trim() || /^untitled$/i.test(note.title);
  const attendees = [
    ...new Set([...meetingAttendees(note), ...(patch.attendees ?? [])].map((s) => s.trim()).filter(Boolean)),
  ].slice(0, 24);
  const nextTitle = patch.title?.trim();
  patchNote(note.id, {
    ...(untitled && nextTitle ? { title: nextTitle } : {}),
    tags: note.tags.includes("meeting") ? note.tags : [...note.tags, "meeting"],
    props: {
      ...note.props,
      kleverKind: "meeting",
      date: patch.date || meetingDate(note) || todayDate(),
      attendees,
      status: patch.status ?? note.props.status ?? "Done",
      ...(patch.transcript !== undefined ? { transcript: patch.transcript } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.actions !== undefined ? { actions: patch.actions } : {}),
    },
  });
}

export function commitMeetingActions(meeting: Note, actions: MeetingAction[]) {
  const pending = actions.filter((a) => a.title.trim() && !a.done);
  if (!pending.length) return 0;
  const { notes, createDatabase, createPage } = useApp.getState();
  let db = notes.find((n) => n.type === "database" && n.title.trim().toLowerCase() === "reminders");
  const dbId =
    db?.id ??
    createDatabase({
      title: "Reminders",
      viewType: "list",
      stay: true,
    });
  for (const action of pending) {
    createPage({
      parent: dbId,
      title: action.title,
      body: `From [[${meeting.title}]]`,
      props: {
        status: "Inbox",
        ...(action.due ? { due: action.due } : {}),
        related: [meeting.id],
      },
      stay: true,
    });
  }
  return pending.length;
}
