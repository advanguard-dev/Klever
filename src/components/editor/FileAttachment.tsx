import { ImageBlock } from "@/components/editor/ImageBlock";
import { useContextMenu } from "@/components/ContextMenu";
import { Segmented } from "@/components/ui";
import { assetKindFromPath, type AssetKind } from "@/lib/assets";
import {
  defaultFileDisplay,
  fileDisplayOptions,
  fileNameFromPath,
  formatBytes,
  kindLabel,
  parseFileDisplay,
  type FileDisplay,
} from "@/lib/file-display";
import { openLocalFile, revealFileLabel } from "@/lib/open-local-file";
import { useApp } from "@/store";
import type { BlobRecord } from "@/types";
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
}: {
  src: string;
  name?: string;
  title?: string | null;
  display?: FileDisplay;
  readOnly?: boolean;
  onDisplay?: (display: FileDisplay) => void;
}) {
  const blobs = useApp((s) => s.blobs);
  const { open } = useContextMenu();
  const path = src.replace(/^\.\//, "");
  const rec = blobs[path] ?? blobs[src];
  const kind = assetKindFromPath(path, name);
  const label = fileNameFromPath(path, name);
  const display = displayProp ?? parseFileDisplay(title) ?? defaultFileDisplay(kind);
  const options = fileDisplayOptions(kind);
  const mode = options.some((o) => o.value === display) ? display : defaultFileDisplay(kind);

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

  if (kind === "image" && mode !== "link") {
    return (
      <div className="vault-file my-4" onContextMenu={onMenu}>
        <ImageBlock src={path} caption={label} readOnly={readOnly} />
        {chrome}
      </div>
    );
  }

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

  return (
    <div className="vault-file my-4" onContextMenu={onMenu}>
      <FileCard kind={kind} label={label} rec={rec} onOpen={() => openFile("open")} />
      {chrome}
    </div>
  );
}

function FileCard({
  kind,
  label,
  rec,
  onOpen,
}: {
  kind: AssetKind;
  label: string;
  rec?: BlobRecord;
  onOpen: () => void;
}) {
  const Icon = KIND_ICON[kind];
  const meta = [
    kindLabel(kind),
    rec?.localPath ? "On disk" : rec?.data?.byteLength ? formatBytes(rec.data.byteLength) : "",
  ]
    .filter(Boolean)
    .join(" · ");
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
