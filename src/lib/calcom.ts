import type { CalSettings } from "@/types";

export const defaultCalSettings = (): CalSettings => ({
  username: "",
  eventTypeSlug: "",
});

export function migrateCalSettings(raw: unknown): CalSettings {
  const base = defaultCalSettings();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  return {
    username: typeof r.username === "string" ? r.username.trim() : "",
    eventTypeSlug: typeof r.eventTypeSlug === "string" ? r.eventTypeSlug.trim() : "",
  };
}

export function calBookingPageReady(cal: CalSettings): boolean {
  return Boolean(cal.username.trim() && cal.eventTypeSlug.trim());
}

function calUserSlug(cal: CalSettings): { user: string; slug: string } {
  return {
    user: encodeURIComponent(cal.username.trim().replace(/^@/, "")),
    slug: encodeURIComponent(cal.eventTypeSlug.trim().replace(/^\//, "")),
  };
}

function calPageOrigin(cal: CalSettings): URL {
  const { user, slug } = calUserSlug(cal);
  return new URL(`https://cal.com/${user}/${slug}`);
}

function applyDateParams(url: URL, date?: string) {
  const day = date?.slice(0, 10);
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    url.searchParams.set("date", day);
    url.searchParams.set("month", day.slice(0, 7));
  }
}

/** Public booking page (stored on the event as `calUrl`). */
export function calBookingPageUrl(
  cal: CalSettings,
  opts?: { date?: string; name?: string; notes?: string },
): string {
  const url = calPageOrigin(cal);
  applyDateParams(url, opts?.date);
  if (opts?.name?.trim()) url.searchParams.set("name", opts.name.trim());
  if (opts?.notes?.trim()) url.searchParams.set("notes", opts.notes.trim());
  return url.toString();
}

/**
 * Official inline embed URL (`app.cal.com` + `embed=true`).
 * Public `cal.com` pages are stored on events; this host is for the iframe only.
 */
export function calEmbedUrl(
  cal: CalSettings,
  opts?: { date?: string; name?: string; notes?: string; theme?: "light" | "dark" },
): string {
  const { user, slug } = calUserSlug(cal);
  const url = new URL(`https://app.cal.com/${user}/${slug}`);
  applyDateParams(url, opts?.date);
  if (opts?.name?.trim()) url.searchParams.set("name", opts.name.trim());
  if (opts?.notes?.trim()) url.searchParams.set("notes", opts.notes.trim());
  url.searchParams.set("embed", "true");
  url.searchParams.set("theme", opts?.theme === "light" ? "light" : "dark");
  url.searchParams.set("layout", "month_view");
  return url.toString();
}

/** Opens the public booking page (Electron routes this to `shell.openExternal`). */
export function openCalBookingPage(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function isCalEmbedMessage(event: MessageEvent): boolean {
  try {
    const host = new URL(event.origin).hostname;
    if (host !== "cal.com" && host !== "app.cal.com" && !host.endsWith(".cal.com")) return false;
  } catch {
    return false;
  }
  const data = event.data;
  if (!data || typeof data !== "object") return false;
  const rec = data as Record<string, unknown>;
  return rec.originator === "CAL" || typeof rec.method === "string";
}
