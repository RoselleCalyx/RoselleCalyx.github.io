import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import worker, { drainOutbox } from "../src/worker.js";

// Real SQLite executes the migration and SQL; this adapter supplies D1's API.
class D1Mock {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec(readFileSync(new URL("../migrations/0001_message_inbox.sql", import.meta.url), "utf8"));
    this.failMessageWrite = false;
    this.failOutboxWrite = false;
    this.queries = 0;
  }
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...params) { values = params; return this; },
      async all() {
        db.queries++;
        if (db.failMessageWrite && sql.startsWith("INSERT INTO messages")) throw Error("simulated write failure");
        if (db.failOutboxWrite && sql.startsWith("INSERT INTO notification_outbox")) throw Error("simulated outbox failure");
        const statement = db.sqlite.prepare(sql);
        const results = statement.all(...values).map((row) => ({ ...row }));
        return { success: true, results };
      },
      async first() { return (await this.all()).results[0] || null; },
      async run() {
        db.queries++;
        if (db.failMessageWrite && sql.startsWith("INSERT INTO messages")) throw Error("simulated write failure");
        if (db.failOutboxWrite && sql.startsWith("INSERT INTO notification_outbox")) throw Error("simulated outbox failure");
        const result = db.sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
      }
    };
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
  rows(table) { return this.sqlite.prepare("SELECT * FROM " + table).all().map((row) => ({ ...row })); }
}
function fixture(overrides = {}) {
  const env = { DB: new D1Mock(), ALLOWED_ORIGIN: "https://rosellecalyx.github.io", HOST_EMAIL: "chen.jia@tum.de", HOST_PASSWORD: "a long random host password for testing", INBOX_URL: "https://rosellecalyx.github.io/inbox.html", ...overrides };
  const tasks = [];
  const ctx = { waitUntil(task) { tasks.push(task); } };
  return {
    env,
    async call(path, { method = "GET", body, token, origin = env.ALLOWED_ORIGIN, headers = {}, ip = "192.0.2.1" } = {}) {
      const requestHeaders = { "CF-Connecting-IP": ip, ...headers };
      if (origin != null) requestHeaders.Origin = origin;
      if (token) requestHeaders.Authorization = "Bearer " + token;
      if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
      return worker.fetch(new Request("https://messages.example.workers.dev" + path, { method, headers: requestHeaders, body: body !== undefined ? JSON.stringify(body) : undefined }), env, ctx);
    },
    async flush() { await Promise.all(tasks.splice(0)); },
    async login() {
      const result = await this.call("/api/host/login", { method: "POST", body: { email: env.HOST_EMAIL, password: env.HOST_PASSWORD } });
      assert.equal(result.status, 200);
      return result.json();
    }
  };
}
const letter = (overrides = {}) => ({ name: "", contact: "", text: "A quiet private thought.", submissionId: crypto.randomUUID(), website: "", ...overrides });

test("only the exact configured origin is allowed; CORS preflights expose actual headers", async () => {
  const f = fixture();
  for (const origin of [null, "https://evil.example", "https://rosellecalyx.github.io.evil.example", "https://rosellecalyx.github.io/"]) {
    const result = await f.call("/api/messages", { method: "POST", origin, body: letter() });
    assert.equal(result.status, 403);
    assert.equal(result.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.equal(f.env.DB.queries, 0);
  const allowed = await f.call("/api/messages", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type, Authorization" } });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), f.env.ALLOWED_ORIGIN);
  assert.equal(allowed.headers.get("Access-Control-Allow-Headers"), "Content-Type, Authorization");
  assert.equal(allowed.headers.get("Access-Control-Allow-Credentials"), null);
  const denied = await f.call("/api/messages", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "DELETE" } });
  assert.equal(denied.status, 403);
});

test("anonymous letters persist with private contact and transactional notification outbox", async () => {
  const f = fixture();
  const response = await f.call("/api/messages", { method: "POST", body: letter({ contact: "private@example.com" }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(Object.keys(result).sort().join(","), "id,ok");
  assert.equal(f.env.DB.rows("messages")[0].contact, "private@example.com");
  assert.equal(f.env.DB.rows("messages")[0].name, null);
  assert.equal(f.env.DB.rows("notification_outbox")[0].message_id, result.id);
  await f.flush();
  assert.equal(f.env.DB.rows("notification_outbox")[0].sent_at, null, "no Telegram secrets leaves a durable pending record");
});

test("repeated submission IDs are idempotent only for the identical normalized payload", async () => {
  const f = fixture(), body = letter();
  const first = await (await f.call("/api/messages", { method: "POST", body })).json();
  const duplicate = await (await f.call("/api/messages", { method: "POST", body: { ...body, text: "  " + body.text + "  " } })).json();
  assert.equal(duplicate.id, first.id);
  assert.equal(f.env.DB.rows("messages").length, 1);
  assert.equal(f.env.DB.rows("notification_outbox").length, 1);
  const conflict = await f.call("/api/messages", { method: "POST", body: { ...body, text: "Different private text" } });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.text()).includes(body.text), false);
});

test("a D1 write failure returns failure and no letter or outbox remains", async () => {
  for (const failure of ["failMessageWrite", "failOutboxWrite"]) {
    const f = fixture(); f.env.DB[failure] = true;
    const result = await f.call("/api/messages", { method: "POST", body: letter() });
    assert.equal(result.status, 503);
    assert.equal((await result.json()).ok, false);
    assert.equal(f.env.DB.rows("messages").length, 0);
    assert.equal(f.env.DB.rows("notification_outbox").length, 0);
  }
});

test("chunked bodies without Content-Length are canceled before buffering more than 8 KB", async () => {
  const f = fixture();
  let canceled = false, pulls = 0;
  const body = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(4096).fill(32)); },
    cancel() { canceled = true; }
  });
  const request = new Request("https://messages.example.workers.dev/api/messages", {
    method: "POST", headers: { Origin: f.env.ALLOWED_ORIGIN, "Content-Type": "application/json" }, body, duplex: "half"
  });
  assert.equal(request.headers.has("Content-Length"), false);
  const result = await worker.fetch(request, f.env, {});
  assert.equal(result.status, 413);
  assert.equal(canceled, true);
  assert.ok(pulls <= 4, "the reader stops on the third chunk; one chunk may have been prefetched");
  assert.equal(f.env.DB.queries, 0);
});

