import { MonoLabel, GhostButton, TextButton } from "@/components/ui";
import { useApp } from "@/store";
import type { VaultEvent } from "@/types";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

/** Vault-wide calendar of events only — never vault pages. */
export function GlobalCalendar() {
  const events = useApp((s) => s.events);
  const deleteEvent = useApp((s) => s.deleteEvent);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const label = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);
  const selected: VaultEvent | undefined = selectedId
    ? events.find((e) => e.id === selectedId)
    : undefined;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <MonoLabel>Calendar</MonoLabel>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl italic tracking-tight text-ink">{label}</h1>
        <div className="flex items-center gap-1">
          <TextButton
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={16} strokeWidth={1.4} />
          </TextButton>
          <TextButton
            type="button"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
            }}
          >
            Today
          </TextButton>
          <TextButton
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={16} strokeWidth={1.4} />
          </TextButton>
        </div>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
        Events only — independent from vault pages. Brain dump dates land here, not as notes.
      </p>

      <div className="mt-8 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="bg-paper-2 px-2 py-2 font-mono text-[10px] uppercase tracking-wide text-faint"
          >
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            className={`min-h-24 bg-paper p-2 ${c?.iso === today ? "ring-1 ring-inset ring-ink/20" : ""}`}
          >
            {c && (
              <>
                <div
                  className={`font-mono text-[10px] ${c.iso === today ? "text-ink" : "text-faint"}`}
                >
                  {c.day}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {c.items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className={`flex w-full truncate text-left text-xs hover:opacity-70 ${
                          selectedId === e.id ? "text-ink underline" : "text-ink"
                        }`}
                        onClick={() => setSelectedId(e.id)}
                      >
                        <span className="truncate">{e.title}</span>
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
          <h2 className="mt-1 font-serif text-2xl italic tracking-tight">{selected.title}</h2>
          <p className="mt-1 font-mono text-[11px] text-mute">
            {selected.date}
            {selected.project ? ` · ${selected.project}` : ""}
          </p>
          {selected.body && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{selected.body}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <GhostButton
              type="button"
              onClick={() => {
                deleteEvent(selected.id);
                setSelectedId(null);
              }}
            >
              <Trash2 size={14} strokeWidth={1.4} />
              Delete event
            </GhostButton>
            <TextButton type="button" onClick={() => setSelectedId(null)}>
              Close
            </TextButton>
          </div>
        </div>
      )}

      {dated.length === 0 && (
        <p className="mt-6 font-mono text-[12px] text-faint">
          No events yet. Organize a brain dump with dated items to fill this calendar.
        </p>
      )}
    </div>
  );
}
