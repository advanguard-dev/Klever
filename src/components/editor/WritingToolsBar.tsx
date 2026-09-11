import { schemaTarget } from "@/components/db/PropertyManager";
import { readOpenNoteSelection } from "@/lib/editor-bridge";
import { GhostButton, MonoLabel, Overlay, Panel, SolidButton, TextArea, TextButton } from "@/components/ui";
import {
  DEFAULT_WRITING_SYSTEM_PROMPT,
  rewrite,
  WRITING_TOOLS,
  writingInstruction,
  type WritingRewriteResult,
} from "@/lib/ai";
import { writingToolLabel } from "@/lib/i18n";
import { MEETING_INTERNAL_KEYS } from "@/lib/meetings";
import { useLocale, useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { AiSettings, Note, SchemaProp } from "@/types";
import { ChevronDown, ChevronRight, Loader2, Settings2, Sparkles } from "lucide-react";
import { useId, useState } from "react";

export type PendingWritingEdit = {
  label: string;
  result: WritingRewriteResult;
  fromText: string;
  selection?: boolean;
};

type Props = {
  note: Note;
  body: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
  /** Called when DeepSeek returns a draft — parent reveals it, then V / X confirm. */
  onPropose: (pending: PendingWritingEdit) => void;
  /** True while a proposal is waiting for V / X so another run cannot stack. */
  locked?: boolean;
};

function writableSchema(note: Note, notes: Note[]): SchemaProp[] {
  const target = schemaTarget(note, notes);
  return (target.schema ?? []).filter(
    (s) => !s.hidden && !MEETING_INTERNAL_KEYS.has(s.key) && s.type !== "formula" && s.type !== "rollup",
  );
}

function toolDrafts(ai: AiSettings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of WRITING_TOOLS) {
    out[t.id] = writingInstruction(ai, t.id, t.instruction);
  }
  return out;
}

