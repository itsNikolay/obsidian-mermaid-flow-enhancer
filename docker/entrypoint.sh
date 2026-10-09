#!/usr/bin/env bash
set -euo pipefail
Xvfb :99 -screen 0 1440x1000x24 -ac -nolisten tcp > /tmp/xvfb.log 2>&1 &
display_pid=$!
trap 'kill "$display_pid" 2>/dev/null || true' EXIT
for _attempt in {1..30}; do [ -S /tmp/.X11-unix/X99 ] && break; sleep 0.1; done
npm run check
npx tsx scripts/test-obsidian-docker.mts "${1:-check}"
