'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/saturn.js'), 'utf8');
const start = source.indexOf('  function documentTop(el)'), end = source.indexOf('  function readScroll()', start);
assert.ok(start >= 0 && end > start, 'exercise the production handoff geometry');

function geometry({ hidden = [], noLayout = [], missing = [] } = {}) {
  const parent = { offsetTop: 3200, offsetParent: null };
  const nodes = Object.fromEntries(['about', 'education', 'news', 'explore', 'site-footer'].map((id, index) => [id, {
    id, hidden: hidden.includes(id), offsetTop: 200 + index * 400, offsetParent: parent,
    getClientRects() { return this.hidden || noLayout.includes(id) ? [] : [{}]; }
  }]));
  for (const id of missing) delete nodes[id];
  const context = { bio: nodes.about, document: { getElementById: id => nodes[id] }, F: {}, FINAL_ENTRY: 1,
    burnFlight: () => ({ x: 400, y: 200 }), P: (x, y) => [x * 2, y * 2], dpr: 2, vw: 1440, vh: 1000,
    story: { offsetTop: 0, offsetHeight: 3000, offsetParent: null } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.anchor = descentAnchor(); this.geometry = descentGeometry();', context);
  return { id: context.anchor?.id, value: context.geometry && JSON.parse(JSON.stringify(context.geometry)) };
}

test('Home handoff keeps its existing geometry while About is visible', () => {
  const result = geometry();
  assert.equal(result.id, 'about');
  assert.deepEqual(result.value, { sx: 800, sy: 400, start: 1980, border: 3400, clearance: 24, endY: 1040, distance: 876 });
});

test('hiding About anchors the handoff to the first visible remaining Home section', () => {
  for (const [hidden, expected, border] of [
    [['about'], 'education', 3800],
    [['about', 'education'], 'news', 4200],
    [['about', 'education', 'news'], 'explore', 4600],
    [['about', 'education', 'news', 'explore'], 'site-footer', 5000]
  ]) {
    const result = geometry({ hidden });
    assert.equal(result.id, expected); assert.equal(result.value.border, border);
    assert.ok(result.value.border - result.value.start - result.value.clearance > 0, 'visible sections never clip the falling light against a zero-height hidden border');
  }
});

test('missing or CSS-hidden sections do not become handoff anchors', () => {
  assert.equal(geometry({ missing: ['about'], noLayout: ['education', 'news'] }).id, 'explore');
  assert.equal(geometry({ hidden: ['about', 'education', 'news', 'explore'], noLayout: ['site-footer'] }).value, null);
});
