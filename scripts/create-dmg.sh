#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
APP="$ROOT/release/mac-arm64/Klever.app"
DMG="$ROOT/release/Klever-${VERSION}-arm64.dmg"
STAGING="$ROOT/release/dmg-staging"

if [[ ! -d "$APP" ]]; then
  echo "Missing app bundle: $APP" >&2
  echo "Run: npm run build:beta" >&2
  exit 1
fi

rm -rf "$STAGING" "$DMG"
mkdir -p "$STAGING"
ditto "$APP" "$STAGING/Klever.app"
ln -s /Applications "$STAGING/Applications"

hdiutil create \
  -volname "Klever ${VERSION}" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  "$DMG"

rm -rf "$STAGING"
echo "Created $DMG"
