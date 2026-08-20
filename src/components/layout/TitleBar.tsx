import { cn } from "@/lib/cn";

type TitleBarProps = React.ComponentProps<"header">;

/** App chrome header — draggable on macOS Electron; unchanged in the browser. */
export function TitleBar({ className, ...props }: TitleBarProps) {
  return (
    <header
      className={cn(
        "klever-titlebar flex min-h-14 shrink-0 items-center gap-2 border-b border-line pl-3 pr-3 pt-[env(safe-area-inset-top)] md:gap-3 md:pl-4 md:pr-4",
        className,
      )}
      {...props}
    />
  );
}