export function WritingToolsBar({
  note,
  body,
  busy,
  setBusy,
  setError,
  onPropose,
  locked,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const ai = useApp((s) => s.ai);
  const aiConfigured = useApp((s) => s.aiConfigured);
  const setAi = useApp((s) => s.setAi);
  const notes = useApp((s) => s.notes);
  const [editOpen, setEditOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(ai.lastCustomPrompt ?? "");
  const [draftSystem, setDraftSystem] = useState(ai.writingSystemPrompt ?? DEFAULT_WRITING_SYSTEM_PROMPT);
  const [draftTools, setDraftTools] = useState<Record<string, string>>(() => toolDrafts(ai));
  const titleId = useId();
  const descId = useId();

  const openEditor = () => {
    setDraftSystem(ai.writingSystemPrompt ?? DEFAULT_WRITING_SYSTEM_PROMPT);
    setDraftTools(toolDrafts(ai));
    setEditOpen(true);
  };

  const blocked = Boolean(busy) || Boolean(locked);

  const run = async (label: string, instruction: string, persistCustom?: string) => {
    if (blocked) return;
    const selected = readOpenNoteSelection().trim();
    const source = selected || body;
    if (!source.trim()) {
      setError(t("writing.needText"));
      return;
    }
    if (!aiConfigured) {
      setError(t("writing.needKey"));
      return;
    }
    setBusy(label);
    setError(null);
    try {
      const schema = writableSchema(note, notes);
      const next = await rewrite(ai, source, instruction, {
        title: note.title,
        schema: schema.map((s) => ({ key: s.key, name: s.name, type: s.type, options: s.options })),
      });
      onPropose({
        label,
        result: next,
        fromText: source,
        selection: Boolean(selected),
      });
      if (persistCustom !== undefined) setAi({ lastCustomPrompt: persistCustom });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("writing.failed"));
    } finally {
      setBusy(null);
    }
  };

  const applyTool = (id: string) => {
    const tool = WRITING_TOOLS.find((t) => t.id === id);
    if (!tool) return;
    const instruction = writingInstruction(ai, id, tool.instruction);
    void run(writingToolLabel(locale, tool.id), instruction);
  };

  const savePromptEdits = () => {
    const writingPrompts: Record<string, string> = {};
    for (const t of WRITING_TOOLS) {
      const draft = draftTools[t.id]?.trim() ?? "";
      if (draft && draft !== t.instruction) writingPrompts[t.id] = draft;
    }
    setAi({
      writingSystemPrompt:
        draftSystem.trim() === DEFAULT_WRITING_SYSTEM_PROMPT ? undefined : draftSystem.trim() || undefined,
      writingPrompts: Object.keys(writingPrompts).length ? writingPrompts : undefined,
    });
    setEditOpen(false);
  };

  const resetPromptEdits = () => {
    setDraftSystem(DEFAULT_WRITING_SYSTEM_PROMPT);
    const defaults: Record<string, string> = {};
    for (const t of WRITING_TOOLS) defaults[t.id] = t.instruction;
    setDraftTools(defaults);
    setAi({ writingSystemPrompt: undefined, writingPrompts: undefined });
  };

  return (
    <div className="mt-10 border-t border-line pt-4" aria-busy={Boolean(busy)}>
      <div className="flex flex-wrap items-center gap-2">
        {busy ? (
          <Loader2 size={13} strokeWidth={1.6} className="animate-spin text-faint" aria-hidden />
        ) : (
          <Sparkles size={13} strokeWidth={1.4} className="text-faint" aria-hidden />
        )}
        {busy && (
          <span className="font-mono text-[11px] text-mute" role="status">
            {t("writing.withGemini", { tool: busy })}
          </span>
        )}
        {WRITING_TOOLS.map((tool) => {
          const label = writingToolLabel(locale, tool.id);
          return (
            <GhostButton
              key={tool.id}
              className="border-0 px-2 py-1 text-[12px] text-mute"
              disabled={blocked}
              aria-pressed={busy === label}
              onClick={() => applyTool(tool.id)}
            >
              {busy === label ? `${label}…` : label}
            </GhostButton>
          );
        })}
        <GhostButton
          className="border-0 px-2 py-1 text-[12px] text-mute"
          disabled={blocked}
          onClick={() => setCustomOpen((o) => !o)}
        >
          {t("writing.custom")}
          {customOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </GhostButton>
        <TextButton
          className="ml-auto h-7 text-[11px] text-faint"
          onClick={openEditor}
          disabled={blocked}
          aria-expanded={editOpen}
          aria-haspopup="dialog"
        >
          <Settings2 size={12} strokeWidth={1.5} />
          {t("writing.editPrompts")}
        </TextButton>
      </div>

      {customOpen && (
        <Panel className="mt-3 space-y-3 px-3 py-3">
          <MonoLabel>{t("writing.customInstruction")}</MonoLabel>
          <TextArea
            rows={3}
            value={customPrompt}
            placeholder={t("writing.customPlaceholder")}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
          <SolidButton
            disabled={blocked || !customPrompt.trim()}
            onClick={() => void run(t("writing.custom"), customPrompt.trim(), customPrompt.trim())}
          >
            {t("writing.runCustom")}
          </SolidButton>
        </Panel>
      )}

      {editOpen && (
        <Overlay
          onClose={() => setEditOpen(false)}
          title={t("writing.title")}
          labelledBy={titleId}
          describedBy={descId}
          className="max-w-xl"
        >
          <Panel className="max-h-[min(88vh,44rem)] space-y-5 overflow-y-auto p-6">
            <MonoLabel>{t("writing.tools")}</MonoLabel>
            <h2 id={titleId} className="mt-2 font-serif text-3xl font-semibold tracking-tight">
              {t("writing.title")}
            </h2>
            <p id={descId} className="text-sm leading-relaxed text-mute">
              {t("writing.blurb")}
            </p>
            <div className="space-y-2">
              <MonoLabel>{t("writing.systemPrompt")}</MonoLabel>
              <TextArea rows={4} value={draftSystem} onChange={(e) => setDraftSystem(e.target.value)} />
              <TextButton
                className="h-7 text-[11px] text-faint"
                onClick={() => setDraftSystem(DEFAULT_WRITING_SYSTEM_PROMPT)}
              >
                {t("writing.resetSystem")}
              </TextButton>
            </div>
            <div className="space-y-4">
              <MonoLabel>{t("writing.toolInstructions")}</MonoLabel>
              {WRITING_TOOLS.map((tool) => (
                <div key={tool.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <MonoLabel>{writingToolLabel(locale, tool.id)}</MonoLabel>
                    <TextButton
                      className="h-7 text-[11px] text-faint"
                      onClick={() => setDraftTools((d) => ({ ...d, [tool.id]: tool.instruction }))}
                    >
                      {t("writing.resetDefault")}
                    </TextButton>
                  </div>
                  <TextArea
                    rows={2}
                    value={draftTools[tool.id] ?? tool.instruction}
                    onChange={(e) => setDraftTools((d) => ({ ...d, [tool.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <SolidButton onClick={savePromptEdits}>{t("writing.save")}</SolidButton>
              <GhostButton onClick={resetPromptEdits}>{t("writing.resetAll")}</GhostButton>
            </div>
          </Panel>
        </Overlay>
      )}
    </div>
  );
}
