/* Exercises the real input handlers without a browser or canvas renderer. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

class Surface {
  constructor() {
    this.listeners = new Map(); this.captured = new Set(); this.style = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  getBoundingClientRect() { return { left: 30, top: 50, width: 700, height: 600 }; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) {
    if (this.captured.delete(id)) this.emit('lostpointercapture', 0, 0, { pointerId: id });
  }
  emit(type, x, y, extra = {}) {
    const event = { type, clientX: x + 30, clientY: y + 50, pointerId: 1,
      pointerType: 'touch', isPrimary: true, button: 0, ...extra };
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
}

function environment() {
  const cv = new Surface(), tip = new Surface(), lifecycle = new Surface(), buttons = new Map();
  const storage = new Map(), sceneCalls = { fit: 0, apply: 0, render: 0 };
  const toolButtons = ['rod', 'net', 'trap'].map(tool => {
    const button = new Surface(); button.dataset = { tool }; button.setAttribute = () => {};
    return button;
  });
  const context = {
    cv, tip, console, Date, Math,
    document: {
      querySelectorAll: () => toolButtons,
      getElementById(id) { if (!buttons.has(id)) buttons.set(id, new Surface()); return buttons.get(id); }
    },
    addEventListener: (type, handler) => lifecycle.addEventListener(type, handler),
    toast() {}, openJournal() {}, lookAround() {},
    openLog() {}, scatterBait() {}, seasonNote: () => '',
    Wd: { back() {}, float() {}, season: () => ({ name: 'summer' }), seasonChip() {},
      store: { get: (key, fallback) => structuredClone(storage.has(key) ? storage.get(key) : fallback) } },
    season: { name: 'summer' }, fit: () => { sceneCalls.fit++; },
    applySeason: () => { sceneCalls.apply++; },
    renderBasket: () => { sceneCalls.render++; }, renderCreel: () => { sceneCalls.render++; },
    clamp: (n, min, max) => Math.max(min, Math.min(max, n))
  };
  vm.createContext(context);
  return { cv, context, toolButtons, lifecycle, storage, sceneCalls, calls: [] };
}

function inputSource(file, endMarker) {
  const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
  const start = source.indexOf('/* ================= input ================= */');
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Input section must exist');
  return source.slice(start, end);
}

function woods(options = {}) {
  const fixture = environment(), { context, calls } = fixture;
  const cover = { kind: 'rock', u: .1, v: .8, w: 100, off: options.off || 0,
    target: options.target || 0, drag: false };
  const item = { id: 'porcini' };
  Object.assign(context, {
    save: { basket: {}, seen: {} }, basketEl: new Surface(), stage: {},
    k: 1, depthScale: () => 1, P: (u, v) => [u * 700, v * 600],
    hover: null, berries: [], hips: [], BY: { porcini: { name: 'Porcini', zh: '牛肝菌' } },
    hitTest: x => x < 160 ? { coverHit: cover } : item,
    pick: target => calls.push(['pick', target]), sparkle() {},
    moveCover(c, open) { c.target = open ? 1 : 0; calls.push(['cover', open]); }
  });
  vm.runInContext(inputSource('woods.js', '  Wd.arrive("woods");'), context);
  return { ...fixture, cover, item };
}

