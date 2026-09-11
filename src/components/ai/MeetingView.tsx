import { EmptyState, Field, GhostButton, MonoLabel, SolidButton } from "@/components/ui";
import { NoteIcon, noteKindIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import {
  createMeetingNote,
  eventsNeedingNotes,
  findMeetingsDatabase,
  formatMeetingWhen,
  groupMeetings,
  meetingAttendees,
  meetingDate,
  meetingStatus,
  openOrCreateNotesForEvent,
} from "@/lib/meetings";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import type { Note, VaultEvent } from "@/types";
import { Calendar, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

function matchesQuery(note: Note, q: string) {
  if (!q) return true;
  const attendees = meetingAttendees(note).join(" ");
  const hay = `${note.title} ${attendees} ${note.body}`.toLowerCase();
  return hay.includes(q);
}

export function MeetingView() {
  const notes = useApp((s) => s.notes);
  const events = useApp((s) => s.events);
  const setView = useApp((s) => s.setView);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const tools = workspaces.find((w) => w.id === activeWorkspaceId)?.tools ?? defaultWorkspaceTools();
  const [query, setQuery] = useState("");

  const db = findMeetingsDatabase(notes);
  const grouped = useMemo(() => groupMeetings(notes), [notes]);
  const q = query.trim().toLowerCase();
  const today = grouped.today.filter((n) => matchesQuery(n, q));
  const upcoming = grouped.upcoming.filter((n) => matchesQuery(n, q));
  const recent = grouped.recent.filter((n) => matchesQuery(n, q));
  const looseEvents = useMemo(
    () =>
      eventsNeedingNotes(events, notes).filter((e) => {
        if (!q) return true;
        return `${e.title} ${e.body}`.toLowerCase().includes(q);
      }),
    [events, notes, q],
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const eventsToday = looseEvents.filter((e) => e.date.slice(0, 10) === todayIso);
  const eventsUpcoming = looseEvents.filter((e) => e.date.slice(0, 10) > todayIso);
  const total =
    today.length + upcoming.length + recent.length + eventsToday.length + eventsUpcoming.length;

  if (!tools.meeting) return null;

  const openNote = (n: Note) =>
    setView(n.type === "database" ? { kind: "database", id: n.id } : { kind: "note", id: n.id });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <MonoLabel>Meetings</MonoLabel>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Meetings
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {db && (
            <GhostButton type="button" onClick={() => setView({ kind: "database", id: db.id })}>
              Open database
            </GhostButton>
          )}
          <SolidButton type="button" onClick={() => createMeetingNote()}>
            <Plus size={14} strokeWidth={1.6} />
            New meeting
          </SolidButton>
        </div>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
        Each meeting is a page. Transcribe or type in Notes; the summary stays on that page.
      </p>

      <label className="relative mt-8 block">
        <Search
          size={14}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <Field
          className="w-full pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meetings"
          aria-label="Search meetings"
          autoComplete="off"
        />
      </label>

      {total === 0 ? (
        <EmptyState
          className="mt-16 px-0"
          title="No meetings yet"
          description="Create a meeting to take notes, or add notes from a calendar event. ⌘⇧M always opens this list."
        />
      ) : (
        <div className="mt-10 space-y-10">
          <MeetingSection title="Today" empty={today.length === 0 && eventsToday.length === 0}>
            {eventsToday.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
            {today.map((n) => (
              <MeetingRow key={n.id} note={n} onOpen={() => openNote(n)} />
            ))}
          </MeetingSection>
          <MeetingSection title="Upcoming" empty={upcoming.length === 0 && eventsUpcoming.length === 0}>
            {eventsUpcoming.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
            {upcoming.map((n) => (
              <MeetingRow key={n.id} note={n} onOpen={() => openNote(n)} />
            ))}
          </MeetingSection>
          <MeetingSection title="Recent" empty={recent.length === 0}>
            {recent.map((n) => (
              <MeetingRow key={n.id} note={n} onOpen={() => openNote(n)} />
            ))}
          </MeetingSection>
        </div>
      )}
    </div>
  );
}

function MeetingSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  if (empty) return null;
  return (
    <section>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{title}</h2>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper">{children}</ul>
    </section>
  );
}

function MeetingRow({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const attendees = meetingAttendees(note);
  const date = meetingDate(note);
  const status = meetingStatus(note);
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-paper-2"
        onClick={onOpen}
      >
        <NoteIcon
          icon={note.icon}
          fallback={noteKindIcon("page")}
          size={16}
          className="shrink-0 text-faint"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{note.title || "Untitled"}</span>
          {attendees.length > 0 && (
            <span className="mt-0.5 block truncate font-mono text-[10px] tracking-wide text-faint">
              {attendees.join(" · ")}
            </span>
          )}
        </span>
        {date ? (
          <span className="hidden shrink-0 font-mono text-[11px] text-mute sm:block">
            {formatMeetingWhen(date)}
          </span>
        ) : null}
        {status ? (
          <span
            className={cn(
              "hidden shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wide sm:inline",
              status === "Done"
                ? "border-line text-faint"
                : status === "In progress"
                  ? "border-ink/20 text-ink"
                  : "border-line text-mute",
            )}
          >
            {status}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function EventRow({ event }: { event: VaultEvent }) {
  return (
    <li>
      <div className="flex w-full items-center gap-3 px-3 py-3">
        <Calendar size={16} strokeWidth={1.4} className="shrink-0 text-faint" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{event.title}</span>
          <span className="mt-0.5 block font-mono text-[10px] tracking-wide text-faint">
            Calendar · {formatMeetingWhen(event.date.slice(0, 10))}
          </span>
        </span>
        <GhostButton type="button" className="h-8 shrink-0 px-3 text-xs" onClick={() => openOrCreateNotesForEvent(event)}>
          Take notes
        </GhostButton>
      </div>
    </li>
  );
}
