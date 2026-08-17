export type PropType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "url"
  | "relation"
  | "tags"
  | "files"
  | "formula"
  | "rollup";

export const PROP_TYPES: PropType[] = [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
  "url",
  "relation",
  "tags",
  "files",
  "formula",
  "rollup",
];

export type RollupAgg =
  | "count"
  | "count_unique"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "show"
  | "show_unique"
  | "checked"
  | "percent_checked"
  | "earliest"
  | "latest";

export const ROLLUP_AGGS: RollupAgg[] = [
  "count",
  "count_unique",
  "sum",
  "avg",
  "min",
  "max",
  "show",
  "show_unique",
  "checked",
  "percent_checked",
  "earliest",
  "latest",
];

export interface RollupConfig {
  relation: string;
  property: string;
  agg: RollupAgg;
}

export interface SchemaProp {
  key: string;
  name: string;
  type: PropType;
  options?: string[];
  relationTo?: string;
  description?: string;
  default?: unknown;
  hidden?: boolean;
  formula?: string;
  rollup?: RollupConfig;
}

export type DbViewType = "table" | "board" | "gallery" | "list" | "calendar" | "card";

export const DB_VIEW_TYPES: DbViewType[] = [
  "table",
  "board",
  "gallery",
  "card",
  "list",
  "calendar",
];

export type FilterOp = "eq" | "neq" | "contains" | "empty" | "not_empty";

export interface ViewFilter {
  key: string;
  op: FilterOp;
  value?: unknown;
}

export interface ViewSort {
  key: string;
  dir: "asc" | "desc";
}

export type CoverSource = "page" | "first-image" | "none";
export type CardSize = "s" | "m" | "l";

export interface DbView {
  id: string;
  name: string;
  type: DbViewType;
  groupBy?: string;
  dateProp?: string;
  cover?: CoverSource;
  cardSize?: CardSize;
  visible?: string[];
  wrap?: boolean;
  filters?: ViewFilter[];
  sorts?: ViewSort[];
}

export type PageFont = "sans" | "serif" | "mono";
export type PageWidth = "s" | "m" | "l";
export type EditorMode = "wysiwyg" | "markdown" | "read";

export const EDITOR_MODES: EditorMode[] = ["wysiwyg", "markdown", "read"];

export const EDITOR_MODE_LABEL: Record<EditorMode, string> = {
  wysiwyg: "Block",
  markdown: "Source",
  read: "Read",
};

export function nextEditorMode(mode: EditorMode): EditorMode {
  const i = EDITOR_MODES.indexOf(mode);
  return EDITOR_MODES[(i + 1) % EDITOR_MODES.length];
}

export interface NoteComment {
  id: string;
  body: string;
  author: string;
  created: string;
  resolved?: boolean;
}

export interface Peer {
  id: string;
  name: string;
  noteId?: string;
  at: number;
}

export interface Note {
  id: string;
  path: string;
  title: string;
  body: string;
  type: "page" | "database";
  /** Emoji/short mark, or `lucide:{kebab-name}` (e.g. lucide:file-text). */
  icon?: string;
  cover?: string;
  font?: PageFont;
  width?: PageWidth;
  smallText?: boolean;
  template?: boolean;
  tags: string[];
  parent?: string;
  props: Record<string, unknown>;
  schema?: SchemaProp[];
  views?: DbView[];
  comments?: NoteComment[];
  created: string;
  updated: string;
}

export type AppView =
  | { kind: "welcome" }
  | { kind: "note"; id: string }
  | { kind: "database"; id: string; viewId?: string }
  | { kind: "graph" }
  | { kind: "calendar" }
  | { kind: "freeform" }
  | { kind: "tag"; tag: string };

export type InsertContext = "sidebar" | "editor" | "database";

export type CommandSection = "pages" | "databases" | "blocks" | "media" | "ai" | "current";

export interface InsertCommand {
  id: string;
  label: string;
  section: CommandSection;
  hint?: string;
  slash?: boolean;
  snippet?: string;
  action: string;
  viewType?: DbViewType;
  templateId?: string;
}

export interface AiSettings {
  endpoint: string;
  model: string;
  apiKey: string;
}