function pond() {
  const fixture = environment(), { context, calls } = fixture;
  const rod = { state: 'idle', hold: false, bob: null, fish: null };
  const save = { creel: {}, seen: {}, best: {}, traps: [null, null, null] };
  const stakes = [{ u: .11, v: .74 }, { u: .3, v: .9 }, { u: .58, v: .75 }];
  Object.assign(context, {
    rod, save, tool: 'rod', net: null, haul: null, busyCard: false, hoverTrap: -1, hover: null,
    busy: () => context.busyCard || rod.state !== 'idle' || !!context.net || !!context.haul,
    W: 700, H: 600, k: 1, HZ: .4, DOCK: { v0: .79 }, STAKES: stakes,
    stage: {}, hint: {}, YUKI: ['hello'], sparkle() {},
    tools: { rod: { hint: 'rod' }, net: { hint: 'basket' }, trap: { hint: 'trap' } },
    frozen: () => false, scaleAt: () => 1, P: (u, v) => [u * 700, v * 600],
    yukiBox: () => ({ x: -500, y: -500, w: 80, h: 100, cx: -460 }),
    trapFloat: i => [stakes[i].u * 700 + 52, stakes[i].v * 600 - 22],
    inWater: (x, y) => x > 14 && x < 686 && y > 276 && y < 591,
    trapState(i) { return !save.traps[i] ? 'free' : Date.now() >= save.traps[i].t0 + save.traps[i].dur ? 'ready' : 'soaking'; },
    setTrap(i) { save.traps[i] = { t0: Date.now(), dur: 60000 }; calls.push(['set', i]); },
    haulTrap(i) { save.traps[i] = null; calls.push(['haul', i]); },
    castTo(x, y) { rod.state = 'casting'; calls.push(['cast', x, y]); },
    throwNet(x, y) { if (context.net) return; context.net = { x, y }; calls.push(['basket', x, y]); },
    strike() { calls.push(['strike', rod.state]); rod.state = rod.state === 'bite' ? 'reeling' : 'idle'; }
  });
  const source = fs.readFileSync(path.join(root, 'js', 'pond.js'), 'utf8');
  const toolStart = source.indexOf('  function setTool(t) {');
  const toolEnd = source.indexOf('  function renderCreel()', toolStart);
  vm.runInContext(source.slice(toolStart, toolEnd) + '\n' +
    inputSource('pond.js', '  /* ================= sizing & loop ================= */'), context);
  return { ...fixture, rod, save };
}

function sourceSection(file, startMarker, endMarker) {
  const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Gameplay section must exist');
  return source.slice(start, end);
}

function realPondGameplay(f) {
  const { context, storage, sceneCalls } = f;
  const timers = [], keep = { focus() {}, disabled: false }, release = { disabled: false };
  const card = new Surface(); card.querySelector = selector => selector === '[data-release]' ? release : keep;
  card.querySelectorAll = () => [keep, release]; card.offsetWidth = 370;
  Object.assign(context, {
    time: 5, shadows: [], bubbles: [], reelEl: new Surface(), cardEl: card, creelEl: {},
    BY: { crucian: { name: 'Crucian carp', zh: '鲫鱼', kind: 'fish', rarity: 1 } },
    TRAP: { summer: [], autumn: [] }, pickFrom: () => 'crucian', sizeOf: () => ({ cm: 10 }),
    esc: text => String(text), iconOf: () => '', splash() {}, makeShadow: () => ({}),
    setTimeout: (handler, delay) => { timers.push({ handler, delay, ran: false }); return timers.length; },
    persist: () => storage.set('wild-pond', structuredClone(f.save))
  });
  context.Wd.fly = () => {};
  const code = [
    sourceSection('pond.js', '  function strike() {', '  function updateRod(dt) {'),
    sourceSection('pond.js', '  function land() {', '  /* ---------- the open-bottom fishing cover'),
    sourceSection('pond.js', '  function setTrap(i) {', '  const trapFloat ='),
    sourceSection('pond.js', '  function showCatch(list, how, x, y) {', '  /* ================= HUD & tools')
  ].join('\n');
  vm.runInContext(code, context);
  return { card, keep, release, timers, sceneCalls,
    runTimers(delay) { for (const timer of timers.filter(t => !t.ran && t.delay === delay)) { timer.ran = true; timer.handler(); } }
  };
}

test('woods cancel rolls back a partial drag and does not swallow the next touch tap', () => {
  const f = woods();
  f.cv.emit('pointerdown', 100, 100); f.cv.emit('pointermove', 190, 100);
  assert.ok(f.cover.off > .45);
  f.cv.emit('pointercancel', 190, 100);
  assert.equal(f.cover.off, 0); assert.equal(f.cover.target, 0); assert.equal(f.cover.drag, false);
  f.cv.emit('pointerdown', 240, 100, { pointerId: 2 });
  f.cv.emit('pointerup', 240, 100, { pointerId: 2 });
  f.cv.emit('click', 240, 100, { pointerId: 2 });
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][1], f.item);
});

