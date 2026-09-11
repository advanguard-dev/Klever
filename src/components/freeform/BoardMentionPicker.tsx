import type { VaultHit } from "@/components/freeform/board-vault";
import { Database, File as FileIcon, FileText } from "lucide-react";

const KIND_META: Record<
  VaultHit["kind"],
  { label: string; icon: typeof FileText }
> = {
  page: { label: "page", icon: FileText },
  database: { label: "database", icon: Database },
  file: { label: "file", icon: FileIcon },
};

export function BoardMentionPicker({
  pos,
  query,
  hits,
  onQuery,
  onClose,
  onPick,
}: {
  pos: { x: number; y: number };
  query: string;
  hits: VaultHit[];
  onQuery: (q: string) => void;
  onClose: () => void;
  onPick: (hit: VaultHit) => void;
}) {
  return (
    <div
      className="absolute z-50 w-80 rounded-lg border border-line bg-paper p-2 shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        className="klever-focus mb-2 w-full rounded-md border border-line bg-paper-2 px-2 py-1.5 text-sm"
        aria-label="Mention a page, database, or file"
        placeholder="@ page, database, or file…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && hits[0]) onPick(hits[0]);
        }}
      />
      <ul className="max-h-64 overflow-y-auto">
        {hits.map((hit) => {
          const meta = KIND_META[hit.kind];
          const Icon = meta.icon;
          return (
            <li key={`${hit.kind}:${hit.id}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-paper-2"
                onClick={() => onPick(hit)}
              >
                <Icon size={12} strokeWidth={1.4} className="mt-1 shrink-0 text-mute" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm text-ink">{hit.title}</span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-faint">
                      {meta.label}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-faint">
                    {hit.path}
                  </span>
                  <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-mute">
                    {hit.snippet}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!hits.length && (
          <li className="px-2 py-2 font-mono text-[10px] text-faint">Nothing matches.</li>
        )}
      </ul>
    </div>
  );
}
