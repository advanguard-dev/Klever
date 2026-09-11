import { Alert, Field, GhostButton, MonoLabel, Overlay, Panel, Segmented, Select, SolidButton, TextArea, TextButton, Toggle } from "@/components/ui";
import {
  applyDeepSeekFlashPreset,
  brainDump,
  DUMP_KIND_LABEL,
  heuristicDump,
  type DumpKind,
  type ProposedItem,
} from "@/lib/ai";
import { commitProposedItems } from "@/lib/commit-items";
import { macDictationCommandAvailable, startMacDictation, stopMacDictation } from "@/lib/dictation";
import { slugify } from "@/lib/ids";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { moonshineReady, moonshineSupported, speechSupported, startDumpTranscription } from "@/lib/speech";
import {
  loadDumpSpeechLang,
  moonshineSupports,
  resolveDumpLang,
  saveDumpSpeechLang,
  SPEECH_LANG_OPTIONS,
  type SpeechLangPreference,
} from "@/lib/speech-lang";
import { SettingsCalendarPanel } from "@/components/calendar/SettingsCalendarPanel";
import { LOCALE_OPTIONS, type Locale } from "@/lib/i18n";
import { fetchGitStatus, type GitStatus } from "@/lib/git-status";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import { Check, Loader2, Mic, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type DumpDraft = ProposedItem & { id: string; selected: boolean };

function newDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDrafts(items: ProposedItem[]): DumpDraft[] {
  return items.map((item) => ({ ...item, id: newDraftId(), selected: true }));
}

function kindMeta(kind: DumpKind) {
  return DUMP_KIND_LABEL[kind];
}

function summarizeItem(item: ProposedItem) {
  if (item.kind === "database") {
    const n = item.rows?.length ?? 0;
    return n ? `${n} row${n === 1 ? "" : "s"}` : "Empty database";
  }
  if (item.due) return `Due ${item.due}`;
  return item.body || "No body";
}

export function BrainDump() {
  const t = useT();
  const open = useApp((s) => s.dumpOpen);
  const setOpen = useApp((s) => s.setDumpOpen);
  const ai = useApp((s) => s.ai);
  const aiConfigured = useApp((s) => s.aiConfigured);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const tools = activeWorkspace?.tools ?? defaultWorkspaceTools();
  const aiMode = activeWorkspace?.aiMode ?? "remote";
  const setView = useApp((s) => s.setView);
  const setError = useApp((s) => s.setError);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [backend, setBackend] = useState<"moonshine" | "webspeech" | "dictation" | null>(null);
  const [proposed, setProposed] = useState<DumpDraft[]>([]);
  const [projectName, setProjectName] = useState("");
  const [isolated, setIsolated] = useState(() => moonshineReady());
  const [speechLang, setSpeechLang] = useState<SpeechLangPreference>(() => loadDumpSpeechLang());
  const recRef = useRef<{ stop: () => void } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const userTextRef = useRef("");
  const speechTextRef = useRef("");
  const skipSpeechRef = useRef(false);
  const proposedRef = useRef<HTMLDivElement | null>(null);
  const dumpTitleId = useId();
  const dumpDescId = useId();
  const useMacDictation = macDictationCommandAvailable();
  const resolvedLang = resolveDumpLang(speechLang);

  useEffect(() => {
    const sync = () => setIsolated(moonshineReady());
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      recRef.current?.stop();
      recRef.current = null;
      void stopMacDictation();
      setListening(false);
      setLoadingModel(false);
      setStatus(null);
      setProgress(null);
      setBackend(null);
      setProposed([]);
      setProjectName("");
    } else {
      setIsolated(moonshineReady());
    }
  }, [open]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      void stopMacDictation();
    };
  }, []);

  if (!open || !tools.brainDump) return null;

  const organize = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const useLocal = aiMode === "local";
    setStatus(useLocal ? "Organizing locally…" : "Organizing with DeepSeek…");
    try {
      if (useLocal) {
        const items = heuristicDump(text);
        const project = items.find((i) => i.kind === "page")?.title || items[0]?.title || "Brain dump";
        const drafts = toDrafts(items);
        setProjectName(project);
        setProposed(drafts);
        setStatus(
          drafts.length
            ? `${drafts.length} item${drafts.length === 1 ? "" : "s"} (local) in “${project}” — pick what to keep`
            : null,
        );
        requestAnimationFrame(() => {
          proposedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        return;
      }
      if (!aiConfigured) {
        setError("Configure DEEPSEEK_API_KEY in the desktop app to organize this dump.");
        setProposed([]);
        setStatus(null);
        return;
      }
      const result = await brainDump(ai, text);
      const drafts = toDrafts(result.items);
      setProjectName(result.project);
      setProposed(drafts);
      setStatus(
        drafts.length
          ? `${drafts.length} item${drafts.length === 1 ? "" : "s"} in folder “${result.project}” — pick what to keep`
          : null,
      );
      requestAnimationFrame(() => {
        proposedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProposed([]);
      setProjectName("");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleDraft = (id: string) => {
    setProposed((list) =>
      list.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
    );
  };

  const removeDraft = (id: string) => {
    setProposed((list) => {
      const next = list.filter((d) => d.id !== id);
      if (!next.length) {
        setStatus(null);
        setProjectName("");
      } else {
        setStatus(`${next.length} item${next.length === 1 ? "" : "s"} ready — pick what to keep`);
      }
      return next;
    });
  };

  const setAllSelected = (selected: boolean) => {
    setProposed((list) => list.map((d) => ({ ...d, selected })));
  };

  const selectedCount = proposed.filter((d) => d.selected).length;

  const commit = () => {
    const chosen = proposed.filter((d) => d.selected);
    if (!chosen.length) return;
    const project = projectName.trim() || "Brain dump";

    // Folder appears from child paths — no extra index page (avoids "Élodie" + folder Élodie).
    const { lastNote, lastDb, createdEvent } = commitProposedItems({
      items: chosen,
      folder: slugify(project),
      project,
      skipProjectClonePage: true,
    });

    if (createdEvent && !lastNote && !lastDb) setView({ kind: "calendar" });
    else if (lastNote) setView({ kind: "note", id: lastNote });
    else if (lastDb) setView({ kind: "database", id: lastDb });
    else if (createdEvent) setView({ kind: "calendar" });
    setProposed([]);
    setProjectName("");
    setText("");
    setOpen(false);
  };

  const changeSpeechLang = (value: SpeechLangPreference) => {
    setSpeechLang(value);
    saveDumpSpeechLang(value);
  };

  const stopMic = () => {
    recRef.current?.stop();
    recRef.current = null;
    if (backend === "dictation") void stopMacDictation();
    setListening(false);
    setLoadingModel(false);
    setStatus(null);
    setProgress(null);
    setBackend(null);
    speechTextRef.current = "";
    skipSpeechRef.current = false;
  };

  const toggleMic = () => {
    if (listening || loadingModel) {
      stopMic();
      return;
    }

    // Mac Dictation types into the focused field — most reliable in Electron for EN/FR.
    if (useMacDictation) {
      userTextRef.current = text.trim();
      speechTextRef.current = "";
      skipSpeechRef.current = false;
      setBackend("dictation");
      setListening(true);
      setLoadingModel(false);
      setProgress(null);
      requestAnimationFrame(() => textAreaRef.current?.focus());
      void startMacDictation(textAreaRef.current).then((started) => {
        setStatus(
          started
            ? `Listening (${resolvedLang === "fr" ? "French" : "English"} · Mac Dictation). Click Stop when done.`
            : "Focus the box, then press Fn twice or Globe to dictate. English or French only.",
        );
      });
      return;
    }

    userTextRef.current = text.trim();
    speechTextRef.current = "";
    skipSpeechRef.current = false;
    const ready = moonshineReady();
    const useMoon = ready && resolvedLang === "en" && moonshineSupports("en");
    setIsolated(ready);
    setLoadingModel(true);
    setStatus(useMoon ? "Loading Moonshine…" : "Starting transcription…");
    setProgress(null);
    void startDumpTranscription(
      (chunk) => {
        if (skipSpeechRef.current) return;
        speechTextRef.current = chunk;
        const base = userTextRef.current;
        setText([base, chunk].filter(Boolean).join(base && chunk ? " " : ""));
      },
      {
        language: speechLang,
        onError: (m) => {
          if (m) setError(m);
        },
        onProgress: (fraction) => setProgress(fraction),
        onStatus: (s) => {
          setStatus(s);
          if (/listening/i.test(s)) {
            setLoadingModel(false);
            setListening(true);
            setProgress(null);
          }
        },
      },
    )
      .then((session) => {
        recRef.current = session;
        setBackend(session.backend);
        setLoadingModel(false);
        setListening(true);
        setProgress(null);
        setStatus((prev) =>
          prev && /listening/i.test(prev)
            ? prev
            : session.backend === "moonshine"
              ? "Listening with Moonshine (on-device)…"
              : `Listening (browser speech · ${resolvedLang === "fr" ? "fr-FR" : "en-US"})…`,
        );
      })
      .catch((err) => {
        setLoadingModel(false);
        setListening(false);
        setBackend(null);
        setStatus(null);
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  const onDumpTextChange = (value: string) => {
    setText(value);
    if (backend === "dictation") {
      userTextRef.current = value;
      return;
    }
    if (!(listening || loadingModel)) {
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
    // User edited inside/beyond the live speech suffix — keep their text; stop overwriting.
    userTextRef.current = value;
    speechTextRef.current = "";
    skipSpeechRef.current = true;
  };

  const canTranscribe = useMacDictation || speechSupported();
  const usingMoonshine = backend === "moonshine" || (listening && isolated && resolvedLang === "en" && !useMacDictation);
  const langLocked = listening || loadingModel;

  return (
    <Overlay onClose={() => setOpen(false)} title={t("dump.title")} labelledBy={dumpTitleId} describedBy={dumpDescId}>
      <Panel className="p-6">
        <MonoLabel>{t("dump.title")}</MonoLabel>
        <h2 id={dumpTitleId} className="mt-2 font-serif text-3xl tracking-tight">{t("dump.title")}</h2>
        <p id={dumpDescId} className="mt-3 text-sm leading-relaxed text-mute">
          Speak or paste in English or French.{" "}
          {useMacDictation ? (
            <>Transcription uses <span className="text-ink">Mac Dictation</span>. </>
          ) : moonshineSupported() && resolvedLang === "en" ? (
            <>
              On-device <span className="text-ink">Moonshine</span>
              {!isolated && " (after a one-time reload)"} for English; otherwise browser speech.{" "}
            </>
          ) : (
            "Transcription runs in the browser. "
          )}
          Then it becomes pages, lists, and events in a folder. Events go on the calendar, not as
          pages. Add an API key in Settings unless this workspace is on local mode.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block min-w-[11rem] flex-1">
            <MonoLabel>Language</MonoLabel>
            <Select
              className="mt-1 w-full min-w-[11rem]"
              aria-label="Transcription language"
              value={speechLang}
              disabled={langLocked}
              onChange={(e) => changeSpeechLang(e.target.value as SpeechLangPreference)}
            >
              {SPEECH_LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                  {!useMacDictation && o.value === "en" && moonshineSupports("en")
                    ? " · Moonshine"
                    : ""}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="mt-4 block">
          <span className="sr-only">Notes to organize</span>
          <TextArea
            ref={textAreaRef}
            value={text}
            onChange={(e) => onDumpTextChange(e.target.value)}
            rows={proposed.length ? 5 : 8}
            className="bg-paper-2 leading-7"
            placeholder="Everything at once…"
            disabled={busy}
            aria-label="Notes to organize"
          />
        </label>
        {(status || progress != null || busy) && (
          <div className="mt-3 space-y-2">
            {(status || busy) && (
              <p className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wide text-mute" role="status">
                {busy && <Loader2 size={12} strokeWidth={1.6} className="animate-spin" aria-hidden />}
                {status ?? "Organizing with DeepSeek…"}
              </p>
            )}
            {progress != null && progress < 1 && (
              <div className="h-1 overflow-hidden rounded-full bg-paper-2">
                <div
                  className="h-full bg-ink transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
                />
              </div>
            )}
          </div>
        )}
        {moonshineSupported() && !useMacDictation && !isolated && !listening && resolvedLang === "en" && (
          <Alert className="mt-4 font-mono text-xs">
            <p>Moonshine needs a one-time reload in this window before it can listen.</p>
            <GhostButton
              type="button"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} strokeWidth={1.4} />
              Reload this window
            </GhostButton>
          </Alert>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canTranscribe && (
            <GhostButton
              onClick={toggleMic}
              className={listening || loadingModel ? "text-ink" : ""}
              disabled={busy}
            >
              <Mic size={14} strokeWidth={1.4} />
              {loadingModel
                ? "Preparing…"
                : listening
                  ? "Stop"
                  : useMacDictation
                    ? "Dictate"
                    : usingMoonshine || (isolated && resolvedLang === "en")
                      ? "Transcribe with Moonshine"
                      : "Transcribe"}
            </GhostButton>
          )}
          <SolidButton onClick={() => void organize()} disabled={busy || listening || !text.trim()}>
            {busy ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" aria-hidden />
                Organizing…
              </>
            ) : (
              "Organize"
            )}
          </SolidButton>
          <TextButton onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </TextButton>
        </div>
        {proposed.length > 0 && (
          <div ref={proposedRef} className="mt-8 border-t border-line pt-6">
            <label className="block">
              <MonoLabel>Folder</MonoLabel>
              <Field
                className="mt-1"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Name"
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1.5 font-mono text-[11px] text-faint">
                Items land in /{slugify(projectName.trim() || "Brain dump")}/
              </p>
            </label>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <MonoLabel>
                {selectedCount}/{proposed.length} selected
              </MonoLabel>
              <div className="flex flex-wrap items-center gap-3">
                <TextButton
                  type="button"
                  className="text-xs"
                  onClick={() => setAllSelected(true)}
                  disabled={busy || selectedCount === proposed.length}
                >
                  Select all
                </TextButton>
                <TextButton
                  type="button"
                  className="text-xs"
                  onClick={() => setAllSelected(false)}
                  disabled={busy || selectedCount === 0}
                >
                  Select none
                </TextButton>
                <TextButton
                  type="button"
                  className="text-xs"
                  onClick={() => {
                    setProposed([]);
                    setProjectName("");
                    setStatus(null);
                  }}
                  disabled={busy}
                >
                  Clear all
                </TextButton>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {proposed.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-xl border px-3 py-3 transition-colors ${
                    n.selected ? "border-line bg-paper-2/50" : "border-line/60 opacity-55"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={n.selected}
                      aria-label={n.selected ? `Exclude ${n.title}` : `Include ${n.title}`}
                      onClick={() => toggleDraft(n.id)}
                      disabled={busy}
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        n.selected
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-paper text-mute hover:border-ink/40"
                      }`}
                    >
                      {n.selected ? (
                        <Check size={14} strokeWidth={1.8} aria-hidden />
                      ) : (
                        <X size={14} strokeWidth={1.6} aria-hidden />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
                          {kindMeta(n.kind)}
                        </span>
                        {n.due && (
                          <span className="font-mono text-[10px] tracking-wide text-faint">{n.due}</span>
                        )}
                      </div>
                      <div className="mt-1 font-sans text-xl">{n.title}</div>
                      <p className="mt-1 line-clamp-3 text-sm text-mute">{summarizeItem(n)}</p>
                      {n.kind === "database" && n.rows && n.rows.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {n.rows.slice(0, 4).map((r) => (
                            <li key={r.title} className="font-mono text-[11px] text-faint">
                              · {r.title}
                              {r.due ? ` · ${r.due}` : ""}
                            </li>
                          ))}
                          {n.rows.length > 4 && (
                            <li className="font-mono text-[11px] text-faint">
                              · +{n.rows.length - 4} more
                            </li>
                          )}
                        </ul>
                      )}
                      {n.tags.length > 0 && (
                        <p className="mt-2 font-mono text-[11px] text-tag/70">
                          {n.tags.map((t) => `#${t}`).join("  ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${n.title}`}
                      onClick={() => removeDraft(n.id)}
                      disabled={busy}
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-paper hover:text-ink"
                    >
                      <Trash2 size={14} strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <SolidButton onClick={commit} disabled={busy || selectedCount === 0}>
                Create {selectedCount || ""} in folder
              </SolidButton>
              {selectedCount < proposed.length && selectedCount > 0 && (
                <span className="font-mono text-[11px] text-faint">
                  {proposed.length - selectedCount} skipped
                </span>
              )}
            </div>
          </div>
        )}
      </Panel>
    </Overlay>
  );
}

type SettingsTab = "model" | "calendar" | "access" | "developer";

function SettingsModelPanel() {
  const t = useT();
  const ai = useApp((s) => s.ai);
  const setAi = useApp((s) => s.setAi);
  const aiConfigured = useApp((s) => s.aiConfigured);
  const refreshAiStatus = useApp((s) => s.refreshAiStatus);
  const displayName = useApp((s) => s.displayName);
  const setDisplayName = useApp((s) => s.setDisplayName);
  useEffect(() => {
    void refreshAiStatus();
  }, [refreshAiStatus]);
  const desktop = typeof window !== "undefined" && Boolean(window.kleverDesktop);
  const statusLabel = !desktop
    ? t("settings.apiBrowser")
    : aiConfigured
      ? t("settings.apiReady")
      : t("settings.apiMissing");
  return (
    <>
      <p className="mt-3 text-sm leading-relaxed text-mute">{t("settings.modelBlurb")}</p>
      <div className="mt-6 space-y-4">
        <label className="block">
          <MonoLabel>{t("settings.yourName")}</MonoLabel>
          <Field
            className="mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => {
              const next = displayName.trim() || "You";
              if (next !== displayName) setDisplayName(next);
            }}
          />
        </label>
        <div className="block">
          <MonoLabel>{t("settings.apiKey")}</MonoLabel>
          <p className="mt-1 text-sm text-ink">{statusLabel}</p>
          <p className="mt-1.5 text-[12px] text-faint">{t("settings.apiKeyHint")}</p>
        </div>
        <label className="block">
          <MonoLabel>{t("settings.writingTools")}</MonoLabel>
          <Field
            className="mt-1"
            value={ai.writingModel ?? ai.model}
            onChange={(e) => setAi({ writingModel: e.target.value })}
          />
        </label>
        <label className="block">
          <MonoLabel>{t("settings.brainDump")}</MonoLabel>
          <Field
            className="mt-1"
            value={ai.brainDumpModel ?? ai.model}
            onChange={(e) => setAi({ brainDumpModel: e.target.value })}
          />
        </label>
        <label className="block">
          <MonoLabel>{t("settings.meetingSummarize")}</MonoLabel>
          <Field
            className="mt-1"
            value={ai.meetingModel ?? ai.model}
            onChange={(e) => setAi({ meetingModel: e.target.value })}
          />
        </label>
        <div className="block">
          <MonoLabel>{t("settings.endpoint")}</MonoLabel>
          <p className="mt-1 font-mono text-xs text-mute">{ai.endpoint}</p>
        </div>
      </div>
    </>
  );
}

function SettingsAccessPanel() {
  const t = useT();
  const strongFocus = useApp((s) => s.strongFocus);
  const setStrongFocus = useApp((s) => s.setStrongFocus);
  const locale = useApp((s) => s.locale);
  const setLocale = useApp((s) => s.setLocale);
  return (
    <div className="mt-6 space-y-6">
      <label className="block">
        <MonoLabel>{t("settings.language")}</MonoLabel>
        <Select
          className="mt-1 block w-full max-w-xs"
          aria-label={t("settings.language")}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {LOCALE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.nativeName}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-[12px] text-faint">{t("settings.languageHint")}</p>
      </label>
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-mute">{t("settings.accessBlurb")}</p>
        <Toggle
          checked={strongFocus}
          onChange={setStrongFocus}
          label={t("settings.strongFocus")}
        />
      </div>
    </div>
  );
}

function SettingsDeveloperPanel() {
  const t = useT();
  const dev = useApp((s) => s.dev);
  const setDev = useApp((s) => s.setDev);
  const [copied, setCopied] = useState(false);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [gitBusy, setGitBusy] = useState(false);

  const refreshGit = useCallback(async () => {
    setGitBusy(true);
    try {
      setGit(await fetchGitStatus());
    } finally {
      setGitBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshGit();
  }, [refreshGit]);

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm leading-relaxed text-mute">{t("settings.devBlurb")}</p>
      <Toggle
        checked={dev.semanticSearch}
        onChange={(on) => setDev({ semanticSearch: on })}
        label={t("settings.dev.semanticSearch")}
      />
      <Toggle
        checked={dev.localApiEnabled}
        onChange={(on) => setDev({ localApiEnabled: on })}
        label={t("settings.dev.localApi")}
      />
      <label className="block max-w-xs">
        <MonoLabel>{t("settings.dev.port")}</MonoLabel>
        <Field
          className="mt-1 font-mono text-sm"
          type="number"
          min={1}
          max={65535}
          value={dev.localApiPort}
          onChange={(e) => setDev({ localApiPort: Number(e.target.value) || 7431 })}
        />
      </label>
      <div>
        <MonoLabel>{t("settings.dev.token")}</MonoLabel>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Field
            className="min-w-0 flex-1 font-mono text-xs"
            readOnly
            value={dev.localApiToken}
            onFocus={(e) => e.target.select()}
          />
          <GhostButton
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(dev.localApiToken).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? t("settings.dev.copied") : t("settings.dev.copyToken")}
          </GhostButton>
        </div>
      </div>
      <label className="block">
        <MonoLabel>{t("settings.dev.webhooks")}</MonoLabel>
        <TextArea
          className="mt-1 min-h-[88px] font-mono text-xs"
          value={dev.webhookUrls.join("\n")}
          onChange={(e) =>
            setDev({
              webhookUrls: e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
          placeholder="http://127.0.0.1:9000/hook"
          spellCheck={false}
        />
        <p className="mt-1.5 text-[12px] text-faint">{t("settings.dev.webhooksHint")}</p>
      </label>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonoLabel>{t("settings.dev.git")}</MonoLabel>
          <GhostButton type="button" onClick={() => void refreshGit()} disabled={gitBusy}>
            <RefreshCw size={14} strokeWidth={1.5} className={gitBusy ? "animate-spin" : undefined} aria-hidden />
            {t("settings.dev.gitRefresh")}
          </GhostButton>
        </div>
        {git?.branch && (
          <p className="mt-2 font-mono text-[11px] text-mute">
            {t("settings.dev.branch")}: {git.branch}
          </p>
        )}
        {git && !git.ok && (
          <p className="mt-2 text-sm text-mute">{git.error || t("settings.dev.gitDesktop")}</p>
        )}
        {git?.ok && git.files.length === 0 && (
          <p className="mt-2 text-sm text-mute">{t("settings.dev.gitNone")}</p>
        )}
        {git?.ok && git.files.length > 0 && (
          <ul className="mt-3 max-h-48 space-y-1.5 overflow-auto font-mono text-[11px] text-mute">
            {git.files.map((f) => (
              <li key={`${f.code}:${f.path}`} className="flex gap-2">
                <span className="w-16 shrink-0 text-faint">{f.label}</span>
                <span className="min-w-0 break-all text-ink/80">{f.path}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AiSettings() {
  const t = useT();
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const ai = useApp((s) => s.ai);
  const setAi = useApp((s) => s.setAi);
  const titleId = useId();
  const close = useCallback(() => setOpen(false), [setOpen]);
  const [tab, setTab] = useState<SettingsTab>("model");
  if (!open) return null;
  const settingsTitle = t("settings.title");
  return (
    <Overlay onClose={close} title={settingsTitle} labelledBy={titleId}>
      <Panel className="p-6">
        <h2 id={titleId} className="font-serif text-3xl font-semibold tracking-tight">
          {settingsTitle}
        </h2>
        <div className="mt-4">
          <Segmented
            size="sm"
            aria-label={t("settings.category")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "model", label: t("settings.tab.model") },
              { value: "calendar", label: t("settings.tab.calendar") },
              { value: "access", label: t("settings.tab.access") },
              { value: "developer", label: t("settings.tab.developer") },
            ]}
          />
        </div>
        {tab === "model" && <SettingsModelPanel />}
        {tab === "calendar" && <SettingsCalendarPanel />}
        {tab === "access" && <SettingsAccessPanel />}
        {tab === "developer" && <SettingsDeveloperPanel />}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SolidButton onClick={close}>{t("settings.done")}</SolidButton>
          {tab === "model" && (
            <GhostButton
              type="button"
              onClick={() => setAi(applyDeepSeekFlashPreset(ai))}
            >
              {t("settings.resetGemini")}
            </GhostButton>
          )}
        </div>
      </Panel>
    </Overlay>
  );
}
