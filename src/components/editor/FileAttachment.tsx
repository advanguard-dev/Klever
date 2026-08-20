import { ImageBlock } from "@/components/editor/ImageBlock";
import { useContextMenu } from "@/components/ContextMenu";
import { Segmented } from "@/components/ui";
import {
  assetKindFromPath,
  parseAlt,
  resolveAssetSrc,
  type AssetKind,
} from "@/lib/assets";
import {
  canPreviewKind,
  decodeTextSnippet,
  defaultFileDisplay,
  fileDisplayOptions,
  fileNameFromPath,
  formatBytes,
  kindLabel,
  parseFileDisplay,
  tableRowsFromText,
  type FileDisplay,
} from "@/lib/file-display";
import { openLocalFile, revealFileLabel } from "@/lib/open-local-file";
import { useApp } from "@/store";
import type { BlobRecord } from "@/types";
import { useEffect } from "react";
import {
  File,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link2,
  Presentation,
  Volume2,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const KIND_ICON: Record<AssetKind, LucideIcon> = {
  image: ImageIcon,
  audio: Volume2,
  video: Video,
  pdf: FileText,
  text: FileText,
  table: FileSpreadsheet,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: FileArchive,
  file: File,
};

export function FileAttachment({
  src,
  name,
  title,
  display: displayProp,
  readOnly,
  onDisplay,
  onWidth,
  onReplaceSrc,
}: {
  src: string;
  name?: string;
  title?: string | null;
  display?: FileDisplay;
  readOnly?: boolean;
  onDisplay?: (display: FileDisplay) => void;
  onWidth?: (width: number) => void;
  onReplaceSrc?: (next: string) => void;
}) {
  const blobs = useApp((s) => s.blobs);
  const ensureBlob = useApp((s) => s.ensureBlob);
  const { open } = useContextMenu();
  const path = src.replace(/^\.\//, "");
  const rec = blobs[path] ?? blobs[src];
  const kind = assetKindFromPath(path, name);
  const label = fileNameFromPath(path, name);
  const parsed = parseAlt(name ?? "");
  const display = displayProp ?? parseFileDisplay(title) ?? defaultFileDisplay(kind);
  const url = resolveAssetSrc(path, blobs);
  const hasData = Boolean(rec?.data?.byteLength);
  const options = fileDisplayOptions(kind);
  const mode = options.some((o) => o.value === display) ? display : defaultFileDisplay(kind);
  const previewMode = mode === "preview" && canPreviewKind(kind);

  useEffect(() => {
    if (!path || hasData || !previewMode) return;
    void ensureBlob(path);
  }, [path, hasData, previewMode, ensureBlob]);

  const openFile = (fileMode: "reveal" | "open" = "open") => {
    void openLocalFile(path, rec, { mode: fileMode, label });
  };

  const chrome =
    !readOnly && onDisplay ? (
      <div className="mt-2" onMouseDown={(e) => e.stopPropagation()}>
        <Segmented
          size="sm"
          aria-label="File display"
          value={mode}
          onChange={onDisplay}
          options={options}
        />
      </div>
    ) : null;

  const onMenu = (e: React.MouseEvent) => {
    open(e, [
      {
        id: "open",
        label: "Open file",
        onSelect: () => openFile("open"),
      },
      {
        id: "reveal",
        label: revealFileLabel(),
        onSelect: () => openFile("reveal"),
      },
      ...(readOnly || !onDisplay
        ? []
        : [
            { type: "sep" as const },
            ...options.map((o) => ({
              id: o.value,
              label: o.label,
              onSelect: () => onDisplay!(o.value),
            })),
          ]),
    ]);
  };

  if (mode === "link") {
    return (
      <span className="vault-file vault-file--link my-3 block" onContextMenu={onMenu}>
        <button
          type="button"
          onClick={() => openFile("open")}
          className="inline-flex items-center gap-1.5 text-smart underline-offset-2 hover:underline"
        >
          <Link2 size={13} strokeWidth={1.4} className="text-faint" aria-hidden />
          {label}
        </button>
        {chrome}
      </span>
    );
  }

  if (mode === "card" || !canPreviewKind(kind)) {
    return (
      <div className="vault-file my-4" onContextMenu={onMenu}>
        <FileCard kind={kind} label={label} rec={rec} onOpen={() => openFile("open")} />
        {chrome}
      </div>
    );
  }

  if (!url && !hasData) {
    return (
      <div className="vault-file my-4" onContextMenu={onMenu}>
        <FileCard kind={kind} label={label} rec={rec} loading onOpen={() => openFile("open")} />
        {chrome}
      </div>
    );
  }

  return (
    <div className="vault-file my-4" onContextMenu={onMenu}>
      <FilePreview
        kind={kind}
        path={path}
        url={url}
        label={parsed.caption || label}
        rec={rec}
        width={parsed.width}
        readOnly={readOnly}
        onWidth={onWidth}
        onReplaceSrc={onReplaceSrc}
      />
      {chrome}
    </div>
  );
}

function FilePreview({
  kind,
  path,
  url,
  label,
  rec,
  width,
  readOnly,
  onWidth,
  onReplaceSrc,
}: {
  kind: AssetKind;
  path: string;
  url: string;
  label: string;
  rec?: BlobRecord;
  width?: number;
  readOnly?: boolean;
  onWidth?: (width: number) => void;
  onReplaceSrc?: (next: string) => void;
}) {
  if (kind === "image") {
    return (
      <ImageBlock
        src={path}
        caption={label === fileNameFromPath(path) ? "" : label}
        width={width}
        readOnly={readOnly}
        onWidth={onWidth}
        onReplaceSrc={onReplaceSrc}
      />
    );
  }
  if (kind === "audio") {
    return <audio controls src={url} className="vault-audio w-full" />;
  }
  if (kind === "video") {
    return <video controls src={url} className="vault-video" />;
  }
  if (kind === "pdf") {
    return <iframe title={label} src={url} className="vault-pdf" />;
  }
  if (kind === "table" && rec) {
    const rows = tableRowsFromText(decodeTextSnippet(rec, 4000));
    if (!rows.length) {
      return (
        <FileCard kind={kind} label={label} rec={rec} onOpen={() => void openLocalFile(path, rec)} />
      );
    }
    return (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left font-mono text-[12px]">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i === 0 ? "text-ink" : "text-mute"}>
                {row.map((cell, j) => (
                  <td key={j} className="border-line px-2 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (kind === "text" && rec) {
    const snippet = decodeTextSnippet(rec);
    return (
      <pre className="vault-text max-h-72 overflow-auto rounded-xl border border-line bg-paper-2 px-3 py-2 font-mono text-[12px] leading-5 text-ink">
        {snippet || "Empty file."}
      </pre>
    );
  }
  return <FileCard kind={kind} label={label} rec={rec} onOpen={() => void openLocalFile(path, rec)} />;
}

function FileCard({
  kind,
  label,
  rec,
  loading,
  onOpen,
}: {
  kind: AssetKind;
  label: string;
  rec?: BlobRecord;
  loading?: boolean;
  onOpen: () => void;
}) {
  const Icon = KIND_ICON[kind];
  const meta = loading
    ? "Loading…"
    : [kindLabel(kind), rec ? formatBytes(rec.data.byteLength) : ""].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="file-card flex w-full items-center gap-3 rounded-xl border border-line bg-paper-2 px-3 py-2.5 text-left hover:border-ink/20"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper text-mute">
        <Icon size={18} strokeWidth={1.4} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-sm text-ink">{label}</span>
        <span className="block font-mono text-[11px] text-mute">{meta}</span>
      </span>
    </button>
  );
}
