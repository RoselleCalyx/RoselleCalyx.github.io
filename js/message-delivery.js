/* Private bottle delivery. A successful result always means the configured
   service accepted the letter. No mailto fallback or browser-only inbox. */
(function () {
  "use strict";

  const site = window.SITE || {};
  const db = site.supabase || {};
  const timeoutMs = 12000;

  function endpoint(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value).trim());
      if (url.protocol !== "https:" && !(url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname))) return "";
      if (url.username || url.password || url.hash || url.search) return "";
      return url.href.replace(/\/$/, "");
    } catch (_) { return ""; }
  }

  function publicKey(value) {
    const key = String(value || "").trim();
    if (/^sb_publishable_/.test(key)) return key;
    // Legacy anon JWTs remain supported; a service_role JWT is never accepted.
    try {
      const payload = key.split(".")[1];
      if (!payload) return "";
      const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      return claims.role === "anon" ? key : "";
    } catch (_) { return ""; }
  }

  const dbRequested = Boolean(db.url || db.anonKey);
  const apiRequested = Boolean(site.messageApi);
  const api = endpoint(site.messageApi);
  const base = endpoint(db.url);
  const key = publicKey(db.anonKey);
  const form = endpoint(site.formEndpoint);
  const dbEnabled = Boolean(base && key);
  const mode = apiRequested ? (api ? "cloudflare" : "none") : dbEnabled ? "supabase" : (!dbRequested && form ? "form" : "none");
  const configurationError = apiRequested && !api ? "The private message service URL is invalid."
    : dbRequested && !dbEnabled
    ? "The private inbox is not configured correctly. Please contact the host or use the email option."
    : (site.formEndpoint && !form ? "The message endpoint is not configured correctly." : "");

  async function request(url, options, readJson = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, Object.assign({}, options, { signal: controller.signal, credentials: "omit" }));
      return readJson ? { response, data: response.ok ? await response.json() : null } : response;
    } finally { clearTimeout(timer); }
  }

  function failure(code, message) { return { ok: false, code, message }; }

  async function submit(input) {
    const text = String(input && input.text || "").trim();
    const name = String(input && input.name || "").trim();
    const contact = String(input && input.contact || "").trim();
    if (text.length < 2 || text.length > 500 || name.length > 60 || contact.length > 120) {
      return failure("validation", "Please write 2–500 characters. Name and contact must fit their limits.");
    }
    if (mode === "none") {
      return failure("not_configured", configurationError || "The private inbox has not been connected yet. You can still choose to write an email.");
    }
    const row = { name: name || null, contact: contact || null, text };
    try {
      let response;
      if (mode === "cloudflare") {
        const accepted = await request(api + "/api/messages", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(Object.assign({}, row, {
            submissionId: input.submissionId || crypto.randomUUID(),
            website: String(input.website || ""),
            turnstileToken: String(input.turnstileToken || "")
          }))
        }, true);
        response = accepted.response;
        if (response.ok && (!accepted.data || accepted.data.ok !== true || accepted.data.id == null)) {
          return failure("invalid_response", "The shore could not confirm that your letter was saved.");
        }
      } else if (mode === "supabase") {
        const headers = { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" };
        if (!key.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + key;
        response = await request(base + "/rest/v1/bottles", { method: "POST", headers, body: JSON.stringify(row) });
      } else {
        response = await request(form, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: row.name, contact: row.contact, message: text, _subject: "A message in a bottle" })
        });
      }
      if (!response.ok) {
        return failure("delivery_failed", response.status === 429
          ? "The shore is receiving too many letters. Please wait a little and try again."
          : "Your message could not be delivered. Your words are still here; please try again.");
      }
      return { ok: true, code: "delivered", transport: mode, message: "Your message reached the host’s private inbox." };
    } catch (error) {
      return failure(error && error.name === "AbortError" ? "timeout" : "network_error",
        "The sea could not carry your message just now. Your words are still here; please try again.");
    }
  }

  window.MessageDelivery = Object.freeze({ enabled: mode !== "none", mode, configurationError, submit });
})();
