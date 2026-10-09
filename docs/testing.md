# Development and testing

## Requirements

Use Node.js 22.13 or later and npm. Install the exact dependency versions from the lockfile:

```sh
npm ci
```

## Checks

```sh
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:integration
npm run build
```

`npm test` runs the Node test runner against `tests/unit/*.test.js`. The browser suite is run by Playwright and exercises the plugin's Mermaid output in Chromium. `npm run build` creates the distributable `main.js` at the project root. Keep generated output out of version control unless the release process explicitly attaches it.

See [code linting](linting.md) for individual linters and automatic fixes. `npm run check` runs all linters, tests, and the build.

Continuous integration runs the same install, lint, test, browser setup, integration test, and build steps on pushes and pull requests. If a browser test fails locally, inspect `playwright-report/` and `test-results/` before changing expected output.

## Manual Obsidian check

For a release candidate, copy `main.js`, `manifest.json`, and `styles.css` into a disposable vault's `.obsidian/plugins/mermaid-flow-enhancer/`, enable the plugin, and open the examples in `demo-vault/`. Check light and dark themes, keyboard focus, pointer movement between nodes and connectors, an opted-out diagram, and a larger generated fixture. This manual pass complements CI; it does not replace testing on the Obsidian versions and devices used by beta testers.

## Release workflow

Create a Git tag whose name exactly matches `manifest.json`'s `version` value, without a leading `v` (for example, `0.1.0`). The release workflow builds the plugin and attaches `main.js`, `manifest.json`, and `styles.css` to the GitHub release. Update `versions.json` and `CHANGELOG.md` before tagging.

## Initial desktop beta evidence

On 2026-10-09, Node.js 22.16.0 passed 17 unit tests, 11 Chromium integration tests, and the esbuild build. GitHub Actions also passed for revision `6b025ac`. The integration suite exercises the actual Mermaid SVG, all supported flowchart directions, Unicode/underscore IDs, cycles, a subgraph with converging branches, unequal sibling boundaries, hover timers, opt-out geometry preservation, print, reduced motion, and computed text/connector contrast in both themes, and isolation from Obsidian’s native dark-mode inversion filter.

The plugin was enabled in a clean Obsidian 1.14.2 vault on macOS. Its settings and enable/disable behavior worked; enhanced SVG rendering and light/dark screenshots were confirmed. This is desktop evidence only. Mobile devices, third-party plugin combinations, complex nested subgraphs, external beta feedback, and full upgrade/rollback testing remain open. Browser-stand timings for synthetic 100/300-node graphs are in [the performance report](assets/browser-preview-performance.md); they are not Obsidian timing measurements.

## Directory review and 0.1.1

The directory completed its 0.1.0 release scan without errors and reproduced `main.js` byte-for-byte. Its CSS warnings identified `:has()` and `!important`; its release recommendation requested artifact attestations. Version 0.1.1 removes `:has()` by scoping directly to enhanced SVG roots and adds GitHub provenance attestations. Scoped `!important` remains necessary to override Mermaid’s generated SVG ID rules and Obsidian’s native dark filter.

For 0.1.1, 17 unit tests and 12 Chromium tests pass. The additional browser test checks actual faded opacity and highlighted strokes, including isolation from regular Mermaid SVGs.
