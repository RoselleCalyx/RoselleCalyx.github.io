const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const productionTabs = require('./helpers/production-tabs.cjs');

const source = fs.readFileSync(path.join(__dirname, '../js/starmap.js'), 'utf8');

// Run the real page script against a small DOM/canvas fixture. The test-only
// hook reads private state; events still use the production event handlers.
function page(options = {}) {
  const gradient = { addColorStop() {} };
  const painted = [];
  const drawing = new Proxy({}, { get: (target, key) => {
    if (key in target) return target[key];
    if (key === 'createRadialGradient') return () => gradient;
    if (key === 'measureText') return text => ({ width: text.length * 8, actualBoundingBoxAscent: 11, actualBoundingBoxDescent: 3 });
    if (key === 'fillText') return (text, x, y) => painted.push({ text, x, y, font: drawing.font });
    return () => {};
  } });
  class Element {
    constructor(id = '') {
      this.id = id; this.dataset = {}; this.listeners = new Map();
      this._classes = new Set(); this.children = new Map(); this.hidden = false;
      this.style = {};
      this.clientWidth = 0; this.clientHeight = 0; this.innerHTML = ''; this.textContent = '';
      this.classList = {
        add: (...classes) => classes.forEach(c => this._classes.add(c)),
        remove: (...classes) => classes.forEach(c => this._classes.delete(c)),
        contains: c => this._classes.has(c),
        toggle: (c, force) => {
          const on = force === undefined ? !this._classes.has(c) : force;
          if (on) this._classes.add(c); else this._classes.delete(c);
          return on;
        }
      };
    }
    set className(value) { this._classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(' '); }
    getContext() { return drawing; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
    setPointerCapture() {}
    setAttribute(name, value) { this[name] = String(value); }
    getAttribute(name) { return this[name] ?? null; }
    focus() { context.document.activeElement = this; }
    closest(selector) { return selector === 'button[role="tab"]' && this.role === 'tab' ? this : null; }
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    }
    dispatch(type, properties = {}) {
      const event = {
        type, target: this, bubbles: type !== 'pointerleave', cancelable: true, defaultPrevented: false,
        preventDefault() { if (this.cancelable) this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        ...properties
      };
      let current = this;
      while (current) {
        for (const handler of current.listeners.get(type) || []) handler(event);
        if (typeof current[`on${type}`] === 'function') current[`on${type}`](event);
        if (!event.bubbles || event.propagationStopped) break;
        current = current.parentElement;
      }
      return event;
    }
    click() { this.dispatch('click'); }
  }
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const modes = ['const', 'planets', 'orrery', 'deep', 'fav'].map(mode => {
    const element = new Element('mode-' + mode); element.dataset.mode = mode;
    element.role = 'tab'; if (mode === 'const') element.classList.add('active');
    return element;
  });
  const modeList = get('modeTabs');
  modeList.querySelectorAll = () => modes;
  modes.forEach(element => { element.parentElement = modeList; });
  const wrap = get('chartWrap'); wrap.clientWidth = 400;
  get('chart').parentElement = wrap;
  get('planetStage').hidden = true;
  const timers = new Map(); let nextTimer = 1;
  const scrolls = []; let clock = 0;
  const constellations = options.constellations || [
    { id: 'ori', name: 'Orion', zh: '猎户座', stars: [['Rigel', 78, -8, 0], ['Betelgeuse', 88, 7, 1]], lines: [[0, 1]], story: '', tagline: '', season: '' },
    { id: 'cyg', name: 'Cygnus', zh: '天鹅座', stars: [['Deneb', 310, 45, 1], ['Sadr', 305, 40, 2]], lines: [[0, 1]], story: '', tagline: '', season: '' }
  ];
  const context = {
    document: {
      getElementById: get, createElement: () => new Element(),
      querySelectorAll: selector => selector === '.sm-modes button' ? modes : [],
      querySelector: selector => selector.includes('data-mode="orrery"') ? modes[2] : null
    },
    performance: { now: () => clock }, matchMedia: query => ({ matches: query.includes('max-width') && !!options.mobile }),
    requestAnimationFrame() {}, addEventListener() {},
    innerHeight: options.innerHeight || 800,
    visualViewport: options.visualViewportHeight ? { height: options.visualViewportHeight } : undefined,
    scrollBy: value => scrolls.push(JSON.parse(JSON.stringify(value))),
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    CONSTELLATIONS: constellations,
    DEEP_SKY: [{ id: 'm42', name: 'Orion Nebula', code: 'M42', ra: 83, dec: -5, kind: 'Nebula', dist: '1,344 light years', text: '' }],
    Site: { esc: value => String(value), ICON: {}, store: { get: (_, value) => value, set() {} } }
  };
  context.window = context;
  context.Site.tabs = productionTabs(context);
  const instrumented = source.replace(/\}\)\(\);\s*$/, `
    globalThis.__starmapTest = {
      snapshot: () => ({ view: { ...view }, selected, mode, quiz: { ...quiz } }),
      point: id => { const star = CONS.find(c => c.id === id).stars[0]; return toS(star[1], star[2]); },
      setView: value => { Object.assign(view, value); target = null; },
      setHover: value => { hover = value; },
      draw, hit
    };
  })();`);
  vm.runInNewContext(instrumented, context, { filename: 'starmap.js' });
  const snapshot = () => JSON.parse(JSON.stringify(context.__starmapTest.snapshot()));
  const pointer = (type, id, x, y) => get('chart').dispatch(type, { pointerId: id, clientX: x, clientY: y });
  function listClick(id) {
    const name = constellations.find(c => c.id === id).name;
    const match = get('smList').innerHTML.match(new RegExp(`data-i="(\\d+)"[^>]*><span>${name}</span>`));
    assert.ok(match, `${name} is available as a native list button`);
    const button = new Element(); button.dataset.i = match[1]; button.closest = () => button;
    get('smList').dispatch('click', { target: button });
  }
  const wheel = (deltaY, properties = {}) => wrap.dispatch('wheel', {
    target: get('chart'), deltaX: 0, deltaY, deltaMode: 0, clientX: 200, clientY: 200,
    ...properties
  });
  return {
    get, modes, timers, pointer, snapshot, listClick, painted, wrap, wheel, scrolls, document: context.document,
    advanceTime: milliseconds => { clock += milliseconds; },
    api: context.__starmapTest
  };
}

