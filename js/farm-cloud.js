/* Shared orchard and moderated residents. The server owns the farm state. */
(function () {
  const MAX_TREES = 8, TIMEOUT_MS = 12000, MAX_BYTES = 262144;
  const TREE_TYPES = new Set(["apple", "peach", "orange", "cherry", "kiwi", "grape", "durian", "mango"]);
  const SPECIES = new Set(["rabbit", "panda", "fox", "shiba", "hedgehog", "duckling", "penguin", "redpanda", "raccoon", "wolf", "crocodile", "fennec"]);
  const TOKEN_KEY = "farm-visitor-token";
  const pending = new Map();
  let visitorToken = "", tokenRead = false, storageWarningShown = false;
  let loadOrder = 0, completedLoad = 0, latestSnapshot = null;

  function apiBase() {
    try {
      const raw = (window.SITE || {}).messageApi;
      if (typeof raw !== "string" || !raw.trim()) return "";
      const url = new URL(raw.trim());
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.search || url.hash) return "";
      return url.href.replace(/\/+$/, "");
    } catch (e) { return ""; }
  }
  const base = apiBase();
  const enabled = !!base;
  function failure(code, message, status = 0) {
    const error = new Error(message);
    error.name = "FarmCloudError"; error.code = code; error.status = status;
    return error;
  }
  const invalid = () => failure("invalid_response", "The shared farm returned invalid data. Please try again later.");
  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  const safeId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
  function text(value, max, required = false) {
    if (typeof value !== "string" || Array.from(value).length > max || /[\u0000-\u001f\u007f]/.test(value) || (required && !value.trim())) throw invalid();
    return value;
  }
  function tree(value) {
    if (!record(value) || !safeId(value.id) || !TREE_TYPES.has(value.type) ||
        !integer(value.slot, 0, MAX_TREES - 1) || !integer(value.seed, 0, 4294967295) ||
        !integer(value.variant, 0, 2) || !integer(value.plantedAbs, 0, 1000000000) ||
        !integer(value.water, 0, 3) || typeof value.canRemove !== "boolean") throw invalid();
    return { id: value.id, type: value.type, slot: value.slot, seed: value.seed, variant: value.variant,
      plantedAbs: value.plantedAbs, water: value.water, canRemove: value.canRemove };
  }
  function resident(value) {
    if (!record(value) || !safeId(value.id) || !SPECIES.has(value.species) ||
        typeof value.since !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.since)) throw invalid();
    return { id: value.id, species: value.species, name: text(value.name, 24, true),
      adoptedBy: text(value.adoptedBy, 40), note: text(value.note, 140), since: value.since };
  }
  function snapshot(value) {
    if (!record(value) || value.ok !== true || value.maxTrees !== MAX_TREES ||
        !Array.isArray(value.trees) || value.trees.length > MAX_TREES ||
        !Array.isArray(value.residents) || value.residents.length > 200) throw invalid();
    const trees = value.trees.map(tree), residents = value.residents.map(resident);
    if (new Set(trees.map(value => value.id)).size !== trees.length ||
        new Set(trees.map(value => value.slot)).size !== trees.length ||
        new Set(residents.map(value => value.id)).size !== residents.length) throw invalid();
    return { ok: true, maxTrees: MAX_TREES, trees, residents };
  }
  function randomBytes(count) {
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
      throw failure("crypto_unavailable", "This browser cannot securely identify your planting. Please use a current browser.");
    }
    return window.crypto.getRandomValues(new Uint8Array(count));
  }
  const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  function submissionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    const bytes = randomBytes(16); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const value = hex(bytes);
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }
  function token(create = false) {
    if (!tokenRead) {
      tokenRead = true;
      try {
        const stored = window.localStorage.getItem(TOKEN_KEY);
        if (typeof stored === "string" && /^[0-9a-f]{64}$/.test(stored)) visitorToken = stored;
      } catch (e) { /* A visitor can still read the shared farm. */ }
    }
    if (!visitorToken && create) {
      visitorToken = hex(randomBytes(32));
      try { window.localStorage.setItem(TOKEN_KEY, visitorToken); }
      catch (e) {
        if (!storageWarningShown && window.Site && typeof Site.toast === "function") {
          storageWarningShown = true;
          Site.toast("This browser cannot remember tree ownership. Keep this page open to manage trees you plant.", 6000);
        }
      }
    }
    return visitorToken;
  }
  function serviceError(value, status) {
    const code = record(value) && typeof value.code === "string" && /^[a-z_]{1,40}$/.test(value.code) ? value.code : "request_failed";
    let message = "The shared farm could not save this change. Please try again.";
    if (status === 409 && code === "farm_pending_full") message = "Adoption requests are waiting for review. Please let the keeper review them before sending another request.";
    else if (status === 409 && /full|capacity/.test(code)) message = "The orchard is full (8 trees). Make room before planting another tree.";
    else if (status === 409) message = "This request conflicts with an earlier change. Refresh the farm and try again.";
    else if (status === 403) message = "Only the visitor who planted this tree can remove it.";
    else if (status === 401) message = "Your tree ownership could not be verified. Please refresh and try again.";
    else if (status === 429) message = "The farm needs a short rest. Please wait before trying again.";
    else if (status >= 500) message = "The shared farm is temporarily unavailable. Please try again later.";
    else if (status === 400) message = "The farm could not accept these details. Please check them and try again.";
    return failure(code, message, status);
  }
  async function request(route, { method = "GET", body } = {}) {
    if (!enabled) throw failure("not_configured", "The shared farm is not connected yet.");
    const controller = new AbortController();
    let timer, timedOut = false;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(failure("timeout", "The shared farm connection timed out. Retry to check the same change."));
      }, TIMEOUT_MS);
    });
    const operation = (async () => {
      const headers = { Accept: "application/json" };
      if (method === "GET") { const visitor = token(); if (visitor) headers["X-Farm-Token"] = visitor; }
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetch(base + route, {
        method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: "omit", mode: "cors", cache: "no-store", redirect: "error",
        referrerPolicy: "no-referrer", signal: controller.signal
      });
      const raw = await response.text();
      if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).length > MAX_BYTES) throw invalid();
      let value;
      try { value = JSON.parse(raw); } catch (e) { throw invalid(); }
      if (!response.ok || !record(value) || value.ok !== true) throw serviceError(value, response.status);
      return value;
    })();
    try { return await Promise.race([operation, timeout]); }
    catch (e) {
      if (timedOut) throw failure("timeout", "The shared farm connection timed out. Retry to check the same change.");
      if (e && e.name === "FarmCloudError") throw e;
      throw failure("network", "The shared farm could not be reached. Retry to check the same change.");
    } finally { clearTimeout(timer); }
  }
  function mutate(route, method, fields, validate, idempotent = true) {
    if (!enabled) throw failure("not_configured", "The shared farm is not connected yet.");
    const key = method + " " + route + " " + JSON.stringify(fields);
    let entry = pending.get(key);
    if (entry && entry.promise) return entry.promise;
    if (!entry) {
      entry = { body: { ...fields, visitorToken: token(true), ...(idempotent ? { submissionId: submissionId() } : {}) } };
      pending.set(key, entry);
    }
    entry.promise = request(route, { method, body: entry.body }).then((value) => {
      const result = validate(value);
      pending.delete(key);
      return result;
    }).finally(() => { entry.promise = null; });
    return entry.promise;
  }
  const load = async () => {
    const order = ++loadOrder;
    const value = snapshot(await request("/api/farm"));
    // A slow polling response must not replace a newer post-save refresh.
    if (order < completedLoad) return snapshot(latestSnapshot);
    completedLoad = order; latestSnapshot = snapshot(value);
    return value;
  };
  function plant(type) {
    if (!TREE_TYPES.has(type)) return Promise.reject(failure("validation", "Choose a fruit tree from the planting list."));
    try { return mutate("/api/farm/trees", "POST", { type }, value => {
      const planted = tree(value.tree); if (planted.type !== type) throw invalid();
      return { ok: true, tree: planted };
    }); }
    catch (e) { return Promise.reject(e); }
  }
  function water(id) {
    if (!safeId(id)) return Promise.reject(failure("validation", "Choose a tree in the shared orchard."));
    try { return mutate("/api/farm/trees/" + encodeURIComponent(id) + "/water", "POST", {}, value => {
      const watered = tree(value.tree); if (watered.id !== id) throw invalid();
      return { ok: true, tree: watered };
    }); }
    catch (e) { return Promise.reject(e); }
  }
  function remove(id) {
    if (!safeId(id)) return Promise.reject(failure("validation", "Choose a tree in the shared orchard."));
    const route = "/api/farm/trees/" + encodeURIComponent(id);
    try { return mutate(route, "DELETE", {}, value => {
      if (value.deleted !== true) throw invalid();
      return { ok: true, deleted: true };
    }, false).catch(async (e) => {
      if (e.code === "tree_not_found" && e.status === 404) {
        const current = await load();
        if (!current.trees.some(value => value.id === id)) {
          pending.delete("DELETE " + route + " {}");
          return { ok: true, deleted: true, alreadyRemoved: true };
        }
      }
      throw e;
    }); }
    catch (e) { return Promise.reject(e); }
  }
  function adopt(def) {
    try {
      if (!record(def) || !SPECIES.has(def.species)) throw failure("validation", "Choose a friend from the adoption list.");
      const fields = { species: def.species, name: text(def.name, 24, true).trim(),
        adoptedBy: text(def.adoptedBy === undefined ? "a visitor" : def.adoptedBy, 40).trim() || "a visitor",
        note: text(def.note === undefined ? "" : def.note, 140).trim(),
        website: text(def.website === undefined ? "" : def.website, 200) };
      return mutate("/api/farm/adoptions", "POST", fields, value => {
        if (!safeId(value.id) || !["pending", "approved", "rejected"].includes(value.status)) throw invalid();
        return { ok: true, id: value.id, status: value.status };
      });
    } catch (e) {
      if (e.code === "invalid_response") e = failure("validation", "Please check the adoption name and note lengths.");
      return Promise.reject(e);
    }
  }
  function watch(onSnapshot, onError = () => {}, { interval = 15000 } = {}) {
    const delay = Math.max(5000, Number.isFinite(interval) ? interval : 15000);
    let stopped = false, running = false, timer;
    async function tick() {
      if (stopped || running || document.hidden) return;
      running = true;
      try { const value = await load(); if (!stopped) onSnapshot(value); }
      catch (e) { if (!stopped) onError(e); }
      finally {
        running = false;
        if (!stopped && !document.hidden) timer = setTimeout(tick, delay);
      }
    }
    const visible = () => {
      clearTimeout(timer);
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", visible);
    tick();
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }
  window.FarmCloud = { enabled, MAX_TREES, load, plant, water, remove, adopt, watch };
})();
