const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') return { PluginSettingTab: class {} };
  return originalLoad.call(this, request, parent, isMain);
};
const { DEFAULT_SETTINGS, normalizeSettings, EnhancerSettingsTab } = require('../../src/settings.ts');
Module._load = originalLoad;

test('normalizeSettings supplies defaults and clamps numeric settings', () => {
  assert.deepEqual(normalizeSettings(), { ...DEFAULT_SETTINGS });
  assert.deepEqual(normalizeSettings({ compactLayout: false, pathHighlight: false,
    animationDuration: 3000, hoverDelay: -50 }), {
    compactLayout: false, pathHighlight: false, animationDuration: 2000, hoverDelay: 0,
  });
});

test('normalizeSettings rejects invalid values and rounds numeric values', () => {
  assert.deepEqual(normalizeSettings({ compactLayout: 0, pathHighlight: null,
    animationDuration: 23.7, hoverDelay: NaN }), {
    compactLayout: true, pathHighlight: true, animationDuration: 24,
    hoverDelay: DEFAULT_SETTINGS.hoverDelay,
  });
});

test('normalizeSettings handles missing, null, and malformed persisted data', () => {
  assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS });
  assert.deepEqual(normalizeSettings([]), { ...DEFAULT_SETTINGS });
  assert.deepEqual(normalizeSettings('invalid'), { ...DEFAULT_SETTINGS });
});

test('settings definitions expose searchable names and declarative controls with existing defaults and limits', () => {
  const tab = new EnhancerSettingsTab({}, { settings: { ...DEFAULT_SETTINGS } });
  const definitions = tab.getSettingDefinitions();
  assert.deepEqual(definitions.map(definition => definition.name), [
    'Compact layout', 'Highlight ancestor paths', 'Animation duration (ms)', 'Hover reset delay (ms)',
  ]);
  assert.ok(definitions.every(definition => definition.searchable !== false && !definition.render));
  assert.deepEqual(definitions.map(definition => definition.control), [
    { type: 'toggle', key: 'compactLayout', defaultValue: true },
    { type: 'toggle', key: 'pathHighlight', defaultValue: true },
    { type: 'slider', key: 'animationDuration', defaultValue: 450, min: 0, max: 2000, step: 10 },
    { type: 'slider', key: 'hoverDelay', defaultValue: 180, min: 0, max: 1000, step: 10 },
  ]);
  assert.match(definitions[0].desc, /Reopen the note to apply/);
  assert.match(definitions[1].desc, /keyboard focus/);
});

test('declarative settings read current values and save each change through the plugin', async () => {
  const saved = [];
  const plugin = {
    settings: { compactLayout: true, pathHighlight: true, animationDuration: 700, hoverDelay: 90 },
    async saveSettings() { saved.push({ ...this.settings }); },
  };
  const tab = new EnhancerSettingsTab({}, plugin);
  assert.equal(tab.getControlValue('animationDuration'), 700);
  for (const [key, value] of [
    ['compactLayout', false], ['pathHighlight', false], ['animationDuration', 830], ['hoverDelay', 120],
  ]) {
    await tab.setControlValue(key, value);
    assert.equal(tab.getControlValue(key), value);
    assert.equal(saved.at(-1)[key], value);
  }
  assert.equal(saved.length, 4);
  assert.deepEqual(plugin.settings, { compactLayout: false, pathHighlight: false, animationDuration: 830, hoverDelay: 120 });
  plugin.settings = { ...DEFAULT_SETTINGS };
  assert.equal(tab.getControlValue('animationDuration'), DEFAULT_SETTINGS.animationDuration);
});

test('declarative settings preserve normalization and ignore unknown control keys', async () => {
  let saves = 0;
  const plugin = { settings: { ...DEFAULT_SETTINGS }, async saveSettings() { saves++; } };
  const tab = new EnhancerSettingsTab({}, plugin);
  await tab.setControlValue('animationDuration', 2400);
  await tab.setControlValue('hoverDelay', 23.7);
  await tab.setControlValue('compactLayout', 'invalid');
  assert.deepEqual(plugin.settings, { compactLayout: true, pathHighlight: true, animationDuration: 2000, hoverDelay: 24 });
  const before = plugin.settings;
  await tab.setControlValue('unknown', false);
  await tab.setControlValue('__proto__', {});
  assert.equal(tab.getControlValue('unknown'), undefined);
  assert.equal(tab.getControlValue('__proto__'), undefined);
  assert.equal(plugin.settings, before);
  assert.equal(saves, 3);
});
