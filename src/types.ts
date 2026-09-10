export type PropType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "url"
  | "relation"
  | "people"
  | "location"
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
  "people",
  "location",
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
  /** Swatch id per item/option label (select, tags, people, location). */
  itemColors?: Record<string, string>;
}

export type DbViewType = "table" | "board" | "gallery" | "list" | "calendar" | "card" | "timeline";

export const DB_VIEW_TYPES: DbViewType[] = [
  "table",
  "board",
  "gallery",
  "card",
  "list",
  "calendar",
  "timeline",
];

export type FilterOp = "eq" | "neq" | "contains" | "empty" | "not_empty" | "gt" | "lt" | "gte" | "lte";

/** Legacy flat filter (still accepted; normalized to FilterNode). */
export interface ViewFilter {
  key: string;
  op: FilterOp;
  value?: unknown;
}

/** Nested boolean filter tree (max depth ~3 in UI). */
export type FilterNode =
  | { type: "rule"; key: string; op: FilterOp; value?: unknown }
  | { type: "group"; op: "and" | "or"; children: FilterNode[] };

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
  /** Timeline end date property (optional range). */
  endDateProp?: string;
  cover?: CoverSource;
  cardSize?: CardSize;
  visible?: string[];
  wrap?: boolean;
  /** @deprecated Prefer `filter` tree; flat list = implicit AND. */
  filters?: ViewFilter[];
  /** Nested filter tree. */
  filter?: FilterNode;
  sorts?: ViewSort[];
}

export type PageFont = "sans" | "serif" | "mono";

export type TextAlign = "left" | "center" | "right";
export type TextVAlign = "top" | "middle" | "bottom";
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
  | { kind: "meeting" }
  | { kind: "unlock" }
  | { kind: "freeform"; id?: string }
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
  /** Legacy / fallback chat model when a per-tool field is empty. */
  model: string;
  /** Chat model for note writing tools. */
  writingModel?: string;
  /** Chat model for Brain dump structuring. */
  brainDumpModel?: string;
  /** Chat model for Meeting summarize. */
  meetingModel?: string;
  apiKey: string;
  /** Override system prompt for writing tools. */
  writingSystemPrompt?: string;
  /** Per-tool instruction overrides (id → instruction). */
  writingPrompts?: Record<string, string>;
  /** Last custom one-off prompt in the note editor. */
  lastCustomPrompt?: string;
  /** UI chrome locale (`en` | `fr`). Mirrored on persisted meta. */
  locale?: "en" | "fr";
}

/** Local developer automation (no cloud). Persisted with prefs. */
export interface DevSettings {
  /** Enable localhost REST API (Electron). */
  localApiEnabled: boolean;
  /** Port bound to 127.0.0.1 only. */
  localApiPort: number;
  /** Bearer token for localhost API. */
  localApiToken: string;
  /** POST targets on vault save — localhost only. */
  webhookUrls: string[];
  /** Prefer TF-IDF semantic ranking in search. */
  semanticSearch: boolean;
}

/** Cal.com embed: public username + event type slug. Stored with other prefs. */
export interface CalSettings {
  username: string;
  eventTypeSlug: string;
}

export type CalendarSourceKind = "ics" | "google" | "apple";

/** Subscribed calendar feed (ICS / Google / Apple iCal). Local prefs only — not written to the vault. */
export interface CalendarSource {
  id: string;
  kind: CalendarSourceKind;
  url: string;
  name: string;
  lastSync?: string;
  lastError?: string;
  /** UIDs hidden locally; they stay on the remote feed. */
  hiddenUids?: string[];
}

/** Per-workspace AI preference: remote uses Gemini settings; local uses heuristics / on-device only. */
export type WorkspaceAiMode = "local" | "remote";

export type WorkspaceToolId =
  | "brainDump"
  | "meeting"
  | "board"
  | "calendar"
  | "graph"
  | "writingTools"
  | "suggestions";

export interface WorkspaceTools {
  brainDump: boolean;
  meeting: boolean;
  board: boolean;
  calendar: boolean;
  graph: boolean;
  writingTools: boolean;
  suggestions: boolean;
}

export interface WorkspaceLock {
  enabled: true;
  kdf: "pbkdf2-sha256";
  iterations: number;
  saltB64: string;
  wrappedDekB64: string;
  wrappedDekIvB64: string;
  /** Touch ID / Keychain wrap is stored. */
  touchId?: boolean;
  /** safeStorage ciphertext of the raw DEK (base64). */
  touchWrappedB64?: string;
}

export interface Workspace {
  id: string;
  name: string;
  tools: WorkspaceTools;
  aiMode: WorkspaceAiMode;
  created: string;
  updated: string;
  lock?: WorkspaceLock;
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
  /** Public Cal.com booking page URL. */
  calUrl?: string;
  /** @deprecated API bookings; kept when loading older events. */
  calBookingUid?: string;
  /** Subscribed feed id when this event was pulled (local events omit this). */
  sourceId?: string;
  /** ICS UID (plus instance date for recurrences). */
  uid?: string;
  sourceKind?: CalendarSourceKind;
  /** Event page from the feed (Google htmlLink, webcal, or ICS URL). */
  htmlLink?: string;
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
  | "mention"
  | "shape";

/** Named pigment id (see board-model PIGMENTS) or `#rrggbb`. */
export type FreeformStickyColor = string;

export type FreeformShapeKind =
  | "rect"
  | "roundrect"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "hexagon"
  | "star"
  | "arrow";

export type FreeformStrokeDash = "solid" | "dashed" | "dotted";

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
      align?: TextAlign;
      valign?: TextVAlign;
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
      align?: TextAlign;
      valign?: TextVAlign;
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
      align?: TextAlign;
      valign?: TextVAlign;
    })
  | (FreeformObjectBase & {
      type: "mention";
      /** Note id for page/database, or vault blob path for file. */
      noteId: string;
      title: string;
      kind?: "page" | "database" | "file";
    })
  | (FreeformObjectBase & {
      type: "shape";
      shape: FreeformShapeKind;
      /** Named sticky id, ink id, `none`, or #hex. */
      fill: string;
      /** Named ink id, `none` / `transparent` for no outline, or #hex. */
      stroke: string;
      strokeWidth: number;
      strokeDash: FreeformStrokeDash;
      text: string;
      /** When false, hide the in-shape label. Defaults to true. */
      showLabel?: boolean;
      fontSize?: number;
      color?: string;
      fontFamily?: PageFont;
      bold?: boolean;
      italic?: boolean;
      strike?: boolean;
      align?: TextAlign;
      valign?: TextVAlign;
    });

/** Vault freeform board — not a markdown page. Multiple boards per workspace. */
export type FreeformConnectorKind = "straight" | "elbow" | "curve";
export type FreeformAnchor = "n" | "e" | "s" | "w";

export interface FreeformConnection {
  id: string;
  from: string;
  to: string;
  kind?: FreeformConnectorKind;
  fromAnchor?: FreeformAnchor;
  toAnchor?: FreeformAnchor;
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
  /** Outside the vault folder — never write a copy into the vault. */
  external?: boolean;
  /** Absolute path on disk — open the original file in place. */
  localPath?: string;
  /** Live disk/cloud handle so Klever can re-read instead of owning a copy. */
  handle?: FileSystemFileHandle;
}

export interface ImageRef {
  alt: string;
  caption: string;
  src: string;
  width?: number;
}
