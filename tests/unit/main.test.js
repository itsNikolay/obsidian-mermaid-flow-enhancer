const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

class FakePlugin {
  constructor() { this.disposers = []; this.domEvents = []; this.data = {}; }
  loadData() { return this.dataPromise || Promise.resolve(this.data); }
  saveData(value) { this.saved = value; return Promise.resolve(); }
  addSettingTab(tab) { this.tab = tab; }
  register(dispose) { this.disposers.push(dispose); }
  registerDomEvent(target, name, handler) { this.domEvents.push({ target, name, handler }); }
}

let mermaid;
let loadMermaidCalls = 0;
let styleCalls;
let lastController;
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
    styleSvg: (svg, direction, settings) => { styleCalls.push({ direction, settings }); return `${svg}|styled`; },
  };
  if (request === './highlight') return {
    createPathController: (doc, getSettings) => {
      lastController = { doc, getSettings, enter() {}, leave() {}, dispose() { this.disposed = true; } };
      return lastController;
    },
  };
  if (request === './settings') return {
    normalizeSettings: value => ({ compactLayout: true, pathHighlight: true,
      animationDuration: 450, hoverDelay: 180, ...value }),
    EnhancerSettingsTab: class {},
  };
  return originalLoad.call(this, request, parent, isMain);
};
const Plugin = require('../../src/main');
Module._load = originalLoad;

function fakeDocument(theme = 'theme-dark') {
  return { body: { classList: { contains: name => name === theme } }, querySelectorAll: () => [] };
}

test('renderer wrapper preserves YAML order, applies diagram defaults, and passes transformed output', async () => {
  const previousDocument = global.document;
  global.document = fakeDocument();
  let calls = [];
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
