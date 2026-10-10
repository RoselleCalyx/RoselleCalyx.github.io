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
  let saveWarningShown = false;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) {
        if (/^(farm-|wild-)/.test(k) && !saveWarningShown) {
          saveWarningShown = true;
          toast("Progress could not be saved in this browser. Check browser storage and try again.", 5200);
        }
        return false;
      }
    }
  };

  /* ---------- header ---------- */
  /* ---------- owner-edited public content ---------- */
  const home = window.HOME_CONTENT || {};
  const safeURL = (value) => window.SiteContent ? SiteContent.url(value, { email: true }) : value;
  const node = (tag, text, className) => {
    const el = document.createElement(tag); el.textContent = text || "";
    if (className) el.className = className;
    return el;
  };
  const multiline = (el, value, emphasis = false) => {
    if (!el || typeof value !== "string") return;
    const lines = value.split("\n"); el.replaceChildren();
    lines.forEach((line, i) => {
      if (i) el.append(document.createElement("br"));
      el.append(emphasis && i ? node("em", line) : document.createTextNode(line));
    });
  };
  const setCopy = (selector, key) => {
    const el = document.querySelector(selector);
    if (el && Object.prototype.hasOwnProperty.call(home, key)) multiline(el, home[key]);
  };
  if (document.body.dataset.page === "home") {
    setCopy(".hero-title", "heroTitle"); setCopy(".hero-lede", "heroLede");
    setCopy(".hero-foot em", "heroFoot");
    if (Object.prototype.hasOwnProperty.call(home, "coda")) multiline(document.querySelector(".coda p"), home.coda, true);
    setCopy(".bio-earth > p:last-child", "beyond");
    const avatar = document.querySelector(".bio-portrait img");
    if (avatar) {
      if (Object.prototype.hasOwnProperty.call(home, "avatar")) {
        if (home.avatar) avatar.src = safeURL(home.avatar); else avatar.removeAttribute("src");
      }
      avatar.alt = home.avatarAlt || "Portrait of " + (S.name || "the host");
    }
    for (const [key, selector, tag, className] of [["bio", ".bio-copy", "p", ""], ["interests", ".bio-content .chips", "span", "chip"]]) {
      const el = document.querySelector(selector);
      if (el && Array.isArray(home[key])) el.replaceChildren(...home[key].map(text => node(tag, text, className)));
    }
    const timeline = document.querySelector("#education .timeline");
    if (timeline && Array.isArray(home.education)) timeline.replaceChildren(...home.education.map(item => {
      const li = document.createElement("li");
      li.append(node("div", item.date, "t-date"), node("div", item.title, "t-title"));
      if (item.detail) li.append(node("div", item.detail, "t-sub"));
      return li;
    }));
    const news = document.querySelector("#news .news");
    if (news && Array.isArray(home.news)) news.replaceChildren(...home.news.map(item => {
      const li = document.createElement("li"), body = node("span", item.href ? "" : item.text);
      if (safeURL(item.href)) {
        const link = node("a", item.text); link.href = safeURL(item.href); link.rel = "noopener"; body.append(link);
      }
      li.append(node("time", item.date), body); return li;
    }));
    const explore = document.querySelector(".explore");
    if (explore && Array.isArray(home.explore)) explore.replaceChildren(...home.explore.filter(item => safeURL(item.href)).map(item => {
      const link = document.createElement("a"), icon = document.createElement("span");
      link.className = "glass"; link.href = safeURL(item.href);
      if (ICON[item.icon]) icon.dataset.icon = item.icon;
      link.append(icon, node("b", item.title), node("span", item.text)); return link;
    }));
    for (const [key, selector] of Object.entries({ about: ".bio-content > .kicker", beyond: ".bio-earth .kicker", educationKicker: "#education .kicker", education: "#education .section-title", newsKicker: "#news .kicker", news: "#news .section-title", explore: "#explore > .kicker" })) {
      const target = document.querySelector(selector);
      if (target && typeof home.labels?.[key] === "string") target.textContent = home.labels[key];
    }
    for (const key of ["about", "education", "news", "explore"]) {
      const section = document.getElementById(key);
      if (section && home.visibility?.[key] === false) { section.hidden = true; section.style.display = "none"; }
    }
    const columns = document.querySelector(".home-sections > .two-col");
    if (columns) {
      const visible = [...columns.children].filter(section => !section.hidden).length;
      if (!visible) { columns.hidden = true; columns.style.display = "none"; }
      else if (visible === 1) columns.style.gridTemplateColumns = "1fr";
    }
    const cue = document.querySelector(".scroll-cue");
    if (cue && home.visibility?.about === false) {
      const next = ["education", "news", "explore"].find(key => home.visibility?.[key] !== false);
      if (next) cue.href = "#" + next; else { cue.hidden = true; cue.style.display = "none"; }
    }
    for (const [key, selector] of [["date", "#finale .kicker"], ["title", "#finale h2"], ["text", "#finale > p:last-child"]]) {
      if (typeof home.finale?.[key] === "string") multiline(document.querySelector(selector), home.finale[key]);
    }
    for (const links of document.querySelectorAll(".about-links")) {
      for (const item of S.extraLinks || []) {
        const href = safeURL(item.href); if (!href) continue;
        const link = node("a", "", "btn"); link.append(node("span", item.label));
        link.href = href; link.dataset.extraLink = "";
        link.dataset.icon = Object.hasOwn(ICON, item.icon) ? item.icon : "globe";
        if (/^https?:/i.test(href)) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
        links.append(link);
      }
    }
    document.title = [S.name, S.tagline].filter(Boolean).join(" · ");
  }
  const pageKey = document.body.dataset.wild || document.body.dataset.page;
  const copy = (S.pages || {})[pageKey] || {};
  document.querySelectorAll("[data-page-copy]").forEach(el => {
    const key = el.dataset.pageCopy;
    if (Object.prototype.hasOwnProperty.call(copy, key)) multiline(el, copy[key], el.dataset.pageEmphasis === "true");
  });
  const pageTitle = copy.title || (pageKey === "home" ? "" : document.title.split(" · ")[0]);
  if (pageTitle) document.title = [pageTitle.replaceAll("\n", " "), S.name].filter(Boolean).join(" · ");
  const intro = pageKey === "home" ? (home.heroLede || S.role || "") : (copy.subtitle ?? document.querySelector('[data-page-copy="subtitle"]')?.textContent ?? "");
  const description = copy.description || [S.name, intro.replaceAll("\n", " ")].filter(Boolean).join(". ");
  let descriptionTag = document.querySelector('meta[name="description"]');
  if (!descriptionTag) { descriptionTag = document.createElement("meta"); descriptionTag.name = "description"; document.head.append(descriptionTag); }
  descriptionTag.content = description;

  for (const [key, selector] of [["woods", "#btnWoods b"], ["pond", "#btnPond b"]]) {
    const target = document.querySelector(selector);
    if (target && S.pages?.[key]?.navLabel) target.textContent = S.pages[key].navLabel;
  }

  /* ---------- farm keeper card ---------- */
  const keeperCard = document.getElementById("meetKeeper"), farmKeeper = window.FARM?.keeper;
  const speciesLabels = { snowcat: "Snow leopard cat", rabbit: "Rabbit", panda: "Panda", fox: "Fox", shiba: "Shiba Inu", hedgehog: "Hedgehog", duckling: "Duckling", penguin: "Penguin", wolf: "Wolf", redpanda: "Red panda", raccoon: "Raccoon", fennec: "Fennec fox", crocodile: "Crocodile" };
  const keeperSpecies = Object.hasOwn(speciesLabels, farmKeeper?.species) ? farmKeeper.species : "snowcat";
  const keeper = { name: farmKeeper?.name || "The keeper", species: speciesLabels[keeperSpecies], image: "assets/farm/" + (keeperSpecies === "redpanda" ? "redpanda-v2" : keeperSpecies) + ".webp" };
  if (keeperCard) {
    keeperCard.hidden = !farmKeeper;
    if (farmKeeper) {
      const name = keeper.name;
      const image = keeperCard.querySelector("img"), title = keeperCard.querySelector("small");
      const heading = keeperCard.querySelector("b"), note = keeperCard.querySelector("span span");
      if (image) { image.src = keeper.image; image.alt = name + ", " + keeper.species; }
      if (title) title.textContent = farmKeeper.title || "";
      if (heading) heading.textContent = name + " is keeping watch.";
      if (note) note.textContent = farmKeeper.note || "";
      keeperCard.setAttribute("aria-label", "Meet " + name + ", " + (farmKeeper.title || "keeper of the farm") + ", " + keeper.species);
    }
  }

  /* ---------- shared chrome ---------- */
  const page = document.body.dataset.page;
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <a class="brand" href="index.html">${ICON.star4}<span>${esc(S.brand || S.name || "")}</span></a>
      <div class="header-right">
        <nav class="nav" id="nav" aria-label="Main">${PAGES.map(([id, href, label]) =>
          `<a href="${href}"${S.pages?.[id]?.navLabel ? ' data-owner-nav title="' + esc(S.pages[id].navLabel) + '"' : ""}${id === page ? ' aria-current="page"' : ""}>${esc(S.pages?.[id]?.navLabel || label)}</a>`).join("")}</nav>
        <button class="icon-btn sky-toggle calm-toggle" id="calmToggle" type="button" aria-pressed="false" aria-label="Calm sky: less motion">${ICON.moon}<span class="tip"></span></button>
        <button class="icon-btn sky-toggle" id="skyToggle" type="button" aria-label="Change how the sky is painted">${ICON.star4}<span class="tip"></span></button>
        <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav">${ICON.menu}</button>
      </div>`;
    const nav = header.querySelector("#nav"), menuBtn = header.querySelector("#menuBtn");
    const setMenuOpen = (open) => {
      nav.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open);
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menuBtn.innerHTML = open ? ICON.close : ICON.menu;
    };
    menuBtn.addEventListener("click", (e) => {
      const open = !nav.classList.contains("open");
      setMenuOpen(open);
      if (open && e.detail === 0) focus(nav.querySelector('[aria-current="page"]') || nav.querySelector("a"));
    });
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("open") && !nav.contains(e.target) && !menuBtn.contains(e.target)) {
        setMenuOpen(false);
      }
    }, true);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || !nav.classList.contains("open")) return;
      const restore = nav.contains(document.activeElement) || menuBtn.contains(document.activeElement);
      e.preventDefault(); e.stopPropagation();
      setMenuOpen(false);
      if (restore) focus(menuBtn);
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
    footer.innerHTML = `© ${new Date().getFullYear()} ${esc(S.name || "")}<span class="dot">✦</span>${esc(S.footer === undefined ? "Same sky, different places." : S.footer)} <a href="inbox.html" class="host-login">Host login ↗</a>`;
  }

  /* ---------- links from config ---------- */
  document.querySelectorAll("[data-link]").forEach((a) => {
    const key = a.dataset.link;
    const href = safeURL(key === "email" ? (S.email ? "mailto:" + S.email : "") : (S.links || {})[key]);
    if (href) a.href = href; else a.remove();
  });
  document.querySelectorAll("[data-site]").forEach((el) => {
    const v = S[el.dataset.site];
    if (typeof v === "string") el.textContent = v;
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

  /* ---------- keyboard tabs ---------- */
  function tabs(root, { onSelect, orientation = "horizontal" } = {}) {
    const buttons = Array.from(root.querySelectorAll('button[role="tab"]'));
    const enabled = (button) => !button.disabled && !button.hidden;
    const direction = () => typeof orientation === "function" ? orientation() : orientation;
    const setOrientation = () => root.setAttribute("aria-orientation", direction());
    function select(button, { moveFocus = false, notify = true } = {}) {
      if (!buttons.includes(button) || !enabled(button)) return;
      buttons.forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active);
        tab.tabIndex = active ? 0 : -1;
      });
      if (notify && onSelect) onSelect(button);
      if (moveFocus) {
        focus(button);
        if (root.scrollWidth > root.clientWidth || root.scrollHeight > root.clientHeight) {
          button.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        }
      }
    }
    root.addEventListener("click", (e) => {
      const button = e.target.closest('button[role="tab"]');
      if (buttons.includes(button)) select(button);
    });
    root.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const button = e.target.closest('button[role="tab"]'), available = buttons.filter(enabled);
      const current = available.indexOf(button);
      if (current < 0) return;
      let index;
      if (e.key === "Home") index = 0;
      else if (e.key === "End") index = available.length - 1;
      else if (e.key === "ArrowRight" || (direction() === "vertical" && e.key === "ArrowDown")) index = (current + 1) % available.length;
      else if (e.key === "ArrowLeft" || (direction() === "vertical" && e.key === "ArrowUp")) index = (current - 1 + available.length) % available.length;
      else return;
      e.preventDefault(); e.stopPropagation();
      select(available[index], { moveFocus: true });
    });
    setOrientation();
    const initial = buttons.find((button) => enabled(button) && button.getAttribute("aria-selected") === "true") ||
      buttons.find((button) => enabled(button) && button.classList.contains("active")) || buttons.find(enabled);
    select(initial, { notify: false });
    return { select, setOrientation };
  }

  /* ---------- toast ---------- */
  let toastEl;
  function toast(msg, ms = 2600) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove("show"), ms);
  }

  /* ---------- modal / lightbox focus and page scroll ---------- */
  const overlays = [];
  let pageScroll;
  const focus = (el) => {
    if (!el || el.isConnected === false || typeof el.focus !== "function") return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  };
  function lockPageScroll() {
    if (pageScroll) return;
    const body = document.body, html = document.documentElement;
    const properties = ["position", "top", "left", "right", "width", "overflow", "padding-right"];
    const saved = properties.map((key) => [key, body.style.getPropertyValue(key), body.style.getPropertyPriority(key)]);
    const gap = Math.max(0, window.innerWidth - html.clientWidth);
    pageScroll = { x: window.scrollX, y: window.scrollY, saved,
      overflow: html.style.getPropertyValue("overflow"), overflowPriority: html.style.getPropertyPriority("overflow") };
    body.style.setProperty("position", "fixed");
    body.style.setProperty("top", `-${pageScroll.y}px`);
    body.style.setProperty("left", `-${pageScroll.x}px`);
    body.style.setProperty("right", "auto");
    body.style.setProperty("width", "100%");
    body.style.setProperty("overflow", "hidden");
    if (gap) body.style.setProperty("padding-right", `${(parseFloat(getComputedStyle(body).paddingRight) || 0) + gap}px`);
    html.style.setProperty("overflow", "hidden");
  }
  function unlockPageScroll() {
    if (!pageScroll) return;
    const saved = pageScroll, html = document.documentElement;
    pageScroll = null;
    saved.saved.forEach(([key, value, priority]) => {
      if (value) document.body.style.setProperty(key, value, priority); else document.body.style.removeProperty(key);
    });
    if (saved.overflow) html.style.setProperty("overflow", saved.overflow, saved.overflowPriority); else html.style.removeProperty("overflow");
    // The site uses smooth scrolling; returning from a dialog should keep the exact page position.
    const behavior = html.style.getPropertyValue("scroll-behavior"), priority = html.style.getPropertyPriority("scroll-behavior");
    html.style.setProperty("scroll-behavior", "auto");
    window.scrollTo(saved.x, saved.y);
    if (behavior) html.style.setProperty("scroll-behavior", behavior, priority); else html.style.removeProperty("scroll-behavior");
  }
  function overlaySession(el, close, navigate) {
    const session = { el, previous: document.activeElement };
    let released = false;
    const current = () => !released && overlays[overlays.length - 1] === session;
    const closeButton = () => el.querySelector(".modal-close, .lb-close");
    const initialFocus = () => { if (current()) focus(closeButton() || el); };
    const focusable = () => Array.from(el.querySelectorAll('a[href], button, input, textarea, select, [tabindex], [contenteditable="true"]'))
      .filter((node) => !node.disabled && !node.hidden && node.tabIndex >= 0 && node.getClientRects().length);
    const onKey = (e) => {
      if (!current()) return;
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); close();
      } else if (e.key === "Tab") {
        const nodes = focusable(), first = nodes[0], last = nodes[nodes.length - 1], active = document.activeElement;
        if (!first || !el.contains(active) || (e.shiftKey ? active === first : active === last)) {
          e.preventDefault(); focus(e.shiftKey ? last || closeButton() : first || closeButton());
        }
      } else if (navigate && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault(); e.stopPropagation(); navigate(e.key === "ArrowLeft" ? -1 : 1);
      }
    };
    const onFocus = (e) => { if (current() && !el.contains(e.target)) initialFocus(); };
    el.setAttribute("tabindex", "-1");
    lockPageScroll(); overlays.push(session);
    addEventListener("keydown", onKey, true);
    addEventListener("focusin", onFocus, true);
    return {
      focus: initialFocus,
      release() {
        if (released) return;
        const wasCurrent = current();
        released = true;
        overlays.splice(overlays.indexOf(session), 1);
        overlays.forEach((other) => { if (el.contains(other.previous)) other.previous = session.previous; });
        removeEventListener("keydown", onKey, true);
        removeEventListener("focusin", onFocus, true);
        const top = overlays[overlays.length - 1];
        if (!top) unlockPageScroll();
        if (wasCurrent) {
          if (!top || top.el.contains(session.previous)) focus(session.previous);
          else focus(top.el.querySelector(".modal-close, .lb-close"));
        }
      }
    };
  }

  /* ---------- modal ---------- */
  function modal(html, { onOpen, className = "" } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="modal-card ${className}" role="dialog" aria-modal="true">
      <button class="icon-btn modal-close" type="button" aria-label="Close">${ICON.close}</button>${html}</div>`;
    document.body.appendChild(wrap);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      wrap.classList.remove("open");
      overlay.release();
      setTimeout(() => wrap.remove(), 260);
    };
    const overlay = overlaySession(wrap, close);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector(".modal-close").addEventListener("click", close);
    requestAnimationFrame(() => {
      if (closed) return;
      wrap.classList.add("open");
      overlay.focus();
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
    let i = index, generation = 0, closed = false;
    const show = () => {
      const version = ++generation;
      const it = items[i];
      Promise.resolve().then(() => typeof it.src === "function" ? it.src() : it.src).then((src) => {
        if (!closed && version === generation) img.src = src;
      }).catch(() => {
        if (closed || version !== generation) return;
        img.removeAttribute("src");
        img.alt = "The image could not load.";
        el.querySelector(".lb-text").textContent = [it.text, "The image could not load."].filter(Boolean).join("\n\n");
        el.querySelector(".lb-side").style.display = "";
      });
      img.alt = typeof it.alt === "string" ? it.alt : it.title || "";
      el.querySelector("h3").textContent = it.title || "";
      el.querySelector(".lb-meta").textContent = it.meta || "";
      el.querySelector(".lb-text").textContent = it.text || "";
      el.querySelector(".lb-side").style.display = it.title || it.text ? "" : "none";
    };
    const close = () => {
      if (closed) return;
      closed = true; generation += 1;
      el.classList.remove("open"); overlay.release(); setTimeout(() => el.remove(), 300);
    };
    const go = (d) => { if (closed) return; i = (i + d + items.length) % items.length; show(); };
    const overlay = overlaySession(el, close, go);
    el.querySelector(".lb-close").onclick = close;
    el.addEventListener("click", (e) => { if (e.target === el || e.target.classList.contains("lb-stage")) close(); });
    const p = el.querySelector(".prev"), n = el.querySelector(".next");
    if (p) { p.onclick = () => go(-1); n.onclick = () => go(1); }
    show();
    requestAnimationFrame(() => { if (!closed) { el.classList.add("open"); overlay.focus(); } });
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

  window.Site = { ICON, esc, store, toast, modal, lightbox, send, reveal, tabs, keeper };
})();
