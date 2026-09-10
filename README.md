# Klever

Local-first markdown vault — pages, databases, boards, and calendar on your disk.

> A note you cannot open in a text editor is a hostage.

Klever keeps your knowledge as **plain Markdown + YAML** files. TipTap and CodeMirror edit them; nothing is locked in a proprietary block AST. Optional AI is opt-in. There is no Klever cloud account.

**License:** [Apache-2.0](LICENSE)

## Quick start

```bash
npm install
npm run dev          # Vite UI (browser / File System Access)
# or
npm run build:web && npm run dev:app   # Electron desktop
```

## Vault layout

Point Klever at a folder. Typical files:

- `Welcome.md` — page with YAML frontmatter + body
- `Projects.database.md` — database schema + views in frontmatter; rows are child pages with `parent:`
- Folders nest freely; wikilinks use `[[Page]]`

Same files work in Obsidian, git, and any text editor.

## What we build (local-first)

- Rich Markdown: code highlighting, Mermaid diagrams, KaTeX
- Notion-like databases: typed props, relations, rollups, formulas, multi-views (table, board, calendar, timeline…)
- Nested AND/OR filters, local CLI / localhost API, on-device semantic search (opt-in)
- Workspace lock (AES-GCM) + Touch ID on desktop

## What we will not build

- Klever cloud accounts, multi-tenant hosting
- SSO / SAML / SCIM enterprise IAM
- Realtime CRDT multi-user editing (collab = git + shared folders)
- Replacing Markdown with a proprietary block store

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite app |
| `npm run build` | Typecheck + production web bundle |
| `npm run build:beta` | Packaged macOS app |
| `npm run klever` | CLI against a vault path (after install) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By submitting a pull request, you agree that your contribution is licensed under Apache-2.0.

## Links

- Source: https://github.com/advanguard-dev/Klever
- Releases: https://github.com/advanguard-dev/Klever/releases
