const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

class FakePlugin {
  constructor() {
    this.disposers = []; this.domEvents = []; this.events = []; this.data = {}; this.leaves = [];
    const handlers = this.handlers = {};
    this.app = { workspace: { on: (name, callback) => { handlers[name] = callback; return { name }; },
      onLayoutReady: callback => callback(), iterateAllLeaves: callback => this.leaves.forEach(callback) } };
  }
  registerEvent(ref) { this.events.push(ref); }
  loadData() { return this.dataPromise || Promise.resolve(this.data); }
  saveData(value) { this.saved = value; return Promise.resolve(); }
  addSettingTab(tab) { this.tab = tab; }
  register(dispose) { this.disposers.push(dispose); }
  registerDomEvent(target, name, handler) { this.domEvents.push({ target, name, handler }); }
}

let mermaid;
let loadMermaidCalls = 0;
let styleCalls;
let styleError = null;
let controllers = [];
const mockObsidian = {
  Plugin: FakePlugin,
  PluginSettingTab: class {},
  Setting: class {},
  async loadMermaid() { loadMermaidCalls++; return mermaid; },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') return mockObsidian;
  if (request === './layout') return {
    wrapDecisions: source => source.replace('long decision', 'long<br/>decision'),
    widenSingleRectangles: source => source,
    styleSvg: (svg, direction, settings) => {
      styleCalls.push({ direction, settings });
      if (styleError) throw styleError;
      return `${svg}|styled`;
    },
  };
  if (request === './highlight') return {
    createPathController: (doc, getSettings) => {
      const controller = { doc, getSettings, enter() {}, leave() {}, dispose() { this.disposed = true; } };
      controllers.push(controller);
      return controller;
    },
  };
  if (request === './settings') return {
    normalizeSettings: value => ({ compactLayout: true, pathHighlight: true,
      animationDuration: 450, hoverDelay: 180, ...value }),
    EnhancerSettingsTab: class {},
  };
  return originalLoad.call(this, request, parent, isMain);
};
const Plugin = require('../../src/main.ts').default;
Module._load = originalLoad;

function fakeDocument(theme = 'theme-dark') {
  return { body: { classList: { contains: name => name === theme } }, querySelectorAll: () => [] };
}

test('renderer wrapper preserves YAML order, applies diagram defaults, and passes transformed output', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument();
  const calls = [];
  const original = async function (id, source, ...rest) {
    calls.push({ id, source, rest });
    return { svg: '<svg/>', bindFunctions: 'preserved' };
  };
  mermaid = { render: original };
  loadMermaidCalls = 0; styleCalls = [];
  const plugin = new Plugin();
  plugin.data = { compactLayout: true, pathHighlight: true, animationDuration: 700, hoverDelay: 90 };
  await plugin.onload();
  const source = '---\ntitle: Example\n---\nflowchart TD\n  A[long decision] --> B';
  const result = await mermaid.render('render-1', source, 'extra');
  assert.equal(calls.length, 1);
  const config = calls[0].source;
  assert.ok(config.startsWith('---\ntitle: Example\n---\n%%{init:'));
  assert.ok(config.includes('"theme":"dark"'));
  assert.ok(config.includes('long<br/>decision'));
  assert.ok(config.indexOf('---\n') < config.indexOf('%%{init:'));
  assert.deepEqual(calls[0].rest, ['extra']);
  assert.equal(result.svg, '<svg/>|styled');
  assert.equal(result.bindFunctions, 'preserved');
  assert.equal(styleCalls[0].direction, 'TD');
  assert.equal(styleCalls[0].settings.animationDuration, 700);
  assert.equal(loadMermaidCalls, 1);
  plugin.disposers.at(-1)();
  assert.equal(mermaid.render, original);
  for (const dispose of plugin.disposers) dispose();
  global.document = previousDocument;
});

test('renderer wrapper bypasses disabled, unsupported, and non-string diagrams', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument('theme-light');
  const calls = [];
  const original = async function (...args) { calls.push(args); return '<svg/>'; };
  mermaid = { render: original }; styleCalls = [];
  const plugin = new Plugin();
  await plugin.onload();
  await mermaid.render('off', 'flowchart TD\n%% mfe:off\nA-->B');
  await mermaid.render('seq', 'sequenceDiagram\nA->>B: Hi');
  await mermaid.render('obj', { code: 'flowchart TD' });
  assert.equal(calls.length, 3);
  assert.equal(calls[0][1], 'flowchart TD\n%% mfe:off\nA-->B');
  assert.equal(calls[1][1], 'sequenceDiagram\nA->>B: Hi');
  assert.deepEqual(calls[2][1], { code: 'flowchart TD' });
  assert.equal(styleCalls.length, 0);
  for (const dispose of plugin.disposers) dispose();
  global.document = previousDocument;
});

