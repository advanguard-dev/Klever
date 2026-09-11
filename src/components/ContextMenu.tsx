import { ConfirmDialog, Kbd, Panel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { appMenuItems, type ContextMenuAction, type ContextMenuItem, type ContextMenuSwatches } from "@/lib/context-menus";
import { PROP_SWATCHES } from "@/lib/prop-schema";
import { useT } from "@/lib/use-t";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type { ContextMenuAction, ContextMenuItem };

export type PointEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
  clientX: number;
  clientY: number;
};

type MenuState = { x: number; y: number; items: ContextMenuItem[] };

type HostApi = {
  open: (e: PointEvent, items: ContextMenuItem[]) => void;
  close: () => void;
};

const Ctx = createContext<HostApi | null>(null);

const NATIVE_SEL = "input, textarea, select, [contenteditable='true'], .cm-editor, .cm-content";

function isSep(item: ContextMenuItem): item is { type: "sep" } {
  return "type" in item && item.type === "sep";
}

function isSwatches(item: ContextMenuItem): item is ContextMenuSwatches {
  return "type" in item && item.type === "swatches";
}

function flatten(items: ContextMenuItem[]): ContextMenuItem[] {
  const out: ContextMenuItem[] = [];
  for (const item of items) {
    if (isSep(item)) {
      if (item.hidden) continue;
      if (out.length && !isSep(out[out.length - 1]!)) out.push(item);
      continue;
    }
    if (isSwatches(item)) {
      out.push(item);
      continue;
    }
    if (item.hidden) continue;
    out.push(item);
  }
  while (out.length && isSep(out[0]!)) out.shift();
  while (out.length && isSep(out[out.length - 1]!)) out.pop();
  return out;
}

function nativeTarget(target: EventTarget | null) {
  const el = target instanceof Element ? target : null;
  return Boolean(el?.closest(NATIVE_SEL));
}

export function useContextMenu(): HostApi {
  return useContext(Ctx) ?? { open: () => {}, close: () => {} };
}

export function contextMenuFromKey(
  e: { key: string; shiftKey: boolean; preventDefault: () => void; currentTarget: EventTarget },
  open?: (ev: PointEvent) => void,
) {
  if (!open) return;
  if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  open({
    preventDefault() {},
    stopPropagation() {},
    clientX: r.left + 12,
    clientY: r.bottom - 4,
  });
}

export function ContextMenuHost({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const close = useCallback(() => setMenu(null), []);

  const open = useCallback((e: PointEvent, items: ContextMenuItem[]) => {
    const next = flatten(items);
    if (!next.some((item) => !isSep(item))) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items: next });
  }, []);

  const api = useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={api}>
      <div
        className="min-h-dvh"
        onContextMenu={(e) => {
          if (e.defaultPrevented || nativeTarget(e.target)) return;
          open(e, appMenuItems());
        }}
      >
        {children}
      </div>
      {menu && (
        <Menu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={close}
          onConfirm={(item) => {
            close();
            if (item.confirm) {
              setConfirm({ ...item.confirm, onConfirm: item.onSelect });
              return;
            }
            item.onSelect();
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel ?? "Confirm"}
          danger
          onConfirm={() => {
            confirm.onConfirm();
            setConfirm(null);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </Ctx.Provider>
  );
}

function Menu({
  x,
  y,
  items,
  onClose,
  onConfirm,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  onConfirm: (item: ContextMenuAction) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [active, setActive] = useState(() => items.findIndex((i) => !isSep(i) && !isSwatches(i) && !i.disabled));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.min(Math.max(pad, x), window.innerWidth - width - pad),
      top: Math.min(Math.max(pad, y), window.innerHeight - height - pad),
    });
  }, [x, y, items]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        setActive((cur) => {
          for (let n = 1; n <= items.length; n++) {
            const i = (cur + dir * n + items.length * 8) % items.length;
            const item = items[i];
            if (item && !isSep(item) && !isSwatches(item) && !item.disabled) return i;
          }
          return cur;
        });
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = items[active];
        if (item && !isSep(item) && !isSwatches(item) && !item.disabled) onConfirm(item);
      }
    };
    const onScroll = () => onClose();
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [active, items, onClose, onConfirm]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-label="Actions"
      className="fixed z-[90] outline-none"
      style={{ left: pos.left, top: pos.top }}
    >
      <Panel className="min-w-[12.5rem] overflow-hidden py-1">
        {items.map((item, i) => {
          if (isSep(item)) {
            return <div key={`sep-${i}`} className="my-1 border-t border-line" role="separator" />;
          }
          if (isSwatches(item)) {
            return (
              <div
                key={item.id}
                role="group"
                aria-label={t("prop.color")}
                className="flex items-center gap-1 px-3 py-1.5"
              >
                {PROP_SWATCHES.map((s) => {
                  const on = (item.value ?? "") === s.id;
                  const label = s.id ? t("prop.colorNamed", { name: s.label }) : t("prop.colorDefault");
                  return (
                    <button
                      key={s.id || "default"}
                      type="button"
                      role="menuitemradio"
                      aria-checked={on}
                      aria-label={label}
                      title={label}
                      onClick={() => {
                        item.onPick(s.id || undefined);
                        onClose();
                      }}
                      className={cn(
                        "klever-focus h-5 w-5 rounded-full border",
                        on ? "border-ink ring-2 ring-ink/20" : "border-line",
                      )}
                      style={{ background: s.hex || "var(--color-paper-2)" }}
                    />
                  );
                })}
              </div>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                if (!item.disabled) onConfirm(item);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-4 border-l-2 px-3 py-1.5 text-left text-sm",
                item.disabled && "cursor-not-allowed opacity-40",
                i === active && !item.disabled
                  ? "border-ring bg-paper-2 text-ink"
                  : "border-transparent text-mute hover:bg-paper-2 hover:text-ink",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && <item.icon size={13} strokeWidth={1.4} className="shrink-0" />}
                <span className="truncate">{item.label}</span>
              </span>
              {item.hint && <Kbd>{item.hint}</Kbd>}
            </button>
          );
        })}
      </Panel>
    </div>,
    document.body,
  );
}

/** Bind a secondary-click handler. */
export function onSecondary(
  open: HostApi["open"],
  items: ContextMenuItem[] | (() => ContextMenuItem[]),
) {
  return (e: ReactMouseEvent) => {
    open(e, typeof items === "function" ? items() : items);
  };
}