test('mode tabs support wrapped keyboard selection and update the panel label', () => {
  const p = page();
  assert.equal(p.get('modeTabs').getAttribute('aria-orientation'), 'vertical');
  p.modes[0].focus();
  const event = p.modes[0].dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(p.snapshot().mode, 'planets');
  assert.equal(p.document.activeElement, p.modes[1]);
  assert.equal(p.get('starmapPanel').getAttribute('aria-labelledby'), p.modes[1].id);
  p.modes[1].dispatch('keydown', { key: 'End' });
  assert.equal(p.snapshot().mode, 'fav');
  p.modes[4].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(p.snapshot().mode, 'const');
  p.modes[0].dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(p.snapshot().mode, 'fav');
  p.modes[4].dispatch('keydown', { key: 'Home' });
  assert.equal(p.snapshot().mode, 'const');
  p.modes.forEach((tab, index) => {
    assert.equal(tab.getAttribute('aria-selected'), String(index === 0));
    assert.equal(tab.tabIndex, index === 0 ? 0 : -1);
  });
});

test('mobile mode tabs use horizontal navigation and leave up/down keys native', () => {
  const p = page({ mobile: true });
  assert.equal(p.get('modeTabs').getAttribute('aria-orientation'), 'horizontal');
  assert.equal(p.modes[0].dispatch('keydown', { key: 'ArrowDown' }).defaultPrevented, false);
  assert.equal(p.snapshot().mode, 'const');
  p.modes[0].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(p.snapshot().mode, 'planets');
});

