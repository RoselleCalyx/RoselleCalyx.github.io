const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/farm.js'), 'utf8');

function block(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `production farm block exists: ${start}`);
  return source.slice(from, to);
}
// Execute the actual storage, synchronization, and modal event handlers.
// Drawing/animal motion is stubbed; neither cloud decisions nor state updates
// are reimplemented by the fixture.
const production = source.match(/const MAX_TREES = \d+;/)[0] + '\n' +
  block('let trees = [], sharedReady = false', 'function renderTree(t)') +
  block('let bubble = null;', 'function showBubble(') +
  block('/* ---------- one shared orchard, with approved residents ---------- */', '/* ---------- the season chip ---------- */') +
  block('const speciesGrid = ', 'function rosterModal()') + `
  globalThis.__farmShared = {
    applySharedFarm, refreshShared, plantModal, adoptModal, saveTrees,
    trees: () => trees, ready: () => sharedReady,
    picked: () => personalPicked,
    setBubble: (anchor, a = null) => { bubble = { anchor, a, el: document.createElement('div') }; return bubble.el; },
    bubble: () => bubble
  };`;
const tree = (extra = {}) => ({ id: 't-one', type: 'apple', slot: 0, seed: 23, variant: 2, plantedAbs: 3732575, water: 0, canRemove: true, ...extra });
const resident = (extra = {}) => ({ id: 'a-one', species: 'rabbit', name: 'Comet', adoptedBy: 'A friend', note: '', since: '2026-10', ...extra });
const snapshot = (trees = [], residents = []) => ({ ok: true, maxTrees: 8, trees, residents });
const json = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((good, bad) => { resolve = good; reject = bad; }); return { promise, resolve, reject }; };
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }

function page(options = {}) {
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.dataset = {}; this.listeners = new Map(); this.selectors = new Map();
      this.children = []; this.classes = new Set(); this.value = ''; this.textContent = ''; this.disabled = false; this.removed = false;
      this.classList = {
        toggle: (key, value) => { if (value) this.classes.add(key); else this.classes.delete(key); },
        contains: key => this.classes.has(key)
      };
    }
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
    setAttribute(name, value) { this[name] = String(value); }
    querySelector(selector) { return this.selectors.get(selector) || null; }
    querySelectorAll(selector) { const value = this.selectors.get(selector); return Array.isArray(value) ? value : []; }
    closest(selector) { return selector === 'button' && this.tagName === 'BUTTON' ? this : null; }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    remove() { this.removed = true; }
    focus() { document.activeElement = this; }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
    fire(type, extra = {}) {
      const event = { target: this, preventDefault() {}, ...extra };
      return Promise.all((this.listeners.get(type) || []).map(listener => listener(event)));
    }
  }
  const ids = new Map(), storage = new Map(Object.entries(options.storage || {})), writes = [];
  const get = id => { if (!ids.has(id)) ids.set(id, new Element()); return ids.get(id); };
  const document = { getElementById: get, createElement: tag => new Element(tag), activeElement: null };
  const rendered = [], detached = [], animals = [], added = [], messages = [], modals = [], calls = [];
  let state = snapshot();
  const queues = { load: [], plant: [], adopt: [] };
  const Cloud = { enabled: options.enabled !== false };
  for (const method of Object.keys(queues)) Cloud[method] = value => {
    calls.push({ method, value });
    const queued = queues[method].shift();
    return queued || Promise.resolve(method === 'load' ? json(state) : { ok: true });
  };
  const TREES = Object.fromEntries(['apple', 'peach', 'orange', 'cherry', 'kiwi', 'grape', 'durian', 'mango'].map(key => [key, { label: key, ripe: 'summer' }]));
  const SPECIES = Object.fromEntries(['snowcat', 'rabbit', 'panda', 'fox', 'shiba', 'hedgehog', 'duckling', 'penguin'].map(key => [key, { label: key }]));
  function addAnimal(def, opts = {}) {
    const a = { def: { ...def }, el: new Element(), keeper: !!opts.keeper, pending: !!opts.pending };
    animals.push(a); added.push(a); return a;
  }
  function modal(html, { onOpen }) {
    const card = new Element(), model = { card, closed: false, html, close() { model.closed = true; } };
    if (html.includes('<h2>Plant a Tree</h2>')) {
      model.grid = new Element(); model.buttons = Object.keys(TREES).map(type => { const b = new Element('button'); b.dataset.tree = type; return b; });
      card.selectors.set('.tree-grid', model.grid); card.selectors.set('[data-tree]', model.buttons);
    } else {
      model.form = new Element('form'); model.species = new Element();
      model.buttons = Object.keys(SPECIES).filter(key => key !== 'snowcat').map(species => { const b = new Element('button'); b.dataset.sp = species; return b; });
      card.selectors.set('form', model.form); card.selectors.set('.species-grid', model.species);
      card.selectors.set('.species-grid button', model.buttons[0]); card.selectors.set('.species-grid button[]', model.buttons);
      for (const id of ['aName', 'aBy', 'aNote', 'aStatus']) { const field = new Element(); model.form.selectors.set('#' + id, field); }
      model.submit = new Element('button'); model.form.selectors.set('[type="submit"]', model.submit);
    }
    modals.push(model); onOpen(model); return model;
  }
  const context = {
    window: { OrchardSim: { detach: value => detached.push(value.id) } }, OrchardSim: { detach: value => detached.push(value.id) },
    document, Cloud, animals, addAnimal, TREES, SPECIES, treeInline: () => '',
    ART: Object.fromEntries(Object.keys(SPECIES).map(key => [key, () => ''])),
    season: { abs: 3732575 }, ICON: {}, esc: value => String(value), modal, toast: message => messages.push(message),
    performance: { now: () => 100 },
    store: {
      get(key, fallback) { return storage.has(key) ? json(storage.get(key)) : fallback; },
      set(key, value) { storage.set(key, json(value)); writes.push(key); return true; }
    },
    renderTree(value) { if (!value.el) value.el = new Element(); rendered.push(value.id); }
  };
  vm.runInNewContext(production, context, { filename: 'farm.js:shared-farm' });
  return {
    api: context.__farmShared, context, get, document, Cloud, queues, storage, writes, rendered, detached, animals, added, messages, modals, calls,
    apply(value = state) { context.__farmShared.applySharedFarm(json(value)); },
    setState(value) { state = json(value); },
    resident: addAnimal,
    click(model, type = 'apple') { return model.grid.fire('click', { target: model.buttons.find(button => button.dataset.tree === type) }); },
    fill(model, values = {}) { for (const [id, value] of Object.entries({ aName: 'Comet', aBy: 'A friend', aNote: 'Likes stars.', ...values })) model.form.querySelector('#' + id).value = value; }
  };
}

