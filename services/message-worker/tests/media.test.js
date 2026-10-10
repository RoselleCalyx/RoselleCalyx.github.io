import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { HTTPError } from "../src/errors.js";
import { MEDIA_MAX_BYTES, readMedia, uploadMedia, validateMedia } from "../src/media.js";

// Actual 16 × 12 sRGB Chrome canvas exports (not synthetic signature-only files).
const FIXTURES = {"jpeg":"/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAMABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUG/8QAIBAAAQMCBwAAAAAAAAAAAAAAEgAHFBETAhYlMURhYv/EABUBAQEAAAAAAAAAAAAAAAAAAAYI/8QAJBEAAQAHCQAAAAAAAAAAAAAAEQACBRIUFTETISIkMjNSU2L/2gAMAwEAAhEDEQA/AJ7fN9nufq8GDa490zP1hpQO90cFvsiQNXnTrvHtAAesVan1sseiOS5rzeMjct02avEbhe1Y6eaJQpVdAvT/2Q==","png":"iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAYAAABr5z2BAAAARUlEQVR4AcyPwQkAIAwDQ3dzAXeQziTOoCvqP4X20Yct5BEoR05205uJIHkFAX1MeGHjggo8MepG4SyFFwYaAD9E/T/gAQAA//+YN+iEAAAABklEQVQDALNrPZkeHM2FAAAAAElFTkSuQmCC","webp":"UklGRjYCAABXRUJQVlA4WAoAAAAgAAAADwAACwAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggSAAAADACAJ0BKhAADAABQCYlsAJ0MoABga3aZ8oAAP7YoX9G7Rlf5/6e33H0/+V24Y/H9O8HT7C4/+F25dKn/9CT//gk//cvuMAAAA=="};
const encoded = (type = "png") => new Uint8Array(Buffer.from(FIXTURES[type], "base64"));
class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec(readFileSync(new URL("../migrations/0005_owner_media.sql", import.meta.url), "utf8"));
    this.failWrite = false;
    this.selects = 0;
  }
  prepare(sql) {
    const db = this; let values = [];
    const execute = () => {
      if (db.failWrite && sql.startsWith("INSERT INTO owner_media ")) throw Error("simulated D1 write failure");
      if (sql.startsWith("SELECT")) db.selects++;
      const rows = db.sqlite.prepare(sql).all(...values);
      return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Uint8Array ? Array.from(value) : value])));
    };
    return {
      bind(...parameters) { values = parameters.map((value) => value instanceof ArrayBuffer ? new Uint8Array(value) : value); return this; },
      async first() { return execute()[0] || null; },
      async all() { return { success: true, results: execute() }; },
      async run() { const result = db.sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } }; }
    };
  }
}
function fixture() {
  const env = { DB: new D1(), ALLOWED_ORIGIN: "https://rosellecalyx.github.io" };
  return {
    env,
    upload(bytes = encoded(), type = "image/png", headers = {}) {
      return uploadMedia(new Request("https://messages.example.workers.dev/api/host/media", { method: "POST", body: bytes, headers: { "Content-Type": type, ...headers } }), env);
    },
    usage() { return { ...env.DB.sqlite.prepare("SELECT * FROM owner_media_usage").get() }; },
    count() { return env.DB.sqlite.prepare("SELECT count(*) AS count FROM owner_media").get().count; }
  };
}
const rejects = (promise, code, status) => assert.rejects(promise, (error) => error instanceof HTTPError && error.code === code && (!status || error.status === status));
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const value = Buffer.alloc(data.length + 12); value.writeUInt32BE(data.length); value.write(type, 4, "ascii"); value.set(data, 8); value.writeUInt32BE(crc32(value.subarray(4, value.length - 4)), value.length - 4); return new Uint8Array(value);
}
function pngWith(width, height, metadata = false) {
  const bytes = Buffer.from(encoded()); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
  return new Uint8Array(metadata ? Buffer.concat([bytes.subarray(0, 33), chunk("tEXt", new TextEncoder().encode("OriginalFilename\0private-photo.jpg")), bytes.subarray(33)]) : bytes);
}
function joined(...chunks) { return new Uint8Array(Buffer.concat(chunks)); }
function distinctImage(index) { return pngWith(16 + index, 12); }

test("actual Chrome canvas JPEG, PNG, and WebP are accepted, normalized, and their private profile metadata is removed", () => {
  for (const type of ["jpeg", "png", "webp"]) {
    const image = validateMedia(encoded(type), "image/" + type);
    assert.equal(image.width, 16); assert.equal(image.height, 12);
    assert.ok(image.data.byteLength <= encoded(type).byteLength);
    assert.equal(Buffer.from(image.data).includes(Buffer.from("Google Inc.")), false);
    const twice = validateMedia(image.data, "image/" + type);
    assert.deepEqual(twice, image);
  }
  const plain = validateMedia(encoded(), "image/png"), metadata = validateMedia(pngWith(16, 12, true), "image/png");
  assert.deepEqual(metadata, plain); assert.equal(Buffer.from(metadata.data).includes(Buffer.from("private-photo.jpg")), false);
});

