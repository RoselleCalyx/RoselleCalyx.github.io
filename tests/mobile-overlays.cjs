const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');

function cssStyle(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, [value, '']]));
  return {
    getPropertyValue: key => values.get(key)?.[0] || '',
    getPropertyPriority: key => values.get(key)?.[1] || '',
    setProperty(key, value, priority = '') { values.set(key, [value, priority]); },
    removeProperty(key) { values.delete(key); }
  };
}

function harness({ deferFrame = false, scrollbar = 0 } = {}) {
  const listeners = new Map(), frames = [], timers = [], scrollCalls = [], boxes = [];
  let document;
  function dispatch(name, fields = {}) {
    const event = Object.assign({
      defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; }
    }, fields);
    for (const { fn } of [...(listeners.get(name) || [])]) fn(event);
    return event;
  }
  function node(name = '') {
    const classes = new Set(), attributes = new Map();
    const el = {
      name, style: cssStyle(), dataset: {}, children: [], parent: null, handlers: {},
      hidden: false, disabled: false, tabIndex: name === 'input' || name === 'button' || name === 'link' ? 0 : -1,
      classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
      setAttribute(key, value) { attributes.set(key, value); if (key === 'tabindex') this.tabIndex = Number(value); },
      removeAttribute(key) { attributes.delete(key); if (key === 'src') delete this.src; },
      appendChild(child) { child.parent = this; this.children.push(child); return child; },
      contains(target) { while (target) { if (target === this) return true; target = target.parent; } return false; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; },
      get isConnected() { return this === document.body || !!this.parent?.isConnected; },
      getClientRects() { return this.hidden ? [] : [{}]; },
      focus(options) { this.focusOptions = options; document.activeElement = this; dispatch('focusin', { target: this }); },
      addEventListener(type, fn) { this.handlers[type] = fn; },
      querySelector(selector) { return this.nodes?.[selector] || (selector === '.modal-close, .lb-close' ? this.nodes?.['.modal-close'] || this.nodes?.['.lb-close'] : null); },
      querySelectorAll() { return this.controls || []; }
    };
    Object.defineProperty(el, 'innerHTML', { set(html) {
      this.nodes = {}; this.controls = [];
      const child = (selector, type = 'div', parent = this) => {
        const result = node(type); parent.appendChild(result); this.nodes[selector] = result; return result;
      };
      if (this.className === 'lightbox') {
        const close = child('.lb-close', 'button'); this.controls.push(close);
        child('img', 'img'); child('h3'); child('.lb-meta'); child('.lb-text'); child('.lb-side');
        if (html.includes('lb-nav prev')) this.controls.push(child('.prev', 'button'), child('.next', 'button'));
      } else if (this.className === 'modal') {
        const card = child('.modal-card'), close = child('.modal-close', 'button', card); this.controls.push(close);
        if (html.includes('<input')) this.controls.push(child('input', 'input', card));
        if (html.includes('data-action')) this.controls.push(child('[data-action]', 'button', card));
      }
    } });
    return el;
  }
  document = { body: null, documentElement: { style: cssStyle(), clientWidth: 390 - scrollbar },
    activeElement: null, getElementById: () => null, querySelectorAll: () => [], createElement: () => node() };
  document.body = node('body'); document.body.dataset.page = 'papers';
  const append = document.body.appendChild;
  document.body.appendChild = function (el) { boxes.push(el); return append.call(this, el); };
  const trigger = node('button'); append.call(document.body, trigger); document.activeElement = trigger;
  const window = { innerWidth: 390, scrollX: 4, scrollY: 824,
    scrollTo(x, y) { scrollCalls.push({ x, y, behavior: document.documentElement.style.getPropertyValue('scroll-behavior') }); this.scrollX = x; this.scrollY = y; } };
  const context = vm.createContext({ window, document,
    addEventListener(name, fn, capture) { const list = listeners.get(name) || []; list.push({ fn, capture }); listeners.set(name, list); },
    removeEventListener(name, fn, capture) { listeners.set(name, (listeners.get(name) || []).filter(item => item.fn !== fn || item.capture !== capture)); },
    getComputedStyle: () => ({ paddingRight: '8px' }),
    requestAnimationFrame(fn) { if (deferFrame) frames.push(fn); else fn(); },
    setTimeout(fn) { timers.push(fn); }
  });
  vm.runInContext(source, context, { filename: 'common.js' });
  return { window, document, trigger, boxes, listeners, frames, timers, scrollCalls, node, dispatch, Site: window.Site,
    lightbox(items = [{ src: 'figure', title: 'Figure' }]) { window.Site.lightbox(items); return boxes[boxes.length - 1]; },
    modal(html = '') { return window.Site.modal(html); },
    key(key, shiftKey = false) { return dispatch('keydown', { key, shiftKey }); }
  };
}