test('woods horizontal drag commits once and suppresses only its compatibility click', () => {
  const f = woods();
  f.cv.emit('pointerdown', 100, 100); f.cv.emit('pointermove', 190, 100);
  f.cv.emit('pointerup', 190, 100); f.cv.emit('click', 190, 100);
  assert.equal(f.cover.target, 1); assert.deepEqual(f.calls.map(c => c[0]), ['cover']);
  f.cv.emit('pointerdown', 240, 100, { pointerId: 2 });
  f.cv.emit('pointerup', 240, 100, { pointerId: 2 }); f.cv.emit('click', 240, 100);
  assert.deepEqual(f.calls.map(c => c[0]), ['cover', 'pick']);
});

test('woods vertical movement rolls back instead of committing a cover drag', () => {
  const f = woods({ off: 1, target: 1 });
  f.cv.emit('pointerdown', 100, 100); f.cv.emit('pointermove', 103, 130);
  f.cv.emit('pointerup', 103, 130); f.cv.emit('click', 103, 130);
  assert.equal(f.cover.off, 1); assert.equal(f.cover.target, 1); assert.equal(f.calls.length, 0);
});

test('woods second finger cannot move, release, or cancel the primary cover drag', () => {
  const f = woods(); f.cv.emit('pointerdown', 100, 100);
  f.cv.emit('pointermove', 190, 100, { pointerId: 2, isPrimary: false });
  f.cv.emit('pointerup', 190, 100, { pointerId: 2 });
  f.cv.emit('pointercancel', 190, 100, { pointerId: 2 });
  assert.equal(f.cover.off, 0); assert.equal(f.cover.drag, true);
  f.cv.emit('pointercancel', 100, 100); assert.equal(f.cover.drag, false);
});

test('pond idle tap casts on pointerup, including small finger jitter', () => {
  const f = pond(); f.cv.emit('pointerdown', 300, 330);
  assert.equal(f.calls.length, 0); assert.equal(f.rod.state, 'idle');
  f.cv.emit('pointermove', 302, 333); f.cv.emit('pointerup', 302, 333);
  assert.deepEqual(f.calls, [['cast', 302, 333]]);
});

test('pond cancelled vertical scroll has no action and the next tap works', () => {
  const f = pond(); f.cv.emit('pointerdown', 300, 330);
  f.cv.emit('pointermove', 301, 420); f.cv.emit('pointercancel', 301, 420);
  assert.equal(f.calls.length, 0);
  f.cv.emit('pointerdown', 300, 330, { pointerId: 2 });
  f.cv.emit('pointerup', 300, 330, { pointerId: 2 });
  assert.equal(f.calls[0][0], 'cast');
});

test('pond motion above the tap threshold stays cancelled even when the finger returns', () => {
  const f = pond(); f.cv.emit('pointerdown', 300, 330);
  f.cv.emit('pointermove', 300, 360); f.cv.emit('pointermove', 300, 330);
  f.cv.emit('pointerup', 300, 330); assert.equal(f.calls.length, 0);
});

test('pond pointerup displacement is checked even without a pointermove event', () => {
  const f = pond(); f.cv.emit('pointerdown', 300, 330); f.cv.emit('pointerup', 300, 355);
  assert.equal(f.calls.length, 0);
});

test('pond basket starts on confirmed pointerup and not a cancelled touch', () => {
  const f = pond(); f.context.setTool('net');
  f.cv.emit('pointerdown', 300, 330); assert.equal(f.context.net, null);
  f.cv.emit('pointercancel', 300, 330); assert.equal(f.calls.length, 0);
  f.cv.emit('pointerdown', 300, 330, { pointerId: 2 });
  f.cv.emit('pointerup', 300, 330, { pointerId: 2 });
  assert.equal(f.calls[0][0], 'basket');
});

