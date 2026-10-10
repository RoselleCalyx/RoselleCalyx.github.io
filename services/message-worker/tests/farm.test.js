import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from '../src/worker.js';

// D1 batches are transactional. Execute SQLite statements synchronously within
// each batch, so concurrent fetches cannot interleave a transaction on this one
// test connection. The SQL, constraints and seed rows are the real migrations.
class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    for (const migration of ['0001_message_inbox.sql', '0002_shared_farm.sql', '0003_owner_content.sql', '0004_farm_species.sql', '0006_resident_management.sql']) this.sqlite.exec(readFileSync(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
    this.failOperation = false;
    this.queries = [];
  }
  prepare(sql) {
    let values = [];
    const db = this;
    const execute = () => {
      db.queries.push(sql);
      if (db.failOperation && sql.startsWith('INSERT INTO farm_operations')) throw new Error('simulated failed operation ledger');
      return db.sqlite.prepare(sql).all(...values).map(row => ({ ...row }));
    };
    return {
      bind(...parameters) { values = parameters; return this; },
      execute,
      async all() { return { success: true, results: execute() }; },
      async first() { return execute()[0] || null; },
      async run() {
        db.queries.push(sql);
        const result = db.sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
      }
    };
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try {
      const results = statements.map(statement => ({ success: true, results: statement.execute() }));
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  rows(table) { return this.sqlite.prepare('SELECT * FROM ' + table).all().map(row => ({ ...row })); }
}
const credential = () => [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
const treeBody = (visitorToken, overrides = {}) => ({ type: 'apple', visitorToken, submissionId: crypto.randomUUID(), ...overrides });
const adoptionBody = (visitorToken, overrides = {}) => ({ species: 'rabbit', name: 'Comet', adoptedBy: 'A friend', note: 'Likes the orchard.', visitorToken, submissionId: crypto.randomUUID(), website: '', ...overrides });
function fixture() {
  const env = { DB: new D1(), ALLOWED_ORIGIN: 'https://rosellecalyx.github.io', HOST_EMAIL: 'host@example.com', HOST_PASSWORD: 'a long random host password for testing' };
  return {
    env,
    async call(path, { method = 'GET', body, token, visitorToken, origin = env.ALLOWED_ORIGIN, ip = '192.0.2.1', headers = {} } = {}) {
      const requestHeaders = { 'CF-Connecting-IP': ip, ...headers };
      if (origin != null) requestHeaders.Origin = origin;
      if (token) requestHeaders.Authorization = 'Bearer ' + token;
      if (visitorToken) requestHeaders['X-Farm-Token'] = visitorToken;
      if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
      return worker.fetch(new Request('https://messages.example.workers.dev' + path, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) }), env, {});
    },
    async snapshot(options) {
      const response = await this.call('/api/farm', options);
      assert.equal(response.status, 200);
      return response.json();
    },
    async plant(visitorToken, overrides, options = {}) {
      return this.call('/api/farm/trees', { method: 'POST', body: treeBody(visitorToken, overrides), ...options });
    },
    async adopt(visitorToken, overrides, options = {}) {
      return this.call('/api/farm/adoptions', { method: 'POST', body: adoptionBody(visitorToken, overrides), ...options });
    },
    async login() {
      const response = await this.call('/api/host/login', { method: 'POST', body: { email: env.HOST_EMAIL, password: env.HOST_PASSWORD } });
      assert.equal(response.status, 200);
      return (await response.json()).access_token;
    }
  };
}

test('shared migration seeds the same four mature trees and public shape', async () => {
  const f = fixture(), snapshot = await f.snapshot();
  assert.deepEqual(Object.keys(snapshot).sort(), ['maxTrees', 'ok', 'residents', 'trees']);
  assert.equal(snapshot.maxTrees, 8);
  assert.deepEqual(snapshot.trees.map(tree => [tree.type, tree.slot, tree.seed, tree.water, tree.plantedAbs]), [['peach', 0, 37, 3, 0], ['cherry', 1, 11, 3, 0], ['apple', 2, 23, 3, 0], ['orange', 3, 41, 3, 0]]);
  assert.ok(snapshot.trees.every(tree => tree.canRemove === false));
  assert.deepEqual(snapshot.residents, []);
  for (const tree of snapshot.trees) assert.deepEqual(Object.keys(tree).sort(), ['canRemove', 'id', 'plantedAbs', 'seed', 'slot', 'type', 'variant', 'water']);
});

test('species migration preserves existing submissions, reviews and indexes', () => {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_message_inbox.sql', '0002_shared_farm.sql', '0003_owner_content.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  const insert = sqlite.prepare('INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const time = '2026-10-10T00:00:00.000Z';
  for (const [index, status] of ['pending', 'approved', 'rejected'].entries()) insert.run('existing-' + index, 'submission-' + index, '0'.repeat(64), '1'.repeat(64), ['rabbit', 'fox', 'panda'][index], 'Friend ' + index, 'A visitor', 'Keep this note.', status, time, status === 'pending' ? null : time);
  const before = sqlite.prepare('SELECT * FROM farm_adoptions ORDER BY id').all();
  sqlite.exec(readFileSync(new URL('../migrations/0004_farm_species.sql', import.meta.url), 'utf8'));
  assert.deepEqual(sqlite.prepare('SELECT * FROM farm_adoptions ORDER BY id').all(), before);
  const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'farm_adoptions'").all().map(row => row.name);
  assert.ok(indexes.includes('farm_adoptions_status_idx')); assert.ok(indexes.includes('farm_adoptions_visitor_idx'));
  assert.throws(() => sqlite.prepare("INSERT INTO farm_adoptions SELECT 'duplicate', submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at, reviewed_at FROM farm_adoptions LIMIT 1").run(), /UNIQUE/);
  assert.throws(() => sqlite.prepare("UPDATE farm_adoptions SET species = 'dragon' WHERE id = 'existing-0'").run(), /CHECK/);
  sqlite.close();
});

test('new animal species can be submitted, reviewed and returned as public residents', async () => {
  const f = fixture(), species = ['redpanda', 'raccoon', 'wolf', 'crocodile', 'fennec'], host = await f.login();
  for (const animal of species) {
    const response = await f.adopt(credential(), { species: animal, name: animal });
    assert.equal(response.status, 200, animal);
    const submitted = await response.json();
    assert.equal(submitted.status, 'pending');
    const review = await f.call('/api/host/farm/adoptions/' + submitted.id, { method: 'PATCH', token: host, body: { status: 'approved' } });
    assert.equal(review.status, 200, animal);
    assert.equal((await review.json()).species, animal);
  }
  assert.deepEqual((await f.snapshot()).residents.map(row => row.species).sort(), [...species].sort());
});

test('different clients see the same new tree while removal rights stay with its owner', async () => {
  const f = fixture(), owner = credential(), other = credential();
  const planted = await f.plant(owner, { type: 'grape' });
  assert.equal(planted.status, 200);
  const { tree } = await planted.json();
  assert.equal(tree.slot, 4); assert.equal(tree.water, 0); assert.equal(tree.canRemove, true);
  assert.equal(tree.type, 'grape'); assert.equal(tree.variant, tree.seed % 3);
  assert.equal(tree.plantedAbs, Math.floor(Date.now() / 480000));
  for (const options of [undefined, { visitorToken: other }]) {
    const shared = (await f.snapshot(options)).trees.find(row => row.id === tree.id);
    assert.equal(shared.canRemove, false);
    assert.equal(shared.seed, tree.seed);
    assert.equal(shared.type, 'grape');
  }
  assert.equal((await f.snapshot({ visitorToken: owner })).trees.find(row => row.id === tree.id).canRemove, true);
  const privateRows = JSON.stringify(f.env.DB.rows('farm_trees'));
  assert.equal(privateRows.includes(owner), false, 'only a digest of the visitor credential is stored');
  assert.equal(JSON.stringify(await f.snapshot({ visitorToken: owner })).includes(f.env.DB.rows('farm_trees').find(row => row.id === tree.id).owner_hash), false);
});

test('concurrent visitors atomically occupy only four free slots and never exceed eight', async () => {
  const f = fixture();
  const responses = await Promise.all(Array.from({ length: 32 }, (_, i) => f.plant(credential(), { type: ['apple', 'mango', 'durian', 'kiwi'][i % 4] }, { ip: '192.0.2.' + (i + 1) })));
  assert.equal(responses.filter(response => response.status === 200).length, 4);
  assert.equal(responses.filter(response => response.status === 409).length, 28);
  const snapshot = await f.snapshot();
  assert.equal(snapshot.trees.length, 8);
  assert.deepEqual(snapshot.trees.map(tree => tree.slot), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(f.env.DB.rows('farm_operations').length, 4);
  assert.throws(() => f.env.DB.sqlite.exec("INSERT INTO farm_trees SELECT 'direct-extra', type, 8, seed, variant, planted_abs, water, owner_hash, initial, created_at FROM farm_trees LIMIT 1"), /CHECK/);
});

test('concurrent retries of the same planting create one tree and one operation', async () => {
  const f = fixture(), owner = credential(), body = treeBody(owner, { type: 'cherry' });
  const responses = await Promise.all(Array.from({ length: 8 }, () => f.call('/api/farm/trees', { method: 'POST', body })));
  assert.ok(responses.every(response => response.status === 200));
  const trees = await Promise.all(responses.map(async response => (await response.json()).tree));
  assert.equal(new Set(trees.map(tree => tree.id)).size, 1);
  assert.equal((await f.snapshot()).trees.length, 5);
  assert.equal(f.env.DB.rows('farm_operations').length, 1);
  const conflict = await f.call('/api/farm/trees', { method: 'POST', body: { ...body, type: 'orange' } });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, 'submission_conflict');
  assert.equal((await f.call('/api/farm/trees', { method: 'POST', body: { ...body, visitorToken: credential() } })).status, 409);
});

test('an idempotent planting retry does not resurrect a tree after its owner removes it', async () => {
  const f = fixture(), owner = credential(), body = treeBody(owner);
  const first = (await (await f.call('/api/farm/trees', { method: 'POST', body })).json()).tree;
  assert.equal((await f.call('/api/farm/trees/' + first.id, { method: 'DELETE', body: { visitorToken: owner } })).status, 200);
  const retry = await f.call('/api/farm/trees', { method: 'POST', body });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).tree.id, first.id);
  assert.equal((await f.snapshot()).trees.some(tree => tree.id === first.id), false);
  assert.equal((await f.snapshot()).trees.length, 4);
});

