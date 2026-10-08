/* =====================================================================
   Optional shared data (Supabase REST, no SDK).
   Everything degrades gracefully when SITE.supabase is not configured.
   Tables & policies: see README.md.
   ===================================================================== */
(function () {
  const cfg = (window.SITE || {}).supabase || {};
  const enabled = !!(cfg.url && cfg.anonKey);
  const base = enabled ? cfg.url.replace(/\/$/, "") + "/rest/v1/" : "";
  const headers = enabled ? { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey, "Content-Type": "application/json" } : {};

  async function req(path, opts = {}) {
    if (!enabled) throw new Error("backend disabled");
    const res = await fetch(base + path, Object.assign({ headers }, opts));
    if (!res.ok) throw new Error(res.status + " " + (await res.text()));
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  /* ---------- anti-spam helpers used by the forms ---------- */
  const opened = new WeakMap();
  function guard(form) {
    opened.set(form, Date.now());
    if (!form.querySelector('input[name="website"]')) {
      // honeypot: invisible to people, irresistible to bots
      form.insertAdjacentHTML("beforeend", '<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">');
    }
  }
  function check(form, key, cooldownSec = 60) {
    const hp = form.querySelector('input[name="website"]');
    if (hp && hp.value) return "Thank you!";                         // silently drop bots
    if (Date.now() - (opened.get(form) || 0) < 3500) return "Take a breath — that was very fast.";
    const last = Site.store.get("sent-" + key, 0);
    if (Date.now() - last < cooldownSec * 1000) return "The sea is still carrying your last bottle. Try again in a minute.";
    return "";
  }
  function stamp(key) { Site.store.set("sent-" + key, Date.now()); }

  window.Backend = {
    enabled, guard, check, stamp,
    insert(table, row) {
      return req(table, { method: "POST", headers: Object.assign({ Prefer: "return=minimal" }, headers), body: JSON.stringify(row) });
    },
    select(table, query) { return req(table + "?" + query); },
    rpc(fn, args) { return req("rpc/" + fn, { method: "POST", body: JSON.stringify(args) }); }
  };
})();
