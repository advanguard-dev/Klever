import { cn } from "@/lib/cn";
import { useT } from "@/lib/use-t";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
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
        "inline-flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-md text-mute transition-colors duration-150 ease-out",
        "hover:bg-paper-2 hover:text-ink active:bg-line active:text-ink",
        focusRing,
        "disabled:cursor-not-allowed disabled:opacity-50",
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
  onFocus,
  onBlur,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  label: string;
  /** Show the label next to the icon (not only sr-only). */
  showLabel?: boolean;
  /** Keyboard shortcut; after 1.5s hover or focus, shown for 2s. */
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

  const armHint = () => {
    if (!shortcut) return;
    clearHint();
    showTimer.current = window.setTimeout(() => {
      setHint(true);
      hideTimer.current = window.setTimeout(() => setHint(false), 2000);
    }, 1500);
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
        aria-pressed={active}
        className={cn(
          "inline-flex h-9 max-md:h-11 max-md:min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-mute transition-colors duration-150 ease-out",
          "hover:bg-paper-2 hover:text-ink active:bg-line",
          focusRing,
          "disabled:cursor-not-allowed disabled:opacity-50",
          active && "bg-paper-2 text-ink",
          className,
        )}
        {...props}
        onFocus={(e) => {
          onFocus?.(e);
          armHint();
        }}
        onBlur={(e) => {
          onBlur?.(e);
          if (shortcut) clearHint();
        }}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          armHint();
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
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 shadow-md"
        >
          <span className="whitespace-nowrap text-xs text-ink">{label}</span>
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
        "inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-mute transition-colors duration-150 ease-out",
        "hover:bg-paper-2 hover:text-ink active:bg-line",
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
        "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors duration-150 ease-out",
        "hover:bg-ink/90 active:bg-ink/80",
        focusRingSolid,
        "disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink transition-colors duration-150 ease-out",
        "hover:bg-paper-2 hover:border-ink/20 active:bg-line",
        focusRing,
        "disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex h-9 items-center gap-2 rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink transition-colors duration-150 ease-out",
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
  variant = "well",
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; iconOnly?: boolean }[];
  size?: "sm" | "md";
  variant?: "well" | "ghost";
  "aria-label"?: string;
}) {
  const ghost = variant === "ghost";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={
        ghost
          ? "inline-flex items-center gap-0.5"
          : "inline-flex rounded-md border border-line bg-paper-2 p-0.5"
      }
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const next = options[(i + dir + options.length) % options.length];
        if (next) onChange(next.value);
        requestAnimationFrame(() => {
          const radios = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
          const ni = options.findIndex((o) => o.value === next?.value);
          if (ni >= 0) radios[ni]?.focus();
        });
      }}
    >
      {options.map((o) => {
        const on = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            aria-label={o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 text-ink",
              ghost
                ? "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 ease-out max-md:min-h-11"
                : cn(
                    "rounded-sm transition-colors duration-150 ease-out",
                    size === "sm" ? "px-2 py-1 text-xs max-md:min-h-11 max-md:px-2.5 max-md:py-0 max-md:text-sm" : "px-3 py-1.5 text-sm max-md:min-h-11",
                  ),
              focusRing,
              on
                ? ghost
                  ? "bg-paper-2 text-ink"
                  : "bg-paper text-ink shadow-sm"
                : "text-mute hover:text-ink",
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
      className={cn("inline-flex items-center gap-2 text-sm text-ink", focusRing, className)}
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150",
          checked ? "border-ring bg-ring" : "border-line bg-paper-2",
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
      aria-pressed={selected}
      className={cn(
        "rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ease-out",
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
        className="h-9 w-full appearance-none rounded-md border border-line bg-paper py-1 pl-2 pr-7 text-sm text-ink transition-colors duration-150 ease-out klever-focus focus-visible:border-ring"
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
        "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint",
        "transition-colors duration-150 ease-out klever-focus aria-invalid:border-danger focus-visible:border-ring",
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
  title,
  description,
  labelledBy,
  describedBy,
  className,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  description?: string;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const fallbackTitleId = useId();
  const fallbackDescId = useId();
  const titleId = labelledBy ?? fallbackTitleId;
  const descId = describedBy ?? (description ? fallbackDescId : undefined);
  const closeLabel = useT()("shell.close");

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? [
            ...panel.querySelectorAll<HTMLElement>(
              'button:not(.overlay-dismiss):not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, a[href], [tabindex]:not([tabindex="-1"])',
            ),
          ].filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true")
        : [];

    requestAnimationFrame(() => {
      const nodes = focusables();
      const active = document.activeElement as HTMLElement | null;
      if (panel && active && panel.contains(active) && active !== panel) return;
      (nodes[0] ?? panel)?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
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
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-black/40 dark:bg-black/70 motion-safe:animate-blotter"
      role="presentation"
    >
      <div className="flex min-h-full items-end justify-center px-0 pt-10 sm:items-start sm:px-4 sm:py-8">
        <button
          type="button"
          aria-label={closeLabel}
          className="overlay-dismiss fixed inset-0 cursor-default"
          tabIndex={-1}
          onClick={onClose}
        />
        <div
          ref={panelRef}
          className={cn(
            "relative z-10 w-full max-w-lg pb-[env(safe-area-inset-bottom)] motion-safe:animate-sheet max-sm:[&>*]:rounded-b-none max-sm:[&>*]:rounded-t-xl sm:pb-0",
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
        >
          {!labelledBy && (
            <h2 id={fallbackTitleId} className="sr-only">
              {title}
            </h2>
          )}
          {!describedBy && description && (
            <p id={fallbackDescId} className="sr-only">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function MonoLabel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em] text-mute", className)} style={style}>
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
      className={cn(
        "rounded-lg border border-line bg-paper shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint",
          "transition-colors duration-150 ease-out klever-focus aria-invalid:border-danger focus-visible:border-ring",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Alert = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    onDismiss?: () => void;
  }
>(function Alert({ className, children, onDismiss, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <TextButton className="shrink-0 px-1 py-0 text-xs" onClick={onDismiss}>
          Dismiss
        </TextButton>
      )}
    </div>
  );
});

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
      <p className="font-serif text-2xl font-semibold tracking-tight">{title}</p>
      {description && <p className="max-w-md text-sm leading-relaxed text-mute">{description}</p>}
      {action}
    </div>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
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
  const t = useT();
  const titleId = useId();
  const descId = useId();
  return (
    <Overlay
      onClose={onClose}
      title={title}
      description={description}
      labelledBy={titleId}
      describedBy={descId}
    >
      <Panel className="p-6">
        <MonoLabel>{t("common.confirm")}</MonoLabel>
        <h2 id={titleId} className="mt-2 font-serif text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p id={descId} className="mt-3 text-sm leading-relaxed text-mute">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <GhostButton onClick={onClose}>{cancelLabel ?? t("common.cancel")}</GhostButton>
          <SolidButton onClick={onConfirm}>{confirmLabel ?? t("common.confirm")}</SolidButton>
        </div>
      </Panel>
    </Overlay>
  );
}
