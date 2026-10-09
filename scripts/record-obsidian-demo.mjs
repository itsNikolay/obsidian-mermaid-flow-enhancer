import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(fileURLToPath(new URL("..", import.meta.url)));
const vault = "mermaid-flow-enhancer-demo";
const plugin = "mermaid-flow-enhancer";
const notePath = "Examples/Release flow.md";
const output = join(here, "docs/assets");
const cli = process.env.OBSIDIAN_CLI || "/opt/homebrew/bin/obsidian";
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const version = JSON.parse(await readFile(join(here, "manifest.json"), "utf8")).version;
const fixture = [
  "A synthetic flowchart for the Mermaid Flow Enhancer preview.",
  "",
  "```mermaid",
  "flowchart LR",
  `%% Preview build ${version}`,
  '  request["Request"] --> triage["Triage"]',
  '  triage --> ready{"Ready to build?"}',
  '  ready -->|No| clarify["Clarify details"]',
  "  clarify --> triage",
  '  ready -->|Yes| build["Build change"]',
  '  build --> checks{"Checks pass?"}',
  "  checks -->|No| build",
  '  checks -->|Yes| release["Release"]',
  '  release --> done(("Complete"))',
  "```",
  ""
].join("\n");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: here, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function obs(...args) { return run(cli, [`vault=${vault}`, ...args]); }
function guardedEval(expression) {
  const code = `if (app.vault.getName() !== ${JSON.stringify(vault)}) throw new Error("Wrong vault: refusing UI automation"); ${expression}`;
  const output = obs("eval", `code=${code}`);
  const marker = output.indexOf("=> ");
  return JSON.parse(marker < 0 ? output : output.slice(marker + 3));
}

const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
const temp = await mkdtemp(join(tmpdir(), "mfe-obsidian-record-"));
await mkdir(output, { recursive: true });
let screenshotIndex = 0;
let initialState;

async function screenshot(targetPath, sequence) {
  await rm(targetPath, { force: true });
  run(cli, [`vault=${vault}`, "dev:screenshot", `path=${targetPath}`]);
  let info;
  for (let attempt = 0; attempt < 20; attempt++) {
    try { info = await stat(targetPath); break; }
    catch (error) { if (error.code !== "ENOENT") throw error; await pause(100); }
  }
  if (!info) throw new Error(`Obsidian did not write screenshot: ${targetPath}`);
  if (info.size < 20_000) throw new Error(`Unexpectedly small Obsidian screenshot: ${targetPath} (${info.size} bytes)`);
  if (sequence) sequence.push({ path: targetPath, at: Date.now() });
  return targetPath;
}

async function frame(sequence = generatedFrames) {
  const path = join(temp, `frame-${String(screenshotIndex++).padStart(4, "0")}.png`);
  await screenshot(path, sequence);
  return path;
}

async function pointer(x, y) {
  obs("dev:cdp", "method=Page.bringToFront", "params={}");
  await pause(1000);
  const params = JSON.stringify({ type: "mouseMoved", x, y, button: "none", buttons: 0 });
  obs("dev:cdp", "method=Input.dispatchMouseEvent", `params=${params}`);
  await pause(1000);
}

async function setDark(dark) {
  const isDark = guardedEval("document.body.classList.contains('theme-dark')");
  if (isDark !== dark) {
    obs("command", "id=theme:toggle-light-dark");
    await pause(1100);
  }
  const palette = guardedEval(`JSON.stringify({dark:document.body.classList.contains("theme-dark"), fill:getComputedStyle(document.querySelector(".mermaid .node rect")).fill, text:getComputedStyle(document.querySelector(".mermaid .nodeLabel")).color, line:getComputedStyle(document.querySelector(".mermaid .flowchart-link")).stroke})`);
  const channel = value => Number(value.match(/\d+/)?.[0] ?? 0);
  const fillLuma = channel(palette.fill), textLuma = channel(palette.text), lineLuma = channel(palette.line);
  if (palette.dark !== dark || (dark ? !(fillLuma < 100 && textLuma > 150 && lineLuma > 120)
    : !(fillLuma > 200 && textLuma < 100 && lineLuma > 40))) {
    throw new Error(`Theme palette did not settle for ${dark ? "dark" : "light"}: ${JSON.stringify(palette)}`);
  }
}

async function nodePositions() {
  return guardedEval(`JSON.stringify([...document.querySelectorAll("svg.mfe-enhanced .node[data-mpe-key]")].map(n => { const r = n.querySelector("polygon,rect,circle,ellipse").getBoundingClientRect(); return [n.getAttribute("data-mpe-key"), r.x + r.width / 2, r.y + r.height / 2] }))`);
}

