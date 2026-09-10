# Klever UI/UX Fix Report

**Date:** 2026-08-15  
**Scope:** Self-paced design loop — screenshots of shell, note, graph, database, overlays; fixes without breaking core `ui.tsx` APIs or the paper/ink identity.  
**Constraint:** No `shadcn init`; keep Instrument fonts and existing primitives.

---

## Summary

The app recovered from a blank HMR crash, then got a full pass on contrast, focus, overlays, context rail, graph, sidebar noise, header density, TipTap wikilinks, Welcome atmosphere, and mobile sidebar behavior.

---

## Critical fixes

| Issue | Cause | Fix |
| --- | --- | --- |
| Blank screen after Graph / HMR | `RightRail` called `useState` / `useEffect` after early returns (Rules of Hooks violation) | Hooks always run first; early returns only after |
| Empty Graph canvas | Force simulation restarted before ticks painted; `h-full` had no usable height | Seed 60 ticks on start; viewport height `calc(100dvh − header − footer)` |
| Broken PropertyManager JSX | Incomplete `ConfirmDialog` refactor left invalid JSX | Restored fragment + Overlay / ConfirmDialog structure |

---

## Accessibility & chrome

- **Focus rings:** `.klever-focus` / `.klever-focus-solid` box-shadow rings on interactive primitives
- **Overlay:** Escape to close, focus trap, `aria-labelledby`
- **Mute contrast:** light theme `--color-mute` darkened to `#5f5a52`
- **Toolbar borders:** removed square outline chrome from icon/toolbar buttons (fill-only hover)
- **Solid buttons:** `button { color: inherit }` kept in `@layer base` so `text-paper` wins over black-on-black

---

## Layout & navigation

### Header
- Toolbar buttons are **icon-only** with `title` + `sr-only` labels (less crowding)
- Context toggle hidden below `md` (rail is desktop-only)

### Sidebar
- Hides empty draft noise: title `Untitled` or `New database` with empty body
- Mobile (`≤767px`): overlay drawer, backdrop dismiss, auto-collapse on narrow + on navigate
- Recents / vault / databases share `openNoteNav` so mobile closes after pick

### Context rail (`RightRail`)
- Links stack vertically (no “ProjectsPeopleAtlas” smash)
- Live extract from `[data-wiki]` + editor text when store body lags
- Unresolved targets still listed (e.g. missing pages)
- “Here” collapsed to a count when many peers

### Graph
- Nodes/labels paint reliably after layout seed
- Main gets `min-h-0`; graph uses explicit viewport height

### Database
- View tab move chevrons only on hover (`group/tab`)
- Shorter Settings label on small widths
- Property delete uses `ConfirmDialog`

---

## Editor & content

### TipTap wikilinks
- **Bug:** Welcome body showed literal `[[Principles]]` instead of wiki marks
- **Fix:** `hydrateWikiMarks()` after `setContent(mdToHtml(…))` converts leftover `[[target]]` text into `wikiLink` marks; StarterKit `link: false` to avoid conflicts
- Verified: `.ProseMirror [data-wiki]` for Principles, Projects, People, Atlas

### NotePage
- Dirty/baseline sync to reduce multi-tab body overwrite

### Welcome landing
- Soft radial paper gradients behind brand (no flat single-color void)

### Lucide page icons
- Storage `lucide:{name}`; chooser + `NoteIcon` wired through shell

---

## Surfaces checked (screenshots)

| Surface | Result |
| --- | --- |
| Note + Context | Links listed; wiki marks underlined |
| Graph (Atlas) | Nodes and tag edges visible |
| People database | Table usable; solid `+ Row` contrast OK |
| Command palette | Overlay + Escape OK |
| AI settings | Form fields + Done |
| Brain dump | Panel, Transcribe / Organize / Cancel |
| Icon chooser | Lucide grid + emoji row |
| Mobile shell | Sidebar overlays; context control hidden |

---

## Key files touched

- `src/components/ui.tsx` — focus rings, ToolbarBtn density, ConfirmDialog / Panel / etc.
- `src/index.css` — mute token, focus utilities, wiki-link styles
- `src/components/layout/RightRail.tsx` — hooks order, live wiki, link layout
- `src/components/layout/AppShell.tsx` — main min-height, mobile sidebar, header
- `src/components/layout/Sidebar.tsx` — draft filter, overlay width, mobile nav close
- `src/components/layout/Welcome.tsx` — atmospheric background
- `src/components/graph/GraphView.tsx` — height + simulation seed
- `src/components/editor/BlockEditor.tsx` — content sync + `hydrateWikiMarks`
- `src/lib/wiki-ext.ts` — parse priority for `span[data-wiki]`
- `src/components/db/PropertyManager.tsx` — confirm delete
- `src/components/db/DatabasePage.tsx` — tab chrome density

---

## Remaining / known soft spots

1. **Welcome body corruption** — first line can still appear as an erroneous `h3` after older TipTap round-trips; fresh demo content is fine; existing session data may need a one-time re-open of sample vault
2. **Duplicate database views** — e.g. two “Table” tabs if the user added extras (data, not chrome)
3. **Multi-tab overwrite** — mitigated via dirty baseline; not a full CRDT
4. **TipTap HTML parse** — hydrate covers leftover `[[…]]`; ideal path is spans parsing on first `setContent` without hydrate
5. **Mobile visual QA** — device metrics override was flaky in automation; layout code is in place — worth a quick real-device check

---

## Loop status

Self-paced `/loop` was used for repeated screenshot → fix cycles. Stop with an explicit **stop** request (kills sleeper PID; does not re-arm).

---

## How to verify quickly

```bash
npm run dev
# open http://localhost:5173/
```

1. Open Welcome — links show as underlined wiki text (not `[[brackets]]`); Context → Links lists them  
2. Header → Graph — Atlas shows nodes within ~1s  
3. Narrow the window below ~768px — sidebar becomes overlay; picking a note closes it  
4. Dump / Settings / ⌘K — Escape closes; focus stays in overlay  
5. Change page icon — Lucide grid searchable  
