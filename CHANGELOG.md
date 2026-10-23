# Changelog

## 1.1.0

- Restore path highlighting in Obsidian 1.15, which draws Mermaid diagrams with Pele instead of Mermaid.js. The plugin hooks Pele’s `mount` and marks nodes and connectors in every drawing, including redraws for a new width. LR/RL diagrams that Pele turns into TB for a narrow note keep correct return edges.
- Lay out Pele flowcharts with the plugin’s compact spacing, label wrapping, and orthogonal rounded connectors by passing these settings to Pele; a diagram’s own configuration still wins. The Compact layout setting applies to both renderers.
- Apply the plugin’s light and dark palettes, shadows, and highlight colors to Pele flowcharts from their first frame. Opted-out and non-flowchart diagrams keep Obsidian’s rendering.
- Fix path highlighting in popout windows for both renderers: each window gets its own events and path controller.
- Keep Obsidian 1.14’s Mermaid.js rendering and layout adjustments unchanged. `%% mfe:off` and every setting apply to both renderers.
- Let Docker checks load an Obsidian update file (`OBSIDIAN_ASAR`), such as an early-access build, on the image’s installer. The checks detect the renderer and also cover connector hover, fading, clearing, the palette, popout windows, Pele’s orthogonal connectors, and the opt-out comment.
- Add Pele 1.8.0, the version bundled with Obsidian 1.15.0, as a development dependency for browser tests.

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
