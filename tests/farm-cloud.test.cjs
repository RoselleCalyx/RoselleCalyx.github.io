const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/farm-cloud.js'), 'utf8');
const newSpecies = ['redpanda', 'raccoon', 'wolf', 'crocodile', 'fennec'];

const tree = (extra = {}) => ({ id: 't-one', type: 'apple', slot: 0, seed: 23, variant: 2, plantedAbs: 3732575, water: 0, canRemove: true, ...extra });
const resident = (extra = {}) => ({ id: 'a-one', species: 'rabbit', name: 'Mochi', adoptedBy: 'A friend', note: 'Likes stars.', since: '2026-10', ...extra });
const snapshot = (extra = {}) => ({ ok: true, maxTrees: 8, trees: [tree()], residents: [resident()], ...extra });
const json = value => JSON.parse(JSON.stringify(value));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function page(options = {}) {
  const values = new Map(Object.entries(options.storage || {})), writes = [], warnings = [], calls = [], queue = [];
  const timers = new Map(), listeners = new Map(); let timerId = 0, random = 0;
  const document = {
    hidden: false,
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); }
  };
  const Site = { toast: (...args) => warnings.push(args) };
  const window = {
    SITE: { messageApi: options.base ?? 'https://farm.example' }, Site,
    localStorage: {
      getItem(key) { if (options.storageFailure) throw Error('blocked'); return values.get(key) ?? null; },
      setItem(key, value) { if (options.storageFailure) throw Error('quota'); values.set(key, value); writes.push(key); }
    },
    crypto: options.noCrypto ? null : { getRandomValues(bytes) { for (let i = 0; i < bytes.length; i++) bytes[i] = ++random % 256; return bytes; } }
  };
  if (options.randomUUID) window.crypto.randomUUID = options.randomUUID;
  const context = {
    window, document, Site, URL, Uint8Array, AbortController, TextEncoder,
    fetch(url, request) {
      calls.push({ url, request });
      const next = queue.shift();
      if (!next) throw Error('Unexpected request');
      return typeof next === 'function' ? next(url, request) : Promise.resolve(next);
    },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(source, context, { filename: 'farm-cloud.js' });
  function respond(body, status = 200) {
    queue.push({ ok: status >= 200 && status < 300, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body) });
  }
  return {
    api: window.FarmCloud, window, document, values, writes, warnings, calls, timers, listeners, queue, respond,
    fail() { queue.push(() => Promise.reject(Error('connection lost'))); },
    runTimer(delay) {
      const entry = [...timers].find(([, value]) => value.delay === delay);
      assert.ok(entry, `timer ${delay} exists`); timers.delete(entry[0]); entry[1].callback();
    },
    visibility(hidden) { document.hidden = hidden; for (const callback of listeners.get('visibilitychange') || []) callback(); }
  };
}
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
const errorCode = code => error => error.name === 'FarmCloudError' && error.code === code;
const payload = call => JSON.parse(call.request.body);

for (const base of ['', 'http://farm.example', 'javascript:alert(1)', 'https://user:pass@farm.example', 'https://farm.example?token=x', 'https://farm.example/#token', 'http://localhost.evil.test']) {
  test(`an unsafe or absent API base cannot perform reads or writes: ${base}`, async () => {
    const p = page({ base }); assert.equal(p.api.enabled, false);
    await assert.rejects(p.api.load(), errorCode('not_configured'));
    await assert.rejects(p.api.plant('apple'), errorCode('not_configured'));
    assert.equal(p.calls.length, 0); assert.equal(p.writes.length, 0);
  });
}
for (const base of ['https://farm.example/', 'http://localhost:4174/', 'http://127.0.0.1:4174', 'http://[::1]:4174']) {
  test(`HTTPS or local preview endpoints are supported: ${base}`, async () => {
    const p = page({ base }); p.respond(snapshot());
    assert.equal(p.api.enabled, true); assert.equal((await p.api.load()).maxTrees, 8);
    assert.equal(p.calls[0].url, base.replace(/\/+$/, '') + '/api/farm');
  });
}

