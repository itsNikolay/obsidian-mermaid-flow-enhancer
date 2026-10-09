# Obsidian app capture report

The light and dark screenshots show plugin 0.1.2 in real Obsidian 1.14.2, using the clean `mermaid-flow-enhancer-demo` vault and synthetic `Examples/Release flow.md` fixture. Frames came from the official `obsidian dev:screenshot` command.

Live SVG verification measured 9 edges: all 18 endpoints attach to shape-side midpoints, with maximum deviation below 0.001 CSS px. All referenced arrow markers are 8 × 8. The dark enhanced SVG has no inversion filter. Screenshots were visually checked in both themes.

The GIF and MP4 remain recordings of plugin 0.1.0. Pointer movement used `Input.dispatchMouseEvent` through `obsidian dev:cdp`. The GIF uses 10 real screenshots over about 8.8 seconds; the MP4 uses 18 over about 14.5 seconds and preserves their recorded intervals. Screenshot sampling does not reproduce every animation frame at full display refresh. The GIF is 0.07 MiB and MP4 is 0.17 MiB.

The recorder now removes an existing screenshot destination before capture and verifies centered endpoints and marker size. A fresh diagram render is required after upgrading because Obsidian can retain cached Mermaid SVGs.

No errors were reported by `obsidian dev:errors` after plugin verification. This is a smoke check from one Obsidian build, theme setup, and machine, not a cross-version compatibility or performance benchmark.
