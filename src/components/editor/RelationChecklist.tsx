import { GhostButton, MonoLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { listNoteRelations, unlinkNoteRelation } from "@/lib/relations";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { useEffect, useMemo, useState } from "react";

export function RelationChecklist({
  note,
  compact,
}: {
  note: Note;
  compact?: boolean;
}) {
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const setView = useApp((s) => s.setView);
  const items = useMemo(() => listNoteRelations(note, notes), [note, notes]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setChecked(new Set());
  }, [note.id]);

  const toggle = (id: string) => {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeChecked = () => {
    const selected = items.filter((rel) => checked.has(rel.id));
    const byId = new Map(notes.map((n) => [n.id, n]));
    for (const rel of selected) {
      const live = [...byId.values()];
      for (const patch of unlinkNoteRelation(rel, live, note.id)) {
        const cur = byId.get(patch.id);
        if (!cur) continue;
        byId.set(patch.id, { ...cur, props: patch.props });
      }
    }
    for (const [id, next] of byId) {
      const orig = notes.find((n) => n.id === id);
      if (orig && orig.props !== next.props) patchNote(id, { props: next.props });
    }
    setChecked(new Set());
  };

  if (!items.length) {
    return (
      <p className={cn("text-sm text-faint", compact && "py-0.5")}>
        No relations on this page yet.
      </p>
    );
  }

  return (
    <div className={cn(!compact && "space-y-2")}>
      <div className="flex items-center justify-between gap-3">
        <MonoLabel>On this page</MonoLabel>
        <div className="flex items-center gap-1">
          {items.length > 1 && (
            <GhostButton
              className="h-8 px-3 text-xs"
              onClick={() => {
                if (checked.size === items.length) setChecked(new Set());
                else setChecked(new Set(items.map((rel) => rel.id)));
              }}
            >
              {checked.size === items.length ? "Clear" : "Check all"}
            </GhostButton>
          )}
          <GhostButton
            className="h-8 px-3 text-xs"
            disabled={checked.size === 0}
            onClick={removeChecked}
            aria-label={
              checked.size
                ? `Remove ${checked.size} selected relation${checked.size === 1 ? "" : "s"}`
                : "Remove selected relations"
            }
          >
            Remove
          </GhostButton>
        </div>
      </div>
      <ul className={cn("mt-2 space-y-0.5 overflow-y-auto", compact ? "max-h-28" : "max-h-40")}>
        {items.map((rel) => {
          const on = checked.has(rel.id);
          const name = rel.peer?.title || rel.ref;
          return (
            <li key={rel.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  on ? "bg-paper-2" : "hover:bg-paper-2/70",
                )}
              >
                <input
                  type="checkbox"
                  className="size-3.5 shrink-0 accent-[var(--color-ink)]"
                  checked={on}
                  onChange={() => toggle(rel.id)}
                  aria-label={`${rel.incoming ? "Incoming" : "Outgoing"} ${rel.label} ${name}`}
                />
                <span className="w-[5.5rem] shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
                  {rel.incoming ? `From · ${rel.label}` : rel.label}
                </span>
                <button
                  type="button"
                  className="klever-focus min-w-0 flex-1 truncate text-left text-ink hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!rel.peer) return;
                    setView(
                      rel.peer.type === "database"
                        ? { kind: "database", id: rel.peer.id }
                        : { kind: "note", id: rel.peer.id },
                    );
                  }}
                >
                  {name}
                </button>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
