# Obsidian Docker capture report

Captured on 2026-10-09 using real Linux ARM64 Obsidian 1.14.4 and Mermaid Flow Enhancer 0.1.2 inside Docker (Colima). The disposable vault contains only the synthetic Demo.md fixture. No host Obsidian window, personal vault, configuration, or account was used. Runtime network access was disabled.

The Docker run passed all 20 unit tests, 14 browser integration tests, the production build, and application smoke checks. The real app rendered 8 nodes; all 18 connector endpoints attach to shape-side midpoints (maximum measured deviation 0.0000610 CSS px). Hovering Release highlighted its ancestor path. Both light and dark palettes were checked; page errors: none.

FFmpeg recorded the container's Xvfb screen at 1440 × 1000, 30 fps: 15.2 seconds and 456 frames. The GIF is a 960-pixel-wide, 12 fps conversion. Representative light and dark video frames were visually checked: the diagram and hover highlighting are visible without the Settings popup covering the scene. PNG screenshots came from the same application's DevTools connection.

Reproduce with `npm run docker:record`; generated artifacts and the machine-readable report are under `artifacts/docker/`. The historical browser-only media use a separate test stand. This Linux smoke check does not establish macOS, Windows, or mobile compatibility.
