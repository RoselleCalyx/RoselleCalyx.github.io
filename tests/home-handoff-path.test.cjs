'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/saturn.js'), 'utf8');
const start = source.indexOf('  function handoffPose(');
const end = source.indexOf('  function drawHandoff(', start);
assert.ok(start >= 0 && end > start, 'exercise the production falling-remnant path');
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function pathFor(width, height, dpr) {
  // Deliberately far from the old 52%-of-screen destination to expose diagonal drift.
  const sx = width * .31 * dpr, sy = height * .23 * dpr;
  const endY = height * .78 * dpr;
  const context = { Math, smooth, dpr, p: 1,
    burnFlight: () => ({ x: sx, y: sy }), P: (x, y) => [x, y],
    cvFall: { width: width * dpr, height: height * dpr }, descent: { endY } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.pose = handoffPose;', context);
  return { pose: context.pose, sx, sy, endY };
}

const sizes = [[320, 568], [390, 844], [844, 390], [1440, 960], [2560, 1080]];
const densities = [.8, 1, 1.5, 2, 3];
const samples = Array.from({ length: 201 }, (_, i) => i / 200);

test('Home remnant falls vertically with at most four CSS pixels of sway across screens and zoom', () => {
  let visibleSway = false;
  for (const [width, height] of sizes) for (const dpr of densities) {
    const { pose, sx, sy, endY } = pathFor(width, height, dpr);
    const first = pose(0, false);
    assert.equal(first.x, sx); assert.equal(first.y, sy);
    let previousY = sy;
    for (const q of samples) {
      const current = pose(q, false), drift = Math.abs(current.x - sx) / dpr;
      assert.ok(drift <= 4 + 1e-9, `${width}x${height} @${dpr}, q=${q}: drift ${drift}`);
      assert.ok(current.y >= previousY, 'vertical motion stays downward');
      assert.ok(current.y <= endY + 1e-9, 'path stops at the biography clearance altitude');
      visibleSway ||= drift > .1;
      previousY = current.y;
    }
    assert.ok(Math.abs(pose(1, false).y - endY) < 1e-9, 'endpoint matches the biography clearance altitude');
    assert.ok(Math.abs(pose(1, false).x - sx) / dpr < 1e-9, 'sway returns to its starting column');
  }
  assert.ok(visibleSway, 'normal motion retains a slight wobble');
});

test('Home calm mode retains the burn position across screens and zoom', () => {
  for (const [width, height] of sizes) for (const dpr of densities) {
    const { pose, sx, sy } = pathFor(width, height, dpr);
    for (const q of samples) {
      const current = pose(q, true);
      assert.equal(current.x, sx); assert.equal(current.y, sy);
    }
  }
});

test('Home path reverses deterministically when visitors scroll back', () => {
  for (const [width, height] of sizes) for (const dpr of densities) {
    const { pose } = pathFor(width, height, dpr);
    const forward = samples.map(q => pose(q, false));
    for (let i = samples.length - 1; i >= 0; i--) {
      const reverse = pose(samples[i], false);
      assert.equal(reverse.x, forward[i].x);
      assert.equal(reverse.y, forward[i].y);
      assert.equal(reverse.scale, forward[i].scale);
    }
  }
});
