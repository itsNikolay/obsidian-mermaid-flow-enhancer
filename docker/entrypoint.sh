#!/usr/bin/env bash
set -euo pipefail
Xvfb :99 -screen 0 1440x1000x24 -ac -nolisten tcp > /tmp/xvfb.log 2>&1 &
trap 'kill $(jobs -pr) 2>/dev/null || true' EXIT
for attempt in {1..30}; do [ -S /tmp/.X11-unix/X99 ] && break; sleep 0.1; done
npm run check
node scripts/test-obsidian-docker.mjs "${1:-check}"