test('starting a game from another mode synchronizes the selected tab without stealing focus', () => {
  const p = page(); p.modes[2].click();
  p.get('playQuiz').focus(); p.get('playQuiz').click();
  assert.equal(p.snapshot().mode, 'const');
  assert.equal(p.document.activeElement, p.get('playQuiz'));
  assert.equal(p.modes[0].getAttribute('aria-selected'), 'true');
  assert.equal(p.modes[2].getAttribute('aria-selected'), 'false');
  assert.equal(p.modes[0].tabIndex, 0);
  assert.equal(p.modes[2].tabIndex, -1);
  assert.equal(p.get('starmapPanel').getAttribute('aria-labelledby'), p.modes[0].id);
});

test('keyboard mode changes cancel game callbacks and reset partial wheel intent', () => {
  const p = page(); p.get('playQuiz').click();
  p.listClick(p.snapshot().quiz.order[0]);
  const queued = [...p.timers.values()][0].callback;
  p.wheel(90); p.modes[0].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(p.snapshot().quiz.on, false);
  assert.equal(p.snapshot().mode, 'planets');
  assert.equal(p.timers.size, 0);
  const after = p.snapshot(); queued();
  assert.deepEqual(p.snapshot(), after);
  p.advanceTime(30); p.wheel(40);
  assert.deepEqual(p.scrolls, []);
});

for (const remaining of [1, 2]) {
  test(`pinch continues without a camera jump when finger ${remaining} remains`, () => {
    const p = page();
    p.api.setView({ k: 2, x: 20, y: 30 });
    p.pointer('pointerdown', 1, 80, 90);
    p.pointer('pointerdown', 2, 180, 90);
    p.pointer('pointermove', 2, 230, 90);
    const before = p.snapshot().view;
    p.pointer('pointerup', remaining === 1 ? 2 : 1, remaining === 1 ? 230 : 80, 90);
    const startX = remaining === 1 ? 80 : 230;
    p.pointer('pointermove', remaining, startX + 7, 94);
    const after = p.snapshot().view;
    assert.equal(after.x, before.x + 7);
    assert.equal(after.y, before.y + 4);
    assert.equal(after.k, before.k);
  });
}

test('a canceled tap does not select an object or answer a quiz', () => {
  const p = page(), point = p.api.point('cyg');
  p.pointer('pointerdown', 1, ...point);
  p.pointer('pointercancel', 1, ...point);
  assert.equal(p.snapshot().selected.id, 'ori');
  p.get('playQuiz').click();
  p.pointer('pointerdown', 2, ...point);
  p.pointer('pointercancel', 2, ...point);
  assert.equal(p.snapshot().quiz.lock, false);
  assert.equal(p.timers.size, 0);
});

test('an ordinary tap still selects a constellation', () => {
  const p = page(), point = p.api.point('cyg');
  p.pointer('pointerdown', 1, ...point);
  p.pointer('pointerup', 1, ...point);
  assert.equal(p.snapshot().selected.id, 'cyg');
});

test('list buttons select normally and score answers while the game is active', () => {
  const p = page();
  p.listClick('cyg');
  assert.equal(p.snapshot().selected.id, 'cyg');
  p.modes[1].click();
  p.get('playQuiz').click();
  assert.equal(p.snapshot().mode, 'const');
  p.listClick(p.snapshot().quiz.order[0]);
  assert.equal(p.snapshot().quiz.score, 1);
  assert.equal(p.snapshot().quiz.lock, true);
  assert.equal(p.timers.size, 1);
  const pending = [...p.timers.values()][0];
  pending.callback();
  assert.equal(p.snapshot().quiz.round, 1);
  assert.equal(p.snapshot().quiz.lock, false);
  p.listClick(p.snapshot().quiz.order[1]);
  assert.equal(p.snapshot().quiz.score, 2);
});

