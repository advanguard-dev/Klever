import { ConfirmDialog, Field, GhostButton, MonoLabel, Overlay, Panel, SolidButton, TextArea, TextButton, Toggle } from "@/components/ui";
import { contextMenuFromKey, useContextMenu } from "@/components/ContextMenu";
import { eventMenuItems } from "@/lib/context-menus";
import { calendarSourceLabel, eventGoogleHref, openExternalCalendar, providerOpenHref } from "@/lib/calendar-sync";
import {
  calBookingPageReady,
  calBookingPageUrl,
  calEmbedUrl,
  isCalEmbedMessage,
  openCalBookingPage,
} from "@/lib/calcom";
import { downloadEventIcs } from "@/lib/ics";
import { localeBcp47 } from "@/lib/i18n";
import { meetingForEvent, openOrCreateNotesForEvent } from "@/lib/meetings";
import { useLocale, useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { VaultEvent } from "@/types";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

/** Vault-wide calendar of events only — never vault pages. */
export function GlobalCalendar() {
  const t = useT();
  const locale = useLocale();
  const events = useApp((s) => s.events);
  const notes = useApp((s) => s.notes);
  const deleteEvent = useApp((s) => s.deleteEvent);
  const createEvent = useApp((s) => s.createEvent);
  const patchEvent = useApp((s) => s.patchEvent);
  const setError = useApp((s) => s.setError);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const cal = useApp((s) => s.cal);
  const calendarSources = useApp((s) => s.calendarSources);
  const syncCalendarFeeds = useApp((s) => s.syncCalendarFeeds);
  const displayName = useApp((s) => s.displayName);
  const theme = useApp((s) => s.theme);
  const [calEmbed, setCalEmbed] = useState<{ embed: string; page: string } | null>(null);
  const { open } = useContextMenu();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VaultEvent | null>(null);
  const [activeDay, setActiveDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [composeDate, setComposeDate] = useState<string | null>(null);

  useEffect(() => {
    void syncCalendarFeeds();
    const timer = window.setInterval(() => void syncCalendarFeeds(), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [syncCalendarFeeds]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const dated = useMemo(
    () => events.filter((e) => /^\d{4}-\d{2}-\d{2}/.test(e.date.slice(0, 10))),
    [events],
  );

  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: start + days }, (_, i) => {
    if (i < start) return null;
    const day = i - start + 1;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      day,
      iso,
      items: dated.filter((e) => e.date.slice(0, 10) === iso),
    };
  });

  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(localeBcp47(locale), { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  }, [locale]);
  const label = cursor.toLocaleString(localeBcp47(locale), { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);
  const selected: VaultEvent | undefined = selectedId
    ? events.find((e) => e.id === selectedId)
    : undefined;
  const selectedSource = selected?.sourceId
    ? calendarSources.find((s) => s.id === selected.sourceId)
    : undefined;
  const googleHref = selected ? eventGoogleHref(selected, selectedSource) : null;
  const appleHref =
    selected?.sourceKind === "apple" && selectedSource ? providerOpenHref(selectedSource) : null;

  const openCompose = (iso: string) => {
    setActiveDay(iso);
    setComposeDate(iso);
  };

  const dayMenu = (iso: string) => [
    {
      id: "new",
      label: t("cal.newEvent"),
      onSelect: () => openCompose(iso),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-10 md:py-10">
      <MonoLabel>{t("cal.title")}</MonoLabel>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink md:text-4xl">{label}</h1>
        <div className="flex items-center gap-1">
          <TextButton
            type="button"
            aria-label={t("cal.prevMonth")}
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={16} strokeWidth={1.4} />
          </TextButton>
          <TextButton
            type="button"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
              setActiveDay(n.toISOString().slice(0, 10));
            }}
          >
            {t("cal.today")}
          </TextButton>
          <TextButton
            type="button"
            aria-label={t("cal.nextMonth")}
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={16} strokeWidth={1.4} />
          </TextButton>
          <GhostButton type="button" onClick={() => openCompose(activeDay)}>
            <Plus size={14} strokeWidth={1.4} />
            {t("cal.newEvent")}
          </GhostButton>
        </div>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">{t("cal.blurb")}</p>

      <div
        role="grid"
        aria-label={t("cal.gridAria", { label })}
        className="mt-8 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line"
      >
        {weekdayNames.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="bg-paper-2 px-1 py-2 text-center font-mono text-[10px] uppercase tracking-wide text-mute md:px-2 md:text-left"
          >
            <span className="md:hidden">{d.slice(0, 1)}</span>
            <span className="hidden md:inline">{d}</span>
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            role="gridcell"
            aria-selected={c ? c.iso === activeDay : undefined}
            className={`min-h-16 bg-paper p-1.5 md:min-h-24 md:p-2 ${c?.iso === today ? "ring-1 ring-inset ring-ink/20" : ""}`}
            onContextMenu={(e) => {
              if (!c) return;
              if ((e.target as HTMLElement).closest("[data-cal-event]")) return;
              open(e, dayMenu(c.iso));
            }}
          >
            {c && (
              <>
                <button
                  type="button"
                  className={`klever-focus rounded-md px-0.5 font-mono text-[10px] ${
                    c.iso === today ? "text-ink" : "text-mute"
                  }`}
                  aria-label={
                    c.items.length
                      ? `${c.iso}, ${c.items.length} event${c.items.length === 1 ? "" : "s"}. Activate to open the first, or add with New event.`
                      : `${c.iso}. Activate to add an event.`
                  }
                  onClick={() => {
                    setActiveDay(c.iso);
                    if (c.items[0]) setSelectedId(c.items[0].id);
                    else openCompose(c.iso);
                  }}
                  onKeyDown={(e) => contextMenuFromKey(e, (ev) => open(ev, dayMenu(c.iso)))}
                >
                  {c.day}
                </button>
                <ul className="mt-1 space-y-0.5">
                  {c.items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        data-cal-event
                        className={`klever-focus flex w-full truncate rounded-md px-0.5 text-left text-xs hover:opacity-70 ${
                          selectedId === e.id ? "text-ink underline" : "text-ink"
                        }`}
                        onClick={() => {
                          setActiveDay(c.iso);
                          setSelectedId(e.id);
                        }}
                        onContextMenu={(ev) =>
                          open(ev, eventMenuItems(e, () => setSelectedId(e.id)))
                        }
                        onKeyDown={(ev) =>
                          contextMenuFromKey(ev, (point) =>
                            open(point, eventMenuItems(e, () => setSelectedId(e.id))),
                          )
                        }
                      >
                        <span className="truncate">{e.title}</span>
                        {e.sourceKind && (
                          <span className="ml-1 shrink-0 font-mono text-[9px] uppercase tracking-wide text-mute">
                            {calendarSourceLabel(e.sourceKind)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-8 rounded-2xl border border-line bg-paper-2/40 px-5 py-4">
          <MonoLabel>Event</MonoLabel>
          <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight">{selected.title}</h2>
          <p className="mt-1 font-mono text-[11px] text-mute">
            {selected.date}
            {selected.project ? ` · ${selected.project}` : ""}
          </p>
          {selected.body && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{selected.body}</p>
          )}
          {selected.sourceId && (
            <p className="mt-3 font-mono text-[11px] text-mute">
              Synced from {calendarSources.find((s) => s.id === selected.sourceId)?.name ?? calendarSourceLabel(selected.sourceKind ?? "ics")}
              {selected.sourceKind ? ` · ${calendarSourceLabel(selected.sourceKind)}` : ""}
            </p>
          )}
          {selected.calUrl && !selected.sourceId && (
            <p className="mt-3 font-mono text-[11px] text-mute">Cal.com linked</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <GhostButton type="button" onClick={() => openOrCreateNotesForEvent(selected)}>
              {meetingForEvent(notes, selected.id) ? "Open notes" : "Take notes"}
            </GhostButton>
            {googleHref && (
              <GhostButton type="button" onClick={() => openExternalCalendar(googleHref)}>
                {t("cal.openGoogle")}
              </GhostButton>
            )}
            {!selected.sourceId && (
              <GhostButton type="button" onClick={() => downloadEventIcs(selected)}>
                {t("cal.addApple")}
              </GhostButton>
            )}
            {appleHref && (
              <GhostButton type="button" onClick={() => openExternalCalendar(appleHref)}>
                {t("cal.openApple")}
              </GhostButton>
            )}
            {!selected.sourceId && calBookingPageReady(cal) && (
              <GhostButton
                type="button"
                onClick={() => {
                  const publicUrl = calBookingPageUrl(cal, {
                    date: selected.date,
                    name: displayName,
                    notes: selected.title,
                  });
                  if (!selected.calUrl) patchEvent(selected.id, { calUrl: publicUrl });
                  setCalEmbed({
                    page: publicUrl,
                    embed: calEmbedUrl(cal, {
                      date: selected.date,
                      name: displayName,
                      notes: selected.title,
                      theme,
                    }),
                  });
                }}
              >
                {t("cal.openCalcom")}
              </GhostButton>
            )}
            <GhostButton type="button" onClick={() => setPendingDelete(selected)}>
              <Trash2 size={14} strokeWidth={1.4} />
              {selected.sourceId ? t("cal.hideLocally") : t("cal.deleteEvent")}
            </GhostButton>
            <TextButton type="button" onClick={() => setSelectedId(null)}>
              {t("cal.close")}
            </TextButton>
          </div>
        </div>
      )}

      {dated.length === 0 && (
        <p className="mt-6 font-mono text-[12px] text-mute">
          {t("cal.empty")}
        </p>
      )}

      {composeDate && (
        <NewEventDialog
          defaultDate={composeDate}
          onClose={() => setComposeDate(null)}
          onOpenSettings={() => setSettingsOpen(true)}
          onCreate={(opts) => {
            try {
              const id = createEvent({
                title: opts.title,
                date: opts.date,
                body: opts.body,
                calUrl: opts.calUrl,
              });
              setActiveDay(opts.date.slice(0, 10));
              setSelectedId(id);
              setComposeDate(null);
              if (opts.embedUrl && opts.calUrl) setCalEmbed({ embed: opts.embedUrl, page: opts.calUrl });
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        />
      )}

      {calEmbed && (
        <CalEmbedOverlay embedSrc={calEmbed.embed} pageUrl={calEmbed.page} onClose={() => setCalEmbed(null)} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={
            pendingDelete.sourceId
              ? t("cal.hideTitle", { title: pendingDelete.title || t("cal.untitledEvent") })
              : t("cal.deleteTitle", { title: pendingDelete.title || t("cal.untitledEvent") })
          }
          description={
            pendingDelete.sourceId
              ? "Removed from Klever only. The event stays on the remote calendar."
              : "This local event is removed from the calendar. This cannot be undone."
          }
          confirmLabel={pendingDelete.sourceId ? t("cal.hideLocally") : t("cal.deleteEvent")}
          onConfirm={() => {
            deleteEvent(pendingDelete.id);
            setSelectedId((id) => (id === pendingDelete.id ? null : id));
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function NewEventDialog({
  defaultDate,
  onClose,
  onCreate,
  onOpenSettings,
}: {
  defaultDate: string;
  onClose: () => void;
  onOpenSettings: () => void;
  onCreate: (opts: {
    title: string;
    date: string;
    body?: string;
    calUrl?: string;
    embedUrl?: string;
  }) => void;
}) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const titleFieldId = useId();
  const dateId = useId();
  const timeId = useId();
  const notesId = useId();
  const cal = useApp((s) => s.cal);
  const displayName = useApp((s) => s.displayName);
  const theme = useApp((s) => s.theme);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate.slice(0, 10));
  const [allDay, setAllDay] = useState(true);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [openCal, setOpenCal] = useState(false);
  const pageReady = calBookingPageReady(cal);

  const prefill = () => ({
    date: (date || defaultDate).slice(0, 10),
    name: displayName,
    notes: title.trim() || notes.trim(),
  });

  const submit = () => {
    const iso = (date || defaultDate).slice(0, 10);
    const bodyParts = [!allDay && time.trim() ? time.trim() : "", notes.trim()].filter(Boolean);
    const extra = prefill();
    onCreate({
      title: title.trim(),
      date: iso,
      body: bodyParts.join("\n\n") || undefined,
      calUrl: openCal && pageReady ? calBookingPageUrl(cal, extra) : undefined,
      embedUrl: openCal && pageReady ? calEmbedUrl(cal, { ...extra, theme }) : undefined,
    });
  };

  return (
    <Overlay
      onClose={onClose}
      title={t("cal.newEventTitle")}
      description={t("cal.newEventAria")}
      labelledBy={titleId}
      describedBy={descId}
    >
      <Panel className="p-5 sm:p-6">
        <MonoLabel>{t("cal.title")}</MonoLabel>
        <h2 id={titleId} className="mt-1 font-serif text-2xl font-semibold tracking-tight">
          {t("cal.newEventTitle")}
        </h2>
        <p id={descId} className="mt-1 text-sm text-mute">
          {t("cal.newEventSaved")}
        </p>

        <form
          className="mt-5 space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block" htmlFor={titleFieldId}>
            <MonoLabel>Title</MonoLabel>
            <Field
              id={titleFieldId}
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoComplete="off"
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className="block min-w-0" htmlFor={dateId}>
              <MonoLabel>{t("cal.date")}</MonoLabel>
              <Field
                id={dateId}
                className="mt-1"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <Toggle className="mb-2 shrink-0" checked={allDay} onChange={setAllDay} label="All-day" />
          </div>

          {!allDay && (
            <label className="block" htmlFor={timeId}>
              <MonoLabel>Time</MonoLabel>
              <Field
                id={timeId}
                className="mt-1 max-w-[10rem]"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          )}

          <label className="block" htmlFor={notesId}>
            <MonoLabel>Notes</MonoLabel>
            <TextArea
              id={notesId}
              className="mt-1 min-h-[4.5rem] resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </label>

          {pageReady && (
            <Toggle checked={openCal} onChange={setOpenCal} label="Also open Cal.com booking" />
          )}
          <p className="text-[12px] text-faint">
            Subscribe to Apple or Google in{" "}
            <TextButton type="button" className="px-0 align-baseline" onClick={onOpenSettings}>
              Settings → Calendar
            </TextButton>
            .
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <GhostButton type="button" onClick={onClose}>
              Cancel
            </GhostButton>
            <SolidButton type="submit" disabled={!title.trim()}>
              Add
            </SolidButton>
          </div>
        </form>
      </Panel>
    </Overlay>
  );
}

const CAL_EMBED_TIMEOUT_MS = 4500;

function CalEmbedOverlay({
  embedSrc,
  pageUrl,
  onClose,
}: {
  embedSrc: string;
  pageUrl: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    setStatus("loading");
    const onMessage = (event: MessageEvent) => {
      if (!isCalEmbedMessage(event)) return;
      setStatus((s) => (s === "fallback" ? s : "ready"));
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "ready" ? s : "fallback"));
    }, CAL_EMBED_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [embedSrc]);

  const openPage = () => openCalBookingPage(pageUrl);
  const showFrame = status !== "fallback";

  return (
    <Overlay
      title="Cal.com"
      description="Book on Cal.com. If the calendar does not load here, open it in a browser."
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="max-w-3xl"
    >
      <Panel className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <MonoLabel>Calendar</MonoLabel>
            <h2 id={titleId} className="mt-1 font-serif text-2xl font-semibold tracking-tight">
              Cal.com
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GhostButton type="button" onClick={openPage}>
              Open Cal.com
            </GhostButton>
            <TextButton type="button" onClick={onClose}>
              Close
            </TextButton>
          </div>
        </div>
        <p id={descId} className="sr-only">
          Book on Cal.com. If the calendar does not load here, open it in a browser.
        </p>
        {status === "loading" && (
          <p className="border-b border-line px-5 py-2 font-mono text-[11px] text-mute">Loading Cal.com…</p>
        )}
        {showFrame ? (
          <iframe
            title="Cal.com"
            referrerPolicy="no-referrer"
            className="h-[min(72vh,42rem)] w-full border-0 bg-paper"
            onError={() => setStatus("fallback")}
            ref={(el) => {
              if (!el) return;
              el.setAttribute("credentialless", "");
              if (el.getAttribute("src") !== embedSrc) el.src = embedSrc;
            }}
          />
        ) : (
          <div className="px-5 py-8">
            <p className="text-sm leading-relaxed text-ink">
              Cal.com cannot run inside this window. Klever uses Cross-Origin-Embedder-Policy for on-device
              speech (Moonshine), and Cal.com does not send the headers that would let the booking UI load in
              an iframe.
            </p>
            <p className="mt-2 text-sm text-mute">Use the button below to book in your browser.</p>
            <SolidButton type="button" className="mt-5" onClick={openPage}>
              Open Cal.com
            </SolidButton>
          </div>
        )}
      </Panel>
    </Overlay>
  );
}
