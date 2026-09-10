import { Overlay, Kbd, MonoLabel, Panel } from "@/components/ui";
import { ChromeIcon, commandIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import { buildCommands, filterCommands, grouped, sectionLabel, slashCommands } from "@/lib/commands";
import { runCommand } from "@/lib/run-command";
import { useLocale, useT } from "@/lib/use-t";
import { useApp } from "@/store";
import type { InsertCommand, InsertContext } from "@/types";
import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

export function PlusMenu() {
  const t = useT();
  const locale = useLocale();
  const open = useApp((s) => s.plusOpen);
  const context = useApp((s) => s.plusContext);
  const setOpen = useApp((s) => s.setPlusOpen);
  const notes = useApp((s) => s.notes);
  if (!open) return null;
  return (
    <CommandStack
      context={context}
      commands={buildCommands(notes, context, locale)}
      title={t("insert.title")}
      onClose={() => setOpen(false)}
    />
  );
}

export function SlashStack({
  query,
  index,
  onIndex,
  onClose,
  onRun,
  onFiltered,
  className,
  style,
}: {
  query: string;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onRun: (cmd: InsertCommand) => void;
  onFiltered?: (cmds: InsertCommand[]) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useT();
  const notes = useApp((s) => s.notes);
  const locale = useLocale();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const cmds = useMemo(
    () => filterCommands(slashCommands(notes, locale), `${query} ${q}`.trim()),
    [notes, query, q, locale],
  );
  const groups = grouped(cmds, "editor");
  const flat = groups.flatMap((g) => g.items);

  const onFilteredRef = useRef(onFiltered);
  onFilteredRef.current = onFiltered;

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    onFilteredRef.current?.(cmds);
  }, [cmds]);

  useEffect(() => {
    if (index >= flat.length) onIndex(Math.max(0, flat.length - 1));
  }, [flat.length, index, onIndex]);

  const run = (idx: number) => {
    const cmd = flat[idx];
    if (!cmd) return;
    onRun(cmd);
    onClose();
  };

  return (
    <Panel className={cn("overflow-hidden", className ?? "mt-3")} style={style}>
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search size={14} strokeWidth={1.4} className="text-faint" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          role="combobox"
          aria-label={t("insert.search")}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={flat[index] ? `${listId}-${flat[index].id}` : undefined}
          placeholder={t("insert.search")}
          onChange={(e) => {
            setQ(e.target.value);
            onIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              onIndex(Math.min(flat.length - 1, index + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              onIndex(Math.max(0, index - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              run(index);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          className="w-full bg-transparent py-2.5 text-sm"
        />
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        <CommandList
          listId={listId}
          groups={groups}
          activeId={flat[index]?.id}
          onHover={(i) => onIndex(i)}
          onRun={(cmd) => {
            onRun(cmd);
            onClose();
          }}
        />
        {!flat.length && <p className="px-4 py-6 text-sm text-mute">{t("insert.nothing")}</p>}
      </div>
    </Panel>
  );
}

function CommandStack({
  context,
  commands,
  title,
  onClose,
}: {
  context: InsertContext;
  commands: InsertCommand[];
  title: string;
  onClose: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const cmds = filterCommands(commands, q);
  const groups = grouped(cmds, context);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
  useEffect(() => setI(0), [q]);

  const run = (idx: number) => {
    const cmd = flat[idx];
    if (!cmd) return;
    void runCommand(cmd);
    onClose();
  };

  return (
    <Overlay onClose={onClose} title={title}>
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={15} strokeWidth={1.4} className="text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            role="combobox"
            aria-label={title}
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat[i] ? `${listId}-${flat[i].id}` : undefined}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((x) => Math.min(flat.length - 1, x + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(i);
              } else if (e.key === "Escape") onClose();
            }}
            placeholder={title}
            className="w-full bg-transparent py-4 text-base"
          />
          <span className="hidden sm:inline-flex">
            <Kbd>ESC</Kbd>
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          <CommandList
            listId={listId}
            groups={groups}
            activeId={flat[i]?.id}
            onHover={(idx) => setI(idx)}
            onRun={(cmd) => {
              void runCommand(cmd);
              onClose();
            }}
          />
          {!flat.length && <p className="px-4 py-6 text-sm text-mute">{t("insert.nothing")}</p>}
        </div>
      </Panel>
    </Overlay>
  );
}

function CommandList({
  listId,
  groups,
  activeId,
  onHover,
  onRun,
}: {
  listId?: string;
  groups: { section: InsertCommand["section"]; items: InsertCommand[] }[];
  activeId?: string;
  onHover: (flatIndex: number) => void;
  onRun: (cmd: InsertCommand) => void;
}) {
  const t = useT();
  const locale = useLocale();
  let n = 0;
  return (
    <ul id={listId} role={listId ? "listbox" : undefined} aria-label={listId ? t("common.commands") : undefined}>
      {groups.map((g) => (
        <li key={g.section} className="mb-2">
          <div className="px-4 py-1">
            <MonoLabel>{sectionLabel(g.section, locale)}</MonoLabel>
          </div>
          {g.items.map((item) => {
            const idx = n++;
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                id={listId ? `${listId}-${item.id}` : undefined}
                type="button"
                role={listId ? "option" : undefined}
                aria-selected={listId ? active : undefined}
                onMouseEnter={() => onHover(idx)}
                onClick={() => onRun(item)}
                className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-2 text-left text-sm max-md:py-3 ${
                  active ? "border-ring bg-paper-2 text-ink" : "border-transparent text-mute hover:bg-paper-2 hover:text-ink"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChromeIcon icon={commandIcon(item.id)} className={active ? "text-ink" : "text-faint"} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.hint && (
                  <span className="font-mono text-[10px] text-faint">{item.hint}</span>
                )}
              </button>
            );
          })}
        </li>
      ))}
    </ul>
  );
}