test('a failed operation ledger rolls the new planting back rather than leaving an orphan tree', async () => {
  const f = fixture(); f.env.DB.failOperation = true;
  const response = await f.plant(credential());
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /shared farm/);
  assert.equal(f.env.DB.rows('farm_trees').length, 4);
  assert.equal(f.env.DB.rows('farm_operations').length, 0);
});

test('different concurrent payloads sharing a UUID cannot cause a second planting', async () => {
  const f = fixture(), owner = credential(), submissionId = crypto.randomUUID();
  const responses = await Promise.all(['apple', 'orange'].map(type => f.plant(owner, { type, submissionId })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal((await f.snapshot()).trees.length, 5);
  assert.equal(f.env.DB.rows('farm_operations').length, 1);
});

test('one operation UUID cannot be reused across planting and watering', async () => {
  const f = fixture(), owner = credential(), submissionId = crypto.randomUUID();
  const responses = await Promise.all([
    f.plant(owner, { submissionId }),
    f.call('/api/farm/trees/initial-apple/water', { method: 'POST', body: { visitorToken: owner, submissionId } })
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(f.env.DB.rows('farm_operations').length, 1);
  assert.ok((await f.snapshot()).trees.length <= 5);
});

test('any visitor can water a shared tree, water is capped at three and retries water once', async () => {
  const f = fixture(), owner = credential(), other = credential();
  const tree = (await (await f.plant(owner)).json()).tree;
  const path = '/api/farm/trees/' + tree.id + '/water';
  const body = { visitorToken: other, submissionId: crypto.randomUUID() };
  const retries = await Promise.all(Array.from({ length: 10 }, () => f.call(path, { method: 'POST', body })));
  assert.ok(retries.every(response => response.status === 200));
  assert.equal((await f.snapshot()).trees.find(row => row.id === tree.id).water, 1);
  assert.equal((await retries[0].json()).tree.canRemove, false);
  const waterings = await Promise.all(Array.from({ length: 12 }, () => f.call(path, { method: 'POST', body: { visitorToken: credential(), submissionId: crypto.randomUUID() } })));
  assert.ok(waterings.every(response => response.status === 200));
  assert.equal((await f.snapshot()).trees.find(row => row.id === tree.id).water, 3);
  assert.equal((await f.call('/api/farm/trees/initial-apple/water', { method: 'POST', body: { ...body, submissionId: crypto.randomUUID() } })).status, 200);
  assert.equal((await f.call(path, { method: 'POST', body: { ...body, visitorToken: owner } })).status, 409);
});

test('failed water persistence rolls its mutation back and does not claim success', async () => {
  const f = fixture(), owner = credential(), tree = (await (await f.plant(owner)).json()).tree;
  f.env.DB.failOperation = true;
  const response = await f.call('/api/farm/trees/' + tree.id + '/water', { method: 'POST', body: { visitorToken: owner, submissionId: crypto.randomUUID() } });
  assert.equal(response.status, 503);
  assert.equal(f.env.DB.rows('farm_trees').find(row => row.id === tree.id).water, 0);
});

test('guest removal requires ownership, initial trees stay protected and host can remove any tree', async () => {
  const f = fixture(), owner = credential(), other = credential(), tree = (await (await f.plant(owner)).json()).tree;
  const denied = await f.call('/api/farm/trees/' + tree.id, { method: 'DELETE', body: { visitorToken: other } });
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'ownership_required');
  assert.equal((await f.call('/api/farm/trees/initial-apple', { method: 'DELETE', body: { visitorToken: owner } })).status, 403);
  assert.equal((await f.call('/api/farm/trees/' + tree.id, { method: 'DELETE', body: { visitorToken: owner } })).status, 200);
  assert.equal((await f.call('/api/farm/trees/' + tree.id, { method: 'DELETE', body: { visitorToken: owner } })).status, 404);
  const token = await f.login();
  assert.ok((await f.snapshot({ token })).trees.every(tree => tree.canRemove));
  const result = await f.call('/api/farm/trees/initial-apple', { method: 'DELETE', token });
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), { ok: true, deleted: true });
  assert.equal((await f.snapshot()).trees.length, 3);
  const next = await f.plant(other);
  assert.equal((await next.json()).tree.slot, 2, 'a freed shared slot is reused');
});

test('an invalid host token never falls through to guest deletion rights', async () => {
  const f = fixture(), owner = credential(), tree = (await (await f.plant(owner)).json()).tree;
  const result = await f.call('/api/farm/trees/' + tree.id, { method: 'DELETE', token: '0'.repeat(64), body: { visitorToken: owner } });
  assert.equal(result.status, 401);
  assert.equal((await f.snapshot()).trees.length, 5);
});

test('only approved animal additions appear publicly, without pending or visitor information', async () => {
  const f = fixture(), visitorToken = credential();
  const response = await f.adopt(visitorToken, { name: 'Luna 🌙', adoptedBy: '', note: 'A private pending note.' });
  assert.equal(response.status, 200);
  const submitted = await response.json();
  assert.equal(submitted.status, 'pending');
  assert.deepEqual((await f.snapshot()).residents, []);
  assert.equal(JSON.stringify(await f.snapshot()).includes('private pending note'), false);
  const host = await f.login();
  const pending = await (await f.call('/api/host/farm/adoptions?status=pending', { token: host })).json();
  assert.equal(pending.length, 1);
  assert.deepEqual(Object.keys(pending[0]).sort(), ['adoptedBy', 'created_at', 'id', 'name', 'note', 'species', 'status']);
  assert.equal(pending[0].adoptedBy, 'a visitor');
  const review = await f.call('/api/host/farm/adoptions/' + submitted.id, { method: 'PATCH', token: host, body: { status: 'approved' } });
  assert.equal(review.status, 200); assert.equal((await review.json()).status, 'approved');
  const approved = (await f.snapshot()).residents;
  assert.deepEqual(approved, [{ id: submitted.id, species: 'rabbit', name: 'Luna 🌙', adoptedBy: 'a visitor', note: 'A private pending note.', since: new Date().toISOString().slice(0, 7) }]);
  const stored = JSON.stringify(f.env.DB.rows('farm_adoptions'));
  assert.equal(stored.includes(visitorToken), false);
  assert.equal(JSON.stringify(approved).includes(f.env.DB.rows('farm_adoptions')[0].visitor_hash), false);
  assert.deepEqual(await (await f.call('/api/host/farm/adoptions?status=pending', { token: host })).json(), []);
});

test('unauthenticated and expired sessions cannot inspect or review pending adoption requests', async () => {
  const f = fixture(), adopted = await (await f.adopt(credential())).json();
  for (const token of [undefined, 'not-a-token', '0'.repeat(64)]) {
    assert.equal((await f.call('/api/host/farm/adoptions?status=pending', { token })).status, 401);
    assert.equal((await f.call('/api/host/farm/adoptions/' + adopted.id, { method: 'PATCH', token, body: { status: 'approved' } })).status, 401);
  }
  const token = await f.login();
  f.env.DB.sqlite.exec('UPDATE host_sessions SET access_expires = 0');
  assert.equal((await f.call('/api/host/farm/adoptions?status=pending', { token })).status, 401);
  assert.deepEqual((await f.snapshot()).residents, []);
});

test('rejection stays private and reviewed adoption status cannot be overwritten', async () => {
  const f = fixture(), adoption = await (await f.adopt(credential())).json(), token = await f.login();
  const path = '/api/host/farm/adoptions/' + adoption.id;
  const first = await f.call(path, { method: 'PATCH', token, body: { status: 'rejected' } });
  assert.equal(first.status, 200);
  assert.equal((await f.call(path, { method: 'PATCH', token, body: { status: 'rejected' } })).status, 200, 'same review is idempotent');
  const conflict = await f.call(path, { method: 'PATCH', token, body: { status: 'approved' } });
  assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'adoption_reviewed');
  assert.deepEqual((await f.snapshot()).residents, []);
});