test('the orchard starts empty and planting waits for a real shared snapshot, ignoring old local trees', () => {
  const p = page({ storage: { 'farm-trees': [tree()], 'farm-pending': [resident()] } });
  assert.deepEqual(json(p.api.trees()), []); assert.equal(p.api.ready(), false);
  p.api.plantModal(); assert.equal(p.modals.length, 0); assert.equal(p.calls.length, 0);
  assert.match(p.messages[0], /still connecting/); assert.equal(p.animals.length, 0);
});

test('all eight shared spaces block planting, while seven allow the planting dialog', () => {
  const p = page(), trees = Array.from({ length: 8 }, (_, slot) => tree({ id: 't-' + slot, slot }));
  p.apply(snapshot(trees)); p.api.plantModal();
  assert.equal(p.modals.length, 0); assert.match(p.messages[0], /holds 8 trees/);
  assert.equal(p.get('orchardCount').textContent, '8 of 8 shared spaces used');
  p.apply(snapshot(trees.slice(0, 7))); p.api.plantModal();
  assert.equal(p.modals.length, 1); assert.equal(p.calls.length, 0);
});

test('planting renders only the server snapshot after the mutation succeeds', async () => {
  const p = page(); p.apply(snapshot());
  const planted = deferred(), loaded = deferred(); p.queues.plant.push(planted.promise); p.queues.load.push(loaded.promise);
  p.api.plantModal(); const m = p.modals[0], click = p.click(m);
  assert.equal(p.api.trees().length, 0); assert.equal(p.rendered.length, 0); assert.equal(m.closed, false);
  assert.ok(m.buttons.every(button => button.disabled));
  planted.resolve({ ok: true, tree: tree() }); await flush();
  assert.equal(m.closed, true); assert.deepEqual(p.calls.map(call => call.method), ['plant', 'load']);
  assert.equal(p.api.trees().length, 0, 'a mutation result is not rendered optimistically');
  loaded.resolve(snapshot([tree()])); await click;
  assert.equal(p.api.trees().length, 1); assert.deepEqual(p.rendered, ['t-one']);
  assert.match(p.messages.at(-1), /Every visitor can see it/);
});

