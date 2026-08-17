import { wikiToHtmlSpans } from "@/lib/parse";
import { marked } from "marked";
import TurndownService from "turndown";

marked.setOptions({ gfm: true, breaks: false });

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

td.addRule("taskItem", {
  filter: (node) => {
    if (node.nodeName !== "LI") return false;
    const el = node as HTMLElement;
    return el.getAttribute("data-checked") !== null || Boolean(el.querySelector("input[type=checkbox]"));
  },
  replacement: (content, node) => {
    const el = node as HTMLElement;
    const checked =
      el.getAttribute("data-checked") === "true" ||
      Boolean((el.querySelector("input[type=checkbox]") as HTMLInputElement | null)?.checked);
    const text = content.replace(/^\s*(\[[ xX]\]\s*)?/, "").trim();
    return `- [${checked ? "x" : " "}] ${text}\n`;
  },
});

td.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: (content) => `~~${content}~~`,
});

td.addRule("underline", {
  filter: ["u"],
  replacement: (content) => `<u>${content}</u>`,
});

td.addRule("wikiLink", {
  filter: (node) => {
    if (node.nodeName !== "SPAN") return false;
    return (node as HTMLElement).hasAttribute("data-wiki");
  },
  replacement: (content, node) => {
    const el = node as HTMLElement;
    const target = el.getAttribute("data-wiki") || content.trim();
    const embed = el.getAttribute("data-embed") === "true";
    const label = content.trim();
    const inner = label && label !== target ? `${target}|${label}` : target;
    return embed ? `![[${inner}]]` : `[[${inner}]]`;
  },
});

td.addRule("table", {
  filter: "table",
  replacement: (_content, node) => {
    const table = node as HTMLTableElement;
    const rows = [...table.querySelectorAll("tr")];
    if (!rows.length) return "";
    const cells = (row: Element) =>
      [...row.querySelectorAll("th,td")].map((c) => c.textContent?.trim().replace(/\|/g, "\\|") ?? "");
    const header = cells(rows[0]);
    const lines = [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...rows.slice(1).map((r) => `| ${cells(r).join(" | ")} |`),
    ];
    return `\n${lines.join("\n")}\n\n`;
  },
});

export function mdToHtml(md: string) {
  const html = marked.parse(wikiToHtmlSpans(md || ""), { async: false });
  return typeof html === "string" ? html : "";
}

export function htmlToMd(html: string) {
  return td.turndown(html || "").trim() + "\n";
}
