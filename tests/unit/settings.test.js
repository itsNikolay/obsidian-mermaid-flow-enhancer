const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') return { PluginSettingTab: class {}, Setting: class {} };
  return originalLoad.call(this, request, parent, isMain);
};
const { DEFAULT_SETTINGS, normalizeSettings } = require('../../src/settings.ts');
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
