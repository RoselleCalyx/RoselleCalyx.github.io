const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const messageSource = fs.readFileSync(path.join(root, 'js/message.js'), 'utf8');
const commonSource = fs.readFileSync(path.join(root, 'js/common.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function element() {
  const classes = new Set();
  return {
    value: '', checked: false, disabled: false, hidden: false, style: {}, dataset: {}, handlers: {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    addEventListener(name, fn) { this.handlers[name] = fn; },
    setAttribute() {}, removeAttribute(name) { delete this[name]; },
    focus() {}, checkValidity() { return true; }, appendChild() {}, remove() {},
    getBoundingClientRect() { return { width: 390, height: 520 }; }
  };
}
function style() {
  const values = new Map();
  return {
    getPropertyValue: key => values.get(key) || '', getPropertyPriority: () => '',
    setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key)
  };
}

function messageHarness(deliver) {
  const nodes = {};
  for (const id of ['bottleForm', 'bText', 'bCount', 'bStatus', 'heroBottle', 'seaEffects', 'nightSea', 'bName', 'bContact', 'bAnon', 'bChallenge', 'sendLabel', 'deliveryNote', 'contactField', 'writePane', 'readPane', 'previewToss', 'sceneStatus', 'bottleList', 'pickBottle']) nodes[id] = element();
  const form = nodes.bottleForm, sendButton = element(), anonymousLabel = element();
  form.elements = { delivery: { value: 'bottle' } };
  form.querySelector = selector => selector === '[type="submit"]' ? sendButton : selector === '.shore-anon' ? anonymousLabel : null;
  form.querySelectorAll = () => [];
  const submitted = [];
  let stamps = 0, nextId = 0;
  const site = { esc: value => value, ICON: { bottle: '' } };
  const context = vm.createContext({
    window: { Site: site }, Site: site,
    document: { getElementById: id => nodes[id], querySelectorAll: () => [], createElement: element },
    MessageDelivery: { enabled: true, mode: 'supabase', submit: args => { submitted.push(JSON.parse(JSON.stringify(args))); return deliver(args); } },
    SITE: {}, Backend: { guard() {}, check: () => '', stamp() { stamps++; } },
    crypto: { randomUUID: () => 'submission-' + (++nextId) }, Sky: { calm: true }, scrollY: 0,
    setTimeout(fn) { fn(); }
  });
  vm.runInContext(messageSource, context, { filename: 'message.js' });
  return {
    nodes, sendButton, submitted, get stamps() { return stamps; },
    write(value) { nodes.bText.value = value; nodes.bText.handlers.input(); },
    send() { return form.handlers.submit({ preventDefault() {} }); }
  };
}

test('a successful send clears only the unchanged raw draft', async () => {
  const pending = deferred(), h = messageHarness(() => pending.promise);
  h.write('  A quiet thought\n');
  const sent = h.send();
  assert.equal(h.sendButton.disabled, true);
  assert.equal(h.submitted[0].text, 'A quiet thought');
  pending.resolve({ ok: true, transport: 'supabase' });
  await sent;
  assert.equal(h.nodes.bText.value, '');
  assert.equal(h.nodes.bCount.textContent, '0 / 500');
  assert.equal(h.nodes.bStatus.textContent, 'Message sent to Chen’s private inbox.');
  assert.equal(h.stamps, 1);
  assert.equal(h.sendButton.disabled, false);
});

test('a previous message succeeding preserves the newer unsent draft and its count', async () => {
  const pending = deferred(), h = messageHarness(() => pending.promise);
  h.write('First letter');
  const sent = h.send();
  h.write('A new draft written while the first one is being sent.');
  pending.resolve({ ok: true, transport: 'supabase' });
  await sent;
  assert.equal(h.submitted[0].text, 'First letter');
  assert.equal(h.nodes.bText.value, 'A new draft written while the first one is being sent.');
  assert.equal(h.nodes.bCount.textContent, h.nodes.bText.value.length + ' / 500');
  assert.match(h.nodes.bStatus.textContent, /^Previous message sent/);
  assert.match(h.nodes.bStatus.textContent, /Your current text has not been sent\./);
  assert.equal(h.stamps, 1);
});

test('even whitespace changes after submission remain in the draft', async () => {
  const pending = deferred(), h = messageHarness(() => pending.promise);
  h.write('Same words');
  const sent = h.send();
  h.write('Same words\n\n');
  pending.resolve({ ok: true, transport: 'form' });
  await sent;
  assert.equal(h.nodes.bText.value, 'Same words\n\n');
  assert.equal(h.nodes.bCount.textContent, '12 / 500');
  assert.match(h.nodes.bStatus.textContent, /^Previous message submitted\./);
});

test('failed delivery preserves the current draft and retry submission ID', async () => {
  const attempts = [deferred(), deferred()];
  let attempt = 0;
  const h = messageHarness(() => attempts[attempt++].promise);
  h.write('Keep this letter');
  const first = h.send();
  attempts[0].resolve({ ok: false });
  await first;
  assert.equal(h.nodes.bText.value, 'Keep this letter');
  assert.equal(h.nodes.bCount.textContent, '16 / 500');
  assert.equal(h.stamps, 0);
  const retry = h.send();
  assert.equal(h.submitted[1].submissionId, h.submitted[0].submissionId);
  h.write('An edited draft to preserve even if delivery fails again');
  attempts[1].resolve({ ok: false });
  await retry;
  assert.equal(h.nodes.bText.value, 'An edited draft to preserve even if delivery fails again');
  assert.equal(h.nodes.bCount.textContent, h.nodes.bText.value.length + ' / 500');
  assert.equal(h.stamps, 0);
});

test('an accepted message clears its submission ID even if the current draft changed', async () => {
  const attempts = [deferred(), deferred()];
  let attempt = 0;
  const h = messageHarness(() => attempts[attempt++].promise);
  h.write('Send these words');
  const first = h.send();
  h.write('Edited while waiting');
  attempts[0].resolve({ ok: true, transport: 'supabase' });
  await first;
  h.write('Send these words');
  const second = h.send();
  assert.notEqual(h.submitted[1].submissionId, h.submitted[0].submissionId);
  attempts[1].resolve({ ok: true, transport: 'supabase' });
  await second;
});

function lightboxHarness(items, { deferFrame = false } = {}) {
  const frames = [], timers = [], boxes = [];
  const document = {
    body: { dataset: { page: 'gallery' }, style: style(), appendChild(el) { boxes.push(el); } },
    documentElement: { style: style(), clientWidth: 390 },
    getElementById: () => null, querySelectorAll: () => [],
    createElement() {
      const el = element();
      el.nodes = {};
      for (const selector of ['img', 'h3', '.lb-meta', '.lb-text', '.lb-side', '.lb-close', '.prev', '.next']) el.nodes[selector] = element();
      el.querySelector = selector => el.nodes[selector] || (selector === '.modal-close, .lb-close' ? el.nodes['.lb-close'] : null);
      return el;
    }
  };
  const window = { innerWidth: 390, scrollX: 0, scrollY: 0, scrollTo() {} };
  const context = vm.createContext({
    window, document, addEventListener() {}, removeEventListener() {},
    requestAnimationFrame(fn) { if (deferFrame) frames.push(fn); else fn(); },
    setTimeout(fn) { timers.push(fn); }
  });
  vm.runInContext(commonSource, context, { filename: 'common.js' });
  window.Site.lightbox(items);
  const box = boxes[0];
  return { box, nodes: box.nodes, frames, timers, next: () => box.nodes['.next'].onclick(), close: () => box.nodes['.lb-close'].onclick() };
}

test('an earlier image promise cannot replace the next image or its matching caption', async () => {
  const earlier = deferred();
  const h = lightboxHarness([{ src: () => earlier.promise, title: 'Earlier image' }, { src: 'next-image', title: 'Next image' }]);
  await flush();
  h.next();
  await flush();
  assert.equal(h.nodes.img.src, 'next-image');
  earlier.resolve('earlier-image');
  await flush();
  assert.equal(h.nodes.img.src, 'next-image');
  assert.equal(h.nodes.h3.textContent, 'Next image');
});

test('closing the lightbox invalidates a pending image response', async () => {
  const pending = deferred();
  const h = lightboxHarness([{ src: () => pending.promise, title: 'Pending image' }]);
  await flush();
  h.close();
  pending.resolve('late-image');
  await flush();
  assert.equal(h.nodes.img.src, undefined);
  assert.equal(h.box.classList.contains('open'), false);
});

test('closing before the first animation frame cannot reopen the lightbox', async () => {
  const h = lightboxHarness([{ src: 'image', title: 'Image' }], { deferFrame: true });
  h.close();
  for (const frame of h.frames) frame();
  await flush();
  assert.equal(h.box.classList.contains('open'), false);
  assert.equal(h.nodes.img.src, undefined);
});

test('rejected image sources show a fallback while keeping their description', async () => {
  const h = lightboxHarness([{ src: () => Promise.reject(new Error('generation failed')), title: 'Image', text: 'Original description' }]);
  await flush();
  assert.equal(h.nodes.img.src, undefined);
  assert.equal(h.nodes.img.alt, 'The image could not load.');
  assert.equal(h.nodes['.lb-text'].textContent, 'Original description\n\nThe image could not load.');
  assert.equal(h.nodes['.lb-side'].style.display, '');
});

test('a stale rejection cannot erase the next image or replace its caption with an error', async () => {
  const previous = deferred();
  const h = lightboxHarness([{ src: () => previous.promise, title: 'Previous image' }, { src: 'current-image', title: 'Current image', text: 'Current description' }]);
  await flush();
  h.next();
  await flush();
  previous.reject(new Error('old source failed'));
  await flush();
  assert.equal(h.nodes.img.src, 'current-image');
  assert.equal(h.nodes.h3.textContent, 'Current image');
  assert.equal(h.nodes['.lb-text'].textContent, 'Current description');
});

test('a source function that throws synchronously is caught as an image failure', async () => {
  const h = lightboxHarness([{ src: () => { throw new Error('source threw'); }, title: 'Image' }]);
  await flush();
  assert.equal(h.nodes.img.alt, 'The image could not load.');
  assert.match(h.nodes['.lb-text'].textContent, /The image could not load\./);
});
