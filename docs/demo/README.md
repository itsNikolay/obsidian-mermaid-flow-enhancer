# Browser preview stand

This is a reproducible browser preview of Mermaid Flow Enhancer behavior. It is explicitly **not an Obsidian recording**. The fixture bundles the real `src/layout.ts`, `src/highlight.ts`, and `styles.css`, then uses Mermaid in headless Chromium.

Regenerate the browser-preview GIFs, MP4, theme screenshots, print PDF, and node-count timing sample with:

```sh
npx tsx scripts/record-demo.mts
```

The script expects the project dependencies installed with `npm ci` in the repository, Playwright Chromium, and `ffmpeg`. It uses the Playwright browser when installed; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point to another Chromium binary. It creates the browser bundle at `docs/demo/demo.js` and media under `docs/assets/`; the generated bundle and temporary recordings are ignored by Git.

The timings in `docs/assets/browser-preview-performance.md` cover Mermaid rendering plus the plugin layout transform for synthetic linear diagrams in this Chromium run. They do not measure Obsidian or user-device performance.
