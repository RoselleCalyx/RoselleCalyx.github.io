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
        throw new InboxError("http_error", "The inbox service is unavailable. Check the configuration or try again shortly.", response.status);
      }
      return data;
    } catch (error) {
      if (error instanceof InboxError) throw error;
      throw new InboxError(error && error.name === "AbortError" ? "timeout" : "network_error", "The inbox connection timed out or was interrupted. Please try again.");
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
    if (!base) return false;
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

  const api = window.HostInbox = Object.freeze({
    configured: Boolean(base), mode, setupKind, configurationError, signIn, restore, signOut, list, markRead,
    get identity() { return session && session.user; },
    get signedIn() { return Boolean(session); }
  });

  if (!window.document || !document.getElementById("loginForm")) return;
  const $ = (id) => document.getElementById(id);
  const rows = new Map();
  let filter = "all";
  let polling = null;
  let loading = false;
  let notifications = false;
  let knownIds = new Set();
  let firstLoad = true;
  let offset = 0;
  let viewVersion = 0;

  function status(message, error = false) { $("inboxStatus").textContent = message; $("inboxStatus").classList.toggle("is-error", error); }
  function signedOutView() {
    viewVersion += 1;
    clearInterval(polling);
    polling = null;
    rows.clear();
    knownIds.clear();
    firstLoad = true;
    offset = 0;
    $("messageList").replaceChildren();
    $("hostIdentity").textContent = "";
    $("inboxPanel").hidden = true;
    $("loginPanel").hidden = !api.configured;
    notifications = false;
    $("notifyButton").textContent = "Enable notifications";
  }

  function signedInView() {
    viewVersion += 1;
    $("loginPanel").hidden = true;
    $("inboxPanel").hidden = false;
    $("hostIdentity").textContent = api.identity && api.identity.email || "Harbor keeper";
    clearInterval(polling);
    polling = setInterval(() => load(false), 20000);
  }

  function render() {
    const all = Array.from(rows.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
    const visible = filter === "unread" ? all.filter((row) => !row.read_at) : all;
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
  }

  function handleError(error) {
    if (error.code === "auth_expired" || error.code === "forbidden") { api.signOut(); signedOutView(); }
    status(error.message || "Letters could not be loaded. Please try again.", true);
  }

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
      await load(true);
    } catch (error) { status(error.message, true); }
    finally { $("loginButton").disabled = false; }
  });
  $("logoutButton").addEventListener("click", async () => {
    signedOutView();
    status("Signing out…");
    const result = await api.signOut();
    status(result.remoteRevoked ? "Signed out." : "Signed out on this page. The remote session could not be revoked because the connection was interrupted.", !result.remoteRevoked);
  });
  $("refreshButton").addEventListener("click", () => load(true));
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
  document.addEventListener("visibilitychange", () => { if (!document.hidden && api.signedIn) load(); });

  (async () => {
    if (!api.configured) {
      $("setupPanel").hidden = false;
      $("setupReason").textContent = api.configurationError;
      $("setupCloudflare").hidden = api.setupKind !== "cloudflare";
      $("setupSupabase").hidden = api.setupKind !== "supabase";
      return;
    }
    if (api.mode === "cloudflare") $("pollingNote").textContent = "Checks for new letters every 20 seconds while open. Desktop alerts require permission; configured Telegram alerts continue when this page closes.";
    $("loginPanel").hidden = false;
    try { if (await api.restore()) { signedInView(); await load(true); } }
    catch (error) { handleError(error); }
  })();
})();