test('pond a ready trap is not removed by a cancelled scroll', () => {
  const f = pond(); const trap = { t0: 0, dur: 1 }; f.save.traps[0] = trap;
  f.cv.emit('pointerdown', 77, 420); assert.equal(f.save.traps[0], trap);
  f.cv.emit('pointermove', 77, 475); f.cv.emit('pointercancel', 77, 475);
  assert.equal(f.save.traps[0], trap); assert.equal(f.calls.length, 0);
  f.cv.emit('pointerdown', 77, 420, { pointerId: 2 });
  f.cv.emit('pointerup', 77, 420, { pointerId: 2 });
  assert.deepEqual(f.calls, [['haul', 0]]); assert.equal(f.save.traps[0], null);
});

test('pond free trap placement is deferred until pointerup', () => {
  const f = pond(); f.cv.emit('pointerdown', 77, 420); assert.equal(f.save.traps[0], null);
  f.cv.emit('pointerup', 77, 420); assert.deepEqual(f.calls, [['set', 0]]);
});

test('pond fishing hold starts immediately and only its pointer can release it', () => {
  const f = pond(); f.rod.state = 'reeling'; f.cv.emit('pointerdown', 300, 330);
  assert.equal(f.rod.hold, true); assert.ok(f.cv.hasPointerCapture(1));
  f.cv.emit('pointerup', 300, 330, { pointerId: 2 }); assert.equal(f.rod.hold, true);
  f.cv.emit('pointercancel', 300, 330, { pointerId: 2 }); assert.equal(f.rod.hold, true);
  f.cv.emit('pointerup', 300, 330); assert.equal(f.rod.hold, false);
  assert.equal(f.calls.length, 0);
});

test('pond cancellation immediately releases the fishing hold', () => {
  const f = pond(); f.rod.state = 'reeling'; f.cv.emit('pointerdown', 300, 330);
  f.cv.emit('pointercancel', 300, 330); assert.equal(f.rod.hold, false);
});

test('pond bite strikes on pointerdown and does not recast on release', () => {
  const f = pond(); f.rod.state = 'bite'; f.cv.emit('pointerdown', 300, 330);
  assert.equal(f.rod.state, 'reeling'); assert.deepEqual(f.calls, [['strike', 'bite']]);
  f.cv.emit('pointerup', 300, 330); assert.equal(f.calls.length, 1);
});

test('pond an early nibble strike remains immediate and cannot turn into an idle cast', () => {
  const f = pond(); f.rod.state = 'nibble'; f.cv.emit('pointerdown', 300, 330);
  assert.equal(f.rod.state, 'idle'); assert.deepEqual(f.calls, [['strike', 'nibble']]);
  f.cv.emit('pointerup', 300, 330); assert.equal(f.calls.length, 1);
});

test('pond switching tools cancels the pending tap and releases capture', () => {
  const f = pond(); f.cv.emit('pointerdown', 300, 330); f.context.setTool('net');
  assert.equal(f.cv.hasPointerCapture(1), false);
  f.cv.emit('pointerup', 300, 330); assert.equal(f.calls.length, 0);
  f.cv.emit('pointerdown', 300, 330, { pointerId: 2 }); f.cv.emit('pointerup', 300, 330, { pointerId: 2 });
  assert.equal(f.calls[0][0], 'basket');
});

test('pond waiting-to-approach transition accepts a repositioning tap', () => {
  const f = pond(); f.rod.state = 'waiting'; f.cv.emit('pointerdown', 300, 330);
  f.rod.state = 'approach'; f.cv.emit('pointerup', 300, 330);
  assert.equal(f.calls[0][0], 'cast');
});

test('pond a bite arriving after an idle tap began does not become a cast or late strike', () => {
  const f = pond(); f.rod.state = 'waiting'; f.cv.emit('pointerdown', 300, 330);
  f.rod.state = 'bite'; f.cv.emit('pointerup', 300, 330); assert.equal(f.calls.length, 0);
});

test('pond slight movement into a different target does not trigger the old trap', () => {
  const f = pond(); f.cv.emit('pointerdown', 108, 420); f.cv.emit('pointerup', 111, 420);
  assert.equal(f.calls.length, 0); assert.equal(f.save.traps[0], null);
});

