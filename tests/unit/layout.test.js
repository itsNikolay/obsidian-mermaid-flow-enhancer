const test = require('node:test');
const assert = require('node:assert/strict');
const { orthogonalPath, roundPath } = require('../../src/layout');

test('orthogonalPath routes branches through the shared branch level', () => {
  assert.equal(orthogonalPath([[20, 10], [30, 30], [50, 60]], 'TD', 10, 60, 40),
    'M20,10L20,40L50,40L50,60');
});

test('orthogonalPath supports reverse and horizontal directions', () => {
  assert.equal(orthogonalPath([[20, 90], [30, 60], [50, 10]], 'BT', 90, 10),
    'M20,90L20,50L50,50L50,10');
  assert.equal(orthogonalPath([[90, 20], [60, 30], [10, 50]], 'RL', 90, 10),
    'M90,20L50,20L50,50L10,50');
});

test('orthogonalPath declines routes that run against graph direction', () => {
  assert.equal(orthogonalPath([[0, 2], [5, 0]], 'TD'), null);
  assert.equal(orthogonalPath([[0, 0], [5, 2]], 'LR', 10, 5), null);
});

test('roundPath rounds right angle corners and preserves straight paths', () => {
  assert.equal(roundPath('M0,0L10,0L10,20', 2), 'M0,0L8,0Q10,0 10,2L10,20');
  assert.equal(roundPath('M0,0L10,0', 2), 'M0,0L10,0');
});

test('roundPath leaves curves and malformed paths untouched', () => {
  for (const path of ['M0,0C1,2 3,4 5,6', 'M0,0L10,']) {
    assert.equal(roundPath(path), path);
  }
});
