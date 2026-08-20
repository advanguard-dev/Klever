import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const focusRing = "klever-focus";
const focusRingSolid = "klever-focus-solid";

export function IconButton({
  className,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-md text-mute transition-colors duration-150 ease-out",
        "hover:bg-paper-2 hover:text-ink active:bg-paper-2 active:text-ink",
        focusRing,
        "disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-paper-2 text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function ToolbarBtn({
  className,
  active,
  label,
  children,
  title,
  showLabel,
  shortcut,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  label: string;
  /** Show the label next to the icon (not only sr-only). */
  showLabel?: boolean;
  /** Keyboard shortcut; after 1.5s hover, shown for 2s. */
  shortcut?: string;
}) {
  const [hint, setHint] = useState(false);
  const showTimer = useRef<number>(0);
  const hideTimer = useRef<number>(0);

  const clearHint = () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    setHint(false);
  };

  useEffect(() => () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title={shortcut ? undefined : (title ?? label)}
        aria-keyshortcuts={shortcut}
        className={cn(
          "inline-flex h-8 max-md:h-11 max-md:min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 font-serif text-sm text-mute transition-colors duration-150 ease-out",
          "hover:bg-paper-2 hover:text-ink active:bg-paper-2",
          focusRing,
          "disabled:cursor-not-allowed disabled:opacity-40",
          active && "bg-paper-2 text-ink",
          className,
        )}
        {...props}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          if (!shortcut) return;
          clearHint();
          showTimer.current = window.setTimeout(() => {
            setHint(true);
            hideTimer.current = window.setTimeout(() => setHint(false), 2000);
          }, 1500);
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          if (shortcut) clearHint();
        }}
      >
        {children}
        {showLabel ? (
          <span className="hidden whitespace-nowrap sm:inline">{label}</span>
        ) : (
          <span className="sr-only">{label}</span>
        )}
      </button>
      {hint && shortcut && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-line bg-paper px-2 py-1 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.35)]"
        >
          <span className="whitespace-nowrap font-serif text-xs text-ink">{label}</span>
          <Kbd>{shortcut}</Kbd>
        </span>
      )}
    </span>
  );
}

export function TextButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2 py-1 font-serif text-sm text-mute transition-colors duration-150 ease-out",
        "hover:bg-paper-2 hover:text-ink active:bg-paper-2",
        focusRing,
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function SolidButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2 font-serif text-sm text-paper transition-opacity duration-150 ease-out",
        "hover:opacity-85 active:opacity-70",
        focusRingSolid,
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function GhostButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2 font-serif text-sm text-ink transition-colors duration-150 ease-out",
        "hover:bg-paper-2 hover:border-ink/25 active:bg-paper-2",
        focusRing,
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function MenuTrigger({
  className,
  open,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { open?: boolean }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-1.5 font-serif text-sm text-ink transition-colors duration-150 ease-out",
        "hover:bg-paper-2",
        focusRing,
        open && "bg-paper-2",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        size={14}
        strokeWidth={1.4}
        className={cn("text-mute transition-transform duration-150", open && "rotate-180")}
        aria-hidden
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; iconOnly?: boolean }[];
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-xl border border-line bg-paper p-0.5"
    >
      {options.map((o) => {
        const on = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-serif text-ink transition-colors duration-150 ease-out",
              focusRing,
              size === "sm" ? "px-2 py-1 text-xs max-md:min-h-11 max-md:px-2.5 max-md:py-0 max-md:text-sm" : "px-3 py-1.5 text-sm max-md:min-h-11",
              on ? "bg-paper-2 text-ink" : "text-mute hover:bg-paper-2/70 hover:text-ink",
            )}
            title={o.label}
          >
            {Icon && <Icon size={size === "sm" ? 12 : 13} strokeWidth={1.4} aria-hidden />}
            {o.iconOnly ? <span className="sr-only">{o.label}</span> : o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("inline-flex items-center gap-2 font-serif text-sm text-ink", focusRing, className)}
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150",
          checked ? "border-ink bg-ink" : "border-line bg-paper-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-150",
            checked ? "left-[18px] bg-paper" : "left-0.5 bg-mute",
          )}
        />
      </span>
      {label && <span className={checked ? "text-ink" : "text-mute"}>{label}</span>}
    </button>
  );
}

