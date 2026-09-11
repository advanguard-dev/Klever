import { Fragment } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";

export type BlockSpan = { from: number; size: number };

export type BlockMeta = BlockSpan & { depth: number; index: number; parentPos: number };

export function currentBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const parent = $from.node(depth - 1);
    if (parent.type.spec.tableRole) continue;
    const node = $from.node(depth);
    if (node.isBlock) return { pos: $from.before(depth), node };
  }
  return null;
}

export function duplicateBlock(editor: Editor) {
  const b = currentBlock(editor);
  if (!b) return;
  editor.commands.insertContentAt(b.pos + b.node.nodeSize, b.node.toJSON());
}

export function deleteBlock(editor: Editor) {
  const b = currentBlock(editor);
  if (!b) return;
  editor.chain().focus().deleteRange({ from: b.pos, to: b.pos + b.node.nodeSize }).run();
}

/** Swap the current block (or multi-block span) with its neighbor (Craft-style ⌥↑ / ⌥↓). */
export function moveBlock(editor: Editor, dir: -1 | 1) {
  const span = spanFromTextSelection(editor) ?? spanFromCaret(editor);
  if (!span) return false;
  return Boolean(moveSpan(editor, span, dir));
}

export function blockMeta(doc: Editor["state"]["doc"], pos: number): BlockMeta | null {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    const parent = $pos.node(d - 1);
    if (parent.type.spec.tableRole) continue;
    if (
      parent.type.name === "doc" ||
      node.type.name === "listItem" ||
      node.type.name === "taskItem"
    ) {
      const from = $pos.before(d);
      return {
        from,
        size: node.nodeSize,
        depth: d,
        index: $pos.index(d - 1),
        parentPos: d === 1 ? 0 : $pos.before(d - 1),
      };
    }
  }
  return null;
}

export function spanFromCaret(editor: Editor): BlockSpan | null {
  const meta = blockMeta(editor.state.doc, editor.state.selection.from);
  return meta ? { from: meta.from, size: meta.size } : null;
}

export function spanFromTextSelection(editor: Editor): BlockSpan | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const a = blockMeta(editor.state.doc, from);
  const b = blockMeta(editor.state.doc, Math.max(from, to - 1));
  if (!a || !b) return null;
  if (a.from === b.from) return null;
  return unionBlockSpans(editor.state.doc, a, b);
}

export function unionBlockSpans(
  doc: Editor["state"]["doc"],
  a: BlockSpan,
  b: BlockSpan,
): BlockSpan | null {
  const A = blockMeta(doc, a.from);
  const B = blockMeta(doc, b.from);
  if (!A || !B || A.depth !== B.depth || A.parentPos !== B.parentPos) return null;
  const lo = Math.min(A.index, B.index);
  const hi = Math.max(A.index, B.index);
  const parent = doc.resolve(A.from).node(A.depth - 1);
  let from = A.depth === 1 ? 0 : A.parentPos + 1;
  for (let i = 0; i < lo; i++) from += parent.child(i).nodeSize;
  let size = 0;
  for (let i = lo; i <= hi; i++) size += parent.child(i).nodeSize;
  return { from, size };
}

export function spanCovers(span: BlockSpan, pos: number) {
  return pos >= span.from && pos < span.from + span.size;
}

export function countBlocksInSpan(doc: Editor["state"]["doc"], span: BlockSpan) {
  let pos = span.from;
  const end = span.from + span.size;
  let n = 0;
  while (pos < end) {
    const node = doc.nodeAt(pos);
    if (!node) break;
    n += 1;
    pos += node.nodeSize;
  }
  return n;
}

