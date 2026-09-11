import type { Locale } from "@/lib/i18n";
import { STARTERS } from "@/lib/starters-data";

export type {
  StarterKind,
  StarterPurpose,
  StarterTheme,
  StarterCopy,
  DbRowSeed,
  StarterSeed,
  Starter,
} from "@/lib/starter-types";
export {
  STARTER_KINDS,
  STARTER_PURPOSES,
  STARTER_THEMES,
} from "@/lib/starter-types";
import {
  STARTER_PURPOSES,
  STARTER_THEMES,
  type Starter,
  type StarterCopy,
  type StarterKind,
  type StarterPurpose,
  type StarterTheme,
} from "@/lib/starter-types";

export { STARTERS } from "@/lib/starters-data";

export function starterCopy(starter: Starter, locale: Locale): StarterCopy {
  return starter.copy[locale] ?? starter.copy.en;
}

export function filterStarters(
  starters: Starter[],
  opts: {
    query?: string;
    kind?: StarterKind | "all";
    purpose?: StarterPurpose | "all";
    theme?: StarterTheme | "all";
    allowBoard?: boolean;
  },
): Starter[] {
  const q = opts.query?.trim().toLowerCase() ?? "";
  return starters.filter((s) => {
    if (s.kind === "board" && opts.allowBoard === false) return false;
    if (opts.kind && opts.kind !== "all" && s.kind !== opts.kind) return false;
    if (!s.blank) {
      if (opts.purpose && opts.purpose !== "all" && s.purpose !== opts.purpose) return false;
      if (opts.theme && opts.theme !== "all" && s.theme !== opts.theme) return false;
    } else if (
      (opts.purpose && opts.purpose !== "all") ||
      (opts.theme && opts.theme !== "all")
    ) {
      return false;
    }
    if (!q) return true;
    const hay = `${s.id} ${s.copy.en.title} ${s.copy.en.blurb} ${s.copy.fr.title} ${s.copy.fr.blurb} ${s.kind} ${s.purpose} ${s.theme}`;
    return hay.toLowerCase().includes(q);
  });
}

export function groupStarters(
  starters: Starter[],
  by: "purpose" | "theme",
): { key: StarterPurpose | StarterTheme; items: Starter[] }[] {
  const order = by === "purpose" ? STARTER_PURPOSES : STARTER_THEMES;
  return order
    .map((key) => ({
      key,
      items: starters.filter((s) => !s.blank && s[by] === key),
    }))
    .filter((g) => g.items.length);
}

/** Compact catalog for model prompts — not shown in the UI. */
export function starterCatalogForAi(locale: Locale = "en"): string {
  return STARTERS.filter((s) => !s.blank)
    .map((s) => {
      const c = starterCopy(s, locale);
      return `- ${s.kind} “${c.title}” (${s.purpose}/${s.theme}): ${c.blurb}`;
    })
    .join("\n");
}
