const test = require('node:test');
const assert = require('node:assert/strict');
const { ancestorPath } = require('../../src/highlight');

test('ancestorPath returns all ancestors and their edges, including cycles', () => {
  const edges = [
    { id: 'a-b', from: 'a', to: 'b' },
    { id: 'b-c', from: 'b', to: 'c' },
    { id: 'a-c', from: 'a', to: 'c' },
    { id: 'c-a', from: 'c', to: 'a' },
    { id: 'x-y', from: 'x', to: 'y' },
  ];
  const result = ancestorPath(edges, 'c');
  assert.deepEqual([...result.nodes].sort(), ['a', 'b', 'c']);
  assert.deepEqual([...result.edges].sort(), ['a-b', 'a-c', 'b-c', 'c-a']);
});

test('ancestorPath returns the target alone when it has no incoming edges', () => {
  const result = ancestorPath([], 'start');
  assert.deepEqual([...result.nodes], ['start']);
  assert.equal(result.edges.size, 0);
});
