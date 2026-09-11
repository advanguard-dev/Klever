import { Overlay, Kbd, MonoLabel, Panel } from "@/components/ui";
import { NoteIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import { runStarter, runVaultTemplate } from "@/lib/apply-starter";
import {
  filterStarters,
  groupStarters,
  STARTERS,
  STARTER_KINDS,
  STARTER_PURPOSES,
  STARTER_THEMES,
  starterCopy,
  type Starter,
  type StarterKind,
  type StarterPurpose,
  type StarterTheme,
} from "@/lib/starters";
import type { MessageKey } from "@/lib/i18n";
import { defaultWorkspaceTools } from "@/lib/workspaces";
import { useLocale, useT } from "@/lib/use-t";
import { useApp } from "@/store";
import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type KindFilter = StarterKind | "all";
type PurposeFilter = StarterPurpose | "all";
type ThemeFilter = StarterTheme | "all";

const KIND_KEYS: Record<StarterKind, MessageKey> = {
  page: "starter.kind.page",
  board: "starter.kind.board",
  database: "starter.kind.database",
};

const PURPOSE_KEYS: Record<StarterPurpose, MessageKey> = {
  write: "starter.purpose.write",
  plan: "starter.purpose.plan",
  track: "starter.purpose.track",
  meet: "starter.purpose.meet",
  learn: "starter.purpose.learn",
  create: "starter.purpose.create",
};

const THEME_KEYS: Record<StarterTheme, MessageKey> = {
  work: "starter.theme.work",
  personal: "starter.theme.personal",
  studio: "starter.theme.studio",
  research: "starter.theme.research",
  home: "starter.theme.home",
};

export function StarterMenu({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const notes = useApp((s) => s.notes);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const tools =
    workspaces.find((w) => w.id === activeWorkspaceId)?.tools ?? defaultWorkspaceTools();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [purpose, setPurpose] = useState<PurposeFilter>("all");
  const [theme, setTheme] = useState<ThemeFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  const vault = useMemo(
    () => notes.filter((n) => n.template && n.type === "page"),
    [notes],
  );

  const filtered = useMemo(
    () =>
      filterStarters(STARTERS, {
        query,
        kind,
        purpose,
        theme,
        allowBoard: tools.board,
      }),
    [query, kind, purpose, theme, tools.board],
  );

  const blanks = filtered.filter((s) => s.blank);
  const rest = filtered.filter((s) => !s.blank);
  const groupBy = purpose !== "all" && theme === "all" ? "theme" : "purpose";
  const groups = query.trim() || (purpose !== "all" && theme !== "all") ? null : groupStarters(rest, groupBy);
  const vaultHits = vault.filter((n) => {
    if (kind !== "all" && kind !== "page") return false;
    if (purpose !== "all" || theme !== "all") return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${n.title} ${n.body}`.toLowerCase().includes(q);
  });

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const useBuiltIn = (starter: Starter) => {
    runStarter(starter.id);
    onClose();
  };

  return (
    <Overlay
      onClose={onClose}
      title={t("starter.title")}
      description={t("starter.blurb")}
      labelledBy={titleId}
      describedBy={descId}
      className="max-w-5xl"
    >
      <Panel className="flex max-h-[min(44rem,88vh)] flex-col overflow-hidden">
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <MonoLabel>{t("starter.eyebrow")}</MonoLabel>
          <h2 id={titleId} className="mt-2 font-serif text-3xl tracking-tight">
            {t("starter.title")}
          </h2>
          <p id={descId} className="mt-2 max-w-xl text-sm leading-relaxed text-mute">
            {t("starter.blurb")}
          </p>
          <label className="klever-focus-within mt-4 flex min-h-11 items-center gap-2 rounded-md bg-ink/[0.045] px-3 md:min-h-10">
            <Search size={14} strokeWidth={1.4} className="text-faint" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("starter.search")}
              aria-label={t("starter.search")}
              className="w-full bg-transparent py-2 text-sm placeholder:text-faint"
            />
            <span className="hidden sm:inline-flex">
              <Kbd>ESC</Kbd>
            </span>
          </label>
          <div className="mt-4 flex flex-col gap-2">
            <ChipRow
              legend={t("starter.kindLegend")}
              value={kind}
              onChange={setKind}
              options={[
                { id: "all", label: t("starter.kind.all") },
                ...STARTER_KINDS.filter((k) => k !== "board" || tools.board).map((k) => ({
                  id: k,
                  label: t(KIND_KEYS[k]),
                })),
              ]}
            />
            <ChipRow
              legend={t("starter.purposeLegend")}
              value={purpose}
              onChange={setPurpose}
              options={[
                { id: "all", label: t("starter.all") },
                ...STARTER_PURPOSES.map((p) => ({ id: p, label: t(PURPOSE_KEYS[p]) })),
              ]}
            />
            <ChipRow
              legend={t("starter.themeLegend")}
              value={theme}
              onChange={setTheme}
              options={[
                { id: "all", label: t("starter.all") },
                ...STARTER_THEMES.map((th) => ({ id: th, label: t(THEME_KEYS[th]) })),
              ]}
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {blanks.length > 0 && (
            <section className="mb-8">
              <MonoLabel>{t("starter.section.blank")}</MonoLabel>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {blanks.map((s) => (
                  <li key={s.id}>
                    <StarterCard starter={s} locale={locale} onUse={() => useBuiltIn(s)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {vaultHits.length > 0 && (
            <section className="mb-8">
              <MonoLabel>{t("starter.yours")}</MonoLabel>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vaultHits.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        runVaultTemplate(n);
                        onClose();
                      }}
                      className="klever-focus group flex min-h-24 w-full flex-col items-start rounded-lg border border-line bg-paper p-4 text-left transition-colors duration-150 hover:border-ink/20 hover:bg-paper-2 active:bg-line"
                    >
                      <MonoLabel>
                        {t("starter.kind.page")} · {t("starter.yours")}
                      </MonoLabel>
                      <span className="mt-2 flex items-center gap-2 font-serif text-lg tracking-tight">
                        <NoteIcon icon={n.icon} size={16} className="text-faint" />
                        {n.title}
                      </span>
                      <span className="mt-1 line-clamp-2 text-sm text-mute">
                        {t("starter.vaultBlurb")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups
            ? groups.map((g) => (
                <section key={g.key} className="mb-8 last:mb-0">
                  <MonoLabel>
                    {groupBy === "purpose"
                      ? t(PURPOSE_KEYS[g.key as StarterPurpose])
                      : t(THEME_KEYS[g.key as StarterTheme])}
                  </MonoLabel>
                  <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((s) => (
                      <li key={s.id}>
                        <StarterCard starter={s} locale={locale} onUse={() => useBuiltIn(s)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            : rest.length > 0 && (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((s) => (
                    <li key={s.id}>
                      <StarterCard starter={s} locale={locale} onUse={() => useBuiltIn(s)} />
                    </li>
                  ))}
                </ul>
              )}

          {!blanks.length && !rest.length && !vaultHits.length && (
            <p className="py-10 text-sm text-mute">{t("starter.empty")}</p>
          )}
        </div>
      </Panel>
    </Overlay>
  );
}

function ChipRow<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div>
      <p className="sr-only">{legend}</p>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const on = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(opt.id)}
              className={cn(
                "klever-focus inline-flex min-h-11 items-center rounded-md px-2.5 text-sm md:min-h-8",
                on
                  ? "bg-ink text-paper"
                  : "text-mute hover:bg-paper-2 hover:text-ink active:bg-line",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StarterCard({
  starter,
  locale,
  onUse,
}: {
  starter: Starter;
  locale: "en" | "fr";
  onUse: () => void;
}) {
  const t = useT();
  const copy = starterCopy(starter, locale);
  const rule =
    starter.kind === "database" ? "border-prop" : starter.kind === "board" ? "border-ring" : "border-ink";
  return (
    <button
      type="button"
      onClick={onUse}
      className={cn(
        "klever-focus group flex min-h-28 w-full gap-3 rounded-lg border border-line bg-paper p-4 text-left transition-colors duration-150",
        "hover:border-ink/20 hover:bg-paper-2 active:bg-line",
      )}
    >
      <span
        className={cn("mt-0.5 w-0.5 shrink-0 self-stretch rounded-full border-l-2", rule)}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <MonoLabel>
          {t(KIND_KEYS[starter.kind])}
          {!starter.blank && (
            <>
              {" · "}
              {t(THEME_KEYS[starter.theme])}
            </>
          )}
        </MonoLabel>
        <span className="mt-2 flex items-start gap-2 font-serif text-lg leading-tight tracking-tight">
          <NoteIcon icon={starter.icon} size={16} className="mt-0.5 shrink-0 text-faint" />
          <span>{copy.title}</span>
        </span>
        <span className="mt-1 line-clamp-2 text-sm leading-5 text-mute">{copy.blurb}</span>
      </span>
      <MiniPreview kind={starter.kind} />
    </button>
  );
}

function MiniPreview({ kind }: { kind: StarterKind }) {
  if (kind === "board") {
    return (
      <span
        className="hidden h-14 w-14 shrink-0 grid-cols-2 gap-1 rounded-md border border-line bg-blotter p-1.5 lg:grid"
        aria-hidden
      >
        <span className="rounded-[2px]" style={{ background: "#e4cc8a" }} />
        <span className="rounded-[2px]" style={{ background: "#b7c6d8" }} />
        <span className="rounded-[2px]" style={{ background: "#c5d4c4" }} />
        <span className="rounded-[2px]" style={{ background: "#e0b8b4" }} />
      </span>
    );
  }
  if (kind === "database") {
    return (
      <span
        className="hidden h-14 w-14 shrink-0 flex-col justify-center gap-1 rounded-md border border-line bg-blotter p-2 lg:flex"
        aria-hidden
      >
        <span className="h-1 rounded-full bg-ink/25" />
        <span className="h-1 w-4/5 rounded-full bg-ink/15" />
        <span className="h-1 w-3/5 rounded-full bg-ink/15" />
      </span>
    );
  }
  return (
    <span
        className="hidden h-14 w-14 shrink-0 flex-col justify-center gap-1 rounded-md border border-line bg-blotter p-2 lg:flex"
      aria-hidden
    >
      <span className="h-1.5 w-3/4 rounded-full bg-ink/30" />
      <span className="h-1 w-full rounded-full bg-ink/12" />
      <span className="h-1 w-5/6 rounded-full bg-ink/12" />
    </span>
  );
}
