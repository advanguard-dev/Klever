# Contributing to Klever

Thanks for helping grow a local-first, open markdown vault.

## Principles

1. **Files over databases** — features must round-trip through Markdown/YAML when they represent note content.
2. **No Klever cloud** — no accounts, SSO, or hosted sync in core.
3. **Ease of use** — prefer zero-config UX (slash commands, previews) over power-user-only surfaces.

## Setup

```bash
npm install
npm run dev
```

Typecheck before opening a PR:

```bash
npx tsc --noEmit
```

## Pull requests

- Keep diffs focused; match existing TypeScript / Tailwind style.
- Document user-facing changes in `CHANGELOG.md` when relevant.
- Contributions are licensed under the Apache License 2.0 (see `LICENSE`).

## Code of conduct

Be respectful. Assume good intent. No harassment.