test('simultaneous conflicting reviews have one winner and one honest conflict', async () => {
  const f = fixture(), adoption = await (await f.adopt(credential())).json(), token = await f.login();
  const responses = await Promise.all(['approved', 'rejected'].map(status => f.call('/api/host/farm/adoptions/' + adoption.id, { method: 'PATCH', token, body: { status } })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(f.env.DB.rows('farm_adoptions')[0].status, 'approved');
});

test('concurrent approvals stop at fourteen additions alongside the ten default residents', async () => {
  const f = fixture(), token = await f.login();
  const responses = await Promise.all(Array.from({ length: 30 }, (_, i) => f.adopt(credential(), { name: 'Friend ' + i }, { ip: '192.0.2.' + (i + 1) })));
  assert.ok(responses.every(response => response.status === 200));
  const rows = await Promise.all(responses.map(response => response.json()));
  const reviews = await Promise.all(rows.map(row => f.call('/api/host/farm/adoptions/' + row.id, { method: 'PATCH', token, body: { status: 'approved' } })));
  assert.equal(reviews.filter(response => response.status === 200).length, 14);
  assert.equal(reviews.filter(response => response.status === 409).length, 16);
  for (const response of reviews.filter(response => response.status === 409)) assert.equal((await response.json()).code, 'farm_full');
  assert.equal((await f.snapshot()).residents.length, 14);
  assert.equal(f.env.DB.rows('farm_adoptions').filter(row => row.status === 'pending').length, 16);
});

test('simultaneous duplicate adoption requests create one pending record', async () => {
  const f = fixture(), body = adoptionBody(credential());
  const responses = await Promise.all(Array.from({ length: 5 }, () => f.call('/api/farm/adoptions', { method: 'POST', body })));
  assert.ok(responses.every(response => response.status === 200));
  const results = await Promise.all(responses.map(response => response.json()));
  assert.equal(new Set(results.map(result => result.id)).size, 1);
  assert.equal(f.env.DB.rows('farm_adoptions').length, 1);
  assert.equal((await f.call('/api/farm/adoptions', { method: 'POST', body: { ...body, note: 'another note' } })).status, 409);
  assert.equal((await f.call('/api/farm/adoptions', { method: 'POST', body: { ...body, name: ' ' + body.name + ' ' } })).status, 200, 'normalization is consistent');
});

test('a visitor can have at most three pending requests even when submitted concurrently', async () => {
  const f = fixture(), visitorToken = credential();
  const responses = await Promise.all(Array.from({ length: 5 }, (_, i) => f.adopt(visitorToken, { name: 'Friend ' + i })));
  assert.equal(responses.filter(response => response.status === 200).length, 3);
  assert.equal(responses.filter(response => response.status === 409).length, 2);
  assert.equal(f.env.DB.rows('farm_adoptions').length, 3);
});

test('the total pending queue has an atomic two-hundred-request limit', async () => {
  const f = fixture();
  const statement = f.env.DB.sqlite.prepare("INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at) VALUES (?, ?, ?, ?, 'rabbit', 'Friend', 'a visitor', '', 'pending', ?)");
  for (let i = 0; i < 198; i++) statement.run(crypto.randomUUID(), crypto.randomUUID(), '0'.repeat(64), i.toString(16).padStart(64, '0'), new Date().toISOString());
  const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => f.adopt(credential(), {}, { ip: '192.0.2.' + (i + 1) })));
  assert.equal(responses.filter(response => response.status === 200).length, 2);
  assert.equal(responses.filter(response => response.status === 409).length, 8);
  assert.equal(f.env.DB.rows('farm_adoptions').length, 200);
});