for (const exit of ['stop', 'mode']) {
  test(`${exit} cancels the next round and an already queued callback stays inert`, () => {
    const p = page();
    p.get('playQuiz').click();
    p.listClick(p.snapshot().quiz.order[0]);
    const callback = [...p.timers.values()][0].callback;
    if (exit === 'stop') p.get('playQuiz').click(); else p.modes[1].click();
    assert.equal(p.timers.size, 0);
    assert.equal(p.get('quizBar').classList.contains('on'), false);
    const stopped = p.snapshot();
    callback();
    assert.deepEqual(p.snapshot(), stopped);
    assert.equal(p.get('quizBar').classList.contains('on'), false);
  });
}

test('a previous game callback cannot advance a newly started game', () => {
  const p = page();
  p.get('playQuiz').click(); p.listClick(p.snapshot().quiz.order[0]);
  const callback = [...p.timers.values()][0].callback;
  p.get('playQuiz').click(); p.get('playQuiz').click();
  const restarted = p.snapshot();
  callback();
  assert.deepEqual(p.snapshot(), restarted);
});

function crowdedSky() {
  const names = [['earlier', 'Earlier'], ['ori', 'Orion'], ['hov', 'Hovered'], ['hidden', 'Hidden'], ['far', 'Remote']];
  return names.map(([id, name]) => ({
    id, name, zh: '', lines: [[0, 1]], story: '', tagline: '', season: '',
    stars: id === 'far' ? [['A', 310, 45, 1], ['B', 305, 40, 2]] : [['A', 78, -8, 1], ['B', 88, 7, 2]]
  }));
}
function namesPainted(page, constellations) {
  const names = new Set(constellations.map(c => c.name));
  page.painted.length = 0; page.api.draw();
  return page.painted.map(label => label.text).filter(text => names.has(text));
}

test('mobile whole-sky labels prioritize selected and hovered objects without changing hits', () => {
  const constellations = crowdedSky(), p = page({ mobile: true, constellations });
  p.api.setHover({ type: 'const', id: 'hov' });
  assert.deepEqual(namesPainted(p, constellations), ['Orion', 'Hovered', 'Remote']);
  assert.equal(p.api.hit(...p.api.point('earlier')).id, 'earlier', 'suppressed label still has its original hit area');
  p.listClick('hidden');
  assert.deepEqual(namesPainted(p, constellations), ['Hidden', 'Hovered', 'Remote'], 'a newly selected hidden label is restored');
  p.api.setView({ k: 2 });
  assert.deepEqual(namesPainted(p, constellations), constellations.map(c => c.name), 'zoom restores the original labels');
});

test('desktop labels retain their original display and quiz labels remain hidden', () => {
  const constellations = crowdedSky(), desktop = page({ constellations });
  assert.deepEqual(namesPainted(desktop, constellations), constellations.map(c => c.name));
  const mobile = page({ mobile: true, constellations });
  mobile.get('playQuiz').click();
  assert.deepEqual(namesPainted(mobile, constellations), []);
});

for (const [index, mode] of ['const', 'planets', 'orrery', 'deep', 'fav'].entries()) {
  test(`${mode}: small wheel input stays put and deliberate scrolling moves the page at every zoom level`, () => {
    for (const k of [1, 3, 6]) {
      const p = page(); p.modes[index].click();
      p.api.setView({ k, x: 20, y: 30 });
      const before = p.snapshot().view;
      const target = mode === 'orrery' ? p.get('orrery') : p.get('chart');
      const small = p.wheel(20, { target });
      assert.equal(small.defaultPrevented, true, 'small input cannot leak into native page scrolling');
      assert.deepEqual(p.scrolls, [], `small input leaves the page still at zoom ${k}`);
      assert.deepEqual(p.snapshot().view, before, 'ordinary wheel input leaves the camera still');
      p.advanceTime(50);
      const deliberate = p.wheel(150, { target });
      assert.equal(deliberate.defaultPrevented, true, 'manual page scrolling replaces the native scroll exactly once');
      assert.deepEqual(p.scrolls, [{ top: 170, left: 0, behavior: 'instant' }]);
      assert.deepEqual(p.snapshot().view, before, 'page scrolling leaves the camera zoom and pan unchanged');
    }
  });
}

