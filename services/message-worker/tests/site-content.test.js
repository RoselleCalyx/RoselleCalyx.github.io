import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import worker from "../src/worker.js";
import { validateSiteContent } from "../src/site-content.js";

class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    for (const file of ["0001_message_inbox.sql", "0002_shared_farm.sql", "0003_owner_content.sql", "0004_farm_species.sql"]) this.sqlite.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
    this.failContentWrite = false;
  }
  prepare(sql) {
    const db = this;
    let values = [];
    const execute = () => {
      if (db.failContentWrite && sql.startsWith("UPDATE site_content")) throw Error("simulated persistence failure");
      return db.sqlite.prepare(sql).all(...values).map((row) => ({ ...row }));
    };
    return {
      bind(...parameters) { values = parameters; return this; },
      execute,
      async all() { return { success: true, results: execute() }; },
      async first() { return execute()[0] || null; },
      async run() { const result = db.sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } }; }
    };
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try { const results = statements.map((statement) => ({ success: true, results: statement.execute() })); this.sqlite.exec("COMMIT"); return results; }
    catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}
function fixture() {
  const env = { DB: new D1(), ALLOWED_ORIGIN: "https://rosellecalyx.github.io", HOST_EMAIL: "host@example.com", HOST_PASSWORD: "a long random password only for testing" };
  return {
    env,
    call(path, { method = "GET", token, body, headers = {} } = {}) {
      return worker.fetch(new Request("https://messages.example.workers.dev" + path, { method,
        headers: { Origin: env.ALLOWED_ORIGIN, ...(token ? { Authorization: "Bearer " + token } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body) }), env, {});
    },
    async login() { const response = await this.call("/api/host/login", { method: "POST", body: { email: env.HOST_EMAIL, password: env.HOST_PASSWORD } }); assert.equal(response.status, 200); return (await response.json()).access_token; }
  };
}
const paper = () => ({ title: "Reliable learning", authors: ["Chen Jia"], venue: "MICCAI", year: 2026, type: "preprint", topics: ["Medical AI"], image: "assets/paper.png", selected: true, abstract: "A paper abstract.", links: { pdf: "https://example.com/paper.pdf", code: "", project: "", data: "" }, figures: [{ src: "assets/figure.png", caption: "The proposed method." }], bibtex: "@article{jia2026,title={Reliable learning}}" });
const publicContent = () => ({ site: { name: "Chen Jia", email: "hello@example.com", links: { scholar: "https://scholar.google.com/", github: "https://github.com/RoselleCalyx", linkedin: "", cv: "assets/cv.pdf" }, observer: { place: "Munich", lat: 48.14, lon: 11.58 }, pages: { papers: { title: "Papers", subtitle: "My work" } }, footer: "Under the same sky." }, home: { heroTitle: "Exploring\nthe unknown.", heroLede: "Still looking up.", avatar: "assets/avatar.jpg", bio: ["I study medical AI."], interests: ["Medical AI"], beyond: "Forests and stars.", education: [{ date: "2026", title: "PhD researcher", detail: "TUM" }], news: [{ date: "2026", text: "A new paper", href: "papers.html" }], explore: [{ title: "Papers", text: "Read my work", href: "papers.html", icon: "book" }], coda: "Still looking up.", heroFoot: "Same sky." }, papers: [paper()], gallery: [], bottles: [], farm: { keeper: { species: "snowcat", name: "Matcha", title: "Keeper", note: "Orchard guardian" }, residents: [] } });

test("CMS starts with an empty public overlay; every host CMS route requires a current session", async () => {
  const f = fixture();
  assert.deepEqual(await (await f.call("/api/site-content")).json(), { ok: true, revision: 0, updatedAt: null, content: {} });
  for (const token of [undefined, "not-a-token", "0".repeat(64)]) {
    assert.equal((await f.call("/api/host/site-content", { token })).status, 401);
    assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: publicContent() } })).status, 401);
  }
  const token = await f.login();
  f.env.DB.sqlite.exec("UPDATE host_sessions SET access_expires = 0");
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: publicContent() } })).status, 401);
});

