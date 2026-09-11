# Brand Guidelines v1.0

> Last updated: 2026-09-02
> Status: Active

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | #151716 (Ink) |
| Secondary Color | #3a5674 (Ring) |
| Primary Font | Instrument Serif (display / reading), Geist (body) |
| Voice | Quiet, specific, file-honest |

Klever is a local-first markdown vault. The brand is a stationery desk: paper, ink, blotter, folio. Quiet chrome. The page is the product.

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Ink | #151716 | rgb(21,23,22) | Wordmark, body, solid CTAs |
| Paper | #f4f5f2 | rgb(244,245,242) | Sheets, surfaces |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Ring | #3a5674 | rgb(58,86,116) | Folio rule, focus rings, AI/smart |
| Tag | #4f6b58 | rgb(79,107,88) | Tags, graph tag nodes |
| Prop | #6b5e4e | rgb(107,94,78) | Properties, manila folder |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Blotter | #e3e5e0 | rgb(227,229,224) | Page hinterland, shell |
| Paper 2 | #e9ebe6 | rgb(233,235,230) | Recessed paper, kbd fill |
| Mute | #585c59 | rgb(88,92,89) | Secondary text (≥4.5:1 on paper) |
| Faint | #6a6f6a | rgb(106,111,106) | Captions (AA on paper). Do not use for body. |
| Line | #d5d8d2 | rgb(213,216,210) | Hairlines between sheets |
| Rule | #d5d8d2 | rgb(213,216,210) | Alias of Line (`border-rule`) |

### Semantic Colors

| State | Hex | Usage |
|-------|-----|-------|
| Success | #16a34a | Confirmations |
| Warning | #d97706 | Cautions |
| Error | #dc2626 | Destructive actions |
| Info | #3a5674 | Same as Ring |

### Dark (prefers-color-scheme)

Paper `#121413` · Blotter `#0c0d0c` · Ink `#eceeea` · Ring `#8fa6c4` · Tag `#8fa892` · Mute `#9aa09b` · Faint `#8a8f8a` · Line `#2a2d2a`

### Accessibility

- Ink on Paper: ~14:1 (AAA)
- Mute on Paper: ≥4.5:1 (AA) — do not use Faint for body
- Focus: 2px paper + 2px Ring ring
- Interactive elements meet WCAG 2.1 AA

---

## 2. Typography

### Font Stack

```css
--font-heading: "Instrument Serif", ui-serif, Georgia, "Times New Roman", serif;
--font-body: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Fira Code", ui-monospace, "SF Mono", Menlo, monospace;
```

### Type Scale

Instrument Serif ships a single weight (400) plus italic. Titles use size and tracking, not bold.

| Element | Font | Weight | Size (Desktop/Mobile) | Line Height | Tracking |
|---------|------|--------|----------------------|-------------|----------|
| H1 | Instrument Serif | 400 | clamp 30–49px | 1.08 | optical, tighter at display |
| H2 | Instrument Serif | 400 | 22–26px | 1.2 | slight negative |
| Body (serif page) | Instrument Serif | 400 | 19px | 1.68 | +0.004em |
| Body (chrome / sans page) | Geist | 400 | 16–17px | 1.6–1.65 | 0 |
| Caption | Geist | 400 | 14px | 1.5 | 0 |
| Mono label | Fira Code | 400 | 10px | 1.4 | 0.16em uppercase |

Eyebrows: Fira Code, 10px, uppercase, tracking `0.16em`. Keyboard chips and filenames also use Fira Code.

---

## 3. Logo

Cream rounded square (`#f3f1eb`) with a bold ink **K**. Do not recolor, add effects, or place on busy photographs. Clear space = the counter of the K. Minimum digital size 32px.

---

## 4. Voice

### We are

- **Specific, not clever.** Name the file, the shortcut, the folder.
- **Quiet, not cold.** Short sentences. No slogans.
- **File-honest.** If it is not a file you can open in a text editor, we do not pretend it is yours.

### We sound like

- Local · Markdown · Private
- A garden on disk.
- A note you cannot open in a text editor is a hostage.
- Quiet chrome. The page is the product.
- AI drafts; you keep.

### We don't sound like

- Unlock your productivity
- Your second brain
- All-in-one workspace
- Anything a SaaS notes app would put on a billboard

### CTAs

Primary: **Download for Mac**. Secondary: **GitHub**. Keep those labels through the page.

---

## 5. Layout motifs

- **Blotter** fills the hinterland. Content sits on **paper sheets**.
- **Folio:** 2px left rule in Ring.
- Graph: ink dots, dashed tag edges, mono tag labels.
- Motion is paper: grain, a folder opening, type appearing. No aurora, glass, or glitch.
