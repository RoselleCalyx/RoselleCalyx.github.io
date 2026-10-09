/* Runs the real bubble positioning function without the garden renderer. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../js/farm.js'), 'utf8');
const start = source.indexOf('  function positionBubble() {');
const end = source.indexOf('  world.addEventListener(', start);
assert.ok(start >= 0 && end > start, 'extract the actual positionBubble function');
const positionSource = source.slice(start, end);

function harness(width = 390) {
  const classes = new Set(), calls = [];
  function parent(name, rect) {
    return { name, appendChild(el) { el.parentNode = this; calls.push(name); }, getBoundingClientRect: () => rect };
  }
  const world = parent('world', { left: 40, top: 90, height: 640 });
  const body = parent('body');
  const el = { parentNode: world, style: { width: '250px', left: '450px', top: '316px' }, offsetHeight: 90,
    classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } } };
  const anchor = { getBoundingClientRect: () => ({ left: 450, width: 80, top: 400, bottom: 480 }) };
  const context = vm.createContext({ bubble: { el, anchor }, world,
    viewport: { clientWidth: 700, getBoundingClientRect: () => ({ left: 100, right: 800 }) },
    document: { body }, window: { matchMedia(query) { assert.equal(query, '(max-width: 900px)'); return { matches: width <= 900 }; } } });
  vm.runInContext(positionSource, context);
  return { el, classes, calls, body, world, context, position: () => context.positionBubble(), resize(value) { width = value; } };
}

for (const width of [390, 900]) test(`at ${width}px the bubble leaves the clipped world and clears desktop inline geometry`, () => {
  const h = harness(width);
  h.position();
  assert.equal(h.el.parentNode, h.body);
  assert.equal(h.classes.has('mobile-sheet'), true);
  assert.deepEqual(h.el.style, { width: '', left: '', top: '' });
  assert.deepEqual(h.calls, ['body']);
  h.position();
  assert.deepEqual(h.calls, ['body'], 'animation frames must not keep reparenting the sheet');
});

test('resizing past 900px returns the same bubble to the world and restores normal desktop coordinates', () => {
  const h = harness();
  h.position();
  h.resize(901); h.position();
  assert.equal(h.el.parentNode, h.world);
  assert.equal(h.classes.has('mobile-sheet'), false);
  assert.equal(h.classes.has('below'), false);
  assert.deepEqual(h.el.style, { width: '250px', left: '450px', top: '316px' });
  assert.deepEqual(h.calls, ['body', 'world']);
  h.position();
  assert.deepEqual(h.calls, ['body', 'world']);
});

test('an empty bubble returns before media checks, reparenting, or geometry reads', () => {
  const h = harness();
  h.context.bubble = null;
  h.context.window.matchMedia = () => { throw new Error('no media lookup should occur'); };
  assert.doesNotThrow(h.position);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.el.style, { width: '250px', left: '450px', top: '316px' });
});
