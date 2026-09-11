#!/usr/bin/env bash
# Install Klever.app to /Applications (unsigned adhoc build).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/release/mac-arm64/Klever.app}"
DEST="/Applications/Klever.app"

if [[ ! -d "$SRC" ]]; then
  echo "Missing app bundle: $SRC" >&2
  echo "Build first: npm run build:zip" >&2
  exit 1
fi

osascript -e 'quit app "Klever"' 2>/dev/null || true
sleep 1
pkill -x Klever 2>/dev/null || true
sleep 0.5

rm -rf "$DEST"
ditto "$SRC" "$DEST"
xattr -cr "$DEST"
codesign --force --deep --sign - "$DEST"

echo "Installed $DEST"
open -a Klever
