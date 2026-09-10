export const WIKI_DISPLAYS = ["mention", "title", "card"] as const;
export type WikiDisplay = (typeof WIKI_DISPLAYS)[number];

const DISPLAYS = new Set<string>(WIKI_DISPLAYS);

export function parseWikiDisplay(raw?: string | null, embed?: boolean): WikiDisplay {
  const t = raw?.trim().toLowerCase();
  if (t && DISPLAYS.has(t)) return t as WikiDisplay;
  if (embed || t === "true" || t === "embed") return "card";
  return "mention";
}

export function wikiDisplayOptions(): { value: WikiDisplay; label: string }[] {
  return [
    { value: "mention", label: "Mention" },
    { value: "title", label: "Title" },
    { value: "card", label: "Card" },
  ];
}

export function serializeWikiMarkdown(opts: {
  target: string;
  label?: string;
  display?: WikiDisplay | string | null;
  embed?: boolean;
}) {
  const target = opts.target.trim();
  const label = opts.label?.trim();
  const alias = label && label !== target ? `|${label}` : "";
  const display = parseWikiDisplay(opts.display, opts.embed);
  if (display === "card") return `![[${target}${alias}]]`;
  if (display === "title") return `[[${target}#title${alias}]]`;
  return `[[${target}${alias}]]`;
}