test('public snapshot reads create no visitor credential and use safe fetch options', async () => {
  const p = page(); p.respond(snapshot({ trees: [tree({ url: 'javascript:bad', visitorToken: 'must not escape' })] }));
  const value = json(await p.api.load());
  assert.deepEqual(value, snapshot());
  assert.equal(p.writes.length, 0); assert.deepEqual(Object.keys(p.calls[0].request.headers), ['Accept']);
  const request = p.calls[0].request;
  assert.equal(request.credentials, 'omit'); assert.equal(request.mode, 'cors'); assert.equal(request.cache, 'no-store');
  assert.equal(request.redirect, 'error'); assert.equal(request.referrerPolicy, 'no-referrer');
  assert.equal(p.timers.size, 0);
});

test('snapshot reads send only a valid stored ownership token in its dedicated header', async () => {
  const p = page({ storage: { 'farm-visitor-token': 'a'.repeat(64), 'host-token': 'private host value' } });
  p.respond(snapshot()); await p.api.load();
  assert.equal(p.calls[0].request.headers['X-Farm-Token'], 'a'.repeat(64));
  assert.equal(p.calls[0].request.headers.Authorization, undefined);
  assert.equal(p.calls[0].request.body, undefined); assert.equal(p.writes.length, 0);
});

test('a late earlier read cannot overwrite a newer completed shared snapshot', async () => {
  const p = page(); let finishOld;
  p.queue.push(() => new Promise(resolve => { finishOld = resolve; }));
  const old = p.api.load();
  const newer = snapshot({ trees: [tree({ id: 't-two', slot: 1 })] });
  p.respond(newer); const fresh = await p.api.load();
  fresh.trees[0].water = 3;
  finishOld({ ok: true, status: 200, text: async () => JSON.stringify(snapshot()) });
  assert.deepEqual(json(await old), newer, 'latest cached snapshot is independent of caller mutations');
});

for (const [label, value] of [
  ['wrong cap', snapshot({ maxTrees: 9 })], ['more than eight trees', snapshot({ trees: Array.from({ length: 9 }, (_, slot) => tree({ id: 't-' + slot, slot })) })],
  ['duplicate ID', snapshot({ trees: [tree(), tree({ slot: 1 })] })], ['duplicate slot', snapshot({ trees: [tree(), tree({ id: 't-two' })] })],
  ['unknown type', snapshot({ trees: [tree({ type: '../injected' })] })], ['outside slot', snapshot({ trees: [tree({ slot: 8 })] })],
  ['fractional slot', snapshot({ trees: [tree({ slot: 0.5 })] })], ['invalid seed', snapshot({ trees: [tree({ seed: -1 })] })],
  ['excessive seed', snapshot({ trees: [tree({ seed: 4294967296 })] })], ['invalid shape', snapshot({ trees: [tree({ variant: 3 })] })],
  ['invalid season', snapshot({ trees: [tree({ plantedAbs: NaN })] })], ['negative water', snapshot({ trees: [tree({ water: -1 })] })],
  ['excessive water', snapshot({ trees: [tree({ water: 4 })] })], ['ownership as string', snapshot({ trees: [tree({ canRemove: 'true' })] })],
  ['unsafe ID', snapshot({ trees: [tree({ id: '<img src=x>' })] })], ['unknown resident species', snapshot({ residents: [resident({ species: 'dragon' })] })],
  ['a keeper adoption', snapshot({ residents: [resident({ species: 'snowcat' })] })], ['long resident name', snapshot({ residents: [resident({ name: 'x'.repeat(25) })] })],
  ['control character in name', snapshot({ residents: [resident({ name: 'Mochi\nspoof' })] })], ['wrong adoption month', snapshot({ residents: [resident({ since: '2026-13' })] })],
  ['duplicate resident ID', snapshot({ residents: [resident(), resident()] })], ['null tree list', snapshot({ trees: null })]
]) test(`invalid server state is rejected before rendering: ${label}`, async () => {
  const p = page(); p.respond(value); await assert.rejects(p.api.load(), errorCode('invalid_response'));
});

test('all eight slots and Unicode resident names validate without mutating the response', async () => {
  const value = snapshot({ trees: Array.from({ length: 8 }, (_, slot) => tree({ id: 't-' + slot, slot })), residents: [resident({ name: '🌙'.repeat(24) })] });
  const p = page(); p.respond(value); assert.deepEqual(json(await p.api.load()), value);
  assert.deepEqual(value.trees[7], tree({ id: 't-7', slot: 7 }));
});

