import { cn } from "@/lib/cn";
import {
  isLucideIcon,
  lookupPageIcon,
  lucideIconName,
} from "@/lib/page-icons";
import type { DbViewType, EditorMode, PropType } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  AudioLines,
  Brackets,
  Calendar,
  CalendarDays,
  ChevronsUpDown,
  CodeXml,
  Columns3,
  Copy,
  Database,
  Equal,
  Eye,
  File,
  FilePlus,
  FileText,
  GalleryHorizontal,
  GanttChart,
  GitBranch,
  Globe,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Image,
  LayoutGrid,
  Library,
  Link2,
  List,
  MapPin,
  ListOrdered,
  ListTodo,
  MessageSquareWarning,
  Mic,
  Minus,
  Network,
  Paperclip,
  Quote,
  Sigma,
  Sparkles,
  SquareCheck,
  Table2,
  Tags,
  Type,
  Users,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

export const STROKE = 1.4;
export const ICON_SM = 13;
export const ICON_MD = 15;
export const ICON_LG = 36;

export function ChromeIcon({
  icon: Icon,
  size = ICON_SM,
  className = "shrink-0 text-faint",
  strokeWidth = STROKE,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

const extraLucide = new Map<string, LucideIcon>();

function LazyLucideIcon({
  name,
  size,
  className,
  fallback: Fallback,
}: {
  name: string;
  size: number;
  className: string;
  fallback?: LucideIcon;
}) {
  const [Icon, setIcon] = useState<LucideIcon | undefined>(() => extraLucide.get(name));

  useEffect(() => {
    const cached = extraLucide.get(name);
    if (cached) {
      setIcon(() => cached);
      return;
    }
    let alive = true;
    void import("lucide-react/dynamicIconImports").then((mod) => {
      const loaders = mod.default as Record<string, () => Promise<{ default: LucideIcon }>>;
      const load = loaders[name];
      if (!load) return;
      return load().then((m) => {
        extraLucide.set(name, m.default);
        if (alive) setIcon(() => m.default);
      });
    });
    return () => {
      alive = false;
    };
  }, [name]);

  if (Icon) return <ChromeIcon icon={Icon} size={size} className={className} />;
  if (Fallback) return <ChromeIcon icon={Fallback} size={size} className={className} />;
  return <span className={className} style={{ width: size, height: size }} />;
}

export function NoteIcon({
  icon,
  fallback,
  size = ICON_SM,
  className = "shrink-0 text-faint",
}: {
  icon?: string;
  fallback?: LucideIcon;
  size?: number;
  className?: string;
}) {
  if (!icon) {
    return fallback ? <ChromeIcon icon={fallback} size={size} className={className} /> : null;
  }
  if (isLucideIcon(icon)) {
    const name = lucideIconName(icon);
    const known = lookupPageIcon(name);
    if (known) return <ChromeIcon icon={known} size={size} className={className} />;
    return <LazyLucideIcon name={name} size={size} className={className} fallback={fallback} />;
  }
  return (
    <span
      className={cn("inline-flex items-center justify-center leading-none", className)}
      style={{ fontSize: Math.max(11, size) }}
      aria-hidden
    >
      {icon}
    </span>
  );
}

export function renderNoteIcon(icon?: string, fallback?: LucideIcon) {
  return <NoteIcon icon={icon} fallback={fallback} />;
}

export function NoteLabel({
  note,
  size = ICON_SM,
  className,
}: {
  note: { icon?: string; title: string };
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {note.icon ? <NoteIcon icon={note.icon} size={size} className="shrink-0 text-faint" /> : null}
      <span className="truncate">{note.title}</span>
    </span>
  );
}

export {
  filterPageIcons,
  isLucideIcon,
  lucideIconValue,
  lookupPageIcon,
  PAGE_ICON_NAMES,
  PAGE_ICONS,
} from "@/lib/page-icons";

export function accentKind(type: PropType): "tag" | "prop" | "smart" {
  if (type === "tags") return "tag";
  if (type === "formula" || type === "rollup") return "smart";
  return "prop";
}

export function accentIconClass(type: PropType) {
  const kind = accentKind(type);
  if (kind === "tag") return "shrink-0 text-tag/80";
  if (kind === "smart") return "shrink-0 text-smart/80";
  return "shrink-0 text-prop/75";
}

export const PROP_ICONS: Record<PropType, LucideIcon> = {
  text: Type,
  number: Hash,
  select: ChevronsUpDown,
  multi_select: Tags,
  date: Calendar,
  checkbox: SquareCheck,
  url: Link2,
  relation: GitBranch,
  people: Users,
  location: MapPin,
  tags: Hash,
  files: Paperclip,
  formula: Equal,
  rollup: Sigma,
};

export const VIEW_ICONS: Record<DbViewType, LucideIcon> = {
  table: Table2,
  board: Columns3,
  gallery: LayoutGrid,
  card: GalleryHorizontal,
  list: List,
  calendar: CalendarDays,
  timeline: GanttChart,
};

export const MODE_ICONS: Record<EditorMode, LucideIcon> = {
  wysiwyg: AlignLeft,
  markdown: CodeXml,
  read: Eye,
};

const COMMAND_ICONS: Record<string, LucideIcon> = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  bullet: List,
  number: ListOrdered,
  todo: ListTodo,
  quote: Quote,
  callout: MessageSquareWarning,
  code: CodeXml,
  divider: Minus,
  table: Table2,
  wiki: Brackets,
  transclude: Brackets,
  embed: Globe,
  image: Image,
  audio: Volume2,
  file: File,
  dump: Sparkles,
  meeting: AudioLines,
  transcribe: Mic,
  page: FilePlus,
  daily: Calendar,
  "new-template": Copy,
  row: FilePlus,
};

export function commandIcon(id: string): LucideIcon {
  if (COMMAND_ICONS[id]) return COMMAND_ICONS[id];
  if (id.startsWith("tpl-")) return Copy;
  if (id.startsWith("db-")) {
    const type = id.slice(3) as DbViewType;
    return VIEW_ICONS[type] ?? Database;
  }
  if (id.startsWith("view-")) {
    const raw = id.slice(5) === "cal" ? "calendar" : id.slice(5);
    return VIEW_ICONS[raw as DbViewType] ?? Database;
  }
  return FileText;
}

export function noteKindIcon(type: "page" | "database"): LucideIcon {
  return type === "database" ? Database : FileText;
}

/** Single-char ink marks that read as empty circles/squares in the sidebar tree. */
const INK_MARKS = new Set(["✦", "◇", "○", "★", "✎", "▣", "▤"]);

export function isInkMark(icon?: string): boolean {
  return Boolean(icon && INK_MARKS.has(icon));
}

/** Prefer kind fallback over ink marks so pages and databases stay visually distinct. */
export function treeNoteIcon(icon: string | undefined, kind?: "page" | "database"): string | undefined {
  if (!icon || isInkMark(icon)) return undefined;
  if (kind === "database" && !isLucideIcon(icon) && icon.length <= 2) return undefined;
  return icon;
}

export { Database, FileText, Hash, Library, Network };
