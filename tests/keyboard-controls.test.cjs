const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const productionTabs = require('./helpers/production-tabs.cjs');
const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');

function storage(failing = false) {
  const values = new Map(), warnings = [];
  const context = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem(key, value) { if (failing) throw new Error('QuotaExceededError'); values.set(key, value); }
    },
    toast: (...args) => warnings.push(args)
  };
  const start = common.indexOf('let saveWarningShown = false;');
  const end = common.indexOf('/* ---------- header ---------- */', start);
  vm.runInNewContext(common.slice(start, end) + '\n globalThis.__store = store;', context);
  return { store: context.__store, values, warnings };
}

test('storage writes report success and preserve existing JSON read and fallback behavior', () => {
  const p = storage();
  assert.equal(p.store.set('farm-trees', [{ id: 'apple' }]), true);
  assert.equal(p.values.get('farm-trees'), '[{"id":"apple"}]');
  assert.deepEqual(JSON.parse(JSON.stringify(p.store.get('farm-trees', []))), [{ id: 'apple' }]);
  assert.equal(p.store.get('missing', 'fallback'), 'fallback');
  p.values.set('broken', '{'); assert.equal(p.store.get('broken', 'fallback'), 'fallback');
  assert.deepEqual(p.warnings, []);
});

test('failed farm and wild saves return false and show one actionable warning per page', () => {
  const p = storage(true);
  assert.equal(p.store.set('sky-favs', []), false);
  assert.deepEqual(p.warnings, [], 'unrelated preferences do not show the farm backup warning');
  assert.equal(p.store.set('farm-trees', []), false);
  assert.equal(p.store.set('wild-basket', {}), false);
  assert.equal(p.store.set('farm-hearts', {}), false);
  assert.deepEqual(p.warnings, [[
    'Progress could not be saved in this browser. Check browser storage and try again.', 5200
  ]]);
});

function fixture() {
  let document;
  class Element {
    constructor(tag = 'div', id = '') {
      this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.dataset = {};
      this.attributes = new Map(); this.listeners = new Map(); this.classes = new Set();
      this.style = {}; this.clientWidth = 0; this.scrollWidth = 0; this.clientHeight = 0; this.scrollHeight = 0;
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        contains: name => this.classes.has(name),
        toggle: (name, force) => {
          const value = force === undefined ? !this.classes.has(name) : force;
          if (value) this.classes.add(name); else this.classes.delete(name);
          return value;
        }
      };
    }
    append(child) { child.parentElement = this; this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    matches(selector) {
      if (selector === 'a' || selector === 'button') return this.tagName.toLowerCase() === selector;
      if (selector === 'button[role="tab"]') return this.tagName === 'BUTTON' && this.getAttribute('role') === 'tab';
      if (selector === '[aria-current="page"]') return this.getAttribute('aria-current') === 'page';
      if (selector === '[data-open]') return this.dataset.open !== undefined;
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
      const view = selector.match(/^\[data-view="(.*)"\]$/);
      return view ? this.dataset.view === view[1] : false;
    }
    querySelectorAll(selector) {
      const found = [];
      for (const child of this.children) {
        if (child.matches(selector)) found.push(child);
        found.push(...child.querySelectorAll(selector));
      }
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) {
      for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
      return null;
    }
    contains(element) {
      for (let node = element; node; node = node.parentElement) if (node === this) return true;
      return false;
    }
    focus(options) { document.activeElement = this; this.focusOptions = options; }
    scrollIntoView(options) { this.scrollOptions = options; }
    remove() { this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); }
    addEventListener(type, listener, options = false) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ listener, capture: options === true || !!options.capture });
    }
    dispatch(type, properties = {}) {
      const event = {
        type, target: this, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.stopped = true; }, ...properties
      };
      const ancestors = [];
      for (let node = this; node; node = node.parentElement) ancestors.push(node);
      for (const node of [...ancestors].reverse()) {
        for (const entry of node.listeners.get(type) || []) if (entry.capture) entry.listener(event);
        if (event.stopped) return event;
      }
      for (const node of ancestors) {
        for (const entry of node.listeners.get(type) || []) if (!entry.capture) entry.listener(event);
        if (event.stopped) break;
      }
      return event;
    }
  }
  document = new Element('document');
  document.body = document.append(new Element('body')); document.body.dataset.page = 'gallery';
  const element = (tag = 'div', parent = document.body, id = '') => parent.append(new Element(tag, id));
  const context = { document, window: {}, addEventListener() {}, scrollY: 0, setTimeout() {}, clearTimeout() {} };
  const tabs = productionTabs(context);
  return { document, context, element, tabs };
}

function tablist(options = {}) {
  const f = fixture(), root = f.element();
  const buttons = Array.from({ length: 4 }, (_, index) => {
    const button = f.element('button', root, 'tab-' + index);
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', index === 0);
    return button;
  });
  const changes = [];
  const api = f.tabs(root, { onSelect: button => changes.push(button.id), ...options });
  return { ...f, root, buttons, changes, api };
}

