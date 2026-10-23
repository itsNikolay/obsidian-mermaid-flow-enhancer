const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Obsidian 1.15 bundles Pele 1.8.0 as /lib/pele.min.js, byte-identical to this build.
const pelePath = require.resolve('pele/global');
const css = fs.readFileSync(path.resolve(__dirname, '../../styles.css'), 'utf8');
let bundlePath;

const source = `flowchart LR
request[Request] --> triage[Triage]
triage --> ready{Ready to build?}
ready -->|No| clarify[Clarify details]
clarify --> triage
ready -->|Yes| build[Build change]
build --> checks{Checks pass?}
checks -->|No| build
checks -->|Yes| release[Release]
release --> done((Complete))`;
const returns = ['L_clarify_triage_0', 'L_checks_build_0'];

test.beforeAll(async () => {
  bundlePath = path.join(os.tmpdir(), `mfe-pele-${process.pid}.js`);
  await esbuild.build({
    stdin: { contents: 'export * from "./pele"; export { createPathController } from "./highlight";',
      resolveDir: path.resolve(__dirname, '../../src'), loader: 'ts' },
    bundle: true, platform: 'browser', format: 'iife', globalName: 'MPEPele', outfile: bundlePath,
  });
});

test.afterAll(async () => {
  if (bundlePath && fs.existsSync(bundlePath)) fs.unlinkSync(bundlePath);
});

// Mirrors Obsidian 1.15: Pele is a global, notes mount diagrams into div.mermaid, and the theme
// sets Pele's colors. The plugin passes its layout as main.ts does.
async function setup(page, width = 1200) {
  await page.setContent(`<!doctype html><html><body class="theme-light" style="--pele-surface: rgb(1, 2, 3); --pele-accent: rgb(4, 5, 6)">
    <div class="mermaid" id="diagram" style="width:${width}px"></div><div class="mermaid" id="other"></div></body></html>`);
  await page.addScriptTag({ path: pelePath });
  await page.addScriptTag({ path: bundlePath });
  await page.addStyleTag({ content: css });
  await page.evaluate(() => {
    const layout = { curve: 'step', nodeSpacing: 28, rankSpacing: 26, wrappingWidth: 140 };
    window.restorePele = MPEPele.patchPele(window, {
      prepare: (element, text) => MPEPele.preparePeleDiagram(element, text, layout),
      trace: (element, text) => MPEPele.tracePeleDiagram(element, text, 450),
    });
    const controller = MPEPele.createPathController(document, () => ({ pathHighlight: true, hoverDelay: 50 }));
    for (const [name, handler] of [['pointerover', controller.enter], ['pointerout', controller.leave]])
      document.addEventListener(name, handler);
  });
}

const edgeFlags = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#diagram .pele-edge')]
  .map(edge => [edge.dataset.id, [edge.dataset.mpeFrom, edge.dataset.mpeTo, edge.dataset.mpeForward]])));

function expectFlowFlags(flags) {
  expect(Object.keys(flags)).toHaveLength(9);
  for (const [id, [from, to, forward]] of Object.entries(flags)) {
    expect(id).toBe(`L_${from}_${to}_0`);
    expect(forward).toBe(String(!returns.includes(id)));
  }
}

test('Pele diagrams trace ancestors on hover and skip return edges', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await setup(page);
  await page.evaluate(source => pele.mount(document.getElementById('diagram'), source), source);
  const svg = page.locator('#diagram > svg');
  await expect(svg).toHaveClass(/mfe-pele/);
  expect(await svg.locator('.pele-node[data-mpe-key][tabindex="0"]').count()).toBe(8);
  expectFlowFlags(await edgeFlags(page));

  await svg.locator('.pele-node[data-id="release"]').hover();
  await expect(svg).toHaveClass(/mpe-tracing/);
  const onPath = await svg.evaluate(svg => [...svg.querySelectorAll('.mpe-on-path')].map(el => el.dataset.id).sort());
  // Edge labels share their connector's id: ready → build and checks → release are labelled.
  expect(onPath).toEqual(['L_build_checks_0', 'L_checks_release_0', 'L_checks_release_0', 'L_ready_build_0',
    'L_ready_build_0', 'L_request_triage_0', 'L_triage_ready_0', 'build', 'checks', 'ready', 'release', 'request',
    'triage'].sort());
  await page.waitForTimeout(550);
  const styles = await svg.evaluate(svg => {
    const style = selector => getComputedStyle(svg.querySelector(selector));
    return {
      faded: style('.pele-node[data-id="clarify"]').opacity,
      fadedEdge: style('.pele-edge[data-id="L_clarify_triage_0"]').opacity,
      traced: style('.pele-node[data-id="request"]').opacity,
      nodeStroke: style('.pele-node[data-id="release"] rect').stroke,
      edgeStroke: style('.pele-edge[data-id="L_checks_release_0"] > path:not(.pele-marker)').stroke,
      arrowFill: style('.pele-edge[data-id="L_checks_release_0"] > .pele-marker').fill,
      arrowStroke: style('.pele-edge[data-id="L_checks_release_0"] > .pele-marker').stroke,
      otherStroke: style('.pele-node[data-id="clarify"] rect').stroke,
    };
  });
  // The plugin's light-theme highlight, as for Mermaid.js output.
  expect(styles).toMatchObject({ faded: '0.22', fadedEdge: '0.22', traced: '1', nodeStroke: 'rgb(57, 122, 181)',
    edgeStroke: 'rgb(57, 122, 181)', arrowFill: 'rgb(57, 122, 181)', arrowStroke: 'none' });
  expect(styles.otherStroke).not.toBe('rgb(57, 122, 181)');

  // A connector traces its own source path and its target.
  const point = await svg.locator('.pele-edge[data-id="L_ready_clarify_0"] > path').first().evaluate(path => {
    const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM());
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(point.x, point.y);
  await expect(svg.locator('.pele-edge[data-id="L_ready_clarify_0"]')).toHaveClass(/mpe-on-path/);
  await expect(svg.locator('.pele-node[data-id="clarify"]')).toHaveClass(/mpe-on-path/);
  await expect(svg.locator('.pele-node[data-id="release"]')).not.toHaveClass(/mpe-on-path/);

  await page.mouse.move(5, 5);
  await expect(svg).not.toHaveClass(/mpe-tracing/);
  expect(errors).toEqual([]);
});

