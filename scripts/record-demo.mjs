import { createRequire } from "node:module";
import { readFile, mkdir, stat, unlink, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageRoot = "/Users/nikolayponomarev/projects/itsNikolay/vimwiki/Projects/obsidian-mermaid-flow-enhancer";
const require = createRequire(join(packageRoot, "package.json"));
const esbuild = require("esbuild");
const { chromium } = require("playwright");
const out = join(here, "docs/assets");
const generated = join(here, "docs/demo/demo.js");
const cachedChromium = "/Users/nikolayponomarev/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync(chromium.executablePath()) ? chromium.executablePath() : cachedChromium);
await mkdir(out, { recursive: true });
for (const file of await readdir(out)) if (file.endsWith(".webm")) await unlink(join(out, file));
await esbuild.build({ entryPoints: [join(here, "scripts/demo-entry.js")], outfile: generated,
  bundle: true, platform: "browser", format: "iife", target: "chrome120",
  nodePaths: [join(packageRoot, "node_modules")],
  loader: { ".css": "text" }, define: { "process.env.NODE_ENV": '"production"' },
  minify: true, logLevel: "info" });

const browser = await chromium.launch({ headless: true,
  executablePath: chromiumExecutable });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1,
  recordVideo: { dir: out, size: { width: 1440, height: 1000 } } });
const page = await context.newPage();
const browserErrors = [];
page.on("pageerror", e => { browserErrors.push(e.message); console.error("browser error:", e.message); });
page.on("console", m => { if (m.type() === "error") console.error("browser console:", m.text()); });
const demoCss = await readFile(join(here, "docs/demo/demo.css"), "utf8");
const html = (await readFile(join(here, "docs/demo/index.html"), "utf8"))
  .replace('<link rel="stylesheet" href="demo.css">', `<style>${demoCss}</style>`)
  .replace('<script src="demo.js"></script>', "");
await page.setContent(html, { waitUntil: "load" });
await page.addScriptTag({ path: generated });
await page.waitForSelector("svg.mfe-enhanced g.node", { timeout: 5000 });
await page.waitForTimeout(1200);
console.log("diagram bounds:", await page.evaluate(() => {
  const svg = document.querySelector("svg.mfe-enhanced"), node = svg?.querySelector("g.node");
  const box = el => { const r = el?.getBoundingClientRect(); return r && [r.x, r.y, r.width, r.height]; };
  return { svg: box(svg), node: box(node), svgWidth: svg?.getAttribute("width"), svgHeight: svg?.getAttribute("height"), viewBox: svg?.getAttribute("viewBox"), nodes: svg?.querySelectorAll("g.node").length };
}));

const atNode = async key => {
  const el = page.locator(`svg.mfe-enhanced g.node[data-mpe-key='${key}']`);
  await el.hover({ force: true }); await page.waitForTimeout(950);
};
// Keep the pointer moving directly between nodes. Then visibly leave the diagram
// so the 180 ms reset is captured too.
await atNode("request");
await atNode("triage");
await atNode("ready");
await atNode("implement");
await atNode("review");
await atNode("passed");
await atNode("release");
await page.mouse.move(1330, 865);
await page.waitForTimeout(750);
await page.waitForTimeout(500);
const perf = await page.evaluate(async () => [await window.measureFlow(100), await window.measureFlow(300)]);
await writeFile(join(out, "browser-preview-performance.md"), [
  "# Browser preview performance sample",
  "",
  "Measured in headless Chromium while rendering and applying the plugin layout transform to synthetic linear Mermaid flowcharts.",
  "This is a directional fixture measurement, not an Obsidian or user-device benchmark.",
  "",
  "| Nodes | Edges | Render + transform (ms) | Enhanced SVG (bytes) |",
  "|---:|---:|---:|---:|",
  ...perf.map(p => `| ${p.nodes} | ${p.edges} | ${p.renderAndEnhanceMs} | ${p.svgBytes} |`),
  ""
].join("\n"));
const videoPath = await page.video().path();
await context.close();

function run(command, args) {
  return new Promise((ok, fail) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", fail); child.on("exit", code => code === 0 ? ok() : fail(new Error(`${command} exited ${code}`)));
  });
}
await run("ffmpeg", ["-y", "-t", "11.5", "-i", videoPath, "-vf", "fps=12,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3", "-loop", "0", join(out, "path-highlight.gif")]);
await run("ffmpeg", ["-y", "-i", videoPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, "browser-preview.mp4")]);
await unlink(videoPath);

// Short focused GIFs show the independent theme and compact geometry controls.
const focused = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
focused.on("pageerror", e => { browserErrors.push(e.message); console.error("browser error:", e.message); });
await focused.setContent(html, { waitUntil: "load" });
await focused.addScriptTag({ path: generated });
await focused.waitForSelector("svg.mfe-enhanced g.node", { timeout: 10000 });
await focused.waitForTimeout(400);
await focused.screenshot({ path: join(out, "browser-preview-dark.png"), fullPage: true });
await focused.screenshot({ path: join(out, "theme-dark.png") });
await focused.pdf({ path: join(out, "browser-preview-print.pdf"), format: "A4", landscape: true,
  printBackground: true, preferCSSPageSize: false, scale: 0.65, margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" } });
await focused.locator("#theme").click(); await focused.waitForTimeout(600);
await focused.screenshot({ path: join(out, "browser-preview-light.png"), fullPage: true });
await focused.screenshot({ path: join(out, "theme-light.png") });
await run("ffmpeg", ["-y", "-loop", "1", "-t", "1.1", "-i", join(out, "theme-dark.png"), "-loop", "1", "-t", "1.1", "-i", join(out, "theme-light.png"), "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0,fps=8,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse", "-loop", "0", join(out, "themes.gif")]);
await focused.locator("#theme").click(); await focused.waitForTimeout(450);
await focused.screenshot({ path: join(out, "compact-on.png") });
await focused.locator("#compact").click(); await focused.waitForTimeout(650);
await focused.screenshot({ path: join(out, "compact-off.png") });
await run("ffmpeg", ["-y", "-loop", "1", "-t", "1.1", "-i", join(out, "compact-on.png"), "-loop", "1", "-t", "1.1", "-i", join(out, "compact-off.png"), "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0,fps=8,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse", "-loop", "0", join(out, "compact-layout.gif")]);
await focused.close(); await browser.close();
if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join("; ")}`);
for (const name of ["theme-dark.png", "theme-light.png", "compact-on.png", "compact-off.png"]) {
  try { await unlink(join(out, name)); } catch {}
}

for (const name of ["path-highlight.gif", "themes.gif", "compact-layout.gif", "browser-preview.mp4"]) {
  const info = await stat(join(out, name)); console.log(`${name}: ${(info.size / 1024 / 1024).toFixed(2)} MiB`);
}
