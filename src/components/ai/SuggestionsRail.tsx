import { TextButton } from "@/components/ui";
import {
  applyGrammarFixes,
  locateGrammarFixes,
  MIN_SUGGEST_CHARS,
  type GrammarFix,
  type PageSuggestion,
} from "@/lib/ai";
import { commitSuggestion } from "@/lib/commit-items";
import { readOpenNoteBody, replaceOpenNoteBody } from "@/lib/editor-bridge";
import type { MessageKey } from "@/lib/i18n";
import {
  consumeGrammarFix,
  consumeSuggestion,
  dismissSuggestion,
  hashText,
  pageHash,
  runGrammarCheck,
  runPageSuggestions,
  useGrammarState,
  useSuggestState,
} from "@/lib/suggestions";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { CalendarPlus, Check, ListPlus, SpellCheck2 } from "lucide-react";

/**
 * Suggestions read the page only when asked. Both panels share the on-demand
 * model: a call happens on click, the result is cached against the page text,
 * and re-asking about unchanged text costs nothing.
 */

const KIND_ICON = {
  event: CalendarPlus,
  reminder: Check,
  list: ListPlus,
} as const;

const KIND_LABEL: Record<PageSuggestion["kind"], MessageKey> = {
  event: "suggest.kind.event",
  reminder: "suggest.kind.reminder",
  list: "suggest.kind.list",
};

const CATEGORY_LABEL: Record<GrammarFix["category"], MessageKey> = {
  spelling: "proof.category.spelling",
  grammar: "proof.category.grammar",
  punctuation: "proof.category.punctuation",
  style: "proof.category.style",
};

/** Live draft text when an editor is mounted, else the saved body. */
function liveBody(note: Note): string {
  return readOpenNoteBody() ?? note.body;
}

export function SuggestionsPanel({ note }: { note: Note }) {
  const t = useT();
  const ai = useApp((s) => s.ai);
  const state = useSuggestState(note.id);
  const body = liveBody(note);
  const enoughText = body.trim().length >= MIN_SUGGEST_CHARS;
  const stale = state.status === "done" && state.hash !== pageHash({ title: note.title, body });
  const busy = state.status === "loading";

  const accept = (s: PageSuggestion) => {
    commitSuggestion(note, s);
    consumeSuggestion(note.id, s);
  };

  if (!ai.apiKey.trim()) return <p className="text-sm text-faint">{t("suggest.needKey")}</p>;

  return (
    <>
      {state.status === "idle" && <p className="text-sm text-faint">{t("suggest.idle")}</p>}
      {state.status === "error" && state.error && (
        <p className="text-sm text-faint">{state.error}</p>
      )}
      {state.status === "done" && state.items.length === 0 && (
        <p className="text-sm text-faint">{t("suggest.none")}</p>
      )}

      {state.items.map((s) => {
        const Icon = KIND_ICON[s.kind];
        const rows = s.item.rows?.length ?? 0;
        return (
          <div key={`${s.kind}-${s.item.title}`} className="mb-3 rounded-lg border border-line p-2">
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
              <Icon size={12} strokeWidth={1.4} className="shrink-0" />
              <span>{t(KIND_LABEL[s.kind])}</span>
              {s.item.due && <span className="truncate">· {s.item.due}</span>}
              {s.kind === "list" && rows > 0 && <span>· {t("suggest.rows", { count: rows })}</span>}
            </p>
            <p className="mt-1 text-sm text-ink">{s.item.title}</p>
            {s.evidence && (
              <p className="mt-1 line-clamp-2 border-l border-line pl-2 text-[12px] italic text-faint">
                {s.evidence}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1">
              <TextButton className="h-7 px-2 py-0 text-xs text-ink" onClick={() => accept(s)}>
                {t("suggest.accept")}
              </TextButton>
              <TextButton
                className="h-7 px-2 py-0 text-xs"
                onClick={() => dismissSuggestion(note.id, s)}
              >
                {t("suggest.dismiss")}
              </TextButton>
            </div>
          </div>
        );
      })}

      {stale && <p className="mb-1 text-[12px] text-faint">{t("suggest.stale")}</p>}

      {!enoughText ? (
        <p className="text-sm text-faint">{t("suggest.short")}</p>
      ) : (
        <TextButton
          className="mt-1 h-7 px-2 py-0 text-xs"
          disabled={busy}
          onClick={() => void runPageSuggestions(note.id, { title: note.title, body }, ai)}
        >
          {busy
            ? t("suggest.running")
            : state.status === "done"
              ? t("suggest.rerun")
              : t("suggest.run")}
        </TextButton>
      )}
    </>
  );
}

export function ProofreadPanel({ note }: { note: Note }) {
  const t = useT();
  const ai = useApp((s) => s.ai);
  const state = useGrammarState(note.id);
  const body = liveBody(note);
  const busy = state.status === "loading";
  const stale = state.status === "done" && state.hash !== hashText(body);

  /**
   * Corrections hold offsets into the text they were computed from, so they
   * are re-anchored against the current draft before being applied. A
   * correction whose text is no longer on the page resolves to nothing and is
   * dropped rather than applied at a stale offset.
   */
  const apply = (fixes: GrammarFix[]) => {
    const current = liveBody(note);
    const located = locateGrammarFixes(current, fixes);
    if (located.length) {
      const next = applyGrammarFixes(current, located);
      if (next !== current) replaceOpenNoteBody(next);
    }
    for (const fix of fixes) consumeGrammarFix(note.id, fix.id);
  };

  if (!ai.apiKey.trim()) return <p className="text-sm text-faint">{t("suggest.needKey")}</p>;

  return (
    <>
      {state.status === "idle" && <p className="text-sm text-faint">{t("proof.idle")}</p>}
      {state.status === "error" && state.error && (
        <p className="text-sm text-faint">{state.error}</p>
      )}
      {state.status === "done" && state.fixes.length === 0 && (
        <p className="text-sm text-faint">{t("proof.none")}</p>
      )}

      {state.fixes.length > 1 && (
        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] text-faint">
          <span>{t("proof.count", { count: state.fixes.length })}</span>
          <TextButton
            className="h-6 px-1.5 py-0 text-xs text-ink"
            onClick={() => apply(state.fixes)}
          >
            {t("proof.applyAll")}
          </TextButton>
        </p>
      )}

      {state.fixes.map((fix) => (
        <div key={fix.id} className="mb-3 rounded-lg border border-line p-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
            <SpellCheck2 size={12} strokeWidth={1.4} className="shrink-0" />
            <span>{t(CATEGORY_LABEL[fix.category])}</span>
            {fix.reason && <span className="truncate">· {fix.reason}</span>}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-faint line-through decoration-faint">{fix.before}</span>
            <span className="text-ink"> {fix.after}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            <TextButton className="h-7 px-2 py-0 text-xs text-ink" onClick={() => apply([fix])}>
              {t("proof.apply")}
            </TextButton>
            <TextButton
              className="h-7 px-2 py-0 text-xs"
              onClick={() => consumeGrammarFix(note.id, fix.id)}
            >
              {t("proof.reject")}
            </TextButton>
          </div>
        </div>
      ))}

      {stale && <p className="mb-1 text-[12px] text-faint">{t("proof.stale")}</p>}

      <TextButton
        className="mt-1 h-7 px-2 py-0 text-xs"
        disabled={busy || !body.trim()}
        onClick={() => void runGrammarCheck(note.id, liveBody(note), ai)}
      >
        {busy ? t("proof.running") : state.status === "done" ? t("proof.rerun") : t("proof.run")}
      </TextButton>
    </>
  );
}
