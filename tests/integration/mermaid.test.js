const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let bundlePath;
let highlightBundlePath;
let mermaidPath;

test.beforeAll(async () => {
  bundlePath = path.join(os.tmpdir(), `mfe-layout-${process.pid}.js`);
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../../src/layout.js')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'MPELayout',
    outfile: bundlePath,
  });
  highlightBundlePath = path.join(os.tmpdir(), `mfe-highlight-${process.pid}.js`);
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../../src/highlight.js')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'MPEHighlight',
    outfile: highlightBundlePath,
  });
  const root = path.dirname(require.resolve('mermaid'));
  mermaidPath = path.join(root, 'mermaid.min.js');
  if (!fs.existsSync(mermaidPath)) mermaidPath = require.resolve('mermaid');
});

test.afterAll(async () => {
  if (bundlePath && fs.existsSync(bundlePath)) fs.unlinkSync(bundlePath);
  if (highlightBundlePath && fs.existsSync(highlightBundlePath)) fs.unlinkSync(highlightBundlePath);
});

async function setup(page) {
  await page.setContent('<!doctype html><html><body><div id="out"></div></body></html>');
  await page.addScriptTag({ path: mermaidPath, type: mermaidPath.endsWith('.mjs') ? 'module' : undefined });
  await page.addScriptTag({ path: bundlePath });
  await page.addScriptTag({ path: highlightBundlePath });
  await page.evaluate(() => mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' }));
}

async function renderStyled(page, source) {
  return page.evaluate(async source => {
    const { svg } = await mermaid.render(`mpe-${Math.random().toString(36).slice(2)}`, source);
    const direction = source.match(/flowchart\s+(TD|TB|BT|LR|RL)/)?.[1];
    return MPELayout.styleSvg(svg, direction);
  }, source);
}

test('real Mermaid output keeps Unicode underscore IDs, arrows, labels, and branches', async ({ page }) => {
  await setup(page);
  const svg = await renderStyled(page,
    'flowchart TD\n  старт_1{Проверить длинное условие?}\n  путь_да[Очень длинная последовательность действий]\n  путь_нет[Отказ]\n  старт_1 -->|да| путь_да\n  старт_1 -->|нет| путь_нет');
  const info = await page.evaluate(svgText => {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    return {
      parserError: !!doc.querySelector('parsererror'),
      keys: [...doc.querySelectorAll('[data-mpe-key]')].map(n => n.getAttribute('data-mpe-key')),
      edges: [...doc.querySelectorAll('[data-mpe-from]')].map(e => [e.dataset.mpeFrom, e.dataset.mpeTo, e.dataset.mpeForward]),
      endMarkers: [...doc.querySelectorAll('marker[id$="pointEnd"]')].map(m => [m.getAttribute('markerWidth'), m.getAttribute('markerUnits')]),
      labels: doc.querySelectorAll('.edgeLabels > .edgeLabel').length,
      paths: [...doc.querySelectorAll('path.flowchart-link')].map(p => p.getAttribute('d')),
    };
  }, svg);
  expect(info.parserError).toBe(false);
  expect(info.keys).toEqual(expect.arrayContaining(['старт_1', 'путь_да', 'путь_нет']));
  expect(info.edges).toHaveLength(2);
  expect(info.edges.every(edge => edge[0] === 'старт_1' && edge[2] === 'true')).toBe(true);
  expect(info.endMarkers.some(([, units]) => units === 'userSpaceOnUse')).toBe(true);
  expect(info.labels).toBeGreaterThan(0);
  expect(info.paths.every(d => /Q/.test(d))).toBe(true);
});

test('all Mermaid directions produce valid paths and marker geometry', async ({ page }) => {
  await setup(page);
  for (const direction of ['TD', 'TB', 'BT', 'LR', 'RL']) {
    const svg = await renderStyled(page,
      `flowchart ${direction}\n  A[Start] --> B{Decision}\n  B -->|yes| C[Accept]\n  B -->|no| D[Reject]`);
    const result = await page.evaluate(svgText => {
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      return {
        valid: !doc.querySelector('parsererror'),
        paths: [...doc.querySelectorAll('path.flowchart-link')].map(path => path.getAttribute('d')),
        marker: [...doc.querySelectorAll('marker[id$="pointEnd"]')].some(m =>
          m.getAttribute('markerWidth') === '12' && m.getAttribute('viewBox') === '0 0 10 10'),
      };
    }, svg);
    expect(result.valid, direction).toBe(true);
    expect(result.paths).toHaveLength(3);
    expect(result.paths.every(d => d?.startsWith('M') && !/NaN|undefined/.test(d))).toBe(true);
    expect(result.marker, direction).toBe(true);
  }
});

test('long decision text wraps before Mermaid layout and multiple SVGs stay independent', async ({ page }) => {
  await setup(page);
  const sources = await page.evaluate(() => [
    MPELayout.wrapDecisions('flowchart TD\n  question{"Should the user continue with this lengthy approval process?"}\n  question --> Done'),
    'flowchart LR\n  X --> Y',
  ]);
  expect(sources[0]).toContain('<br/>');
  const first = await renderStyled(page, sources[0]);
  const second = await renderStyled(page, sources[1]);
  const counts = await page.evaluate(([a, b]) => [a, b].map(text => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    return { nodes: doc.querySelectorAll('g.node[data-mpe-key]').length,
      ids: [...doc.querySelectorAll('g.node[data-mpe-key]')].map(n => n.dataset.mpeKey) };
  }), [first, second]);
  expect(counts[0].nodes).toBe(2);
  expect(counts[1].nodes).toBe(2);
  expect(counts[0].ids).toContain('question');
  expect(counts[1].ids).toEqual(['X', 'Y']);
});