test('pond mouse taps work and non-primary mouse buttons do not cast', () => {
  const f = pond(); f.cv.emit('pointerdown', 300, 330, { pointerType: 'mouse', button: 2 });
  f.cv.emit('pointerup', 300, 330, { pointerType: 'mouse', button: 2 }); assert.equal(f.calls.length, 0);
  f.cv.emit('pointerdown', 300, 330, { pointerType: 'mouse' });
  f.cv.emit('pointerup', 300, 330, { pointerType: 'mouse' }); assert.equal(f.calls[0][0], 'cast');
});

test('pond real strike enables touch control before a reeling hold, and scare restores page panning', () => {
  const f = pond(); realPondGameplay(f);
  f.rod.state = 'bite'; f.rod.bob = { x: 300, y: 330 };
  f.cv.emit('pointerdown', 300, 330); assert.equal(f.cv.style.touchAction, 'none');
  f.cv.emit('pointerup', 300, 330);
  f.cv.emit('pointerdown', 300, 330, { pointerId: 2 }); assert.equal(f.rod.hold, true);
  f.context.scare('The fish got away.'); assert.equal(f.cv.style.touchAction, '');
  assert.equal(f.rod.hold, false);
});

test('pond landing a fish restores page panning before the catch card opens', () => {
  const f = pond(); realPondGameplay(f);
  f.rod.state = 'reeling'; f.rod.fish = { id: 'crucian', x: 300, y: 330 };
  f.cv.style.touchAction = 'none'; f.context.land();
  assert.equal(f.cv.style.touchAction, ''); assert.equal(f.rod.state, 'landed');
  assert.equal(f.context.busyCard, true);
});

test('pond repeated Keep taps resolve a catch only once, including the fade-out interval', () => {
  const f = pond(), game = realPondGameplay(f);
  f.context.showCatch([{ id: 'crucian', cm: 10 }], 'rod', 300, 330);
  game.keep.onclick(); game.keep.onclick(); game.release.onclick();
  assert.equal(f.save.creel.crucian, 1); assert.equal(f.save.seen.crucian, 1);
  assert.equal(game.keep.disabled, true); assert.equal(game.release.disabled, true);
  assert.equal(f.context.busyCard, true);
  game.runTimers(260); assert.equal(f.context.busyCard, false); assert.equal(game.card.hidden, true);
});

test('pond a trap awaiting its catch card blocks a second haul and new idle actions', () => {
  const f = pond(), game = realPondGameplay(f);
  f.save.traps[0] = { t0: 0, dur: 1 }; f.save.traps[1] = { t0: 0, dur: 1 };
  f.context.haulTrap(0); assert.ok(f.context.haul); assert.equal(f.save.traps[0], null);
  f.context.haulTrap(1); f.context.setTrap(2);
  assert.ok(f.save.traps[1]); assert.equal(f.save.traps[2], null);
  assert.equal(game.timers.filter(t => t.delay === 1300).length, 1);
  f.cv.emit('pointerdown', 300, 330); f.cv.emit('pointerup', 300, 330);
  assert.equal(f.calls.length, 0);
  game.runTimers(1300); assert.equal(f.context.haul, null); assert.equal(f.context.busyCard, true);
  f.context.haulTrap(1); assert.ok(f.save.traps[1]);
  game.keep.onclick(); game.runTimers(260);
  f.context.haulTrap(1); assert.equal(f.save.traps[1], null);
});

test('pond tool switching releases a hold without acquiring a pending tap', () => {
  const f = pond(); f.rod.state = 'reeling'; f.cv.emit('pointerdown', 300, 330);
  f.context.setTool('net'); assert.equal(f.rod.hold, false); assert.equal(f.cv.hasPointerCapture(1), false);
  f.cv.emit('pointerup', 300, 330); assert.equal(f.calls.length, 0);
});

