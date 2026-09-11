import { EmptyState, IconButton, Panel, Segmented, ToolbarBtn, Toggle } from "@/components/ui";
import { TitleBar } from "@/components/layout/TitleBar";
import { cn } from "@/lib/cn";
import { resolveAssetSrc } from "@/lib/assets";
import {
  PRESENT_RATIOS,
  PRESENT_TEMPLATE_IDS,
  deckFingerprint,
  deckFromNote,
  isAbort,
  loadCachedDeck,
  loadPresentPrefs,
  polishDeckWithAi,
  saveCachedDeck,
  savePresentPrefs,
  type PresentAlign,
  type PresentDeck,
  type PresentDensity,
  type PresentPrefs,
  type PresentRatio,
  type PresentSlide,
  type PresentTemplateId,
} from "@/lib/present";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { Note } from "@/types";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

const TEMPLATE_LABEL: Record<PresentTemplateId, string> = {
  folio: "Folio",
  lecture: "Lecture",
  chalk: "Chalk",
  atlas: "Atlas",
  signal: "Signal",
  vellum: "Vellum",
};

const TEMPLATE_SWATCH: Record<PresentTemplateId, { bg: string; fg: string; accent: string }> = {
  folio: { bg: "#f4f5f2", fg: "#151716", accent: "#3a5674" },
  lecture: { bg: "#f4f5f2", fg: "#151716", accent: "#3a5674" },
  chalk: { bg: "#e7ece4", fg: "#243028", accent: "#4f6b58" },
  atlas: { bg: "#e7ece4", fg: "#243028", accent: "#4f6b58" },
  signal: { bg: "#eceeea", fg: "#151716", accent: "#151716" },
  vellum: { bg: "#f3ead7", fg: "#3a2f28", accent: "#8b4a32" },
};

