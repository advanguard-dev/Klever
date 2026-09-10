import type { GrammarFix } from "@/lib/ai";
import { getGrammarState, subscribe } from "@/lib/suggestions";
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Underlines the spans a proofread run flagged.
 *
 * Corrections arrive with offsets into the page's markdown, which do not line
 * up with ProseMirror positions — markdown carries syntax characters (`**`,
 * `#`, `[[…]]`) that never appear in the document text. Rather than trying to
 * map between the two coordinate spaces, each correction is re-found in the
 * document's own text, so positions are correct by construction. A correction
 * whose text is not in the document is skipped rather than guessed at.
 */

const grammarKey = new PluginKey<DecorationSet>("klever-grammar");

/** Document text with a per-character map back to ProseMirror positions. */
function documentText(doc: PMNode): { text: string; pos: number[] } {
  let text = "";
  const pos: number[] = [];
  doc.descendants((node, nodePos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        text += node.text[i];
        pos.push(nodePos + i);
      }
      return false;
    }
    // Separate blocks so a correction cannot match across a paragraph break.
    if (node.isBlock && text && !text.endsWith("\n")) {
      text += "\n";
      pos.push(nodePos);
    }
    return true;
  });
  return { text, pos };
}

function build(doc: PMNode, fixes: GrammarFix[]): DecorationSet {
  if (!fixes.length) return DecorationSet.empty;
  const { text, pos } = documentText(doc);
  const decorations: Decoration[] = [];
  let cursor = 0;
  for (const fix of fixes) {
    if (!fix.before) continue;
    // Prefer the next occurrence so repeated phrases decorate in order.
    let idx = text.indexOf(fix.before, cursor);
    if (idx < 0) idx = text.indexOf(fix.before);
    if (idx < 0) continue;
    const from = pos[idx];
    const lastChar = pos[idx + fix.before.length - 1];
    if (from == null || lastChar == null) continue;
    decorations.push(
      Decoration.inline(from, lastChar + 1, {
        class: "klever-grammar",
        title: fix.reason ? `${fix.after} — ${fix.reason}` : fix.after,
      }),
    );
    cursor = idx + fix.before.length;
  }
  return DecorationSet.create(doc, decorations);
}

function grammarPlugin(noteId: string) {
  return new Plugin<DecorationSet>({
    key: grammarKey,
    state: {
      init: (_config, state) => build(state.doc, getGrammarState(noteId).fixes),
      apply(tr, value, _oldState, newState) {
        const incoming = tr.getMeta(grammarKey) as GrammarFix[] | undefined;
        if (incoming) return build(newState.doc, incoming);
        if (!tr.docChanged) return value;
        // Re-find against the edited document so underlines follow the text.
        return build(newState.doc, getGrammarState(noteId).fixes);
      },
    },
    props: {
      decorations: (state) => grammarKey.getState(state),
    },
    view(view) {
      let applied = getGrammarState(noteId).fixes;
      let queued = false;
      const unsubscribe = subscribe(() => {
        const fixes = getGrammarState(noteId).fixes;
        if (fixes === applied) return;
        applied = fixes;
        if (queued) return;
        // The store can emit mid-render; dispatch after the current task.
        queued = true;
        queueMicrotask(() => {
          queued = false;
          if (view.isDestroyed) return;
          view.dispatch(view.state.tr.setMeta(grammarKey, applied));
        });
      });
      return { destroy: unsubscribe };
    },
  });
}

export const GrammarMarks = Extension.create<{ noteId: string }>({
  name: "grammarMarks",

  addOptions() {
    return { noteId: "" };
  },

  addProseMirrorPlugins() {
    if (!this.options.noteId) return [];
    return [grammarPlugin(this.options.noteId)];
  },
});
