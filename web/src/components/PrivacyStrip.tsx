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
        </div>
      </AnimatedContent>
    </section>
  );
}
