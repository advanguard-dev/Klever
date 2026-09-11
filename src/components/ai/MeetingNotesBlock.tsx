import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { GhostButton, MonoLabel, Select, SolidButton, TextArea, TextButton } from "@/components/ui";
import { heuristicMeetingNotes, summarizeMeeting } from "@/lib/ai";
import { cn } from "@/lib/cn";
import { macDictationSupported, startMacDictation, stopMacDictation } from "@/lib/dictation";
import {
  applyMeetingNotes,
  commitMeetingActions,
  meetingActions,
  meetingDate,
  meetingSummary,
  meetingTranscript,
  type MeetingAction,
} from "@/lib/meetings";
import {
  loadDumpSpeechLang,
  saveDumpSpeechLang,
  SPEECH_LANG_OPTIONS,
  type SpeechLangPreference,
} from "@/lib/speech-lang";
import { startDumpTranscription, webSpeechSupported } from "@/lib/speech";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { ChevronDown, ChevronRight, Loader2, Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MeetingNotesBlock({ note, readOnly }: { note: Note; readOnly?: boolean }) {
  const ai = useApp((s) => s.ai);
  const aiConfigured = useApp((s) => s.aiConfigured);
  const notes = useApp((s) => s.notes);
  const setError = useApp((s) => s.setError);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const aiMode = activeWorkspace?.aiMode ?? "local";
  const tools = activeWorkspace?.tools ?? defaultWorkspaceTools();

  const savedTranscript = meetingTranscript(note);
  const savedSummary = meetingSummary(note);
  const savedActions = meetingActions(note);

  const [transcript, setTranscript] = useState(savedTranscript);
  const [composer, setComposer] = useState(Boolean(savedTranscript));
  const [transcriptOpen, setTranscriptOpen] = useState(Boolean(savedTranscript) && !savedSummary);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [backend, setBackend] = useState<"dictation" | "speech" | null>(null);
  const [speechLang, setSpeechLang] = useState<SpeechLangPreference>(() => loadDumpSpeechLang());
  const [actions, setActions] = useState<MeetingAction[]>(savedActions);

  const recRef = useRef<{ stop: () => void } | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const userTextRef = useRef("");
  const speechTextRef = useRef("");
  const skipSpeechRef = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [seenId, setSeenId] = useState(note.id);
  if (note.id !== seenId) {
    setSeenId(note.id);
    setTranscript(savedTranscript);
    setComposer(Boolean(savedTranscript));
    setTranscriptOpen(Boolean(savedTranscript) && !savedSummary);
    setActions(savedActions);
    setListening(false);
    setBusy(false);
    setStatus(null);
  }

  useEffect(() => {
    if (listening || busy) return;
    const nextTranscript = meetingTranscript(note);
    const nextActions = meetingActions(note);
    setTranscript((cur) => (cur === nextTranscript ? cur : nextTranscript));
    setActions((cur) =>
      JSON.stringify(cur) === JSON.stringify(nextActions) ? cur : nextActions,
    );
  }, [note, listening, busy]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      void stopMacDictation();
    };
  }, []);

  const useMacDictation = macDictationSupported();
  const canDictate = useMacDictation || webSpeechSupported();

  const stopMic = () => {
    recRef.current?.stop();
    recRef.current = null;
    if (backend === "dictation") void stopMacDictation();
    setListening(false);
    setBackend(null);
    speechTextRef.current = "";
    skipSpeechRef.current = false;
  };

  const persistTranscript = (value: string) => {
    applyMeetingNotes(note, { transcript: value, status: listening ? "In progress" : undefined });
  };

  const onTranscriptChange = (value: string) => {
    setTranscript(value);
    if (!(listening && backend === "speech")) {
      userTextRef.current = value;
      return;
    }
    const speech = speechTextRef.current;
    if (!speech) {
      userTextRef.current = value;
      return;
    }
    const sep = userTextRef.current && speech ? " " : "";
    const suffix = `${sep}${speech}`;
    if (suffix && value.endsWith(suffix)) {
      userTextRef.current = value.slice(0, value.length - suffix.length);
      return;
    }
    if (value.endsWith(speech)) {
      userTextRef.current = value.slice(0, value.length - speech.length).replace(/ $/, "");
      return;
    }
    userTextRef.current = value;
    speechTextRef.current = "";
    skipSpeechRef.current = true;
  };

  const summarize = async (source?: string) => {
    const text = (source ?? transcript).trim();
    const prep = note.body.trim();
    if ((!text && !prep) || busy) return;
    stopMic();
    setBusy(true);
    const useLocal = aiMode === "local";
    setStatus(useLocal ? "Shaping notes…" : "Writing summary…");
    try {
      const meta = {
        title: note.title.trim() && !/^untitled$/i.test(note.title) ? note.title : undefined,
        date: meetingDate(note),
        notes: prep || undefined,
        existingTitles: notes
          .filter((n) => !n.parent && n.title !== "Untitled" && n.title !== "New database")
          .map((n) => n.title),
      };
      const result = useLocal
        ? heuristicMeetingNotes(text, meta)
        : await (async () => {
            if (!aiConfigured) {
              throw new Error("Configure DEEPSEEK_API_KEY in the desktop app to summarize this meeting.");
            }
            return summarizeMeeting(ai, text, meta);
          })();
      const nextActions = result.actions.map((a) => ({
        title: a.title,
        owner: a.owner,
        due: a.due,
      }));
      setActions(nextActions);
      applyMeetingNotes(note, {
        title: result.title,
        date: result.date,
        attendees: result.attendees,
        transcript: text,
        summary: result.summary,
        actions: nextActions,
        status: "Done",
      });
      setTranscriptOpen(false);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    if (listening) {
      const captured = transcript.trim();
      stopMic();
      persistTranscript(captured);
      setStatus(null);
      if (captured.length >= 20) void summarize(captured);
      return;
    }
    setComposer(true);
    setTranscriptOpen(true);
    applyMeetingNotes(note, { status: "In progress" });
    if (useMacDictation) {
      setBackend("dictation");
      setListening(true);
      requestAnimationFrame(() => textRef.current?.focus());
      const started = await startMacDictation(textRef.current);
      setStatus(
        started
          ? "Listening. Click Stop when you are done."
          : "Transcript is focused. Press Fn twice or the Globe key to start Dictation.",
      );
      return;
    }
    if (!webSpeechSupported()) {
      setError("Speech recognition is not available. Paste a transcript instead.");
      return;
    }
    userTextRef.current = transcript.trim();
    speechTextRef.current = "";
    skipSpeechRef.current = false;
    setStatus("Starting transcription…");
    try {
      const session = await startDumpTranscription(
        (chunk) => {
          if (skipSpeechRef.current) return;
          speechTextRef.current = chunk;
          const base = userTextRef.current;
          setTranscript([base, chunk].filter(Boolean).join(base && chunk ? " " : ""));
        },
        {
          language: speechLang,
          onError: (m) => setError(m),
          onStatus: (s) => setStatus(s),
        },
      );
      recRef.current = session;
      setBackend("speech");
      setListening(true);
    } catch (err) {
      setListening(false);
      setBackend(null);
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const loadTranscriptFile = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const ok =
      file.type.startsWith("text/") ||
      name.endsWith(".md") ||
      name.endsWith(".txt") ||
      name.endsWith(".vtt") ||
      name.endsWith(".srt");
    if (!ok) {
      setError("Use a .md, .txt, .vtt, or .srt transcript.");
      return;
    }
    const raw = (await file.text()).trim();
    if (!raw) return;
    const next = transcript.trim() ? `${transcript.trim()}\n\n${raw}` : raw;
    setTranscript(next);
    setComposer(true);
    setTranscriptOpen(true);
    persistTranscript(next);
    setStatus(`Loaded ${file.name}`);
    if (next.length >= 20) void summarize(next);
  };

  const toggleAction = (index: number) => {
    const next = actions.map((a, i) => (i === index ? { ...a, done: !a.done } : a));
    setActions(next);
    applyMeetingNotes(note, { actions: next });
  };

  const addToReminders = () => {
    const n = commitMeetingActions(note, actions);
    setStatus(n ? `Added ${n} to Reminders` : "Nothing to add");
  };

  const hasOutput = Boolean(savedSummary) || actions.length > 0;
  const canSummarize = Boolean(transcript.trim() || note.body.trim());

  return (
    <section className="rounded-xl border border-line bg-paper-2/40 px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonoLabel>AI notes</MonoLabel>
        {listening && (
          <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wide text-ink" role="status">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-danger/60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-danger" />
            </span>
            Transcribing
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canDictate && (
            <SolidButton onClick={() => void toggleMic()} disabled={busy} className={listening ? "bg-ink" : undefined}>
              {listening ? <Square size={14} strokeWidth={1.6} /> : <Mic size={14} strokeWidth={1.4} />}
              {listening ? "Stop" : "Start transcribing"}
            </SolidButton>
          )}
          <GhostButton
            type="button"
            disabled={busy || listening}
            onClick={() => {
              setComposer(true);
              setTranscriptOpen(true);
              requestAnimationFrame(() => textRef.current?.focus());
            }}
          >
            Paste transcript
          </GhostButton>
          <GhostButton type="button" disabled={busy || listening} onClick={() => fileRef.current?.click()}>
            <Upload size={14} strokeWidth={1.4} />
            Upload
          </GhostButton>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt,.vtt,.srt,text/plain,text/markdown"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void loadTranscriptFile(file);
            }}
          />
          {(composer || transcript.trim()) && (
            <TextButton
              type="button"
              className="text-xs"
              disabled={busy || listening || !canSummarize}
              onClick={() => void summarize()}
            >
              {busy ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={12} strokeWidth={1.6} className="animate-spin" aria-hidden />
                  Summarizing
                </span>
              ) : savedSummary ? (
                "Retry summary"
              ) : (
                "Summarize"
              )}
            </TextButton>
          )}
        </div>
      )}

      {!readOnly && !hasOutput && !listening && (
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Write agenda in Notes below. Transcribe or paste, then a summary lands here. Make sure
          everyone agrees before you record.
        </p>
      )}

      {!useMacDictation && webSpeechSupported() && !readOnly && (composer || listening) && (
        <div className="mt-3 max-w-[12rem]">
          <Select
            aria-label="Transcription language"
            value={speechLang}
            disabled={listening}
            onChange={(e) => {
              const value = e.target.value as SpeechLangPreference;
              setSpeechLang(value);
              saveDumpSpeechLang(value);
            }}
          >
            {SPEECH_LANG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {(status || busy) && (
        <p className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] tracking-wide text-mute" role="status">
          {busy && <Loader2 size={12} strokeWidth={1.6} className="animate-spin" aria-hidden />}
          {status}
        </p>
      )}

      {savedSummary && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-2">
            <MonoLabel>Summary</MonoLabel>
            {!readOnly && tools.meeting && hasOutput && (
              <TextButton type="button" className="text-xs" disabled={busy} onClick={() => void summarize()}>
                Retry
              </TextButton>
            )}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-ink">
            <MarkdownPreview note={{ ...note, body: savedSummary }} notes={notes} small />
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MonoLabel>Action items</MonoLabel>
            {!readOnly && (
              <TextButton type="button" className="text-xs" onClick={addToReminders}>
                Add to Reminders
              </TextButton>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {actions.map((action, i) => (
              <li key={`${action.title}-${i}`}>
                <button
                  type="button"
                  className="klever-focus flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-paper"
                  aria-pressed={action.done}
                  onClick={() => !readOnly && toggleAction(i)}
                  disabled={readOnly}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                      action.done ? "border-ink bg-ink text-paper" : "border-line bg-paper",
                    )}
                    aria-hidden
                  >
                    {action.done ? "✓" : ""}
                  </span>
                  <span className={cn("min-w-0 flex-1 text-sm", action.done && "text-mute line-through")}>
                    {action.title}
                    {(action.owner || action.due) && (
                      <span className="mt-0.5 block font-mono text-[10px] tracking-wide text-faint">
                        {[action.owner, action.due].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(composer || transcript.trim() || savedTranscript) && (
        <div className="mt-4 border-t border-line pt-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-mute hover:text-ink"
            onClick={() => setTranscriptOpen((o) => !o)}
            aria-expanded={transcriptOpen}
          >
            {transcriptOpen ? (
              <ChevronDown size={14} strokeWidth={1.4} />
            ) : (
              <ChevronRight size={14} strokeWidth={1.4} />
            )}
            <MonoLabel>Transcript</MonoLabel>
          </button>
          {transcriptOpen &&
            (readOnly ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mute">
                {transcript || savedTranscript || "No transcript."}
              </p>
            ) : (
              <TextArea
                ref={textRef}
                value={transcript}
                onChange={(e) => onTranscriptChange(e.target.value)}
                onBlur={() => persistTranscript(transcript)}
                rows={listening ? 8 : 6}
                className="mt-2 bg-paper leading-6"
                placeholder="Transcript appears here as you speak, or paste it in."
                disabled={busy}
                aria-label="Meeting transcript"
              />
            ))}
        </div>
      )}
    </section>
  );
}
