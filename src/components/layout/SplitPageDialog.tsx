import { GhostButton, MonoLabel, Overlay, Panel, SolidButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { draftNoteBody } from "@/lib/editor-bridge";
import { cutMarkdown, previewSnippet } from "@/lib/split-page";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { SplitSide } from "@/types";
import { useEffect, useId, useMemo, useState } from "react";

export function SplitPageDialog() {
  const t = useT();
  const open = useApp((s) => s.pageSplitOpen);
  const setOpen = useApp((s) => s.setPageSplitOpen);
  const commit = useApp((s) => s.commitPageSplit);
  const view = useApp((s) => s.view);
  const notes = useApp((s) => s.notes);
  const titleId = useId();
  const descId = useId();
  const [side, setSide] = useState<SplitSide | null>(null);

  const note = view.kind === "note" ? notes.find((n) => n.id === view.id) : undefined;
  const body = note ? draftNoteBody(note.body) : "";
  const halves = useMemo(() => cutMarkdown(body), [body]);
  const empty = !halves.left.trim() && !halves.right.trim();

  useEffect(() => {
    if (open) setSide(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSide("left");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSide("right");
      }
      if (e.key === "Enter" && side && !empty) {
        e.preventDefault();
        commit(side);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, empty, open, side]);

  if (!open || !note) return null;

  return (
    <Overlay
      onClose={() => setOpen(false)}
      title={t("split.chooserTitle")}
      description={t("split.chooserDesc")}
      labelledBy={titleId}
      describedBy={descId}
      className="max-w-2xl"
    >
      <Panel className="p-6">
        <MonoLabel>{t("split.chooserEyebrow")}</MonoLabel>
        <h2 id={titleId} className="mt-2 font-serif text-2xl font-semibold tracking-tight">
          {t("split.chooserTitle")}
        </h2>
        <p id={descId} className="mt-3 text-sm leading-relaxed text-mute">
          {empty ? t("split.empty") : t("split.chooserDesc")}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <HalfCard
            side="left"
            selected={side}
            label={t("split.chooseLeft")}
            roleLabel={side === "left" ? t("split.newHalf") : side === "right" ? t("split.keepHalf") : t("split.chooseHalf")}
            snippet={previewSnippet(halves.left) || t("split.emptyHalf")}
            onPick={setSide}
            disabled={empty}
          />
          <HalfCard
            side="right"
            selected={side}
            label={t("split.chooseRight")}
            roleLabel={side === "right" ? t("split.newHalf") : side === "left" ? t("split.keepHalf") : t("split.chooseHalf")}
            snippet={previewSnippet(halves.right) || t("split.emptyHalf")}
            onPick={setSide}
            disabled={empty}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <GhostButton onClick={() => setOpen(false)}>{t("common.cancel")}</GhostButton>
          <SolidButton disabled={!side || empty} onClick={() => side && commit(side)}>
            {t("split.confirm")}
          </SolidButton>
        </div>
      </Panel>
    </Overlay>
  );
}

function HalfCard({
  side,
  selected,
  label,
  roleLabel,
  snippet,
  onPick,
  disabled,
}: {
  side: SplitSide;
  selected: SplitSide | null;
  label: string;
  roleLabel: string;
  snippet: string;
  onPick: (side: SplitSide) => void;
  disabled?: boolean;
}) {
  const on = selected === side;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      onClick={() => onPick(side)}
      className={cn(
        "klever-focus flex min-h-[10.5rem] flex-col gap-3 rounded-lg border px-4 py-4 text-left transition-colors duration-150",
        on ? "border-ring bg-paper-2 ring-1 ring-ring" : "border-line bg-paper hover:border-ink/20 hover:bg-paper-2",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</span>
      <span className="font-serif text-lg font-semibold tracking-tight text-ink">{roleLabel}</span>
      <span className="line-clamp-4 text-sm leading-relaxed text-mute">{snippet}</span>
    </button>
  );
}
