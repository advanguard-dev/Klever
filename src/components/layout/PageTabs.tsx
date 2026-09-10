import { NoteIcon, noteKindIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import { noteMenuItems } from "@/lib/context-menus";
import { contextMenuFromKey, useContextMenu } from "@/components/ContextMenu";
import { useApp } from "@/store";
import { X } from "lucide-react";

export function PageTabs() {
  const openTabs = useApp((s) => s.openTabs);
  const notes = useApp((s) => s.notes);
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const closeOpenTab = useApp((s) => s.closeOpenTab);
  const { open } = useContextMenu();
  const activeId = view.kind === "note" || view.kind === "database" ? view.id : null;

  const items = openTabs
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  if (items.length < 2) return null;

  const activate = (index: number) => {
    const n = items[index];
    if (!n) return;
    setView(n.type === "database" ? { kind: "database", id: n.id } : { kind: "note", id: n.id });
  };

  return (
    <div
      role="tablist"
      aria-label="Open pages"
      className="flex h-10 shrink-0 items-stretch gap-0 overflow-x-auto px-4 md:px-8"
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const i = items.findIndex((n) => n.id === activeId);
        if (i < 0) return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = (i + dir + items.length) % items.length;
        activate(next);
        requestAnimationFrame(() => {
          e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
        });
      }}
    >
      {items.map((n) => {
        const on = n.id === activeId;
        const menu = (ev: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) =>
          open(ev, noteMenuItems(n, { closeTab: true }));
        return (
          <div
            key={n.id}
            className={cn(
              "group/tab relative flex max-w-[11rem] shrink-0 items-end",
              on ? "text-ink" : "text-mute",
            )}
            onContextMenu={(e) => menu(e)}
          >
            <button
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              title={n.title || "Untitled"}
              className={cn(
                "klever-focus flex min-w-0 items-center gap-1.5 px-2.5 pb-2 pt-2 text-sm transition-colors duration-150",
                "hover:text-ink",
                on && "font-medium",
              )}
              onClick={() => activate(items.indexOf(n))}
              onKeyDown={(e) => contextMenuFromKey(e, menu)}
            >
              <NoteIcon
                icon={n.icon}
                fallback={noteKindIcon(n.type)}
                size={13}
                className="shrink-0 text-mute"
              />
              <span className="truncate">{n.title || "Untitled"}</span>
            </button>
            <button
              type="button"
              aria-label={`Close ${n.title || "Untitled"}`}
              className="klever-focus mb-1.5 mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-mute opacity-0 transition-opacity hover:bg-ink/[0.06] hover:text-ink group-hover/tab:opacity-100 group-focus-within/tab:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                closeOpenTab(n.id);
              }}
            >
              <X size={11} strokeWidth={1.6} />
            </button>
            <span
              className={cn(
                "pointer-events-none absolute inset-x-2 bottom-0 h-px",
                on ? "bg-ink" : "bg-transparent",
              )}
              aria-hidden
            />
          </div>
        );
      })}
    </div>
  );
}
