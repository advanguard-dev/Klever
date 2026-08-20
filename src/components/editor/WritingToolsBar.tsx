import { GhostButton, MonoLabel, Panel, SolidButton, TextArea, TextButton } from "@/components/ui";
import {
  DEFAULT_WRITING_SYSTEM_PROMPT,
  rewrite,
  WRITING_TOOLS,
  writingInstruction,
} from "@/lib/ai";
import { useApp } from "@/store";
import type { EditorView } from "@codemirror/view";
import { ChevronDown, ChevronRight, Loader2, Settings2, Sparkles } from "lucide-react";
import { useState } from "react";

type Props = {
  body: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  setBody: (v: string) => void;
  setError: (v: string | null) => void;
  viewRef: React.RefObject<EditorView | null>;
};

export function WritingToolsBar({ body, busy, setBusy, setBody, setError, viewRef }: Props) {
  const ai = useApp((s) => s.ai);
  const setAi = useApp((s) => s.setAi);
  const [editOpen, setEditOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(ai.lastCustomPrompt ?? "");
  const [draftSystem, setDraftSystem] = useState(ai.writingSystemPrompt ?? DEFAULT_WRITING_SYSTEM_PROMPT);
  const [draftTools, setDraftTools] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const t of WRITING_TOOLS) {
      out[t.id] = writingInstruction(ai, t.id, t.instruction);
    }
    return out;
  });

  const sourceText = () => {
    const view = viewRef.current;
    const selected = view
      ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
      : "";
    return selected || body;
  };

  const applyResult = (next: string) => {
    const view = viewRef.current;
    const selected = view
      ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
      : "";
    if (selected && view) {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: next } });
      setBody(view.state.doc.toString());
    } else {
      setBody(next);
    }
  };

  const run = async (label: string, instruction: string, persistCustom?: string) => {
    if (busy) return;
    const source = sourceText();
    if (!source.trim()) {
      setError("Select text or write something before using a writing tool.");
      return;
    }
    if (!ai.apiKey.trim()) {
      setError("Add a Gemini API key in Settings to use AI writing tools.");
      return;
    }
    setBusy(label);
    setError(null);
    try {
      const next = await rewrite(ai, source, instruction);
      applyResult(next);
      if (persistCustom !== undefined) setAi({ lastCustomPrompt: persistCustom });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Writing tool failed");
    } finally {
      setBusy(null);
    }
  };

  const applyTool = (id: string) => {
    const tool = WRITING_TOOLS.find((t) => t.id === id);
    if (!tool) return;
    const instruction = writingInstruction(ai, id, tool.instruction);
    void run(tool.label, instruction);
  };

  const savePromptEdits = () => {
    const writingPrompts: Record<string, string> = {};
    for (const t of WRITING_TOOLS) {
      const draft = draftTools[t.id]?.trim() ?? "";
      if (draft && draft !== t.instruction) writingPrompts[t.id] = draft;
    }
    setAi({
      writingSystemPrompt:
        draftSystem.trim() === DEFAULT_WRITING_SYSTEM_PROMPT ? undefined : draftSystem.trim(),
      writingPrompts: Object.keys(writingPrompts).length ? writingPrompts : undefined,
    });
    setEditOpen(false);
  };

  const resetPromptEdits = () => {
    setDraftSystem(DEFAULT_WRITING_SYSTEM_PROMPT);
    const out: Record<string, string> = {};
    for (const t of WRITING_TOOLS) out[t.id] = t.instruction;
    setDraftTools(out);
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
            {busy} with Gemini…
          </span>
        )}
        {WRITING_TOOLS.map((t) => (
          <GhostButton
            key={t.id}
            className="border-0 px-2 py-1 text-[12px] text-mute"
            disabled={Boolean(busy)}
            aria-pressed={busy === t.label}
            onClick={() => applyTool(t.id)}
          >
            {busy === t.label ? `${t.label}…` : t.label}
          </GhostButton>
        ))}
        <GhostButton
          className="border-0 px-2 py-1 text-[12px] text-mute"
          disabled={Boolean(busy)}
          onClick={() => setCustomOpen((o) => !o)}
        >
          Custom
          {customOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </GhostButton>
        <TextButton
          className="ml-auto h-7 text-[11px] text-faint"
          onClick={() => setEditOpen((o) => !o)}
          aria-expanded={editOpen}
        >
          <Settings2 size={12} strokeWidth={1.5} />
          Edit prompts
        </TextButton>
      </div>

      {customOpen && (
        <Panel className="mt-3 space-y-3 px-3 py-3">
          <MonoLabel>Custom instruction</MonoLabel>
          <TextArea
            rows={3}
            value={customPrompt}
            placeholder="Describe how to rewrite the selected text…"
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
          <SolidButton
            disabled={Boolean(busy) || !customPrompt.trim()}
            onClick={() => void run("Custom", customPrompt.trim(), customPrompt.trim())}
          >
            Run custom
          </SolidButton>
        </Panel>
      )}

      {editOpen && (
        <Panel className="mt-3 space-y-4 px-3 py-3">
          <MonoLabel>System prompt</MonoLabel>
          <TextArea rows={4} value={draftSystem} onChange={(e) => setDraftSystem(e.target.value)} />
          <div className="space-y-3">
            <MonoLabel>Tool instructions</MonoLabel>
            {WRITING_TOOLS.map((t) => (
              <div key={t.id} className="space-y-1.5">
                <MonoLabel>{t.label}</MonoLabel>
                <TextArea
                  rows={2}
                  value={draftTools[t.id] ?? t.instruction}
                  onChange={(e) => setDraftTools((d) => ({ ...d, [t.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <SolidButton onClick={savePromptEdits}>Save prompts</SolidButton>
            <GhostButton onClick={resetPromptEdits}>Reset to defaults</GhostButton>
          </div>
        </Panel>
      )}
    </div>
  );
}