test('unload during asynchronous settings loading stops initialization', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument();
  let resolveData;
  const plugin = new Plugin();
  plugin.dataPromise = new Promise(resolve => { resolveData = resolve; });
  loadMermaidCalls = 0;
  const loading = plugin.onload();
  plugin.onunload();
  resolveData({});
  await loading;
  assert.equal(loadMermaidCalls, 0);
  assert.equal(plugin.domEvents.length, 0);
  global.document = previousDocument;
});

test('main initializes defaults when Obsidian returns null for empty stored data', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument();
  const original = async () => '<svg/>';
  mermaid = { render: original };
  const plugin = new Plugin();
  plugin.data = null;
  await plugin.onload();
  assert.deepEqual(plugin.settings, {
    compactLayout: true, pathHighlight: true, animationDuration: 450, hoverDelay: 180,
  });
  for (const dispose of plugin.disposers) dispose();
  global.document = previousDocument;
});

test('transformation errors return the renderer result and unloading restores renderer', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument();
  const originalResult = { svg: '<svg id="original"/>', bindFunctions: () => 'bound' };
  const original = async () => originalResult;
  mermaid = { render: original }; styleCalls = [];
  const warnings = [];
  const oldWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  styleError = new Error('synthetic transformation error');
  const plugin = new Plugin();
  await plugin.onload();
  assert.equal(await mermaid.render('id', 'flowchart TD\nA-->B'), originalResult);
  assert.match(warnings[0][0], /kept original SVG/);
  assert.equal(warnings[0][1], styleError);
  for (const dispose of plugin.disposers) dispose();
  assert.equal(mermaid.render, original);
  styleError = null;
  console.warn = oldWarn;
  global.document = previousDocument;
});

test('Obsidian 1.15 Pele rendering is laid out and traced instead of wrapping the Mermaid shim', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument();
  const original = async () => '<svg/>';
  mermaid = { render: original }; styleCalls = [];
  const queried = [], configs = [];
  const pele = { mount(element, text, options) {
    configs.push(options.config);
    options.onRender({});
    return { source: text, update() {} };
  } };
  globalThis.pele = pele;
  const plugin = new Plugin();
  await plugin.onload();
  assert.equal(mermaid.render, original);
  assert.notEqual(globalThis.pele, pele);
  const marked = [];
  const element = { querySelector: selector => { queried.push(selector); return null; },
    classList: { toggle: (name, on) => marked.push([name, on]) } };
  globalThis.pele.mount(element, 'flowchart LR\nA-->B', { config: { theme: 'kept' } });
  globalThis.pele.mount(element, 'flowchart LR\n%% mfe:off\nA-->B');
  plugin.settings.compactLayout = false;
  globalThis.pele.mount(element, 'flowchart LR\nA-->B');
  assert.deepEqual(configs, [{ theme: 'kept', flowchart: { curve: 'step', nodeSpacing: 28, rankSpacing: 26, wrappingWidth: 140 } },
    undefined, undefined]);
  assert.deepEqual(queried, Array(3).fill(':scope > svg.pele-flowchart'));
  assert.deepEqual(marked, [['mfe-flow', true], ['mfe-flow', false], ['mfe-flow', true]]);
  assert.equal(styleCalls.length, 0);
  for (const dispose of plugin.disposers) dispose();
  assert.equal(globalThis.pele, pele);
  delete globalThis.pele;
  global.document = previousDocument;
});

test('every window, including popouts, gets its own path controller once', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument();
  mermaid = { render: async () => '<svg/>' };
  controllers = [];
  const plugin = new Plugin();
  const restored = fakeDocument();
  plugin.leaves = [{ view: { containerEl: { ownerDocument: restored } } }, { view: { containerEl: { ownerDocument: global.document } } }];
  await plugin.onload();
  const popout = fakeDocument();
  plugin.handlers['window-open']({}, { document: popout });
  plugin.handlers['window-open']({}, { document: popout });
  assert.deepEqual(controllers.map(c => c.doc), [global.document, restored, popout]);
  for (const doc of [global.document, restored, popout])
    assert.deepEqual(plugin.domEvents.filter(e => e.target === doc).map(e => e.name), ['pointerover', 'pointerout', 'focusin', 'focusout']);
  assert.deepEqual(plugin.events, [{ name: 'window-open' }]);
  for (const dispose of plugin.disposers) dispose();
  assert.equal(controllers.every(c => c.disposed), true);
  global.document = previousDocument;
});
