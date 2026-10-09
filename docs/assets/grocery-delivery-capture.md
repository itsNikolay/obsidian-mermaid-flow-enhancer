# Single-screen grocery delivery demonstration

Recorded on 2026-10-09 in real Linux ARM64 Obsidian 1.14.4 with Mermaid Flow Enhancer 0.1.2, inside Docker/Xvfb. The vault contains only the synthetic [grocery-delivery example](../../demo-vault/Examples/grocery-delivery.md). The host Obsidian application was not opened.

The flowchart has 17 nodes, 22 connections, and six shapes: rounded terminals, rectangles, diamonds, parallelograms, cylinders, and hexagons. It includes parallel address/time entry, two return loops, payment and delivery alternatives, saved basket/order data, a receipt, and dotted notifications. The entire diagram fits on the 1440 × 1000 virtual screen; its screen bounds are asserted before recording. Sidebars are collapsed and the capture stylesheet caps diagram height at 740 pixels. No scrolling or edits to the diagram occur during the tour.

[MP4](grocery-delivery.mp4): 40.53 seconds, 1440 × 1000 at 30 fps. [GIF](grocery-delivery.gif): 960 pixels wide at 12 fps. The recording shows node and connector hovering, ancestor-path highlighting, fading, and light/dark themes. Representative frames from both themes were visually inspected.

All four linters, 34 unit tests, 14 browser integration tests, and the build passed in the container. Real-app assertions verified the node/connection counts, highlighted each toured node, checked ancestors of the final node, and confirmed both theme palettes. No page errors were captured. See the [machine-readable report](grocery-delivery-report.json).

The report's distance-to-bounding-box-center metric is diagnostic for this mixed-shape example, not proof that every endpoint docks at a bounding-box center. The smaller smoke fixture retains its strict centered-docking check. This demo does not establish support for every Mermaid shape or mobile device.

Reproduce with `npm run docker:record`.