test("owner saves persist complete publication figures and links and become public immediately", async () => {
  const f = fixture(), token = await f.login(), content = publicContent();
  const response = await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content } });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.revision, 1); assert.ok(Number.isFinite(new Date(saved.updatedAt).getTime())); assert.deepEqual(saved.content, content);
  assert.deepEqual(await (await f.call("/api/site-content")).json(), saved);
  assert.deepEqual(await (await f.call("/api/host/site-content", { token })).json(), saved);
  assert.deepEqual(JSON.parse(f.env.DB.sqlite.prepare("SELECT content_json FROM site_content").get().content_json), content);
  const deleted = structuredClone(content); deleted.papers = [];
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 1, content: deleted } })).status, 200);
  assert.deepEqual((await (await f.call("/api/site-content")).json()).content.papers, []);
  assert.equal((await f.call("/api/site-content")).headers.get("Cache-Control"), "no-store");
});

test("compare-and-swap saves reject stale and concurrent revisions without overwriting the winner", async () => {
  const f = fixture(), token = await f.login();
  const responses = await Promise.all(["First", "Second"].map((name) => f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: { site: { name } } } })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const winner = await responses.find((response) => response.status === 200).json();
  assert.equal((await responses.find((response) => response.status === 409).json()).code, "content_conflict");
  assert.deepEqual(await (await f.call("/api/site-content")).json(), winner);
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: {} } })).status, 409);
});

test("failed D1 content writes leave the published revision and content untouched", async () => {
  const f = fixture(), token = await f.login();
  f.env.DB.failContentWrite = true;
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: publicContent() } })).status, 503);
  assert.deepEqual(await (await f.call("/api/site-content")).json(), { ok: true, revision: 0, updatedAt: null, content: {} });
});

test("CMS farm edits preserve combined capacity with existing approved visitor residents", async () => {
  const f = fixture(), token = await f.login();
  const insert = f.env.DB.sqlite.prepare("INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at) VALUES (?, ?, ?, ?, 'rabbit', 'Guest', 'a visitor', '', 'approved', ?)");
  for (let index = 0; index < 2; index++) insert.run(crypto.randomUUID(), crypto.randomUUID(), "0".repeat(64), "1".repeat(64), new Date().toISOString());
  const farm = (count) => ({ farm: { residents: Array.from({ length: count }, (_, index) => ({ species: "rabbit", name: "Resident " + index })) } });
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: farm(22) } })).status, 200);
  const tooMany = await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 1, content: farm(23) } });
  assert.equal(tooMany.status, 409); assert.equal((await tooMany.json()).code, "farm_capacity");
  const latest = await (await f.call("/api/site-content")).json();
  assert.equal(latest.revision, 1); assert.equal(latest.content.farm.residents.length, 22);
});

test("CMS accepts and publishes the new farm species", async () => {
  const f = fixture(), token = await f.login();
  const species = ["redpanda", "raccoon", "wolf", "crocodile", "fennec"];
  const content = { farm: { residents: species.map((animal) => ({ species: animal, name: animal })) } };
  const response = await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content } });
  assert.equal(response.status, 200);
  assert.deepEqual((await (await f.call("/api/site-content")).json()).content, content);
  assert.throws(() => validateSiteContent({ farm: { residents: [{ species: "dragon", name: "Unknown" }] } }), /species/);
});

test("CMS content without a farm override reserves space for the ten default residents", async () => {
  const f = fixture(), token = await f.login();
  const insert = f.env.DB.sqlite.prepare("INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at) VALUES (?, ?, ?, ?, 'rabbit', 'Guest', 'a visitor', '', 'approved', ?)");
  const addGuest = () => insert.run(crypto.randomUUID(), crypto.randomUUID(), "0".repeat(64), "1".repeat(64), new Date().toISOString());
  for (let index = 0; index < 14; index++) addGuest();
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: { site: { name: "Farm keeper" } } } })).status, 200);
  addGuest();
  const blocked = await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 1, content: { site: { name: "New keeper" } } } });
  assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, "farm_capacity");
  assert.equal((await (await f.call("/api/site-content")).json()).content.site.name, "Farm keeper");
});

test("adoption approvals atomically share the capacity of an edited CMS farm", async () => {
  const f = fixture(), token = await f.login();
  const baseline = { farm: { residents: Array.from({ length: 23 }, (_, index) => ({ species: "rabbit", name: "Resident " + index })) } };
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: baseline } })).status, 200);
  const insert = f.env.DB.sqlite.prepare("INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at) VALUES (?, ?, ?, ?, 'rabbit', 'Guest', 'a visitor', '', 'pending', ?)");
  const ids = Array.from({ length: 8 }, () => crypto.randomUUID());
  for (const id of ids) insert.run(id, crypto.randomUUID(), "0".repeat(64), "1".repeat(64), new Date().toISOString());
  const reviews = await Promise.all(ids.map((id) => f.call("/api/host/farm/adoptions/" + id, { method: "PATCH", token, body: { status: "approved" } })));
  assert.equal(reviews.filter((response) => response.status === 200).length, 1);
  assert.equal(reviews.filter((response) => response.status === 409).length, 7);
  assert.equal(f.env.DB.sqlite.prepare("SELECT count(*) AS total FROM farm_adoptions WHERE status = 'approved'").get().total, 1);
  const fullBaseline = structuredClone(baseline); fullBaseline.farm.residents.push({ species: "fox", name: "One more" });
  const blocked = await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 1, content: fullBaseline } });
  assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, "farm_capacity");
  assert.equal((await (await f.call("/api/site-content")).json()).revision, 1);
});