test("validation rejects short/oversize fields, honeypots, privileged fields and malformed IDs", async () => {
  const f = fixture();
  for (const invalid of [letter({ text: "x" }), letter({ text: "x".repeat(501) }), letter({ name: "n".repeat(61) }), letter({ contact: "c".repeat(121) }), letter({ website: "spam" }), letter({ approved: true }), letter({ submissionId: "not-a-uuid" }), letter({ text: 42 })]) {
    assert.equal((await f.call("/api/messages", { method: "POST", body: invalid })).status, 400);
  }
  assert.equal(f.env.DB.rows("messages").length, 0);
  assert.equal(f.env.DB.rows("rate_limits").length, 0);
  assert.equal((await f.call("/api/messages", { method: "POST", body: letter({ text: "海🌊" }) })).status, 200);
});

test("anonymous rate limit is enforced by D1 and stores only keyed IP hashes", async () => {
  const f = fixture(), first = letter();
  assert.equal((await f.call("/api/messages", { method: "POST", body: first })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await f.call("/api/messages", { method: "POST", body: letter() })).status, 200);
  const limited = await f.call("/api/messages", { method: "POST", body: letter() });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
  assert.equal((await f.call("/api/messages", { method: "POST", body: first })).status, 200, "retrying an existing letter causes no additional insert");
  assert.equal(JSON.stringify(f.env.DB.rows("rate_limits")).includes("192.0.2.1"), false);
  assert.match(f.env.DB.rows("rate_limits")[0].key, /^message:[0-9a-f]{64}:\d+$/);
});

test("incorrect host passwords and excessive login attempts cannot create sessions", async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) assert.equal((await f.call("/api/host/login", { method: "POST", body: { email: f.env.HOST_EMAIL, password: "wrong" } })).status, 401);
  assert.equal((await f.call("/api/host/login", { method: "POST", body: { email: f.env.HOST_EMAIL, password: f.env.HOST_PASSWORD } })).status, 429);
  assert.equal(f.env.DB.rows("host_sessions").length, 0);
});

test("host authorization protects private letters, tokens are 256-bit and only hashes are stored", async () => {
  const f = fixture();
  await f.call("/api/messages", { method: "POST", body: letter({ contact: "a private reply clue" }) });
  for (const token of [undefined, "not-a-token", "0".repeat(64)]) {
    assert.equal((await f.call("/api/host/messages", { token })).status, 401);
  }
  const session = await f.login();
  assert.match(session.access_token, /^[0-9a-f]{64}$/);
  assert.match(session.refresh_token, /^[0-9a-f]{64}$/);
  assert.equal(session.expires_in, 3600);
  assert.equal(session.user.id, "host");
  const stored = JSON.stringify(f.env.DB.rows("host_sessions"));
  assert.equal(stored.includes(session.access_token), false);
  assert.equal(stored.includes(session.refresh_token), false);
  assert.equal(stored.includes(f.env.HOST_PASSWORD), false);
  assert.deepEqual(await (await f.call("/api/host/me", { token: session.access_token })).json(), session.user);
  const rows = await (await f.call("/api/host/messages", { token: session.access_token })).json();
  assert.equal(rows[0].contact, "a private reply clue");
  assert.equal(rows[0].submission_id, undefined);
  assert.equal(rows[0].payload_hash, undefined);
  const readAt = new Date().toISOString();
  const update = await f.call("/api/host/messages/" + rows[0].id, { method: "PATCH", token: session.access_token, body: { read_at: readAt } });
  assert.equal((await update.json())[0].read_at, readAt);
  assert.equal((await f.call("/api/host/messages/" + rows[0].id, { method: "PATCH", token: session.access_token, body: { read_at: readAt, text: "edited" } })).status, 400);
});

