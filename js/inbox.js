/* Host-only inbox. A configured message API takes precedence; Supabase remains
   supported. The server enforces owner access; hiding this page grants none. */
(function () {
  "use strict";
  const site = window.SITE || {};
  const cfg = site.supabase || {};
  const key = String(cfg.anonKey || "").trim();
  const messageApi = String(site.messageApi || "").trim();
  const setupKind = messageApi || !(cfg.url || key) ? "cloudflare" : "supabase";
  const storageKey = "message-host-session-v1";
  const timeoutMs = 12000;
  const localPreview = window.location?.protocol === "file:";
  const localPreviewMessage = "This local preview cannot connect to the host service. Open the live host workspace to sign in.";
  let base = "";
  let mode = "none";
  let session = null;
  let refreshPromise = null;
  let sessionVersion = 0;
  let configurationError = "";

  function endpoint(value) {
    const url = new URL(String(value));
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.search || url.hash) throw new Error();
    return url.href.replace(/\/$/, "");
  }

  try {
    if (messageApi) {
      base = endpoint(messageApi);
      mode = "cloudflare";
    } else {
      const url = endpoint(cfg.url || "");
      let safeKey = key.startsWith("sb_publishable_");
      if (!safeKey) {
        const claims = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        safeKey = claims.role === "anon";
      }
      if (!safeKey) throw new Error();
      base = url;
      mode = "supabase";
    }
  } catch (_) {
    configurationError = messageApi
      ? "Invalid inbox service URL. Set messageApi in js/config.js to an HTTPS base URL without a query or fragment."
      : (cfg.url || key ? "Supabase configuration is incomplete or invalid. Use the project URL and a public publishable or anon key." : "The inbox is not connected yet. Complete the setup steps below." );
  }

  class InboxError extends Error {
    constructor(code, message, status) { super(message); this.name = "InboxError"; this.code = code; this.status = status || 0; }
  }

  function assertSession(version) {
    if (version !== sessionVersion) throw new InboxError("session_changed", "Your sign-in session changed. This request was cancelled.");
  }

  function saveSession(data) {
    if (!data || !data.access_token || !data.refresh_token) throw new InboxError("invalid_response", "The sign-in service returned an incomplete session. Please try again.");
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(data.expires_at) || (Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600)),
      user: { id: data.user && data.user.id || "", email: data.user && data.user.email || "" }
    };
    try { sessionStorage.setItem(storageKey, JSON.stringify({ base, backend: mode, session })); } catch (_) { /* Memory-only session if storage is unavailable. */ }
  }

  function clearSession() {
    sessionVersion += 1;
    session = null;
    refreshPromise = null;
    try { sessionStorage.removeItem(storageKey); } catch (_) { /* No storage access. */ }
  }

  async function request(path, options = {}) {
    // Files opened directly have an opaque origin that the host API rejects.
    // Catch this before sending credentials or attempting session restoration.
    if (localPreview) throw new InboxError("local_preview", localPreviewMessage);
    if (!base) throw new InboxError("not_configured", configurationError);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(base + path, Object.assign({}, options, { credentials: "omit", signal: controller.signal }));
      const body = await response.text();
      let data = null;
      if (body) { try { data = JSON.parse(body); } catch (_) { if (response.ok) throw new InboxError("invalid_response", "The inbox service returned an unreadable response."); } }
      if (!response.ok) {
        if (response.status === 401) throw new InboxError("auth_expired", "Your session has expired. Please sign in again.", 401);
        if (response.status === 403) throw new InboxError("forbidden", "This account cannot access the inbox. Please use the host account.", 403);
        if (response.status === 429) throw new InboxError("rate_limit", "Too many requests. Please try again shortly.", 429);
        if (data && data.code === "farm_full") throw new InboxError("farm_full", "The farm already has 24 residents. Make room before approving another animal.", response.status);
        if (data && data.code === "adoption_reviewed") throw new InboxError("adoption_reviewed", "This request has already been reviewed. Refresh the requests to see the latest state.", response.status);
        if (data && data.code === "tree_not_found") throw new InboxError("tree_not_found", "This tree has already been removed. Refresh the orchard to see the latest state.", response.status);
        if (data && data.code === "content_conflict") throw new InboxError("content_conflict", "The website was updated elsewhere. Your draft is preserved. Reload the published version before saving again.", response.status);
        if (data && data.code === "farm_capacity") throw new InboxError("farm_capacity", "The farm can hold 24 residents, including animals resting indoors. Cancel a new animal draft before adding more. Your draft is preserved.", response.status);
        if (data && data.code === "resident_not_found") throw new InboxError("resident_not_found", "This resident has already left the farm. Refresh the resident list.", response.status);
        if (data && data.code === "resident_conflict") throw new InboxError("resident_conflict", "This animal was updated elsewhere. Your changes are kept here. Refresh its published details before saving again.", response.status);
        if (data && /^media_|^upload_/.test(data.code || "")) throw new InboxError(data.code, data.message || "This image could not be uploaded. Please try again.", response.status);
        if (response.status === 413) throw new InboxError("too_large", path === "/api/host/media" ? data?.message || "This cropped image is too large to upload. Choose a smaller output." : "This content is too large to publish. Reduce the text or number of items, then try again.", 413);
        if (data && data.code === "validation") throw new InboxError("validation", data.message || "Please check the content fields.", response.status);
        if (response.status === 404) throw new InboxError("not_available", "This feature is not available on the connected service yet. Deploy the latest owner-workspace service.", 404);
        throw new InboxError("http_error", "The inbox service is unavailable. Check the configuration or try again shortly.", response.status);
      }
      return data;
    } catch (error) {
      if (error instanceof InboxError) throw error;
      const timedOut = error && error.name === "AbortError";
      throw new InboxError(timedOut ? "timeout" : "network_error", timedOut
        ? "The host service took too long to respond. Please try again."
        : "The host service could not be reached. Check your connection and try again.");
    } finally { clearTimeout(timer); }
  }

  function headers(token) {
    const result = { "Content-Type": "application/json" };
    if (mode === "supabase") result.apikey = key;
    if (token) result.Authorization = "Bearer " + token;
    return result;
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise;
    if (!session) throw new InboxError("auth_expired", "Please sign in first.");
    const version = sessionVersion;
    const refreshToken = session.refresh_token;
    refreshPromise = (async () => {
      try {
        const data = await request(mode === "cloudflare" ? "/api/host/refresh" : "/auth/v1/token?grant_type=refresh_token", {
          method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: refreshToken })
        });
        assertSession(version);
        saveSession(data);
        return session.access_token;
      } catch (error) {
        if (version === sessionVersion && (error.status === 400 || error.status === 401 || error.status === 403)) {
          clearSession();
          throw new InboxError("auth_expired", "Your session has expired. Please sign in again.");
        }
        throw error;
      } finally { if (version === sessionVersion) refreshPromise = null; }
    })();
    return refreshPromise;
  }

  async function validToken() {
    if (!session) throw new InboxError("auth_expired", "Please sign in first.");
    if (session.expires_at < Math.floor(Date.now() / 1000) + 60) return refresh();
    return session.access_token;
  }

  async function authedRequest(path, options = {}) {
    const version = sessionVersion;
    let token = await validToken();
    assertSession(version);
    const perform = () => request(path, Object.assign({}, options, { headers: Object.assign(headers(token), options.headers || {}) }));
    try { const data = await perform(); assertSession(version); return data; }
    catch (error) {
      // A response from a superseded request must never refresh, clear, or use
      // credentials from a newer login that completed while it was in flight.
      assertSession(version);
      if (error.status !== 401) throw error;
      token = await refresh();
      assertSession(version);
      try { const data = await perform(); assertSession(version); return data; }
      catch (retryError) {
        assertSession(version);
        if (retryError.status === 401) clearSession();
        throw retryError;
      }
    }
  }

  async function requireHost() {
    if (mode === "cloudflare") {
      const host = await authedRequest("/api/host/me");
      if (!host || host.id !== "host") throw new InboxError("forbidden", "This account is not the harbor keeper. Please use the host account.");
      return host.id;
    }
    // RLS only exposes the requesting user's own membership. A valid login alone
    // cannot grant host access; membership can only be bootstrapped server-side.
    const rows = await authedRequest("/rest/v1/message_hosts?select=user_id&limit=1");
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].user_id) throw new InboxError("forbidden", "This account is not the harbor keeper. Please use the host account.");
    return rows[0].user_id;
  }

  async function signOut(expectedVersion = sessionVersion) {
    if (expectedVersion !== sessionVersion) return { remoteRevoked: true };
    const previous = session;
    clearSession();
    if (!previous) return { remoteRevoked: true };
    try {
      await request(mode === "cloudflare" ? "/api/host/logout" : "/auth/v1/logout?scope=local", { method: "POST", headers: headers(previous.access_token) });
      return { remoteRevoked: true };
    } catch (_) { return { remoteRevoked: false }; }
  }

  async function signIn(email, password) {
    clearSession();
    const version = sessionVersion;
    let data;
    try {
      data = await request(mode === "cloudflare" ? "/api/host/login" : "/auth/v1/token?grant_type=password", { method: "POST", headers: headers(), body: JSON.stringify({ email: String(email).trim(), password: String(password) }) });
    } catch (error) {
      if ([400, 401, 403].includes(error.status)) throw new InboxError("bad_credentials", "The email or password is incorrect, or the account is not active.");
      throw error;
    }
    assertSession(version);
    saveSession(data);
    try { await requireHost(); assertSession(version); }
    catch (error) {
      assertSession(version);
      await signOut(version);
      throw error;
    }
    return session.user;
  }

  async function restore() {
    if (!base || localPreview) return false;
    const version = sessionVersion;
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (!stored || stored.base !== base || !stored.session || (stored.backend || "supabase") !== mode) return false;
      saveSession(stored.session);
    } catch (_) { if (version === sessionVersion) clearSession(); return false; }
    try { await requireHost(); return version === sessionVersion; }
    catch (error) {
      // A visitor can log in while startup restoration is awaiting the server.
      // Ignore the old restore result instead of logging out the new owner.
      if (version !== sessionVersion) return false;
      if (error.code === "forbidden" || error.code === "auth_expired") await signOut(version);
      throw error;
    }
  }

  async function list({ limit = 100, offset = 0 } = {}) {
    const version = sessionVersion;
    await requireHost();
    assertSession(version);
    const count = Math.max(1, Math.min(100, Math.floor(Number(limit) || 100)));
    const start = Math.max(0, Math.floor(Number(offset) || 0));
    const path = mode === "cloudflare"
      ? "/api/host/messages?limit=" + count + "&offset=" + start
      : "/rest/v1/bottles?select=id,created_at,name,contact,text,read_at&order=created_at.desc,id.desc&limit=" + count + "&offset=" + start;
    const rows = await authedRequest(path);
    assertSession(version);
    if (!Array.isArray(rows)) throw new InboxError("invalid_response", "Letters could not be loaded. Check the database configuration.");
    return rows;
  }

  async function markRead(id) {
    if (!/^\d+$/.test(String(id))) throw new InboxError("validation", "Invalid letter ID.");
    const version = sessionVersion;
    await requireHost();
    assertSession(version);
    const path = mode === "cloudflare" ? "/api/host/messages/" + encodeURIComponent(id) : "/rest/v1/bottles?id=eq." + encodeURIComponent(id);
    const rows = await authedRequest(path, {
      method: "PATCH", headers: mode === "supabase" ? { Prefer: "return=representation" } : {}, body: JSON.stringify({ read_at: new Date().toISOString() })
    });
    assertSession(version);
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].read_at) throw new InboxError("forbidden", "Could not mark this letter as read. It may no longer exist, or your access may have changed.");
    return rows[0];
  }

  const farmSpecies = { snowcat: "Snow leopard cat", rabbit: "Rabbit", panda: "Panda", fox: "Fox", shiba: "Shiba Inu", hedgehog: "Hedgehog", duckling: "Duckling", penguin: "Penguin", redpanda: "Red panda", raccoon: "Raccoon", wolf: "Wolf", crocodile: "Crocodile", fennec: "Fennec fox" };
  const orchardTypes = { apple: "Apple", peach: "Peach", orange: "Orange", cherry: "Cherry", kiwi: "Kiwi vine", grape: "Grape vine", durian: "Durian", mango: "Mango" };
  function requireFarmService() {
    if (mode !== "cloudflare") throw new InboxError("not_configured", "Shared farm management requires the Cloudflare farm service.");
  }
  async function farmRequest(path, options) {
    requireFarmService();
    const version = sessionVersion;
    await requireHost();
    assertSession(version);
    const data = await authedRequest(path, options);
    assertSession(version);
    return data;
  }
  function adoptionRow(row) {
    return row && /^(?:[1-9]\d*|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(String(row.id)) && Object.hasOwn(farmSpecies, row.species)
      && typeof row.name === "string" && ["pending", "approved", "rejected"].includes(row.status);
  }
  async function listAdoptions({ status = "pending" } = {}) {
    if (!["pending", "approved", "rejected"].includes(status)) throw new InboxError("validation", "Invalid adoption filter.");
    const rows = await farmRequest("/api/host/farm/adoptions?status=" + status);
    if (!Array.isArray(rows) || rows.some(row => !adoptionRow(row) || row.status !== status)) throw new InboxError("invalid_response", "Adoption requests could not be loaded. Please try again.");
    return rows;
  }
  async function reviewAdoption(id, decision) {
    if (!/^(?:[1-9]\d*|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(String(id)) || !["approved", "rejected"].includes(decision)) throw new InboxError("validation", "Invalid adoption review.");
    const row = await farmRequest("/api/host/farm/adoptions/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ status: decision }) });
    if (!adoptionRow(row) || String(row.id) !== String(id) || row.status !== decision) throw new InboxError("invalid_response", "The review could not be confirmed. Refresh the requests before trying again.");
    return row;
  }
  const residentID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const residentFields = ["species", "name", "adoptedBy", "note", "since", "active"];
  function residentText(value, maximum, required = false) {
    return typeof value === "string" && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value)
      && Array.from(value.trim()).length <= maximum && (!required || Boolean(value.trim()));
  }
  function residentField(key, value) {
    if (key === "species") return typeof value === "string" && value !== "snowcat" && Object.hasOwn(farmSpecies, value);
    if (key === "active") return typeof value === "boolean";
    if (key === "since") return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    return residentText(value, key === "name" ? 24 : key === "adoptedBy" ? 40 : 140, key === "name");
  }
  function residentRow(row) {
    return row && residentID.test(String(row.id)) && residentFields.every(key => residentField(key, row[key]))
      && row.adoptedBy.trim() && Number.isSafeInteger(row.version) && row.version >= 0
      && typeof row.created_at === "string" && Number.isFinite(new Date(row.created_at).getTime());
  }
  async function listResidents() {
    const rows = await farmRequest("/api/host/farm/residents");
    if (!Array.isArray(rows) || rows.length > 24 || rows.some(row => !residentRow(row)) || new Set(rows.map(row => row.id)).size !== rows.length) throw new InboxError("invalid_response", "The animal list could not be loaded. Please try again.");
    return rows;
  }
  async function updateResident(id, changes) {
    if (!residentID.test(String(id)) || !changes || typeof changes !== "object" || Array.isArray(changes)
      || !Number.isSafeInteger(changes.version) || changes.version < 0
      || Object.keys(changes).some(key => key !== "version" && !residentFields.includes(key))
      || !residentFields.some(key => Object.hasOwn(changes, key))
      || residentFields.some(key => Object.hasOwn(changes, key) && !residentField(key, changes[key]))) throw new InboxError("validation", "Check the animal’s name, species, adopter, story, month, and outdoor status before saving.");
    const row = await farmRequest("/api/host/farm/residents/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(changes) });
    if (!residentRow(row) || row.id.toLowerCase() !== String(id).toLowerCase() || row.version !== changes.version + 1
      || residentFields.some(key => Object.hasOwn(changes, key) && row[key] !== (typeof changes[key] === "string" ? changes[key].trim() || (key === "adoptedBy" ? "a visitor" : "") : changes[key]))) throw new InboxError("invalid_response", "The animal update could not be confirmed. Your changes are kept here. Refresh to check the published details.");
    return row;
  }
  async function listOrchard() {
    const data = await farmRequest("/api/farm");
    if (!data || data.ok !== true || data.maxTrees !== 8 || !Array.isArray(data.trees) || data.trees.length > 8
      || data.trees.some(tree => !tree || !/^[a-zA-Z0-9_-]{1,80}$/.test(String(tree.id)) || !Object.hasOwn(orchardTypes, tree.type)
        || !Number.isInteger(tree.slot) || tree.slot < 0 || tree.slot >= 8)) throw new InboxError("invalid_response", "The shared orchard could not be loaded. Please try again.");
    return data;
  }
  async function removeTree(id) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(String(id))) throw new InboxError("validation", "Invalid tree ID.");
    const result = await farmRequest("/api/farm/trees/" + encodeURIComponent(id), { method: "DELETE", body: "{}" });
    if (!result || result.ok !== true || result.deleted !== true) throw new InboxError("invalid_response", "The removal could not be confirmed. Refresh the orchard before trying again.");
    return result;
  }

  async function getContent() {
    requireFarmService();
    const data = await authedRequest("/api/host/site-content");
    if (!data || data.ok !== true || !Number.isSafeInteger(data.revision) || data.revision < 0 || !data.content || Array.isArray(data.content) || typeof data.content !== "object") throw new InboxError("invalid_response", "Website content could not be loaded.");
    return data;
  }
  async function saveContent(revision, content) {
    requireFarmService();
    const data = await authedRequest("/api/host/site-content", { method: "PUT", body: JSON.stringify({ revision, content }) });
    if (!data || data.ok !== true || data.revision !== revision + 1 || !data.content || Array.isArray(data.content) || typeof data.content !== "object" || typeof data.updatedAt !== "string" || Number.isNaN(new Date(data.updatedAt).getTime())) throw new InboxError("invalid_response", "Publication could not be confirmed. Reload to check the published version before retrying.");
    return data;
  }
  async function uploadImage(blob) {
    requireFarmService();
    const types = ["image/jpeg", "image/png", "image/webp"];
    if (!(blob instanceof Blob) || !types.includes(blob.type) || blob.size < 1 || blob.size > 1048576) throw new InboxError("media_invalid", "Please crop an image smaller than 1 MB before uploading.");
    const data = await authedRequest("/api/host/media", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!data || data.ok !== true || !uuid.test(String(data.id)) || data.url !== base + "/api/media/" + data.id || !types.includes(data.mime) || !Number.isInteger(data.bytes) || data.bytes < 1 || data.bytes > 1048576 || ![data.width, data.height].every(value => Number.isInteger(value) && value > 0 && value <= 2048)) throw new InboxError("invalid_response", "The image upload could not be confirmed. Your current image has not changed.");
    return data.url;
  }
  async function updateMessage(id, changes) {
    requireFarmService();
    if (!/^[1-9]\d*$/.test(String(id))) throw new InboxError("validation", "Invalid letter ID.");
    const data = await authedRequest("/api/host/messages/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(changes) });
    if (!Array.isArray(data) || data.length !== 1) throw new InboxError("invalid_response", "This letter could not be updated.");
    return data[0];
  }
  async function removeResident(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id))) throw new InboxError("validation", "Invalid resident ID.");
    const data = await farmRequest("/api/host/farm/residents/" + encodeURIComponent(id), { method: "DELETE", body: "{}" });
    if (!data || data.ok !== true || data.deleted !== true) throw new InboxError("invalid_response", "Resident removal could not be confirmed. Refresh to check the farm.");
    return data;
  }

  const api = window.HostInbox = Object.freeze({
    configured: Boolean(base) && !localPreview, localPreview, mode, setupKind, configurationError, signIn, restore, signOut, list, markRead,
    farmAvailable: mode === "cloudflare", listAdoptions, reviewAdoption, listOrchard, removeTree,
    getContent, saveContent, uploadImage, updateMessage, removeResident, listResidents, updateResident,
    get identity() { return session && session.user; },
    get signedIn() { return Boolean(session); }
  });

  if (!window.document || !document.getElementById("loginForm")) return;
  const $ = (id) => document.getElementById(id);
  const rows = new Map();
  const letterDrafts = new Map();
  const savingLetters = new Set();
  let filter = "all";
  let polling = null;
  let loading = false;
  let notifications = false;
  let knownIds = new Set();
  let firstLoad = true;
  let offset = 0;
  let viewVersion = 0;
  const adoptions = new Map(), orchard = new Map();
  const reviewing = new Set(), removing = new Set();
  let adoptionLoading = null, orchardLoading = null;
  let adoptionMutationVersion = 0, orchardMutationVersion = 0;
  let adoptionState = "pending";

  function status(message, error = false) { $("inboxStatus").textContent = message; $("inboxStatus").classList.toggle("is-error", error); }
  function signedOutView(explicit = false) {
    viewVersion += 1;
    clearInterval(polling);
    polling = null;
    rows.clear();
    letterDrafts.clear();
    savingLetters.clear();
    adoptions.clear(); orchard.clear(); reviewing.clear(); removing.clear();
    adoptionLoading = null; orchardLoading = null;
    knownIds.clear();
    firstLoad = true;
    offset = 0;
    $("messageList").replaceChildren();
    $("adoptionList").replaceChildren(); $("orchardList").replaceChildren();
    $("adoptionStatus").textContent = ""; $("orchardStatus").textContent = "";
    adoptionState = "pending"; if ($("adoptionFilter")) $("adoptionFilter").value = "pending";
    $("refreshAdoptionsButton").disabled = false; $("refreshOrchardButton").disabled = false;
    $("farmReviewPanel").hidden = true; $("orchardReviewPanel").hidden = true;
    $("hostIdentity").textContent = "";
    $("inboxPanel").hidden = true;
    $("loginPanel").hidden = !api.configured;
    notifications = false;
    $("notifyButton").textContent = "Enable notifications";
    document.body.classList.remove("owner-signed-in");
    window.dispatchEvent(new CustomEvent("host-session-change", { detail: { signedIn: false, explicit } }));
  }

  function signedInView() {
    viewVersion += 1;
    $("loginPanel").hidden = true;
    $("inboxPanel").hidden = false;
    $("farmReviewPanel").hidden = !api.farmAvailable; $("orchardReviewPanel").hidden = !api.farmAvailable;
    $("hostIdentity").textContent = api.identity && api.identity.email || "Harbor keeper";
    clearInterval(polling);
    polling = setInterval(() => refreshAll(false), 20000);
    document.body.classList.add("owner-signed-in");
    window.dispatchEvent(new CustomEvent("host-session-change", { detail: { signedIn: true } }));
  }

  function render() {
    const active = document.activeElement;
    const editing = active && active.dataset && active.dataset.letterId;
    const editingField = editing && active.dataset.handlingField;
    const selection = editing && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;
    const all = Array.from(rows.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
    const visible = filter === "unread" ? all.filter((row) => !row.read_at) : filter === "all" ? all : all.filter(row => (row.status || "new") === filter);
    $("messageCount").textContent = all.length + " loaded · " + all.filter((row) => !row.read_at).length + " unread";
    $("emptyInbox").hidden = visible.length !== 0;
    $("emptyInbox").textContent = filter === "unread" ? "All loaded letters have been read." : "The sea is quiet. No letters yet.";
    const fragment = document.createDocumentFragment();
    for (const row of visible) {
      const item = document.createElement("li");
      item.className = "message-card" + (row.read_at ? "" : " is-unread");
      const meta = document.createElement("div"); meta.className = "message-meta";
      const author = document.createElement("span"); author.className = "message-author"; author.textContent = row.name || "A stranger";
      if (!row.read_at) { const unread = document.createElement("span"); unread.className = "unread-label"; unread.textContent = "Unread"; author.append(unread); }
      const time = document.createElement("time"); time.dateTime = row.created_at || "";
      const date = new Date(row.created_at); time.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      meta.append(author, time);
      const text = document.createElement("p"); text.className = "message-text"; text.textContent = row.text || "";
      const contact = document.createElement("p"); contact.className = "message-contact"; contact.textContent = "Reply to: " + (row.contact || "No contact details shared");
      item.append(meta, text, contact);
      if (api.mode === "cloudflare") {
        const management = document.createElement("div"); management.className = "letter-management";
        const label = document.createElement("label"); label.textContent = "Status";
        const select = document.createElement("select"); select.setAttribute("aria-label", "Status for letter from " + (row.name || "a stranger"));
        for (const [value, caption] of [["new", "To handle"], ["done", "Handled"], ["archived", "Archived"]]) { const option = document.createElement("option"); option.value = value; option.textContent = caption; select.append(option); }
        const handlingDraft = letterDrafts.get(String(row.id));
        select.value = handlingDraft ? handlingDraft.status : row.status || "new"; label.append(select);
        const noteLabel = document.createElement("label"); noteLabel.textContent = "Private note";
        const note = document.createElement("textarea"); note.rows = 2; note.maxLength = 2000; note.value = handlingDraft ? handlingDraft.host_note : row.host_note || ""; note.setAttribute("aria-label", "Private note for letter from " + (row.name || "a stranger")); noteLabel.append(note);
        select.dataset.letterId = String(row.id); select.dataset.handlingField = "status";
        note.dataset.letterId = String(row.id); note.dataset.handlingField = "host_note";
        const retainDraft = () => letterDrafts.set(String(row.id), { status: select.value, host_note: note.value });
        select.addEventListener("change", retainDraft); note.addEventListener("input", retainDraft);
        const save = document.createElement("button"); save.type = "button"; save.textContent = "Save handling";
        select.disabled = note.disabled = save.disabled = savingLetters.has(String(row.id));
        save.addEventListener("click", async () => {
          if (savingLetters.has(String(row.id))) return;
          savingLetters.add(String(row.id)); select.disabled = note.disabled = save.disabled = true;
          const version = viewVersion, submitted = { status: select.value, host_note: note.value };
          try { const updated = await api.updateMessage(row.id, submitted); if (version !== viewVersion) return; letterDrafts.delete(String(row.id)); rows.set(String(row.id), updated); status("Letter handling saved. Your note stays private."); }
          catch (error) { if (version === viewVersion) handleError(error); }
          finally { if (version === viewVersion) { savingLetters.delete(String(row.id)); render(); } }
        });
        management.append(label, noteLabel, save); item.append(management);
      }
      if (!row.read_at) {
        const read = document.createElement("button"); read.type = "button"; read.className = "read-button"; read.textContent = "Mark as read";
        read.addEventListener("click", async () => {
          read.disabled = true;
          const version = viewVersion;
          try { const updated = await api.markRead(row.id); if (version !== viewVersion) return; rows.set(String(row.id), updated); render(); status("Marked as read."); }
          catch (error) { if (version !== viewVersion) return; handleError(error); read.disabled = false; }
        });
        item.append(read);
      }
      fragment.append(item);
    }
    $("messageList").replaceChildren(fragment);
    if (editing) {
      const restored = Array.from($("messageList").querySelectorAll("[data-letter-id]")).find(el => el.dataset.letterId === editing && el.dataset.handlingField === editingField);
      if (restored) { restored.focus({ preventScroll: true }); if (selection && restored.setSelectionRange) restored.setSelectionRange(...selection); }
    }
  }

  function handleError(error) {
    if (error.code === "auth_expired" || error.code === "forbidden") { api.signOut(); signedOutView(); }
    status(error.message || "Letters could not be loaded. Please try again.", true);
  }

  function farmStatus(id, message, error = false) {
    $(id).textContent = message; $(id).classList.toggle("is-error", error);
  }
  function farmError(error, id) {
    if (error.code === "auth_expired" || error.code === "forbidden") { handleError(error); return; }
    farmStatus(id, error.message || "The farm could not be loaded. Please try again.", true);
  }
  function farmElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function renderAdoptions() {
    const fragment = document.createDocumentFragment();
    $("emptyAdoptions").hidden = adoptions.size !== 0;
    $("emptyAdoptions").textContent = adoptionState === "pending" ? "No adoption requests are waiting." : adoptionState === "approved" ? "No approved visitor animals yet." : "No declined or removed requests.";
    for (const row of adoptions.values()) {
      const id = String(row.id), item = farmElement("li", "farm-review-card");
      item.append(farmElement("h4", "", row.name + " · " + farmSpecies[row.species]));
      const date = new Date(row.created_at);
      const when = Number.isNaN(date.getTime()) ? "" : " · " + date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      item.append(farmElement("p", "farm-review-meta", "Requested by " + (row.adoptedBy || "a visitor") + when));
      if (row.note) item.append(farmElement("p", "farm-review-text", row.note));
      const actions = farmElement("div", "farm-review-actions");
      if (row.status === "approved") {
        const manage = farmElement("button", "", "Manage animal"); manage.type = "button";
        manage.setAttribute("aria-label", "Manage animal " + row.name);
        manage.addEventListener("click", () => window.dispatchEvent(new CustomEvent("host-manage-residents", { detail: { id: row.id } })));
        actions.append(manage);
      }
      for (const [decision, label] of row.status === "pending" ? [["approved", "Approve"], ["rejected", "Decline"]] : []) {
        const button = farmElement("button", decision === "approved" ? "approve-button" : "", label);
        button.type = "button"; button.disabled = reviewing.has(id);
        button.setAttribute("aria-label", label + " " + row.name);
        button.addEventListener("click", async () => {
          if (reviewing.has(id) || !adoptions.has(id) || !api.signedIn) return;
          reviewing.add(id); adoptionMutationVersion += 1;
          const version = viewVersion;
          actions.querySelectorAll("button").forEach(action => { action.disabled = true; });
          farmStatus("adoptionStatus", decision === "approved" ? "Approving the adoption…" : "Declining the request…");
          try {
            await api.reviewAdoption(row.id, decision);
            if (version !== viewVersion) return;
            adoptions.delete(id); renderAdoptions();
            if (decision === "approved") window.dispatchEvent(new CustomEvent("host-residents-changed"));
            farmStatus("adoptionStatus", decision === "approved" ? row.name + " has joined the shared farm." : "The adoption request was declined.");
            $("refreshAdoptionsButton").focus({ preventScroll: true });
          } catch (error) {
            if (version !== viewVersion) return;
            farmError(error, "adoptionStatus");
            if (error.code === "adoption_reviewed" || error.code === "resident_not_found") { reviewing.delete(id); await loadAdoptions(); }
          } finally {
            if (version === viewVersion) { reviewing.delete(id); actions.querySelectorAll("button").forEach(action => { action.disabled = false; }); }
          }
        });
        actions.append(button);
      }
      item.append(actions); fragment.append(item);
    }
    $("adoptionList").replaceChildren(fragment);
  }
  async function loadAdoptions(manual = false) {
    if (!api.farmAvailable || !api.signedIn || adoptionLoading || reviewing.size) return;
    const operation = { version: viewVersion, mutation: adoptionMutationVersion };
    adoptionLoading = operation; $("refreshAdoptionsButton").disabled = true;
    if (manual || !adoptions.size) farmStatus("adoptionStatus", "Checking adoption requests…");
    try {
      const pending = await api.listAdoptions({ status: adoptionState });
      if (operation.version !== viewVersion || operation.mutation !== adoptionMutationVersion) return;
      adoptions.clear(); pending.forEach(row => adoptions.set(String(row.id), row)); renderAdoptions();
      farmStatus("adoptionStatus", pending.length + (adoptionState === "pending" ? " waiting for review." : adoptionState === "approved" ? " approved visitor residents." : " declined or removed requests."));
    } catch (error) { if (operation.version === viewVersion && operation.mutation === adoptionMutationVersion) farmError(error, "adoptionStatus"); }
    finally { if (adoptionLoading === operation) { adoptionLoading = null; $("refreshAdoptionsButton").disabled = false; } }
  }
  function renderOrchard() {
    const fragment = document.createDocumentFragment();
    $("emptyOrchard").hidden = orchard.size !== 0;
    const trees = Array.from(orchard.values()).sort((a, b) => a.slot - b.slot);
    for (const tree of trees) {
      const id = String(tree.id), item = farmElement("li", "farm-review-card");
      const name = orchardTypes[tree.type] + (["kiwi", "grape"].includes(tree.type) ? "" : " tree");
      item.append(farmElement("h4", "", name));
      item.append(farmElement("p", "farm-review-meta", "Orchard space " + (tree.slot + 1)));
      const warning = farmElement("p", "farm-review-warning", "This removes the tree for all visitors."); warning.hidden = true;
      const actions = farmElement("div", "farm-review-actions");
      const remove = farmElement("button", "", "Remove tree"), cancel = farmElement("button", "", "Cancel");
      remove.type = cancel.type = "button"; remove.disabled = removing.has(id); cancel.hidden = true;
      remove.setAttribute("aria-label", "Remove " + name + " in space " + (tree.slot + 1));
      let confirmed = false;
      cancel.addEventListener("click", () => { confirmed = false; remove.textContent = "Remove tree"; cancel.hidden = true; warning.hidden = true; remove.focus({ preventScroll: true }); });
      remove.addEventListener("click", async () => {
        if (removing.has(id) || !orchard.has(id) || !api.signedIn) return;
        if (!confirmed) { confirmed = true; remove.textContent = "Confirm removal"; cancel.hidden = false; warning.hidden = false; return; }
        removing.add(id); orchardMutationVersion += 1;
        const version = viewVersion; remove.disabled = cancel.disabled = true;
        farmStatus("orchardStatus", "Removing the tree…");
        try {
          await api.removeTree(tree.id);
          if (version !== viewVersion) return;
          orchard.delete(id); renderOrchard(); farmStatus("orchardStatus", "Tree removed. " + orchard.size + " of 8 orchard spaces used.");
          $("refreshOrchardButton").focus({ preventScroll: true });
        } catch (error) {
          if (version !== viewVersion) return;
          farmError(error, "orchardStatus");
          if (error.code === "tree_not_found") { removing.delete(id); await loadOrchard(); }
        } finally { if (version === viewVersion) { removing.delete(id); remove.disabled = cancel.disabled = false; } }
      });
      actions.append(remove, cancel); item.append(warning, actions); fragment.append(item);
    }
    $("orchardList").replaceChildren(fragment);
  }
  async function loadOrchard(manual = false) {
    if (!api.farmAvailable || !api.signedIn || orchardLoading || removing.size) return;
    const operation = { version: viewVersion, mutation: orchardMutationVersion };
    orchardLoading = operation; $("refreshOrchardButton").disabled = true;
    if (manual || !orchard.size) farmStatus("orchardStatus", "Checking the shared orchard…");
    try {
      const data = await api.listOrchard();
      if (operation.version !== viewVersion || operation.mutation !== orchardMutationVersion) return;
      orchard.clear(); data.trees.forEach(tree => orchard.set(String(tree.id), tree)); renderOrchard();
      farmStatus("orchardStatus", data.trees.length + " of " + data.maxTrees + " orchard spaces used.");
    } catch (error) { if (operation.version === viewVersion && operation.mutation === orchardMutationVersion) farmError(error, "orchardStatus"); }
    finally { if (orchardLoading === operation) { orchardLoading = null; $("refreshOrchardButton").disabled = false; } }
  }
  function refreshAll(manual = false) { return Promise.allSettled([load(manual), loadAdoptions(manual), loadOrchard(manual)]); }

  async function load(manual = false, more = false) {
    if (loading || !api.signedIn) return;
    loading = true;
    const version = viewVersion;
    $("refreshButton").disabled = true;
    $("loadMoreButton").disabled = true;
    if (manual) status("Checking the shore…");
    try {
      const letters = await api.list({ offset: more ? offset : 0 });
      if (version !== viewVersion) return;
      const newLetters = letters.filter((row) => !knownIds.has(String(row.id)) && !row.read_at);
      for (const row of letters) { rows.set(String(row.id), row); knownIds.add(String(row.id)); }
      if (more) offset += letters.length;
      else offset = Math.max(offset, letters.length);
      if (more || firstLoad) $("loadMoreButton").hidden = letters.length < 100;
      if (!firstLoad && !more && newLetters.length && notifications && window.Notification && Notification.permission === "granted") {
        // Notification content avoids exposing a private letter on the lock screen.
        try { const note = new Notification("New letters ashore", { body: newLetters.length + (newLetters.length === 1 ? " new letter has reached the shore." : " new letters have reached the shore."), tag: "message-bottle-inbox" }); note.onclick = () => { window.focus(); note.close(); }; } catch (_) { status("New letters have arrived, but this browser could not show a notification.", true); }
      }
      firstLoad = false;
      render();
      status("Last checked: " + new Date().toLocaleTimeString("en-GB"));
    } catch (error) { if (version === viewVersion) handleError(error); }
    finally { loading = false; $("refreshButton").disabled = false; $("loadMoreButton").disabled = false; }
  }

  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("loginButton").disabled = true;
    status("Opening the inbox…");
    try {
      await api.signIn($("hostEmail").value, $("hostPassword").value);
      $("hostPassword").value = "";
      signedInView();
      await refreshAll(true);
    } catch (error) { status(error.message, true); }
    finally { $("loginButton").disabled = false; }
  });
  $("logoutButton").addEventListener("click", async () => {
    signedOutView(true);
    status("Signing out…");
    const result = await api.signOut();
    status(result.remoteRevoked ? "Signed out." : "Signed out on this page. The remote session could not be revoked because the connection was interrupted.", !result.remoteRevoked);
  });
  $("refreshButton").addEventListener("click", () => refreshAll(true));
  $("refreshAdoptionsButton").addEventListener("click", () => loadAdoptions(true));
  $("refreshOrchardButton").addEventListener("click", () => loadOrchard(true));
  $("loadMoreButton").addEventListener("click", () => load(true, true));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    render();
  }));
  $("notifyButton").addEventListener("click", async () => {
    if (!("Notification" in window) || !window.isSecureContext) { status("Desktop notifications are unavailable. Open the inbox in a desktop browser over HTTPS.", true); return; }
    if (notifications) { notifications = false; $("notifyButton").textContent = "Enable notifications"; status("Desktop notifications are off for this page."); return; }
    try {
      const permission = await Notification.requestPermission();
      notifications = permission === "granted";
      $("notifyButton").textContent = notifications ? "Disable notifications" : "Enable notifications";
      status(notifications ? "Notifications are on while this page is open. They stop when the page closes." : "Notifications were not allowed. You can still read new letters here.", !notifications);
    } catch (_) { status("Notifications could not be enabled. Check your browser settings.", true); }
  });
  if ($("adoptionFilter")) $("adoptionFilter").addEventListener("change", () => {
    adoptionState = $("adoptionFilter").value; adoptionMutationVersion += 1; adoptionLoading = null;
    adoptions.clear(); renderAdoptions(); loadAdoptions(true);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && api.signedIn) refreshAll(); });
  if (window.addEventListener) window.addEventListener("beforeunload", event => { if (letterDrafts.size && api.signedIn) { event.preventDefault(); event.returnValue = ""; } });
  if (window.addEventListener) window.addEventListener("host-auth-expired", () => handleError(new InboxError("auth_expired", "Your session expired. Sign in again to continue. Your unpublished website draft is kept on this page.")));

  (async () => {
    if (api.localPreview) {
      $("loginPanel").hidden = true;
      $("setupPanel").hidden = true;
      $("loginButton").disabled = true;
      $("hostEmail").disabled = $("hostPassword").disabled = true;
      if ($("localWorkspacePanel")) $("localWorkspacePanel").hidden = false;
      else status(localPreviewMessage, true);
      return;
    }
    if (!api.configured) {
      $("setupPanel").hidden = false;
      $("setupReason").textContent = api.configurationError;
      $("setupCloudflare").hidden = api.setupKind !== "cloudflare";
      $("setupSupabase").hidden = api.setupKind !== "supabase";
      return;
    }
    if (api.mode === "cloudflare") $("pollingNote").textContent = "Checks for new letters every 20 seconds while open. Desktop alerts require permission; configured Telegram alerts continue when this page closes.";
    $("loginPanel").hidden = false;
    try { if (await api.restore()) { signedInView(); await refreshAll(true); } }
    catch (error) { handleError(error); }
  })();
})();
