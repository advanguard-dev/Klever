import { Field, GhostButton, MonoLabel, Overlay, Panel, SolidButton, TextButton } from "@/components/ui";
import { RelationChecklist } from "@/components/editor/RelationChecklist";
import { cn } from "@/lib/cn";
import { draftNoteBody, insertOrAppendToOpenNote } from "@/lib/editor-bridge";
import {
  addRelationToProps,
  inverseRelationKey,
  RELATION_KINDS,
  type RelationKindKey,
} from "@/lib/relations";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { GitBranch, Search } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

function scoreNote(q: string, n: Note) {
  const needle = q.trim().toLowerCase();
  if (!needle) return 1;
  const title = n.title.toLowerCase();
  const path = n.path.toLowerCase();
  if (title === needle) return 100;
  if (title.startsWith(needle)) return 80;
  if (title.includes(needle)) return 60;
  if (path.includes(needle)) return 40;
  if (n.tags.some((t) => t.toLowerCase().includes(needle))) return 30;
  return 0;
}

export function RelateDialog({
  note,
  open,
  onClose,
}: {
  note: Note;
  open: boolean;
  onClose: () => void;
}) {
  const notes = useApp((s) => s.notes);
  const patchNote = useApp((s) => s.patchNote);
  const setView = useApp((s) => s.setView);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<RelationKindKey>("related");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [bothWays, setBothWays] = useState(true);
  const [alsoWiki, setAlsoWiki] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTargetId(null);
    setKind("related");
    setBothWays(true);
    setAlsoWiki(false);
  }, [open, note.id]);

  const candidates = useMemo(() => {
    return notes
      .filter((n) => n.id !== note.id && (n.type === "page" || n.type === "database"))
      .map((n) => ({ n, score: scoreNote(query, n) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.n.title.localeCompare(b.n.title))
      .slice(0, 40)
      .map((x) => x.n);
  }, [notes, note.id, query]);

  const target = targetId ? notes.find((n) => n.id === targetId) : null;
  const kindMeta = RELATION_KINDS.find((k) => k.key === kind)!;

  if (!open) return null;

  const applyRelation = (to: Note) => {
    const ref = to.title.trim() || to.path;
    patchNote(note.id, { props: addRelationToProps(note.props, kind, ref) });

    if (alsoWiki) {
      const link = `[[${ref}]]`;
      const live = draftNoteBody(note.body);
      if (!live.includes(link) && !insertOrAppendToOpenNote(`\n\n${link}`)) {
        const body = live.trimEnd();
        patchNote(note.id, { body: body ? `${body}\n\n${link}` : link });
      }
    }

    if (bothWays) {
      const backKey = kindMeta.directed ? inverseRelationKey(kind) : kind;
      const backRef = note.title.trim() || note.path;
      patchNote(to.id, {
        props: addRelationToProps(to.props, backKey, backRef),
      });
    }
  };

  const commit = (openGraph = false) => {
    if (!target) return;
    applyRelation(target);
    onClose();
    if (openGraph) setView({ kind: "graph" });
  };

  return (
    <Overlay onClose={onClose} title="Relate" labelledBy={titleId}>
      <Panel className="p-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex size-9 items-center justify-center rounded-lg border border-line bg-paper-2 text-ink">
            <GitBranch size={16} strokeWidth={1.4} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <MonoLabel>Relate</MonoLabel>
            <h2 id={titleId} className="mt-1 font-serif text-2xl font-semibold tracking-tight">
              Connect “{note.title || "Untitled"}”
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-mute">
              Choose a relationship. It lands in page properties and builds the neural graph.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <RelationChecklist note={note} />
        </div>

        <div className="mt-6 space-y-2">
          <MonoLabel>Relationship</MonoLabel>
          <div className="flex flex-wrap gap-1.5">
            {RELATION_KINDS.map((k) => {
              const on = kind === k.key;
              return (
                <button
                  key={k.key}
                  type="button"
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                    on
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-paper text-mute hover:border-ink/30 hover:text-ink",
                  )}
                  onClick={() => setKind(k.key)}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-faint">{kindMeta.hint}</p>
        </div>

        <label className="mt-5 block">
          <MonoLabel>Page</MonoLabel>
          <div className="relative mt-1">
            <Search
              size={14}
              strokeWidth={1.4}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <Field
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages…"
              autoFocus
              aria-label="Search pages to relate"
            />
          </div>
        </label>

        <ul
          className="mt-3 max-h-[min(16rem,40vh)] space-y-0.5 overflow-y-auto rounded-lg border border-line bg-paper-2/40 p-1"
          role="listbox"
          aria-label="Pages"
        >
          {candidates.length === 0 ? (
            <li className="px-3 py-4 text-sm text-mute">No matching pages.</li>
          ) : (
            candidates.map((n) => {
              const on = n.id === targetId;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                      on ? "bg-ink text-paper" : "text-ink hover:bg-paper",
                    )}
                    onClick={() => setTargetId(n.id)}
                    onDoubleClick={() => {
                      applyRelation(n);
                      onClose();
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{n.title || "Untitled"}</span>
                    <span
                      className={cn(
                        "max-w-[8rem] truncate font-mono text-[10px]",
                        on ? "text-paper/70" : "text-faint",
                      )}
                    >
                      {n.path}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-mute">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--color-ink)]"
              checked={bothWays}
              onChange={(e) => setBothWays(e.target.checked)}
            />
            Link both ways
            {kindMeta.directed && bothWays && (
              <span className="font-mono text-[10px] text-faint">
                ({kind} ↔ {inverseRelationKey(kind)})
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm text-mute">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--color-ink)]"
              checked={alsoWiki}
              onChange={(e) => setAlsoWiki(e.target.checked)}
            />
            Also insert [[wikilink]] in the body
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <SolidButton onClick={() => commit(false)} disabled={!target}>
            Add relation
          </SolidButton>
          <GhostButton type="button" onClick={() => commit(true)} disabled={!target}>
            Add & open graph
          </GhostButton>
          <TextButton onClick={onClose}>Cancel</TextButton>
        </div>
      </Panel>
    </Overlay>
  );
}