test("binary uploads round-trip through the D1 ArrayBuffer/BLOB binding and public response without filenames or private fields", async () => {
  const f = fixture();
  for (const type of ["jpeg", "png", "webp"]) {
    const saved = await f.upload(encoded(type), "image/" + type);
    assert.match(saved.id, /^[a-f\d-]{36}$/); assert.equal(saved.ok, true); assert.equal(saved.deduplicated, false);
    assert.equal(saved.url, "https://messages.example.workers.dev/api/media/" + saved.id);
    assert.equal(saved.width, 16); assert.equal(saved.height, 12); assert.equal(saved.mime, "image/" + type);
    assert.deepEqual(Object.keys(saved).sort(), ["ok", "id", "url", "width", "height", "mime", "bytes", "deduplicated"].sort());
    const response = await readMedia(new Request(saved.url), f.env, saved.id);
    assert.equal(response.status, 200); assert.equal(response.headers.get("Content-Type"), saved.mime);
    assert.equal(response.headers.get("Content-Length"), String(saved.bytes)); assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(response.headers.get("Cache-Control"), /immutable/); assert.equal(response.headers.get("Cross-Origin-Resource-Policy"), "cross-origin");
    assert.equal(response.headers.get("Content-Disposition"), null); assert.equal(response.headers.get("Set-Cookie"), null);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), validateMedia(encoded(type), saved.mime).data);
  }
  assert.equal(f.count(), 3); assert.equal(f.usage().images, 3);
});

test("SHA-256 retries and concurrent uploads deduplicate exactly once and consume one storage and daily quota entry", async () => {
  const f = fixture(); const saved = await Promise.all(Array.from({ length: 12 }, () => f.upload()));
  assert.equal(new Set(saved.map((value) => value.id)).size, 1);
  assert.equal(saved.filter((value) => !value.deduplicated).length, 1);
  assert.equal(f.count(), 1); assert.equal(f.usage().daily_uploads, 1); assert.equal(f.usage().bytes_used, saved[0].bytes);
  const metadataRetry = await f.upload(pngWith(16, 12, true)); assert.equal(metadataRetry.id, saved[0].id); assert.equal(metadataRetry.deduplicated, true);
});

test("rejects mislabeled, unsupported, animated, truncated, trailing, or malformed image data before any D1 writes", async () => {
  const f = fixture();
  for (const [bytes, type] of [[encoded(), "image/jpeg"], [new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>") , "image/png"], [new Uint8Array(), "image/png"], [encoded().subarray(0, 40), "image/png"], [joined(encoded(), new Uint8Array([1])), "image/png"], [encoded("jpeg").subarray(0, 35), "image/jpeg"], [joined(encoded("jpeg"), new Uint8Array([1])), "image/jpeg"], [encoded("webp").subarray(0, 24), "image/webp"]]) {
    await rejects(f.upload(bytes, type), "media_invalid", 400);
  }
  const badCRC = encoded(); badCRC[40] ^= 1; await rejects(f.upload(badCRC), "media_invalid", 400);
  const animation = Buffer.from(encoded("webp")); animation[20] |= 2; await rejects(f.upload(animation, "image/webp"), "media_invalid", 400);
  const apng = joined(encoded().subarray(0, 33), chunk("acTL", new Uint8Array(8)), encoded().subarray(33)); await rejects(f.upload(apng), "media_invalid", 400);
  for (const type of ["image/svg+xml", "text/html", "image/gif", "application/octet-stream", "multipart/form-data;boundary=test"]) await rejects(f.upload(encoded(), type), "media_type", 415);
  await rejects(f.upload(encoded(), "image/png", { "Content-Encoding": "gzip" }), "media_type", 415);
  assert.equal(f.count(), 0); assert.equal(f.env.DB.selects, 0);
});

test("dimensions are taken from the actual raster header and enforce the 2048px cap", async () => {
  const f = fixture();
  for (const [width, height] of [[0, 12], [16, 0], [2049, 12], [16, 2049], [0xffffffff, 12]]) await rejects(f.upload(pngWith(width, height)), "media_dimensions", 400);
  assert.equal(f.count(), 0);
  const boundary = await f.upload(pngWith(2048, 2048)); assert.equal(boundary.width, 2048); assert.equal(boundary.height, 2048);
});

test("limits the incoming binary stream before buffering and checks a declared oversized body early", async () => {
  const f = fixture(); let canceled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MEDIA_MAX_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel() { canceled = true; } });
  await rejects(uploadMedia(new Request("https://messages.example/api/host/media", { method: "POST", body: stream, duplex: "half", headers: { "Content-Type": "image/png" } }), f.env), "too_large", 413);
  assert.equal(canceled, true);
  await rejects(f.upload(encoded(), "image/png", { "Content-Length": String(MEDIA_MAX_BYTES + 1) }), "too_large", 413);
  assert.equal(f.count(), 0); assert.equal(f.env.DB.selects, 0);
});

