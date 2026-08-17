import { Panel } from "@/components/ui";
import { NoteLabel } from "@/lib/chrome-icons";
import { plainSnippet, resolveLink } from "@/lib/parse";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function openNote(note: Note) {
  useApp.getState().setView(
    note.type === "database" ? { kind: "database", id: note.id } : { kind: "note", id: note.id },
  );
}

export function WikiPeek({
  target,
  notes,
  children,
}: {
  target: string;
  notes: Note[];
  children: ReactNode;
}) {
  const createPage = useApp((s) => s.createPage);
  const hit = resolveLink(target, notes);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      onMouseEnter={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPos({ x: r.left, y: r.bottom + 6 }), 280);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setPos(null);
      }}
    >
      <button
        type="button"
        className={hit ? "wiki-link" : "wiki-link wiki-missing"}
        onClick={() => {
          if (hit) openNote(hit);
          else {
            const id = createPage({ title: target });
            useApp.getState().setView({ kind: "note", id });
          }
        }}
      >
        {children}
      </button>
      {pos &&
        hit &&
        createPortal(
          <Panel
            className="pointer-events-none fixed z-[80] w-64 p-3"
            style={{ left: Math.min(pos.x, window.innerWidth - 280), top: pos.y }}
          >
            <p className="font-sans text-sm text-ink">
              <NoteLabel note={hit} size={14} />
            </p>
            <p className="mt-1 line-clamp-4 text-sm text-mute">{plainSnippet(hit.body) || "Empty page."}</p>
          </Panel>,
          document.body,
        )}
    </span>
  );
}