function verifyGeometry() {
  const proof = guardedEval(`JSON.stringify((()=>{
    const svg=document.querySelector("svg.mfe-enhanced");
    const nodes=new Map([...svg.querySelectorAll(".node[data-mpe-key]")].map(n=>[n.getAttribute("data-mpe-key"),n.querySelector("polygon,rect,circle,ellipse")?.getBoundingClientRect()]));
    const markerById=new Map([...svg.querySelectorAll("marker")].map(m=>[m.id,{width:Number(m.getAttribute("markerWidth")),height:Number(m.getAttribute("markerHeight"))}]));
    const edges=[...svg.querySelectorAll("path.flowchart-link[data-mpe-from][data-mpe-to]")].map(path=>{
      const from=nodes.get(path.getAttribute("data-mpe-from")),to=nodes.get(path.getAttribute("data-mpe-to"));
      const ctm=path.getScreenCTM(), transform=p=>new DOMPoint(p.x,p.y).matrixTransform(ctm);
      const a=transform(path.getPointAtLength(0)), b=transform(path.getPointAtLength(path.getTotalLength()));
      const sideError=(point,rect)=>Math.min(
        Math.hypot(point.x-rect.left,point.y-(rect.top+rect.height/2)),
        Math.hypot(point.x-rect.right,point.y-(rect.top+rect.height/2)),
        Math.hypot(point.x-(rect.left+rect.width/2),point.y-rect.top),
        Math.hypot(point.x-(rect.left+rect.width/2),point.y-rect.bottom));
      const endpoint=(point,rect)=>({mode:"side",error:sideError(point,rect)});
      const markerId=path.getAttribute("marker-end")?.match(/#([^)]*)/)?.[1];
      return {from:path.getAttribute("data-mpe-from"),to:path.getAttribute("data-mpe-to"),start:endpoint(a,from),end:endpoint(b,to),endMarker:markerById.get(markerId)};
    });
    return {edges};
  })())`);
  const badMarkers = proof.edges.filter(edge => edge.endMarker?.width !== 8 || edge.endMarker?.height !== 8);
  const endpoints = proof.edges.flatMap(edge => [edge.start, edge.end]);
  const maxEndpointError = Math.max(0, ...endpoints.map(endpoint => endpoint.error));
  if (badMarkers.length || proof.edges.length === 0 || !Number.isFinite(maxEndpointError) || maxEndpointError > 2) {
    throw new Error(`Enhanced SVG geometry verification failed: ${JSON.stringify({badMarkers, edgeCount: proof.edges.length, maxEndpointError, edges: proof.edges})}`);
  }
  return {arrowMarkerCount: proof.edges.length, edgeCount: proof.edges.length,
    sideDockedEndpoints: endpoints.length,
    maxEndpointError: Number(maxEndpointError.toFixed(3))};
}

async function recordPath(sequence, keys, holdMs, sampleMs, samplesPerNode = 2) {
  const outside = guardedEval("JSON.stringify([Math.round(innerWidth / 2), Math.round(innerHeight * 0.82)])");
  await pointer(outside[0], outside[1]);
  await pause(350);
  if (guardedEval("document.querySelector('svg.mfe-enhanced')?.classList.contains('mpe-tracing')")) {
    throw new Error("Path highlight failed to reset before recording");
  }
  await frame(sequence);
  for (const key of keys) {
    const nodes = new Map((await nodePositions()).map(([nodeKey, x, y]) => [nodeKey, [x, y]]));
    const point = nodes.get(key);
    if (!point || !point.every(Number.isFinite)) throw new Error(`Could not locate node ${key} in the enhanced Obsidian preview`);
    await pointer(point[0], point[1]);
    await pause(sampleMs);
    let pathState;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await pause(350);
      pathState = guardedEval(`JSON.stringify({tracing: document.querySelector("svg.mfe-enhanced")?.classList.contains("mpe-tracing"), target: document.querySelector('svg.mfe-enhanced .node[data-mpe-key="${key}"]')?.classList.contains("mpe-on-path"), selected: document.querySelectorAll("svg.mfe-enhanced .mpe-on-path").length})`);
      if (pathState.tracing && pathState.target && pathState.selected >= (key === "request" ? 1 : 2)) break;
    }
    if (!pathState.tracing || !pathState.target || pathState.selected < (key === "request" ? 1 : 2)) {
      throw new Error(`Path highlight did not activate over ${key}: ${JSON.stringify(pathState)}`);
    }
    await frame(sequence);
    if (samplesPerNode > 1) {
      await pause(holdMs - sampleMs);
      await frame(sequence);
    } else {
      await pause(holdMs - sampleMs);
    }
  }
  await pointer(outside[0], outside[1]);
  await pause(100);
  await frame(sequence);
  await pause(200);
  await frame(sequence);
  await pause(450);
  if (guardedEval("document.querySelector('svg.mfe-enhanced')?.classList.contains('mpe-tracing')")) {
    throw new Error("Path highlight failed to clear after pointer left the diagram");
  }
  await frame(sequence);
}