test("atomic 100MiB storage and 1000-image caps reject excess, preserve the winning image, and still allow dedup retries", async () => {
  const f = fixture(), size = encoded().length;
  f.env.DB.sqlite.prepare("UPDATE owner_media_usage SET bytes_used = ?").run(104857600 - size);
  const responses = await Promise.allSettled([f.upload(distinctImage(1)), f.upload(distinctImage(2))]);
  assert.equal(responses.filter((value) => value.status === "fulfilled").length, 1);
  const failure = responses.find((value) => value.status === "rejected").reason;
  assert.equal(failure.code, "media_capacity"); assert.equal(failure.status, 409); assert.equal(f.count(), 1); assert.equal(f.usage().bytes_used, 104857600);
  const winnerIndex = responses[0].status === "fulfilled" ? 1 : 2;
  assert.equal((await f.upload(distinctImage(winnerIndex))).deduplicated, true);
  const images = fixture(); images.env.DB.sqlite.exec("UPDATE owner_media_usage SET images = 1000"); await rejects(images.upload(), "media_capacity", 409); assert.equal(images.count(), 0);
});

test("the UTC daily quota is atomic, resets on a new day, and a repeated digest does not consume quota", async () => {
  const f = fixture(), time = Math.floor(Date.now() / 1000), dayStart = Math.floor(time / 86400) * 86400;
  f.env.DB.sqlite.prepare("UPDATE owner_media_usage SET day_start = ?, daily_uploads = 99").run(dayStart);
  const results = await Promise.allSettled([f.upload(distinctImage(1)), f.upload(distinctImage(2))]);
  assert.equal(results.filter((value) => value.status === "fulfilled").length, 1); assert.equal(f.usage().daily_uploads, 100);
  const failure = results.find((value) => value.status === "rejected").reason;
  assert.equal(failure.code, "media_rate_limit"); assert.equal(failure.status, 429); assert.ok(Number(failure.headers["Retry-After"]) > 0);
  const successful = results[0].status === "fulfilled" ? 1 : 2;
  assert.equal((await f.upload(distinctImage(successful))).deduplicated, true);
  f.env.DB.sqlite.prepare("UPDATE owner_media_usage SET day_start = ?").run(dayStart - 86400);
  assert.equal((await f.upload(distinctImage(3))).deduplicated, false); assert.equal(f.usage().daily_uploads, 1); assert.equal(f.usage().day_start, dayStart);
});

test("failed D1 persistence produces no success URL and no media or accounting changes", async () => {
  const f = fixture(); f.env.DB.failWrite = true;
  await assert.rejects(f.upload(), /simulated D1 write failure/);
  assert.equal(f.count(), 0); assert.equal(f.usage().bytes_used, 0); assert.equal(f.usage().daily_uploads, 0);
});

test("public GET/HEAD use immutable validators, correct CORS, and no metadata; malformed or unknown UUIDs return 404", async () => {
  const f = fixture(), saved = await f.upload();
  const head = await readMedia(new Request(saved.url, { method: "HEAD", headers: { Origin: f.env.ALLOWED_ORIGIN } }), f.env, saved.id.toUpperCase());
  assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0); assert.equal(head.headers.get("Content-Length"), String(saved.bytes));
  assert.equal(head.headers.get("Access-Control-Allow-Origin"), f.env.ALLOWED_ORIGIN);
  assert.match(head.headers.get("ETag"), /^"[a-f\d]{64}"$/);
  const cached = await readMedia(new Request(saved.url, { headers: { "If-None-Match": '"other", W/' + head.headers.get("ETag") } }), f.env, saved.id);
  assert.equal(cached.status, 304); assert.equal((await cached.arrayBuffer()).byteLength, 0);
  const external = await readMedia(new Request(saved.url, { headers: { Origin: "https://example.com" } }), f.env, saved.id); assert.equal(external.headers.get("Access-Control-Allow-Origin"), null);
  await rejects(readMedia(new Request(saved.url), f.env, "../messages"), "not_found", 404);
  await rejects(readMedia(new Request(saved.url), f.env, crypto.randomUUID()), "not_found", 404);
  assert.throws(() => f.env.DB.sqlite.prepare("UPDATE owner_media SET mime = 'text/html'").run(), /media_immutable/);
});
