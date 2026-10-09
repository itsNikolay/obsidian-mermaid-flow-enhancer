const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function parseColor(value) {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
    return [0, 2, 4].map(i => parseInt(raw.slice(i, i + 2), 16));
  }
  const rgb = value.match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i);
  if (!rgb) throw new Error(`Unrecognized computed color: ${value}`);
  return rgb.slice(1, 4).map(Number);
}

function contrastRatio(foreground, background) {
  const luminance = color => {
    const channels = parseColor(color).map(channel => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

let bundlePath;
let highlightBundlePath;
let mermaidPath;

test.beforeAll(async () => {
  bundlePath = path.join(os.tmpdir(), `mfe-layout-${process.pid}.js`);
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../../src/layout.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'MPELayout',
    outfile: bundlePath,
  });
  highlightBundlePath = path.join(os.tmpdir(), `mfe-highlight-${process.pid}.js`);
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../../src/highlight.ts')],
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
          m.getAttribute('markerWidth') === '8' && m.getAttribute('refX') === '10' && m.getAttribute('viewBox') === '0 0 10 10'),
      };
    }, svg);
    expect(result.valid, direction).toBe(true);
    expect(result.paths).toHaveLength(3);
    expect(result.paths.every(d => d?.startsWith('M') && !/NaN|undefined/.test(d))).toBe(true);
    expect(result.marker, direction).toBe(true);
  }
});

test('rounded forward and return connectors dock at side centers in every direction', async ({ page }) => {
  await setup(page);
  for (const direction of ['TD', 'TB', 'BT', 'LR', 'RL']) {
    const svg = await renderStyled(page,
      `flowchart ${direction}\n  A[Start rectangle] --> B{Decision}\n  B --> C[Finish rectangle]\n  C --> A`);
    const measurements = await page.evaluate(([svgText, dir]) => {
      document.body.innerHTML = `<div class="mermaid">${svgText}</div>`;
      const vertical = /^(TD|TB|BT)$/.test(dir);
      const axis = vertical ? 'y' : 'x';
      const cross = vertical ? 'x' : 'y';
      const getBox = element => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        return { x: { min: left, max: right, center: (left + right) / 2 },
          y: { min: top, max: bottom, center: (top + bottom) / 2 } };
      };
      const nodes = new Map([...document.querySelectorAll('g.node[data-mpe-key]')].map(node => [
        node.dataset.mpeKey, { box: getBox(node.querySelector('rect, polygon')), node },
      ]));
      return [...document.querySelectorAll('path.flowchart-link[data-mpe-from][data-mpe-to]')].map(path => {
        const from = nodes.get(path.dataset.mpeFrom);
        const to = nodes.get(path.dataset.mpeTo);
        const start = path.getPointAtLength(0);
        const end = path.getPointAtLength(path.getTotalLength());
        const matrix = path.getScreenCTM();
        const startScreen = new DOMPoint(start.x, start.y).matrixTransform(matrix);
        const endScreen = new DOMPoint(end.x, end.y).matrixTransform(matrix);
        const total = path.getTotalLength();
        const startNext = path.getPointAtLength(Math.min(total, 0.5));
        const endPrevious = path.getPointAtLength(Math.max(0, total - 0.5));
        const startNextScreen = new DOMPoint(startNext.x, startNext.y).matrixTransform(matrix);
        const endPreviousScreen = new DOMPoint(endPrevious.x, endPrevious.y).matrixTransform(matrix);
        const travel = Math.sign(to.box[axis].center - from.box[axis].center);
        const forward = path.dataset.mpeForward === 'true';
        const normal = forward ? axis : cross;
        const crossAxis = forward ? cross : axis;
        const tangentCross = normal === axis ? cross : axis;
        const side = forward
          ? { from: travel > 0 ? from.box[axis].max : from.box[axis].min,
              to: travel > 0 ? to.box[axis].min : to.box[axis].max }
          : null;
        const fromOuter = !forward && Math.abs(startScreen[cross] - from.box[cross].min) < Math.abs(startScreen[cross] - from.box[cross].max) ? 'min' : 'max';
        const toOuter = !forward && Math.abs(endScreen[cross] - to.box[cross].min) < Math.abs(endScreen[cross] - to.box[cross].max) ? 'min' : 'max';
        return {
          from: path.dataset.mpeFrom,
          to: path.dataset.mpeTo,
          fromCrossError: Math.abs(startScreen[crossAxis] - from.box[crossAxis].center),
          toCrossError: Math.abs(endScreen[crossAxis] - to.box[crossAxis].center),
          fromSideError: Math.abs(startScreen[normal] - (forward ? side.from : from.box[cross][fromOuter])),
          toSideError: Math.abs(endScreen[normal] - (forward ? side.to : to.box[cross][toOuter])),
          sourceNormalTangent: Math.abs(startNextScreen[normal] - startScreen[normal]) /
            Math.max(0.001, Math.abs(startNextScreen[tangentCross] - startScreen[tangentCross])),
          targetNormalTangent: Math.abs(endScreen[normal] - endPreviousScreen[normal]) /
            Math.max(0.001, Math.abs(endScreen[tangentCross] - endPreviousScreen[tangentCross])),
          fromOuter, toOuter,
          corners: (path.getAttribute('d').match(/Q/g) || []).length,
          forward,
        };
      });
    }, [svg, direction]);

    expect(measurements, direction).toHaveLength(3);
    expect(measurements.filter(edge => edge.forward), direction).toHaveLength(2);
    expect(measurements.filter(edge => !edge.forward), direction).toHaveLength(1);
    for (const edge of measurements) {
      const details = `${direction} ${JSON.stringify(edge)}`;
      expect(edge.fromCrossError, `${details} source center`).toBeLessThanOrEqual(2);
      expect(edge.toCrossError, `${details} target center`).toBeLessThanOrEqual(2);
      expect(edge.fromSideError, `${details} source side`).toBeLessThanOrEqual(2);
      expect(edge.toSideError, `${details} target side`).toBeLessThanOrEqual(2);
      expect(edge.sourceNormalTangent, `${details} source tangent`).toBeGreaterThan(1);
      expect(edge.targetNormalTangent, `${details} target tangent`).toBeGreaterThan(1);
      if (!edge.forward) expect(edge.fromOuter, `${details} return source side`).toBe(edge.toOuter);
      expect(edge.corners, `${direction} corner count`).toBeLessThanOrEqual(2);
    }
  }
});