/** Per-workspace AI preference: remote uses Gemini settings; local uses heuristics / on-device only. */
export type WorkspaceAiMode = "local" | "remote";

export type WorkspaceToolId =
  | "brainDump"
  | "board"
  | "calendar"
  | "graph"
  | "writingTools";

export interface WorkspaceTools {
  brainDump: boolean;
  board: boolean;
  calendar: boolean;
  graph: boolean;
  writingTools: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  tools: WorkspaceTools;
  aiMode: WorkspaceAiMode;
  created: string;
  updated: string;
}

/** Calendar-only item — not a vault page. */
export interface VaultEvent {
  id: string;
  title: string;
  body: string;
  /** YYYY-MM-DD */
  date: string;
  /** Project folder label for context */
  project?: string;
  tags: string[];
  created: string;
  updated: string;
}

/** Freeform whiteboard tools (UI selection). */
export type FreeformTool =
  | "select"
  | "pan"
  | "text"
  | "draw"
  | "sticky"
  | "image"
  | "link"
  | "table"
  | "mind"
  | "mention";

export type FreeformStickyColor = "amber" | "sage" | "rose" | "sky" | "paper";

export interface FreeformCamera {
  x: number;
  y: number;
  zoom: number;
}

interface FreeformObjectBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export type FreeformObject =
  | (FreeformObjectBase & {
      type: "text";
      text: string;
      /** px; defaults to 16 when omitted (legacy boards). */
      fontSize?: number;
      /** Named ink tone id; defaults to "ink". */
      color?: string;
      /** Page font: sans / serif / mono. Defaults to serif. */
      fontFamily?: PageFont;
      bold?: boolean;
      italic?: boolean;
      /** Strikethrough (barré). */
      strike?: boolean;
    })
  | (FreeformObjectBase & {
      type: "sticky";
      text: string;
      /** Sticky paper background. */
      color: FreeformStickyColor;
      /** Body text size in px; defaults to 14 when omitted. */
      fontSize?: number;
      /** Named ink tone id for sticky body text; defaults to "ink". */
      textColor?: string;
      fontFamily?: PageFont;
      bold?: boolean;
      italic?: boolean;
      strike?: boolean;
    })
  | (FreeformObjectBase & {
      type: "path";
      points: { x: number; y: number }[];
      /** Named ink id or CSS color; legacy may use "currentColor". */
      stroke: string;
      strokeWidth: number;
      /** 0–1; used by highlighter ink. Defaults to 1. */
      opacity?: number;
    })
  | (FreeformObjectBase & { type: "image"; src: string; alt: string })
  | (FreeformObjectBase & { type: "link"; url: string; title: string })
  | (FreeformObjectBase & {
      type: "table";
      cols: number;
      rows: number;
      cells: string[][];
      /** Emphasize first row as header. */
      headerRow?: boolean;
    })
  | (FreeformObjectBase & {
      type: "mind";
      text: string;
      parentId?: string;
      fontSize?: number;
      /** Named ink tone or #hex; defaults to ink. */
      color?: string;
      fontFamily?: PageFont;
      bold?: boolean;
      italic?: boolean;
      strike?: boolean;
    })
  | (FreeformObjectBase & {
      type: "mention";
      /** Note id for page/database, or vault blob path for file. */
      noteId: string;
      title: string;
      kind?: "page" | "database" | "file";
    });

/** Vault-wide freeform board — not a markdown page. */
export interface FreeformConnection {
  id: string;
  from: string;
  to: string;
}

export interface FreeformBoard {
  id: string;
  title: string;
  objects: FreeformObject[];
  /** Mind-map / connector lines between any objects (not limited to mind nodes). */
  connections?: FreeformConnection[];
  dotted: boolean;
  camera: FreeformCamera;
  updated: string;
}

export interface GraphNode {
  id: string;
  title: string;
  kind: "page" | "database" | "tag";
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "link" | "relation" | "tag";
}

export interface BlobRecord {
  mime: string;
  data: ArrayBuffer;
}

export interface ImageRef {
  alt: string;
  caption: string;
  src: string;
  width?: number;
}
