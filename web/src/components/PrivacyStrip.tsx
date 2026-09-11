import AnimatedContent from "@/bits/AnimatedContent";
import { copy } from "@/content";

export function PrivacyStrip() {
  return (
    <section id="privacy" className="px-5 py-8 md:px-8 md:py-12">
      <AnimatedContent className="mx-auto max-w-6xl">
        <div className="rounded-xl bg-ink px-6 py-10 text-paper md:px-12 md:py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/70">
            Local · Private
          </p>
          <h2 className="mt-4 max-w-2xl font-serif text-3xl font-semibold leading-[1.1] tracking-tight md:text-4xl">
            {copy.privacy}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-paper/75">{copy.privacyBody}</p>
          <h3 className="mt-10 font-serif text-xl font-semibold tracking-tight">
            {copy.privacyNoteTitle}
          </h3>
          <ul className="mt-4 max-w-2xl space-y-3 text-sm leading-6 text-paper/75">
            {copy.privacyBullets.map((line) => (
              <li key={line} className="pl-4 relative before:absolute before:left-0 before:content-['–']">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </AnimatedContent>
    </section>
  );
}
