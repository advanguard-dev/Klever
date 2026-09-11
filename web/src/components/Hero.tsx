import { GraphLattice } from "@/components/GraphLattice";
import { GhostLink, Kbd, MonoLabel, SolidLink } from "@/components/ui";
import { BETA_HREF, copy, GITHUB_HREF, shortcuts } from "@/content";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 py-16 md:px-8 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="klever-folio relative pl-6 md:pl-8">
          <MonoLabel>{copy.eyebrow}</MonoLabel>
          <h1 className="mt-4 max-w-lg font-serif text-[2.5rem] font-semibold leading-[0.95] tracking-tight sm:text-6xl">
            {copy.headline}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-mute">{copy.deck}</p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <SolidLink href={BETA_HREF} rel="noopener noreferrer" target="_blank">
              {copy.beta}
            </SolidLink>
            <GhostLink href={GITHUB_HREF} rel="noopener noreferrer" target="_blank">
              {copy.github}
            </GhostLink>
          </div>
          <p className="mt-3 font-mono text-[11px] tracking-wide text-mute">{copy.macLine}</p>
          <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-line pt-8 text-sm text-mute sm:grid-cols-2">
            {shortcuts.map((row) => (
              <li key={row.keys} className="flex items-center gap-3">
                <Kbd>{row.keys}</Kbd>
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
            Sample vault · Graph
          </p>
          <GraphLattice />
        </div>
      </div>
    </section>
  );
}