test("only the host may retire an approved resident; removal stays durable and frees a place", async () => {
  const f = fixture(), token = await f.login();
  const baseline = { farm: { residents: Array.from({ length: 23 }, (_, index) => ({ species: "rabbit", name: "Resident " + index })) } };
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content: baseline } })).status, 200);
  const ids = Array.from({ length: 3 }, () => crypto.randomUUID());
  const insert = f.env.DB.sqlite.prepare("INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at) VALUES (?, ?, ?, ?, 'rabbit', 'Guest', 'a visitor', '', ?, ?)");
  for (let index = 0; index < ids.length; index++) insert.run(ids[index], crypto.randomUUID(), "0".repeat(64), "1".repeat(64), index === 2 ? "rejected" : "pending", new Date().toISOString());
  assert.equal((await f.call("/api/host/farm/adoptions/" + ids[0], { method: "PATCH", token, body: { status: "approved" } })).status, 200);
  const removal = "/api/host/farm/residents/" + ids[0];
  for (const invalidToken of [undefined, "bad", "0".repeat(64)]) assert.equal((await f.call(removal, { method: "DELETE", token: invalidToken })).status, 401);
  for (const id of [ids[1], ids[2], crypto.randomUUID()]) assert.equal((await f.call("/api/host/farm/residents/" + id, { method: "DELETE", token })).status, 404);
  assert.equal((await f.call("/api/host/farm/adoptions/" + ids[1], { method: "PATCH", token, body: { status: "approved" } })).status, 409);
  const removed = await f.call(removal, { method: "DELETE", token });
  assert.equal(removed.status, 200); assert.deepEqual(await removed.json(), { ok: true, deleted: true });
  const stored = f.env.DB.sqlite.prepare("SELECT status, reviewed_at FROM farm_adoptions WHERE id = ?").get(ids[0]);
  assert.equal(stored.status, "rejected"); assert.ok(Number.isFinite(new Date(stored.reviewed_at).getTime()));
  assert.deepEqual((await (await f.call("/api/farm")).json()).residents, []);
  assert.equal((await f.call(removal, { method: "DELETE", token })).status, 404);
  assert.equal((await f.call("/api/host/farm/adoptions/" + ids[0], { method: "PATCH", token, body: { status: "approved" } })).status, 409);
  assert.equal((await f.call("/api/host/farm/adoptions/" + ids[1], { method: "PATCH", token, body: { status: "approved" } })).status, 200);
  assert.deepEqual((await (await f.call("/api/farm")).json()).residents.map((row) => row.id), [ids[1]]);
  assert.equal((await (await f.call("/api/host/farm/adoptions?status=approved", { token })).json()).length, 1);
});

test("public allowlist rejects credentials, infrastructure, unsafe URLs and malformed publication data", async () => {
  const f = fixture(), token = await f.login();
  const invalid = [
    { site: { messageApi: "https://evil.example" } }, { site: { supabase: { anonKey: "secret" } } }, { site: { formEndpoint: "https://evil.example" } }, { site: { HOST_PASSWORD: "secret" } },
    { site: { links: { github: "javascript:alert(1)" } } }, { site: { links: { cv: "data:text/html,evil" } } }, { site: { links: { cv: "//evil.example/file" } } }, { site: { links: { github: "https://username:password@example.com/" } } },
    { home: { avatar: "java\nscript:alert(1)" } }, { home: { avatar: "\\\\evil.example\\file" } }, { site: { observer: { lat: 91 } } }, { site: { email: "bad\n@example.com" } },
    { papers: [{ ...paper(), authors: [] }] }, { papers: [{ ...paper(), year: 2026.5 }] }, { papers: [{ ...paper(), image: "data:image/png;base64,abc" }] }, { papers: [{ ...paper(), figures: [{ src: "javascript:evil", caption: "" }] }] },
    { papers: [{ ...paper(), links: { admin: "https://example.com" } }] }, { bottles: [{ from: "Owner", date: "2026-02-30", text: "Text", reply: "" }] }, { unknown: [] }, JSON.parse('{"site":{"__proto__":{"secret":"evil"}}}')
  ];
  for (const content of invalid) assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content } })).status, 400, JSON.stringify(content));
  for (const body of [{ revision: -1, content: {} }, { revision: 0.5, content: {} }, { revision: "0", content: {} }, { revision: 0, content: {} , access_token: token }]) assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body })).status, 400);
  assert.equal((await (await f.call("/api/site-content")).json()).revision, 0);
});

