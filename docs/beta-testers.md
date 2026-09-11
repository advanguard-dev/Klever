# Klever closed beta — tester brief

Thank you for trying Klever before a wider release. This build is an invited **private beta** for **Apple silicon** Macs.

## Requirements

- macOS on Apple silicon (M1 / M2 / M3 / M4 …)
- About 300 MB free for the app

Intel Macs, Windows, and Linux are not supported in this beta.

## Install

1. Unzip `Klever-0.1.0-beta.1-arm64.zip`.
2. Double-click **Install Klever.command** (clears Gatekeeper quarantine and copies the app to Applications).
3. Or drag **Klever.app** into **Applications**, then launch it.

### Gatekeeper (unsigned build)

This beta is **not** Developer ID–signed or notarized. macOS may block the first open or claim the app is **damaged**. That is expected, not a corrupt download.

**Preferred:** double-click **Install Klever.command**. If macOS blocks the script, Control-click it → **Open**.

**From Applications:** Control-click **Klever** → **Open** → confirm **Open**.

```bash
xattr -cr /Applications/Klever.app
```

## First run

On the welcome screen:

1. Prefer **Open sample vault** — fastest way to see notes, databases, graph, and boards.
2. Later, use **Open folder** to point Klever at your own Markdown folder (Obsidian-style vaults work).
3. **Start empty** creates a blank workspace.

Shortcuts are listed on the welcome screen (⌘K search, ⌘E block/present, ⌘⇧T today’s note, etc.).

## AI

- New workspaces default to **local** AI (heuristics + on-device speech). Core editing works with **no API key**.
- To use remote models (writing tools, remote Brain Dump / meeting polish), set workspace AI to **remote** in workspace settings and provide a DeepSeek key for the desktop app (see `.env.example` in the repo — key is loaded by Electron only, never shipped in the web client).

## What to report

Please reply to your invite or [open a GitHub issue](https://github.com/advanguard-dev/Klever/issues/new) with:

- Crashes or freezes
- Data loss, wrong saves, or clobbered notes
- Editor, database, board, graph, or calendar bugs
- macOS version + chip (e.g. Sequoia 15.x, M2)

Include steps to reproduce when you can. Screenshots help.

## Known limits

- Unsigned / unnotarized — Gatekeeper steps above are expected
- No auto-update — you get a new zip when we ship one
- Apple silicon only
- Multi-tab editing is not CRDT-merged; avoid editing the same note in two windows at once
- Encrypted workspaces stay inside Klever (not a plain folder on disk)
- Optional calendar sync talks to **your** calendars, not a Klever cloud

## Privacy (short)

Your notes stay in a folder on your Mac. There is no Klever account or Klever cloud sync. Remote AI only sends text you choose when a workspace is set to remote mode. See the Privacy section on the marketing site for the full note.
