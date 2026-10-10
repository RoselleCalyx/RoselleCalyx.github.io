const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/saturn.js'), 'utf8');
const start = source.indexOf('/* ---------- wheel intent ---------- */');
const end = source.indexOf('/* ---------- scroll progress ---------- */', start);
assert.ok(start >= 0 && end > start, 'run the production home wheel listener');
const wheelSource = source.slice(start, end);

// The renderer is independent of wheel input. Run its actual input block with
// event bubbling and controllable layout, then inspect cancellation and scroll
// calls rather than reproducing or reading its private gesture state.
function page(options = {}) {
  class Element {
    constructor(tag = 'div', parent = null) {
      this.tagName = tag.toUpperCase(); this.parentElement = parent;
      this.listeners = new Map(); this.style = {};
      this.scrollHeight = 0; this.clientHeight = 0;
      this.contentEditable = null; this.overflowY = 'visible';
    }
    addEventListener(type, handler, options = {}) {
      const capture = typeof options === 'boolean' ? options : !!options.capture;
      const entry = { handler, capture, options };
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(entry);
    }
    closest(selector) {
      for (let node = this; node; node = node.parentElement) {
        const matches = selector.split(',').some(part => {
          const option = part.trim();
          if (/^[a-z]+$/i.test(option)) return node.tagName === option.toUpperCase();
          if (option.startsWith('[contenteditable]')) return node.contentEditable !== null &&
            (!option.includes(':not([contenteditable="false"])') || node.contentEditable !== 'false');
          return false;
        });
        if (matches) return node;
      }
      return null;
    }
    dispatch(type, properties = {}) {
      const event = {
        type, target: this, bubbles: type !== 'pointerleave', cancelable: true,
        defaultPrevented: false,
        preventDefault() { if (this.cancelable) this.defaultPrevented = true; },
        ...properties
      };
      const ancestors = [];
      for (let node = this; node; node = node.parentElement) ancestors.push(node);
      for (const node of [...ancestors].reverse()) {
        for (const listener of node.listeners.get(type) || []) if (listener.capture) listener.handler(event);
      }
      for (const node of event.bubbles ? ancestors : [this]) {
        for (const listener of node.listeners.get(type) || []) if (!listener.capture) listener.handler(event);
      }
      return event;
    }
  }
  const win = new Element('window'), document = new Element('document', win);
  const html = new Element('html', document), body = new Element('body', html);
  document.body = body; document.documentElement = html;
  const main = new Element('main', body), story = new Element('section', main);
  const hero = new Element('div', story), art = new Element('canvas', hero);
  const header = new Element('header', body), about = new Element('section', main);
  const footer = new Element('footer', body);
  let bottom = options.bottom ?? 3000, clock = 100;
  const innerHeight = options.innerHeight ?? 800;
  story.getBoundingClientRect = () => ({ bottom });
  document.overlay = null;
  document.querySelector = selector => {
    if (!document.overlay) return null;
    const classes = document.overlay.className.split(/\s+/);
    return selector.split(',').some(part => {
      const required = [...part.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
      return required.length && required.every(className => classes.includes(className));
    }) ? document.overlay : null;
  };
  const scrolls = [];
  const context = {
    story, document, innerHeight,
    visualViewport: options.visualViewportHeight === undefined ? undefined : { height: options.visualViewportHeight },
    getComputedStyle: element => ({ overflowY: element.overflowY }),
    performance: { now: () => clock },
    addEventListener: win.addEventListener.bind(win),
    scrollBy: value => scrolls.push(JSON.parse(JSON.stringify(value)))
  };
  context.window = context;
  vm.runInNewContext(wheelSource, context, { filename: 'saturn.js:wheel-intent' });
  function wheel(deltaY, properties = {}, target = art) {
    clock += 16;
    return target.dispatch('wheel', {
      deltaX: 0, deltaY, deltaMode: 0, timeStamp: clock,
      ...properties
    });
  }
  return {
    story, hero, art, header, about, footer, document, html, body, win, wheel, scrolls,
    create: (tag = 'div', parent = hero) => new Element(tag, parent),
    setBottom: value => { bottom = value; },
    setClock: value => { clock = value; }
  };
}

const distances = p => p.scrolls.map(value => value.top);

for (const distance of [1, 8, 30, 79, -1, -30, -79]) {
  test(`an isolated ${distance} px bump does not move the opening story`, () => {
    const p = page(), event = p.wheel(distance);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(distances(p), []);
  });
}

test('the 80 px threshold releases the entire accumulated distance without losing subsequent fine motion', () => {
  const p = page();
  for (const amount of [20, 25, 34]) p.wheel(amount);
  assert.deepEqual(distances(p), []);
  p.wheel(1); p.wheel(2); p.wheel(7);
  assert.deepEqual(distances(p), [80, 2, 7]);
  for (const call of p.scrolls) assert.deepEqual(call, { top: call.top, left: 0, behavior: 'instant' });
});

for (const amount of [80, 100, 480, -80, -300]) {
  test(`a deliberate ${amount} px input passes immediately at its original distance`, () => {
    const p = page(); p.wheel(amount);
    assert.deepEqual(distances(p), [amount]);
  });
}

test('many fine inputs in one gesture eventually scroll and remain unlocked', () => {
  const p = page();
  for (let i = 0; i < 50; i++) p.wheel(2);
  assert.deepEqual(distances(p), [80, ...Array(10).fill(2)]);
});

test('the exact 280 ms idle boundary still belongs to one gesture', () => {
  const p = page(); p.wheel(79, { timeStamp: 100 }); p.wheel(1, { timeStamp: 380 });
  assert.deepEqual(distances(p), [80]);
});

test('more than 280 ms idle starts a new gesture and resets both accumulation and an unlocked gesture', () => {
  const p = page(); p.wheel(79, { timeStamp: 100 }); p.wheel(1, { timeStamp: 381 });
  assert.deepEqual(distances(p), []);
  p.wheel(79, { timeStamp: 400 });
  assert.deepEqual(distances(p), [80]);
  p.wheel(1, { timeStamp: 681 });
  assert.deepEqual(distances(p), [80]);
  p.wheel(79, { timeStamp: 700 });
  assert.deepEqual(distances(p), [80, 80]);
});

test('direction changes discard prior accumulation and require fresh reverse intent', () => {
  const p = page(); p.wheel(70); p.wheel(-20);
  assert.deepEqual(distances(p), []);
  p.wheel(-60); p.wheel(2);
  assert.deepEqual(distances(p), [-80]);
  p.wheel(78);
  assert.deepEqual(distances(p), [-80, 80]);
});

test('out-of-order event timestamps reset the accumulated gesture', () => {
  const p = page(); p.wheel(70, { timeStamp: 200 }); p.wheel(10, { timeStamp: 100 });
  assert.deepEqual(distances(p), []);
  p.wheel(70, { timeStamp: 116 });
  assert.deepEqual(distances(p), [80]);
});

test('event arrival times survive delayed rendering rather than splitting a continuous gesture', () => {
  const p = page(); p.wheel(60, { timeStamp: 100 }); p.setClock(10000);
  p.wheel(20, { timeStamp: 150 });
  assert.deepEqual(distances(p), [80]);
});

for (const timeStamp of [0, NaN]) {
  test(`an unavailable timestamp (${String(timeStamp)}) falls back to a monotonic clock`, () => {
    const p = page(); p.wheel(40, { timeStamp }); p.wheel(40, { timeStamp });
    assert.deepEqual(distances(p), [80]);
  });
}

test('line deltas are normalized before filtering', () => {
  const p = page(); p.wheel(3, { deltaMode: 1 });
  assert.deepEqual(distances(p), []);
  p.wheel(2, { deltaMode: 1 });
  assert.deepEqual(distances(p), [80]);
});

test('page deltas use the visual viewport when present', () => {
  const p = page({ visualViewportHeight: 520 });
  p.wheel(.1, { deltaMode: 2 }); assert.deepEqual(distances(p), []);
  p.wheel(.1, { deltaMode: 2 }); assert.deepEqual(distances(p), [104]);
});

test('page deltas use the layout viewport when no visual viewport exists', () => {
  const p = page({ innerHeight: 600 }); p.wheel(1, { deltaMode: 2 });
  assert.deepEqual(distances(p), [600]);
});

test('page input in a short window still accumulates and releases', () => {
  const p = page({ innerHeight: 160 });
  p.wheel(.25, { deltaMode: 2 }); assert.deepEqual(distances(p), []);
  p.wheel(.25, { deltaMode: 2 }); assert.deepEqual(distances(p), [80]);
});

const bypasses = [
  ['Ctrl browser zoom', { ctrlKey: true }], ['Command browser zoom', { metaKey: true }],
  ['Shift native gestures', { shiftKey: true }], ['Alt native gestures', { altKey: true }],
  ['horizontal gestures', { deltaX: 120 }], ['equal diagonal gestures', { deltaX: -100 }],
  ['a noncancelable event', { cancelable: false }], ['an already handled event', { defaultPrevented: true }],
  ['a zero delta', { deltaY: 0 }], ['a NaN delta', { deltaY: NaN }], ['an infinite delta', { deltaY: Infinity }]
];
for (const [name, properties] of bypasses) {
  test(`${name} retains its native behavior and clears previous intent`, () => {
    const p = page(); p.wheel(70);
    const event = p.wheel(100, properties);
    assert.equal(event.defaultPrevented, !!properties.defaultPrevented);
    assert.deepEqual(distances(p), []);
    p.wheel(10); assert.deepEqual(distances(p), []);
    p.wheel(70); assert.deepEqual(distances(p), [80]);
  });
}

for (const overlay of ['nav', 'modal', 'lightbox']) {
  test(`an open ${overlay} preserves native scrolling and resets the gesture`, () => {
    const p = page(); p.wheel(70); p.document.overlay = { className: `${overlay} open` };
    assert.equal(p.wheel(100).defaultPrevented, false);
    p.document.overlay = null; p.wheel(10);
    assert.deepEqual(distances(p), []);
    p.wheel(70); assert.deepEqual(distances(p), [80]);
  });
}

for (const [name, lock, unlock] of [
  ['fixed body', p => { p.body.style.position = 'fixed'; }, p => { p.body.style.position = ''; }],
  ['hidden document overflow', p => { p.html.style.overflow = 'hidden'; }, p => { p.html.style.overflow = ''; }]
]) {
  test(`a ${name} page lock is respected and clears old wheel intent`, () => {
    const p = page(); p.wheel(70); lock(p);
    assert.equal(p.wheel(100).defaultPrevented, false);
    unlock(p); p.wheel(10); assert.deepEqual(distances(p), []);
    p.wheel(70); assert.deepEqual(distances(p), [80]);
  });
}

for (const tag of ['input', 'textarea', 'select']) {
  test(`wheel input over ${tag} keeps its native control behavior`, () => {
    const p = page(), control = p.create(tag); p.wheel(70);
    assert.equal(p.wheel(100, {}, control).defaultPrevented, false);
    p.wheel(10); assert.deepEqual(distances(p), []);
  });
}

test('editable ancestors keep their native behavior, including nested content', () => {
  const p = page(), editor = p.create(); editor.contentEditable = '';
  const child = p.create('span', editor);
  assert.equal(p.wheel(100, {}, child).defaultPrevented, false);
  assert.deepEqual(distances(p), []);
});

test('contenteditable=false does not suppress the scene intent filter', () => {
  const p = page(), target = p.create(); target.contentEditable = 'false';
  assert.equal(p.wheel(20, {}, target).defaultPrevented, true);
  assert.deepEqual(distances(p), []);
});

for (const overflow of ['auto', 'scroll']) {
  test(`an internal overflow-y:${overflow} area and its descendants scroll natively`, () => {
    const p = page(), scroller = p.create();
    scroller.overflowY = overflow; scroller.clientHeight = 100; scroller.scrollHeight = 300;
    const child = p.create('span', scroller); p.wheel(70);
    assert.equal(p.wheel(100, {}, child).defaultPrevented, false);
    p.wheel(10); assert.deepEqual(distances(p), []);
  });
}

test('an overflow area with no usable scroll range still receives scene filtering', () => {
  const p = page(), target = p.create();
  target.overflowY = 'auto'; target.scrollHeight = 100; target.clientHeight = 100;
  assert.equal(p.wheel(20, {}, target).defaultPrevented, true);
  assert.deepEqual(distances(p), []);
});

for (const bottom of [801, 800, 500, 0, -500]) {
  test(`the story handoff at bottom=${bottom} restores native page scrolling`, () => {
    const p = page(); p.wheel(70); p.setBottom(bottom);
    assert.equal(p.wheel(100).defaultPrevented, false);
    assert.deepEqual(distances(p), []);
    p.setBottom(3000); p.wheel(10); assert.deepEqual(distances(p), []);
  });
}

test('the final pinned pixel still permits deliberate scene scrolling', () => {
  const p = page({ bottom: 802 }); p.wheel(80);
  assert.deepEqual(distances(p), [80]);
});

for (const area of ['header', 'about', 'footer']) {
  test(`the ${area} has no intercepted wheel handling`, () => {
    const p = page();
    assert.equal(p.wheel(100, {}, p[area]).defaultPrevented, false);
    assert.deepEqual(distances(p), []);
  });
}

for (const [name, target, event] of [
  ['pointer departure', 'story', 'pointerleave'], ['pointer interaction', 'art', 'pointerdown'],
  ['window blur', 'win', 'blur'], ['resize', 'win', 'resize'],
  ['page restoration', 'win', 'pageshow'], ['anchor navigation', 'win', 'hashchange'],
  ['history navigation', 'win', 'popstate'], ['keyboard interaction', 'win', 'keydown']
]) {
  test(`${name} clears accumulated intent and a previously unlocked gesture`, () => {
    const p = page(); p.wheel(70); p[target].dispatch(event);
    p.wheel(10); assert.deepEqual(distances(p), []);
    p.wheel(70); assert.deepEqual(distances(p), [80]);
    p[target].dispatch(event); p.wheel(1);
    assert.deepEqual(distances(p), [80]);
  });
}

test('a pointer interaction outside the scene also clears earlier intent', () => {
  const p = page(); p.wheel(70); p.header.dispatch('pointerdown');
  p.wheel(10); assert.deepEqual(distances(p), []);
});

test('touch input and native scrolling events do not drive the wheel handler', () => {
  const p = page();
  for (const type of ['touchstart', 'touchmove', 'touchend', 'scroll']) {
    assert.equal(p.art.dispatch(type, { deltaY: 300 }).defaultPrevented, false);
  }
  assert.deepEqual(distances(p), []);
});
