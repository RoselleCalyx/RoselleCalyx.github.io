/* Public content is read from the same service as the private host dashboard.
   Static data remains the fallback. Runtime scripts start in their original order
   after the bounded read, so every page sees one consistent content snapshot. */
(function () {
  "use strict";
  const TIMEOUT_MS = 2500, MAX_BYTES = 2 * 1024 * 1024;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const string = value => typeof value === "string" ? value : "";
  const strings = value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
  const textFields = (value, keys) => Object.fromEntries(keys.filter(key => typeof value[key] === "string").map(key => [key, value[key]]));
  const url = (value, { email = false } = {}) => {
    if (typeof value !== "string" || !value.trim()) return "";
    const candidate = value.trim();
    if (/[\u0000-\u0020\u007f]/.test(candidate) || candidate.startsWith("//") || candidate.includes("\\")) return "";
    try {
      const parsed = new URL(candidate, window.location.href);
      if (parsed.username || parsed.password) return "";
      if (["https:", "http:"].includes(parsed.protocol) || (email && parsed.protocol === "mailto:")) return candidate;
    } catch (_) {}
    return "";
  };
  const figure = value => record(value) ? { src: url(value.src), caption: string(value.caption), ...textFields(value, ["alt"]) } : null;
  const paper = value => {
    if (!record(value) || typeof value.title !== "string") return null;
    const result = { ...textFields(value, ["id", "title", "venue", "abstract", "bibtex", "imageAlt"]),
      authors: strings(value.authors), topics: strings(value.topics),
      year: Number.isSafeInteger(value.year) ? value.year : 0,
      type: ["publication", "preprint", "project"].includes(value.type) ? value.type : "publication",
      selected: value.selected === true, image: url(value.image), links: {} };
    for (const key of ["pdf", "code", "project", "data"]) result.links[key] = url(value.links?.[key]);
    if (Array.isArray(value.figures)) result.figures = value.figures.map(figure).filter(item => item?.src);
    return result;
  };
  const album = value => {
    if (!record(value) || typeof value.id !== "string") return null;
    const result = { ...textFields(value, ["id", "title", "place", "date", "story"]), tags: strings(value.tags), favorite: value.favorite === true,
      photos: (Array.isArray(value.photos) ? value.photos : []).filter(record).map(photo => ({
        src: url(photo.src), caption: string(photo.caption), text: string(photo.text), ...textFields(photo, ["alt"]),
        paint: { sky: string(photo.paint?.sky), land: string(photo.paint?.land), cabin: photo.paint?.cabin === true }
      })) };
    if (Array.isArray(value.coords) && value.coords.length === 2 && value.coords.every(Number.isFinite) && Math.abs(value.coords[0]) <= 90 && Math.abs(value.coords[1]) <= 180) result.coords = value.coords.slice();
    return result;
  };
  const animal = value => record(value) && ["snowcat", "rabbit", "panda", "fox", "shiba", "hedgehog", "duckling", "penguin", "redpanda", "raccoon", "wolf", "crocodile", "fennec"].includes(value.species)
    ? { ...textFields(value, ["id", "species", "name", "title", "note", "adoptedBy", "since"]), ...(typeof value.active === "boolean" ? { active: value.active } : {}) } : null;
  const stop = value => {
    if (!record(value) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.id || "") || !Array.isArray(value.title) || value.title.length !== 2 ||
        !value.title.every(item => typeof item === "string") || !["place", "en", "poem", "fact"].every(key => typeof value[key] === "string") ||
        !record(value.scene) || !["target", "label", "vantage", "description"].every(key => typeof value.scene[key] === "string") ||
        !url(value.scene.art) || !Array.isArray(value.map) || value.map.length !== 2 ||
        !value.map.every(item => Number.isFinite(item) && item >= 0 && item <= 100) ||
        !Number.isSafeInteger(value.chapter) || value.chapter < 0 || value.chapter > 3 ||
        !["earth", "venus", "jupiter", "saturn", "titan", "enceladus", "iapetus", "phoebe", "nebula"].includes(value.body) ||
        !/^#[0-9a-fA-F]{6}$/.test(value.color || "")) return null;
    return { ...textFields(value, ["id", "date", "place", "en", "poem", "fact", "body", "color"]),
      ...Object.fromEntries(["equinox", "eclipse", "plume", "close", "farewell"].filter(key => typeof value[key] === "boolean").map(key => [key, value[key]])),
      date: string(value.date), source: url(value.source), title: value.title.slice(), map: value.map.slice(), chapter: value.chapter,
      scene: { ...textFields(value.scene, ["target", "label", "vantage", "terrain", "pose", "particles", "description"]),
        art: url(value.scene.art), haze: Number.isFinite(value.scene.haze) ? Math.max(0, Math.min(1, value.scene.haze)) : 0 } };
  };
  function normalize(content) {
    if (!record(content)) return {};
    const result = {};
    if (record(content.site)) {
      result.site = textFields(content.site, ["name", "brand", "tagline", "location", "role", "affiliation", "email", "footer"]);
      if (record(content.site.links)) {
        result.site.links = {};
        for (const key of ["scholar", "linkedin", "github", "cv"]) if (own(content.site.links, key)) result.site.links[key] = url(content.site.links[key]);
      }
      if (Array.isArray(content.site.extraLinks)) result.site.extraLinks = content.site.extraLinks.filter(record).map(item => ({
        label: string(item.label), href: url(item.href),
        icon: ["globe", "scholar", "linkedin", "github", "mail", "cv", "book", "image", "star4"].includes(item.icon) ? item.icon : "globe"
      })).filter(item => item.label.trim() && item.href).slice(0, 24);
      const observer = content.site.observer;
      if (record(observer) && Number.isFinite(observer.lat) && Math.abs(observer.lat) <= 90 && Number.isFinite(observer.lon) && Math.abs(observer.lon) <= 180) {
        result.site.observer = { place: string(observer.place), lat: observer.lat, lon: observer.lon };
      }
      if (record(content.site.pages)) {
        result.site.pages = {};
        for (const key of ["home", "papers", "gallery", "message", "starmap", "farm", "woods", "pond", "voyager"]) {
          if (record(content.site.pages[key])) result.site.pages[key] = textFields(content.site.pages[key], ["title", "subtitle", "navLabel", "description"]);
        }
      }
    }
    if (record(content.home)) {
      result.home = textFields(content.home, ["heroTitle", "heroLede", "beyond", "coda", "heroFoot", "avatarAlt"]);
      if (record(content.home.labels)) result.home.labels = textFields(content.home.labels, ["about", "beyond", "educationKicker", "education", "newsKicker", "news", "explore"]);
      if (record(content.home.visibility)) result.home.visibility = Object.fromEntries(["about", "education", "news", "explore"].filter(key => typeof content.home.visibility[key] === "boolean").map(key => [key, content.home.visibility[key]]));
      if (record(content.home.finale)) result.home.finale = textFields(content.home.finale, ["date", "title", "text"]);
      if (own(content.home, "avatar")) result.home.avatar = url(content.home.avatar);
      for (const key of ["bio", "interests"]) if (Array.isArray(content.home[key])) result.home[key] = strings(content.home[key]);
      for (const [key, fields] of [["education", ["date", "title", "detail"]], ["news", ["date", "text"]], ["explore", ["title", "text", "icon"]]]) {
        if (Array.isArray(content.home[key])) result.home[key] = content.home[key].filter(record).map(item => ({
          ...textFields(item, fields), ...(key !== "education" ? { href: url(item.href, { email: true }) } : {})
        }));
      }
    }
    if (Array.isArray(content.papers)) result.papers = content.papers.filter(value => value?.published !== false).map(paper).filter(Boolean);
    if (Array.isArray(content.gallery)) result.gallery = content.gallery.filter(value => value?.published !== false).map(album).filter(Boolean);
    if (Array.isArray(content.bottles)) result.bottles = content.bottles.filter(value => record(value) && value.published !== false).map(value => textFields(value, ["id", "from", "date", "text", "reply"]));
    if (record(content.message)) result.message = textFields(content.message, ["introKicker", "placeholder", "sharedIntro", "emptyText"]);
    if (record(content.farm)) {
      result.farm = {};
      if (own(content.farm, "keeper")) result.farm.keeper = animal(content.farm.keeper);
      if (Array.isArray(content.farm.residents)) result.farm.residents = content.farm.residents.map(animal).filter(Boolean);
    }
    // A story needs a stop to initialize; an empty journey falls back gracefully.
    if (Array.isArray(content.voyager)) {
      const valid = content.voyager.map(stop).filter(Boolean);
      if (valid.length && valid.length === content.voyager.length && new Set(valid.map(value => value.id)).size === valid.length) result.voyager = valid;
    }
    return result;
  }
  function apply(content) {
    const clean = normalize(content), settings = window.SITE || (window.SITE = {});
    if (clean.site) {
      const { links, observer, pages, ...fields } = clean.site;
      Object.assign(settings, fields);
      if (links) settings.links = { ...settings.links, ...links };
      if (observer) settings.observer = { ...settings.observer, ...observer };
      if (pages) settings.pages = Object.fromEntries(Object.entries({ ...settings.pages, ...pages }).map(([key, value]) => [key, { ...settings.pages?.[key], ...value }]));
    }
    if (clean.home) window.HOME_CONTENT = clean.home;
    if (clean.message) window.MESSAGE_CONTENT = clean.message;
    for (const [key, global] of [["papers", "PAPERS"], ["gallery", "GALLERY"], ["bottles", "BOTTLES"], ["voyager", "VOYAGER_STOPS"]]) {
      if (own(clean, key)) window[global] = clean[key];
    }
    if (clean.farm) window.FARM = { ...window.FARM, ...clean.farm };
    return clean;
  }
  function apiBase() {
    try {
      const raw = string(window.SITE?.messageApi).trim();
      if (!raw) return "";
      const parsed = new URL(raw), local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      if ((parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) || parsed.username || parsed.password || parsed.search || parsed.hash) return "";
      return parsed.href.replace(/\/+$/, "");
    } catch (_) { return ""; }
  }
  async function read() {
    const base = apiBase();
    if (!base || typeof fetch !== "function") return null;
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("content timeout")); }, TIMEOUT_MS); });
    try {
      return await Promise.race([(async () => {
        const response = await fetch(base + "/api/site-content", { headers: { Accept: "application/json" }, credentials: "omit", mode: "cors", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal });
        if (!response.ok) return null;
        const raw = await response.text();
        if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).length > MAX_BYTES) return null;
        const value = JSON.parse(raw);
        return record(value) && value.ok === true && Number.isSafeInteger(value.revision) && value.revision >= 0 && record(value.content) ? value : null;
      })(), timeout]);
    } catch (_) { return null; }
    finally { clearTimeout(timer); }
  }
  const api = window.SiteContent = { revision: 0, updatedAt: null, content: {}, source: "static", normalize, apply, url };
  api.ready = read().then(value => {
    if (value) {
      api.content = apply(value.content); api.revision = value.revision;
      api.updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : null; api.source = "cloud";
    }
    return api;
  });
  const scripts = Array.from(document.querySelectorAll("script[data-site-src]"));
  // Fetch the farm's dependencies while its published content is being read.
  // Execution still waits for that snapshot and follows the original order.
  if (document.body?.dataset.page === "farm") scripts.forEach(placeholder => {
    const preload = document.createElement("link");
    preload.rel = "preload"; preload.as = "script";
    preload.href = placeholder.getAttribute("data-site-src");
    document.head.appendChild(preload);
  });
  api.started = api.ready.then(async () => {
    // async=false preserves insertion-order execution without serial downloads.
    await Promise.all(scripts.map(placeholder =>
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = placeholder.getAttribute("data-site-src"); script.async = false;
        script.onload = resolve; script.onerror = () => reject(new Error("Could not load " + script.src));
        placeholder.replaceWith(script);
      })
    ));
    document.dispatchEvent(new CustomEvent("site-content-ready", { detail: { revision: api.revision, source: api.source } }));
    return api;
  }).catch(error => { console.error("Page startup failed:", error); throw error; });
})();