test('shared snapshots preserve each new animal species and its public resident data', async () => {
  const value = snapshot({ residents: newSpecies.map(species => resident({ id: 'resident-' + species, species, name: species })) });
  const p = page(); p.respond(value);
  assert.deepEqual(json(await p.api.load()), value);
  assert.equal(p.writes.length, 0, 'reading new residents does not create visitor data');
});

test('a planting creates a private 64 hex ownership token and UUID once, then fresh intent gets a fresh ID', async () => {
  const p = page(); p.respond({ ok: true, tree: tree() });
  assert.deepEqual(json(await p.api.plant('apple')), { ok: true, tree: tree() });
  const first = payload(p.calls[0]);
  assert.match(first.visitorToken, /^[0-9a-f]{64}$/); assert.match(first.submissionId, uuidPattern);
  assert.equal(first.type, 'apple'); assert.deepEqual(p.writes, ['farm-visitor-token']);
  p.respond({ ok: true, tree: tree({ id: 't-two', slot: 1 }) }); await p.api.plant('apple');
  const second = payload(p.calls[1]); assert.equal(second.visitorToken, first.visitorToken);
  assert.notEqual(second.submissionId, first.submissionId);
  assert.deepEqual(p.writes, ['farm-visitor-token']);
});

test('concurrent identical actions share one mutation request and network retry preserves its full payload', async () => {
  const p = page(); let reject;
  p.queue.push(() => new Promise((_, rejectPromise) => { reject = rejectPromise; }));
  const first = p.api.plant('apple'), duplicate = p.api.plant('apple');
  assert.equal(first, duplicate); assert.equal(p.calls.length, 1);
  reject(Error('lost')); await assert.rejects(first, errorCode('network'));
  p.respond({ ok: true, tree: tree() }); await p.api.plant('apple');
  assert.deepEqual(payload(p.calls[1]), payload(p.calls[0]));
});

test('a real deadline rejects a stalled fetch, aborts it, and retry uses the same UUID', async () => {
  const p = page(); p.queue.push(() => new Promise(() => {}));
  const request = p.api.plant('apple'); p.runTimer(12000);
  await assert.rejects(request, errorCode('timeout'));
  assert.equal(p.calls[0].request.signal.aborted, true);
  p.respond({ ok: true, tree: tree() }); await p.api.plant('apple');
  assert.deepEqual(payload(p.calls[1]), payload(p.calls[0]));
});

test('the deadline includes reading the response body', async () => {
  const p = page(); p.queue.push({ ok: true, status: 200, text: () => new Promise(() => {}) });
  const request = p.api.load(); await flush(); p.runTimer(12000);
  await assert.rejects(request, errorCode('timeout')); assert.equal(p.timers.size, 0);
});

test('malformed successful mutations are rejected and retain the same request ID for retry', async () => {
  const p = page(); p.respond({ ok: true, tree: tree({ water: 4 }) });
  await assert.rejects(p.api.plant('apple'), errorCode('invalid_response'));
  p.respond({ ok: true, tree: tree() }); await p.api.plant('apple');
  assert.deepEqual(payload(p.calls[1]), payload(p.calls[0]));
});

test('plant and watering responses must match the requested tree type or ID', async () => {
  const p = page(); p.respond({ ok: true, tree: tree({ type: 'mango' }) });
  await assert.rejects(p.api.plant('apple'), errorCode('invalid_response'));
  p.respond({ ok: true, tree: tree({ id: 't-other' }) });
  await assert.rejects(p.api.water('t-one'), errorCode('invalid_response'));
});

test('watering and removal use server IDs and require explicit validated success', async () => {
  const p = page(); p.respond({ ok: true, tree: tree({ water: 1, extra: 'ignored' }) });
  assert.deepEqual(json(await p.api.water('t-one')), { ok: true, tree: tree({ water: 1 }) });
  assert.equal(p.calls[0].url, 'https://farm.example/api/farm/trees/t-one/water');
  assert.match(payload(p.calls[0]).submissionId, uuidPattern);
  p.respond({ ok: true }); await assert.rejects(p.api.remove('t-one'), errorCode('invalid_response'));
  p.respond({ ok: true, deleted: true }); assert.deepEqual(json(await p.api.remove('t-one')), { ok: true, deleted: true });
  assert.equal(p.calls[1].request.method, 'DELETE'); assert.equal(payload(p.calls[1]).submissionId, undefined);
});