test('strict fields reject injected ownership, initial slots, invalid credentials and control characters', async () => {
  const f = fixture(), visitorToken = credential();
  for (const overrides of [{ type: 'dragon' }, { type: '__proto__' }, { slot: 0 }, { water: 3 }, { initial: 1 }, { owner_hash: '0'.repeat(64) }, { visitorToken: 'x'.repeat(64) }, { visitorToken: 'A'.repeat(64) }, { submissionId: '0'.repeat(32) }, { submissionId: 'bad' }]) {
    const response = await f.plant(visitorToken, overrides);
    assert.equal(response.status, 400, JSON.stringify(overrides));
  }
  for (const overrides of [{ species: 'snowcat' }, { species: 'dragon' }, { name: '' }, { name: 'x'.repeat(25) }, { adoptedBy: 'x'.repeat(41) }, { note: 'x'.repeat(141) }, { name: 'bad\nname' }, { name: 'spoof\u202etest' }, { note: 42 }, { status: 'approved' }, { visitor_hash: '0'.repeat(64) }, { website: 'spam' }, { submissionId: 'bad' }, { visitorToken: null }]) {
    const response = await f.adopt(visitorToken, overrides);
    assert.equal(response.status, 400, JSON.stringify(overrides));
  }
  assert.equal(f.env.DB.rows('farm_trees').length, 4);
  assert.equal(f.env.DB.rows('farm_adoptions').length, 0);
  assert.equal((await f.call('/api/farm', { headers: { 'X-Farm-Token': 'not-valid' } })).status, 400);
});

