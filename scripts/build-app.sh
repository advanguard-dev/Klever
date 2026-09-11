#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OUT="$ROOT/release"

cd "$ROOT"

if [[ ! -d "$ROOT/dist/index.html" && ! -f "$ROOT/dist/index.html" ]]; then
  echo "Missing web build. Run: npm run build:web" >&2
  exit 1
fi

# Numbered leftovers (Klever 2.app …) keep bundle id com.klever.app and steal
# `open -a Klever` / Dock / Spotlight away from /Applications/Klever.app.
rm -rf "$OUT"/Klever-darwin-arm64 "$OUT"/mac-arm64/Klever.app
rm -rf "$OUT"/mac-arm64/Klever\ *.app "$OUT"/Klever-darwin-arm64/Klever\ *.app

# Keep only the Vite renderer, Electron process, and package.json.
# Path-segment `src` (not substring) so dist/assets/src-*.js shiki chunks ship.
IGNORE='(^|/)(node_modules|src|web|docs|scripts|cli|release|build|public|\.git|\.cursor|\.agents|\.qa)(/|$)'
IGNORE+='|\.(md|map)$'
IGNORE+='|(^|/)(tsconfig.*|vite\.config\.ts|index\.html|package-lock\.json|skills-lock\.json|\.npmrc|\.nvmrc|\.gitignore)$'

npx --yes @electron/packager@18.3.6 "$ROOT" Klever \
  --platform=darwin \
  --arch=arm64 \
  --out="$OUT" \
  --overwrite \
  --icon="$ROOT/build/icon.icns" \
  --app-bundle-id=com.klever.app \
  --app-version="$VERSION" \
  --build-version="$VERSION" \
  --extend-info="$ROOT/build/info.plist" \
  --ignore="$IGNORE" \
  --prune=true

APP="$OUT/Klever-darwin-arm64/Klever.app"
if [[ ! -d "$APP" ]]; then
  echo "Packaging failed — app not found at $APP" >&2
  exit 1
fi

mkdir -p "$OUT/mac-arm64"
rm -rf "$OUT/mac-arm64/Klever.app"
ditto "$APP" "$OUT/mac-arm64/Klever.app"

echo "Packaged $OUT/mac-arm64/Klever.app"