test("refresh rotation atomically accepts only one concurrent use; previous access token is invalidated", async () => {
  const f = fixture(), session = await f.login();
  const responses = await Promise.all([
    f.call("/api/host/refresh", { method: "POST", body: { refresh_token: session.refresh_token } }),
    f.call("/api/host/refresh", { method: "POST", body: { refresh_token: session.refresh_token } })
  ]);
  assert.deepEqual(responses.map((item) => item.status).sort(), [200, 401]);
  const renewed = await responses.find((item) => item.status === 200).json();
  assert.notEqual(renewed.refresh_token, session.refresh_token);
  assert.equal((await f.call("/api/host/me", { token: session.access_token })).status, 401);
  assert.equal((await f.call("/api/host/me", { token: renewed.access_token })).status, 200);
  assert.equal((await f.call("/api/host/refresh", { method: "POST", body: { refresh_token: session.refresh_token } })).status, 401);
});

test("logout revokes both token types and expired sessions cannot read or refresh", async () => {
  const f = fixture(), session = await f.login();
  assert.equal((await f.call("/api/host/logout", { method: "POST", token: session.access_token })).status, 200);
  assert.equal((await f.call("/api/host/me", { token: session.access_token })).status, 401);
  assert.equal((await f.call("/api/host/refresh", { method: "POST", body: { refresh_token: session.refresh_token } })).status, 401);
  const expired = await f.login();
  f.env.DB.sqlite.exec("UPDATE host_sessions SET access_expires = 1, refresh_expires = 1");
  assert.equal((await f.call("/api/host/messages", { token: expired.access_token })).status, 401);
  assert.equal((await f.call("/api/host/refresh", { method: "POST", body: { refresh_token: expired.refresh_token } })).status, 401);
});

test("Telegram failure cannot lose saved letters; cron retries with only count/link and no private content", async () => {
  const f = fixture({ TELEGRAM_BOT_TOKEN: "fake-token-never-sent", TELEGRAM_CHAT_ID: "12345" });
  const originalFetch = globalThis.fetch;
  let succeed = false, calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, "12345");
    assert.ok(body.text.includes(f.env.INBOX_URL));
    assert.equal(body.text.includes("Secret letter"), false);
    assert.equal(body.text.includes("private@example.com"), false);
    assert.equal(body.text.includes("Private author"), false);
    return new Response(JSON.stringify(succeed ? { ok: true } : { ok: false, error_code: 429, parameters: { retry_after: 60 } }), { status: succeed ? 200 : 429 });
  };
  try {
    const saved = await f.call("/api/messages", { method: "POST", body: letter({ name: "Private author", contact: "private@example.com", text: "Secret letter" }) });
    assert.equal(saved.status, 200);
    await f.flush();
    assert.equal(f.env.DB.rows("messages").length, 1);
    const queued = f.env.DB.rows("notification_outbox")[0];
    assert.equal(queued.attempts, 1);
    assert.equal(queued.last_error, "telegram_429");
    assert.equal(queued.sent_at, null);
    assert.ok(queued.next_attempt_at > Date.now() / 1000);
    f.env.DB.sqlite.exec("UPDATE notification_outbox SET next_attempt_at = 0");
    succeed = true;
    const tasks = [], ctx = { waitUntil(task) { tasks.push(task); } };
    await worker.scheduled({}, f.env, ctx);
    await Promise.all(tasks);
    assert.ok(f.env.DB.rows("notification_outbox")[0].sent_at);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("outbox leasing prevents concurrent duplicate Telegram sends", async () => {
  const f = fixture();
  await f.call("/api/messages", { method: "POST", body: letter() }); await f.flush();
  f.env.TELEGRAM_BOT_TOKEN = "fake-token"; f.env.TELEGRAM_CHAT_ID = "123";
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ ok: true })); };
  try {
    await Promise.all([drainOutbox(f.env), drainOutbox(f.env)]);
    assert.equal(calls, 1);
    assert.ok(f.env.DB.rows("notification_outbox")[0].sent_at);
  } finally { globalThis.fetch = originalFetch; }
});

test("Turnstile, when configured, is required and checks both action and hostname", async () => {
  const f = fixture({ TURNSTILE_SECRET_KEY: "test-secret" });
  assert.equal((await f.call("/api/messages", { method: "POST", body: letter() })).status, 400);
  const originalFetch = globalThis.fetch;
  let action = "wrong", hostname = "rosellecalyx.github.io";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(JSON.parse(options.body).secret, "test-secret");
    return new Response(JSON.stringify({ success: true, hostname, action }));
  };
  try {
    assert.equal((await f.call("/api/messages", { method: "POST", body: letter({ turnstileToken: "fake-token" }) })).status, 400);
    action = "message"; hostname = "evil.example";
    assert.equal((await f.call("/api/messages", { method: "POST", body: letter({ turnstileToken: "fake-token" }) })).status, 400);
    hostname = "rosellecalyx.github.io";
    assert.equal((await f.call("/api/messages", { method: "POST", body: letter({ turnstileToken: "fake-token" }) })).status, 200);
  } finally { globalThis.fetch = originalFetch; }
});
