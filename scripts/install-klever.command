#!/bin/bash
# Drop this next to Klever.app (same folder as the unzipped beta).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
osascript -e 'quit app "Klever"' 2>/dev/null || true
sleep 1
ditto "$DIR/Klever.app" /Applications/Klever.app
xattr -cr /Applications/Klever.app
codesign --force --deep --sign - /Applications/Klever.app
open -a Klever
echo "Klever is installed in Applications."
