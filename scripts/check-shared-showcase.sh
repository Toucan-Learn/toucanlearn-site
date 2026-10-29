#!/usr/bin/env bash
# Run in website-codex-spin. No downloads or added dependencies.
# Claude's first terminal: python3 -m http.server 4206 --bind 127.0.0.1
# Claude's second terminal: BASE_URL=http://127.0.0.1:4206 bash scripts/check-shared-showcase.sh
# Browser-free only: bash scripts/check-shared-showcase.sh --source-only
set -euo pipefail
cd "$(dirname "$0")/.."
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [ -z "$NODE_BIN" ]; then
  NODE_BIN=/Users/joshuagordonjones/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
fi
PIANO_RESULTS="${PIANO_OUTPUT:-/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/outputs/drink-spin-20261028/piano}"
PIANO_OUTPUT="$PIANO_RESULTS" "$NODE_BIN" --experimental-vm-modules tests/hero-piano-source.mjs
"$NODE_BIN" --experimental-vm-modules tests/hero-lifecycle-source.mjs
"$NODE_BIN" tests/project-showcase-source.mjs
if [ "${1:-}" = --source-only ]; then exit 0; fi
: "${BASE_URL:?Claude must serve website-codex-spin and set BASE_URL before running browser checks}"
export BASE_URL
"$NODE_BIN" tests/piano-toggle.mjs
if [ "${1:-}" = --toggle-only ]; then exit 0; fi
"$NODE_BIN" tests/project-showcase.mjs
PIANO_PAGE=index.html PIANO_OUTPUT="$PIANO_RESULTS/home" "$NODE_BIN" tests/hero-piano.mjs
PIANO_PAGE=children.html PIANO_OUTPUT="$PIANO_RESULTS/projects" "$NODE_BIN" tests/hero-piano.mjs
