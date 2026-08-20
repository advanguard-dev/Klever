import { NoteIcon, noteKindIcon } from "@/lib/chrome-icons";
import { cn } from "@/lib/cn";
import { noteMenuItems } from "@/lib/context-menus";
import { useContextMenu } from "@/components/ContextMenu";
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

  return (
    <div
      role="tablist"
      aria-label="Open pages"
      className="flex h-10 shrink-0 items-stretch gap-0 overflow-x-auto border-b border-line px-4 md:px-8"
    >
      {items.map((n) => {
        const on = n.id === activeId;
        return (
          <div
            key={n.id}
            className={cn(
              "group/tab relative flex max-w-[11rem] shrink-0 items-end",
              on ? "text-ink" : "text-mute",
            )}
            onContextMenu={(e) => open(e, noteMenuItems(n, { closeTab: true }))}
          >
            <button
              type="button"
              role="tab"
              aria-selected={on}
              title={n.title || "Untitled"}
              className={cn(
                "flex min-w-0 items-center gap-1.5 px-2.5 pb-2 pt-2 font-serif text-sm transition-colors duration-150",
                "hover:text-ink",
                on && "italic tracking-tight",
              )}
              onClick={() =>
                setView(
                  n.type === "database" ? { kind: "database", id: n.id } : { kind: "note", id: n.id },
                )
              }
            >
              <NoteIcon
                icon={n.icon}
                fallback={noteKindIcon(n.type)}
                size={13}
                className="shrink-0 text-faint"
              />
              <span className="truncate">{n.title || "Untitled"}</span>
            </button>
            <button
              type="button"
              aria-label={`Close ${n.title || "Untitled"}`}
              className="mb-1.5 mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-faint opacity-0 transition-opacity hover:bg-paper-2 hover:text-ink group-hover/tab:opacity-100"
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
