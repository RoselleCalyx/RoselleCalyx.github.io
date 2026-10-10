const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/inbox.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'inbox.html'), 'utf8');
const base = 'https://farm.example.workers.dev';
const owner = { id: 'host', email: 'keeper@example.com' };
const adoption = { id: 12, species: 'rabbit', name: 'Cloud', adoptedBy: 'A visitor', note: '<img src=x onerror=alert(1)>', created_at: '2026-10-10T12:00:00.000Z', status: 'pending' };
const tree = { id: 'seed-apple', type: 'apple', slot: 1, water: 3, canRemove: true };
const token = (overrides = {}) => ({ access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: owner, ...overrides });
const reply = (status, data) => ({ ok: status >= 200 && status < 300, status, text: async () => data == null ? '' : JSON.stringify(data) });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

function fakeDocument() {
  const elements = new Map();
  const doc = { hidden: false, activeElement: null, listeners: new Map() };
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.attributes = {}; this.hidden = false; this.disabled = false; this.value = ''; this.dataset = {}; this.classes = new Set(); }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.text = String(value); this.children = []; }
    get classList() { return { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name), add: name => this.classes.add(name), remove: name => this.classes.delete(name) }; }
    append(...children) { for (const child of children) this.children.push(...(child.fragment ? child.children : [child])); }
    replaceChildren(...children) { this.children = []; this.text = ''; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(selector === 'button' && child.tagName === 'BUTTON' ? [child] : []), ...child.querySelectorAll(selector)]); }
    focus() { doc.activeElement = this; }
    async emit(type, properties = {}) { await Promise.all((this.listeners.get(type) || []).map(listener => listener({ preventDefault() {}, target: this, ...properties }))); }
  }
  for (const [, id] of html.matchAll(/id="([^"]+)"/g)) elements.set(id, new Element());
  doc.body = new Element('body');
  const filters = ['all', 'unread'].map(filter => { const button = new Element('button'); button.dataset.filter = filter; return button; });
  doc.getElementById = id => elements.get(id) || null;
  doc.createElement = tag => new Element(tag);
  doc.createDocumentFragment = () => Object.assign(new Element(), { fragment: true });
  doc.querySelectorAll = selector => selector === '[data-filter]' ? filters : [];
  doc.addEventListener = (type, listener) => { doc.listeners.set(type, listener); };
  return { doc, elements };
}

function browser(handler = () => reply(200, []), { ui = false, site = { messageApi: base } } = {}) {
  const calls = [], saved = new Map(), dom = ui ? fakeDocument() : null;
  const window = { SITE: site, dispatchEvent() {} };
  if (dom) window.document = dom.doc;
  const context = {
    window, document: dom?.doc, URL, atob, AbortController, setTimeout, clearTimeout,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setInterval: () => 1, clearInterval() {},
    sessionStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith('/login')) return reply(200, token());
      if (url.endsWith('/me')) return reply(200, owner);
      if (url.endsWith('/logout')) return reply(204);
      if (url.includes('/messages?')) return reply(200, []);
      return handler(url, options);
    }
  };
  vm.runInNewContext(source, context, { filename: 'inbox.js' });
  return {
    api: window.HostInbox, calls, saved, ...dom,
    async signIn() {
      if (!ui) return window.HostInbox.signIn(owner.email, 'fake-password');
      dom.elements.get('hostEmail').value = owner.email;
      dom.elements.get('hostPassword').value = 'fake-password';
      await dom.elements.get('loginForm').emit('submit');
    }
  };
}

test('approved resident removal sends an authenticated JSON body for real HTTP streams', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const f = browser((url, options) => {
    assert.equal(url, base + '/api/host/farm/residents/' + id);
    assert.equal(options.method, 'DELETE');
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {});
    return reply(200, { ok: true, deleted: true });
  });
  await f.signIn();
  assert.equal((await f.api.removeResident(id)).deleted, true);
});

