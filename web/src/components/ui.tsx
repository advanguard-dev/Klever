import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-md border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-mute">
      {children}
    </kbd>
  );
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode };

export function SolidLink({ className, children, ...props }: LinkProps) {
  return (
    <a
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors duration-150 ease-out",
        "hover:bg-ink/90 active:bg-ink/80",
        "klever-focus-solid",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function GhostLink({ className, children, ...props }: LinkProps) {
  return (
    <a
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink transition-colors duration-150 ease-out",
        "hover:bg-paper-2 hover:border-ink/20 active:bg-line",
        "klever-focus",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}