test('a removal retry accepts an already absent tree only after a fresh validated server snapshot', async () => {
  const p = page(); p.respond({ ok: false, code: 'tree_not_found' }, 404); p.respond(snapshot({ trees: [] }));
  assert.deepEqual(json(await p.api.remove('t-one')), { ok: true, deleted: true, alreadyRemoved: true });
  assert.equal(p.calls.length, 2); assert.equal(p.calls[1].request.method, 'GET');
  p.respond({ ok: false, code: 'tree_not_found' }, 404); p.respond(snapshot());
  await assert.rejects(p.api.remove('t-one'), errorCode('tree_not_found'));
});

test('adoptions remain server-confirmed pending requests and reject keeper species or overlong names', async () => {
  const p = page(); const def = { species: 'rabbit', name: ' Mochi ', adoptedBy: ' A friend ', note: ' Likes stars. ' };
  p.respond({ ok: true, id: '550e8400-e29b-41d4-a716-446655440000', status: 'pending', html: '<img>' });
  assert.deepEqual(json(await p.api.adopt(def)), { ok: true, id: '550e8400-e29b-41d4-a716-446655440000', status: 'pending' });
  const sent = payload(p.calls[0]); assert.equal(sent.name, 'Mochi'); assert.equal(sent.adoptedBy, 'A friend');
  assert.equal(sent.note, 'Likes stars.'); assert.equal(sent.website, ''); assert.match(sent.submissionId, uuidPattern);
  await assert.rejects(p.api.adopt({ ...def, species: 'snowcat' }), errorCode('validation'));
  await assert.rejects(p.api.adopt({ ...def, name: 'x'.repeat(25) }), errorCode('validation'));
  assert.equal(p.calls.length, 1);
});

test('each new species can send a pending adoption request with an independent submission ID', async () => {
  const p = page();
  for (const species of newSpecies) {
    const result = { ok: true, id: 'adoption-' + species, status: 'pending' };
    p.respond(result);
    assert.deepEqual(json(await p.api.adopt({ species, name: ' ' + species + ' ', adoptedBy: ' A friend ', note: ' Likes the farm. ' })), result);
    const call = p.calls.at(-1), sent = payload(call);
    assert.equal(call.url, 'https://farm.example/api/farm/adoptions'); assert.equal(call.request.method, 'POST');
    assert.equal(sent.species, species); assert.equal(sent.name, species);
    assert.equal(sent.adoptedBy, 'A friend'); assert.equal(sent.note, 'Likes the farm.');
    assert.match(sent.submissionId, uuidPattern);
  }
  const sent = p.calls.map(payload);
  assert.equal(new Set(sent.map(value => value.submissionId)).size, newSpecies.length);
  assert.equal(new Set(sent.map(value => value.visitorToken)).size, 1);
  assert.deepEqual(p.writes, ['farm-visitor-token']);
  assert.equal(p.values.has('farm-pending'), false, 'new animals await shared approval');
});

test('different adoption payloads have independent retry IDs and malformed status never creates a local resident', async () => {
  const p = page(); const def = { species: 'rabbit', name: 'Mochi' };
  p.respond({ ok: true, id: 'a-one', status: 'unknown' }); await assert.rejects(p.api.adopt(def), errorCode('invalid_response'));
  p.respond({ ok: true, id: 'a-one', status: 'pending' }); await p.api.adopt(def);
  assert.deepEqual(payload(p.calls[1]), payload(p.calls[0]));
  p.fail(); await assert.rejects(p.api.adopt({ ...def, name: 'Comet' }), errorCode('network'));
  assert.notEqual(payload(p.calls[2]).submissionId, payload(p.calls[1]).submissionId);
  assert.equal(p.values.has('farm-pending'), false);
});

for (const [status, code] of [[400, 'validation'], [401, 'auth'], [403, 'ownership_required'], [409, 'farm_full'], [429, 'rate_limit'], [503, 'service_unavailable']]) {
  test(`HTTP ${status} never becomes local success and preserves its code`, async () => {
    const p = page(); p.respond({ ok: false, code, message: 'secret response should not be echoed' }, status);
    await assert.rejects(p.api.plant('apple'), error => error.code === code && error.status === status && !error.message.includes('secret'));
    assert.equal(p.values.has('farm-trees'), false);
  });
}