export function Chip({
  className,
  selected,
  tone,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  tone?: "tag" | "prop" | "smart";
}) {
  const tones = {
    tag: selected
      ? "border-tag/30 bg-tag/[0.09] text-tag"
      : "border-tag/18 text-tag/80 hover:border-tag/35 hover:bg-tag/[0.06] hover:text-tag",
    prop: selected
      ? "border-prop/28 bg-prop/[0.08] text-prop"
      : "border-prop/16 text-mute hover:border-prop/30 hover:bg-prop/[0.05] hover:text-prop",
    smart: selected
      ? "border-smart/28 bg-smart/[0.09] text-smart"
      : "border-smart/18 text-smart/80 hover:border-smart/32 hover:bg-smart/[0.06] hover:text-smart",
  } as const;

  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-serif text-xs transition-colors duration-150 ease-out",
        focusRing,
        tone
          ? tones[tone]
          : selected
            ? "border-ink bg-paper-2 text-ink"
            : "border-line text-mute hover:border-ink/30 hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative inline-flex min-w-[7rem]", className)}>
      <select
        className="h-8 w-full appearance-none rounded-lg border border-line bg-paper py-1 pl-2 pr-7 font-serif text-sm text-ink transition-colors duration-150 ease-out focus-visible:border-ink focus-visible:outline-none"
        {...props}
      />
      <ChevronDown
        size={14}
        strokeWidth={1.4}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-mute"
        aria-hidden
      />
    </span>
  );
}

export function Field({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-line bg-paper px-3 py-2 text-ink placeholder:text-faint",
        "transition-colors duration-150 ease-out focus-visible:border-ink focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-md border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-mute">
      {children}
    </kbd>
  );
}

export function Overlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? [
            ...panel.querySelectorAll<HTMLElement>(
              'button:not(.overlay-dismiss):not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ),
          ].filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true")
        : [];

    requestAnimationFrame(() => {
      const nodes = focusables();
      (nodes[0] ?? panel)?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = focusables();
      if (!nodes.length) return;
      const active = document.activeElement as HTMLElement | null;
      const i = nodes.indexOf(active!);
      if (e.shiftKey && (i <= 0 || active === panel)) {
        e.preventDefault();
        nodes[nodes.length - 1].focus();
      } else if (!e.shiftKey && (i === nodes.length - 1 || i === -1)) {
        e.preventDefault();
        nodes[0].focus();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-ink/20 motion-safe:animate-blotter"
      role="presentation"
    >
      <div className="flex min-h-full items-end justify-center px-0 pt-10 sm:items-start sm:px-4 sm:py-8">
        <button
          type="button"
          aria-label="Close"
          className="overlay-dismiss fixed inset-0 cursor-default"
          tabIndex={-1}
          onClick={onClose}
        />
        <div
          ref={panelRef}
          className="relative z-10 w-full max-w-xl pb-[env(safe-area-inset-bottom)] font-serif motion-safe:animate-sheet max-sm:[&>*]:rounded-b-none max-sm:[&>*]:rounded-t-2xl sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelId}
          tabIndex={-1}
        >
          <span id={labelId} className="sr-only">
            Dialog
          </span>
          {children}
        </div>
      </div>
    </div>
  );
}

export function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
      {children}
    </span>
  );
}

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-paper", className)}
      {...props}
    />
  );
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-ink placeholder:text-faint",
        "transition-colors duration-150 ease-out focus-visible:border-ink focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  className,
  children,
  onDismiss,
}: {
  className?: string;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-line bg-paper px-4 py-3 font-serif text-sm text-ink",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <TextButton className="shrink-0 px-1 py-0 text-xs" onClick={onDismiss}>
          Dismiss
        </TextButton>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 px-4 py-16 md:px-8 md:py-20", className)}>
      <p className="font-serif text-2xl italic tracking-tight">{title}</p>
      {description && <p className="max-w-md text-sm leading-relaxed text-mute">{description}</p>}
      {action}
    </div>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <Panel className="p-6">
        <MonoLabel>Confirm</MonoLabel>
        <h2 className="mt-2 font-serif text-2xl italic tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <SolidButton onClick={onConfirm}>{confirmLabel}</SolidButton>
          <GhostButton onClick={onClose}>{cancelLabel}</GhostButton>
        </div>
      </Panel>
    </Overlay>
  );
}
