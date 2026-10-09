# Changelog

## 1.0.1

- Publish only the three Obsidian plugin assets; keep VirusTotal results in release notes, workflow artifacts, and public documentation.
- Schedule and cancel highlight timers through each diagram’s owning window, including popouts.
- Explicitly type DOM narrowing and text replacement callbacks; create measurement canvases with Obsidian’s DOM helper.
- Wrap registered controller callbacks to preserve their receiver.
- Make all four settings searchable through Obsidian’s declarative settings API and remove the deprecated slider tooltip.
- Add regression coverage for timer window ownership and searchable settings persistence, plus real Obsidian settings rendering.

## 1.0.0

- Publish the first release without the beta designation.
- Replace all `!important` CSS overrides with enhanced-SVG selector specificity while preserving theme colors, path highlighting, reduced motion, and print resets.
- Migrate the plugin and developer tooling to strict TypeScript.
- Add code, CSS, workflow, and shell linters; prevent new `!important` declarations.
- Gate publication on completed VirusTotal scans and GitHub artifact attestations.
- Add isolated Docker checks and recordings in real Obsidian, with a single-screen grocery delivery demonstration.
- Cache CI tools and browser downloads, and use English throughout the interface and documentation.
- Pass 34 unit tests and 14 browser integration tests; verify both themes in real Linux Obsidian 1.14.4.

## 0.1.2 (beta)

- Refine the dark theme with slate-blue surfaces, clear text, softer shadows, and restrained path accents. Decision nodes share the same palette as other nodes.
- Attach connectors to the centers of node sides, with smaller arrowheads anchored at the boundary.
- Simplify return routes in horizontal and vertical flowcharts while preserving rounded corners and aligned branch labels.

## 0.1.1 (beta)

- Scope styling directly to enhanced SVGs instead of using `:has()` selectors.
- Keep light/dark colors, hover transitions, print, and normal Mermaid isolation intact.
- Add GitHub build provenance attestations for release assets.
- Publish the Obsidian Community listing and use directory-discoverable GitHub releases.

## 0.1.0 (beta)

- Initial beta release of the Obsidian Mermaid Flow Enhancer.
- Adds compact flowchart layout adjustments, aligned decision branches, rounded orthogonal connectors, and ancestor path highlighting.
- Prevents Obsidian’s native dark-mode SVG inversion from reversing the plugin’s theme colors.
- Adds demo diagrams and automated unit and browser integration checks.
- External user testing and Obsidian Community plugins directory submission are pending.