test('farm management does not load without a host session', async () => {
  const f = browser();
  await assert.rejects(f.api.listAdoptions(), error => error.code === 'auth_expired');
  await assert.rejects(f.api.listOrchard(), error => error.code === 'auth_expired');
  assert.equal(f.calls.length, 0);
});

test('adoption reviews use the authenticated pending list and send only an allowed decision', async () => {
  const f = browser((url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    if (url.endsWith('/adoptions?status=pending')) return reply(200, [adoption]);
    assert.equal(url, base + '/api/host/farm/adoptions/12');
    assert.equal(options.method, 'PATCH');
    assert.deepEqual(JSON.parse(options.body), { status: 'approved' });
    return reply(200, { ...adoption, status: 'approved' });
  });
  await f.signIn();
  assert.equal((await f.api.listAdoptions())[0].name, 'Cloud');
  assert.equal((await f.api.reviewAdoption(12, 'approved')).status, 'approved');
  const before = f.calls.length;
  await assert.rejects(f.api.reviewAdoption(12, 'pending'), error => error.code === 'validation');
  await assert.rejects(f.api.reviewAdoption('../12', 'approved'), error => error.code === 'validation');
  assert.equal(f.calls.length, before);
});

test('reviews reject a mismatched confirmation and a non-pending list', async () => {
  const f = browser(url => reply(200, url.includes('?status=') ? [{ ...adoption, status: 'approved' }] : { ...adoption, status: 'rejected' }));
  await f.signIn();
  await assert.rejects(f.api.listAdoptions(), error => error.code === 'invalid_response');
  await assert.rejects(f.api.reviewAdoption(12, 'approved'), error => error.code === 'invalid_response');
});

test('declining an adoption sends rejected and cannot publish it as approved', async () => {
  const f = browser((url, options) => {
    assert.equal(url, base + '/api/host/farm/adoptions/12');
    assert.deepEqual(JSON.parse(options.body), { status: 'rejected' });
    return reply(200, { ...adoption, status: 'rejected' });
  });
  await f.signIn(); assert.equal((await f.api.reviewAdoption(12, 'rejected')).status, 'rejected');
});

test('UUID adoption IDs from the shared farm can be listed and reviewed', async () => {
  const id = '8b176dbe-435b-4815-8584-07b3a1a99f20';
  const request = { ...adoption, id };
  const f = browser((url, options) => {
    if (url.endsWith('/adoptions?status=pending')) return reply(200, [request]);
    assert.equal(url, base + '/api/host/farm/adoptions/' + id);
    assert.deepEqual(JSON.parse(options.body), { status: 'approved' });
    return reply(200, { ...request, status: 'approved' });
  });
  await f.signIn(); assert.equal((await f.api.listAdoptions())[0].id, id);
  assert.equal((await f.api.reviewAdoption(id, 'approved')).id, id);
});

test('orchard removal needs an authenticated request and explicit server deletion confirmation', async () => {
  let deleted = true;
  const f = browser((url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    if (url === base + '/api/farm') return reply(200, { ok: true, maxTrees: 8, trees: [tree], residents: [] });
    assert.equal(url, base + '/api/farm/trees/seed-apple');
    assert.equal(options.method, 'DELETE'); assert.deepEqual(JSON.parse(options.body), {});
    return reply(200, { ok: true, deleted });
  });
  await f.signIn();
  assert.equal((await f.api.listOrchard()).trees.length, 1);
  assert.equal((await f.api.removeTree(tree.id)).deleted, true);
  deleted = false;
  await assert.rejects(f.api.removeTree(tree.id), error => error.code === 'invalid_response');
});

for (const [code, status] of [['farm_full', 409], ['adoption_reviewed', 409], ['tree_not_found', 404]]) {
  test(`${code} has an actionable farm error`, async () => {
    const f = browser(() => reply(status, { ok: false, code })); await f.signIn();
    await assert.rejects(code === 'tree_not_found' ? f.api.removeTree(tree.id) : f.api.reviewAdoption(12, 'approved'), error => error.code === code && error.status === status);
  });
}