test('normal Unicode names and one-character names work within character bounds', async () => {
  const f = fixture(), visitorToken = credential();
  assert.equal((await f.adopt(visitorToken, { name: '月', note: 'Likes 🌙 and flowers.' })).status, 200);
  assert.equal((await f.adopt(visitorToken, { name: '🌙'.repeat(24) })).status, 200, 'length is counted by characters, matching SQLite');
  assert.equal((await f.adopt(visitorToken, { name: '🌙'.repeat(25) })).status, 400);
});

test('public write rate limits store no raw credentials or IP addresses and cached retries bypass them', async () => {
  const f = fixture(), visitorToken = credential(), body = treeBody(visitorToken);
  assert.equal((await f.call('/api/farm/trees', { method: 'POST', body })).status, 200);
  for (let i = 0; i < 11; i++) {
    const response = await f.plant(visitorToken);
    assert.ok([200, 409].includes(response.status));
  }
  const limited = await f.plant(visitorToken);
  assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal((await f.call('/api/farm/trees', { method: 'POST', body })).status, 200);
  const stored = JSON.stringify(f.env.DB.rows('rate_limits'));
  assert.equal(stored.includes('192.0.2.1'), false); assert.equal(stored.includes(visitorToken), false);
});

test('farm CORS enables only its extra header and DELETE, preserving inbox preflight behavior', async () => {
  const f = fixture();
  for (const origin of [null, 'https://evil.example']) assert.equal((await f.call('/api/farm', { origin })).status, 403);
  const allowed = await f.call('/api/farm/trees/initial-apple', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'DELETE', 'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Farm-Token' } });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization, X-Farm-Token');
  assert.ok(allowed.headers.get('Access-Control-Allow-Methods').includes('DELETE'));
  assert.equal((await f.call('/api/messages', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'DELETE' } })).status, 403);
  assert.equal((await f.call('/api/messages', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'X-Farm-Token' } })).status, 403);
  assert.equal((await f.call('/api/farm', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'X-Untrusted' } })).status, 403);
});

