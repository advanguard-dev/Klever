import { Overlay, Kbd, MonoLabel, Panel } from "@/components/ui";
import { ChromeIcon, commandIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import { buildCommands, filterCommands, grouped, SECTION_LABEL, slashCommands } from "@/lib/commands";
import { runCommand } from "@/lib/run-command";
import { useApp } from "@/store";
import type { InsertCommand, InsertContext } from "@/types";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export function PlusMenu() {
  const open = useApp((s) => s.plusOpen);
  const context = useApp((s) => s.plusContext);
  const setOpen = useApp((s) => s.setPlusOpen);
  const notes = useApp((s) => s.notes);
  if (!open) return null;
  return (
    <CommandStack
      context={context}
      commands={buildCommands(notes, context)}
      title="Insert"
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
  className,
  style,
}: {
  query: string;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onRun: (cmd: InsertCommand) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const notes = useApp((s) => s.notes);
  const cmds = useMemo(
    () => filterCommands(slashCommands(notes), query),
    [notes, query],
  );
  const groups = grouped(cmds, "editor");
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    if (index >= flat.length) onIndex(Math.max(0, flat.length - 1));
  }, [flat.length, index, onIndex]);

  if (!flat.length) return null;

  return (
    <Panel className={cn("max-h-72 overflow-y-auto font-serif", className ?? "mt-3")} style={style}>
      <CommandList
        groups={groups}
        activeId={flat[index]?.id}
        onHover={(i) => onIndex(i)}
        onRun={(cmd) => {
          onRun(cmd);
          onClose();
        }}
      />
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
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
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
    <Overlay onClose={onClose}>
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={15} strokeWidth={1.4} className="text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={q}
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
            className="w-full bg-transparent py-4 font-serif text-base focus-visible:outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          <CommandList
            groups={groups}
            activeId={flat[i]?.id}
            onHover={(idx) => setI(idx)}
            onRun={(cmd) => {
              void runCommand(cmd);
              onClose();
            }}
          />
          {!flat.length && <p className="px-4 py-6 text-sm text-mute">Nothing here.</p>}
        </div>
      </Panel>
    </Overlay>
  );
}

function CommandList({
  groups,
  activeId,
  onHover,
  onRun,
}: {
  groups: { section: InsertCommand["section"]; items: InsertCommand[] }[];
  activeId?: string;
  onHover: (flatIndex: number) => void;
  onRun: (cmd: InsertCommand) => void;
}) {
  let n = 0;
  return (
    <ul>
      {groups.map((g) => (
        <li key={g.section} className="mb-2">
          <div className="px-4 py-1">
            <MonoLabel>{SECTION_LABEL[g.section]}</MonoLabel>
          </div>
          {g.items.map((item) => {
            const idx = n++;
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => onHover(idx)}
                onClick={() => onRun(item)}
                className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-2 text-left font-serif text-sm ${
                  active ? "border-ink bg-paper-2 text-ink" : "border-transparent text-mute hover:bg-paper-2 hover:text-ink"
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
