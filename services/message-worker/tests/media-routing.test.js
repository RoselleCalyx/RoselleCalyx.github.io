import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';
import worker from '../src/worker.js';

class DB {
  constructor() {
    this.sql = new DatabaseSync(':memory:');
    for (const name of ['0001_message_inbox.sql', '0002_shared_farm.sql', '0003_owner_content.sql', '0005_owner_media.sql']) this.sql.exec(readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8'));
  }
  prepare(query) {
    const db = this.sql; let args = [];
    return {
      bind(...values) { args = values.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value); return this; },
      async first() { return db.prepare(query).get(...args) || null; },
      async all() { return { success: true, results: db.prepare(query).all(...args) }; },
      async run() { return { success: true, meta: db.prepare(query).run(...args) }; }
    };
  }
}
function png() {
  function chunk(kind, data) {
    const body = Buffer.concat([Buffer.from(kind), data]); let crc = 0xffffffff;
    for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
    const size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(data.length); sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, body, sum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(1); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',header), chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))), chunk('IEND',Buffer.alloc(0))]);
}
function fixture() {
  const env = { DB: new DB(), ALLOWED_ORIGIN: 'https://rosellecalyx.github.io', HOST_EMAIL: 'host@example.com', HOST_PASSWORD: 'test-only-long-password' };
  return {
    env,
    call(path, { method = 'GET', origin = env.ALLOWED_ORIGIN, token, bytes, json, headers = {} } = {}) {
      const h = { ...headers };
      if (origin !== null) h.Origin = origin;
      if (token) h.Authorization = 'Bearer ' + token;
      if (bytes) h['Content-Type'] = 'image/png';
      if (json) h['Content-Type'] = 'application/json';
      return worker.fetch(new Request('https://messages.example.workers.dev' + path, { method, headers: h, body: bytes || (json ? JSON.stringify(json) : undefined) }), env, {});
    },
    async login() { return (await (await this.call('/api/host/login', { method: 'POST', json: { email: env.HOST_EMAIL, password: env.HOST_PASSWORD } })).json()).access_token; }
  };
}
test('uploads require both the exact owner origin and a valid owner session', async () => {
  const f = fixture(), bytes = png();
  assert.equal((await f.call('/api/host/media', { method: 'POST', bytes })).status, 401);
  const token = await f.login();
  for (const origin of [null, 'https://evil.example']) assert.equal((await f.call('/api/host/media', { method: 'POST', bytes, token, origin })).status, 403);
  assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM owner_media').get().n, 0);
  f.env.DB.sql.exec('UPDATE host_sessions SET access_expires=0');
  assert.equal((await f.call('/api/host/media', { method: 'POST', bytes, token })).status, 401);
});
test('an uploaded raster embeds without Origin; its immutable URL serves the exact bytes and HEAD', async () => {
  const f = fixture(), token = await f.login(), bytes = png();
  const result = await f.call('/api/host/media', { method: 'POST', bytes, token }); assert.equal(result.status, 200);
  const image = await result.json(); assert.equal(image.ok, true); assert.equal(image.width, 1); assert.equal(image.height, 1);
  assert.equal(image.url, 'https://messages.example.workers.dev/api/media/' + image.id);
  const path = '/api/media/' + image.id;
  const get = await f.call(path, { origin: null }); assert.equal(get.status, 200);
  assert.equal(get.headers.get('Content-Type'), 'image/png'); assert.equal(get.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(get.headers.get('Cache-Control'), /immutable/);
  assert.deepEqual(Buffer.from(await get.arrayBuffer()), bytes);
  const head = await f.call(path, { method: 'HEAD', origin: null }); assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal(head.headers.get('Content-Length'), String(bytes.length));
  assert.equal((await f.call(path, { origin: 'https://another.example' })).status, 200);
  assert.equal((await f.call('/api/host/site-content', { origin: null, token })).status, 403);
  const again = await (await f.call('/api/host/media', { method: 'POST', bytes, token })).json(); assert.equal(again.url, image.url); assert.equal(again.deduplicated, true);
});
test('binary upload preflight includes the real auth headers; malformed bodies cannot create assets', async () => {
  const f = fixture();
  const preflight = await f.call('/api/host/media', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type, Authorization' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), f.env.ALLOWED_ORIGIN);
  const token = await f.login();
  assert.equal((await f.call('/api/host/media', { method: 'POST', bytes: Buffer.from('<svg><script>alert(1)</script></svg>'), token })).status, 400);
  assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM owner_media').get().n, 0);
});