test('short consecutive wheel samples form one scroll gesture and its tail continues smoothly', () => {
  const p = page();
  p.wheel(40); p.advanceTime(60); p.wheel(40);
  assert.deepEqual(p.scrolls, [], 'two small samples remain protected');
  p.advanceTime(60); p.wheel(40);
  assert.deepEqual(p.scrolls, [{ top: 120, left: 0, behavior: 'instant' }], 'the full gesture is retained when scrolling starts');
  p.advanceTime(60); p.wheel(18);
  assert.equal(p.scrolls.at(-1).top, 18, 'the gesture tail does not have to pass the threshold again');
  p.advanceTime(281); p.wheel(25);
  assert.equal(p.scrolls.length, 2, 'a new gesture regains the accidental-input protection');
  p.advanceTime(60); p.wheel(95);
  assert.equal(p.scrolls.at(-1).top, 120);
});

test('wheel intent follows input timestamps when rendering delays event processing', () => {
  const p = page();
  p.wheel(40, { timeStamp: 10 });
  p.advanceTime(500); p.wheel(40, { timeStamp: 70 });
  p.advanceTime(500); p.wheel(40, { timeStamp: 130 });
  assert.equal(p.scrolls.length, 1, 'slow processing cannot split a continuous physical gesture');
  assert.equal(p.scrolls[0].top, 120);
  p.advanceTime(20); p.wheel(20, { timeStamp: 500 });
  assert.equal(p.scrolls.length, 1, 'a real input pause restores protection even when events are processed close together');
  p.wheel(100, { timeStamp: 490 });
  assert.equal(p.scrolls.length, 1, 'an older timestamp cannot combine with a newer partial gesture');
  p.wheel(20, { timeStamp: 520 });
  assert.equal(p.scrolls.at(-1).top, 120, 'fresh consecutive input can form a new gesture after the timestamp reset');
});

test('separated small wheel inputs cannot accumulate into an accidental scroll', () => {
  const p = page();
  for (let i = 0; i < 5; i++) { p.wheel(40); p.advanceTime(281); }
  assert.deepEqual(p.scrolls, []);
  assert.equal(p.snapshot().view.k, 1);
});

test('reversing wheel direction starts a fresh gesture in both directions', () => {
  const p = page();
  p.wheel(90); p.advanceTime(30); p.wheel(-40);
  p.advanceTime(30); p.wheel(-40);
  assert.deepEqual(p.scrolls, [], 'opposite directions cannot combine to pass the threshold');
  p.advanceTime(30); p.wheel(-40);
  assert.equal(p.scrolls.at(-1).top, -120, 'a deliberate upward gesture scrolls upward');
  p.advanceTime(30); p.wheel(30);
  assert.equal(p.scrolls.length, 1, 'reversing an active scroll gesture restores the threshold');
  p.advanceTime(30); p.wheel(90);
  assert.equal(p.scrolls.at(-1).top, 120);
});

test('wheel units are normalized for line and page devices, including the visual viewport', () => {
  const lines = page();
  lines.wheel(2, { deltaMode: 1 });
  assert.deepEqual(lines.scrolls, [], 'two lines are still a small gesture');
  lines.advanceTime(30); lines.wheel(6, { deltaMode: 1 });
  assert.equal(lines.scrolls[0].top, 128);
  const pages = page(); pages.wheel(0.2, { deltaMode: 2 });
  assert.equal(pages.scrolls[0].top, 160, 'page wheel units use the window height when there is no visual viewport');
  const visual = page({ visualViewportHeight: 600 }); visual.wheel(0.2, { deltaMode: 2 });
  assert.equal(visual.scrolls[0].top, 120, 'page wheel units follow the visible viewport height');
});

