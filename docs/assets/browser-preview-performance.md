# Browser preview performance sample

Measured in headless Chromium while rendering and applying the plugin layout transform to synthetic linear Mermaid flowcharts.
This is a directional fixture measurement, not an Obsidian or user-device benchmark.

| Nodes | Edges | Render + transform (ms) | Enhanced SVG (bytes) |
|---:|---:|---:|---:|
| 100 | 99 | 200.6 | 111835 |
| 300 | 299 | 480.4 | 318832 |
