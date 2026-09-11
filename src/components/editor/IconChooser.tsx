import { Field, GhostButton, IconButton, MonoLabel, Overlay, Panel } from "@/components/ui";
import { ChromeIcon, ICON_LG, ICON_MD, NoteIcon } from "@/lib/chrome-icons";
import {
  filterPageIcons,
  isLucideIcon,
  lookupPageIcon,
  lucideIconValue,
  PAGE_ICONS,
  toKebab,
} from "@/lib/page-icons";
import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LUCIDE_ICON_NAMES } from "@/lib/lucide-icon-names";

const EMOJI_MARKS = ["✦", "◇", "○", "★", "✎", "▣", "▤", "📌", "💡", "🔥", "🌱", "📚"];

export function IconChooser({
  value,
  onChange,
  fallback,
  size = ICON_LG,
  addLabel = "Add icon",
}: {
  value?: string;
  onChange: (icon: string | undefined) => void;
  fallback?: LucideIcon;
  size?: number;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="group/icon">
      {value ? (
        <button
          type="button"
          aria-label="Change icon"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="klever-focus inline-flex items-center justify-center rounded-xl hover:bg-ink/[0.06]"
          style={{ width: size + 12, height: size + 12 }}
          onClick={() => setOpen(true)}
        >
          <NoteIcon icon={value} fallback={fallback} size={size} className="text-ink" />
        </button>
      ) : (
        <button
          type="button"
          aria-label={addLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="klever-focus mt-1 block rounded-md text-[12px] text-mute hover:text-ink"
          onClick={() => setOpen(true)}
        >
          {addLabel}
        </button>
      )}
      {open && (
        <IconPickerOverlay
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function IconPickerOverlay({
  value,
  onChange,
  onClose,
}: {
  value?: string;
  onChange: (icon: string | undefined) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const curated = useMemo(() => filterPageIcons(q), [q]);
  const extras = useMemo(() => extraLucideNames(q, curated), [q, curated]);
  const emojiValue = isLucideIcon(value) ? "" : (value ?? "");

  const pick = (next: string | undefined) => {
    onChange(next);
    onClose();
  };

  return (
    <Overlay onClose={onClose} title="Choose icon">
      <Panel className="overflow-hidden p-4">
        <MonoLabel>Icon</MonoLabel>
        <label className="mt-3 flex items-center gap-2">
          <Search size={14} strokeWidth={1.4} className="shrink-0 text-faint" aria-hidden />
          <Field
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const first = curated[0] ?? extras[0];
                if (first) pick(lucideIconValue(first));
              }
            }}
            placeholder="Search icons"
            aria-label="Search Lucide icons"
            autoComplete="off"
            className="py-1.5"
          />
        </label>
        <div className="mt-3 max-h-64 overflow-y-auto">
          {curated.length > 0 && (
            <IconGrid
              names={curated}
              current={value}
              onPick={(name) => pick(lucideIconValue(name))}
            />
          )}
          {extras.length > 0 && (
            <div className="mt-3">
              <MonoLabel>Lucide</MonoLabel>
              <div className="mt-2">
                <IconGrid
                  names={extras}
                  current={value}
                  onPick={(name) => pick(lucideIconValue(name))}
                  extra
                />
              </div>
            </div>
          )}
          {!curated.length && !extras.length && (
            <p className="py-6 text-center text-sm text-mute">No matching icons.</p>
          )}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <MonoLabel>Emoji</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-1">
            {EMOJI_MARKS.map((mark) => (
              <IconButton
                key={mark}
                aria-label={mark}
                active={value === mark}
                className="text-base"
                onClick={() => pick(mark)}
              >
                {mark}
              </IconButton>
            ))}
          </div>
          <Field
            value={emojiValue}
            onChange={(e) => onChange(e.target.value.trim() ? e.target.value : undefined)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Emoji or short mark"
            aria-label="Emoji or short mark"
            autoComplete="off"
            className="mt-2 py-1.5"
          />
        </div>
        {value && (
          <GhostButton className="mt-3 h-8 px-3 py-0 text-xs" onClick={() => pick(undefined)}>
            Remove icon
          </GhostButton>
        )}
      </Panel>
    </Overlay>
  );
}

function IconGrid({
  names,
  current,
  onPick,
  extra,
}: {
  names: string[];
  current?: string;
  onPick: (name: string) => void;
  extra?: boolean;
}) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {names.map((name) => {
        const active = current === lucideIconValue(name);
        return (
          <IconButton
            key={name}
            aria-label={name}
            title={name}
            active={active}
            onClick={() => onPick(name)}
          >
            {extra ? (
              <NoteIcon icon={lucideIconValue(name)} size={ICON_MD} className={active ? "text-ink" : "text-mute"} />
            ) : (
              <ChromeIcon
                icon={PAGE_ICONS[name] ?? lookupPageIcon(name)!}
                size={ICON_MD}
                className={active ? "text-ink" : "text-mute"}
              />
            )}
          </IconButton>
        );
      })}
    </div>
  );
}

function extraLucideNames(query: string, curatedHits: string[]): string[] {
  const q = toKebab(query);
  if (q.length < 2) return [];
  const have = new Set(curatedHits);
  return LUCIDE_ICON_NAMES.filter((n) => !have.has(n) && n.includes(q)).slice(0, 24);
}
