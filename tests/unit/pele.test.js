const test = require('node:test');
const assert = require('node:assert/strict');
const { flowDirection, patchPele, preparePeleDiagram } = require('../../src/pele.ts');

// Pele's exports are getters, as in its bundled global build.
function fakePele(mount) {
  const pele = {};
  for (const [name, value] of Object.entries({ mount, render: () => 'rendered' }))
    Object.defineProperty(pele, name, { get: () => value, enumerable: true });
  return pele;
}

// Draws on mount and again on update, like Pele's mount.
function fakeMount(element, text, options) {
  let source = text;
  options.onRender({ svg: source });
  return {
    get source() { return source; },
    update(next, nextOptions = options) { source = next; options = nextOptions; options.onRender({ svg: source }); },
  };
}

test('flowDirection reads flowchart directions and honors the opt-out comment', () => {
  assert.equal(flowDirection('flowchart LR\n  A --> B'), 'LR');
  assert.equal(flowDirection('---\ntitle: T\n---\ngraph BT\n  A --> B'), 'BT');
  assert.equal(flowDirection('%% mfe:off\nflowchart TD\n  A --> B'), undefined);
  assert.equal(flowDirection('sequenceDiagram\n  A->>B: Hi'), undefined);
});

test('patched Pele traces every drawing with its current text and keeps the host callback', () => {
  const host = { pele: fakePele(fakeMount) };
  const original = host.pele;
  const traced = [], rendered = [];
  const restore = patchPele(host, { prepare: () => undefined, trace: (element, source) => traced.push([element, source]) });
  assert.notEqual(host.pele, original);
  assert.equal(host.pele.render(), 'rendered');
  const element = { id: 'diagram' };
  const options = { zoom: false, onRender(result) { rendered.push([this.zoom, result.svg]); } };
  const mounted = host.pele.mount(element, 'flowchart LR\nA-->B', options);
  mounted.update('flowchart TD\nA-->B');
  assert.deepEqual(traced, [[element, 'flowchart LR\nA-->B'], [element, 'flowchart TD\nA-->B']]);
  assert.deepEqual(rendered, [[false, 'flowchart LR\nA-->B'], [false, 'flowchart TD\nA-->B']]);
  restore();
  assert.equal(host.pele, original);
  mounted.update('flowchart BT\nA-->B');
  assert.equal(traced.length, 2);
  assert.equal(rendered.length, 3);
});

test('tracing errors keep the Pele drawing and restore leaves a newer patch alone', () => {
  const host = { pele: fakePele(fakeMount) };
  const warnings = [];
  const oldWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  const failure = new Error('synthetic tracing error');
  const restore = patchPele(host, { prepare: () => undefined, trace: () => { throw failure; } });
  let rendered = 0;
  host.pele.mount({}, 'flowchart LR\nA-->B', { onRender() { rendered++; } });
  console.warn = oldWarn;
  assert.equal(rendered, 1);
  assert.match(warnings[0][0], /without path tracing/);
  assert.equal(warnings[0][1], failure);
  const newer = { mount: () => ({}) };
  host.pele = newer;
  restore();
  assert.equal(host.pele, newer);
});

test('patchPele does nothing without Pele', () => {
  const host = {};
  patchPele(host, { prepare: () => undefined, trace: () => {} })();
  assert.equal('pele' in host, false);
});

test('patched Pele lays out each text it is given, unless the layout or plugin declines', () => {
  const host = { pele: fakePele((element, text, options) => {
    const configs = [options.config];
    options.onRender({});
    return { configs, source: text,
      update(next, nextOptions = options) { options = nextOptions; configs.push(options.config); options.onRender?.({}); } };
  }) };
  const prepared = [];
  const element = { id: 'diagram' };
  const prepare = (target, source) => { prepared.push([target, source]); return source.includes('off') ? undefined : { curve: 'step' }; };
  const restore = patchPele(host, { prepare, trace: () => {} });
  const mounted = host.pele.mount(element, 'flowchart LR', { config: { flowchart: { htmlLabels: false }, theme: 'own' } });
  mounted.update('flowchart LR off');
  mounted.update('flowchart TD');
  mounted.update('flowchart TD', { config: { theme: 'host' } });
  restore();
  mounted.update('flowchart BT');
  assert.deepEqual(mounted.configs, [
    { theme: 'own', flowchart: { htmlLabels: false, curve: 'step' } },
    { theme: 'own', flowchart: { htmlLabels: false } },
    { theme: 'own', flowchart: { htmlLabels: false, curve: 'step' } },
    { theme: 'host' },
    { theme: 'own', flowchart: { htmlLabels: false } },
  ]);
  // Prepared before each drawing it chose options for; not after unloading.
  assert.deepEqual(prepared, [[element, 'flowchart LR'], [element, 'flowchart LR off'], [element, 'flowchart TD']]);
});

test('preparePeleDiagram marks enhanced flowcharts and lays out only those', () => {
  const classes = new Set(['mermaid']);
  const element = { classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name), on) } };
  const layout = { curve: 'step' };
  assert.equal(preparePeleDiagram(element, 'flowchart TD\nA-->B', layout), layout);
  assert.equal(classes.has('mfe-flow'), true);
  assert.equal(preparePeleDiagram(element, 'flowchart TD\nA-->B', undefined), undefined);
  assert.equal(classes.has('mfe-flow'), true);
  assert.equal(preparePeleDiagram(element, '%% mfe:off\nflowchart TD\nA-->B', layout), undefined);
  assert.equal(classes.has('mfe-flow'), false);
  assert.equal(preparePeleDiagram(element, 'sequenceDiagram\nA->>B: Hi', layout), undefined);
  assert.equal(classes.has('mfe-flow'), false);
});
