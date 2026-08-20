import { assetKindFromPath } from "@/lib/assets";
import {
  defaultFileDisplay,
  fileNameFromPath,
  isAttachedFileHref,
  isLocalAssetHref,
  parseFileDisplay,
  serializeFileMarkdown,
  type FileDisplay,
} from "@/lib/file-display";
import { wikiToHtmlSpans } from "@/lib/parse";
import { wordFontSyntaxToHtml } from "@/lib/word-font";
import { marked, Renderer } from "marked";
import TurndownService from "turndown";

marked.setOptions({ gfm: true, breaks: false });

const renderer = new Renderer();
const defaultLink = renderer.link.bind(renderer);
const defaultImage = renderer.image.bind(renderer);

function vaultFileHtml(src: string, name: string, kind: ReturnType<typeof assetKindFromPath>, display: FileDisplay) {
  return `<div data-vault-file data-src="${escapeAttr(src)}" data-name="${escapeAttr(name)}" data-kind="${kind}" data-display="${display}"></div>`;
}

renderer.link = function link(args) {
  const href = args.href ?? "";
  const text = this.parser.parseInline(args.tokens);
  const label = stripTags(typeof text === "string" ? text : String(text));
  if (!isAttachedFileHref(href)) return defaultLink(args);
  const kind = assetKindFromPath(href, label);
  const display = parseFileDisplay(args.title) ?? defaultFileDisplay(kind);
  return vaultFileHtml(href, fileNameFromPath(href, label), kind, display);
};

renderer.image = function image(args) {
  const href = args.href ?? "";
  if (!isLocalAssetHref(href)) return defaultImage(args);
  const name = args.text || fileNameFromPath(href);
  const display = parseFileDisplay(args.title) ?? defaultFileDisplay("image");
  return vaultFileHtml(href, name, "image", display);
};

marked.use({ renderer });

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "");
}

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

td.addRule("wordFont", {
  filter: (node) => {
    if (node.nodeName !== "SPAN") return false;
    return (node as HTMLElement).hasAttribute("data-word-font");
  },
  replacement: (content, node) => {
    const font = (node as HTMLElement).getAttribute("data-word-font");
    if (!font) return content;
    return `{font:${font}}${content}{/font}`;
  },
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

td.addRule("vaultFile", {
  filter: (node) => node.nodeName === "DIV" && (node as HTMLElement).hasAttribute("data-vault-file"),
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const src = el.getAttribute("data-src") ?? "";
    if (!src) return "";
    const name = el.getAttribute("data-name") || src.split("/").pop() || "file";
    const kind = assetKindFromPath(src, name);
    const display = (parseFileDisplay(el.getAttribute("data-display")) ?? defaultFileDisplay(kind)) as FileDisplay;
    return `\n${serializeFileMarkdown({ src, name, kind, display })}\n\n`;
  },
});

td.addRule("vaultAudio", {
  filter: "audio",
  replacement: (_content, node) => {
    const src = (node as HTMLElement).getAttribute("src") ?? "";
    return src ? `\n[audio](${src})\n\n` : "";
  },
});

td.addRule("vaultVideo", {
  filter: "video",
  replacement: (_content, node) => {
    const src = (node as HTMLElement).getAttribute("src") ?? "";
    return src ? `\n[video](${src})\n\n` : "";
  },
});

td.addRule("vaultPdf", {
  filter: (node) => node.nodeName === "IFRAME" && (node as HTMLElement).hasAttribute("data-vault-pdf"),
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const src = el.getAttribute("src") ?? "";
    const name = el.getAttribute("title") || src.split("/").pop() || "file";
    return src ? `\n[${name}](${src})\n\n` : "";
  },
});

export function mdToHtml(md: string) {
  const prepped = wordFontSyntaxToHtml(wikiToHtmlSpans(md || ""));
  const html = marked.parse(prepped, { async: false });
  return typeof html === "string" ? html : "";
}

export function htmlToMd(html: string) {
  return td.turndown(html || "").trim() + "\n";
}