test('a narrow note turns Pele LR diagrams into TB, and redrawn diagrams stay traced', async ({ page }) => {
  await setup(page, 320);
  await page.evaluate(source => pele.mount(document.getElementById('diagram'), source), source);
  const centers = () => page.evaluate(() => Object.fromEntries(['request', 'triage'].map(key =>
    [key, document.querySelector(`#diagram .pele-node[data-id="${key}"]`).getAttribute('transform')])));
  const turned = await centers();
  const y = transform => Number(transform.match(/,([-\d.]+)\)/)[1]);
  expect(y(turned.triage)).toBeGreaterThan(y(turned.request));
  expectFlowFlags(await edgeFlags(page));

  await page.evaluate(() => { document.getElementById('diagram').style.width = '1200px'; });
  await expect.poll(async () => { const now = await centers(); return y(now.triage) === y(now.request); }).toBe(true);
  await expect(page.locator('#diagram > svg')).toHaveClass(/mfe-pele/);
  expectFlowFlags(await edgeFlags(page));
});

test('compact layout gives Pele orthogonal connectors and the plugin palette in both themes', async ({ page }) => {
  await setup(page);
  await page.evaluate(source => {
    pele.mount(document.getElementById('diagram'), source);
    pele.mount(document.getElementById('other'), `%% mfe:off\n${source}`);
  }, source);
  const look = () => page.evaluate(() => [...document.querySelectorAll('.mermaid > svg')].map(svg => ({
    curves: [...svg.querySelectorAll('.pele-edge > path:not(.pele-marker)')].filter(path => /C/.test(path.getAttribute('d'))).length,
    fill: getComputedStyle(svg.querySelector('.pele-node rect')).fill,
    line: getComputedStyle(svg.querySelector('.pele-edge > path')).stroke,
    radius: getComputedStyle(svg).getPropertyValue('--pele-radius').trim(),
  })));
  // Step routes are straight segments with rounded corners; Pele's default routes are curves.
  // The palette is read at once: it must not fade in after Pele draws.
  const light = await look();
  expect(light[0]).toEqual({ curves: 0, fill: 'rgb(255, 255, 255)', line: 'rgb(85, 85, 85)', radius: '5px' });
  expect(light[1].curves).toBeGreaterThan(0);
  expect(light[1].fill).toBe('rgb(1, 2, 3)');
  // Connectors change color with the theme through their transition.
  await page.evaluate(() => document.body.classList.replace('theme-light', 'theme-dark'));
  await page.waitForTimeout(550);
  const dark = await look();
  expect(dark[0]).toMatchObject({ fill: 'rgb(39, 52, 73)', line: 'rgb(166, 184, 207)' });
  expect(dark[1].fill).toBe('rgb(1, 2, 3)');
});

test('opted-out and non-flowchart Pele diagrams are left untouched', async ({ page }) => {
  await setup(page);
  await page.evaluate(source => {
    pele.mount(document.getElementById('diagram'), `%% mfe:off\n${source}`);
    pele.mount(document.getElementById('other'), 'sequenceDiagram\n  A->>B: Hi');
  }, source);
  const untouched = await page.evaluate(() => [...document.querySelectorAll('.mermaid > svg')].map(svg =>
    !svg.classList.contains('mfe-pele') && !svg.querySelector('[data-mpe-key], [data-mpe-from]')));
  expect(untouched).toEqual([true, true]);
  await page.locator('#diagram .pele-node[data-id="release"]').hover();
  await page.waitForTimeout(100);
  await expect(page.locator('#diagram > svg')).not.toHaveClass(/mpe-tracing/);
});

test('Pele tracing ignores print and reduced motion, and unpatching restores Pele', async ({ page }) => {
  await setup(page);
  await page.evaluate(source => pele.mount(document.getElementById('diagram'), source), source);
  const svg = page.locator('#diagram > svg');
  await svg.locator('.pele-node[data-id="request"]').hover();
  await expect(svg).toHaveClass(/mpe-tracing/);
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  const printed = await svg.evaluate(svg => {
    const faded = svg.querySelector('.pele-node[data-id="done"]');
    const still = ['.pele-node[data-id="done"] circle', '.pele-edge > path:not(.pele-marker)', '.pele-edge > .pele-marker']
      .map(selector => getComputedStyle(svg.querySelector(selector)).transitionDuration);
    return { opacity: getComputedStyle(faded).opacity, transition: getComputedStyle(faded).transitionDuration, still };
  });
  expect(printed).toEqual({ opacity: '1', transition: '0s', still: ['0s', '0s', '0s'] });
  expect(await page.evaluate(() => {
    const patched = window.pele;
    window.restorePele();
    return window.pele !== patched && typeof window.pele.mount === 'function' && typeof window.pele.render === 'function';
  })).toBe(true);
});
