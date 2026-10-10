import { farmRoute } from './farm.js';
import { HTTPError } from "./errors.js";
import { readSiteContent, saveSiteContent } from "./site-content.js";
import { uploadMedia, readMedia } from "./media.js";

const ACCESS_SECONDS = 3600;
const REFRESH_SECONDS = 7 * 24 * 3600;
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const PRIVATE_COLUMNS = "id, created_at, name, contact, text, read_at, status, host_note";
const now = () => Math.floor(Date.now() / 1000);
const hex = (bytes) => Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
const digest = async (value) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
function constantEqual(left, right) {
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return difference === 0;
}
function configured(env) {
  if (!env.DB || typeof env.HOST_PASSWORD !== "string" || env.HOST_PASSWORD.length < 16 || !env.HOST_EMAIL || !env.ALLOWED_ORIGIN) {
    throw new HTTPError(503, "not_configured", "The shore has not connected its private inbox yet.");
  }
  try {
    const origin = new URL(env.ALLOWED_ORIGIN);
    if (origin.origin !== env.ALLOWED_ORIGIN || (origin.protocol !== "https:" && !/^localhost$|^127\.0\.0\.1$/.test(origin.hostname))) throw Error();
  } catch (_) { throw new HTTPError(503, "not_configured", "The inbox origin is not configured correctly."); }
}
function assertOrigin(request, env) {
  if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) throw new HTTPError(403, "origin_denied", "This origin is not allowed.");
}
function response(request, env, data, status = 200, extra = {}) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff", ...extra };
  if (env.ALLOWED_ORIGIN && request.headers.get("Origin") === env.ALLOWED_ORIGIN) headers["Access-Control-Allow-Origin"] = env.ALLOWED_ORIGIN;
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}
async function jsonBody(request, allowed, maximum = 8192) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) throw new HTTPError(415, "json_required", "Please submit JSON.");
  if (Number(request.headers.get("Content-Length") || 0) > maximum) throw new HTTPError(413, "too_large", "The request is too large.");
  // Limit the stream as it arrives, including chunked bodies without a length
  // header. Never buffer an unbounded request before checking its size.
  const chunks = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > maximum) {
          await reader.cancel();
          throw new HTTPError(413, "too_large", "The request is too large.");
        }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
  }
  const bytes = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  let raw;
  try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch (_) { throw new HTTPError(400, "invalid_json", "The request could not be read."); }
  let value;
  try { value = JSON.parse(raw); } catch (_) { throw new HTTPError(400, "invalid_json", "The request could not be read."); }
  if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).some((key) => !allowed.includes(key))) throw new HTTPError(400, "invalid_fields", "The request has unsupported fields.");
  return value;
}
function textField(value, maximum, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== "string") throw new HTTPError(400, "validation", "Please check the letter fields.");
  const clean = value.trim();
  const size = Array.from(clean).length;
  if (size > maximum || (required && size < 2)) throw new HTTPError(400, "validation", "Write 2–500 characters; name up to 60 and contact up to 120.");
  return clean || null;
}
async function rateLimit(request, env, scope, maximum, seconds) {
  const time = now();
  const windowStart = Math.floor(time / seconds) * seconds;
  const secret = await crypto.subtle.importKey("raw", encoder.encode(env.HOST_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ipHash = hex(await crypto.subtle.sign("HMAC", secret, encoder.encode(request.headers.get("CF-Connecting-IP") || "unknown")));
  const key = scope + ":" + ipHash + ":" + windowStart;
  const row = await env.DB.prepare("INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count")
    .bind(key, windowStart + seconds).first();
  if (!row || row.count > maximum) throw new HTTPError(429, "rate_limit", "The shore is receiving too many requests. Please wait and try again.", { "Retry-After": String(windowStart + seconds - time) });
}
async function timedJSON(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const result = await fetch(url, { ...options, signal: controller.signal });
    const body = await result.json();
    return { result, body };
  } finally { clearTimeout(timeout); }
}
async function verifyTurnstile(body, env) {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (typeof body.turnstileToken !== "string" || !body.turnstileToken || body.turnstileToken.length > 2048) throw new HTTPError(400, "verification_required", "Please complete the verification and try again.");
  let verification;
  try {
    verification = await timedJSON("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken })
    });
  } catch (_) { throw new HTTPError(503, "verification_unavailable", "Verification is temporarily unavailable. Your draft has not been submitted."); }
  if (!verification.result.ok || !verification.body.success || verification.body.hostname !== new URL(env.ALLOWED_ORIGIN).hostname || verification.body.action !== "message") throw new HTTPError(400, "verification_failed", "The verification expired or was not accepted. Please try again.");
}
async function submit(request, env, ctx) {
  const body = await jsonBody(request, ["name", "contact", "text", "submissionId", "website", "turnstileToken"]);
  if (body.website != null && body.website !== "") throw new HTTPError(400, "validation", "The letter could not be accepted.");
  const name = textField(body.name, 60);
  const contact = textField(body.contact, 120);
  const text = textField(body.text, 500, true);
  if (body.submissionId != null && (typeof body.submissionId !== "string" || !UUID.test(body.submissionId))) throw new HTTPError(400, "validation", "Please use a valid submission ID.");
  const submissionId = (body.submissionId || crypto.randomUUID()).toLowerCase();
  const fingerprint = await digest(JSON.stringify({ name, contact, text }));
  const previous = await env.DB.prepare("SELECT id, payload_hash FROM messages WHERE submission_id = ?").bind(submissionId).first();
  if (previous) {
    if (!constantEqual(previous.payload_hash, fingerprint)) throw new HTTPError(409, "submission_conflict", "This submission ID has already been used for another letter.");
    return { ok: true, id: previous.id };
  }
  await rateLimit(request, env, "message", 5, 600);
  await verifyTurnstile(body, env);
  const time = now();
  const results = await env.DB.batch([
    env.DB.prepare("INSERT INTO messages (submission_id, payload_hash, created_at, name, contact, text) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(submission_id) DO NOTHING")
      .bind(submissionId, fingerprint, new Date().toISOString(), name, contact, text),
    env.DB.prepare("INSERT INTO notification_outbox (message_id, next_attempt_at) SELECT id, ? FROM messages WHERE submission_id = ? AND payload_hash = ? ON CONFLICT(message_id) DO NOTHING")
      .bind(time, submissionId, fingerprint),
    env.DB.prepare("SELECT id, payload_hash FROM messages WHERE submission_id = ?").bind(submissionId)
  ]);
  if (results.some((item) => item.success === false)) throw Error("database batch failed");
  const stored = results[2].results && results[2].results[0];
  if (!stored) throw Error("letter was not stored");
  if (!constantEqual(stored.payload_hash, fingerprint)) throw new HTTPError(409, "submission_conflict", "This submission ID has already been used for another letter.");
  // Failure to send a notification never changes the successful save result.
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(drainOutbox(env).catch(() => {}));
  return { ok: true, id: stored.id };
}
function tokenResponse(env, accessToken, refreshToken, time) {
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: ACCESS_SECONDS, expires_at: time + ACCESS_SECONDS, user: { id: "host", email: env.HOST_EMAIL } };
}
async function login(request, env) {
  await rateLimit(request, env, "login", 5, 900);
  const body = await jsonBody(request, ["email", "password"]);
  if (typeof body.email !== "string" || typeof body.password !== "string" || body.email.length > 320 || body.password.length > 1024) throw new HTTPError(401, "bad_credentials", "Email or password is incorrect.");
  const [supplied, expected] = await Promise.all([digest(body.password), digest(env.HOST_PASSWORD)]);
  const passwordOK = constantEqual(supplied, expected);
  const emailOK = body.email.trim().toLowerCase() === env.HOST_EMAIL.trim().toLowerCase();
  if (!passwordOK || !emailOK) throw new HTTPError(401, "bad_credentials", "Email or password is incorrect.");
  const accessToken = randomToken(), refreshToken = randomToken(), time = now();
  const [accessHash, refreshHash] = await Promise.all([digest(accessToken), digest(refreshToken)]);
  const result = await env.DB.prepare("INSERT INTO host_sessions (id, access_hash, refresh_hash, access_expires, refresh_expires, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), accessHash, refreshHash, time + ACCESS_SECONDS, time + REFRESH_SECONDS, time).run();
  if (result.success === false) throw Error("session was not stored");
  return tokenResponse(env, accessToken, refreshToken, time);
}
async function refresh(request, env) {
  await rateLimit(request, env, "refresh", 30, 900);
  const body = await jsonBody(request, ["refresh_token"]);
  if (typeof body.refresh_token !== "string" || !TOKEN.test(body.refresh_token)) throw new HTTPError(401, "auth_expired", "Please sign in again.");
  const accessToken = randomToken(), refreshToken = randomToken(), time = now();
  const [accessHash, refreshHash, oldHash] = await Promise.all([digest(accessToken), digest(refreshToken), digest(body.refresh_token)]);
  // One atomic conditional update consumes the old refresh token exactly once.
  // The fixed seven-day expiry cannot be extended by repeated refreshing.
  const row = await env.DB.prepare("UPDATE host_sessions SET access_hash = ?, refresh_hash = ?, access_expires = ? WHERE refresh_hash = ? AND refresh_expires > ? RETURNING id")
    .bind(accessHash, refreshHash, time + ACCESS_SECONDS, oldHash, time).first();
  if (!row) throw new HTTPError(401, "auth_expired", "Please sign in again.");
  return tokenResponse(env, accessToken, refreshToken, time);
}
async function authorize(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!TOKEN.test(token)) throw new HTTPError(401, "auth_expired", "Please sign in to read private letters.");
  const hash = await digest(token);
  const row = await env.DB.prepare("SELECT id FROM host_sessions WHERE access_hash = ? AND access_expires > ? AND refresh_expires > ?").bind(hash, now(), now()).first();
  if (!row) throw new HTTPError(401, "auth_expired", "Please sign in again.");
  return { id: row.id, hash };
}
async function hostRoute(request, env, path, url) {
  const authorized = await authorize(request, env);
  if (path === "/api/host/logout" && request.method === "POST") {
    await env.DB.prepare("DELETE FROM host_sessions WHERE id = ? AND access_hash = ?").bind(authorized.id, authorized.hash).run();
    return { ok: true };
  }
  if (path === "/api/host/me" && request.method === "GET") return { id: "host", email: env.HOST_EMAIL };
  if (path === "/api/host/site-content" && request.method === "GET") return readSiteContent(env);
  if (path === "/api/host/site-content" && request.method === "PUT") return saveSiteContent(env, await jsonBody(request, ["revision", "content"], 1024 * 1024));
  if (path === "/api/host/media" && request.method === "POST") {
    await rateLimit(request, env, "owner-media", 60, 3600);
    return uploadMedia(request, env);
  }
  if (path === "/api/host/messages" && request.method === "GET") {
    const limitRaw = url.searchParams.get("limit") || "100", offsetRaw = url.searchParams.get("offset") || "0";
    if (!/^\d+$/.test(limitRaw) || !/^\d+$/.test(offsetRaw) || !Number.isSafeInteger(Number(offsetRaw))) throw new HTTPError(400, "validation", "Invalid inbox page.");
    const limit = Math.max(1, Math.min(100, Number(limitRaw))), offset = Number(offsetRaw);
    const rows = await env.DB.prepare("SELECT " + PRIVATE_COLUMNS + " FROM messages ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    if (rows.success === false) throw Error("inbox read failed");
    return rows.results;
  }
  const match = /^\/api\/host\/messages\/([1-9]\d{0,15})$/.exec(path);
  if (match && request.method === "PATCH") {
    const body = await jsonBody(request, ["read_at", "status", "host_note"]);
    if (!Object.keys(body).length) throw new HTTPError(400, "validation", "Please choose a request field to update.");
    let readAt = null;
    if (Object.hasOwn(body, "read_at") && body.read_at !== null) {
      const date = typeof body.read_at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(body.read_at) ? new Date(body.read_at) : null;
      if (!date || Number.isNaN(date.getTime())) throw new HTTPError(400, "validation", "Please provide a valid read timestamp.");
      readAt = date.toISOString();
    }
    if (Object.hasOwn(body, "status") && !["new", "done", "archived"].includes(body.status)) throw new HTTPError(400, "validation", "Please choose a valid request status.");
    if (Object.hasOwn(body, "host_note") && typeof body.host_note !== "string") throw new HTTPError(400, "validation", "Please provide a text note.");
    const note = Object.hasOwn(body, "host_note") ? textField(body.host_note, 2000) || "" : "";
    const row = await env.DB.prepare("UPDATE messages SET read_at = CASE WHEN ? = 1 THEN ? ELSE read_at END, status = CASE WHEN ? = 1 THEN ? ELSE status END, host_note = CASE WHEN ? = 1 THEN ? ELSE host_note END WHERE id = ? RETURNING " + PRIVATE_COLUMNS)
      .bind(Object.hasOwn(body, "read_at") ? 1 : 0, readAt, Object.hasOwn(body, "status") ? 1 : 0, body.status || "new", Object.hasOwn(body, "host_note") ? 1 : 0, note, match[1]).first();
    if (!row) throw new HTTPError(404, "not_found", "This letter was not found.");
    return [row];
  }
  throw new HTTPError(404, "not_found", "This endpoint does not exist.");
}

export async function drainOutbox(env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  let inbox;
  try {
    inbox = new URL(env.INBOX_URL);
    if (inbox.protocol !== "https:" || inbox.origin !== env.ALLOWED_ORIGIN || inbox.username || inbox.password || inbox.hash) throw Error();
  } catch (_) { return; } // Leave records pending until the correct host URL is configured.
  const time = now(), lease = crypto.randomUUID();
  const claimed = await env.DB.prepare("UPDATE notification_outbox SET lease_token = ?, lease_until = ? WHERE id IN (SELECT id FROM notification_outbox WHERE sent_at IS NULL AND next_attempt_at <= ? AND lease_until <= ? ORDER BY id LIMIT 50) AND sent_at IS NULL AND lease_until <= ? RETURNING id, attempts")
    .bind(lease, time + 60, time, time, time).all();
  const entries = claimed.results || [];
  if (!entries.length) return;
  let errorCode = "network_error", retryAfter = 0, sent = false;
  try {
    const notification = await timedJSON("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: entries.length + (entries.length === 1 ? " new letter has" : " new letters have") + " reached the shore.\n" + inbox.href, disable_web_page_preview: true, protect_content: true })
    });
    sent = notification.result.ok && notification.body.ok === true;
    if (!sent) {
      errorCode = "telegram_" + (Number(notification.body.error_code) || notification.result.status);
      retryAfter = Math.max(0, Math.min(86400, Number(notification.body.parameters && notification.body.parameters.retry_after) || 0));
    }
  } catch (_) { /* Store only a short failure code, never a URL containing a bot token. */ }
  if (sent) {
    await env.DB.prepare("UPDATE notification_outbox SET sent_at = ?, lease_token = NULL, lease_until = 0, last_error = NULL WHERE lease_token = ? AND sent_at IS NULL").bind(now(), lease).run();
  } else {
    const attempts = Math.max(...entries.map((entry) => entry.attempts)) + 1;
    const delay = Math.max(retryAfter, Math.min(21600, 60 * 2 ** Math.min(attempts - 1, 8)));
    await env.DB.prepare("UPDATE notification_outbox SET attempts = attempts + 1, next_attempt_at = ?, lease_token = NULL, lease_until = 0, last_error = ? WHERE lease_token = ? AND sent_at IS NULL").bind(now() + delay, errorCode, lease).run();
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      configured(env);
      const url = new URL(request.url), path = url.pathname;
      const media = /^\/api\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(path);
      // Public image embeds are sent without an Origin header by browsers.
      // This exception never applies to private APIs or media uploads.
      if (media && ["GET", "HEAD"].includes(request.method)) return await readMedia(request, env, media[1]);
      assertOrigin(request, env);
      const farm = path === '/api/farm' || path.startsWith('/api/farm/') || path.startsWith('/api/host/farm/');
      if (request.method === "OPTIONS") {
        const method = request.headers.get("Access-Control-Request-Method") || "";
        const requested = (request.headers.get("Access-Control-Request-Headers") || "").toLowerCase().split(",").map((value) => value.trim()).filter(Boolean);
        const content = path === "/api/host/site-content";
        const methods = farm ? ["GET", "POST", "PATCH", "DELETE"] : content ? ["GET", "PUT"] : ["GET", "POST", "PATCH"];
        const headers = farm ? ["content-type", "authorization", "x-farm-token"] : ["content-type", "authorization"];
        if (!methods.includes(method) || requested.some((header) => !headers.includes(header))) throw new HTTPError(403, "cors_denied", "This preflight is not allowed.");
        return response(request, env, null, 204, { "Access-Control-Allow-Methods": methods.join(', ') + ', OPTIONS', "Access-Control-Allow-Headers": farm ? "Content-Type, Authorization, X-Farm-Token" : "Content-Type, Authorization", "Access-Control-Max-Age": "600" });
      }
      let data;
      if (farm) data = await farmRoute(request, env, path, url, { HTTPError, jsonBody, digest, rateLimit, authorize });
      else if (path === "/api/messages" && request.method === "POST") data = await submit(request, env, ctx);
      else if (path === "/api/site-content" && request.method === "GET") data = await readSiteContent(env);
      else if (path === "/api/host/login" && request.method === "POST") data = await login(request, env);
      else if (path === "/api/host/refresh" && request.method === "POST") data = await refresh(request, env);
      else if (path.startsWith("/api/host/")) data = await hostRoute(request, env, path, url);
      else throw new HTTPError(404, "not_found", "This endpoint does not exist.");
      return response(request, env, data);
    } catch (error) {
      const known = error instanceof HTTPError;
      const farm = /^\/api\/(?:host\/)?farm(?:\/|$)/.test(new URL(request.url).pathname);
      return response(request, env, { ok: false, code: known ? error.code : "service_unavailable", message: known ? error.message : farm ? "The shared farm is temporarily unavailable. Please try again." : "The private inbox is temporarily unavailable. Please try again." }, known ? error.status : 503, known ? error.headers : {});
    }
  },
  async scheduled(_event, env, ctx) {
    const task = (async () => {
      configured(env);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now() - 3600),
        env.DB.prepare("DELETE FROM host_sessions WHERE refresh_expires <= ?").bind(now())
      ]);
      await drainOutbox(env);
    })();
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(task);
    else await task;
  }
};