test('farm requests retry an expired access token with the existing refresh flow', async () => {
  let lists = 0, refreshes = 0;
  const f = browser((url, options) => {
    if (url.endsWith('/refresh')) { refreshes++; return reply(200, token({ access_token: 'renewed-test-access' })); }
    assert.equal(url, base + '/api/host/farm/adoptions?status=pending');
    if (++lists === 1) return reply(401);
    assert.equal(options.headers.Authorization, 'Bearer renewed-test-access'); return reply(200, [adoption]);
  });
  await f.signIn(); await f.api.listAdoptions();
  assert.equal(lists, 2); assert.equal(refreshes, 1);
});

test('a review response arriving after sign-out cannot act on the changed session', async () => {
  const gate = deferred();
  const f = browser(() => gate.promise); await f.signIn();
  const pending = f.api.reviewAdoption(12, 'approved');
  await new Promise(done => setImmediate(done));
  const rejected = assert.rejects(pending, error => error.code === 'session_changed');
  await f.api.signOut(); gate.resolve(reply(200, { ...adoption, status: 'approved' }));
  await rejected; assert.equal(f.api.signedIn, false); assert.equal(f.saved.size, 0);
});

function farmReply(url) {
  if (url.includes('/adoptions?')) return reply(200, [adoption]);
  if (url === base + '/api/farm') return reply(200, { ok: true, maxTrees: 8, trees: [tree], residents: [] });
  throw Error('Unexpected fake farm route: ' + url);
}

