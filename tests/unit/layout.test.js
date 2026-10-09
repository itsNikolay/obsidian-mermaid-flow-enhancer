const test = require('node:test');
const assert = require('node:assert/strict');
const { orthogonalPath, roundPath, routePoints, returnLanePath } = require('../../src/layout.ts');

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
  assert.equal(orthogonalPath([[0, 0], [5, 2]], 'LR', 10, 5), null);
});

test('orthogonalPath routes reverse travel with two rounded corners', () => {
  const path = orthogonalPath([[20, 90], [50, 10]], 'TD', 90, 10);
  assert.equal(path, 'M20,90L20,50L50,50L50,10');
  assert.equal((roundPath(path).match(/Q/g) || []).length, 2);
});

test('returnLanePath simplifies outer return lanes in vertical and horizontal graphs', () => {
  const a = { center: [20, 90], min: [10, 80], max: [30, 100] };
  const b = { center: [30, 10], min: [20, 0], max: [40, 20] };
  assert.equal(returnLanePath([[20, 90], [10, 80], [5, 20], [30, 10]], 'TD', a, b),
    'M10,90L-6,90L-6,10L20,10');
  const c = { center: [90, 20], min: [80, 10], max: [100, 30] };
  const d = { center: [10, 30], min: [0, 20], max: [20, 40] };
  assert.equal(returnLanePath([[90, 20], [80, 10], [20, 5], [10, 30]], 'LR', c, d),
    'M90,10L90,-6L10,-6L10,20');
  assert.equal(returnLanePath([[20, 90], [50, 10]], 'TD'), null);
});

test('routePoints accepts Mermaid M/L/Q routes and safely rejects unsupported curves', () => {
  assert.deepEqual(routePoints('M0,0L10,0Q12,0 12,2L12,10'),
    [[0, 0], [10, 0], [12, 0], [12, 2], [12, 10]]);
  assert.equal(routePoints('M0,0C1,2 3,4 5,6'), null);
  assert.equal(routePoints('M0,0Qbad'), null);
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