test('reverse-direction edge fallback retains valid cycle paths', async ({ page }) => {
  await setup(page);
  const svg = await renderStyled(page,
    'flowchart TD\n  A --> B\n  B --> C\n  C --> B');
  const info = await page.evaluate(svgText => {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    return [...doc.querySelectorAll('path.flowchart-link')].map(path => ({
      d: path.getAttribute('d'), from: path.dataset.mpeFrom, to: path.dataset.mpeTo,
    }));
  }, svg);
  expect(info).toHaveLength(3);
  expect(info.every(edge => edge.d?.startsWith('M') && !/NaN/.test(edge.d))).toBe(true);
  expect(info.some(edge => edge.d.includes('L') && edge.from && edge.to)).toBe(true);
});

test('real SVG hover controller transitions directly between nodes and clears after delay', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await setup(page);
  const nodes = await page.evaluate(async () => {
    document.body.innerHTML = '<div class="mermaid" id="mount"></div>';
    const { svg } = await mermaid.render('hover-controller', 'flowchart TD\n  A --> B --> C');
    document.querySelector('#mount').innerHTML = MPELayout.styleSvg(svg, 'TD');
    window.mpeController = MPEHighlight.createPathController(document,
      () => ({ pathHighlight: true, hoverDelay: 50 }));
    return [...document.querySelectorAll('.node[data-mpe-key]')].map(node => node.dataset.mpeKey);
  });
  expect(nodes).toEqual(['A', 'B', 'C']);

  await page.evaluate(() => {
    const node = document.querySelector('.node[data-mpe-key="B"]');
    mpeController.enter({ target: node });
  });
  expect(await page.locator('svg').evaluate(svg => svg.classList.contains('mpe-tracing'))).toBe(true);
  await page.evaluate(() => {
    const node = document.querySelector('.node[data-mpe-key="B"]');
    mpeController.leave({ target: node, relatedTarget: null });
    mpeController.enter({ target: document.querySelector('.node[data-mpe-key="C"]') });
  });
  await page.waitForTimeout(70);
  expect(await page.locator('svg').evaluate(svg => svg.classList.contains('mpe-tracing'))).toBe(true);
  expect(await page.locator('.node[data-mpe-key="A"]').evaluate(n => n.classList.contains('mpe-on-path'))).toBe(true);
  await page.evaluate(() => mpeController.leave({
    target: document.querySelector('.node[data-mpe-key="C"]'), relatedTarget: null,
  }));
  await page.waitForTimeout(70);
  expect(await page.locator('svg').evaluate(svg => svg.classList.contains('mpe-tracing'))).toBe(false);
  expect(pageErrors).toEqual([]);
  await page.evaluate(() => mpeController.dispose());
});