test('malformed JSON and excessive response bytes are rejected', async () => {
  const p = page();
  for (const response of ['{', ' '.repeat(262145), JSON.stringify({ ok: true, extra: '🌙'.repeat(70000) })]) {
    p.respond(response); await assert.rejects(p.api.load(), errorCode('invalid_response'));
  }
});

test('unavailable local storage keeps ownership stable for this page and gives one honest warning', async () => {
  const p = page({ storageFailure: true }); p.respond({ ok: true, tree: tree() }); await p.api.plant('apple');
  p.respond({ ok: true, tree: tree({ water: 1 }) }); await p.api.water('t-one');
  assert.equal(payload(p.calls[0]).visitorToken, payload(p.calls[1]).visitorToken);
  assert.equal(p.warnings.length, 1); assert.match(p.warnings[0][0], /cannot remember tree ownership/);
  assert.equal(p.writes.length, 0);
});

test('a full adoption queue asks the visitor to wait for review, without reporting an orchard capacity error', async () => {
  const p = page(); p.respond({ ok: false, code: 'farm_pending_full' }, 409);
  await assert.rejects(p.api.adopt({ species: 'rabbit', name: 'Comet' }), error => {
    assert.equal(error.code, 'farm_pending_full');
    assert.match(error.message, /review/i);
    assert.doesNotMatch(error.message, /orchard|8 trees|make room/i);
    return true;
  });
});

test('invalid stored tokens are ignored and replaced only by a secure visitor action', async () => {
  const p = page({ storage: { 'farm-visitor-token': '<invalid>' } }); p.respond(snapshot()); await p.api.load();
  assert.equal(p.calls[0].request.headers['X-Farm-Token'], undefined);
  p.respond({ ok: true, tree: tree() }); await p.api.plant('apple');
  assert.match(p.values.get('farm-visitor-token'), /^[0-9a-f]{64}$/);
});

test('without secure random credentials public reads work but mutations cannot proceed', async () => {
  const p = page({ noCrypto: true }); p.respond(snapshot()); await p.api.load();
  await assert.rejects(p.api.plant('apple'), errorCode('crypto_unavailable'));
  assert.equal(p.calls.length, 1); assert.equal(p.writes.length, 0);
});

test('invalid mutation inputs produce no request or credential write', async () => {
  const p = page();
  for (const request of [p.api.plant('../apple'), p.api.water('../tree'), p.api.remove('<tree>'), p.api.adopt(null),
    p.api.adopt({ species: 'rabbit', name: 'Mochi', adoptedBy: 0 }),
    p.api.adopt({ species: 'rabbit', name: 'Mochi', note: false }),
    p.api.adopt({ species: 'rabbit', name: 'Mochi', website: null })]) {
    await assert.rejects(request, errorCode('validation'));
  }
  assert.equal(p.calls.length, 0); assert.equal(p.writes.length, 0);
});

test('polling runs serially, pauses when hidden, and refreshes immediately when visible', async () => {
  const p = page(), states = [], errors = []; p.respond(snapshot());
  const stop = p.api.watch(value => states.push(json(value)), error => errors.push(error));
  await flush(); assert.equal(states.length, 1); assert.equal(p.calls.length, 1);
  p.respond(snapshot({ trees: [] })); p.runTimer(15000); await flush();
  assert.equal(states.length, 2); assert.equal(states[1].trees.length, 0);
  p.visibility(true); assert.equal([...p.timers.values()].filter(value => value.delay === 15000).length, 0);
  p.respond(snapshot()); p.visibility(false); await flush();
  assert.equal(states.length, 3); assert.equal(errors.length, 0);
  stop(); assert.equal(p.timers.size, 0); assert.equal(p.listeners.get('visibilitychange').size, 0);
});

test('polling reports a failure then retries and stopping suppresses an in-flight callback', async () => {
  const p = page(), states = [], errors = []; p.fail();
  const stop = p.api.watch(value => states.push(value), error => errors.push(error));
  await flush(); assert.equal(errors.length, 1); assert.equal(states.length, 0);
  let finish; p.queue.push(() => new Promise(resolve => { finish = resolve; }));
  p.runTimer(15000); stop();
  finish({ ok: true, status: 200, text: async () => JSON.stringify(snapshot()) });
  await flush(); assert.equal(states.length, 0); assert.equal(errors.length, 1); assert.equal(p.timers.size, 0);
});
