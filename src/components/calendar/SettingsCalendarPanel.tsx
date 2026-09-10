import { Field, GhostButton, MonoLabel, SolidButton, TextButton } from "@/components/ui";
import {
  calendarSourceLabel,
  openExternalCalendar,
  providerOpenHref,
} from "@/lib/calendar-sync";
import { t as tx } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { CalendarSource, CalendarSourceKind } from "@/types";
import { useEffect, useState } from "react";

function formatSync(source: CalendarSource | undefined, locale: ReturnType<typeof useLocale>) {
  if (!source) return tx(locale, "cal.settings.notConnectedStatus");
  if (source.lastError) return source.lastError;
  if (source.lastSync) {
    return tx(locale, "cal.settings.lastSynced", {
      when: source.lastSync.slice(0, 16).replace("T", " "),
    });
  }
  return tx(locale, "cal.settings.notSynced");
}

function ProviderRow({
  kind,
  title,
  how,
  placeholder,
}: {
  kind: "google" | "apple";
  title: string;
  how: string;
  placeholder: string;
}) {
  const t = useT();
  const locale = useLocale();
  const calendarSources = useApp((s) => s.calendarSources);
  const connectCalendarProvider = useApp((s) => s.connectCalendarProvider);
  const removeCalendarSource = useApp((s) => s.removeCalendarSource);
  const syncCalendarFeeds = useApp((s) => s.syncCalendarFeeds);
  const calendarSyncing = useApp((s) => s.calendarSyncing);
  const source = calendarSources.find((s) => s.kind === kind);
  const [url, setUrl] = useState(source?.url ?? "");
  useEffect(() => {
    setUrl(source?.url ?? "");
  }, [source?.url]);
  const connected = Boolean(source?.url);
  const openHref = source ? providerOpenHref(source) : null;

  return (
    <div className="rounded-xl border border-line px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-ink">{title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-mute">
            {connected ? t("cal.settings.connected") : t("cal.settings.notConnected")}
            {source ? ` · ${formatSync(source, locale)}` : ""}
          </p>
        </div>
        {openHref && (
          <TextButton type="button" onClick={() => openExternalCalendar(openHref)}>
            {t("cal.settings.openCalendar")}
          </TextButton>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-faint">{how}</p>
      <label className="mt-3 block">
        <MonoLabel>{t("cal.settings.icalUrl")}</MonoLabel>
        <Field
          className="mt-1 font-mono text-xs"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <SolidButton
          type="button"
          disabled={!url.trim() || calendarSyncing}
          onClick={() => void connectCalendarProvider(kind, url)}
        >
          {connected ? t("cal.settings.saveSync") : t("cal.settings.connect")}
        </SolidButton>
        {connected && (
          <>
            <GhostButton
              type="button"
              disabled={calendarSyncing}
              onClick={() => void syncCalendarFeeds({ sourceId: source!.id })}
            >
              {calendarSyncing ? t("cal.settings.syncing") : t("cal.settings.syncNow")}
            </GhostButton>
            <TextButton
              type="button"
              onClick={() => {
                removeCalendarSource(source!.id);
                setUrl("");
              }}
            >
              {t("cal.settings.disconnect")}
            </TextButton>
          </>
        )}
      </div>
    </div>
  );
}

export function SettingsCalendarPanel() {
  const t = useT();
  const locale = useLocale();
  const cal = useApp((s) => s.cal);
  const setCal = useApp((s) => s.setCal);
  const calendarSources = useApp((s) => s.calendarSources);
  const addCalendarSource = useApp((s) => s.addCalendarSource);
  const removeCalendarSource = useApp((s) => s.removeCalendarSource);
  const syncCalendarFeeds = useApp((s) => s.syncCalendarFeeds);
  const calendarSyncing = useApp((s) => s.calendarSyncing);
  const extras = calendarSources.filter((s) => s.kind === "ics");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedName, setFeedName] = useState("");

  return (
    <>
      <div className="mt-6 space-y-4">
        <MonoLabel>{t("cal.settings.sync")}</MonoLabel>
        <p className="text-sm leading-relaxed text-mute">{t("cal.settings.syncBlurb")}</p>

        <ProviderRow
          kind="google"
          title={t("cal.settings.google")}
          how={t("cal.settings.googleHow")}
          placeholder="https://calendar.google.com/calendar/ical/…"
        />

        <ProviderRow
          kind="apple"
          title={t("cal.settings.apple")}
          how={t("cal.settings.appleHow")}
          placeholder="webcal://pXX-caldav.icloud.com/published/2/…"
        />

        <div className="border-t border-line pt-5">
          <MonoLabel>{t("cal.settings.otherIcs")}</MonoLabel>
          <p className="mt-1 text-[12px] leading-relaxed text-faint">{t("cal.settings.otherIcsHint")}</p>
          <label className="mt-3 block">
            <MonoLabel>{t("cal.settings.feedName")}</MonoLabel>
            <Field
              className="mt-1"
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="Work"
              autoComplete="off"
            />
          </label>
          <label className="mt-3 block">
            <MonoLabel>{t("cal.settings.icalUrl")}</MonoLabel>
            <Field
              className="mt-1 font-mono text-xs"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://…"
              autoComplete="off"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SolidButton
              type="button"
              disabled={!feedUrl.trim() || calendarSyncing}
              onClick={async () => {
                await addCalendarSource({ url: feedUrl, name: feedName });
                setFeedUrl("");
                setFeedName("");
              }}
            >
              {t("cal.settings.addFeed")}
            </SolidButton>
            <GhostButton
              type="button"
              disabled={calendarSources.length === 0 || calendarSyncing}
              onClick={() => void syncCalendarFeeds()}
            >
              {calendarSyncing ? t("cal.settings.syncing") : t("cal.settings.syncAll")}
            </GhostButton>
          </div>
          {extras.length > 0 && (
            <ul className="mt-3 space-y-3">
              {extras.map((source) => (
                <li key={source.id} className="rounded-xl border border-line px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{source.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-mute">
                        {calendarSourceLabel(source.kind as CalendarSourceKind)}
                        {` · ${formatSync(source, locale)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <TextButton
                        type="button"
                        disabled={calendarSyncing}
                        onClick={() => void syncCalendarFeeds({ sourceId: source.id })}
                      >
                        {t("cal.settings.syncOne")}
                      </TextButton>
                      <TextButton type="button" onClick={() => removeCalendarSource(source.id)}>
                        {t("cal.settings.remove")}
                      </TextButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-8 space-y-4 border-t border-line pt-6">
        <MonoLabel>{t("cal.settings.calcom")}</MonoLabel>
        <p className="text-sm leading-relaxed text-mute">{t("cal.settings.calcomBlurb")}</p>
        <label className="block">
          <MonoLabel>{t("cal.settings.username")}</MonoLabel>
          <Field
            className="mt-1"
            value={cal.username}
            onChange={(e) => setCal({ username: e.target.value })}
            autoComplete="off"
          />
        </label>
        <label className="block">
          <MonoLabel>{t("cal.settings.eventSlug")}</MonoLabel>
          <Field
            className="mt-1 font-mono text-sm"
            value={cal.eventTypeSlug}
            onChange={(e) => setCal({ eventTypeSlug: e.target.value })}
            autoComplete="off"
          />
          <p className="mt-1.5 text-[12px] text-faint">
            The last part of cal.com/you/<span className="text-mute">30min</span>.
          </p>
        </label>
      </div>
    </>
  );
}
