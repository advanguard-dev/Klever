import type { PageFont } from "@/types";

/** Klever page / inline word fonts — Geist, Instrument Serif, Fira Code. */
export const PAGE_FONTS: { id: PageFont; label: string; className: string }[] = [
  { id: "sans", label: "Sans", className: "font-sans" },
  { id: "serif", label: "Serif", className: "font-serif" },
  { id: "mono", label: "Mono", className: "font-mono" },
];

export function pageFontClass(font?: PageFont | string | null) {
  return PAGE_FONTS.find((f) => f.id === font)?.className ?? "";
}