test('tabs expose one keyboard stop and wrap arrow selection in both directions', () => {
  const p = tablist(); p.buttons[0].focus();
  assert.equal(p.root.getAttribute('aria-orientation'), 'horizontal');
  assert.deepEqual(p.buttons.map(button => button.tabIndex), [0, -1, -1, -1]);
  const left = p.buttons[0].dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(left.defaultPrevented, true);
  assert.equal(p.document.activeElement, p.buttons[3]);
  p.buttons[3].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(p.document.activeElement, p.buttons[0]);
  p.buttons[0].dispatch('keydown', { key: 'End' });
  assert.equal(p.document.activeElement, p.buttons[3]);
  p.buttons[3].dispatch('keydown', { key: 'Home' });
  assert.equal(p.document.activeElement, p.buttons[0]);
  assert.deepEqual(p.changes, ['tab-3', 'tab-0', 'tab-3', 'tab-0']);
  assert.deepEqual(p.buttons.map(button => button.getAttribute('aria-selected')), ['true', 'false', 'false', 'false']);
});

test('hidden and disabled tabs are excluded from keyboard navigation and activation', () => {
  const p = tablist(); p.buttons[1].disabled = true; p.buttons[2].hidden = true;
  p.buttons[0].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(p.document.activeElement, p.buttons[3]);
  p.buttons[1].dispatch('click'); p.api.select(p.buttons[2]);
  assert.equal(p.buttons[3].getAttribute('aria-selected'), 'true');
  assert.deepEqual(p.changes, ['tab-3']);
});

test('clicks, including nested icons, and silent programmatic changes share tab state', () => {
  const p = tablist(), icon = p.element('span', p.buttons[2]); p.buttons[0].focus();
  icon.dispatch('click');
  assert.equal(p.buttons[2].getAttribute('aria-selected'), 'true');
  assert.equal(p.buttons[2].tabIndex, 0);
  p.api.select(p.buttons[1], { notify: false });
  assert.deepEqual(p.changes, ['tab-2']);
  assert.equal(p.buttons[1].getAttribute('aria-selected'), 'true');
  assert.equal(p.buttons[2].getAttribute('aria-selected'), 'false');
  assert.equal(p.document.activeElement, p.buttons[0], 'programmatic changes do not steal focus');
});

test('navigation follows responsive orientation and reveals horizontally clipped tabs', () => {
  let orientation = 'vertical'; const p = tablist({ orientation: () => orientation });
  p.buttons[0].dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(p.document.activeElement, p.buttons[1]);
  p.buttons[1].dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(p.document.activeElement, p.buttons[0]);
  orientation = 'horizontal'; p.api.setOrientation();
  assert.equal(p.root.getAttribute('aria-orientation'), 'horizontal');
  assert.equal(p.buttons[0].dispatch('keydown', { key: 'ArrowDown' }).defaultPrevented, false);
  p.root.scrollWidth = 400; p.root.clientWidth = 120;
  p.buttons[0].dispatch('keydown', { key: 'End' });
  assert.deepEqual(JSON.parse(JSON.stringify(p.buttons[3].scrollOptions)), { block: 'nearest', inline: 'nearest', behavior: 'instant' });
});

for (const properties of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { defaultPrevented: true }]) {
  test(`modified or previously handled keys are preserved: ${JSON.stringify(properties)}`, () => {
    const p = tablist();
    const event = p.buttons[0].dispatch('keydown', { key: 'ArrowRight', ...properties });
    assert.equal(event.defaultPrevented, !!properties.defaultPrevented);
    assert.deepEqual(p.changes, []);
  });
}

test('Tab, unrelated keys, and events from outside a tab keep their native behavior', () => {
  const p = tablist(), unrelated = p.element('input', p.root);
  for (const key of ['Tab', 'Escape', 'PageDown', 'ArrowDown', 'ArrowUp', 'Enter', ' ']) {
    assert.equal(p.buttons[0].dispatch('keydown', { key }).defaultPrevented, false);
  }
  assert.equal(unrelated.dispatch('keydown', { key: 'ArrowRight' }).defaultPrevented, false);
  assert.deepEqual(p.changes, []);
});

function menu() {
  const f = fixture(), header = f.element('header', f.document.body, 'site-header');
  const nav = f.element('nav', header, 'nav'), current = f.element('a', nav);
  current.setAttribute('aria-current', 'page');
  const menuButton = f.element('button', header, 'menuBtn');
  for (const id of ['skyToggle', 'calmToggle']) {
    const toggle = f.element('button', header, id), tip = f.element('span', toggle); tip.classList.add('tip');
  }
  f.document.getElementById = id => id === 'site-header' ? header : null;
  Object.assign(f.context, { S: {}, PAGES: [], esc: value => String(value), ICON: new Proxy({}, { get: (_, key) => key }) });
  const start = common.indexOf('/* ---------- header ---------- */');
  const end = common.indexOf('/* ---------- footer ---------- */', start);
  vm.runInNewContext(common.slice(start, end), f.context);
  return { ...f, nav, current, menuButton, outside: f.element('button') };
}