test('farm request size and unsupported content type use the existing bounded reader', async () => {
  const f = fixture();
  const request = new Request('https://messages.example.workers.dev/api/farm/adoptions', { method: 'POST', headers: { Origin: f.env.ALLOWED_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(adoptionBody(credential(), { note: 'x'.repeat(9000) })) });
  assert.equal((await worker.fetch(request, f.env, {})).status, 413);
  const notJSON = new Request('https://messages.example.workers.dev/api/farm/trees', { method: 'POST', headers: { Origin: f.env.ALLOWED_ORIGIN, 'Content-Type': 'text/plain' }, body: 'hello' });
  assert.equal((await worker.fetch(notJSON, f.env, {})).status, 415);
  assert.equal(f.env.DB.rows('farm_adoptions').length, 0);
});

test('farm writes never create private letters, sessions or Telegram notifications', async () => {
  const f = fixture(), visitorToken = credential();
  await f.plant(visitorToken); await f.adopt(visitorToken);
  assert.equal(f.env.DB.rows('messages').length, 0);
  assert.equal(f.env.DB.rows('host_sessions').length, 0);
  assert.equal(f.env.DB.rows('notification_outbox').length, 0);
});

function insertResident(f, overrides = {}) {
  const row = { id: crypto.randomUUID(), species: 'rabbit', name: 'Comet', adoptedBy: 'A friend', note: 'Likes the orchard.', status: 'approved', created_at: '2026-04-10T12:30:00.000Z', ...overrides };
  f.env.DB.sqlite.prepare('INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(row.id, crypto.randomUUID(), '0'.repeat(64), '1'.repeat(64), row.species, row.name, row.adoptedBy, row.note, row.status, row.created_at);
  return row;
}

test('resident management migration preserves old approvals, pending rows, credentials and public months', () => {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_message_inbox.sql', '0002_shared_farm.sql', '0003_owner_content.sql', '0004_farm_species.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  const insert = sqlite.prepare('INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const [index, status] of ['approved', 'pending', 'rejected'].entries()) insert.run(crypto.randomUUID(), crypto.randomUUID(), '0'.repeat(64), '1'.repeat(64), 'redpanda', 'Existing ' + index, 'A visitor', 'Keep every detail.', status, '2024-02-10T00:00:00.000Z', status === 'pending' ? null : '2024-03-01T00:00:00.000Z');
  const before = sqlite.prepare('SELECT * FROM farm_adoptions ORDER BY id').all();
  sqlite.exec(readFileSync(new URL('../migrations/0006_resident_management.sql', import.meta.url), 'utf8'));
  const after = sqlite.prepare('SELECT * FROM farm_adoptions ORDER BY id').all();
  assert.deepEqual(after.map(({ active, version, since, ...row }) => row), before.map(row => ({ ...row })));
  assert.ok(after.every(row => row.active === 1 && row.version === 0 && row.since === '2024-02'));
  const first = after[0].id;
  for (const since of ['2024-00', '2024-13', '2024-1', '24-01', 'abcd-01', '2024-01-extra']) assert.throws(() => sqlite.prepare('UPDATE farm_adoptions SET since = ? WHERE id = ?').run(since, first), /CHECK/);
  assert.throws(() => sqlite.prepare('UPDATE farm_adoptions SET active = 2 WHERE id = ?').run(first), /CHECK/);
  assert.throws(() => sqlite.prepare('UPDATE farm_adoptions SET version = -1 WHERE id = ?').run(first), /CHECK/);
  assert.doesNotThrow(() => sqlite.prepare('UPDATE farm_adoptions SET since = NULL WHERE id = ?').run(first));
  sqlite.close();
});

test('owner resident list includes every approved animal and exposes only its management fields', async () => {
  const f = fixture(), token = await f.login();
  const outside = insertResident(f), resting = insertResident(f, { name: 'Sleeping friend' });
  insertResident(f, { status: 'pending' }); insertResident(f, { status: 'rejected' });
  f.env.DB.sqlite.prepare('UPDATE farm_adoptions SET active = 0 WHERE id = ?').run(resting.id);
  const response = await f.call('/api/host/farm/residents', { token });
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.id).sort(), [outside.id, resting.id].sort());
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ['active', 'adoptedBy', 'created_at', 'id', 'name', 'note', 'since', 'species', 'version']);
    assert.equal(typeof row.active, 'boolean'); assert.equal(row.version, 0); assert.equal(row.since, '2026-04');
  }
  assert.equal(rows.find(row => row.id === resting.id).active, false);
  const publicRows = (await f.snapshot()).residents;
  assert.deepEqual(publicRows.map(row => row.id), [outside.id]);
  assert.deepEqual(Object.keys(publicRows[0]).sort(), ['adoptedBy', 'id', 'name', 'note', 'since', 'species']);
});