test('a lightbox opens with Close focused, traps Tab, and Escape returns to its trigger', () => {
  const h = harness(), box = h.lightbox([{ src: 'a' }, { src: 'b' }]), close = box.nodes['.lb-close'];
  assert.equal(h.document.activeElement, close);
  assert.equal(close.focusOptions.preventScroll, true);
  assert.equal(h.key('Tab', true).defaultPrevented, true);
  assert.equal(h.document.activeElement, box.nodes['.next']);
  assert.equal(h.key('Tab').defaultPrevented, true);
  assert.equal(h.document.activeElement, close);
  box.nodes['.prev'].focus();
  assert.equal(h.key('Tab').defaultPrevented, false, 'ordinary traversal within the overlay stays native');
  const escape = h.key('Escape');
  assert.equal(escape.defaultPrevented, true);
  assert.equal(escape.propagationStopped, true);
  assert.equal(box.classList.contains('open'), false);
  assert.equal(h.document.activeElement, h.trigger);
  assert.equal(h.listeners.get('keydown').length, 0);
  assert.equal(h.listeners.get('focusin').length, 0);
});

test('a single-image lightbox keeps either Tab direction on Close and redirects background focus', () => {
  const h = harness(), box = h.lightbox(), close = box.nodes['.lb-close'];
  assert.equal(h.key('Tab').defaultPrevented, true);
  assert.equal(h.document.activeElement, close);
  assert.equal(h.key('Tab', true).defaultPrevented, true);
  h.trigger.focus();
  assert.equal(h.document.activeElement, close);
});

test('modal shares Close focus, respects disabled or hidden controls, and restores focus', () => {
  const h = harness(), modal = h.modal('<input><button data-action>Save</button>');
  const close = modal.el.nodes['.modal-close'], input = modal.el.nodes.input, action = modal.el.nodes['[data-action]'];
  assert.equal(h.document.activeElement, close);
  input.disabled = true; action.hidden = true;
  assert.equal(h.key('Tab').defaultPrevented, true);
  assert.equal(h.document.activeElement, close);
  input.disabled = false; action.hidden = false;
  action.focus();
  assert.equal(h.key('Tab').defaultPrevented, true);
  assert.equal(h.document.activeElement, close);
  h.key('Escape');
  assert.equal(h.document.activeElement, h.trigger);
  modal.close();
  assert.equal(h.scrollCalls.length, 1, 'closing twice must not unlock or restore twice');
});