test('keyboard menu activation enters the navigation; Escape closes it and restores the trigger', () => {
  const p = menu(); p.menuButton.focus(); p.menuButton.dispatch('click', { detail: 0 });
  assert.equal(p.document.activeElement, p.current);
  assert.equal(p.menuButton.getAttribute('aria-expanded'), 'true');
  assert.equal(p.menuButton.getAttribute('aria-label'), 'Close menu');
  const event = p.current.dispatch('keydown', { key: 'Escape' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(p.nav.classList.contains('open'), false);
  assert.equal(p.document.activeElement, p.menuButton);
  assert.equal(p.menuButton.getAttribute('aria-expanded'), 'false');
  assert.equal(p.menuButton.getAttribute('aria-label'), 'Open menu');
});

test('pointer opening preserves the trigger focus and Escape never steals unrelated focus', () => {
  const p = menu(); p.menuButton.focus(); p.menuButton.dispatch('click', { detail: 1 });
  assert.equal(p.document.activeElement, p.menuButton);
  p.outside.focus(); p.outside.dispatch('keydown', { key: 'Escape' });
  assert.equal(p.document.activeElement, p.outside);
  assert.equal(p.nav.classList.contains('open'), false);
});

test('an Escape already handled by an overlay and Escape with a closed menu remain native', () => {
  const p = menu();
  assert.equal(p.menuButton.dispatch('keydown', { key: 'Escape' }).defaultPrevented, false);
  p.menuButton.dispatch('click', { detail: 1 });
  p.menuButton.dispatch('keydown', { key: 'Escape', defaultPrevented: true });
  assert.equal(p.nav.classList.contains('open'), true);
});

test('outside click continues to dismiss the menu without changing focus or cancelling the click', () => {
  const p = menu(); p.menuButton.dispatch('click', { detail: 1 });
  p.outside.focus(); const event = p.outside.dispatch('click', { detail: 1 });
  assert.equal(p.nav.classList.contains('open'), false);
  assert.equal(event.defaultPrevented, false);
  assert.equal(p.document.activeElement, p.outside);
});

test('gallery arrow navigation switches panels and map-to-album changes resynchronize tabs and keep focus visible', async () => {
  const p = fixture(), ids = new Map();
  for (const id of ['trail', 'wall', 'tags', 'albumStory', 'viewSwitch', 'wallView', 'mapView', 'map', 'mapFallback']) {
    ids.set(id, p.element('div', p.document.body, id));
  }
  const sw = ids.get('viewSwitch'), buttons = ['wall', 'map'].map((view, index) => {
    const button = p.element('button', sw, view + 'Tab'); button.dataset.view = view;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', index === 0);
    return button;
  });
  ids.get('mapView').hidden = true;
  ids.get('mapView').append(ids.get('map'));
  ids.get('mapView').append(ids.get('mapFallback'));
  p.document.getElementById = id => ids.get(id);
  let mapInitializations = 0;
  const map = { setView() { return this; }, invalidateSize() {} };
  const L = { map() { mapInitializations++; return map; }, tileLayer() { return { addTo() {} }; }, divIcon() {} };
  Object.assign(p.context, { L, Site: { tabs: p.tabs, esc: String, ICON: {}, reveal() {} } });
  Object.assign(p.context.window, { Site: p.context.Site, GALLERY: [], L });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/gallery.js'), 'utf8'), p.context);
  buttons[0].focus(); buttons[0].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(ids.get('wallView').hidden, true); assert.equal(ids.get('mapView').hidden, false);
  assert.equal(p.document.activeElement, buttons[1]);
  assert.equal(buttons[1].getAttribute('aria-selected'), 'true');
  buttons[1].dispatch('keydown', { key: 'ArrowLeft' });
  buttons[0].dispatch('keydown', { key: 'ArrowRight' });
  await Promise.resolve();
  assert.equal(mapInitializations, 1, 'rapid repeated arrow navigation cannot initialize the same map twice');
  const albumButton = p.element('button', ids.get('map')); albumButton.dataset.open = 'trip'; albumButton.focus();
  albumButton.dispatch('click');
  assert.equal(ids.get('wallView').hidden, false); assert.equal(ids.get('mapView').hidden, true);
  assert.equal(buttons[0].getAttribute('aria-selected'), 'true');
  assert.equal(buttons[0].tabIndex, 0); assert.equal(buttons[1].tabIndex, -1);
  assert.equal(p.document.activeElement, buttons[0], 'a view change restores focus from a panel that became hidden');
  buttons[0].focus(); buttons[0].dispatch('keydown', { key: 'End' });
  assert.equal(buttons[1].getAttribute('aria-selected'), 'true');
  buttons[1].dispatch('keydown', { key: 'Home' });
  assert.equal(buttons[0].getAttribute('aria-selected'), 'true');
});