test('double clicks on the same or a different tree make only one planting request', async () => {
  const p = page(); p.apply(snapshot()); const planted = deferred(); p.queues.plant.push(planted.promise);
  p.api.plantModal(); const m = p.modals[0], first = p.click(m, 'apple');
  await p.click(m, 'apple'); await p.click(m, 'mango');
  assert.equal(p.calls.filter(call => call.method === 'plant').length, 1);
  assert.equal(p.api.trees().length, 0); planted.resolve({ ok: true }); await first;
});

test('a failed planting stays open, re-enables choices, and never creates a local shared tree', async () => {
  const p = page(); p.apply(snapshot()); p.api.plantModal(); const m = p.modals[0];
  p.queues.plant.push(Promise.reject(Error('Connection lost. Retry this planting.')));
  await p.click(m); await flush();
  assert.equal(m.closed, false); assert.ok(m.buttons.every(button => !button.disabled));
  assert.match(m.card.children[0].textContent, /Connection lost/);
  assert.equal(p.api.trees().length, 0); assert.equal(p.storage.has('farm-trees'), false);
  assert.equal(p.messages.some(message => /tree is saved/.test(message)), false);
});

test('a server capacity conflict refreshes a farm filled by another visitor instead of adding a ninth tree', async () => {
  const p = page(), seven = Array.from({ length: 7 }, (_, slot) => tree({ id: 't-' + slot, slot }));
  p.apply(snapshot(seven)); p.api.plantModal(); const m = p.modals[0];
  p.setState(snapshot([...seven, tree({ id: 'other-visitor', slot: 7 })]));
  p.queues.plant.push(Promise.reject(Error('The orchard is full (8 trees).')));
  await p.click(m); await flush();
  assert.equal(p.api.trees().length, 8); assert.equal(m.closed, false);
  assert.equal(p.api.trees().filter(value => value.id === 'other-visitor').length, 1);
  assert.match(m.card.children[0].textContent, /full/);
});

test('a saved mutation with a failed follow-up read is reported as saved, without inventing rendered state', async () => {
  const p = page(); p.apply(snapshot()); p.api.plantModal(); const m = p.modals[0];
  p.queues.load.push(Promise.reject(Error('Read timed out.'))); await p.click(m);
  assert.equal(m.closed, true); assert.equal(p.api.trees().length, 0);
  assert.match(p.messages.at(-1), /tree is saved. Refresh the farm/);
  assert.equal(p.get('farmSharedStatus').classList.contains('unavailable'), true);
});

for (const oldFailed of [false, true]) test(`post-mutation refresh waits for an older read then starts a genuinely fresh GET (old failed=${oldFailed})`, async () => {
  const p = page(); p.apply(snapshot()); const old = deferred(); p.queues.load.push(old.promise);
  const manual = p.api.refreshShared().catch(() => {});
  p.setState(snapshot([tree()])); p.api.plantModal(); const m = p.modals[0], click = p.click(m);
  await flush(); assert.equal(p.calls.filter(call => call.method === 'load').length, 1);
  if (oldFailed) old.reject(Error('Old load failed.')); else old.resolve(snapshot());
  await manual; await click;
  assert.equal(p.calls.filter(call => call.method === 'load').length, 2, 'a completed planting must not reuse the pre-plant read');
  assert.equal(p.api.trees().length, 1); assert.equal(p.api.trees()[0].id, 't-one');
});

test('ordinary simultaneous refresh clicks share one read request', async () => {
  const p = page(), read = deferred(); p.queues.load.push(read.promise);
  const first = p.api.refreshShared(), second = p.api.refreshShared();
  assert.equal(first, second); assert.equal(p.calls.length, 1);
  read.resolve(snapshot([tree()])); await first; assert.equal(p.api.trees().length, 1);
});

