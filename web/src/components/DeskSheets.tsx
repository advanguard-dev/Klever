import AnimatedContent from "@/bits/AnimatedContent";
import DotGrid from "@/bits/DotGrid";
import { copy } from "@/content";

export function DeskSheets() {
  return (
    <section className="px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-3">
        <AnimatedContent delay={0.05}>
          <article
            id="notes"
            className="klever-folio flex h-full flex-col rounded-xl border border-line bg-paper p-6 pl-7 md:p-8 md:pl-9"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Page</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight">Read the note.</h2>
            <p className="mt-4 text-sm leading-7 text-mute">
              Block, source, or read. Wikilinks peek. The chrome stays out of the way.
            </p>
            <blockquote className="mt-8 border-l-2 border-ring pl-4 font-serif text-lg leading-snug text-ink">
              {copy.principle}
            </blockquote>
            <p className="mt-auto pt-8 text-sm text-mute">{copy.ai}</p>
          </article>
        </AnimatedContent>

        <AnimatedContent delay={0.12}>
          <article
            id="graph"
            className="flex h-full flex-col rounded-xl border border-line bg-paper p-6 md:p-8"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Graph</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight">
              The leftover shape.
            </h2>
            <p className="mt-4 text-sm leading-7 text-mute">
              Pages, databases, and tags as ink and dashed moss. Hover a node in the hero to see what
              it touches.
            </p>
            <div className="mt-8 flex flex-wrap gap-2" aria-hidden="true">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] text-ink">
                <span className="inline-block h-2 w-2 rounded-full bg-ink" />
                page
              </span>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] text-ink">
                <span className="inline-block h-3 w-3 rounded-full bg-ink" />
                database
              </span>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] text-tag">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-tag" />
                #tag
              </span>
            </div>
          </article>
        </AnimatedContent>

        <AnimatedContent delay={0.18}>
          <article
            id="boards"
            className="relative flex h-full min-h-[18rem] flex-col overflow-hidden rounded-xl border border-line bg-paper p-6 md:p-8"
          >
            <DotGrid
              className="pointer-events-none absolute inset-0 opacity-80"
              baseColor="#d5d8d2"
              activeColor="#151716"
              dotSize={2.2}
              gap={20}
            />
            <div className="relative">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Board</p>
              <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight">
                Dotted paper.
              </h2>
              <p className="mt-4 text-sm leading-7 text-mute">
                Stickies, shapes, and links on a blotter grid. Structure when you need it, empty
                paper when you don’t.
              </p>
              <div className="mt-8 max-w-[11rem] rotate-[-2deg] rounded-md border border-line bg-paper px-3 py-3 shadow-sm">
                <p className="font-mono text-[10px] text-mute">sticky</p>
                <p className="mt-1 font-serif text-sm leading-snug">Quiet chrome. The page is the product.</p>
              </div>
            </div>
          </article>
        </AnimatedContent>
      </div>
    </section>
  );
}
