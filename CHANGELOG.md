# Changelog

All notable changes to Klever are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- Blank screen when opening Graph or after HMR — `RightRail` no longer calls hooks after early returns
- Empty Graph canvas — force layout seeds ticks immediately; graph uses viewport height instead of a zero-height flex child
- Property manager overlay crash from broken JSX during confirm-dialog refactor
- Black-on-black solid buttons — base `button { color: inherit }` stays in `@layer base` so `text-paper` applies
- Square outline chrome on toolbar / icon buttons — hover is fill-only
- Context Links smashed into one line (`ProjectsPeopleAtlas`) — links stack as a column
- Context Links empty despite `[[wikilinks]]` in the editor — live read of `[data-wiki]` and editor text
- TipTap showing literal `[[Principles]]` instead of wiki marks — `hydrateWikiMarks()` after markdown→HTML load
- Low-contrast mute text — light theme `--color-mute` set to `#5f5a52`
- Crowded header — toolbar actions are icon-only with tooltips / screen-reader labels
- Sidebar clutter — empty `Untitled` / `New database` drafts hidden from tree and recents
- Property delete no longer instant — uses `ConfirmDialog`
- Multi-tab note clobber reduced via dirty/baseline sync on NotePage

### Added

- Focus-visible rings (`.klever-focus` / `.klever-focus-solid`) on UI primitives
- Overlay Escape, focus trap, and `aria-labelledby`
- Lucide page icons (`lucide:{name}`) with icon chooser
- Confirm dialogs for destructive property / note / view actions
- Welcome landing soft radial paper atmosphere
- Mobile sidebar overlay (≤767px) with backdrop dismiss and auto-close on navigate
- Graph “Here” peer section collapses to a count when many tabs share a page
- **Moonshine** on-device speech-to-text for Brain dump (`@moonshine-ai/moonshine-wasm`), with download progress and Web Speech fallback

### Changed

- Database view-tab move chevrons appear on hover only; Settings label shortened on small widths
- Context rail toggle hidden below `md`
- StarterKit link extension disabled in block editor to avoid fighting wiki marks

### Known issues

- Corrupted Welcome bodies from older TipTap round-trips may still show a bad leading `h3` until sample vault is reopened
- Duplicate database view tabs remain if the user created them (data, not chrome)
- Multi-tab editing is not CRDT-merged
- Prefer native TipTap HTML parse of wiki spans so hydrate is only a fallback
- Real-device mobile pass still recommended

### Docs

- `UI_UX_FIX_REPORT.md` — full screenshot pass notes and verify checklist (2026-08-15)