test('compact layout aligns incoming tops for unequal rectangle and diamond nodes', async ({ page }) => {
  await setup(page);
  const diagram = 'flowchart TD\n  Start[Start] --> Short[Short]\n  Start --> Decision{A much taller decision label}';
  const svg = await page.evaluate(async source => {
    const { svg: raw } = await mermaid.render('boundary-alignment', source);
    return MPELayout.styleSvg(raw, 'TD');
  }, diagram);
  const measurements = await page.evaluate(svgText => {
    document.body.innerHTML = `<div class="mermaid">${svgText}</div>`;
    return ['Short', 'Decision'].map(key => {
      const node = [...document.querySelectorAll('g.node[data-mpe-key]')].find(n => n.dataset.mpeKey === key);
      const shape = node.querySelector('rect, polygon');
      const incoming = document.querySelector(`path[data-mpe-to="${key}"]`);
      const point = incoming.getPointAtLength(incoming.getTotalLength());
      const endpoint = new DOMPoint(point.x, point.y).matrixTransform(incoming.getScreenCTM());
      return { top: shape.getBoundingClientRect().top, endpoint: endpoint.y };
    });
  }, svg);
  expect(Math.abs(measurements[0].top - measurements[1].top)).toBeLessThanOrEqual(2);
  expect(Math.abs(measurements[0].endpoint - measurements[1].endpoint)).toBeLessThanOrEqual(2);
});

