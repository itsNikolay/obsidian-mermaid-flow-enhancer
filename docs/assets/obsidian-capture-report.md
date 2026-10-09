# Obsidian app capture report

Captured from the real Obsidian app, vault `mermaid-flow-enhancer-demo`, with the community plugin enabled. The note at `Examples/Release flow.md` is a synthetic fixture created by the recorder.
Frames came from the official `obsidian dev:screenshot` command. Pointer movement used `Input.dispatchMouseEvent` through `obsidian dev:cdp`.
The first dark-theme capture exposed Obsidian's native Mermaid inversion filter on the enhanced SVG. The plugin CSS fix now disables that filter only for the enhanced SVG; the verified dark values are {"dark":true,"fill":"rgb(40, 40, 40)","text":"rgb(218, 218, 218)","line":"rgb(179, 189, 202)","svgFilter":"none"}.

The path GIF uses 10 real screenshots over about 8.8 s. The MP4 uses 18 screenshots over about 14.5 s (average 1.24 screenshots/s; observed capture intervals 483-2800 ms). The MP4 preserves those recorded intervals. Screenshot sampling is not a high-frame-rate screen recording, so the clip shows genuine app states but does not reproduce each 450 ms transition at full display refresh.

No errors were reported by `obsidian dev:errors` after capture.

The path GIF is 0.07 MiB. The actual-app MP4 is 0.17 MiB and spans about 14.5 seconds.

This is a smoke recording from one Obsidian build, theme setup, and machine; it is not a cross-version compatibility or performance benchmark.
