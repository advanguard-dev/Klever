# Changelog

All notable changes to Klever are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0-beta.1] — 2026-09-11

Closed Mac (Apple silicon) beta for invited testers. Marketing site collects beta requests; builds are distributed privately (unsigned).

### Added

- **Present** mode — viewer flag (not an editor mode); leave with Esc / Write after the body is flushed
- Page **split** — corner drop, split-session boundaries, and page-cut dialog that keeps body without duplicating on save
- Board **spreadsheet tables** — multi-cell and single-cell formula insert, style patches, table studio
- **Relations** — relate dialog with optional wiki link while the editor is dirty
- **Starters** insert menu and apply-starter pipeline
- Focus-visible rings (`.klever-focus` / `.klever-focus-solid`) on UI primitives
- Overlay Escape, focus trap, and `aria-labelledby`
- Lucide page icons (`lucide:{name}`) with icon chooser
- Confirm dialogs for destructive property / note / view actions
- Welcome landing soft radial paper atmosphere
- Mobile sidebar overlay (≤767px) with backdrop dismiss and auto-close on navigate
- Graph “Here” peer section collapses to a count when many tabs share a page
- **Moonshine** on-device speech-to-text for Brain dump (`@moonshine-ai/moonshine-wasm`), with download progress and Web Speech fallback
- Marketing privacy note; **Request beta access** CTA (GitHub issue) instead of a public Download
- Closed-beta tester brief, invite template, and zip pack with `Install Klever.command`

### Changed

- New workspaces default to **local** AI so beta works without an API key
- “Open orchard” graph fixture is DEV-only on Welcome
- Database view-tab move chevrons appear on hover only; Settings label shortened on small widths
- Context rail toggle hidden below `md`
- StarterKit link extension disabled in block editor to avoid fighting wiki marks
- Desktop pack uses Vite 7 (Rollup) via `scripts/pack-tools` to avoid Vite 8 / Rolldown hangs; bundles are adhoc-signed so Gatekeeper does not claim they are damaged

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

### Known limits (beta)

- Desktop build is **unsigned / unnotarized** — Gatekeeper requires right-click Open or `xattr -cr`
- **Apple silicon only** — no Intel Mac, Windows, or Linux builds
- No auto-update; testers receive a new zip when one ships
- Multi-tab editing is not CRDT-merged
- Encrypted workspaces stay inside Klever (not a plain folder on disk)
- Corrupted Welcome bodies from older TipTap round-trips may still show a bad leading `h3` until sample vault is reopened
- Duplicate database view tabs remain if the user created them (data, not chrome)
- Prefer native TipTap HTML parse of wiki spans so hydrate is only a fallback
- Real-device mobile pass still recommended

### Docs

- `UI_UX_FIX_REPORT.md` — full screenshot pass notes and verify checklist (2026-08-15)
- `docs/beta-testers.md`, `docs/beta-invite.md` — closed beta handoff
