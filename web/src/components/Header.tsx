import { GhostLink, SolidLink } from "@/components/ui";
import { BETA_HREF, copy, GITHUB_HREF } from "@/content";

const nav = [
  { href: "#notes", label: "Notes" },
  { href: "#graph", label: "Graph" },
  { href: "#boards", label: "Boards" },
  { href: "#privacy", label: "Privacy" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-blotter">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <a
            href="#main"
            className="rounded-md font-serif text-lg font-semibold tracking-tight klever-focus"
          >
            Klever
          </a>
          <SolidLink
            href={BETA_HREF}
            className="h-8 px-3 sm:hidden"
            rel="noopener noreferrer"
            target="_blank"
          >
            {copy.beta}
          </SolidLink>
        </div>
        <nav aria-label="Page" className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-center">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-sm text-sm text-mute transition-colors hover:text-ink klever-focus"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <GhostLink
            href={GITHUB_HREF}
            className="h-8 px-3"
            rel="noopener noreferrer"
            target="_blank"
          >
            {copy.github}
          </GhostLink>
          <SolidLink
            href={BETA_HREF}
            className="h-8 px-3"
            rel="noopener noreferrer"
            target="_blank"
          >
            {copy.beta}
          </SolidLink>
        </div>
      </div>
    </header>
  );
}
