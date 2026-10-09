# Development and testing

## Requirements

Use a current Node.js LTS release and npm. Install the exact dependency versions from the lockfile:

```sh
npm ci
```

## Checks

```sh
npm test
npx playwright install --with-deps chromium
npm run test:integration
npm run build
```

`npm test` runs the Node test runner against `tests/unit/*.test.js`. The browser suite is run by Playwright and exercises the plugin's Mermaid output in Chromium. `npm run build` creates the distributable `main.js` at the project root. Keep generated output out of version control unless the release process explicitly attaches it.

Continuous integration runs the same install, test, browser setup, integration test, and build steps on pushes and pull requests. If a browser test fails locally, inspect `playwright-report/` and `test-results/` before changing expected output.

## Manual Obsidian check

For a release candidate, copy `main.js`, `manifest.json`, and `styles.css` into a disposable vault's `.obsidian/plugins/mermaid-flow-enhancer/`, enable the plugin, and open the examples in `demo-vault/`. Check light and dark themes, keyboard focus, pointer movement between nodes and connectors, an opted-out diagram, and a larger generated fixture. This manual pass complements CI; it does not replace testing on the Obsidian versions and devices used by beta testers.

## Release workflow

Create a Git tag whose name exactly matches `manifest.json`'s `version` value, without a leading `v` (for example, `0.1.0-beta.1`). The release workflow builds the plugin and attaches `main.js`, `manifest.json`, and `styles.css` to the GitHub release. Update `versions.json` and `CHANGELOG.md` before tagging.