test("content structure bounds reject excessive arrays, duplicate IDs and deeply nested records", () => {
  assert.throws(() => validateSiteContent({ papers: Array.from({ length: 501 }, paper) }), /papers/);
  assert.throws(() => validateSiteContent({ papers: [{ ...paper(), id: "one" }, { ...paper(), id: "one" }] }), /id/);
  const deep = {}; let leaf = deep; for (let index = 0; index < 20; index++) { leaf.next = {}; leaf = leaf.next; }
  assert.throws(() => validateSiteContent(deep), /content/);
  assert.throws(() => validateSiteContent({ home: { interests: ["x".repeat(101)] } }), /interests/);
});

test("owner content accepts more than 8 KB while its streamed reader cancels beyond one MiB", async () => {
  const f = fixture(), token = await f.login(), content = { papers: [{ ...paper(), abstract: "x".repeat(16000) }] };
  assert.equal((await f.call("/api/host/site-content", { method: "PUT", token, body: { revision: 0, content } })).status, 200);
  let canceled = false, pulls = 0;
  const body = new ReadableStream({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(262144).fill(32)); }, cancel() { canceled = true; } });
  const response = await worker.fetch(new Request("https://messages.example.workers.dev/api/host/site-content", { method: "PUT", headers: { Origin: f.env.ALLOWED_ORIGIN, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body, duplex: "half" }), f.env, {});
  assert.equal(response.status, 413); assert.equal(canceled, true); assert.ok(pulls <= 6);
  assert.equal((await (await f.call("/api/site-content")).json()).revision, 1);
});

test("CORS permits owner PUT and rejects unsupported headers while public writes remain inaccessible", async () => {
  const f = fixture();
  const preflight = await f.call("/api/host/site-content", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "Content-Type, Authorization" } });
  assert.equal(preflight.status, 204); assert.ok(preflight.headers.get("Access-Control-Allow-Methods").includes("PUT"));
  assert.equal((await f.call("/api/host/site-content", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "X-Untrusted" } })).status, 403);
  assert.equal((await f.call("/api/site-content", { method: "PUT", body: { revision: 0, content: {} } })).status, 404);
});

test("request status and owner notes stay private and cannot alter submitted content", async () => {
  const f = fixture(), token = await f.login();
  const submitted = await (await f.call("/api/messages", { method: "POST", body: { text: "A private request.", contact: "private@example.com", submissionId: crypto.randomUUID() } })).json();
  const path = "/api/host/messages/" + submitted.id, readAt = new Date().toISOString();
  assert.equal((await f.call(path, { method: "PATCH", body: { status: "done", host_note: "A private owner note." } })).status, 401);
  const updated = await (await f.call(path, { method: "PATCH", token, body: { read_at: readAt, status: "done", host_note: "A private owner note." } })).json();
  assert.equal(updated[0].status, "done"); assert.equal(updated[0].host_note, "A private owner note."); assert.equal(updated[0].text, "A private request.");
  const reset = await (await f.call(path, { method: "PATCH", token, body: { read_at: null, status: "new" } })).json();
  assert.equal(reset[0].read_at, null); assert.equal(reset[0].host_note, "A private owner note.");
  for (const body of [{}, { status: "approved" }, { host_note: "x".repeat(2001) }, { host_note: null }, { text: "Changed" }]) assert.equal((await f.call(path, { method: "PATCH", token, body })).status, 400);
  const publicJSON = JSON.stringify(await (await f.call("/api/site-content")).json());
  for (const privateValue of ["private@example.com", "A private request.", "A private owner note."]) assert.equal(publicJSON.includes(privateValue), false);
  assert.equal((await f.call("/api/messages")).status, 404);
  assert.equal((await f.call("/api/messages/" + submitted.id)).status, 404);
});