function concatQuote(path) {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

async function writeConcat(path, frames) {
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < frames.length; i++) {
    lines.push(`file ${concatQuote(frames[i].path)}`);
    if (i + 1 < frames.length) {
      const seconds = Math.max(0.04, (frames[i + 1].at - frames[i].at) / 1000);
      lines.push(`duration ${seconds.toFixed(3)}`);
    }
  }
  const last = frames.at(-1);
  lines.push(`file ${concatQuote(last.path)}`, "duration 0.65", `file ${concatQuote(last.path)}`, "");
  await writeFile(path, lines.join("\n"));
}

function encode(args) {
  run(ffmpeg, ["-y", ...args]);
}

try {
  const initial = guardedEval(`JSON.stringify({dark: document.body.classList.contains('theme-dark'), sidebarCollapsed: document.querySelector('.workspace-split.mod-left-split')?.classList.contains('is-sidedock-collapsed') ?? true, pluginEnabled: app.plugins.enabledPlugins.has(${JSON.stringify(plugin)})})`);
  initialState = initial;
  let pluginInfo = obs("plugin", `id=${plugin}`);
  if (!/enabled\s+true/.test(pluginInfo)) {
    obs("plugin:enable", `id=${plugin}`);
    await pause(1000);
    pluginInfo = obs("plugin", `id=${plugin}`);
  }
  if (!/enabled\s+true/.test(pluginInfo)) throw new Error(`Enhancer is not enabled in ${vault}`);
  if (!initial.sidebarCollapsed) {
    obs("command", "id=app:toggle-left-sidebar");
    await pause(350);
  }
  obs("create", `path=${notePath}`, `content=${fixture}`, "open", "overwrite");
  await pause(1400);
  obs("dev:debug", "on");
  obs("dev:errors", "clear");
  obs("dev:cdp", "method=Page.bringToFront", "params={}");

  const ready = guardedEval(`JSON.stringify({vault: app.vault.getName(), activePath: app.workspace.getActiveFile()?.path, pluginEnabled: app.plugins.enabledPlugins.has(${JSON.stringify(plugin)}), svgCount: document.querySelectorAll("svg.mfe-enhanced").length, nodeKeys: [...document.querySelectorAll("svg.mfe-enhanced .node[data-mpe-key]")].map(n => n.getAttribute("data-mpe-key"))})`);
  if (ready.vault !== vault || ready.activePath !== notePath || !ready.pluginEnabled || ready.svgCount !== 1) {
    throw new Error(`Demo setup check failed: ${JSON.stringify(ready)}`);
  }
  const geometryProof = verifyGeometry();

  const pathKeys = ["request", "triage", "ready", "clarify", "triage", "ready"];
  const lightFrames = [];
  await setDark(false);
  await pointer(1010, 785); await pause(300);
  await screenshot(join(output, "obsidian-preview-light.png"));
  await recordPath(lightFrames, pathKeys, 600, 300, 1);
  const lightConcat = join(temp, "light.ffconcat");
  await writeConcat(lightConcat, lightFrames);
  const gifPath = join(output, "obsidian-path-highlight.gif");
  encode(["-f", "concat", "-safe", "0", "-i", lightConcat,
    "-vf", "fps=8,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
    "-loop", "0", gifPath]);

  const videoFrames = [];
  await screenshot(join(output, "obsidian-preview-light.png"), videoFrames);
  await recordPath(videoFrames, pathKeys, 600, 300);
  await setDark(true);
  await pointer(1010, 785); await pause(300);
  const darkPalette = guardedEval(`JSON.stringify({dark:document.body.classList.contains("theme-dark"), fill:getComputedStyle(document.querySelector("svg.mfe-enhanced .node rect")).fill, text:getComputedStyle(document.querySelector("svg.mfe-enhanced .nodeLabel")).color, line:getComputedStyle(document.querySelector("svg.mfe-enhanced .flowchart-link")).stroke, svgFilter:getComputedStyle(document.querySelector("svg.mfe-enhanced")).filter})`);
  if (!darkPalette.dark || darkPalette.svgFilter !== "none") throw new Error(`Dark Mermaid filter is still active: ${JSON.stringify(darkPalette)}`);
  await screenshot(join(output, "obsidian-preview-dark.png"), videoFrames);

  const errors = obs("dev:errors");
  if (!/^No errors captured\.$/m.test(errors)) throw new Error(`Obsidian reported errors:\n${errors}`);
  const videoConcat = join(temp, "video.ffconcat");
  await writeConcat(videoConcat, videoFrames);
  const videoPath = join(output, "obsidian-preview.mp4");
  encode(["-f", "concat", "-safe", "0", "-i", videoConcat, "-vf", "fps=24,scale=1440:-2:flags=lanczos",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoPath]);

  const gifInfo = await stat(gifPath), videoInfo = await stat(videoPath);
  if (gifInfo.size > 5 * 1024 * 1024) throw new Error(`Obsidian GIF exceeds 5 MiB: ${gifInfo.size}`);
  const elapsed = ((videoFrames.at(-1).at - videoFrames[0].at) / 1000).toFixed(1);
  const gifElapsed = ((lightFrames.at(-1).at - lightFrames[0].at) / 1000).toFixed(1);
  const averageSamples = (videoFrames.length / Number(elapsed)).toFixed(2);
  const sampleIntervals = videoFrames.slice(1).map((frame, i) => frame.at - videoFrames[i].at);
  const shortestSample = Math.min(...sampleIntervals), longestSample = Math.max(...sampleIntervals);
  await writeFile(join(output, "obsidian-capture-report.md"), [
    "# Obsidian app capture report",
    "",
    `Captured from the real Obsidian app, vault \`${vault}\`, with the community plugin enabled. The note at \`${notePath}\` is a synthetic fixture created by the recorder.`,
    "Frames came from the official `obsidian dev:screenshot` command. Pointer movement used `Input.dispatchMouseEvent` through `obsidian dev:cdp`.",
    `The first dark-theme capture exposed Obsidian's native Mermaid inversion filter on the enhanced SVG. The plugin CSS fix now disables that filter only for the enhanced SVG; the verified dark values are ${JSON.stringify(darkPalette)}.`,
    `The rendered SVG also passed the geometry check: all ${geometryProof.arrowMarkerCount} referenced arrow markers are 8 × 8, and all ${geometryProof.sideDockedEndpoints} edge endpoints land at shape-side midpoints (maximum measured deviation ${geometryProof.maxEndpointError} CSS px).`,
    "",
    `The path GIF uses ${lightFrames.length} real screenshots over about ${gifElapsed} s. The MP4 uses ${videoFrames.length} screenshots over about ${elapsed} s (average ${averageSamples} screenshots/s; observed capture intervals ${shortestSample}-${longestSample} ms). The MP4 preserves those recorded intervals. Screenshot sampling is not a high-frame-rate screen recording, so the clip shows genuine app states but does not reproduce each 450 ms transition at full display refresh.`,
    "",
    "No errors were reported by `obsidian dev:errors` after capture.",
    "",
    `The path GIF is ${(gifInfo.size / 1024 / 1024).toFixed(2)} MiB. The actual-app MP4 is ${(videoInfo.size / 1024 / 1024).toFixed(2)} MiB and spans about ${elapsed} seconds.`,
    "",
    "This is a smoke recording from one Obsidian build, theme setup, and machine; it is not a cross-version compatibility or performance benchmark.",
    ""
  ].join("\n"));

  if (initial.dark) await setDark(true); else await setDark(false);
  if (!initial.sidebarCollapsed) obs("command", "id=app:toggle-left-sidebar");
  console.log(`Obsidian path GIF: ${(gifInfo.size / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`Obsidian MP4: ${(videoInfo.size / 1024 / 1024).toFixed(2)} MiB, ${elapsed} s (${videoFrames.length} actual screenshots)`);
  console.log(`Captured ${lightFrames.length + videoFrames.length} real app frames in ${vault}.`);
} finally {
  if (initialState) {
    try {
      const current = guardedEval(`JSON.stringify({dark:document.body.classList.contains('theme-dark'), sidebarCollapsed:document.querySelector('.workspace-split.mod-left-split')?.classList.contains('is-sidedock-collapsed') ?? true, pluginEnabled:app.plugins.enabledPlugins.has(${JSON.stringify(plugin)})})`);
      if (current.dark !== initialState.dark) obs("command", "id=theme:toggle-light-dark");
      if (current.sidebarCollapsed !== initialState.sidebarCollapsed) obs("command", "id=app:toggle-left-sidebar");
      if (current.pluginEnabled !== initialState.pluginEnabled) {
        obs(current.pluginEnabled ? "plugin:disable" : "plugin:enable", `id=${plugin}`);
      }
    } catch (error) {
      console.error(`Could not fully restore demo vault UI state: ${error.message}`);
    }
  }
  await rm(temp, { recursive: true, force: true });
}
