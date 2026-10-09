const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    }
    dispatch(type, properties = {}) {
      const event = { type, target: this, ...properties };
      for (const handler of this.listeners.get(type) || []) handler(event);
      if (typeof this[`on${type}`] === 'function') this[`on${type}`](event);
    }
    click() { this.dispatch('click'); }
  }
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const modes = ['const', 'planets', 'orrery', 'deep', 'fav'].map(mode => {
    const element = new Element(); element.dataset.mode = mode; return element;
  });
  get('chart').parentElement = { clientWidth: 400 };
  get('planetStage').hidden = true;
  const timers = new Map(); let nextTimer = 1;
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
    performance: { now: () => 0 }, matchMedia: query => ({ matches: query.includes('max-width') && !!options.mobile }),
    requestAnimationFrame() {}, addEventListener() {},
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    CONSTELLATIONS: constellations, DEEP_SKY: [],
    Site: { esc: value => String(value), ICON: {}, store: { get: (_, value) => value, set() {} } }
  };
  context.window = context;
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
  return { get, modes, timers, pointer, snapshot, listClick, painted, api: context.__starmapTest };
}

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
