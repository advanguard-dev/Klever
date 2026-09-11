import { ToolbarBtn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { scrambleDurationMs, scrambleFrame } from "@/lib/scramble-text";
import { useT } from "@/lib/use-t";
import type { PendingWritingEdit } from "@/components/editor/WritingToolsBar";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  pending: PendingWritingEdit;
  fromText: string;
  noteTitle: string;
  onAccept: () => void;
  onDiscard: () => void;
};

export function WritingEditConfirm({
  pending,
  fromText,
  noteTitle,
  onAccept,
  onDiscard,
}: Props) {
  const t = useT();
  const toText = pending.result.body;
  const titleId = useId();
  const descId = useId();
  const chipRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef(onAccept);
  const discardRef = useRef(onDiscard);
  acceptRef.current = onAccept;
  discardRef.current = onDiscard;

  const [display, setDisplay] = useState(fromText);
  const [live, setLive] = useState(true);
  const [chipOpen, setChipOpen] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = scrambleDurationMs(Math.max(fromText.length, toText.length), reduced);
    if (duration <= 0) {
      setDisplay(toText);
      setLive(false);
      setChipOpen(true);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const chipAt = duration * 0.55;
    let chipArmed = false;

    const step = (now: number) => {
      const elapsed = now - started;
      const progress = Math.min(1, elapsed / duration);
      const tick = Math.floor(elapsed / 46);
      setDisplay(scrambleFrame(fromText, toText, progress, tick));
      if (!chipArmed && elapsed >= chipAt) {
        chipArmed = true;
        setChipOpen(true);
      }
      if (progress >= 1) {
        setDisplay(toText);
        setLive(false);
        setChipOpen(true);
        return;
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [fromText, toText]);

  useEffect(() => {
    if (!chipOpen) return;
    chipRef.current?.focus();
  }, [chipOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "escape" || key === "x") {
        e.preventDefault();
        e.stopPropagation();
        discardRef.current();
        return;
      }
      if (key === "v") {
        e.preventDefault();
        e.stopPropagation();
        acceptRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const titleChange =
    pending.result.title?.trim() && pending.result.title.trim() !== noteTitle
      ? pending.result.title.trim()
      : null;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {live ? t("writing.revealing") : t("writing.confirmHint")}
      </p>
      <div className="writing-edit-reveal writing-edit-reveal-full" aria-hidden>
        <pre
          className={cn("writing-scramble", live ? "writing-scramble-live" : "writing-scramble-done")}
        >
          {display}
        </pre>
      </div>
      <div
        ref={chipRef}
        className={cn("writing-edit-chip klever-focus", chipOpen && "writing-edit-chip-open")}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-keyshortcuts="V X Escape"
        aria-hidden={!chipOpen}
        inert={!chipOpen}
        tabIndex={-1}
      >
        <p id={titleId} className="sr-only">
          {t("writing.reviewTitle")}
        </p>
        <p id={descId} className="sr-only">
          {t("writing.confirmHint")}
        </p>
        {titleChange && (
          <span className="writing-edit-chip-meta">{t("writing.titleChange", { title: titleChange })}</span>
        )}
        <ToolbarBtn
          label={t("writing.accept")}
          shortcut="V"
          className="h-8 w-8 font-mono text-[13px] font-medium text-ink"
          onClick={onAccept}
        >
          V
        </ToolbarBtn>
        <span className="writing-edit-chip-rule" aria-hidden />
        <ToolbarBtn
          label={t("writing.discard")}
          shortcut="X"
          className="h-8 w-8 font-mono text-[13px] font-medium"
          onClick={onDiscard}
        >
          X
        </ToolbarBtn>
      </div>
    </>
  );
}
