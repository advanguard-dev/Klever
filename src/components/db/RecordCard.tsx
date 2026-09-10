import { contextMenuFromKey, type PointEvent } from "@/components/ContextMenu";
import { firstImageSrc, isImagePath, resolveAssetSrc } from "@/lib/assets";
import { accentKind, NoteIcon } from "@/lib/chrome-icons";
import { PropValue } from "@/components/editor/PropValue";
import { snippet } from "@/lib/views";
import { useApp } from "@/store";
import type { BlobRecord, CardSize, CoverSource, Note, SchemaProp } from "@/types";
import { cn } from "@/lib/cn";

export function RecordCard({
  row,
  schema,
  cover = "page",
  size = "m",
  snippet: showSnippet,
  onOpen,
  onContextMenu,
}: {
  row: Note;
  schema: SchemaProp[];
  cover?: CoverSource;
  size?: CardSize;
  snippet?: boolean;
  onOpen: () => void;
  onContextMenu?: (e: PointEvent) => void;
}) {
  const blobs = useApp((s) => s.blobs);
  const coverSrc = coverSource(row, cover);
  const h = size === "s" ? "h-16" : size === "l" ? "h-40" : "h-24";

  return (
    <div
      role="button"
      tabIndex={0}
      className="klever-focus block w-full cursor-pointer rounded-2xl border border-line text-left transition-colors duration-150 hover:bg-paper-2"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
        contextMenuFromKey(e, onContextMenu);
      }}
    >
      {cover !== "none" && (
        <Cover vis={coverSrc} className={h} blobs={blobs} />
      )}
      <div className={cn("px-4 py-4", size === "s" && "px-3 py-3")}>
        <div className={cn("flex items-center gap-2 font-sans", size === "l" ? "text-2xl" : "text-lg")}>
          {row.icon ? (
            <NoteIcon
              icon={row.icon}
              size={size === "l" ? 22 : 18}
              className="shrink-0 text-ink"
            />
          ) : null}
          <span className="min-w-0 truncate">{row.title}</span>
        </div>
        {schema.length > 0 && (
          <div className="mt-3 space-y-1 font-mono text-[10px] text-mute">
            {schema.map((s) => {
              const kind = accentKind(s.type);
              return (
                <div
                  key={s.key}
                  className={
                    kind === "smart" ? "text-smart/80" : kind === "tag" ? "text-tag/80" : undefined
                  }
                >
                  {s.name}: <PropValue note={row} spec={s} />
                </div>
              );
            })}
          </div>
        )}
        {showSnippet && snippet(row.body) && (
          <p className="mt-3 line-clamp-3 text-sm text-mute">{snippet(row.body)}</p>
        )}
      </div>
    </div>
  );
}

function Cover({
  vis,
  className,
  blobs,
}: {
  vis: { color?: string; src?: string } | null;
  className: string;
  blobs: Record<string, BlobRecord>;
}) {
  if (!vis) return <div className={cn(className, "bg-paper-2")} />;
  if (vis.src) {
    const url = resolveAssetSrc(vis.src, blobs);
    return (
      <div className={cn(className, "overflow-hidden bg-paper-2")}>
        <img src={url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return <div className={className} style={{ background: vis.color }} />;
}

export function coverSource(row: Note, cover: CoverSource): { color?: string; src?: string } | null {
  if (cover === "none") return null;
  if (cover === "first-image") {
    const src = firstImageSrc(row.body);
    if (src) return { src };
  }
  if (row.cover) {
    if (row.cover.startsWith("#")) return { color: row.cover };
    if (isImagePath(row.cover) || row.cover.startsWith("assets/")) return { src: row.cover };
    return { color: row.cover };
  }
  const src = firstImageSrc(row.body);
  return src ? { src } : null;
}