test('the host sees private letters and adoption requests together, with user content rendered as text', async () => {
  const f = browser(farmReply, { ui: true }); await f.signIn();
  assert.equal(f.elements.get('inboxPanel').hidden, false);
  assert.equal(f.elements.get('farmReviewPanel').hidden, false);
  assert.equal(f.elements.get('orchardReviewPanel').hidden, false);
  const card = f.elements.get('adoptionList').children[0];
  assert.match(card.textContent, /Cloud.*Rabbit/);
  assert.match(card.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(card.children.some(child => child.tagName === 'IMG'), false);
  assert.equal(f.elements.get('emptyAdoptions').hidden, true);
  assert.match(f.elements.get('orchardStatus').textContent, /1 of 8/);
});

test('rapid adoption clicks submit one review, then remove only the confirmed pending request', async () => {
  const gate = deferred(); let patches = 0;
  const f = browser((url, options) => {
    if (options.method === 'PATCH') { patches++; return gate.promise; }
    return farmReply(url);
  }, { ui: true }); await f.signIn();
  const buttons = f.elements.get('adoptionList').children[0].querySelectorAll('button');
  const first = buttons[0].emit('click');
  await buttons[0].emit('click'); await buttons[1].emit('click');
  await new Promise(done => setImmediate(done));
  assert.equal(patches, 1); assert.equal(buttons.every(button => button.disabled), true);
  gate.resolve(reply(200, { ...adoption, status: 'approved' })); await first;
  assert.equal(f.elements.get('adoptionList').children.length, 0);
  assert.equal(f.elements.get('emptyAdoptions').hidden, false);
  assert.match(f.elements.get('adoptionStatus').textContent, /joined the shared farm/);
});

test('a rejected review leaves its request retryable and does not affect the letters panel', async () => {
  const f = browser((url, options) => options.method === 'PATCH' ? reply(409, { code: 'farm_full' }) : farmReply(url), { ui: true });
  await f.signIn();
  const buttons = f.elements.get('adoptionList').children[0].querySelectorAll('button'); await buttons[0].emit('click');
  assert.equal(f.elements.get('adoptionList').children.length, 1);
  assert.equal(buttons.every(button => !button.disabled), true);
  assert.match(f.elements.get('adoptionStatus').textContent, /24 residents/);
  assert.equal(f.elements.get('inboxPanel').hidden, false);
});

test('adoption loading errors can be retried without disrupting the letters', async () => {
  let unavailable = true;
  const f = browser(url => url.includes('/adoptions?') && unavailable ? reply(503) : farmReply(url), { ui: true });
  await f.signIn();
  assert.match(f.elements.get('adoptionStatus').textContent, /unavailable/);
  assert.equal(f.elements.get('refreshAdoptionsButton').disabled, false);
  unavailable = false; await f.elements.get('refreshAdoptionsButton').emit('click');
  assert.equal(f.elements.get('adoptionList').children.length, 1);
  assert.equal(f.elements.get('inboxPanel').hidden, false);
});

test('an older pending-list refresh cannot restore a request after approval', async () => {
  let lists = 0; const gate = deferred();
  const f = browser((url, options) => {
    if (options.method === 'PATCH') return reply(200, { ...adoption, status: 'approved' });
    if (url.includes('/adoptions?') && ++lists === 2) return gate.promise;
    return farmReply(url);
  }, { ui: true }); await f.signIn();
  const refresh = f.elements.get('refreshAdoptionsButton').emit('click');
  await new Promise(done => setImmediate(done));
  await f.elements.get('adoptionList').children[0].querySelectorAll('button')[0].emit('click');
  assert.equal(f.elements.get('adoptionList').children.length, 0);
  gate.resolve(reply(200, [adoption])); await refresh;
  assert.equal(f.elements.get('adoptionList').children.length, 0);
  assert.match(f.elements.get('adoptionStatus').textContent, /joined the shared farm/);
});

test('a tree needs two confirmation steps, supports cancellation and submits only one deletion', async () => {
  let deletes = 0; const gate = deferred();
  const f = browser((url, options) => { if (options.method === 'DELETE') { deletes++; return gate.promise; } return farmReply(url); }, { ui: true });
  await f.signIn();
  const [remove, cancel] = f.elements.get('orchardList').children[0].querySelectorAll('button');
  await remove.emit('click'); assert.equal(deletes, 0); assert.equal(remove.textContent, 'Confirm removal'); assert.equal(cancel.hidden, false);
  await cancel.emit('click'); assert.equal(remove.textContent, 'Remove tree'); assert.equal(cancel.hidden, true);
  await remove.emit('click'); const first = remove.emit('click'); await remove.emit('click');
  await new Promise(done => setImmediate(done)); assert.equal(deletes, 1);
  gate.resolve(reply(200, { ok: true, deleted: true })); await first;
  assert.equal(f.elements.get('orchardList').children.length, 0);
  assert.match(f.elements.get('orchardStatus').textContent, /0 of 8/);
});

test('farm authentication expiry signs out and clears farm rows alongside private letters', async () => {
  let expiry = false;
  const f = browser((url, options) => {
    if (url.endsWith('/refresh')) return reply(401);
    if (expiry && options.method === 'PATCH') return reply(401);
    return farmReply(url);
  }, { ui: true }); await f.signIn(); expiry = true;
  await f.elements.get('adoptionList').children[0].querySelectorAll('button')[0].emit('click');
  assert.equal(f.elements.get('inboxPanel').hidden, true);
  assert.equal(f.elements.get('loginPanel').hidden, false);
  assert.equal(f.elements.get('adoptionList').children.length, 0);
  assert.equal(f.elements.get('orchardList').children.length, 0);
  assert.equal(f.api.signedIn, false);
});

test('a pending review completing after logout cannot restore signed-in farm data', async () => {
  const gate = deferred();
  const f = browser((url, options) => options.method === 'PATCH' ? gate.promise : farmReply(url), { ui: true });
  await f.signIn();
  const pending = f.elements.get('adoptionList').children[0].querySelectorAll('button')[0].emit('click');
  await new Promise(done => setImmediate(done));
  await f.elements.get('logoutButton').emit('click');
  gate.resolve(reply(200, { ...adoption, status: 'approved' })); await pending;
  assert.equal(f.elements.get('inboxPanel').hidden, true);
  assert.equal(f.elements.get('adoptionList').children.length, 0);
  assert.equal(f.elements.get('orchardList').children.length, 0);
  assert.equal(f.elements.get('adoptionStatus').textContent, '');
});
