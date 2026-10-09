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
      ? "收信服务地址无效。请在 js/config.js 的 messageApi 填写 HTTPS 服务根地址，不包含查询参数或 #。"
      : (cfg.url || key ? "Supabase 配置不完整或无效。请使用项目 URL 和公开 publishable / anon key。" : "尚未连接收信服务。请先完成下面的部署步骤。" );
  }

  class InboxError extends Error {
    constructor(code, message, status) { super(message); this.name = "InboxError"; this.code = code; this.status = status || 0; }
  }

  function assertSession(version) {
    if (version !== sessionVersion) throw new InboxError("session_changed", "登录会话已变化，此次操作已取消。");
  }

  function saveSession(data) {
    if (!data || !data.access_token || !data.refresh_token) throw new InboxError("invalid_response", "登录服务返回了不完整的会话，请重试。");
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
      if (body) { try { data = JSON.parse(body); } catch (_) { if (response.ok) throw new InboxError("invalid_response", "收信服务返回了无法读取的内容。"); } }
      if (!response.ok) {
        if (response.status === 401) throw new InboxError("auth_expired", "登录已失效，请重新登录。", 401);
        if (response.status === 403) throw new InboxError("forbidden", "此账号没有收件箱权限，请确认使用主人账号。", 403);
        if (response.status === 429) throw new InboxError("rate_limit", "请求过于频繁，请稍后重试。", 429);
        throw new InboxError("http_error", "暂时无法连接收信服务，请检查配置或稍后重试。", response.status);
      }
      return data;
    } catch (error) {
      if (error instanceof InboxError) throw error;
      throw new InboxError(error && error.name === "AbortError" ? "timeout" : "network_error", "连接收信服务超时或中断，请稍后重试。");
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
    if (!session) throw new InboxError("auth_expired", "请先登录。");
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
          throw new InboxError("auth_expired", "登录已失效，请重新登录。");
        }
        throw error;
      } finally { if (version === sessionVersion) refreshPromise = null; }
    })();
    return refreshPromise;
  }

  async function validToken() {
    if (!session) throw new InboxError("auth_expired", "请先登录。");
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
      if (!host || host.id !== "host") throw new InboxError("forbidden", "此账号没有守塔人权限，请确认使用主人账号。");
      return host.id;
    }
    // RLS only exposes the requesting user's own membership. A valid login alone
    // cannot grant host access; membership can only be bootstrapped server-side.
    const rows = await authedRequest("/rest/v1/message_hosts?select=user_id&limit=1");
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].user_id) throw new InboxError("forbidden", "此账号没有守塔人权限，请确认使用主人账号。");
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
      if ([400, 401, 403].includes(error.status)) throw new InboxError("bad_credentials", "邮箱或密码不正确，或账号尚未启用。");
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
    if (!Array.isArray(rows)) throw new InboxError("invalid_response", "无法读取来信列表，请检查数据库配置。");
    return rows;
  }

  async function markRead(id) {
    if (!/^\d+$/.test(String(id))) throw new InboxError("validation", "无效的来信编号。");
    const version = sessionVersion;
    await requireHost();
    assertSession(version);
    const path = mode === "cloudflare" ? "/api/host/messages/" + encodeURIComponent(id) : "/rest/v1/bottles?id=eq." + encodeURIComponent(id);
    const rows = await authedRequest(path, {
      method: "PATCH", headers: mode === "supabase" ? { Prefer: "return=representation" } : {}, body: JSON.stringify({ read_at: new Date().toISOString() })
    });
    assertSession(version);
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].read_at) throw new InboxError("forbidden", "未能标记已读。来信不存在或账号权限已变化。");
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
    $("notifyButton").textContent = "开启桌面通知";
  }

  function signedInView() {
    viewVersion += 1;
    $("loginPanel").hidden = true;
    $("inboxPanel").hidden = false;
    $("hostIdentity").textContent = api.identity && api.identity.email || "守塔人";
    clearInterval(polling);
    polling = setInterval(() => load(false), 20000);
  }

  function render() {
    const all = Array.from(rows.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
    const visible = filter === "unread" ? all.filter((row) => !row.read_at) : all;
    $("messageCount").textContent = "已载入 " + all.length + " 封 · " + all.filter((row) => !row.read_at).length + " 封未读";
    $("emptyInbox").hidden = visible.length !== 0;
    $("emptyInbox").textContent = filter === "unread" ? "已载入的来信都读过了。" : "海面安静。暂时没有来信。";
    const fragment = document.createDocumentFragment();
    for (const row of visible) {
      const item = document.createElement("li");
      item.className = "message-card" + (row.read_at ? "" : " is-unread");
      const meta = document.createElement("div"); meta.className = "message-meta";
      const author = document.createElement("span"); author.className = "message-author"; author.textContent = row.name || "匿名旅人";
      if (!row.read_at) { const unread = document.createElement("span"); unread.className = "unread-label"; unread.textContent = "未读"; author.append(unread); }
      const time = document.createElement("time"); time.dateTime = row.created_at || "";
      const date = new Date(row.created_at); time.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
      meta.append(author, time);
      const text = document.createElement("p"); text.className = "message-text"; text.textContent = row.text || "";
      const contact = document.createElement("p"); contact.className = "message-contact"; contact.textContent = "回复线索：" + (row.contact || "未留下联系方式");
      item.append(meta, text, contact);
      if (!row.read_at) {
        const read = document.createElement("button"); read.type = "button"; read.className = "read-button"; read.textContent = "标记已读";
        read.addEventListener("click", async () => {
          read.disabled = true;
          const version = viewVersion;
          try { const updated = await api.markRead(row.id); if (version !== viewVersion) return; rows.set(String(row.id), updated); render(); status("已标记为已读。"); }
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
    status(error.message || "暂时无法读取来信。", true);
  }

  async function load(manual = false, more = false) {
    if (loading || !api.signedIn) return;
    loading = true;
    const version = viewVersion;
    $("refreshButton").disabled = true;
    $("loadMoreButton").disabled = true;
    if (manual) status("正在查看海面…");
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
        try { const note = new Notification("有新的漂流瓶", { body: newLetters.length + " 封来信漂到了岸边。", tag: "message-bottle-inbox" }); note.onclick = () => { window.focus(); note.close(); }; } catch (_) { status("新信已收到，但此浏览器无法显示桌面通知。", true); }
      }
      firstLoad = false;
      render();
      status("最近检查：" + new Date().toLocaleTimeString("zh-CN"));
    } catch (error) { if (version === viewVersion) handleError(error); }
    finally { loading = false; $("refreshButton").disabled = false; $("loadMoreButton").disabled = false; }
  }

  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("loginButton").disabled = true;
    status("正在打开收件箱…");
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
    status("正在退出…");
    const result = await api.signOut();
    status(result.remoteRevoked ? "已退出。" : "本页登录已清除。网络中断，远端会话未能撤销。", !result.remoteRevoked);
  });
  $("refreshButton").addEventListener("click", () => load(true));
  $("loadMoreButton").addEventListener("click", () => load(true, true));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    render();
  }));
  $("notifyButton").addEventListener("click", async () => {
    if (!("Notification" in window) || !window.isSecureContext) { status("此浏览器不支持桌面通知。请在 HTTPS 桌面浏览器中打开收件箱。", true); return; }
    if (notifications) { notifications = false; $("notifyButton").textContent = "开启桌面通知"; status("已关闭本页桌面通知。"); return; }
    try {
      const permission = await Notification.requestPermission();
      notifications = permission === "granted";
      $("notifyButton").textContent = notifications ? "关闭桌面通知" : "开启桌面通知";
      status(notifications ? "已开启。页面打开时收到新信会通知你；关闭页面后不继续推送。" : "通知未获允许。你仍然可以在这里阅读新信。", !notifications);
    } catch (_) { status("浏览器未能开启通知，请检查浏览器设置。", true); }
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
    if (api.mode === "cloudflare") $("pollingNote").textContent = "页面打开时每 20 秒检查新信。本页桌面通知需要你主动开启；已配置的 Telegram 提醒不受页面关闭影响。";
    $("loginPanel").hidden = false;
    try { if (await api.restore()) { signedInView(); await load(true); } }
    catch (error) { handleError(error); }
  })();
})();