test('snapshots reuse unchanged tree nodes, update growth, add and remove trees, and close removed-tree bubbles', () => {
  const p = page({ storage: { 'farm-picked': { 't-one': { abs: 3732575, list: [1, 2] } } } });
  p.apply(snapshot([tree()])); const original = p.api.trees()[0], el = original.el;
  assert.deepEqual(json(original.picked), { abs: 3732575, list: [1, 2] });
  p.apply(snapshot([tree()])); assert.equal(p.api.trees()[0], original); assert.equal(p.api.trees()[0].el, el);
  assert.deepEqual(p.rendered, ['t-one'], 'unchanged snapshots do not reset a living tree');
  p.apply(snapshot([tree({ water: 3 }), tree({ id: 't-two', type: 'mango', slot: 1 })]));
  assert.equal(p.api.trees()[0].water, 3); assert.equal(p.api.trees()[0].el, el);
  assert.deepEqual(p.rendered, ['t-one', 't-one', 't-two']);
  const bubble = p.api.setBubble(el); p.apply(snapshot([tree({ id: 't-two', type: 'mango', slot: 1 })]));
  assert.equal(el.removed, true); assert.equal(bubble.removed, true); assert.equal(p.api.bubble(), null);
  assert.deepEqual(p.detached, ['t-one']); assert.equal(p.api.picked()['t-one'], undefined);
});

test('approved shared residents are added once and removed independently of the keeper and static residents', () => {
  const p = page(); const keeper = p.resident({ species: 'snowcat', name: 'Matcha' }, { keeper: true });
  const base = p.resident({ species: 'rabbit', name: 'Mochi' });
  p.apply(snapshot([], [resident()])); const shared = p.animals.find(value => value.sharedId);
  p.apply(snapshot([], [resident()])); assert.equal(p.animals.length, 3);
  assert.equal(shared.pending, false); const bubble = p.api.setBubble(shared.el, shared);
  p.apply(snapshot()); assert.equal(p.animals.length, 2);
  assert.ok(p.animals.includes(keeper)); assert.ok(p.animals.includes(base));
  assert.equal(shared.el.removed, true); assert.equal(bubble.removed, true);
  assert.equal(p.get('residentCount').textContent, '2 little lives');
});

test('pending adoption is saved for review and never added to the public farm or local pending storage', async () => {
  const p = page({ storage: { 'farm-pending': [resident({ name: 'Legacy pending' })] } });
  p.api.adoptModal(); const m = p.modals[0]; p.fill(m);
  assert.ok(m.buttons.every(button => button.dataset.sp !== 'snowcat'));
  p.queues.adopt.push(Promise.resolve({ ok: true, id: 'a-one', status: 'pending' }));
  await m.form.fire('submit');
  assert.equal(m.closed, true); assert.equal(p.animals.length, 0); assert.equal(p.added.length, 0);
  assert.equal(p.writes.includes('farm-pending'), false); assert.match(p.messages.at(-1), /review it before it joins/);
  assert.deepEqual(json(p.calls[0]), { method: 'adopt', value: { species: 'rabbit', name: 'Comet', adoptedBy: 'A friend', note: 'Likes stars.', website: '' } });
});

test('adoption double submission is guarded, failures remain editable, and a retry can succeed', async () => {
  const p = page(); p.api.adoptModal(); const m = p.modals[0]; p.fill(m);
  const sent = deferred(); p.queues.adopt.push(sent.promise);
  const first = m.form.fire('submit'); await m.form.fire('submit');
  assert.equal(p.calls.length, 1); assert.equal(m.submit.disabled, true);
  sent.reject(Error('Please retry.')); await first;
  assert.equal(m.closed, false); assert.equal(m.submit.disabled, false); assert.match(m.form.querySelector('#aStatus').textContent, /retry/);
  await m.form.fire('submit'); assert.equal(m.closed, true); assert.equal(p.animals.length, 0);
});

test('blank names and disconnected adoption services do not submit or create an animal', async () => {
  const p = page({ enabled: false }); p.api.adoptModal(); const m = p.modals[0]; p.fill(m, { aName: ' ' });
  await m.form.fire('submit'); assert.match(m.form.querySelector('#aStatus').textContent, /needs a name/);
  p.fill(m); await m.form.fire('submit'); assert.match(m.form.querySelector('#aStatus').textContent, /not connected/);
  assert.equal(p.calls.length, 0); assert.equal(p.animals.length, 0);
});

test('personal harvest storage contains only pick records and never overwrites shared tree positions', () => {
  const p = page(); p.apply(snapshot([tree()])); p.api.trees()[0].picked = { abs: 3732575, list: [0] };
  p.api.saveTrees();
  assert.deepEqual(p.writes, ['farm-picked']);
  assert.deepEqual(p.storage.get('farm-picked'), { 't-one': { abs: 3732575, list: [0] } });
  assert.equal(p.storage.has('farm-trees'), false); assert.equal(p.calls.length, 0);
});
