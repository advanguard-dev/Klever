import { hasFileTransfer } from "@/lib/dnd";
import { cn } from "@/lib/cn";
import { filesFromFileList } from "@/lib/local-file-path";
import { useApp } from "@/store";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function FileDropZone({
  children,
  className,
  folder,
  attachToNoteId,
}: {
  children: ReactNode;
  className?: string;
  folder?: string;
  attachToNoteId?: string;
}) {
  const importDroppedFiles = useApp((s) => s.importDroppedFiles);
  const [active, setActive] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const clear = useCallback(() => setActive(false), []);

  // TipTap may stopPropagation on drop — always clear the overlay when the drag ends.
  useEffect(() => {
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, [clear]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e)) return;
    e.preventDefault();
    setActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e)) return;
    const root = rootRef.current;
    const next = e.relatedTarget as Node | null;
    // Only hide when the pointer leaves the drop zone entirely.
    if (root && next && root.contains(next)) return;
    setActive(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasFileTransfer(e)) return;
      setActive(false);
      // TipTap handles drop-at-cursor when landing on the block editor.
      if ((e.target as HTMLElement).closest?.(".ProseMirror, .tiptap")) return;
      e.preventDefault();
      const files = filesFromFileList(e.dataTransfer.files);
      if (!files.length) return;
      void importDroppedFiles(files, {
        folder,
        attachToNoteId,
        at: { clientX: e.clientX, clientY: e.clientY },
      });
    },
    [attachToNoteId, folder, importDroppedFiles],
  );

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
      {active && (
        <div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-smart/50 bg-smart/5"
          aria-hidden
        >
          <p className="rounded-full bg-paper/90 px-4 py-2 font-mono text-xs text-smart shadow-sm">
            Drop files anywhere on the page
          </p>
        </div>
      )}
    </div>
  );
}
