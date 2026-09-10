import { nid, todayIso } from "@/lib/ids";
import type { CalendarSource, CalendarSourceKind, VaultEvent } from "@/types";
import { parseIcsEvents, type ParsedIcsEvent } from "@/lib/ics";

export function defaultCalendarSources(): CalendarSource[] {
  return [];
}

export function defaultSourceName(kind: CalendarSourceKind): string {
  if (kind === "google") return "Google Calendar";
  if (kind === "apple") return "Apple Calendar";
  return "ICS";
}

export function inferCalendarKind(url: string): CalendarSourceKind {
  try {
    const host = new URL(normalizeFeedUrl(url)).hostname.toLowerCase();
    if (host === "calendar.google.com" || host.endsWith(".google.com")) return "google";
    if (
      host === "icloud.com" ||
      host.endsWith(".icloud.com") ||
      host === "calendar.icloud.com" ||
      host.includes("caldav.icloud.com")
    ) {
      return "apple";
    }
  } catch {
    /* ignore */
  }
  return "ics";
}

export function normalizeFeedUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^webcal:\/\//i.test(trimmed)) return `https://${trimmed.slice("webcal://".length)}`;
  return trimmed;
}

export function toWebcalUrl(raw: string): string {
  const href = normalizeFeedUrl(raw);
  try {
    const parsed = new URL(href);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return `webcal://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    /* ignore */
  }
  return href;
}

export function migrateCalendarSources(raw: unknown): CalendarSource[] {
  if (!Array.isArray(raw)) return [];
  const out: CalendarSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const url = typeof r.url === "string" ? normalizeFeedUrl(r.url) : "";
    if (!url) continue;
    const inferred = inferCalendarKind(url);
    const kind: CalendarSourceKind =
      r.kind === "google" || r.kind === "apple" || r.kind === "ics"
        ? r.kind === "ics"
          ? inferred
          : r.kind
        : inferred;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : nid(),
      kind,
      url,
      name:
        typeof r.name === "string" && r.name.trim() && r.name.trim() !== "ICS"
          ? r.name.trim()
          : defaultSourceName(kind),
      lastSync: typeof r.lastSync === "string" ? r.lastSync : undefined,
      lastError: typeof r.lastError === "string" ? r.lastError : undefined,
      hiddenUids: Array.isArray(r.hiddenUids)
        ? r.hiddenUids.filter((u): u is string => typeof u === "string" && u.length > 0)
        : undefined,
    });
  }
  return out;
}

export function calendarSourceLabel(kind: CalendarSourceKind): string {
  if (kind === "google") return "Google";
  if (kind === "apple") return "Apple";
  return "ICS";
}

/** Calendar id from a Google secret/public iCal URL. */
export function googleCalendarIdFromFeed(url: string): string | null {
  try {
    const parsed = new URL(normalizeFeedUrl(url));
    const parts = parsed.pathname.split("/").filter(Boolean);
    const ical = parts.indexOf("ical");
    if (ical >= 0 && parts[ical + 1]) return decodeURIComponent(parts[ical + 1]);
    const src = parsed.searchParams.get("src") ?? parsed.searchParams.get("cid");
    return src;
  } catch {
    return null;
  }
}

/** Google Calendar agenda (web) for a subscribed feed — no OAuth. */
export function googleAgendaHref(url: string, date?: string): string {
  const cid = googleCalendarIdFromFeed(url);
  const href = new URL("https://calendar.google.com/calendar/u/0/r");
  if (cid) href.searchParams.set("cid", cid);
  const day = date?.slice(0, 10);
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    href.pathname = `/calendar/u/0/r/day/${day.replace(/-/g, "/")}`;
  }
  return href.toString();
}

export function appleCalendarHref(url: string): string {
  return toWebcalUrl(url);
}

export function providerOpenHref(source: CalendarSource, date?: string): string | null {
  if (!source.url) return null;
  if (source.kind === "google") return googleAgendaHref(source.url, date);
  if (source.kind === "apple") return appleCalendarHref(source.url);
  try {
    return new URL(normalizeFeedUrl(source.url)).toString();
  } catch {
    return null;
  }
}

export function eventGoogleHref(event: VaultEvent, source?: CalendarSource): string | null {
  if (event.htmlLink) {
    try {
      const host = new URL(event.htmlLink).hostname.toLowerCase();
      if (host.includes("google.com") || host.includes("googleusercontent.com")) return event.htmlLink;
    } catch {
      /* ignore */
    }
  }
  if (source?.kind === "google") return googleAgendaHref(source.url, event.date);
  if (event.sourceKind === "google" && source?.url) return googleAgendaHref(source.url, event.date);
  return null;
}

export function eventExternalHref(event: VaultEvent, source?: CalendarSource): string | null {
  if (event.htmlLink) return event.htmlLink;
  if (source) return providerOpenHref(source, event.date);
  return null;
}

export function openExternalCalendar(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

export async function fetchIcsText(url: string): Promise<string> {
  const href = normalizeFeedUrl(url);
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    throw new Error("That calendar URL is not valid.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Calendar feeds must be http or https.");
  }

  const desktop = window.kleverDesktop?.fetchText;
  if (desktop) {
    const res = await desktop(href);
    if (!res.ok) throw new Error(res.error || `ICS feed returned ${res.status ?? ""}`.trim());
    return res.text;
  }

  try {
    const res = await fetch(href, { redirect: "follow" });
    if (!res.ok) throw new Error(`ICS feed returned ${res.status}`);
    return await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ICS feed returned/.test(msg)) throw err;
    throw new Error(
      "This browser blocked the calendar feed (CORS). Use the Klever desktop app to subscribe, or paste a feed that allows public access.",
    );
  }
}

export function mergeSyncedEvents(
  existing: VaultEvent[],
  source: CalendarSource,
  parsed: ParsedIcsEvent[],
  now = todayIso(),
): VaultEvent[] {
  const hidden = new Set(source.hiddenUids ?? []);
  const incoming = parsed.filter((p) => p.uid && !hidden.has(p.uid));
  const byUid = new Map(incoming.map((p) => [p.uid, p]));

  const next = existing.filter((e) => {
    if (e.sourceId !== source.id) return true;
    if (!e.uid || hidden.has(e.uid)) return false;
    return byUid.has(e.uid);
  });

  const updated = next.map((e) => {
    if (e.sourceId !== source.id || !e.uid) return e;
    const p = byUid.get(e.uid);
    if (!p) return e;
    return {
      ...e,
      title: p.title,
      date: p.date,
      body: p.body,
      sourceKind: source.kind,
      htmlLink: p.htmlLink,
      updated: now,
    };
  });

  for (const p of incoming) {
    if (updated.some((e) => e.sourceId === source.id && e.uid === p.uid)) continue;
    updated.push({
      id: nid(),
      title: p.title,
      body: p.body,
      date: p.date,
      tags: [],
      sourceId: source.id,
      uid: p.uid,
      sourceKind: source.kind,
      htmlLink: p.htmlLink,
      created: now,
      updated: now,
    });
  }
  return updated;
}

export function dropEventsForSource(events: VaultEvent[], sourceId: string): VaultEvent[] {
  return events.filter((e) => e.sourceId !== sourceId);
}

export async function syncOneFeed(
  source: CalendarSource,
  events: VaultEvent[],
): Promise<{ source: CalendarSource; events: VaultEvent[] }> {
  try {
    const text = await fetchIcsText(source.url);
    if (!/BEGIN:VCALENDAR/i.test(text) && !/BEGIN:VEVENT/i.test(text)) {
      throw new Error("That URL did not look like an iCalendar feed.");
    }
    const parsed = parseIcsEvents(text);
    const now = todayIso();
    return {
      source: { ...source, lastSync: now, lastError: undefined },
      events: mergeSyncedEvents(events, source, parsed, now),
    };
  } catch (err) {
    const lastError = err instanceof Error ? err.message : String(err);
    return { source: { ...source, lastError }, events };
  }
}
