import { GhostLink, SolidLink } from "@/components/ui";
import { copy, DOWNLOAD_HREF, GITHUB_HREF, VERSION } from "@/content";

export function Footer() {
  return (
    <footer className="border-t border-line px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-serif text-xl font-semibold tracking-tight">Klever</p>
          <p className="mt-2 max-w-sm text-sm text-mute">{copy.eyebrow}. Files stay on disk.</p>
          <p className="mt-3 font-mono text-[11px] text-mute">macOS · {VERSION}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SolidLink href={DOWNLOAD_HREF} rel="noopener noreferrer" target="_blank">
            {copy.download}
          </SolidLink>
          <GhostLink href={GITHUB_HREF} rel="noopener noreferrer" target="_blank">
            {copy.github}
          </GhostLink>
        </div>
      </div>
    </footer>
  );
}
