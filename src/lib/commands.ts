import type { DbViewType, InsertCommand, InsertContext, Note } from "@/types";

const BLOCKS: InsertCommand[] = [
  { id: "h1", label: "Heading 1", section: "blocks", slash: true, action: "snippet", snippet: "# " },
  { id: "h2", label: "Heading 2", section: "blocks", slash: true, action: "snippet", snippet: "## " },
  { id: "h3", label: "Heading 3", section: "blocks", slash: true, action: "snippet", snippet: "### " },
  { id: "bullet", label: "Bullet list", section: "blocks", slash: true, action: "snippet", snippet: "- " },
  { id: "number", label: "Numbered list", section: "blocks", slash: true, action: "snippet", snippet: "1. " },
  { id: "todo", label: "To-do", section: "blocks", slash: true, action: "snippet", snippet: "- [ ] " },
  { id: "quote", label: "Quote", section: "blocks", slash: true, action: "snippet", snippet: "> " },
  { id: "callout", label: "Callout", section: "blocks", slash: true, action: "snippet", snippet: "> [!note]\n> " },
  { id: "transclude", label: "Embed note", section: "blocks", slash: true, action: "snippet", snippet: "![[]]" },
  { id: "code", label: "Code", section: "blocks", slash: true, action: "snippet", snippet: "```\n\n```\n" },
  { id: "divider", label: "Divider", section: "blocks", slash: true, action: "snippet", snippet: "\n---\n\n" },
  { id: "table", label: "Table", section: "blocks", slash: true, action: "snippet", snippet: "|   |   |\n| --- | --- |\n|   |   |\n" },
  { id: "wiki", label: "Wikilink", section: "blocks", slash: true, action: "snippet", snippet: "[[]]" },
  { id: "embed", label: "Embed URL", section: "blocks", slash: true, action: "embed" },
];

const MEDIA: InsertCommand[] = [
  { id: "image", label: "Image", section: "media", slash: true, action: "image" },
  { id: "audio", label: "Audio", section: "media", slash: true, action: "audio" },
  { id: "file", label: "File", section: "media", slash: true, action: "file" },
];

const AI: InsertCommand[] = [
  { id: "dump", label: "Brain dump", section: "ai", slash: true, action: "dump", hint: "⌘⇧D" },
  { id: "transcribe", label: "Transcribe", section: "ai", slash: true, action: "transcribe" },
];

const PAGES: InsertCommand[] = [
  { id: "page", label: "Blank page", section: "pages", action: "page", hint: "⌘N" },
  { id: "daily", label: "Daily note", section: "pages", action: "daily" },
  { id: "new-template", label: "Template page", section: "pages", action: "new-template" },
];

const DB_TYPES: { type: DbViewType; label: string }[] = [
  { type: "table", label: "Table database" },
  { type: "board", label: "Board database" },
  { type: "gallery", label: "Gallery database" },
  { type: "card", label: "Card database" },
  { type: "list", label: "List database" },
  { type: "calendar", label: "Calendar database" },
];

export const SECTION_ORDER: Record<InsertContext, InsertCommand["section"][]> = {
  sidebar: ["pages", "databases", "media", "ai", "blocks", "current"],
  editor: ["blocks", "media", "ai", "pages", "databases", "current"],
  database: ["current", "pages", "databases", "media", "ai", "blocks"],
};

export function buildCommands(notes: Note[], context: InsertContext): InsertCommand[] {
  const templates = notes.filter((n) => n.template && n.type === "page");
  const dbs: InsertCommand[] = DB_TYPES.map((d) => ({
    id: `db-${d.type}`,
    label: d.label,
    section: "databases",
    action: "database",
    viewType: d.type,
  }));
  const fromTemplates: InsertCommand[] = templates.map((t) => ({
    id: `tpl-${t.id}`,
    label: `Template: ${t.title}`,
    section: "pages",
    action: "from-template",
    templateId: t.id,
  }));
  const current: InsertCommand[] =
    context === "database"
      ? [
          { id: "row", label: "New row", section: "current", action: "row" },
          { id: "view-table", label: "Table view", section: "current", action: "add-view", viewType: "table" },
          { id: "view-board", label: "Board view", section: "current", action: "add-view", viewType: "board" },
          { id: "view-gallery", label: "Gallery view", section: "current", action: "add-view", viewType: "gallery" },
          { id: "view-card", label: "Card view", section: "current", action: "add-view", viewType: "card" },
          { id: "view-list", label: "List view", section: "current", action: "add-view", viewType: "list" },
          { id: "view-cal", label: "Calendar view", section: "current", action: "add-view", viewType: "calendar" },
        ]
      : [];
  return [...current, ...PAGES, ...fromTemplates, ...dbs, ...BLOCKS, ...MEDIA, ...AI];
}

export function slashCommands(notes: Note[]) {
  return buildCommands(notes, "editor").filter((c) => c.slash);
}

export function filterCommands(cmds: InsertCommand[], q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return cmds;
  return cmds.filter((c) => c.label.toLowerCase().includes(query) || c.id.includes(query));
}

export function grouped(
  cmds: InsertCommand[],
  context: InsertContext,
): { section: InsertCommand["section"]; items: InsertCommand[] }[] {
  const order = SECTION_ORDER[context];
  return order
    .map((section) => ({ section, items: cmds.filter((c) => c.section === section) }))
    .filter((g) => g.items.length);
}

export const SECTION_LABEL: Record<InsertCommand["section"], string> = {
  pages: "Pages",
  databases: "Databases",
  blocks: "Blocks",
  media: "Media",
  ai: "AI",
  current: "This database",
};
