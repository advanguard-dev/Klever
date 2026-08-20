import { hasFileTransfer } from "@/lib/dnd";
import { cn } from "@/lib/cn";
import { useApp } from "@/store";
import { useCallback, useRef, useState, type ReactNode } from "react";

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
  const depthRef = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e)) return;
    e.preventDefault();
    depthRef.current += 1;
    setActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e)) return;
    e.preventDefault();
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setActive(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasFileTransfer(e)) return;
      e.preventDefault();
      depthRef.current = 0;
      setActive(false);
      const files = e.dataTransfer.files;
      if (!files.length) return;
      void importDroppedFiles([...files], { folder, attachToNoteId });
    },
    [attachToNoteId, folder, importDroppedFiles],
  );

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
      {active && (
        <div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-smart/50 bg-smart/5 backdrop-blur-[1px]"
          aria-hidden
        >
          <p className="rounded-full bg-paper/90 px-4 py-2 font-mono text-xs text-smart shadow-sm">
            Drop to import or attach files
          </p>
        </div>
      )}
    </div>
  );
}