test('resident details update atomically, accept all new species, and keep original submission credentials', async () => {
  const f = fixture(), token = await f.login(), resident = insertResident(f);
  const original = f.env.DB.rows('farm_adoptions')[0];
  const path = '/api/host/farm/residents/' + resident.id.toUpperCase();
  let version = 0;
  for (const species of ['redpanda', 'raccoon', 'wolf', 'crocodile', 'fennec']) {
    const changes = { version, species, name: ' 月亮 🌙 ', adoptedBy: '   ', note: ' Likes flowers. ', since: '2024-09', active: true };
    const response = await f.call(path, { method: 'PATCH', token, body: changes });
    assert.equal(response.status, 200, species);
    const row = await response.json();
    assert.equal(row.species, species); assert.equal(row.name, '月亮 🌙'); assert.equal(row.adoptedBy, 'a visitor'); assert.equal(row.note, 'Likes flowers.');
    assert.equal(row.since, '2024-09'); assert.equal(row.active, true); assert.equal(row.version, ++version); assert.equal(row.created_at, resident.created_at);
    assert.equal((await f.snapshot()).residents[0].since, '2024-09');
  }
  const stored = f.env.DB.rows('farm_adoptions')[0];
  for (const field of ['id', 'submission_id', 'payload_hash', 'visitor_hash', 'created_at', 'status', 'reviewed_at']) assert.equal(stored[field], original[field], field);
});

test('resting and waking are partial updates that preserve adoption approval and details', async () => {
  const f = fixture(), token = await f.login(), resident = insertResident(f);
  const path = '/api/host/farm/residents/' + resident.id;
  const asleep = await f.call(path, { method: 'PATCH', token, body: { version: 0, active: false } });
  assert.equal(asleep.status, 200);
  const resting = await asleep.json();
  assert.equal(resting.active, false); assert.equal(resting.version, 1);
  assert.equal(resting.name, resident.name); assert.equal(resting.adoptedBy, resident.adoptedBy); assert.equal(resting.note, resident.note); assert.equal(resting.since, '2026-04');
  assert.deepEqual((await f.snapshot()).residents, []);
  assert.equal(f.env.DB.rows('farm_adoptions')[0].status, 'approved');
  const editWhileResting = await f.call(path, { method: 'PATCH', token, body: { version: 1, name: 'Night reader' } });
  assert.equal(editWhileResting.status, 200); assert.equal((await editWhileResting.json()).active, false);
  const awake = await f.call(path, { method: 'PATCH', token, body: { version: 2, active: true } });
  assert.equal(awake.status, 200); assert.equal((await awake.json()).version, 3);
  assert.equal((await f.snapshot()).residents[0].name, 'Night reader');
});