test('compactLayout false preserves Mermaid geometry, classes, IDs, and link anchors', async ({ page }) => {
  await setup(page);
  const source = 'flowchart TD\n  A[Start] -->|go| B{Check}\n  B --> C[Finish]\n  class B special\n  classDef special fill:#abc\n  linkStyle 0 stroke:#f00';
  const result = await page.evaluate(async source => {
    const { svg: original } = await mermaid.render('before-geometry', source);
    const transformed = MPELayout.styleSvg(original, 'TD', { compactLayout: false });
    function inspect(text) {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      return {
        nodes: [...doc.querySelectorAll('g.node')].map(node => ({
          key: node.id.match(/flowchart-(.+)-\d+$/)?.[1],
          id: node.id,
          class: node.getAttribute('class'),
          transform: node.getAttribute('transform'),
        })),
        edges: [...doc.querySelectorAll('path.flowchart-link')].map(edge => ({
          id: edge.id, class: edge.getAttribute('class'), d: edge.getAttribute('d'),
          markerEnd: edge.getAttribute('marker-end'), dataId: edge.getAttribute('data-id'),
        })),
        markers: [...doc.querySelectorAll('marker')].map(marker => marker.id),
      };
    }
    return { original: inspect(original), transformed: inspect(transformed) };
  }, source);
  expect(result.transformed.nodes.map(n => [n.key, n.transform]))
    .toEqual(result.original.nodes.map(n => [n.key, n.transform]));
  for (const original of result.original.nodes) {
    const transformed = result.transformed.nodes.find(n => n.key === original.key);
    for (const cls of original.class.split(/\s+/).filter(Boolean)) expect(transformed.class).toContain(cls);
  }
  expect(result.transformed.edges.map(e => [e.class, e.d, e.markerEnd, e.dataId]))
    .toEqual(result.original.edges.map(e => [e.class, e.d, e.markerEnd, e.dataId]));
  expect(result.transformed.nodes.find(n => n.key === 'B').class).toContain('special');
  for (const edge of result.transformed.edges) {
    const markerId = edge.markerEnd?.match(/#([^)'\"]+)/)?.[1];
    if (markerId) expect(result.transformed.markers).toContain(markerId);
  }
});

test('CSS restores faded nodes for print and disables motion when reduced motion is requested', async ({ page }) => {
  await setup(page);
  const css = fs.readFileSync(path.resolve(__dirname, '../../styles.css'), 'utf8');
  await page.addStyleTag({ content: css });
  const svg = await renderStyled(page, 'flowchart TD\n  A --> B --> C');
  await page.evaluate(svgText => {
    document.body.innerHTML = `<div class="mermaid">${svgText}</div>`;
    document.querySelector('svg').classList.add('mpe-tracing');
  }, svg);
  const node = page.locator('.node[data-mpe-key="A"]');
  await page.emulateMedia({ media: 'screen' });
  expect(await node.evaluate(el => getComputedStyle(el).opacity)).toBe('0.22');
  await page.emulateMedia({ media: 'print' });
  expect(await node.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  expect(await node.evaluate(el => getComputedStyle(el).transitionProperty)).toBe('none');
  await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
  expect(await node.evaluate(el => getComputedStyle(el).transitionProperty)).toBe('none');
});

test('subgraph branches converge with valid routes and labels clear of other node shapes', async ({ page }) => {
  await setup(page);
  const svg = await renderStyled(page,
    'flowchart TD\n' +
    '  subgraph Checks[Preflight checks]\n' +
    '    direction LR\n' +
    '    Input[Collect the user input] --> Complete{Input is complete?}\n' +
    '    Policy[Read the access policy] --> Allowed{Policy allows this action?}\n' +
    '  end\n' +
    '  Complete -->|ready| Merge[Combine the check results]\n' +
    '  Allowed -->|permitted| Merge\n' +
    '  Merge --> Continue[Continue to the next step]');
  const result = await page.evaluate(svgText => {
    document.body.innerHTML = `<div class="mermaid">${svgText}</div>`;
    const nodes = [...document.querySelectorAll('g.node[data-mpe-key]')];
    const nodeInfo = nodes.map(node => {
      const shape = node.querySelector('rect, polygon, circle, ellipse');
      const label = node.querySelector('foreignObject');
      const box = el => {
        const { left, right, top, bottom } = el.getBoundingClientRect();
        return { left, right, top, bottom };
      };
      return { key: node.dataset.mpeKey, shape: shape && box(shape), label: label && box(label) };
    });
    const overlaps = [];
    for (const item of nodeInfo) for (const other of nodeInfo) {
      if (item.key === other.key || !item.label || !other.shape) continue;
      const x = Math.min(item.label.right, other.shape.right) - Math.max(item.label.left, other.shape.left);
      const y = Math.min(item.label.bottom, other.shape.bottom) - Math.max(item.label.top, other.shape.top);
      if (x > 1 && y > 1) overlaps.push([item.key, other.key, x, y]);
    }
    const edges = [...document.querySelectorAll('path.flowchart-link[data-mpe-from][data-mpe-to]')].map(path => ({
      from: path.dataset.mpeFrom,
      to: path.dataset.mpeTo,
      d: path.getAttribute('d'),
      length: path.getTotalLength(),
    }));
    return {
      parserError: !!document.querySelector('parsererror'),
      keys: nodeInfo.map(node => node.key),
      overlaps,
      edges,
      subgraph: !!document.querySelector('g.cluster'),
    };
  }, svg);
  expect(result.parserError).toBe(false);
  expect(result.subgraph).toBe(true);
  expect(result.keys).toEqual(expect.arrayContaining(['Input', 'Complete', 'Policy', 'Allowed', 'Merge', 'Continue']));
  expect(result.edges.filter(edge => edge.to === 'Merge')).toHaveLength(2);
  expect(result.edges).toHaveLength(5);
  expect(result.edges.every(edge => edge.d?.startsWith('M') && Number.isFinite(edge.length) && edge.length > 0 && !/NaN|undefined/.test(edge.d))).toBe(true);
  expect(result.overlaps).toEqual([]);
});