test('centered attachments support circular nodes and nested subgraph transforms', async ({ page }) => {
  await setup(page);
  const cases = [
    ['flowchart LR\n  A((Start)) --> B[Middle] --> C((Finish))', 'LR'],
    ['flowchart TB\n  subgraph Inner\n    A[First] --> B{Decision}\n  end\n  B --> C((Finish))', 'TB'],
  ];
  for (const [source, direction] of cases) {
    const svg = await renderStyled(page, source);
    const result = await page.evaluate(([svgText, dir]) => {
      document.body.innerHTML = `<div class="mermaid">${svgText}</div>`;
      const vertical = /^(TD|TB|BT)$/.test(dir);
      const axis = vertical ? 'y' : 'x';
      const cross = vertical ? 'x' : 'y';
      const nodes = new Map([...document.querySelectorAll('g.node[data-mpe-key]')].map(node => {
        const shape = node.querySelector('rect, polygon, circle, ellipse');
        const rect = shape.getBoundingClientRect();
        return [node.dataset.mpeKey, { center: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
          min: { x: rect.left, y: rect.top }, max: { x: rect.right, y: rect.bottom }, shapeTag: shape.tagName }];
      }));
      return [...document.querySelectorAll('path.flowchart-link[data-mpe-from][data-mpe-to]')].map(path => {
        const from = nodes.get(path.dataset.mpeFrom), to = nodes.get(path.dataset.mpeTo);
        if (!from || !to) return null;
        const matrix = path.getScreenCTM();
        const start = path.getPointAtLength(0), end = path.getPointAtLength(path.getTotalLength());
        const a = new DOMPoint(start.x, start.y).matrixTransform(matrix);
        const b = new DOMPoint(end.x, end.y).matrixTransform(matrix);
        const sign = Math.sign(to.center[axis] - from.center[axis]);
        return { from: path.dataset.mpeFrom, to: path.dataset.mpeTo,
          crossFrom: Math.abs(a[cross] - from.center[cross]), crossTo: Math.abs(b[cross] - to.center[cross]),
          sideFrom: Math.abs(a[axis] - (sign > 0 ? from.max[axis] : from.min[axis])),
          sideTo: Math.abs(b[axis] - (sign > 0 ? to.min[axis] : to.max[axis])),
          shapeTags: [from.shapeTag, to.shapeTag] };
      }).filter(Boolean);
    }, [svg, direction]);
    expect(result.length, source).toBeGreaterThan(0);
    for (const edge of result) {
      const details = `${direction} ${JSON.stringify(edge)}`;
      expect(edge.crossFrom, `${details} source center`).toBeLessThanOrEqual(2);
      expect(edge.crossTo, `${details} target center`).toBeLessThanOrEqual(2);
      expect(edge.sideFrom, `${details} source boundary`).toBeLessThanOrEqual(2);
      expect(edge.sideTo, `${details} target boundary`).toBeLessThanOrEqual(2);
    }
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
    const markerId = edge.markerEnd?.match(/#([^)'"]+)/)?.[1];
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

test('light and dark themes keep node text and connectors readable with matching shape fills', async ({ page }) => {
  await setup(page);
  const css = fs.readFileSync(path.resolve(__dirname, '../../styles.css'), 'utf8');
  await page.addStyleTag({ content: css });
  const svg = await renderStyled(page, 'flowchart TD\n  Rectangle[Rectangle node] --> Decision{Decision node}\n  Decision --> Finish[Finish]');

  for (const theme of ['theme-light', 'theme-dark']) {
    const colors = await page.evaluate(([svgText, themeName]) => {
      document.body.className = themeName;
      document.body.style.setProperty('--background-primary', themeName === 'theme-dark' ? '#16191f' : '#ffffff');
      document.body.style.setProperty('--background-secondary', themeName === 'theme-dark' ? '#252b34' : '#f7f8fa');
      document.body.style.setProperty('--text-normal', themeName === 'theme-dark' ? '#e6eaf0' : '#333333');
      document.body.innerHTML += `<div class="mermaid">${svgText}</div>`;
      const root = document.querySelector('.mermaid:last-child');
      const rectangle = root.querySelector('.node[data-mpe-key="Rectangle"] rect');
      const diamond = root.querySelector('.node[data-mpe-key="Decision"] polygon');
      const label = root.querySelector('.node[data-mpe-key="Rectangle"] .nodeLabel');
      const edge = root.querySelector('path.flowchart-link');
      return {
        rectangleFill: getComputedStyle(rectangle).fill,
        diamondFill: getComputedStyle(diamond).fill,
        text: getComputedStyle(label).color,
        line: getComputedStyle(edge).stroke,
        canvasBackground: getComputedStyle(document.body).getPropertyValue('--background-primary').trim(),
      };
    }, [svg, theme]);

    expect(colors.diamondFill, theme).toBe(colors.rectangleFill);
    expect(contrastRatio(colors.text, colors.rectangleFill), `${theme} text/node contrast`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.line, colors.canvasBackground), `${theme} line/background contrast`).toBeGreaterThanOrEqual(3);
  }
});

test('dark theme filter is disabled only for enhanced SVGs', async ({ page }) => {
  await setup(page);
  const css = fs.readFileSync(path.resolve(__dirname, '../../styles.css'), 'utf8');
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: '.theme-dark .mermaid svg { filter: invert(1) hue-rotate(180deg) saturate(1.25); }' });
  const diagrams = await page.evaluate(async () => {
    const enhancedSource = 'flowchart TD\n  A[Enhanced] --> B{Processed}';
    const regularSource = 'flowchart TD\n  A[Regular] --> B{Unprocessed}';
    const optOutSource = 'flowchart TD\n  %% mfe:off\n  A[Opt out] --> B{Unprocessed}';
    const [enhanced, regular, optOut] = await Promise.all([
      mermaid.render('dark-enhanced', enhancedSource),
      mermaid.render('dark-regular', regularSource),
      mermaid.render('dark-opt-out', optOutSource),
    ]);
    return {
      enhanced: MPELayout.styleSvg(enhanced.svg, 'TD'),
      regular: regular.svg,
      optOut: optOut.svg,
    };
  });
  await page.evaluate(diagrams => {
    document.body.className = 'theme-dark';
    document.body.innerHTML = Object.entries(diagrams)
      .map(([key, svg]) => `<div class="mermaid" id="${key}">${svg}</div>`).join('');
  }, diagrams);

  const filters = await page.evaluate(() => Object.fromEntries(['enhanced', 'regular', 'optOut'].map(key => {
    const svg = document.querySelector(`#${key} svg`);
    return [key, { filter: getComputedStyle(svg).filter, enhanced: svg.classList.contains('mfe-enhanced') }];
  })));
  expect(filters.enhanced.enhanced).toBe(true);
  expect(filters.enhanced.filter).toBe('none');
  for (const key of ['regular', 'optOut']) {
    expect(filters[key].enhanced).toBe(false);
    expect(filters[key].filter).toContain('invert(1)');
    expect(filters[key].filter).toContain('hue-rotate(180deg)');
  }
});

test('tracing fade and highlight are scoped to enhanced SVG roots', async ({ page }) => {
  await setup(page);
  const css = fs.readFileSync(path.resolve(__dirname, '../../styles.css'), 'utf8');
  await page.addStyleTag({ content: css });
  const diagrams = await page.evaluate(async () => {
    const source = 'flowchart TD\n  A[Start] --> B[Finish]';
    const [enhanced, ordinary] = await Promise.all([
      mermaid.render('tracing-enhanced', source),
      mermaid.render('tracing-ordinary', source),
    ]);
    return { enhanced: MPELayout.styleSvg(enhanced.svg, 'TD'), ordinary: ordinary.svg };
  });
  const ordinaryBefore = await page.evaluate(diagrams => {
    document.body.innerHTML = `<div class="mermaid" id="enhanced">${diagrams.enhanced}</div>` +
      `<div class="mermaid" id="ordinary">${diagrams.ordinary}</div>`;
    const ordinary = document.querySelector('#ordinary svg');
    const ordinaryNode = ordinary.querySelector('.node');
    const ordinaryEdge = ordinary.querySelector('path.flowchart-link');
    const baseline = { opacity: getComputedStyle(ordinaryNode).opacity,
      stroke: getComputedStyle(ordinaryEdge).stroke, filter: getComputedStyle(ordinary).filter };
    const enhanced = document.querySelector('#enhanced svg');
    enhanced.classList.add('mpe-tracing');
    enhanced.querySelector('.node[data-mpe-key="A"]').classList.add('mpe-on-path');
    enhanced.querySelector('path.flowchart-link').classList.add('mpe-on-path');
    ordinary.classList.add('mpe-tracing');
    ordinary.querySelector('.node').classList.add('mpe-on-path');
    ordinary.querySelector('path.flowchart-link').classList.add('mpe-on-path');
    return baseline;
  }, diagrams);
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const enhanced = document.querySelector('#enhanced svg');
    const ordinary = document.querySelector('#ordinary svg');
    const selected = enhanced.querySelector('.node[data-mpe-key="A"]');
    const faded = enhanced.querySelector('.node[data-mpe-key="B"]');
    const selectedShape = selected.querySelector('rect');
    const enhancedEdge = enhanced.querySelector('path.flowchart-link');
    const ordinaryNode = ordinary.querySelector('.node');
    const ordinaryEdge = ordinary.querySelector('path.flowchart-link');
    return {
      fadedOpacity: getComputedStyle(faded).opacity,
      selectedOpacity: getComputedStyle(selected).opacity,
      nodeStroke: getComputedStyle(selectedShape).stroke,
      edgeStroke: getComputedStyle(enhancedEdge).stroke,
      highlight: getComputedStyle(enhanced).getPropertyValue('--mpe-highlight').trim(),
      ordinaryOpacity: getComputedStyle(ordinaryNode).opacity,
      ordinaryEdgeStroke: getComputedStyle(ordinaryEdge).stroke,
      ordinaryFilter: getComputedStyle(ordinary).filter,
    };
  });
  expect(result.fadedOpacity).toBe('0.22');
  expect(result.selectedOpacity).toBe('1');
  expect(result.nodeStroke).toBe('rgb(131, 185, 232)');
  expect(result.edgeStroke).toBe('rgb(131, 185, 232)');
  expect(result.highlight).toBe('#83b9e8');
  expect(result.ordinaryOpacity).toBe(ordinaryBefore.opacity);
  expect(result.ordinaryEdgeStroke).toBe(ordinaryBefore.stroke);
  expect(result.ordinaryFilter).toBe(ordinaryBefore.filter);
});
