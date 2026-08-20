import { copyText } from "@/lib/context-menus";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@codemirror/view";

/** Paste clipboard contents into a TipTap editor (context menu / programmatic). */
export async function pasteIntoTipTap(editor: Editor) {
  editor.chain().focus().run();
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes("text/html")) {
        const html = await (await item.getType("text/html")).text();
        if (html.trim()) {
          editor.commands.insertContent(html);
          return true;
        }
      }
    }
  } catch {
    /* read() blocked or unavailable — fall back to plain text */
  }
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      editor.commands.insertContent(text);
      return true;
    }
  } catch {
    /* clipboard blocked */
  }
  return false;
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
