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
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(selector === 'button' && child.tagName === 'BUTTON' ? [child] : []), ...child.querySelectorAll(selector)]); }
    focus() { doc.activeElement = this; }
    async emit(type, properties = {}) { await Promise.all((this.listeners.get(type) || []).map(listener => listener({ preventDefault() {}, target: this, ...properties }))); }
  }
  for (const [, tag, attributes, id] of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
    const element = new Element(tag);
    element.hidden = /(?:^|\s)hidden(?:\s|=|$)/.test(attributes);
    for (const [, name, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) element.setAttribute(name, value);
    elements.set(id, element);
  }
  doc.body = new Element('body');
  const filters = ['all', 'unread'].map(filter => { const button = new Element('button'); button.dataset.filter = filter; return button; });
  doc.getElementById = id => elements.get(id) || null;
  doc.createElement = tag => new Element(tag);
  doc.createDocumentFragment = () => Object.assign(new Element(), { fragment: true });
  doc.querySelectorAll = selector => selector === '[data-filter]' ? filters : [];
  doc.addEventListener = (type, listener) => { doc.listeners.set(type, listener); };
  return { doc, elements };
}

function browser(handler = () => reply(200, []), { ui = false, site = { messageApi: base }, location, storedSession } = {}) {
  const calls = [], storageReads = [], saved = new Map(), dom = ui ? fakeDocument() : null;
  if (storedSession) saved.set('message-host-session-v1', JSON.stringify(storedSession));
  const window = { SITE: site, dispatchEvent() {} };
  if (location) window.location = new URL(location);
  if (dom) window.document = dom.doc;
  const context = {
    window, document: dom?.doc, URL, atob, AbortController, setTimeout, clearTimeout,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setInterval: () => 1, clearInterval() {},
    sessionStorage: { getItem: key => { storageReads.push(key); return saved.get(key) || null; }, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
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
    api: window.HostInbox, calls, saved, storageReads, ...dom,
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


test('file previews show the live workspace link and never inspect or restore a stored host session', async () => {
  const f = browser(() => { throw Error('A file preview must not make requests'); }, {
    ui: true, location: 'file:///private/tmp/local-preview/inbox.html',
    storedSession: { base, backend: 'cloudflare', session: token() }
  });
  await new Promise(done => setImmediate(done));
  assert.equal(f.api.localPreview, true); assert.equal(f.api.configured, false); assert.equal(f.api.signedIn, false);
  assert.equal(f.elements.get('localWorkspacePanel').hidden, false);
  assert.equal(f.elements.get('localWorkspacePanel').getAttribute('class'), 'setup-panel');
  for (const id of ['loginPanel', 'setupPanel', 'inboxPanel']) assert.equal(f.elements.get(id).hidden, true, id + ' remains hidden');
  for (const id of ['loginButton', 'hostEmail', 'hostPassword']) assert.equal(f.elements.get(id).disabled, true, id + ' cannot accept a local sign-in');
  assert.equal(f.elements.get('liveWorkspaceLink').getAttribute('href'), 'https://rosellecalyx.github.io/inbox.html');
  assert.deepEqual(f.storageReads, []); assert.deepEqual(f.calls, []);
  assert.equal(await f.api.restore(), false); assert.deepEqual(f.storageReads, []); assert.deepEqual(f.calls, []);
});

test('calling signIn directly from a file preview cannot send credentials to either configured backend', async () => {
  for (const site of [{ messageApi: base }, { supabase: { url: 'https://database.example', anonKey: 'sb_publishable_test' } }]) {
    const f = browser(() => { throw Error('Credentials must not leave a file preview'); }, { site, location: 'file:///private/tmp/local-preview/inbox.html' });
    await assert.rejects(f.api.signIn(owner.email, 'synthetic-secret-do-not-send'), error => error.code === 'local_preview' && error.message === 'This local preview cannot connect to the host service. Open the live host workspace to sign in.');
    assert.equal(f.api.signedIn, false); assert.equal(f.api.configured, false); assert.deepEqual(f.calls, []); assert.deepEqual(f.storageReads, []);
  }
});

test('the HTTPS owner workspace still signs in and opens private management normally', async () => {
  const f = browser(farmReply, { ui: true, location: 'https://rosellecalyx.github.io/inbox.html' });
  assert.equal(f.api.localPreview, false); assert.equal(f.api.configured, true);
  assert.equal(f.elements.get('localWorkspacePanel').hidden, true);
  await f.signIn();
  assert.equal(f.api.signedIn, true); assert.equal(f.elements.get('inboxPanel').hidden, false);
  const login = f.calls.find(call => call.url.endsWith('/login'));
  assert.ok(login); assert.equal(login.options.method, 'POST');
  assert.deepEqual(JSON.parse(login.options.body), { email: owner.email, password: 'fake-password' });
  assert.equal(f.elements.get('hostPassword').value, '', 'the password is cleared after authentication');
});

test('an HTTP localhost preview retains support for an explicitly configured local API', async () => {
  const localBase = 'http://127.0.0.1:8787';
  const f = browser(undefined, { site: { messageApi: localBase }, location: 'http://localhost:4182/inbox.html' });
  assert.equal(f.api.localPreview, false); assert.equal(f.api.configured, true);
  await f.signIn(); assert.equal(f.api.signedIn, true);
  assert.deepEqual(f.calls.map(call => call.url), [localBase + '/api/host/login', localBase + '/api/host/me']);
});

for (const [name, createError, code, message] of [
  ['network/CORS failure', () => new TypeError('Failed to fetch'), 'network_error', 'The host service could not be reached. Check your connection and try again.'],
  ['request timeout', () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }), 'timeout', 'The host service took too long to respond. Please try again.']
]) {
  test(name + ' reports its own actionable cause without discarding the host session', async () => {
    const f = browser(() => { throw createError(); }, { location: 'https://rosellecalyx.github.io/inbox.html' });
    await f.signIn();
    await assert.rejects(f.api.listAdoptions(), error => error.code === code && error.message === message);
    assert.equal(f.api.signedIn, true); assert.equal(f.saved.size, 1);
  });
}

const managedId = '22222222-2222-4222-8222-222222222222';
const managedResident = changes => ({ id: managedId, species: 'raccoon', name: 'Pebble', adoptedBy: 'A friend', note: 'Likes stones.', since: '2026-10', active: true, version: 0, created_at: '2026-10-10T00:00:00.000Z', ...changes });

test('approved animal management cannot read or write without a host session', async () => {
  const f = browser();
  await assert.rejects(f.api.listResidents(), error => error.code === 'auth_expired');
  await assert.rejects(f.api.updateResident(managedId, { version: 0, active: false }), error => error.code === 'auth_expired');
  assert.equal(f.calls.length, 0);
});

test('resident management includes resting animals and every new species while adoption review accepts the same species', async () => {
  const species = ['redpanda', 'raccoon', 'wolf', 'crocodile', 'fennec'];
  const rows = species.map((species, index) => managedResident({ id: `22222222-2222-4222-8222-22222222222${index}`, species, active: index !== 0 }));
  const f = browser(url => reply(200, url.endsWith('/residents') ? rows : species.map((species, index) => ({ ...adoption, id: index + 1, species }))));
  await f.signIn();
  assert.deepEqual(JSON.parse(JSON.stringify(await f.api.listResidents())), rows);
  assert.equal((await f.api.listAdoptions()).length, 5);
});

test('an indoor toggle sends an authenticated partial PATCH and requires the matching next version', async () => {
  const f = browser((url, options) => {
    assert.equal(url, base + '/api/host/farm/residents/' + managedId);
    assert.equal(options.method, 'PATCH'); assert.equal(options.headers.Authorization, 'Bearer test-access');
    assert.deepEqual(JSON.parse(options.body), { version: 0, active: false });
    return reply(200, managedResident({ active: false, version: 1 }));
  });
  await f.signIn();
  assert.equal((await f.api.updateResident(managedId, { version: 0, active: false })).active, false);
});

test('confirmed animal edits accept only the server-normalized requested fields', async () => {
  const changes = { version: 0, name: ' Moon ', species: 'fennec', adoptedBy: ' ', note: ' New story ', since: '2025-12', active: true };
  const f = browser(() => reply(200, managedResident({ ...changes, version: 1, name: 'Moon', adoptedBy: 'a visitor', note: 'New story' })));
  await f.signIn();
  const row = await f.api.updateResident(managedId, changes); assert.equal(row.name, 'Moon'); assert.equal(row.adoptedBy, 'a visitor');
});

test('invalid animal fields and unsafe paths never reach the host service', async () => {
  const f = browser(); await f.signIn(); const count = f.calls.length;
  for (const changes of [{ active: false }, { version: 0 }, { version: -1, active: false }, { version: 0, active: 'false' }, { version: 0, name: ' ' }, { version: 0, name: 'x'.repeat(25) }, { version: 0, species: 'snowcat' }, { version: 0, since: '2026-13' }, { version: 0, note: '\n' }, { version: 0, status: 'rejected' }]) {
    await assert.rejects(f.api.updateResident(managedId, changes), error => error.code === 'validation');
  }
  await assert.rejects(f.api.updateResident('../resident', { version: 0, active: false }), error => error.code === 'validation');
  assert.equal(f.calls.length, count);
});

test('a mismatched resident confirmation cannot falsely report success or clear the host session', async () => {
  for (const row of [managedResident({ active: true, version: 1 }), managedResident({ active: false, version: 0 }), managedResident({ active: false, version: 1, species: 'dragon' }), managedResident({ active: false, version: 1, id: '33333333-3333-4333-8333-333333333333' })]) {
    const f = browser(() => reply(200, row)); await f.signIn();
    await assert.rejects(f.api.updateResident(managedId, { version: 0, active: false }), error => error.code === 'invalid_response');
    assert.equal(f.api.signedIn, true);
  }
});

test('stale animal versions return an actionable conflict and leave the current host session intact', async () => {
  const f = browser(() => reply(409, { code: 'resident_conflict' })); await f.signIn();
  await assert.rejects(f.api.updateResident(managedId, { version: 0, active: false }), error => error.code === 'resident_conflict' && /changes are kept/.test(error.message));
  assert.equal(f.api.signedIn, true);
});

test('a late animal save from a signed-out session cannot confirm an update in a new login', async () => {
  const gate = deferred(), f = browser(() => gate.promise); await f.signIn();
  const save = f.api.updateResident(managedId, { version: 0, active: false });
  await new Promise(resolve => setImmediate(resolve)); await f.api.signOut(); await f.signIn();
  gate.resolve(reply(200, managedResident({ active: false, version: 1 })));
  await assert.rejects(save, error => error.code === 'session_changed'); assert.equal(f.api.signedIn, true);
});