for (const modifier of ['ctrlKey', 'metaKey']) {
  test(`${modifier} wheel zooms the sky without scrolling the page or inheriting an ordinary gesture`, () => {
    const p = page();
    p.api.setView({ k: 2, x: 0, y: 0 });
    p.wheel(90);
    const zoom = p.wheel(-120, { [modifier]: true });
    assert.equal(zoom.defaultPrevented, true);
    assert.ok(p.snapshot().view.k > 2, 'intentional wheel zoom remains available');
    assert.deepEqual(p.scrolls, []);
    const zoomed = p.snapshot().view;
    p.advanceTime(30); p.wheel(40);
    assert.deepEqual(p.scrolls, [], 'returning to ordinary scrolling starts a fresh gesture');
    assert.deepEqual(p.snapshot().view, zoomed);
    const overlay = p.wheel(-300, { [modifier]: true, target: p.get('planetStage') });
    assert.equal(overlay.defaultPrevented, false, 'modified wheel over other layers keeps its browser behavior');
    assert.deepEqual(p.snapshot().view, zoomed, 'the sky behind an overlay is not zoomed');
    assert.deepEqual(p.scrolls, []);
  });
}

test('horizontal-dominant wheel input neither moves the page nor zooms the sky', () => {
  const p = page(); p.api.setView({ k: 2, x: 20, y: 30 });
  const before = p.snapshot().view;
  for (const properties of [{}, { ctrlKey: true }, { metaKey: true }]) {
    const event = p.wheel(150, { deltaX: 300, ...properties });
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(p.scrolls, []);
    assert.deepEqual(p.snapshot().view, before);
  }
});

test('zero and invalid wheel deltas leave the page and camera still', () => {
  const p = page(); p.api.setView({ k: 2, x: 20, y: 30 });
  const before = p.snapshot().view;
  for (const properties of [{}, { ctrlKey: true }, { metaKey: true }]) {
    for (const delta of [0, NaN, Infinity, -Infinity]) {
      p.wheel(delta, properties);
      assert.deepEqual(p.scrolls, []);
      assert.deepEqual(p.snapshot().view, before);
    }
  }
});

for (const interruption of ['pointerdown', 'pointerleave', 'mode', 'quiz', 'zoomIn', 'zoomOut', 'zoomReset']) {
  test(`${interruption} prevents wheel input from combining across separate interactions`, () => {
    const p = page(); p.wheel(90);
    if (interruption === 'pointerdown') {
      p.pointer('pointerdown', 1, 200, 200); p.pointer('pointercancel', 1, 200, 200);
    } else if (interruption === 'pointerleave') {
      p.wrap.dispatch('pointerleave');
    } else if (interruption === 'mode') {
      p.modes[1].click();
    } else if (interruption === 'quiz') {
      p.get('playQuiz').click();
    } else {
      p.get(interruption).click();
    }
    p.advanceTime(30); p.wheel(40);
    assert.deepEqual(p.scrolls, [], 'the earlier partial gesture is discarded');
  });
}

test('zoom buttons retain their camera controls without triggering page scroll', () => {
  const p = page();
  p.get('zoomIn').click(); assert.equal(p.snapshot().view.k, 1.4);
  p.get('zoomOut').click(); assert.equal(p.snapshot().view.k, 1);
  assert.deepEqual(p.scrolls, []);
});

test('modified wheel over the solar-system canvas leaves the hidden sky camera unchanged', () => {
  const p = page(); p.modes[2].click();
  p.api.setView({ k: 2, x: 20, y: 30 });
  const before = p.snapshot().view;
  for (const modifier of ['ctrlKey', 'metaKey']) {
    const event = p.wheel(-300, { target: p.get('orrery'), [modifier]: true });
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(p.snapshot().view, before);
    assert.deepEqual(p.scrolls, []);
  }
});
