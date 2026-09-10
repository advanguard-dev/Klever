/** Parsed VEVENT mapped onto Klever’s date-only calendar. */
export interface ParsedIcsEvent {
  uid: string;
  title: string;
  date: string;
  body: string;
  /** ICS URL / Google event page when present. */
  htmlLink?: string;
}

function unfoldIcs(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function splitProp(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const semi = head.indexOf(";");
  const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
  const params = semi < 0 ? "" : head.slice(semi + 1);
  return { name, params, value: line.slice(colon + 1) };
}

function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseIcsDateValue(value: string, params: string): { date: string; time?: string } | null {
  const raw = value.trim();
  const datePart = raw.slice(0, 8);
  if (!/^\d{8}$/.test(datePart)) return null;
  const y = Number(datePart.slice(0, 4));
  const mo = Number(datePart.slice(4, 6));
  const d = Number(datePart.slice(6, 8));
  if (params.toUpperCase().includes("VALUE=DATE") || raw.length === 8) {
    return { date: ymd(y, mo, d) };
  }
  const t = raw.match(/T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!t) return { date: ymd(y, mo, d) };
  const utc = Boolean(t[4]);
  if (utc) {
    const dt = new Date(Date.UTC(y, mo - 1, d, Number(t[1]), Number(t[2]), Number(t[3])));
    return {
      date: ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()),
      time: dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
  }
  return {
    date: ymd(y, mo, d),
    time: `${t[1]}:${t[2]}`,
  };
}

function parseUntil(value: string): Date | null {
  const parsed = parseIcsDateValue(value, value.length === 8 ? "VALUE=DATE" : "");
  if (!parsed) return null;
  const [y, m, d] = parsed.date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addInterval(date: Date, freq: string, interval: number): Date {
  const next = new Date(date.getTime());
  if (freq === "DAILY") next.setDate(next.getDate() + interval);
  else if (freq === "WEEKLY") next.setDate(next.getDate() + 7 * interval);
  else if (freq === "MONTHLY") next.setMonth(next.getMonth() + interval);
  else if (freq === "YEARLY") next.setFullYear(next.getFullYear() + interval);
  else next.setDate(next.getDate() + interval);
  return next;
}

function expandRrule(start: Date, rrule: string, horizon: Date): Date[] {
  const parts = Object.fromEntries(
    rrule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k.toUpperCase(), v ?? ""];
    }),
  );
  const freq = (parts.FREQ || "DAILY").toUpperCase();
  const interval = Math.max(1, Number(parts.INTERVAL) || 1);
  const count = parts.COUNT ? Math.min(400, Math.max(1, Number(parts.COUNT))) : 400;
  const until = parts.UNTIL ? parseUntil(parts.UNTIL) : null;
  const end = until && until < horizon ? until : horizon;
  const out: Date[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < count && cursor <= end; i++) {
    out.push(new Date(cursor.getTime()));
    cursor = addInterval(cursor, freq, interval);
  }
  return out;
}

function parseExdates(lines: { name: string; params: string; value: string }[]): Set<string> {
  const set = new Set<string>();
  for (const line of lines) {
    if (line.name !== "EXDATE") continue;
    for (const part of line.value.split(",")) {
      const parsed = parseIcsDateValue(part, line.params);
      if (parsed) set.add(parsed.date);
    }
  }
  return set;
}

function sanitizeHttpUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const href = /^webcal:\/\//i.test(trimmed) ? `https://${trimmed.slice("webcal://".length)}` : trimmed;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function eventFromProps(
  uid: string,
  title: string,
  date: string,
  time: string | undefined,
  description: string,
  location: string,
  htmlLink?: string,
): ParsedIcsEvent {
  const bodyParts = [time, location, description].filter(Boolean);
  return {
    uid,
    title: title || "Untitled event",
    date,
    body: bodyParts.join("\n\n"),
    ...(htmlLink ? { htmlLink } : {}),
  };
}

export function parseIcsEvents(text: string): ParsedIcsEvent[] {
  const lines = unfoldIcs(text);
  const events: ParsedIcsEvent[] = [];
  let block: { name: string; params: string; value: string }[] | null = null;

  const flush = () => {
    if (!block) return;
    const map = new Map<string, { params: string; value: string }>();
    for (const line of block) {
      if (!map.has(line.name)) map.set(line.name, line);
    }
    const uidRaw = unescapeIcs(map.get("UID")?.value ?? "").trim();
    const title = unescapeIcs(map.get("SUMMARY")?.value ?? "").trim();
    const description = unescapeIcs(map.get("DESCRIPTION")?.value ?? "").trim();
    const location = unescapeIcs(map.get("LOCATION")?.value ?? "").trim();
    const htmlLink = sanitizeHttpUrl(unescapeIcs(map.get("URL")?.value ?? ""));
    const startLine = map.get("DTSTART");
    if (!startLine) {
      block = null;
      return;
    }
    const start = parseIcsDateValue(startLine.value, startLine.params);
    if (!start) {
      block = null;
      return;
    }
    const uidBase = uidRaw || `${title}|${start.date}`;
    const rrule = map.get("RRULE")?.value;
    const recurrence = map.get("RECURRENCE-ID");
    const ex = parseExdates(block);

    if (recurrence || !rrule) {
      if (!ex.has(start.date)) {
        events.push(
          eventFromProps(
            recurrence ? `${uidBase}#${start.date}` : uidBase,
            title,
            start.date,
            start.time,
            description,
            location,
            htmlLink,
          ),
        );
      }
      block = null;
      return;
    }

    const [y, m, d] = start.date.split("-").map(Number);
    const startDate = new Date(y, m - 1, d);
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 18);
    if (startDate > horizon) horizon.setTime(startDate.getTime());
    horizon.setMonth(horizon.getMonth() + 18);
    for (const occ of expandRrule(startDate, rrule, horizon)) {
      const date = ymd(occ.getFullYear(), occ.getMonth() + 1, occ.getDate());
      if (ex.has(date)) continue;
      events.push(
        eventFromProps(`${uidBase}#${date}`, title, date, start.time, description, location, htmlLink),
      );
    }
    block = null;
  };

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      block = [];
      continue;
    }
    if (upper === "END:VEVENT") {
      flush();
      continue;
    }
    if (!block) continue;
    const prop = splitProp(line);
    if (prop) block.push(prop);
  }
  return events;
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function stampUtc(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Minimal VCALENDAR for a local Klever event (Apple Calendar / any ICS client). */
export function serializeEventIcs(event: {
  id: string;
  title: string;
  date: string;
  body?: string;
}): string {
  const day = event.date.slice(0, 10).replace(/-/g, "");
  const uid = `${event.id}@klever.local`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Klever//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stampUtc()}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${day}`,
    `SUMMARY:${escapeIcsText(event.title || "Event")}`,
  ];
  if (event.body?.trim()) lines.push(`DESCRIPTION:${escapeIcsText(event.body.trim())}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function downloadEventIcs(event: { id: string; title: string; date: string; body?: string }) {
  const blob = new Blob([serializeEventIcs(event)], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (event.title || "event").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  a.href = href;
  a.download = `${slug || "event"}.ics`;
  a.rel = "noopener";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}
