/* REST integration checks with isolated browser contexts. No external account
   or network request is used; real RLS must still be checked after SQL setup. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const db = { url: "https://example.supabase.co", anonKey: "sb_publishable_test" };
function reply(status, data) {
  return { ok: status >= 200 && status < 300, status, text: async () => data == null ? "" : JSON.stringify(data) };
}
function browser(file, site, fetcher, saved = new Map()) {
  const storage = { getItem: (key) => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) };
  const window = { SITE: site };
  const context = vm.createContext({ window, fetch: fetcher, URL, atob, AbortController, setTimeout, clearTimeout, sessionStorage: storage });
  vm.runInContext(fs.readFileSync(path.join(root, "js", file), "utf8"), context, { filename: file });
  return { window, saved };
}
const letter = { name: "", contact: "", text: "A quiet thought across the ocean." };
const owner = { id: "11111111-1111-1111-1111-111111111111", email: "owner@example.com" };
function token(overrides = {}) {
  return Object.assign({ access_token: "owner-access", refresh_token: "owner-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, user: owner }, overrides);
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("unconfigured anonymous delivery never reports success or writes browser storage", async () => {
  let calls = 0;
  const { window } = browser("message-delivery.js", {}, async () => { calls += 1; throw Error("should not fetch"); });
  assert.equal(window.MessageDelivery.enabled, false);
  assert.equal((await window.MessageDelivery.submit(letter)).code, "not_configured");
  assert.equal(calls, 0);
});

test("anonymous submit succeeds only after a real HTTP acceptance and never supplies privacy flags", async () => {
  const calls = [];
  const { window } = browser("message-delivery.js", { supabase: db }, async (url, opts) => { calls.push({ url, opts }); return reply(201); });
  const result = await window.MessageDelivery.submit(letter);
  assert.equal(result.ok, true);
  assert.equal(result.transport, "supabase");
  assert.equal(calls[0].url, db.url + "/rest/v1/bottles");
  assert.deepEqual(JSON.parse(calls[0].opts.body), { name: null, contact: null, text: letter.text });
  assert.equal(calls[0].opts.headers.Prefer, "return=minimal");
  assert.equal(calls[0].opts.headers.Authorization, undefined, "publishable key is not a bearer JWT");
  assert.equal(calls[0].opts.credentials, "omit");
  assert.ok(calls[0].opts.signal instanceof AbortSignal);
});

test("Supabase rejection stays failed and never falls back to form or email", async () => {
  const calls = [];
  const { window } = browser("message-delivery.js", { supabase: db, formEndpoint: "https://formspree.io/f/example", email: "host@example.com" }, async (url) => { calls.push(url); return reply(403, { message: "permission denied" }); });
  assert.equal((await window.MessageDelivery.submit(letter)).ok, false);
  assert.deepEqual(calls, [db.url + "/rest/v1/bottles"]);
  assert.equal(window.location, undefined);
});

test("HTTP form success and failure are distinguishable without requiring a sender email", async () => {
  let successful = true;
  const { window } = browser("message-delivery.js", { formEndpoint: "https://formspree.io/f/example" }, async (_, opts) => {
    assert.equal(JSON.parse(opts.body).contact, null);
    return reply(successful ? 200 : 422);
  });
  assert.equal((await window.MessageDelivery.submit(letter)).ok, true);
  successful = false;
  assert.equal((await window.MessageDelivery.submit(letter)).code, "delivery_failed");
});

test("network interruption and request abort cannot produce success", async () => {
  const failed = browser("message-delivery.js", { supabase: db }, async () => { throw Error("offline"); });
  assert.equal((await failed.window.MessageDelivery.submit(letter)).code, "network_error");
  const aborted = browser("message-delivery.js", { supabase: db }, async () => { const error = Error("aborted"); error.name = "AbortError"; throw error; });
  assert.equal((await aborted.window.MessageDelivery.submit(letter)).code, "timeout");
});

test("partial database settings and elevated keys disable delivery", async () => {
  const encoded = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  for (const config of [{ url: db.url }, { ...db, anonKey: "sb_secret_unsafe" }, { ...db, anonKey: "header." + encoded + ".signature" }]) {
    const { window } = browser("message-delivery.js", { supabase: config, formEndpoint: "https://formspree.io/f/example" }, async () => { throw Error("must not submit"); });
    assert.equal(window.MessageDelivery.enabled, false);
    assert.equal((await window.MessageDelivery.submit(letter)).ok, false);
  }
});

test("legacy anon key is used as bearer while service keys are rejected", async () => {
  const key = "header." + Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url") + ".signature";
  const { window } = browser("message-delivery.js", { supabase: { url: db.url, anonKey: key } }, async (_, opts) => { assert.equal(opts.headers.Authorization, "Bearer " + key); return reply(201); });
  assert.equal((await window.MessageDelivery.submit(letter)).ok, true);
});

test("unconfigured host inbox cannot attempt login or list private data", async () => {
  let calls = 0;
  const { window } = browser("inbox.js", {}, async () => { calls++; return reply(200); });
  assert.equal(window.HostInbox.configured, false);
  await assert.rejects(window.HostInbox.signIn("owner@example.com", "password"), (error) => error.code === "not_configured");
  await assert.rejects(window.HostInbox.list(), (error) => error.code === "auth_expired");
  assert.equal(calls, 0);
});

test("failed login does not save tokens or claim a host session", async () => {
  const { window, saved } = browser("inbox.js", { supabase: db }, async () => reply(400, { error: "invalid_grant" }));
  await assert.rejects(window.HostInbox.signIn("owner@example.com", "wrong"), (error) => error.code === "bad_credentials");
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(saved.size, 0);
});

test("a valid non-host login cannot load private bottles and its session is cleared", async () => {
  const calls = [];
  const { window, saved } = browser("inbox.js", { supabase: db }, async (url) => {
    calls.push(url);
    if (url.includes("grant_type=password")) return reply(200, token({ user: { id: "other-user", email: "other@example.com" } }));
    if (url.includes("message_hosts")) return reply(200, []);
    if (url.includes("/logout")) return reply(204);
    throw Error("must not read private bottles");
  });
  await assert.rejects(window.HostInbox.signIn("other@example.com", "password"), (error) => error.code === "forbidden");
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(saved.size, 0);
  assert.equal(calls.some((url) => url.includes("/rest/v1/bottles")), false);
});

test("host session reads unapproved messages and sends only read_at in PATCH", async () => {
  const message = { id: 9, created_at: "2026-10-09T10:00:00Z", name: null, contact: "a reply clue", text: "Private words", approved: false, read_at: null };
  const { window } = browser("inbox.js", { supabase: db }, async (url, opts) => {
    if (url.includes("grant_type=password")) return reply(200, token());
    assert.equal(opts.headers.Authorization, "Bearer owner-access");
    if (url.includes("message_hosts")) return reply(200, [{ user_id: owner.id }]);
    if (opts.method === "PATCH") {
      const update = JSON.parse(opts.body);
      assert.deepEqual(Object.keys(update), ["read_at"]);
      assert.equal(opts.headers.Prefer, "return=representation");
      return reply(200, [{ ...message, read_at: update.read_at }]);
    }
    assert.ok(url.includes("contact"));
    return reply(200, [message]);
  });
  await window.HostInbox.signIn(owner.email, "password");
  const letters = await window.HostInbox.list();
  assert.equal(letters[0].contact, "a reply clue");
  assert.equal(letters[0].approved, false);
  assert.ok((await window.HostInbox.markRead(9)).read_at);
});

test("restoring an expired tab session refreshes using the refresh token", async () => {
  const saved = new Map([["message-host-session-v1", JSON.stringify({ base: db.url, session: token({ expires_at: 1 }) })]]);
  let refreshes = 0;
  const { window } = browser("inbox.js", { supabase: db }, async (url, opts) => {
    if (url.includes("grant_type=refresh_token")) { refreshes++; assert.equal(JSON.parse(opts.body).refresh_token, "owner-refresh"); return reply(200, token({ access_token: "renewed-access", refresh_token: "renewed-refresh" })); }
    assert.equal(opts.headers.Authorization, "Bearer renewed-access");
    return reply(200, [{ user_id: owner.id }]);
  }, saved);
  assert.equal(await window.HostInbox.restore(), true);
  assert.equal(refreshes, 1);
});

test("membership removal and failed read PATCH never report success", async () => {
  let permitted = true;
  const { window } = browser("inbox.js", { supabase: db }, async (url, opts) => {
    if (url.includes("grant_type=password")) return reply(200, token());
    if (url.includes("message_hosts")) return reply(200, permitted ? [{ user_id: owner.id }] : []);
    if (opts.method === "PATCH") return reply(200, []);
    return reply(200, []);
  });
  await window.HostInbox.signIn(owner.email, "password");
  await assert.rejects(window.HostInbox.markRead(9), (error) => error.code === "forbidden");
  permitted = false;
  await assert.rejects(window.HostInbox.list(), (error) => error.code === "forbidden");
});

test("logging out clears tab storage even if the logout service is offline", async () => {
  const { window, saved } = browser("inbox.js", { supabase: db }, async (url) => {
    if (url.includes("grant_type=password")) return reply(200, token());
    if (url.includes("message_hosts")) return reply(200, [{ user_id: owner.id }]);
    throw Error("offline");
  });
  await window.HostInbox.signIn(owner.email, "password");
  assert.equal(saved.size, 1);
  assert.equal((await window.HostInbox.signOut()).remoteRevoked, false);
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(saved.size, 0);
});

for (const [label, oldResponse] of [
  ["empty membership", reply(200, [])],
  ["unauthorized response", reply(401)],
  ["successful membership", reply(200, [{ user_id: "old-user" }])]
]) {
  test("pending restore with " + label + " cannot revoke a newer host login", async () => {
    const oldEntered = deferred();
    const oldFinished = deferred();
    const calls = [];
    const old = token({ access_token: "old-access", refresh_token: "old-refresh", user: { id: "old-user", email: "old@example.com" } });
    const saved = new Map([["message-host-session-v1", JSON.stringify({ base: db.url, session: old })]]);
    const { window } = browser("inbox.js", { supabase: db }, async (url, opts) => {
      calls.push({ url, bearer: opts.headers.Authorization });
      if (url.includes("grant_type=password")) return reply(200, token({ access_token: "new-access", refresh_token: "new-refresh" }));
      if (url.includes("message_hosts") && opts.headers.Authorization === "Bearer old-access") {
        oldEntered.resolve();
        return oldFinished.promise;
      }
      if (url.includes("message_hosts") && opts.headers.Authorization === "Bearer new-access") return reply(200, [{ user_id: owner.id }]);
      if (url.includes("/logout")) return reply(204);
      throw Error("superseded requests must not retry with new credentials");
    }, saved);
    const restoring = window.HostInbox.restore();
    await oldEntered.promise;
    await window.HostInbox.signIn(owner.email, "password");
    assert.equal(window.HostInbox.signedIn, true);
    oldFinished.resolve(oldResponse);
    assert.equal(await restoring, false, "old restoration is ignored");
    assert.equal(window.HostInbox.signedIn, true);
    assert.equal(window.HostInbox.identity.id, owner.id);
    assert.equal(JSON.parse(saved.get("message-host-session-v1")).session.access_token, "new-access");
    assert.equal(calls.some((call) => call.url.includes("/logout")), false);
    assert.equal(calls.some((call) => call.url.includes("grant_type=refresh_token")), false);
  });

  test("pending sign-in with " + label + " cannot clear a newer host login", async () => {
    const oldEntered = deferred();
    const oldFinished = deferred();
    const calls = [];
    const { window, saved } = browser("inbox.js", { supabase: db }, async (url, opts) => {
      calls.push({ url, bearer: opts.headers.Authorization });
      if (url.includes("grant_type=password")) {
        const email = JSON.parse(opts.body).email;
        return reply(200, email === "old@example.com"
          ? token({ access_token: "old-access", refresh_token: "old-refresh", user: { id: "old-user", email } })
          : token({ access_token: "new-access", refresh_token: "new-refresh" }));
      }
      if (url.includes("message_hosts") && opts.headers.Authorization === "Bearer old-access") { oldEntered.resolve(); return oldFinished.promise; }
      if (url.includes("message_hosts") && opts.headers.Authorization === "Bearer new-access") return reply(200, [{ user_id: owner.id }]);
      if (url.includes("/logout")) return reply(204);
      throw Error("superseded sign-in must not retry with new credentials");
    });
    const oldSignIn = window.HostInbox.signIn("old@example.com", "password");
    // Attach a rejection handler before resolving the held old response.
    const rejected = assert.rejects(oldSignIn, (error) => error.code === "session_changed");
    await oldEntered.promise;
    await window.HostInbox.signIn(owner.email, "password");
    oldFinished.resolve(oldResponse);
    await rejected;
    assert.equal(window.HostInbox.signedIn, true);
    assert.equal(window.HostInbox.identity.id, owner.id);
    assert.equal(JSON.parse(saved.get("message-host-session-v1")).session.access_token, "new-access");
    assert.equal(calls.some((call) => call.url.includes("/logout")), false);
    assert.equal(calls.some((call) => call.url.includes("grant_type=refresh_token")), false);
  });
}

test("an old authenticated request's final 401 cannot clear the newer session", async () => {
  const retryEntered = deferred();
  const retryFinished = deferred();
  const calls = [];
  const { window, saved } = browser("inbox.js", { supabase: db }, async (url, opts) => {
    calls.push({ url, bearer: opts.headers.Authorization });
    if (url.includes("grant_type=password")) {
      return reply(200, JSON.parse(opts.body).email === "old@example.com"
        ? token({ access_token: "old-access", refresh_token: "old-refresh", user: { id: "old-user", email: "old@example.com" } })
        : token({ access_token: "new-access", refresh_token: "new-refresh" }));
    }
    if (url.includes("message_hosts")) return reply(200, [{ user_id: opts.headers.Authorization === "Bearer new-access" ? owner.id : "old-user" }]);
    if (url.includes("grant_type=refresh_token")) {
      assert.equal(JSON.parse(opts.body).refresh_token, "old-refresh");
      return reply(200, token({ access_token: "old-renewed", refresh_token: "old-renewed-refresh" }));
    }
    if (url.includes("/rest/v1/bottles")) {
      if (opts.headers.Authorization === "Bearer old-access") return reply(401);
      if (opts.headers.Authorization === "Bearer old-renewed") { retryEntered.resolve(); return retryFinished.promise; }
      throw Error("old operation must not use the new login's access token");
    }
    if (url.includes("/logout")) return reply(204);
    throw Error("unexpected request");
  });
  await window.HostInbox.signIn("old@example.com", "password");
  const oldList = window.HostInbox.list();
  const rejected = assert.rejects(oldList, (error) => error.code === "session_changed");
  await retryEntered.promise;
  await window.HostInbox.signIn(owner.email, "password");
  retryFinished.resolve(reply(401));
  await rejected;
  assert.equal(window.HostInbox.signedIn, true);
  assert.equal(JSON.parse(saved.get("message-host-session-v1")).session.access_token, "new-access");
  assert.equal(calls.some((call) => call.url.includes("/logout")), false);
});

const workerUrl = "https://bottles.example.workers.dev";
const workerOwner = { id: "host", email: "owner@example.com" };
function workerToken(overrides = {}) { return token({ user: workerOwner, ...overrides }); }

test("Cloudflare mode takes precedence and matches login, private list, mark-read, and logout contracts", async () => {
  const calls = [];
  const message = { id: 12, created_at: "2026-10-09T10:00:00.000Z", name: null, contact: null, text: "Quiet waves", read_at: null };
  const { window, saved } = browser("inbox.js", { messageApi: workerUrl, supabase: db }, async (url, opts) => {
    calls.push({ url, opts });
    assert.ok(url.startsWith(workerUrl + "/api/host/"));
    assert.equal(opts.headers.apikey, undefined);
    assert.equal(opts.credentials, "omit");
    if (url.endsWith("/login")) { assert.deepEqual(JSON.parse(opts.body), { email: workerOwner.email, password: "password" }); return reply(200, workerToken()); }
    assert.equal(opts.headers.Authorization, "Bearer owner-access");
    if (url.endsWith("/me")) return reply(200, workerOwner);
    if (url.endsWith("/messages?limit=20&offset=3")) return reply(200, [message]);
    if (url.endsWith("/messages/12")) {
      assert.equal(opts.method, "PATCH");
      assert.equal(opts.headers.Prefer, undefined);
      const update = JSON.parse(opts.body);
      assert.deepEqual(Object.keys(update), ["read_at"]);
      assert.ok(!Number.isNaN(Date.parse(update.read_at)));
      return reply(200, [{ ...message, ...update }]);
    }
    if (url.endsWith("/logout")) { assert.equal(opts.method, "POST"); return reply(204); }
    throw Error("unexpected Cloudflare contract path");
  });
  assert.equal(window.HostInbox.mode, "cloudflare");
  assert.equal(window.HostInbox.configured, true);
  await window.HostInbox.signIn(workerOwner.email, "password");
  assert.equal(window.HostInbox.identity.id, "host");
  const messages = await window.HostInbox.list({ limit: 20, offset: 3 });
  assert.equal(messages[0].text, "Quiet waves");
  assert.equal(messages[0].contact, null);
  assert.ok((await window.HostInbox.markRead(12)).read_at);
  assert.equal(JSON.parse(saved.get("message-host-session-v1")).backend, "cloudflare");
  assert.equal((await window.HostInbox.signOut()).remoteRevoked, true);
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(saved.size, 0);
  assert.equal(calls.filter((call) => call.url.endsWith("/logout")).length, 1);
});

test("Cloudflare restore rotates an expired refresh token and authenticates the renewed host", async () => {
  const saved = new Map([["message-host-session-v1", JSON.stringify({ base: workerUrl, backend: "cloudflare", session: workerToken({ expires_at: 1 }) })]]);
  const calls = [];
  const { window } = browser("inbox.js", { messageApi: workerUrl }, async (url, opts) => {
    calls.push(url);
    if (url.endsWith("/refresh")) {
      assert.deepEqual(JSON.parse(opts.body), { refresh_token: "owner-refresh" });
      assert.equal(opts.headers.Authorization, undefined);
      return reply(200, workerToken({ access_token: "rotated-access", refresh_token: "rotated-refresh" }));
    }
    assert.equal(url, workerUrl + "/api/host/me");
    assert.equal(opts.headers.Authorization, "Bearer rotated-access");
    return reply(200, workerOwner);
  }, saved);
  assert.equal(await window.HostInbox.restore(), true);
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(saved.get("message-host-session-v1")).session.refresh_token, "rotated-refresh");
});

test("Cloudflare failed login never stores a session", async () => {
  const { window, saved } = browser("inbox.js", { messageApi: workerUrl }, async (url) => {
    assert.equal(url, workerUrl + "/api/host/login");
    return reply(401, { error: "invalid_credentials" });
  });
  await assert.rejects(window.HostInbox.signIn(workerOwner.email, "wrong"), (error) => error.code === "bad_credentials");
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(saved.size, 0);
});

test("Cloudflare me must verify the server's host identity, not just return any logged-in account", async () => {
  const calls = [];
  const { window, saved } = browser("inbox.js", { messageApi: workerUrl }, async (url) => {
    calls.push(url);
    if (url.endsWith("/login")) return reply(200, workerToken());
    if (url.endsWith("/me")) return reply(200, { id: "guest", email: "guest@example.com" });
    if (url.endsWith("/logout")) return reply(204);
    throw Error("non-host must not load messages");
  });
  await assert.rejects(window.HostInbox.signIn(workerOwner.email, "password"), (error) => error.code === "forbidden");
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(saved.size, 0);
  assert.equal(calls.some((url) => url.includes("/messages")), false);
});

test("Cloudflare private read retries a 401 once with rotated credentials, then clears only the expired session", async () => {
  let reads = 0;
  const { window, saved } = browser("inbox.js", { messageApi: workerUrl }, async (url, opts) => {
    if (url.endsWith("/login")) return reply(200, workerToken());
    if (url.endsWith("/me")) return reply(200, workerOwner);
    if (url.endsWith("/refresh")) return reply(200, workerToken({ access_token: "rotated-access", refresh_token: "rotated-refresh" }));
    assert.equal(url, workerUrl + "/api/host/messages?limit=100&offset=0");
    assert.equal(opts.headers.Authorization, reads++ === 0 ? "Bearer owner-access" : "Bearer rotated-access");
    return reply(401);
  });
  await window.HostInbox.signIn(workerOwner.email, "password");
  await assert.rejects(window.HostInbox.list(), (error) => error.code === "auth_expired");
  assert.equal(reads, 2);
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(saved.size, 0);
});

test("Cloudflare failed read-mark update does not claim an empty PATCH succeeded", async () => {
  const { window } = browser("inbox.js", { messageApi: workerUrl }, async (url) => {
    if (url.endsWith("/login")) return reply(200, workerToken());
    if (url.endsWith("/me")) return reply(200, workerOwner);
    return reply(200, []);
  });
  await window.HostInbox.signIn(workerOwner.email, "password");
  await assert.rejects(window.HostInbox.markRead(12), (error) => error.code === "forbidden");
});

test("invalid configured message API never silently falls back to Supabase", async () => {
  for (const messageApi of ["http://bottles.example.com", workerUrl + "?token=test", workerUrl + "#test", "https://user:pass@bottles.example.com"]) {
    const { window } = browser("inbox.js", { messageApi, supabase: db }, async () => { throw Error("must not fetch"); });
    assert.equal(window.HostInbox.configured, false);
    assert.equal(window.HostInbox.setupKind, "cloudflare");
    await assert.rejects(window.HostInbox.signIn(workerOwner.email, "password"), (error) => error.code === "not_configured");
  }
  const local = browser("inbox.js", { messageApi: "http://localhost:8787" }, async () => reply(401));
  assert.equal(local.window.HostInbox.configured, true);
  assert.equal(local.window.HostInbox.mode, "cloudflare");
});

test("host sessions cannot restore across backend modes even on the same root URL", async () => {
  const saved = new Map([["message-host-session-v1", JSON.stringify({ base: workerUrl, backend: "supabase", session: token() })]]);
  let calls = 0;
  const { window } = browser("inbox.js", { messageApi: workerUrl }, async () => { calls++; return reply(200, workerOwner); }, saved);
  assert.equal(await window.HostInbox.restore(), false);
  assert.equal(window.HostInbox.signedIn, false);
  assert.equal(calls, 0);
});

for (const [label, oldResponse] of [
  ["non-host profile", reply(200, { id: "guest" })],
  ["401", reply(401)],
  ["host profile", reply(200, workerOwner)]
]) {
  test("Cloudflare pending restore with " + label + " cannot revoke a newer host login", async () => {
    const entered = deferred();
    const finished = deferred();
    const calls = [];
    const saved = new Map([["message-host-session-v1", JSON.stringify({ base: workerUrl, backend: "cloudflare", session: workerToken({ access_token: "old-access", refresh_token: "old-refresh" }) })]]);
    const { window } = browser("inbox.js", { messageApi: workerUrl }, async (url, opts) => {
      calls.push(url);
      if (url.endsWith("/login")) return reply(200, workerToken({ access_token: "new-access", refresh_token: "new-refresh" }));
      if (url.endsWith("/me") && opts.headers.Authorization === "Bearer old-access") { entered.resolve(); return finished.promise; }
      if (url.endsWith("/me") && opts.headers.Authorization === "Bearer new-access") return reply(200, workerOwner);
      throw Error("old response must not refresh or revoke the newer login");
    }, saved);
    const restoring = window.HostInbox.restore();
    await entered.promise;
    await window.HostInbox.signIn(workerOwner.email, "password");
    finished.resolve(oldResponse);
    assert.equal(await restoring, false);
    assert.equal(window.HostInbox.signedIn, true);
    assert.equal(JSON.parse(saved.get("message-host-session-v1")).session.access_token, "new-access");
    assert.equal(calls.some((url) => url.endsWith("/logout") || url.endsWith("/refresh")), false);
  });
}
