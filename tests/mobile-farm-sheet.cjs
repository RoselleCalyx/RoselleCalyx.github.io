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

function harness(width = 390, mode = 'details', anchorRect) {
  const classes = new Set(), calls = [];
  function parent(name, rect) {
    return { name, appendChild(el) { el.parentNode = this; calls.push(name); }, getBoundingClientRect: () => rect };
  }
  const world = parent('world', { left: 40, top: 90, height: 640 });
  const body = parent('body');
  const el = { parentNode: world, style: { width: '250px', left: '450px', top: '316px' }, offsetWidth: 144, offsetHeight: 90,
    classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); }, remove(...names) { names.forEach(name=>classes.delete(name)); }, add(...names) { names.forEach(name=>classes.add(name)); } } };
  let rect = anchorRect || { left: 450, width: 80, top: 400, bottom: 480 };
  const anchor = { getBoundingClientRect: () => ({ ...rect, right: rect.left + rect.width, height: rect.bottom - rect.top }) };
  const viewport = { get clientWidth() { return mode === 'animal-actions' ? width : 700; }, getBoundingClientRect: () => mode === 'animal-actions' ? { left: 0, right: width, top: 90, bottom: 730 } : { left: 100, right: 800, top: 90, bottom: 730 } };
  const context = vm.createContext({ bubble: { el, anchor, mode }, world,
    viewport, innerWidth: width, innerHeight: 844,
    document: { body, documentElement: { clientWidth: width, clientHeight: 844 } }, window: { innerWidth: width, innerHeight: 844, matchMedia(query) { assert.equal(query, '(max-width: 900px)'); return { matches: width <= 900 }; } } });
  vm.runInContext(positionSource, context);
  return { el, classes, calls, body, world, context, position: () => context.positionBubble(), moveAnchor(value) { rect=value; }, resize(value) { width=value; context.innerWidth=value; context.window.innerWidth=value; context.document.documentElement.clientWidth=value; } };
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

for (const width of [390, 900, 1440]) test(`at ${width}px animal actions stay above the friend instead of becoming a sheet`, () => {
  const rect = { left: width / 2 - 40, width: 80, top: 400, bottom: 480 };
  const h = harness(width, 'animal-actions', rect);
  h.position();
  assert.equal(h.el.parentNode, h.body, 'actions escape the clipped garden at every width');
  assert.equal(h.classes.has('mobile-sheet'), false);
  assert.equal(h.classes.has('below'), false, 'animal actions must remain above the friend');
  assert.equal(Number.parseFloat(h.el.style.left), width / 2, 'actions follow the animal’s horizontal center');
  assert.ok(Number.parseFloat(h.el.style.top) < rect.top, 'actions are anchored above the animal');
  assert.deepEqual(h.calls, ['body']);
  h.position();
  assert.deepEqual(h.calls, ['body'], 'animation frames do not repeatedly reparent the toolbar');
});

test('animal actions follow their anchor and remain on screen near either phone edge', () => {
  const h = harness(390, 'animal-actions', { left: -20, width: 80, top: 400, bottom: 480 });
  h.position();
  const left = Number.parseFloat(h.el.style.left);
  assert.ok(left >= Number.parseFloat(h.el.style.width) / 2, 'the left edge of the toolbar remains visible');
  h.moveAnchor({ left: 350, width: 80, top: 300, bottom: 380 }); h.position();
  const right = Number.parseFloat(h.el.style.left);
  assert.ok(right <= 390 - Number.parseFloat(h.el.style.width) / 2, 'the right edge of the toolbar remains visible');
  assert.ok(right > left, 'the toolbar follows a different animal position');
  assert.ok(Number.parseFloat(h.el.style.top) < 300, 'the vertical anchor updates too');
  h.resize(1440); h.moveAnchor({ left: 680, width: 80, top: 500, bottom: 580 }); h.position();
  assert.equal(h.el.parentNode, h.body, 'resizing preserves viewport anchoring');
  assert.equal(Number.parseFloat(h.el.style.left),720);
  assert.equal(h.classes.has('mobile-sheet'),false);
  assert.deepEqual(h.calls,['body']);
});

test('animal actions hide when their friend is scrolled outside the garden and return with it', () => {
  const h = harness(390, 'animal-actions', { left: 400, width: 80, top: 400, bottom: 480 });
  h.position();
  assert.equal(h.el.hidden,true,'actions do not remain floating after their friend scrolls away');
  h.moveAnchor({ left: 100, width: 80, top: 400, bottom: 480 }); h.position();
  assert.equal(h.el.hidden,false,'the toolbar returns when the animal is visible again');
  h.moveAnchor({ left: 100, width: 80, top: 800, bottom: 880 }); h.position();
  assert.equal(h.el.hidden,true,'actions also hide below the visible garden');
});

test('the food chooser retains the mobile sheet and desktop garden positioning', () => {
  const h = harness(390, 'animal-food');
  h.position();
  assert.equal(h.el.parentNode,h.body);
  assert.equal(h.classes.has('mobile-sheet'),true);
  h.resize(1440); h.position();
  assert.equal(h.el.parentNode,h.world);
  assert.equal(h.classes.has('mobile-sheet'),false);
  assert.deepEqual(h.el.style,{width:'250px',left:'450px',top:'316px'});
});
