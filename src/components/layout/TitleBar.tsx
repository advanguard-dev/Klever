import { cn } from "@/lib/cn";

type TitleBarProps = React.ComponentProps<"header">;

/** App chrome header — draggable on macOS Electron; unchanged in the browser. */
export function TitleBar({ className, children, ...props }: TitleBarProps) {
  return (
    <header
      className={cn(
        "klever-titlebar flex min-h-12 shrink-0 items-center gap-2 border-b border-line bg-blotter pl-3 pr-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-4",
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}
