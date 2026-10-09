# Code linting

Use Node.js 22.13 or later, then `npm ci`.

```sh
npm run lint          # All four linters
npm run lint:js       # JavaScript source, tests, and scripts
npm run lint:css      # Authored plugin and demo styles
npm run lint:workflows # GitHub Actions, including inline shell scripts
npm run lint:shell    # Docker entrypoint
npm run lint:fix      # Safe automatic JavaScript and CSS fixes; review the diff
npm run check         # Lint, unit tests, browser tests, and build
```

ESLint and Stylelint are pinned in the npm lockfile. Generated bundles, recordings, dependencies, and disposable vaults are excluded from ESLint. Stylelint checks only the two named authored stylesheets. Mermaid's case-sensitive SVG class names are explicitly allowed; other standard CSS checks remain enabled.

The native runner downloads actionlint 1.7.11 and ShellCheck 0.11.0 from their official GitHub releases on first use, verifies pinned SHA-256 checksums, and caches them under `node_modules/.cache/lint-tools/`. macOS and Linux support both x64 and arm64. Windows developers can use `npm run docker:check`. First installation requires network access; Docker preinstalls both tools while building, then runs checks and Obsidian with networking disabled.

CI and release workflows run `npm run lint` before tests and builds. Lint failures prevent release publication. These development tools are not included in the plugin bundle.

## Dependency audit note

Stylelint's glob dependency currently includes braces 3.0.3, affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), with no upstream patched release available when checked on 2026-10-09. The issue requires a deeply nested glob pattern. Our CSS command supplies fixed filenames rather than user-provided patterns; keep that restriction when extending the command. Do not downgrade Stylelint through `npm audit fix --force` to hide the warning. Recheck the advisory when updating tooling. This dependency is used only during development.
