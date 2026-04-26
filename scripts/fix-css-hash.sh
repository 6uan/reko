#!/usr/bin/env bash
#
# fix-css-hash.sh — Ensure the CSS filename the server bundle references
# actually exists in dist/client/assets/.
#
# TailwindCSS v4's Vite plugin can produce different CSS content (and thus
# different content hashes) in the client vs server builds.  The client
# build writes the real CSS file; the server build bakes a potentially
# stale hash into the SSR HTML.  This script copies the real CSS file
# to the filename the server expects so the browser never gets a 404.

set -euo pipefail

SERVER_DIR="dist/server"
CLIENT_ASSETS="dist/client/assets"

# 1. Find the CSS filename the server bundle references
SERVER_CSS=$(grep -roh '/assets/styles-[^"]*\.css' "$SERVER_DIR" | head -1)
if [ -z "$SERVER_CSS" ]; then
  echo "[fix-css-hash] No CSS reference found in server bundle — skipping."
  exit 0
fi
SERVER_FILE="$CLIENT_ASSETS/$(basename "$SERVER_CSS")"

# 2. Find the actual CSS file in the client output
CLIENT_CSS=$(ls "$CLIENT_ASSETS"/styles-*.css 2>/dev/null | head -1)
if [ -z "$CLIENT_CSS" ]; then
  echo "[fix-css-hash] No CSS file found in $CLIENT_ASSETS — skipping."
  exit 0
fi

# 3. If they already match, nothing to do
if [ "$SERVER_FILE" = "$CLIENT_CSS" ]; then
  echo "[fix-css-hash] Hashes match — no fix needed."
  exit 0
fi

# 4. Copy the real CSS under the name the server expects
cp "$CLIENT_CSS" "$SERVER_FILE"
echo "[fix-css-hash] Copied $(basename "$CLIENT_CSS") → $(basename "$SERVER_FILE")"
