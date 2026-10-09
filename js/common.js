/* =====================================================================
   Shared page chrome and small utilities (window.Site).
   ===================================================================== */
(function () {
  const S = window.SITE || {};
  const PAGES = [
    ["home", "index.html", "Home"],
    ["papers", "papers.html", "Papers"],
    ["gallery", "gallery.html", "Gallery"],
    ["message", "message.html", "Message"],
    ["starmap", "starmap.html", "Starmap"],
    ["voyager", "voyager.html", "Voyager"],
    ["farm", "farm.html", "Farm"]
  ];

  const sv = (body, extra = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
  const ICON = {
    star4: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1c.5 6.4 4.6 10.5 11 11-6.4.5-10.5 4.6-11 11-.5-6.4-4.6-10.5-11-11 6.4-.5 10.5-4.6 11-11z"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 2.5a9.5 9.5 0 1 0 6 16.9A8 8 0 0 1 15.5 2.5z"/></svg>`,
    scholarF: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 1 9l11 6 9-4.9V17h2V9z"/><path fill="currentColor" d="M5 13.2v3.6C6.8 18.9 9.2 20 12 20s5.2-1.1 7-3.2v-3.6L12 17z"/></svg>`,
    linkedinF: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2zM8 19H5V9.5h3zM6.5 8.2a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5zM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.8 13 12.8 14.3V19h-3V9.5h2.8v1.3h.1a3.1 3.1 0 0 1 2.8-1.5c3 0 3.5 2 3.5 4.5z"/></svg>`,
    githubF: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .6a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.2-1.3-5.2-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.1v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .6z"/></svg>`,
    pin: sv('<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>'),
    menu: sv('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    left: sv('<path d="M15 5l-7 7 7 7"/>'),
    right: sv('<path d="M9 5l7 7-7 7"/>'),
    scholar: sv('<path d="M2 9.5 12 4l10 5.5-10 5.5z"/><path d="M6 11.7V16c1.6 1.6 3.6 2.4 6 2.4s4.4-.8 6-2.4v-4.3"/><path d="M21 10v5"/>'),
    linkedin: sv('<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7.5 10.5V17M7.5 7.3v.1M11.5 17v-6.5M11.5 13.2c0-1.6 1.1-2.8 2.6-2.8s2.4 1 2.4 2.8V17"/>'),
    github: sv('<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
    mail: sv('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
    cv: sv('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2"/>'),
    pdf: sv('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    code: sv('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
    globe: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
    data: sv('<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>'),
    quote: sv('<path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6"/>'),
    search: sv('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    book: sv('<path d="M4 5.5C6.5 4.3 9.2 4.3 12 6c2.8-1.7 5.5-1.7 8-.5V19c-2.5-1.2-5.2-1.2-8 .5-2.8-1.7-5.5-1.7-8-.5z"/><path d="M12 6v13.5"/>'),
    draft: sv('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 16l1-3 5-5 2 2-5 5z"/>'),
    flask: sv('<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>'),
    layers: sv('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
    starO: sv('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    starF: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`,
    bottle: sv('<path d="M10 2h4M10.5 2v4.5L8 10v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10l-2.5-3.5V2"/><path d="M8 14h8"/>'),
    map: sv('<path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>'),
    image: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>'),
    constel: sv('<circle cx="5" cy="17" r="1.3"/><circle cx="10" cy="9" r="1.3"/><circle cx="16" cy="12" r="1.3"/><circle cx="19" cy="5" r="1.3"/><path d="m6 16 3.3-6m1.9-.3 3.6 2.4m2-1.2 1.6-5"/>'),
    planet: sv('<circle cx="12" cy="12" r="5"/><path d="M4.5 15.5C2 18 1.6 20 3 20.6c2.1.9 7.6-1.7 12.3-5.8S22 6.6 21.2 4.6c-.5-1.2-2.4-.9-5 .6"/>'),
    galaxy: sv('<path d="M12 12c0-2.2 1.8-3.6 3.8-3.2 2.6.5 3.6 3.6 2.2 6-1.8 3-6.4 3.7-9.3 1.4-3.4-2.6-3.3-8-.2-10.8 3.4-3.2 9.4-2.7 12 1.1"/><path d="M12 12c0 2.2-1.8 3.6-3.8 3.2"/>'),
    heart: sv('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
    paw: sv('<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12.5 11.5c2.5 0 5 3.5 5 5.6 0 1.6-1.2 2.4-2.6 2.4-1.2 0-1.6-.6-2.4-.6s-1.2.6-2.4.6c-1.4 0-2.6-.8-2.6-2.4 0-2.1 2.5-5.6 5-5.6z"/>'),
    sprout: sv('<path d="M12 21v-9M12 12c0-3.5-2.6-6-6.5-6 0 3.8 2.6 6 6.5 6zM12 14c0-3.3 2.4-5.5 6-5.5 0 3.4-2.4 5.5-6 5.5z"/>'),
    basket: sv('<path d="M3 10h18l-2 9.5a1.5 1.5 0 0 1-1.5 1.2h-11A1.5 1.5 0 0 1 5 19.5zM7.5 10 11 4M16.5 10 13 4M9 14v3M12 14v3M15 14v3"/>'),
    send: sv('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>'),
    dice: sv('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r=".9" fill="currentColor"/><circle cx="15" cy="15" r=".9" fill="currentColor"/><circle cx="15" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="15" r=".9" fill="currentColor"/>'),
    target: sv('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
    reset: sv('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    minus: sv('<path d="M5 12h14"/>'),
    copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    drop: sv('<path d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>')
  };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- header ---------- */
  const page = document.body.dataset.page;
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <a class="brand" href="index.html">${ICON.star4}<span>${esc(S.brand || S.name || "")}</span></a>
      <div class="header-right">
        <nav class="nav" id="nav" aria-label="Main">${PAGES.map(([id, href, label]) =>
          `<a href="${href}"${id === page ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
        <button class="icon-btn sky-toggle calm-toggle" id="calmToggle" type="button" aria-pressed="false" aria-label="Calm sky: less motion">${ICON.moon}<span class="tip"></span></button>
        <button class="icon-btn sky-toggle" id="skyToggle" type="button" aria-label="Change how the sky is painted">${ICON.star4}<span class="tip"></span></button>
        <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false">${ICON.menu}</button>
      </div>`;
    const nav = header.querySelector("#nav"), menuBtn = header.querySelector("#menuBtn");
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open);
      menuBtn.innerHTML = open ? ICON.close : ICON.menu;
    });
    const toggle = header.querySelector("#skyToggle"), tip = toggle.querySelector(".tip");
    const label = () => {
      if (!window.Sky) return;
      const next = Sky.STYLES[(Sky.STYLES.indexOf(Sky.style) + 1) % Sky.STYLES.length];
      tip.textContent = `${Sky.LABELS[Sky.style]} · tap for ${Sky.LABELS[next].replace(" sky", "")}`;
    };
    toggle.addEventListener("click", () => {
      if (!window.Sky) return;
      Sky.cycle(); label();
      toggle.classList.add("show-tip");
      clearTimeout(toggle._t);
      toggle._t = setTimeout(() => toggle.classList.remove("show-tip"), 1800);
    });
    label();
    const calmBtn = header.querySelector("#calmToggle"), calmTip = calmBtn.querySelector(".tip");
    const calmLabel = () => {
      const on = !!(window.Sky && Sky.calm);
      calmBtn.setAttribute("aria-pressed", on);
      calmBtn.classList.toggle("on", on);
      calmTip.textContent = on ? "Calm sky · tap to let the stars fall" : "Moving sky · tap for a calm sky";
    };
    calmBtn.addEventListener("click", () => {
      if (!window.Sky) return;
      Sky.setCalm(!Sky.calm); calmLabel();
      calmBtn.classList.add("show-tip");
      clearTimeout(calmBtn._t);
      calmBtn._t = setTimeout(() => calmBtn.classList.remove("show-tip"), 1800);
    });
    calmLabel();
    const onScroll = () => header.classList.toggle("scrolled", scrollY > 12);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- footer ---------- */
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `© ${new Date().getFullYear()} ${esc(S.name || "")}<span class="dot">✦</span>Same sky, different places.`;
  }

  /* ---------- links from config ---------- */
  document.querySelectorAll("[data-link]").forEach((a) => {
    const key = a.dataset.link;
    const href = key === "email" ? (S.email ? "mailto:" + S.email : "") : (S.links || {})[key];
    if (href) a.href = href; else a.remove();
  });
  document.querySelectorAll("[data-site]").forEach((el) => {
    const v = S[el.dataset.site];
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-icon]").forEach((el) => {
    if (ICON[el.dataset.icon]) el.insertAdjacentHTML("afterbegin", ICON[el.dataset.icon]);
  });

  /* ---------- reveal on scroll ---------- */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }), { threshold: 0.08 })
    : null;
  function reveal(root = document) {
    root.querySelectorAll(".reveal:not(.in)").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
  }
  reveal();

  /* ---------- toast ---------- */
  let toastEl;
  function toast(msg, ms = 2600) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove("show"), ms);
  }

  /* ---------- modal ---------- */
  function modal(html, { onOpen, className = "" } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="modal-card ${className}" role="dialog" aria-modal="true">
      <button class="icon-btn modal-close" type="button" aria-label="Close">${ICON.close}</button>${html}</div>`;
    document.body.appendChild(wrap);
    const prev = document.activeElement;
    const close = () => {
      wrap.classList.remove("open");
      removeEventListener("keydown", onKey);
      setTimeout(() => wrap.remove(), 260);
      if (prev && prev.focus) prev.focus();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector(".modal-close").addEventListener("click", close);
    requestAnimationFrame(() => {
      wrap.classList.add("open");
      const f = wrap.querySelector("input, textarea, button:not(.modal-close)");
      if (f) f.focus({ preventScroll: true });
    });
    const api = { el: wrap, card: wrap.querySelector(".modal-card"), close };
    if (onOpen) onOpen(api);
    return api;
  }

  /* ---------- lightbox ---------- */
  function lightbox(items, index = 0) {
    const el = document.createElement("div");
    el.className = "lightbox";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <button class="icon-btn lb-close" type="button" aria-label="Close">${ICON.close}</button>
      <div class="lb-stage">
        <img alt="">
        ${items.length > 1 ? `<button class="lb-nav prev" type="button" aria-label="Previous">${ICON.left}</button><button class="lb-nav next" type="button" aria-label="Next">${ICON.right}</button>` : ""}
      </div>
      <aside class="lb-side"><h3></h3><div class="lb-meta"></div><div class="lb-text"></div></aside>`;
    document.body.appendChild(el);
    const img = el.querySelector("img");
    let i = index;
    const show = () => {
      const it = items[i];
      Promise.resolve(typeof it.src === "function" ? it.src() : it.src).then((src) => { img.src = src; });
      img.alt = it.title || "";
      el.querySelector("h3").textContent = it.title || "";
      el.querySelector(".lb-meta").textContent = it.meta || "";
      el.querySelector(".lb-text").textContent = it.text || "";
      el.querySelector(".lb-side").style.display = it.title || it.text ? "" : "none";
    };
    const close = () => { el.classList.remove("open"); removeEventListener("keydown", key); setTimeout(() => el.remove(), 300); };
    const go = (d) => { i = (i + d + items.length) % items.length; show(); };
    const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); };
    addEventListener("keydown", key);
    el.querySelector(".lb-close").onclick = close;
    el.addEventListener("click", (e) => { if (e.target === el || e.target.classList.contains("lb-stage")) close(); });
    const p = el.querySelector(".prev"), n = el.querySelector(".next");
    if (p) { p.onclick = () => go(-1); n.onclick = () => go(1); }
    show();
    requestAnimationFrame(() => el.classList.add("open"));
  }

  /* ---------- deliver a letter (bottle / adoption request) ---------- */
  // db: optional { table, row } stored in the shared database (moderated) when configured
  async function send(kind, fields, db) {
    const subject = `[${kind}] from ${fields.name || "a stranger under the same sky"}`;
    if (db && window.Backend && Backend.enabled) {
      try { await Backend.insert(db.table, db.row); return { ok: true, via: "db" }; } catch (e) { /* fall through */ }
    }
    if (S.formEndpoint) {
      try {
        const res = await fetch(S.formEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(Object.assign({ _subject: subject, kind }, fields))
        });
        if (res.ok) return { ok: true, via: "form" };
      } catch (e) { /* fall through to email */ }
    }
    if (!S.email) return { ok: false };
    const body = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `${k}:\n${v}`).join("\n\n");
    location.href = `mailto:${S.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { ok: true, via: "mail" };
  }

  window.Site = { ICON, esc, store, toast, modal, lightbox, send, reveal };
})();
