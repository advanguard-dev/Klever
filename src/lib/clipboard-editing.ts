import { copyText } from "@/lib/context-menus";
import { pastePayload } from "@/lib/paste-guard";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@codemirror/view";

type JsonNode = { type: string; content?: JsonNode[]; text?: string };

const BATCH = 1200;

function jsonFromPlain(text: string): JsonNode[] {
  const parts = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return parts.map((block) => {
    const lines = block.split("\n");
    const content: JsonNode[] = [];
    lines.forEach((line, i) => {
      if (line) content.push({ type: "text", text: line });
      if (i < lines.length - 1) content.push({ type: "hardBreak" });
    });
    return { type: "paragraph", content: content.length ? content : undefined };
  });
}

function yieldFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/** Insert clipboard as ProseMirror JSON (plain) or cleaned HTML — never Office span soup. */
export async function insertClipboardIntoTipTap(editor: Editor, html: string, text: string) {
  const payload = pastePayload(html, text);
  if (!payload.text && !payload.html) return false;
  try {
    if (payload.html) {
      editor.commands.insertContent(payload.html);
      return true;
    }
    const nodes = jsonFromPlain(payload.text);
    if (nodes.length <= BATCH) {
      editor.commands.insertContent(nodes);
      return true;
    }
    for (let i = 0; i < nodes.length; i += BATCH) {
      if (editor.isDestroyed) return false;
      editor.commands.insertContent(nodes.slice(i, i + BATCH));
      if (i + BATCH < nodes.length) await yieldFrame();
    }
    return true;
  } catch {
    try {
      editor.commands.insertContent(payload.text);
      return true;
    } catch {
      return false;
    }
  }
}

/** Paste clipboard contents into a TipTap editor (context menu / programmatic). */
export async function pasteIntoTipTap(editor: Editor) {
  editor.chain().focus().run();
  let html = "";
  let text = "";
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (!html && item.types.includes("text/html")) {
        html = await (await item.getType("text/html")).text();
      }
      if (!text && item.types.includes("text/plain")) {
        text = await (await item.getType("text/plain")).text();
      }
    }
  } catch {
    /* read() blocked */
  }
  if (!text) {
    try {
      text = await navigator.clipboard.readText();
    } catch {
      /* clipboard blocked */
    }
  }
  if (!html && !text) return false;
  return insertClipboardIntoTipTap(editor, html, text);
}

export async function copyFromTipTap(editor: Editor) {
  const { from, to } = editor.state.selection;
  if (from === to) return false;
  await copyText(editor.state.doc.textBetween(from, to, "\n"));
  return true;
}

export async function cutFromTipTap(editor: Editor) {
  if (!(await copyFromTipTap(editor))) return false;
  editor.chain().focus().deleteSelection().run();
  return true;
}

export async function pasteIntoCodeMirror(view: EditorView) {
  try {
    const text = await navigator.clipboard.readText();
    view.dispatch(view.state.replaceSelection(text));
    view.focus();
    return true;
  } catch {
    return false;
  }
}

export async function copyFromCodeMirror(view: EditorView) {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;
  await copyText(view.state.sliceDoc(from, to));
  return true;
}

export async function cutFromCodeMirror(view: EditorView) {
  if (!(await copyFromCodeMirror(view))) return false;
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: "" },
    selection: { anchor: from },
  });
  view.focus();
  return true;
}
