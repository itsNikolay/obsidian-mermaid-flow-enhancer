const test = require('node:test');
const assert = require('node:assert/strict');
const { createPathController } = require('../../src/highlight');

function makeClassList() {
  const values = new Set();
  return { add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item), toggle(item, force) {
      const on = force ?? !values.has(item);
      if (on) values.add(item); else values.delete(item);
      return on;
    } };
}

function fakeSvg() {
  const svg = { classList: makeClassList(), elements: [], paths: [],
    querySelectorAll(selector) {
      if (selector === '[data-mpe-from][data-mpe-to]') return this.paths;
      if (selector === '.mpe-on-path') return this.elements.filter(e => e.classList.contains('mpe-on-path'));
      if (selector.startsWith('.node,')) return this.elements;
      return [];
    } };
  function element(key, edge) {
    const attrs = edge ? { 'data-id': edge.id, 'data-mpe-from': edge.from,
      'data-mpe-to': edge.to, 'data-mpe-forward': String(edge.forward) }
      : { 'data-mpe-key': key };
    return { attrs, classList: makeClassList(), id: '',
      getAttribute(name) { return attrs[name] ?? null; },
      closest(selector) { return selector === 'svg' ? svg : this; },
      querySelector() { return null; }, contains(other) { return other === this; } };
  }
  const a = element('A'), b = element('B'), c = element('C');
  const ab = element(null, { id: 'ab', from: 'A', to: 'B', forward: true });
  const bc = element(null, { id: 'bc', from: 'B', to: 'C', forward: true });
  const cb = element(null, { id: 'cb', from: 'C', to: 'B', forward: false });
  svg.elements = [a, b, c, ab, bc, cb]; svg.paths = [ab, bc, cb];
  return { svg, a, b, c, ab, bc, cb };
}

test('path controller transitions between targets and delays clearing after pointer leaves', () => {
  const dom = fakeSvg();
  const settings = { pathHighlight: true, hoverDelay: 180 };
  let current = 0;
  const callbacks = new Map();
  const cleared = [];
  const timers = { setTimeout(fn, delay) { callbacks.set(++current, { fn, delay }); return current; },
    clearTimeout(id) { if (id) cleared.push(id); callbacks.delete(id); } };
  const controller = createPathController({ querySelectorAll: () => [dom.svg] }, () => settings, timers);
  const event = target => ({ target: { closest: selector => selector.includes('svg.mfe-enhanced') ? target : dom.svg }, relatedTarget: null });

  controller.enter(event(dom.b));
  assert.equal(dom.svg.classList.contains('mpe-tracing'), true);
  assert.equal(dom.ab.classList.contains('mpe-on-path'), true);
  assert.equal(dom.bc.classList.contains('mpe-on-path'), false);
  assert.equal(dom.cb.classList.contains('mpe-on-path'), false);

  controller.leave(event(dom.b));
  const timerId = current;
  assert.equal(callbacks.get(timerId).delay, 180);
  controller.enter(event(dom.c));
  assert.deepEqual(cleared, [timerId]);
  assert.equal(dom.bc.classList.contains('mpe-on-path'), true);
  assert.equal(dom.svg.classList.contains('mpe-tracing'), true);

  controller.leave(event(dom.c));
  callbacks.get(current).fn();
  assert.equal(dom.svg.classList.contains('mpe-tracing'), false);
  assert.equal(dom.ab.classList.contains('mpe-on-path'), false);
});

test('disabled highlighting and dispose prevent further path changes', () => {
  const dom = fakeSvg();
  let settings = { pathHighlight: false, hoverDelay: 30 };
  let next = 0;
  const callbacks = new Map();
  const timers = { setTimeout(fn) { callbacks.set(++next, fn); return next; },
    clearTimeout(id) { callbacks.delete(id); } };
  const controller = createPathController({ querySelectorAll: () => [dom.svg] }, () => settings, timers);
  const event = target => ({ target: { closest: () => target }, relatedTarget: null });
  controller.enter(event(dom.b));
  assert.equal(dom.svg.classList.contains('mpe-tracing'), false);
  settings = { pathHighlight: true, hoverDelay: 30 };
  controller.enter(event(dom.b));
  controller.leave(event(dom.b));
  assert.equal(callbacks.size, 1);
  controller.dispose();
  assert.equal(callbacks.size, 0);
  assert.equal(dom.svg.classList.contains('mpe-tracing'), false);
  controller.enter(event(dom.c));
  assert.equal(dom.svg.classList.contains('mpe-tracing'), false);
});