export function PresentView({ note }: { note: Note }) {
  const t = useT();
  const setPresenting = useApp((s) => s.setPresenting);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const setDumpOpen = useApp((s) => s.setDumpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setPlusOpen = useApp((s) => s.setPlusOpen);
  const closeWorkspaceSetup = useApp((s) => s.closeWorkspaceSetup);
  const ai = useApp((s) => s.ai);
  const aiConfigured = useApp((s) => s.aiConfigured);
  const displayName = useApp((s) => s.displayName);
  const setError = useApp((s) => s.setError);

  const [prefs, setPrefs] = useState<PresentPrefs>(() => loadPresentPrefs());
  const [deck, setDeck] = useState<PresentDeck>(() => {
    const cached = loadCachedDeck(note.id);
    if (cached && cached.fingerprint === deckFingerprint(note, loadPresentPrefs().density)) return cached;
    const next = cached?.origin === "ai" && cached.noteId === note.id ? cached : deckFromNote(note, loadPresentPrefs().density);
    return next;
  });
  const [index, setIndex] = useState(0);
  const [settingsOpen, setDeckSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idleTimer = useRef<number>(0);

  const slides = deck.slides;
  const safeIndex = Math.min(index, Math.max(0, slides.length - 1));
  const slide = slides[safeIndex];
  const fingerprint = deckFingerprint(note, prefs.density);
  const stale = deck.fingerprint !== fingerprint;
  const canPolish = Boolean(aiConfigured);

  const patchPrefs = (partial: Partial<PresentPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      savePresentPrefs(next);
      return next;
    });
  };

  const applyDeck = (next: PresentDeck) => {
    saveCachedDeck(next);
    setDeck(next);
    setIndex(0);
  };

  const rebuild = () => {
    applyDeck(deckFromNote(note, prefs.density));
  };

  const polish = async () => {
    if (!canPolish) {
      setError(t("present.needKey"));
      setSettingsOpen(true);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setError(null);
    try {
      const next = await polishDeckWithAi(ai, note, prefs.density, { signal: ac.signal });
      applyDeck(next);
    } catch (err) {
      if (isAbort(err)) return;
      setError(err instanceof Error ? err.message : t("present.failed"));
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const go = (next: number) => {
    if (!slides.length) return;
    setIndex(Math.max(0, Math.min(slides.length - 1, next)));
    setChromeHidden(false);
  };

  const leave = () => {
    abortRef.current?.abort();
    if (document.fullscreenElement) void document.exitFullscreen();
    setPresenting(false);
  };

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  const bumpIdle = () => {
    setChromeHidden(false);
    window.clearTimeout(idleTimer.current);
    if (settingsOpen) return;
    idleTimer.current = window.setTimeout(() => setChromeHidden(true), 2800);
  };

  useEffect(() => {
    const el = rootRef.current?.querySelector<HTMLElement>(".klever-present-thumb-on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [safeIndex]);

  useEffect(() => {
    const cached = loadCachedDeck(note.id);
    if (cached && cached.fingerprint === deckFingerprint(note, prefs.density)) {
      setDeck(cached);
    } else if (cached && cached.origin === "ai" && cached.noteId === note.id) {
      setDeck(cached);
    } else {
      const next = deckFromNote(note, prefs.density);
      saveCachedDeck(next);
      setDeck(next);
    }
    setIndex(0);
    setDeckSettingsOpen(false);
    return () => abortRef.current?.abort();
    // Rebuild when the page identity or density changes; body staleness is a banner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, prefs.density]);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setDeckSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [settingsOpen]);

  useEffect(() => {
    bumpIdle();
    return () => window.clearTimeout(idleTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, settingsOpen]);

  useEffect(() => {
    const typing = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setDeckSettingsOpen(false);
          return;
        }
        const s = useApp.getState();
        if (s.commandOpen || s.dumpOpen || s.settingsOpen || s.plusOpen || s.workspaceSetupOpen) {
          setCommandOpen(false);
          setDumpOpen(false);
          setSettingsOpen(false);
          setPlusOpen(false);
          closeWorkspaceSetup();
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        if (document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        leave();
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(safeIndex + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Backspace") {
        e.preventDefault();
        go(safeIndex - 1);
      }
      if (e.key === "Home") {
        e.preventDefault();
        go(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        go(slides.length - 1);
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    closeWorkspaceSetup,
    leave,
    safeIndex,
    setCommandOpen,
    setDumpOpen,
    setPlusOpen,
    setSettingsOpen,
    settingsOpen,
    slides.length,
  ]);

  const progress = slides.length ? (safeIndex + 1) / slides.length : 0;
  const footerLabel = [displayName.trim() && displayName.trim() !== "You" ? displayName.trim() : null, note.title || "Untitled"]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={rootRef}
      className="klever-present relative flex h-dvh flex-col"
      data-template={prefs.template}
      data-align={prefs.align}
      onPointerMove={bumpIdle}
      onPointerDown={() => {
        if (chromeHidden) setChromeHidden(false);
      }}
    >
      <div className="klever-present-chrome" data-hidden={chromeHidden}>
        <TitleBar>
          <div className="flex min-w-0 flex-1 justify-start">
            <ToolbarBtn label={t("present.write")} showLabel shortcut="Esc" onClick={leave}>
              <ArrowLeft size={15} strokeWidth={1.4} />
            </ToolbarBtn>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-2">
            <p className="truncate font-medium tracking-tight">{note.title || "Untitled"}</p>
            {slides.length > 0 && (
              <span className="hidden font-mono text-[10px] uppercase tracking-wide text-faint sm:inline">
                {t("present.slideN", { n: safeIndex + 1, total: slides.length })}
              </span>
            )}
          </div>

          <div className="flex flex-1 items-center justify-end gap-0.5">
            <div className="relative" ref={settingsRef}>
              <ToolbarBtn
                label={t("present.settings")}
                aria-label={t("present.settings")}
                aria-expanded={settingsOpen}
                aria-haspopup="dialog"
                active={settingsOpen}
                onClick={() => {
                  setDeckSettingsOpen((o) => !o);
                  setChromeHidden(false);
                }}
              >
                <SlidersHorizontal size={15} strokeWidth={1.4} />
              </ToolbarBtn>
              {settingsOpen && (
                <DeckSettings
                  prefs={prefs}
                  origin={deck.origin}
                  busy={busy}
                  canPolish={canPolish}
                  stale={stale}
                  onChange={patchPrefs}
                  onRebuild={rebuild}
                  onPolish={() => void polish()}
                />
              )}
            </div>
            <div className="hidden md:block">
              <ToolbarBtn
                label={fullscreen ? t("present.exitFullscreen") : t("present.fullscreen")}
                aria-label={fullscreen ? t("present.exitFullscreen") : t("present.fullscreen")}
                active={fullscreen}
                onClick={toggleFullscreen}
              >
                {fullscreen ? (
                  <Minimize2 size={15} strokeWidth={1.4} />
                ) : (
                  <Maximize2 size={15} strokeWidth={1.4} />
                )}
              </ToolbarBtn>
            </div>
          </div>
        </TitleBar>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-14 md:px-6 md:pb-4 md:pt-16">
        {stale && (
          <div className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-mute shadow-[0_10px_28px_-18px_rgba(0,0,0,0.28)]">
            <span>{t("present.stale")}</span>
            <button
              type="button"
              className="klever-focus font-medium text-ink underline-offset-2 hover:underline"
              onClick={rebuild}
            >
              {t("present.rebuild")}
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div
            className="klever-present-frame"
            style={
              {
                aspectRatio: PRESENT_RATIOS[prefs.ratio],
                "--present-ratio":
                  prefs.ratio === "4:3" ? "1.333" : prefs.ratio === "16:10" ? "1.6" : "1.777",
              } as CSSProperties
            }
          >
            {busy && !slides.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-[color:var(--present-mute)]">
                <Loader2 size={18} className="animate-spin" aria-hidden />
                <p className="text-sm">{t("present.polishing")}</p>
              </div>
            ) : slide ? (
              <PresentSlideView
                key={slide.id}
                slide={slide}
                index={safeIndex}
                total={slides.length}
                prefs={prefs}
                footer={footerLabel}
                busy={busy}
              />
            ) : (
              <EmptyState
                className="h-full items-center justify-center px-8 py-0 text-center"
                title={t("present.empty")}
              />
            )}
          </div>
        </div>

        <div className="klever-present-film" data-hidden={chromeHidden}>
          <IconButton
            aria-label={t("present.prev")}
            title={t("present.prev")}
            disabled={safeIndex <= 0}
            onClick={() => go(safeIndex - 1)}
          >
            <ChevronLeft size={16} strokeWidth={1.4} />
          </IconButton>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-1">
            {slides.map((s, i) => {
              const on = i === safeIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={on ? "true" : undefined}
                  aria-label={s.title || t("present.slideN", { n: i + 1, total: slides.length })}
                  className={cn(
                    "klever-present-thumb shrink-0",
                    on && "klever-present-thumb-on",
                  )}
                  onClick={() => go(i)}
                >
                  <span className="font-mono text-[9px] tabular-nums text-[color:var(--present-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 line-clamp-2 text-left text-[11px] leading-tight text-[color:var(--present-fg)]">
                    {s.title || s.quote || s.kind}
                  </span>
                </button>
              );
            })}
          </div>
          <IconButton
            aria-label={t("present.next")}
            title={t("present.next")}
            disabled={safeIndex >= slides.length - 1}
            onClick={() => go(safeIndex + 1)}
          >
            <ChevronRight size={16} strokeWidth={1.4} />
          </IconButton>
        </div>
      </div>

      {prefs.showProgress && (
        <div className="klever-present-progress" aria-hidden>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function DeckSettings({
  prefs,
  origin,
  busy,
  canPolish,
  stale,
  onChange,
  onRebuild,
  onPolish,
}: {
  prefs: PresentPrefs;
  origin: PresentDeck["origin"];
  busy: boolean;
  canPolish: boolean;
  stale: boolean;
  onChange: (partial: Partial<PresentPrefs>) => void;
  onRebuild: () => void;
  onPolish: () => void;
}) {
  const t = useT();
  return (
    <Panel
      role="dialog"
      aria-label={t("present.settings")}
      className="absolute right-0 top-full z-50 mt-1.5 max-h-[min(36rem,calc(100dvh-4.5rem))] w-[min(20.5rem,calc(100vw-1.25rem))] overflow-y-auto p-3 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.28)]"
    >
      <p className="mb-2.5 font-mono text-[10px] uppercase tracking-wide text-faint">
        {t("present.templates")}
      </p>
      <div className="mb-3 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={t("present.templates")}>
        {PRESENT_TEMPLATE_IDS.map((id) => {
          const on = prefs.template === id;
          const swatch = TEMPLATE_SWATCH[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border px-1.5 py-1.5 text-left",
                on ? "border-ink" : "border-line hover:border-mute",
              )}
              onClick={() => onChange({ template: id })}
            >
              <span
                className="block h-9 w-full rounded-md border border-black/10"
                style={{
                  background: `linear-gradient(135deg, ${swatch.bg} 64%, ${swatch.accent} 64%)`,
                }}
              />
              <span className="font-mono text-[10px] uppercase tracking-wide">
                {TEMPLATE_LABEL[id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 space-y-1.5">
        <p className="font-mono text-[10px] text-faint">{t("present.ratio")}</p>
        <Segmented<PresentRatio>
          aria-label={t("present.ratio")}
          size="sm"
          value={prefs.ratio}
          onChange={(ratio) => onChange({ ratio })}
          options={[
            { value: "16:9", label: t("present.ratio169") },
            { value: "4:3", label: t("present.ratio43") },
            { value: "16:10", label: t("present.ratio1610") },
          ]}
        />
      </div>

      <div className="mb-3 space-y-1.5">
        <p className="font-mono text-[10px] text-faint">{t("present.density")}</p>
        <Segmented<PresentDensity>
          aria-label={t("present.density")}
          size="sm"
          value={prefs.density}
          onChange={(density) => onChange({ density })}
          options={[
            { value: "sparse", label: t("present.sparse") },
            { value: "balanced", label: t("present.balanced") },
            { value: "dense", label: t("present.dense") },
          ]}
        />
      </div>

      <div className="mb-3 space-y-1.5">
        <p className="font-mono text-[10px] text-faint">{t("present.align")}</p>
        <Segmented<PresentAlign>
          aria-label={t("present.align")}
          size="sm"
          value={prefs.align}
          onChange={(align) => onChange({ align })}
          options={[
            { value: "left", label: t("present.alignLeft") },
            { value: "center", label: t("present.alignCenter") },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <Toggle checked={prefs.showNumbers} onChange={(showNumbers) => onChange({ showNumbers })} label={t("present.numbers")} />
        <Toggle checked={prefs.showProgress} onChange={(showProgress) => onChange({ showProgress })} label={t("present.progress")} />
        <Toggle checked={prefs.footer} onChange={(footer) => onChange({ footer })} label={t("present.footer")} />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        <button
          type="button"
          className="klever-focus inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm text-ink hover:bg-paper-2"
          onClick={onRebuild}
        >
          {t("present.rebuild")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="klever-focus inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-sm text-paper disabled:opacity-50"
          onClick={onPolish}
        >
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} strokeWidth={1.6} aria-hidden />}
          {busy ? t("present.polishing") : t("present.polish")}
        </button>
        <p className="font-mono text-[10px] text-faint">
          {origin === "ai" ? t("present.ai") : t("present.outline")}
          {stale ? " · " + t("present.stale") : ""}
          {!canPolish ? " · " + t("present.needKey") : ""}
        </p>
      </div>
    </Panel>
  );
}

function PresentSlideView({
  slide,
  index,
  total,
  prefs,
  footer,
  busy,
}: {
  slide: PresentSlide;
  index: number;
  total: number;
  prefs: PresentPrefs;
  footer: string;
  busy: boolean;
}) {
  const center = prefs.align === "center" || slide.kind === "title" || slide.kind === "section" || slide.kind === "statement" || slide.kind === "quote" || slide.kind === "closing";
  const align = center ? "items-center text-center" : "items-start text-left";

  return (
    <article
      className={cn("klever-present-stage", busy && "opacity-80")}
      data-kind={slide.kind}
    >
      {prefs.showNumbers && (
        <span className="klever-present-num font-mono">
          {String(index + 1).padStart(2, "0")}
          <span aria-hidden> / {String(total).padStart(2, "0")}</span>
        </span>
      )}

      <div className={cn("klever-present-body flex min-h-0 flex-1 flex-col justify-center gap-5", align)}>
        {slide.kicker && <p className="klever-present-kicker">{slide.kicker}</p>}

        {slide.kind === "quote" ? (
          <>
            <blockquote className="klever-present-quote">{slide.quote || slide.title}</blockquote>
            {slide.attribution && <p className="klever-present-cite">{slide.attribution}</p>}
          </>
        ) : slide.kind === "figure" ? (
          <>
            {slide.title && <h2 className="klever-present-title klever-present-title-small">{slide.title}</h2>}
            <PresentFigure src={slide.image} alt={slide.subtitle || slide.title} />
            {slide.subtitle && slide.subtitle !== slide.title && (
              <p className="klever-present-sub">{slide.subtitle}</p>
            )}
          </>
        ) : (
          <>
            {slide.title && (
              <h2
                className={cn(
                  "klever-present-title",
                  (slide.kind === "title" || slide.kind === "statement" || slide.kind === "closing") &&
                    "klever-present-title-hero",
                  slide.kind === "section" && "klever-present-title-section",
                )}
              >
                {slide.title}
              </h2>
            )}
            {slide.subtitle && <p className="klever-present-sub">{slide.subtitle}</p>}
            {slide.body && slide.kind !== "statement" && <p className="klever-present-copy">{slide.body}</p>}
            {slide.bullets && slide.bullets.length > 0 && (
              <ul className={cn("klever-present-list", center && "mx-auto")}>
                {slide.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {prefs.footer && footer && <p className="klever-present-foot">{footer}</p>}
    </article>
  );
}

function PresentFigure({ src, alt }: { src?: string; alt: string }) {
  const blobs = useApp((s) => s.blobs);
  const ensureBlob = useApp((s) => s.ensureBlob);
  const url = useMemo(() => (src ? resolveAssetSrc(src, blobs) : ""), [src, blobs]);
  const hasData = Boolean(
    src && (blobs[src.replace(/^\.\//, "")]?.data?.byteLength ?? blobs[src]?.data?.byteLength),
  );

  useEffect(() => {
    if (!src || hasData) return;
    void ensureBlob(src.replace(/^\.\//, ""));
  }, [src, hasData, ensureBlob]);

  if (!src) return null;
  if (!url) {
    return <div className="klever-present-figure klever-present-figure-empty" aria-hidden />;
  }
  return <img src={url} alt={alt} className="klever-present-figure" />;
}
