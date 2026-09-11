#!/usr/bin/env bash
# Package Klever as a zip of Klever.app (Apple silicon).
# Avoids npm run build:dmg: no tsc, no Vite 8 / Rolldown, no hdiutil.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
PACK_TOOLS="$ROOT/scripts/pack-tools"
APP="$ROOT/release/mac-arm64/Klever.app"
ZIP="$ROOT/release/Klever-${VERSION}-arm64.zip"

cd "$ROOT"
export PATH="${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "==> icon"
bash "$ROOT/scripts/build-icon.sh"

echo "==> renderer (Vite 7 / Rollup)"
if [[ ! -x "$PACK_TOOLS/node_modules/.bin/vite" ]]; then
  echo "Installing pack-tools (Vite 7)…"
  npm install --prefix "$PACK_TOOLS"
fi
"$PACK_TOOLS/node_modules/.bin/vite" build --config "$PACK_TOOLS/vite.config.mjs"

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "Renderer build did not produce dist/index.html" >&2
  exit 1
fi

echo "==> app bundle"
bash "$ROOT/scripts/build-app.sh"

if [[ ! -d "$APP" ]]; then
  echo "Missing app bundle: $APP" >&2
  exit 1
fi

echo "==> zip (ditto, preserves resource forks)"
xattr -cr "$APP" 2>/dev/null || true
WRAP="$ROOT/release/Klever-${VERSION}-arm64"
rm -rf "$WRAP" "$ZIP"
mkdir -p "$WRAP"
ditto "$APP" "$WRAP/Klever.app"
cp "$ROOT/scripts/install-klever.command" "$WRAP/Install Klever.command"
chmod +x "$WRAP/Install Klever.command"
ditto -c -k --keepParent "$WRAP" "$ZIP"
rm -rf "$WRAP"

echo "Created $ZIP"
ls -lh "$ZIP" "$APP"