test('woods BFCache restoration reloads consumed inventory before the next harvest persists it', () => {
  const f = woods(); f.context.save.basket = { porcini: 5 }; f.context.save.seen = { porcini: 5 };
  f.storage.set('wild-woods', { basket: { porcini: 1 }, seen: { porcini: 5 } });
  f.lifecycle.emit('pageshow', 0, 0, { persisted: true });
  assert.equal(f.context.save.basket.porcini, 1); assert.equal(f.sceneCalls.render, 1);
  f.context.persist = () => f.storage.set('wild-woods', structuredClone(f.context.save));
  f.context.Wd.fly = () => {}; f.context.iconOf = () => ''; f.context.setTimeout = () => 0;
  vm.runInContext(sourceSection('woods.js', '  function gain(id, x, y) {', '  function pick(target) {'), f.context);
  f.context.gain('porcini', 100, 100);
  assert.equal(f.storage.get('wild-woods').basket.porcini, 2);
});

test('pond BFCache restoration reloads consumed inventory and trap state before keeping a new catch', () => {
  const f = pond(), game = realPondGameplay(f);
  f.save.creel.crucian = 5; f.save.traps[0] = { t0: 0, dur: 1 };
  f.storage.set('wild-pond', { creel: { crucian: 1 }, seen: { crucian: 5 }, best: { crucian: 30 }, traps: [null, null, null] });
  f.lifecycle.emit('pageshow', 0, 0, { persisted: true });
  assert.equal(f.save.creel.crucian, 1); assert.equal(f.save.traps[0], null);
  f.context.showCatch([{ id: 'crucian', cm: 10 }], 'rod', 300, 330); game.keep.onclick();
  assert.equal(f.storage.get('wild-pond').creel.crucian, 2); assert.equal(f.save.best.crucian, 30);
});

test('BFCache inventory refresh preserves active fishing and cover gestures across a season boundary', () => {
  const f = pond(); f.rod.state = 'waiting'; f.rod.bob = { x: 300, y: 330 };
  f.context.net = { phase: 'sink' }; f.context.Wd.season = () => ({ name: 'winter' });
  f.lifecycle.emit('pageshow', 0, 0, { persisted: true });
  assert.equal(f.rod.state, 'waiting'); assert.equal(f.context.net.phase, 'sink');
  assert.equal(f.context.season.name, 'summer'); assert.equal(f.sceneCalls.apply, 0);
  const w = woods(); w.cv.emit('pointerdown', 100, 100); w.context.Wd.season = () => ({ name: 'winter' });
  w.lifecycle.emit('pageshow', 0, 0, { persisted: true });
  assert.equal(w.cover.drag, true); assert.equal(w.context.season.name, 'summer'); assert.equal(w.sceneCalls.apply, 0);
});

test('BFCache restoration refreshes the scene season when no operation is active', () => {
  for (const f of [woods(), pond()]) {
    f.context.Wd.season = () => ({ name: 'winter' });
    f.lifecycle.emit('pageshow', 0, 0, { persisted: true });
    assert.equal(f.context.season.name, 'winter'); assert.equal(f.sceneCalls.apply, 1);
  }
});

test('pond BFCache season refresh waits for a trap result that has not reached its card', () => {
  const f = pond(); f.context.haul = { i: 0, t0: 5 };
  f.context.Wd.season = () => ({ name: 'winter' });
  f.lifecycle.emit('pageshow', 0, 0, { persisted: true });
  assert.equal(f.context.haul.i, 0); assert.equal(f.context.season.name, 'summer'); assert.equal(f.sceneCalls.apply, 0);
});

test('initial pageshow leaves current state intact and pagehide clears only active gestures', () => {
  const f = pond(); f.save.creel.crucian = 5;
  f.storage.set('wild-pond', { creel: { crucian: 1 }, seen: {}, best: {}, traps: [null, null, null] });
  f.lifecycle.emit('pageshow', 0, 0, { persisted: false }); assert.equal(f.save.creel.crucian, 5);
  f.rod.state = 'reeling'; f.cv.emit('pointerdown', 300, 330); f.lifecycle.emit('pagehide', 0, 0);
  assert.equal(f.rod.hold, false); assert.equal(f.rod.state, 'reeling'); assert.equal(f.cv.hasPointerCapture(1), false);
  const w = woods(); w.cv.emit('pointerdown', 100, 100); w.cv.emit('pointermove', 190, 100);
  w.lifecycle.emit('pagehide', 0, 0); assert.equal(w.cover.off, 0); assert.equal(w.cover.drag, false);
});