export function paintBlockSelection(view: EditorView, wrap: HTMLElement | null, span: BlockSpan | null) {
  wrap?.querySelectorAll(".klever-block-selected").forEach((el) => {
    el.classList.remove("klever-block-selected");
  });
  if (!span) return;
  let pos = span.from;
  const end = span.from + span.size;
  while (pos < end) {
    const node = view.state.doc.nodeAt(pos);
    if (!node) break;
    try {
      const dom = view.nodeDOM(pos);
      if (dom instanceof HTMLElement) dom.classList.add("klever-block-selected");
      else if (dom instanceof Element) {
        closestBlock(dom as HTMLElement, view.dom)?.classList.add("klever-block-selected");
      }
    } catch {
      /* node may be abstract */
    }
    pos += node.nodeSize;
  }
}

export function createBlockDragGhost(
  view: EditorView,
  span: BlockSpan,
  clientX: number,
  clientY: number,
): { el: HTMLElement; offsetX: number; offsetY: number } | null {
  const nodes: HTMLElement[] = [];
  let pos = span.from;
  const end = span.from + span.size;
  while (pos < end) {
    const node = view.state.doc.nodeAt(pos);
    if (!node) break;
    try {
      const dom = view.nodeDOM(pos);
      if (dom instanceof HTMLElement) nodes.push(dom);
      else if (dom instanceof Element) {
        const block = closestBlock(dom as HTMLElement, view.dom);
        if (block) nodes.push(block);
      }
    } catch {
      /* skip */
    }
    pos += node.nodeSize;
  }
  if (!nodes.length) return null;

  const raw = nodes
    .map((n) => (n.innerText || n.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  const words = raw.split(" ").filter(Boolean);
  const preview =
    words.length === 0
      ? nodes.length > 1
        ? `${nodes.length} blocks`
        : "Block"
      : words.length <= 10
        ? words.join(" ")
        : `${words.slice(0, 10).join(" ")}…`;
  const label =
    nodes.length > 1 && words.length > 0 ? `${preview} · ${nodes.length}` : preview;

  const ghost = document.createElement("div");
  ghost.className = "klever-block-drag-ghost";
  ghost.setAttribute("aria-hidden", "true");
  const line = document.createElement("div");
  line.className = "klever-block-drag-ghost-preview";
  line.textContent = label;
  ghost.appendChild(line);

  const offsetX = 28;
  const offsetY = 16;
  ghost.style.transform = `translate3d(${clientX - offsetX}px, ${clientY - offsetY}px, 0)`;
  document.body.appendChild(ghost);
  return { el: ghost, offsetX, offsetY };
}

export function relocateSpan(editor: Editor, span: BlockSpan, dest: number): BlockSpan | null {
  const { from, size } = span;
  if (size <= 0) return null;
  if (dest >= from && dest <= from + size) return span;
  const slice = editor.state.doc.slice(from, from + size);
  if (!slice.content.size) return null;
  const insertAt = dest < from ? dest : dest - size;
  let tr = editor.state.tr.delete(from, from + size);
  if (insertAt < 0 || insertAt > tr.doc.content.size) return null;
  const $ins = tr.doc.resolve(insertAt);
  if (!$ins.parent.canReplace($ins.index(), $ins.index(), slice.content)) return null;
  tr = tr.insert(insertAt, slice.content);
  editor.view.dispatch(tr.scrollIntoView());
  return { from: insertAt, size };
}

export function moveSpan(editor: Editor, span: BlockSpan, dir: -1 | 1): BlockSpan | null {
  const meta = blockMeta(editor.state.doc, span.from);
  if (!meta) return null;
  const parent = editor.state.doc.resolve(span.from).node(meta.depth - 1);
  let covered = 0;
  let count = 0;
  while (covered < span.size && meta.index + count < parent.childCount) {
    covered += parent.child(meta.index + count).nodeSize;
    count += 1;
  }
  if (count < 1 || covered !== span.size) return null;
  const endIndex = meta.index + count - 1;
  const swapIndex = dir > 0 ? endIndex + 1 : meta.index - 1;
  if (swapIndex < 0 || swapIndex >= parent.childCount) return null;
  const neighbor = parent.child(swapIndex);
  const groupNodes = [];
  for (let i = meta.index; i <= endIndex; i++) groupNodes.push(parent.child(i));
  if (dir > 0) {
    const fromPos = span.from;
    const toPos = span.from + span.size + neighbor.nodeSize;
    const tr = editor.state.tr.replaceWith(fromPos, toPos, Fragment.from([neighbor, ...groupNodes]));
    editor.view.dispatch(tr.scrollIntoView());
    return { from: fromPos + neighbor.nodeSize, size: span.size };
  }
  const fromPos = span.from - neighbor.nodeSize;
  const toPos = span.from + span.size;
  const tr = editor.state.tr.replaceWith(fromPos, toPos, Fragment.from([...groupNodes, neighbor]));
  editor.view.dispatch(tr.scrollIntoView());
  return { from: fromPos, size: span.size };
}

export function closestBlock(target: HTMLElement | null, viewDom: HTMLElement): HTMLElement | null {
  if (!target || !viewDom.contains(target)) return null;
  const li = target.closest("li");
  if (li instanceof HTMLElement && viewDom.contains(li)) return li;
  const top = target.closest(".ProseMirror > *");
  if (top instanceof HTMLElement && viewDom.contains(top)) return top;
  return null;
}

export function blockRangeFromDom(view: EditorView, dom: HTMLElement) {
  const fromPos = (pos: number) => {
    const $pos = view.state.doc.resolve(pos);
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      const parent = $pos.node(d - 1);
      if (
        parent.type.name === "doc" ||
        node.type.name === "listItem" ||
        node.type.name === "taskItem"
      ) {
        const from = $pos.before(d);
        return { from, size: node.nodeSize, node };
      }
    }
    return null;
  };
  try {
    const found = fromPos(view.posAtDOM(dom, 0));
    if (found) return found;
  } catch {
    /* fall through */
  }
  const r = dom.getBoundingClientRect();
  const hit = view.posAtCoords({ left: r.left + Math.min(24, r.width / 2), top: r.top + 8 });
  return hit ? fromPos(hit.pos) : null;
}

/** Drop target from Y. Prefer the DOM block (so list items win over the whole list). */
export function dropAnchor(
  view: EditorView,
  wrap: HTMLElement,
  clientY: number,
): { dest: number; line: number; from: number; size: number } | null {
  const wr = wrap.getBoundingClientRect();
  const lineOf = (top: number, bottom: number, from: number, size: number) => {
    const before = clientY < (top + bottom) / 2;
    return {
      dest: before ? from : from + size,
      line: (before ? top : bottom) - wr.top + wrap.scrollTop,
      from,
      size,
    };
  };
  const box = view.dom.getBoundingClientRect();
  const x = Math.min(box.left + 48, box.right - 8);
  const y = Math.max(box.top + 2, Math.min(clientY, box.bottom - 2));
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const block = closestBlock(el, view.dom);
  if (block) {
    const range = blockRangeFromDom(view, block);
    if (range) {
      const r = block.getBoundingClientRect();
      return lineOf(r.top, r.bottom, range.from, range.size);
    }
  }
  const hit = view.posAtCoords({ left: x, top: y });
  if (!hit) return null;
  const $pos = view.state.doc.resolve(hit.pos);
  let found: { from: number; size: number } | null = null;
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "listItem" || node.type.name === "taskItem") {
      found = { from: $pos.before(d), size: node.nodeSize };
      break;
    }
  }
  if (!found) {
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d - 1).type.name === "doc") {
        const node = $pos.node(d);
        found = { from: $pos.before(d), size: node.nodeSize };
        break;
      }
    }
  }
  if (!found) return null;
  let top = y;
  let bottom = y;
  try {
    top = view.coordsAtPos(Math.min(found.from + 1, view.state.doc.content.size)).top;
    bottom = view.coordsAtPos(Math.max(found.from + 1, found.from + found.size - 1)).bottom;
  } catch {
    /* keep y */
  }
  return lineOf(top, bottom, found.from, found.size);
}
