import { useState } from "react";
import AnimatedContent from "@/bits/AnimatedContent";
import Folder from "@/bits/Folder";
import TextType from "@/bits/TextType";
import { copy, vaultFiles } from "@/content";

function FileChip({ name }: { name: string }) {
  return (
    <span className="flex h-full items-end p-1.5 font-mono text-[6px] leading-tight text-ink">
      {name}
    </span>
  );
}

export function VaultFolder() {
  const [open, setOpen] = useState(false);

  return (
    <section id="vault" className="px-5 py-8 md:px-8 md:py-12">
      <AnimatedContent className="mx-auto max-w-6xl">
        <div className="overflow-visible rounded-xl border border-line bg-paper px-6 py-10 md:px-10 md:py-14">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="flex min-h-[14rem] items-center justify-center pt-16">
              <Folder
                color="#6b5e4e"
                size={1.55}
                open={open}
                onOpenChange={setOpen}
                label="sample vault"
                items={vaultFiles.map((name) => (
                  <FileChip key={name} name={name} />
                ))}
              />
            </div>
            <div className="klever-folio pl-6 md:pl-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
                A folder on disk
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
                The vault is the folder.
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-mute">{copy.vaultLead}</p>
              <p className="mt-6 font-mono text-xs text-mute">
                Open the folder to see the papers.
              </p>
              <div
                className="mt-6 min-h-[8.5rem] rounded-md border border-line bg-paper-2/80 p-4 font-mono text-[13px] leading-6 text-ink"
                aria-live="polite"
              >
                {open ? (
                  <TextType
                    as="p"
                    text={copy.welcomeType}
                    loop={false}
                    typingSpeed={28}
                    showCursor
                    cursorCharacter="▍"
                    cursorClassName="text-ring"
                    className="whitespace-pre-wrap"
                  />
                ) : (
                  <span className="text-mute">Welcome.md waits inside.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </AnimatedContent>
    </section>
  );
}