test('stale and simultaneous resident edits return conflicts without overwriting the winner', async () => {
  const f = fixture(), token = await f.login(), resident = insertResident(f);
  const path = '/api/host/farm/residents/' + resident.id;
  const responses = await Promise.all(['First', 'Second'].map(name => f.call(path, { method: 'PATCH', token, body: { version: 0, name } })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const winner = await responses.find(response => response.status === 200).json();
  assert.equal((await responses.find(response => response.status === 409).json()).code, 'resident_conflict');
  const before = f.env.DB.rows('farm_adoptions');
  const stale = await f.call(path, { method: 'PATCH', token, body: { version: 0, active: false, adoptedBy: 'Overwrite' } });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'resident_conflict');
  assert.deepEqual(f.env.DB.rows('farm_adoptions'), before);
  assert.equal((await f.snapshot()).residents[0].name, winner.name);
});

test('resident management requires authentication and exact origin, and refuses pending, rejected and missing IDs', async () => {
  const f = fixture(), token = await f.login(), resident = insertResident(f);
  const path = '/api/host/farm/residents/' + resident.id;
  for (const invalidToken of [undefined, 'bad', '0'.repeat(64)]) {
    assert.equal((await f.call('/api/host/farm/residents', { token: invalidToken })).status, 401);
    assert.equal((await f.call(path, { method: 'PATCH', token: invalidToken, body: { version: 0, active: false } })).status, 401);
  }
  for (const origin of [null, 'null', 'https://evil.example']) {
    const read = await f.call('/api/host/farm/residents', { token, origin });
    assert.equal(read.status, 403); assert.equal(read.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal((await f.call(path, { method: 'PATCH', token, origin, body: { version: 0, active: false } })).status, 403);
  }
  for (const id of [insertResident(f, { status: 'pending' }).id, insertResident(f, { status: 'rejected' }).id, crypto.randomUUID()]) {
    const response = await f.call('/api/host/farm/residents/' + id, { method: 'PATCH', token, body: { version: 0, name: 'Edited' } });
    assert.equal(response.status, 404); assert.equal((await response.json()).code, 'resident_not_found');
  }
  f.env.DB.sqlite.exec('UPDATE host_sessions SET access_expires = 0');
  assert.equal((await f.call('/api/host/farm/residents', { token })).status, 401);
  assert.equal((await f.call(path, { method: 'PATCH', token, body: { version: 0, active: false } })).status, 401);
  assert.equal(f.env.DB.rows('farm_adoptions').find(row => row.id === resident.id).active, 1);
});

test('resident PATCH validates fields, version, month, strict booleans and character lengths before writing', async () => {
  const f = fixture(), token = await f.login(), resident = insertResident(f);
  const path = '/api/host/farm/residents/' + resident.id, before = f.env.DB.rows('farm_adoptions');
  const bad = [{ version: 0 }, { name: 'No version' }, { version: -1, active: false }, { version: 0.5, active: false }, { version: '0', active: false },
    { version: 0, name: '' }, { version: 0, name: 'x'.repeat(25) }, { version: 0, name: null }, { version: 0, name: 'bad\nname' }, { version: 0, name: 'spoof\u202etest' },
    { version: 0, adoptedBy: 'x'.repeat(41) }, { version: 0, adoptedBy: null }, { version: 0, note: 'x'.repeat(141) }, { version: 0, note: 42 },
    { version: 0, species: 'snowcat' }, { version: 0, species: 'dragon' }, { version: 0, active: 0 }, { version: 0, active: 'false' }, { version: 0, active: null },
    ...['', '2024-00', '2024-13', '2024-1', '24-01', '2024-01-01', null, 2024].map(since => ({ version: 0, since })),
    { version: 0, visitor_hash: '2'.repeat(64) }, { version: 0, status: 'rejected' }, { version: 0, created_at: '2024-01' }];
  for (const body of bad) assert.equal((await f.call(path, { method: 'PATCH', token, body })).status, 400, JSON.stringify(body));
  assert.deepEqual(f.env.DB.rows('farm_adoptions'), before);
  const unicode = await f.call(path, { method: 'PATCH', token, body: { version: 0, name: '🌙'.repeat(24) } });
  assert.equal(unicode.status, 200); assert.equal((await unicode.json()).name, '🌙'.repeat(24));
});

test('resting residents still reserve farm capacity for both approvals and CMS additions', async () => {
  const f = fixture(), token = await f.login();
  const residents = Array.from({ length: 14 }, () => insertResident(f));
  for (const resident of residents) assert.equal((await f.call('/api/host/farm/residents/' + resident.id, { method: 'PATCH', token, body: { version: 0, active: false } })).status, 200);
  assert.deepEqual((await f.snapshot()).residents, []);
  assert.equal((await (await f.call('/api/host/farm/residents', { token })).json()).length, 14);
  const pending = insertResident(f, { status: 'pending' });
  const approval = await f.call('/api/host/farm/adoptions/' + pending.id, { method: 'PATCH', token, body: { status: 'approved' } });
  assert.equal(approval.status, 409); assert.equal((await approval.json()).code, 'farm_full');
  const content = { farm: { residents: Array.from({ length: 11 }, (_, i) => ({ species: 'rabbit', name: 'Baseline ' + i, active: false })) } };
  const publication = await f.call('/api/host/site-content', { method: 'PUT', token, body: { revision: 0, content } });
  assert.equal(publication.status, 409); assert.equal((await publication.json()).code, 'farm_capacity');
});
