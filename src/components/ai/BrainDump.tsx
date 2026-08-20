import { Alert, Field, GhostButton, MonoLabel, Overlay, Panel, Select, SolidButton, TextArea, TextButton } from "@/components/ui";
import {
  applyGeminiFlashPreset,
  brainDump,
  DUMP_KIND_LABEL,
  GEMINI_FLASH_MODEL,
  heuristicDump,
  normalizeTags,
  type DumpKind,
  type ProposedItem,
} from "@/lib/ai";
import { slugify } from "@/lib/ids";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { moonshineReady, moonshineSupported, speechSupported, startDumpTranscription } from "@/lib/speech";
import {
  loadDumpSpeechLang,
  moonshineSupports,
  saveDumpSpeechLang,
  SPEECH_LANG_OPTIONS,
  type SpeechLangPreference,
} from "@/lib/speech-lang";
import { useApp } from "@/store";
import type { Note } from "@/types";
import { Check, Loader2, Mic, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DumpDraft = ProposedItem & { id: string; selected: boolean };

function newDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDrafts(items: ProposedItem[]): DumpDraft[] {
  return items.map((item) => ({ ...item, id: newDraftId(), selected: true }));
}

function findDbInFolder(notes: Note[], title: string, folder: string) {
  const want = title.trim().toLowerCase();
  const prefix = `${folder.replace(/\/$/, "")}/`;
  return notes.find(
    (n) =>
      n.type === "database" &&
      n.title.trim().toLowerCase() === want &&
      (n.path.startsWith(prefix) || n.path === `${prefix}${slugify(title)}.database.md`),
  );
}

function rowProps(due?: string, status?: string) {
  const props: Record<string, unknown> = {};
  if (due) props.due = due;
  if (status) props.status = status;
  return props;
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
  const open = useApp((s) => s.dumpOpen);
  const setOpen = useApp((s) => s.setDumpOpen);
  const ai = useApp((s) => s.ai);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const tools = activeWorkspace?.tools ?? defaultWorkspaceTools();
  const aiMode = activeWorkspace?.aiMode ?? "remote";
  const createPage = useApp((s) => s.createPage);
  const createDatabase = useApp((s) => s.createDatabase);
  const createEvent = useApp((s) => s.createEvent);
  const setView = useApp((s) => s.setView);
  const setError = useApp((s) => s.setError);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [backend, setBackend] = useState<"moonshine" | "webspeech" | null>(null);
  const [proposed, setProposed] = useState<DumpDraft[]>([]);
  const [projectName, setProjectName] = useState("");
  const [isolated, setIsolated] = useState(() => moonshineReady());
  const [speechLang, setSpeechLang] = useState<SpeechLangPreference>(() => loadDumpSpeechLang());
  const recRef = useRef<{ stop: () => void } | null>(null);
  const userTextRef = useRef("");
  const speechTextRef = useRef("");
  const skipSpeechRef = useRef(false);
  const proposedRef = useRef<HTMLDivElement | null>(null);

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

  if (!open || !tools.brainDump) return null;

  const organize = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const useLocal = aiMode === "local";
    setStatus(useLocal ? "Organizing locally…" : "Organizing with Gemini…");
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
      if (!ai.apiKey.trim()) {
        setError("Add a Gemini API key in Settings to turn dumps into notes.");
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
          ? `${drafts.length} item${drafts.length === 1 ? "" : "s"} in project “${result.project}” — pick what to keep`
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

  const ensureRemindersDb = (folder: string) => {
    const existing = findDbInFolder(useApp.getState().notes, "Reminders", folder);
    if (existing) return existing.id;
    return createDatabase({ title: "Reminders", viewType: "list", folder, stay: true });
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
    const folder = slugify(project);
    let lastNote = "";
    let lastDb = "";
    let createdEvent = false;

    // Folder appears from child paths — no extra index page (avoids "Élodie" + folder Élodie).

    for (const item of chosen) {
      // Kind / Reminders DB / due props already classify items — don't flood tags.
      const tags = normalizeTags(item.tags, 2);
      if (item.kind === "page") {
        // Skip clone of the project name
        if (item.title.trim().toLowerCase() === project.trim().toLowerCase()) continue;
        lastNote = createPage({
          title: item.title,
          body: item.body,
          tags,
          folder,
          props: rowProps(item.due),
          stay: true,
        });
        continue;
      }
      if (item.kind === "reminder") {
        const dbId = ensureRemindersDb(folder);
        lastDb = dbId;
        createPage({
          parent: dbId,
          title: item.title,
          body: item.body,
          tags,
          folder,
          props: rowProps(item.due, item.status || "Inbox"),
          stay: true,
        });
        continue;
      }
      if (item.kind === "event") {
        // Calendar entity — never a vault page
        createEvent({
          title: item.title,
          body: item.body,
          date: item.due || new Date().toISOString().slice(0, 10),
          project,
          tags,
        });
        createdEvent = true;
        continue;
      }
      if (item.kind === "database") {
        const viewType =
          item.viewType === "calendar" ? "table" : (item.viewType ?? "table");
        const dbId = createDatabase({
          title: item.title,
          viewType,
          folder,
          stay: true,
        });
        lastDb = dbId;
        for (const row of item.rows ?? []) {
          createPage({
            parent: dbId,
            title: row.title,
            body: row.body,
            tags: normalizeTags(row.tags.length ? row.tags : tags, 2),
            folder,
            props: rowProps(row.due, row.status || "Inbox"),
            stay: true,
          });
        }
      }
    }
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

  const toggleMic = () => {
    if (listening || loadingModel) {
      recRef.current?.stop();
      recRef.current = null;
      setListening(false);
      setLoadingModel(false);
      setStatus(null);
      setProgress(null);
      speechTextRef.current = "";
      skipSpeechRef.current = false;
      return;
    }
    userTextRef.current = text.trim();
    speechTextRef.current = "";
    skipSpeechRef.current = false;
    const ready = moonshineReady();
    const useMoon =
      ready && (speechLang === "auto" || moonshineSupports(speechLang));
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
        onError: (m) => setError(m),
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
              : "Listening (browser speech)…",
        );
      })
      .catch((err) => {
        setLoadingModel(false);
        setListening(false);
        setStatus(null);
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  const onDumpTextChange = (value: string) => {
    setText(value);
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

  const canTranscribe = speechSupported();
  const usingMoonshine = backend === "moonshine" || (listening && isolated);
  const langLocked = listening || loadingModel;

  return (
    <Overlay onClose={() => setOpen(false)}>
      <Panel className="p-6">
        <MonoLabel>Brain dump</MonoLabel>
        <h2 className="mt-2 font-serif text-3xl italic tracking-tight">Empty the head</h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Speak or paste. Transcription runs{" "}
          {moonshineSupported() ? (
            <>
              on-device with <span className="text-ink">Moonshine</span>
              {!isolated && " (reload once for COOP/COEP)"} when a model exists for the
              language; otherwise browser speech.{" "}
            </>
          ) : (
            "via the browser; "
          )}
          then Klever uses Gemini to shape rich pages, reminders, events, and databases into a{" "}
          <span className="text-ink">project folder</span>. Pages get real write-ups; lists stay
          databases. Events go to the Calendar (not pages). Add an API key in Settings first.
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
                  {o.value !== "auto" && moonshineSupports(o.value) ? " · Moonshine" : ""}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <TextArea
          value={text}
          onChange={(e) => onDumpTextChange(e.target.value)}
          rows={proposed.length ? 5 : 8}
          className="mt-4 bg-paper-2 leading-7"
          placeholder="Everything at once…"
          disabled={busy}
        />
        {(status || progress != null || busy) && (
          <div className="mt-3 space-y-2">
            {(status || busy) && (
              <p className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wide text-mute" role="status">
                {busy && <Loader2 size={12} strokeWidth={1.6} className="animate-spin" aria-hidden />}
                {status ?? "Organizing with Gemini…"}
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
        {moonshineSupported() && !isolated && !listening && (
          <Alert className="mt-4 font-mono text-xs">
            <p>
              This tab isn’t cross-origin isolated yet. After Vite serves COOP/COEP headers, hard-reload
              once so Moonshine can use SharedArrayBuffer.
            </p>
            <GhostButton
              type="button"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} strokeWidth={1.4} />
              Reload this tab
            </GhostButton>
          </Alert>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canTranscribe && (
            <GhostButton
              onClick={toggleMic}
              className={listening || loadingModel ? "text-ink" : ""}
              disabled={busy || (loadingModel && !listening)}
            >
              <Mic size={14} strokeWidth={1.4} />
              {loadingModel
                ? "Loading…"
                : listening
                  ? "Stop"
                  : usingMoonshine ||
                      (isolated && (speechLang === "auto" || moonshineSupports(speechLang)))
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
              <MonoLabel>Project folder</MonoLabel>
              <Field
                className="mt-1"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Project name"
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
                Create {selectedCount || ""} in vault
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

export function AiSettings() {
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const ai = useApp((s) => s.ai);
  const setAi = useApp((s) => s.setAi);
  const displayName = useApp((s) => s.displayName);
  const setDisplayName = useApp((s) => s.setDisplayName);
  if (!open) return null;
  return (
    <Overlay onClose={() => setOpen(false)}>
      <Panel className="p-6">
        <MonoLabel>AI</MonoLabel>
        <h2 className="mt-2 font-serif text-3xl italic tracking-tight">Brain dump</h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          <span className="text-ink">Organize</span> and note writing tools call{" "}
          <span className="text-ink">{GEMINI_FLASH_MODEL}</span> through Google’s OpenAI-compatible
          API. Your key stays in this browser and is only sent to Google. Speech still uses{" "}
          <span className="text-ink">Moonshine</span> on-device.
        </p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <MonoLabel>Your name</MonoLabel>
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
          <label className="block">
            <MonoLabel>Gemini API key</MonoLabel>
            <Field
              className="mt-1 font-mono text-sm"
              type="password"
              value={ai.apiKey}
              onChange={(e) => setAi({ apiKey: e.target.value })}
              placeholder="AIza…"
              autoComplete="off"
            />
            <p className="mt-1.5 text-[12px] text-faint">
              Create a key in{" "}
              <a
                className="text-mute underline decoration-line underline-offset-2 hover:text-ink"
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
              >
                Google AI Studio
              </a>
              .
            </p>
          </label>
          <label className="block">
            <MonoLabel>Model</MonoLabel>
            <Field className="mt-1" value={ai.model} onChange={(e) => setAi({ model: e.target.value })} />
          </label>
          <label className="block">
            <MonoLabel>Endpoint</MonoLabel>
            <Field className="mt-1 font-mono text-xs" value={ai.endpoint} onChange={(e) => setAi({ endpoint: e.target.value })} />
          </label>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SolidButton onClick={() => setOpen(false)}>Done</SolidButton>
          <GhostButton
            type="button"
            onClick={() => setAi(applyGeminiFlashPreset(ai))}
          >
            Reset to Gemini 3.6 Flash
          </GhostButton>
        </div>
      </Panel>
    </Overlay>
  );
}