test('overlay locks the background with fixed body and restores exact styles and scroll immediately', () => {
  const h = harness({ scrollbar: 12 }), body = h.document.body, html = h.document.documentElement;
  body.style.setProperty('position', 'relative', 'important'); body.style.setProperty('top', '2px');
  body.style.setProperty('padding-right', '8px'); html.style.setProperty('overflow', 'clip', 'important');
  html.style.setProperty('scroll-behavior', 'smooth', 'important');
  const box = h.lightbox();
  assert.equal(body.style.getPropertyValue('position'), 'fixed');
  assert.equal(body.style.getPropertyValue('top'), '-824px');
  assert.equal(body.style.getPropertyValue('left'), '-4px');
  assert.equal(body.style.getPropertyValue('padding-right'), '20px');
  assert.equal(html.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(box.nodes['.lb-side'].style.getPropertyValue('overflow'), '', 'internal overlay scroll is untouched');
  h.window.scrollX = 0; h.window.scrollY = 0;
  box.nodes['.lb-close'].onclick();
  assert.equal(body.style.getPropertyValue('position'), 'relative');
  assert.equal(body.style.getPropertyPriority('position'), 'important');
  assert.equal(body.style.getPropertyValue('top'), '2px');
  assert.equal(body.style.getPropertyValue('left'), '');
  assert.equal(body.style.getPropertyValue('width'), '');
  assert.equal(body.style.getPropertyValue('padding-right'), '8px');
  assert.equal(html.style.getPropertyValue('overflow'), 'clip');
  assert.equal(html.style.getPropertyPriority('overflow'), 'important');
  assert.deepEqual(h.scrollCalls, [{ x: 4, y: 824, behavior: 'auto' }]);
  assert.equal(html.style.getPropertyValue('scroll-behavior'), 'smooth');
  assert.equal(html.style.getPropertyPriority('scroll-behavior'), 'important');
});

test('nested overlays keep one scroll lock and let only the top overlay handle Escape', () => {
  const h = harness(), modal = h.modal('<input>'), input = modal.el.nodes.input;
  input.focus();
  const box = h.lightbox();
  h.key('Escape');
  assert.equal(modal.el.classList.contains('open'), true);
  assert.equal(h.document.activeElement, input);
  assert.equal(h.document.body.style.getPropertyValue('position'), 'fixed');
  assert.equal(h.scrollCalls.length, 0);
  modal.close();
  assert.equal(h.document.activeElement, h.trigger);
  assert.deepEqual(h.scrollCalls, [{ x: 4, y: 824, behavior: 'auto' }]);
  assert.equal(box.classList.contains('open'), false);
});

test('closing an underlying overlay leaves the top overlay focused and the page locked', () => {
  const h = harness(), modal = h.modal(), box = h.lightbox();
  modal.close();
  assert.equal(h.document.activeElement, box.nodes['.lb-close']);
  assert.equal(h.document.body.style.getPropertyValue('position'), 'fixed');
  assert.equal(h.scrollCalls.length, 0);
  box.nodes['.lb-close'].onclick();
  assert.equal(h.document.body.style.getPropertyValue('position'), '');
  assert.equal(h.scrollCalls.length, 1);
  assert.equal(h.document.activeElement, h.trigger, 'a closed underlying overlay must not receive restored focus');
});

test('closing a modal before its opening frame prevents late focus or reopening', () => {
  const h = harness({ deferFrame: true }), modal = h.modal('<input>');
  modal.close();
  for (const frame of h.frames) frame();
  assert.equal(modal.el.classList.contains('open'), false);
  assert.equal(h.document.activeElement, h.trigger);
  assert.equal(h.document.body.style.getPropertyValue('position'), '');
});

test('lightbox arrow navigation stays inside the overlay while modal and closed overlays leave other keys alone', async () => {
  const h = harness(), modal = h.modal('<input>');
  assert.equal(h.key('ArrowRight').defaultPrevented, false);
  assert.equal(h.key('Enter').defaultPrevented, false);
  modal.close();
  const box = h.lightbox([{ src: 'first', title: 'First' }, { src: 'second', title: 'Second' }]);
  assert.equal(h.key('ArrowRight').defaultPrevented, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(box.nodes.h3.textContent, 'Second');
  assert.equal(h.document.activeElement, box.nodes['.lb-close']);
  box.nodes['.lb-close'].onclick();
  assert.equal(h.key('ArrowRight').defaultPrevented, false);
  assert.equal(h.key('Tab').defaultPrevented, false);
  assert.equal(h.key('Escape').propagationStopped, false);
});
