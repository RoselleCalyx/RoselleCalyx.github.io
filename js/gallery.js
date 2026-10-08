/* Gallery page: timeline, photo wall, world map, lightbox. */
(function () {
  const { esc, ICON } = window.Site;
  const albums = (window.GALLERY || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const TAGS = ["All", "Travel", "Nature", "Life", "Food", "People", "Favorite"];
  const state = { tag: "All", album: null, view: "wall" };

  const $ = (id) => document.getElementById(id);
  const trail = $("trail"), wall = $("wall"), chips = $("tags"), storyEl = $("albumStory");
  const fmtDate = (d) => {
    if (!d) return "";
    const [y, m] = d.split("-");
    return m ? new Date(+y, +m - 1).toLocaleString("en", { month: "short", year: "numeric" }) : y;
  };

  /* ================= painted placeholders ================= */
  function rng(seed) {
    let s = 0;
    for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) | 0;
    return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const SKIES = {
    dusk: ["#0b1030", "#2a2a5e", "#7a4a6e", "#e08a5a"], aurora: ["#02060f", "#061526", "#0b2735", "#14363c"],
    milkyway: ["#02030a", "#060b1c", "#0d1530", "#1c2140"], sunset: ["#1a1840", "#4a2c5a", "#b4566a", "#f2a25a"],
    night: ["#03050d", "#0a1022", "#121a34", "#222b48"], dawn: ["#1c2350", "#4a4c80", "#c58aa0", "#f3c9a8"]
  };
  function ridge(r, w, y0, amp, rough) {
    let pts = [[0, y0], [w, y0]];
    let a = amp;
    for (let it = 0; it < 7; it++) {
      const np = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        np.push(pts[i], [(x1 + x2) / 2, (y1 + y2) / 2 + (r() - 0.5) * a]);
      }
      np.push(pts[pts.length - 1]);
      pts = np; a *= rough;
    }
    return pts;
  }
  function fillPts(c, pts, h, style) {
    c.fillStyle = style; c.beginPath(); c.moveTo(0, h);
    pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(pts[pts.length - 1][0], h); c.closePath(); c.fill();
  }
  function paint(p, seed, aspect) {
    const r = rng(seed);
    const w = 900, h = Math.round(w / aspect);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const c = cv.getContext("2d");
    const sky = SKIES[p.sky] || SKIES.night;
    const hz = h * (p.land === "sea" || p.land === "lake" ? 0.6 : 0.66);
    let g = c.createLinearGradient(0, 0, 0, hz);
    sky.forEach((col, i) => g.addColorStop(i / (sky.length - 1), col));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const starry = ["aurora", "milkyway", "night", "dusk"].includes(p.sky);
    for (let i = 0; i < (starry ? 420 : 60); i++) {
      c.fillStyle = `rgba(255,250,235,${(r() * (starry ? 0.9 : 0.4)).toFixed(2)})`;
      const s = r() < 0.92 ? 1 : 2;
      c.fillRect(r() * w, r() * hz * 0.95, s, s);
    }
    c.globalCompositeOperation = "lighter";
    if (p.sky === "milkyway") {
      for (let i = 0; i < 1600; i++) {
        const t = r(), off = (r() + r() + r() - 1.5) * h * 0.12;
        const x = w * (0.1 + t * 0.8) + off * 0.5, y = hz * (1 - t * 0.95) + off;
        c.fillStyle = `rgba(230,225,255,${(r() * 0.5).toFixed(2)})`; c.fillRect(x, y, 1.2, 1.2);
      }
      for (let i = 0; i < 40; i++) {
        const t = r(), x = w * (0.1 + t * 0.8), y = hz * (1 - t * 0.95);
        const rg = c.createRadialGradient(x, y, 0, x, y, 60 + r() * 60);
        rg.addColorStop(0, `rgba(${r() < 0.5 ? "220,190,160" : "160,170,230"},.07)`); rg.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = rg; c.fillRect(x - 120, y - 120, 240, 240);
      }
    }
    if (p.sky === "aurora") {
      for (let band = 0; band < 3; band++) {
        const y0 = hz * (0.25 + band * 0.12), ph = r() * 6, amp = 30 + r() * 40;
        for (let x = 0; x < w; x += 2) {
          const y = y0 + Math.sin(x / 140 + ph) * amp + Math.sin(x / 47 + ph * 2) * 10;
          const len = 90 + Math.sin(x / 60 + ph) * 50;
          const lg = c.createLinearGradient(0, y - len, 0, y + 10);
          lg.addColorStop(0, "rgba(120,80,200,0)"); lg.addColorStop(0.6, `rgba(60,230,160,${0.08 + band * 0.02})`); lg.addColorStop(1, "rgba(120,255,190,0)");
          c.fillStyle = lg; c.fillRect(x, y - len, 2, len + 10);
        }
      }
    }
    if (["sunset", "dawn", "dusk"].includes(p.sky)) {
      const rg = c.createRadialGradient(w * 0.5, hz, 0, w * 0.5, hz, w * 0.6);
      rg.addColorStop(0, "rgba(255,190,120,.35)"); rg.addColorStop(1, "rgba(255,190,120,0)");
      c.fillStyle = rg; c.fillRect(0, 0, w, h);
    }
    if (p.sky === "night" || p.sky === "dusk") {
      const mx = w * (0.65 + r() * 0.2), my = hz * 0.25;
      const rg = c.createRadialGradient(mx, my, 0, mx, my, 70);
      rg.addColorStop(0, "rgba(255,245,220,.5)"); rg.addColorStop(1, "rgba(255,245,220,0)");
      c.fillStyle = rg; c.fillRect(mx - 70, my - 70, 140, 140);
      c.globalCompositeOperation = "source-over";
      c.fillStyle = "#f6efdc"; c.beginPath(); c.arc(mx, my, 11, 0, 7); c.fill();
    }
    c.globalCompositeOperation = "source-over";

    const L = p.land;
    if (L === "mountains" || L === "lake" || L === "sakura") {
      const far = ridge(r, w, hz - h * 0.12, h * 0.4, 0.55);
      fillPts(c, far, h, "#141c33");
      c.save(); c.beginPath(); c.moveTo(0, h); far.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(w, h); c.clip();
      const top = Math.min(...far.map((q) => q[1])), line = top + h * 0.11;
      c.fillStyle = "rgba(214,224,242,.6)";
      c.beginPath();
      far.forEach(([x, y]) => c.lineTo(x, y));
      for (let i = far.length - 1; i >= 0; i--) {
        const [x, y] = far[i];
        c.lineTo(x, y + Math.max(0, line - y) * (0.55 + 0.25 * Math.sin(x / 9)));
      }
      c.closePath(); c.fill();
      c.restore();
      fillPts(c, ridge(r, w, hz, h * 0.18, 0.55), h, "#0a0f1f");
    }
    if (L === "hills") { fillPts(c, ridge(r, w, hz - h * 0.04, h * 0.1, 0.4), h, "#121a2c"); fillPts(c, ridge(r, w, hz + h * 0.06, h * 0.08, 0.4), h, "#090d18"); }
    if (L === "fuji") {
      c.fillStyle = "#1a2040"; c.beginPath();
      c.moveTo(w * 0.05, hz + 10); c.lineTo(w * 0.42, hz - h * 0.3); c.lineTo(w * 0.58, hz - h * 0.3); c.lineTo(w * 0.95, hz + 10); c.closePath(); c.fill();
      c.fillStyle = "rgba(240,240,250,.9)"; c.beginPath();
      c.moveTo(w * 0.42, hz - h * 0.3); c.lineTo(w * 0.58, hz - h * 0.3); c.lineTo(w * 0.64, hz - h * 0.22);
      for (let i = 0; i < 6; i++) c.lineTo(w * (0.62 - i * 0.045), hz - h * (0.2 + (i % 2) * 0.03));
      c.lineTo(w * 0.36, hz - h * 0.22); c.closePath(); c.fill();
      fillPts(c, ridge(r, w, hz + h * 0.05, h * 0.05, 0.5), h, "#0b0f1d");
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,${190 + r() * 50},120,${0.4 + r() * 0.6})`; c.fillRect(r() * w, hz + h * 0.07 + r() * h * 0.25, 2, 2); }
    }
    if (L === "sea" || L === "lake") {
      const wg = c.createLinearGradient(0, hz, 0, h);
      wg.addColorStop(0, sky[2]); wg.addColorStop(1, "#03050c");
      c.fillStyle = wg; c.globalAlpha = L === "lake" ? 0.85 : 1;
      c.fillRect(0, hz + (L === "lake" ? h * 0.08 : 0), w, h); c.globalAlpha = 1;
      for (let i = 0; i < 120; i++) {
        const y = hz + h * 0.1 + r() * (h - hz), x = w * 0.5 + (r() - 0.5) * w * (0.2 + (y - hz) / h);
        c.fillStyle = `rgba(240,225,190,${(0.08 + r() * 0.25).toFixed(2)})`; c.fillRect(x, y, 20 + r() * 40, 1.5);
      }
    }
    if (L === "city") {
      fillPts(c, ridge(r, w, hz, h * 0.08, 0.5), h, "#121a30");
      let x = 0;
      while (x < w) {
        const bw = 30 + r() * 60, bh = h * (0.06 + r() * 0.16);
        c.fillStyle = r() < 0.5 ? "#0b1020" : "#0e1428"; c.fillRect(x, hz + h * 0.1 - bh, bw, h);
        for (let wy = hz + h * 0.1 - bh + 8; wy < h; wy += 12)
          for (let wx = x + 6; wx < x + bw - 6; wx += 10)
            if (r() < 0.35) { c.fillStyle = `rgba(255,${200 + r() * 40},130,${0.5 + r() * 0.5})`; c.fillRect(wx, wy, 4, 5); }
        x += bw + 2;
      }
      c.fillStyle = "#0b1020"; c.beginPath(); c.arc(w * 0.62, hz - h * 0.02, h * 0.07, Math.PI, 0); c.fill();
      c.fillRect(w * 0.62 - h * 0.07, hz - h * 0.02, h * 0.14, h * 0.2);
      c.fillRect(w * 0.3, hz - h * 0.2, 12, h * 0.4); c.beginPath(); c.moveTo(w * 0.3 - 4, hz - h * 0.2); c.lineTo(w * 0.3 + 6, hz - h * 0.28); c.lineTo(w * 0.3 + 16, hz - h * 0.2); c.fill();
    }
    if (L === "desert") {
      fillPts(c, ridge(r, w, hz + h * 0.02, h * 0.06, 0.35), h, "#1a1418");
      fillPts(c, ridge(r, w, hz + h * 0.12, h * 0.05, 0.35), h, "#0d0a0e");
    }
    if (L === "sakura") {
      c.strokeStyle = "#140c10"; c.lineWidth = 3;
      for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(0, h * (0.86 + i * 0.06)); c.lineTo(w, h * (0.8 + i * 0.06)); c.stroke(); }
      const tx = w * 0.78, ty = h * 0.92;
      c.fillStyle = "#1a0f12"; c.beginPath(); c.moveTo(tx - 12, h); c.quadraticCurveTo(tx - 4, ty - h * 0.2, tx - 30, ty - h * 0.42); c.lineTo(tx + 10, ty - h * 0.42); c.quadraticCurveTo(tx + 6, ty - h * 0.2, tx + 14, h); c.fill();
      for (let i = 0; i < 900; i++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * h * 0.3;
        c.fillStyle = `rgba(${240 + r() * 15},${170 + r() * 50},${195 + r() * 40},${0.5 + r() * 0.5})`;
        c.beginPath(); c.arc(tx - 10 + Math.cos(a) * d * 1.3, ty - h * 0.5 + Math.sin(a) * d * 0.8, 2 + r() * 4, 0, 7); c.fill();
      }
    }
    if (p.cabin) {
      const cx = w * 0.62, cy = h * 0.83;
      c.fillStyle = "#06080f"; c.fillRect(cx, cy - 40, 70, 40);
      c.beginPath(); c.moveTo(cx - 10, cy - 38); c.lineTo(cx + 35, cy - 70); c.lineTo(cx + 80, cy - 38); c.fill();
      const lg = c.createRadialGradient(cx + 20, cy - 20, 0, cx + 20, cy - 20, 60);
      lg.addColorStop(0, "rgba(255,190,100,.45)"); lg.addColorStop(1, "rgba(255,190,100,0)");
      c.fillStyle = lg; c.fillRect(cx - 40, cy - 80, 120, 120);
      c.fillStyle = "#ffcf7a"; c.fillRect(cx + 14, cy - 28, 12, 12); c.fillRect(cx + 44, cy - 28, 12, 12);
      c.fillStyle = "rgba(225,232,245,.8)"; c.fillRect(0, cy, w, h - cy);
      fillPts(c, ridge(r, w, cy + 4, h * 0.03, 0.4), h, "rgba(205,214,232,.95)");
    }
    // brush strokes: resample the picture as short dabs, like oil on canvas
    const data = c.getImageData(0, 0, w, h).data;
    c.lineCap = "round";
    for (let i = 0; i < 5200; i++) {
      const x = r() * w, y = r() * h, k = ((y | 0) * w + (x | 0)) * 4;
      const j = (r() - 0.5) * 18;
      c.strokeStyle = `rgba(${data[k] + j | 0},${data[k + 1] + j | 0},${data[k + 2] + j | 0},.55)`;
      c.lineWidth = 2 + r() * 3;
      const a = (y < hz ? Math.sin(x / 90 + y / 70) * 1.2 : 0) + (r() - 0.5) * 0.4, len = 4 + r() * 9;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
    }
    const vg = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.45)");
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
    return cv.toDataURL("image/jpeg", 0.86);
  }

  const cache = {};
  const ASPECTS = [4 / 3, 3 / 4, 1, 16 / 10, 4 / 5];
  function photoSrc(album, i) {
    const ph = album.photos[i];
    if (ph.src) return Promise.resolve(ph.src);
    const key = album.id + ":" + i;
    if (!cache[key]) {
      cache[key] = new Promise((res) => {
        const run = () => res(paint(ph.paint || {}, key, ASPECTS[(albums.indexOf(album) * 2 + i) % ASPECTS.length]));
        "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 600 }) : setTimeout(run, 30);
      });
    }
    return cache[key];
  }

  /* ================= timeline ================= */
  trail.innerHTML =
    `<li><button type="button" data-album="" class="active"><b>All</b><span>Every footprint</span></button></li>` +
    albums.map((a) => `<li><button type="button" data-album="${esc(a.id)}"><b>${esc((a.date || "").slice(0, 4))}</b><span>${esc(a.place)}</span></button></li>`).join("");
  trail.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    selectAlbum(b.dataset.album || null);
  });
  function selectAlbum(id) {
    state.album = id;
    trail.querySelectorAll("button").forEach((x) => x.classList.toggle("active", (x.dataset.album || null) === id));
    if (state.view !== "wall") setView("wall");
    renderWall();
  }

  /* ================= tag chips ================= */
  chips.innerHTML = TAGS.map((t) => `<button type="button" class="chip${t === "All" ? " active" : ""}" data-tag="${t}">${t}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.tag = b.dataset.tag;
    chips.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    renderWall();
  });

  /* ================= photo wall ================= */
  let items = [];
  function renderWall() {
    const a = state.album && albums.find((x) => x.id === state.album);
    storyEl.classList.toggle("show", !!a);
    if (a) storyEl.innerHTML = `<p class="kicker">${esc(a.place)} · ${fmtDate(a.date)}</p><h2>${esc(a.title || a.place)}</h2><p>${esc(a.story || "")}</p>`;
    items = [];
    albums.forEach((al) => {
      if (state.album && al.id !== state.album) return;
      const okTag = state.tag === "All" || (state.tag === "Favorite" ? al.favorite : (al.tags || []).includes(state.tag));
      if (!okTag) return;
      al.photos.forEach((ph, i) => items.push({ al, i, ph }));
    });
    let html = items.map((it, k) => `<button class="tile reveal" type="button" data-k="${k}" aria-label="${esc(it.ph.caption || it.al.place)}">
        <img alt="${esc(it.ph.caption || "")}" data-k="${k}" style="aspect-ratio:${it.ph.src ? "auto" : ASPECTS[(albums.indexOf(it.al) * 2 + it.i) % ASPECTS.length]}">
        <span class="tile-cap"><b>${esc(it.ph.caption || it.al.title)}</b><span>${esc(it.al.place)} · ${fmtDate(it.al.date)}</span></span>
      </button>`);
    if (!state.album && html.length > 2) html.splice(3, 0, `<div class="tile note reveal"><p>Same sky.<br>Different places.<br>Still me.</p></div>`);
    wall.innerHTML = html.length ? html.join("") : `<div class="empty">No footprints here yet.</div>`;
    wall.querySelectorAll("img[data-k]").forEach((img) => {
      const it = items[+img.dataset.k];
      photoSrc(it.al, it.i).then((src) => { img.src = src; img.style.aspectRatio = ""; });
    });
    Site.reveal(wall);
  }
  wall.addEventListener("click", (e) => {
    const t = e.target.closest(".tile[data-k]"); if (!t) return;
    Site.lightbox(items.map((it) => ({
      src: () => photoSrc(it.al, it.i),
      title: it.ph.caption || it.al.title,
      meta: `${it.al.place} · ${fmtDate(it.al.date)}`,
      text: it.ph.text || it.al.story || ""
    })), +t.dataset.k);
  });

  /* ================= map ================= */
  let map = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((res, rej) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function initMap() {
    if (map) { map.invalidateSize(); return; }
    loadLeaflet().then(() => {
      $("mapFallback").remove();
      map = L.map("map", { zoomControl: true, worldCopyJump: true, attributionControl: true }).setView([30, 10], 2);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors", maxZoom: 16
      }).addTo(map);
      const icon = L.divIcon({ className: "", html: '<div class="star-marker"></div>', iconSize: [0, 0] });
      const pts = [];
      albums.forEach((a) => {
        if (!a.coords) return;
        pts.push(a.coords);
        const m = L.marker(a.coords, { icon, title: a.place }).addTo(map);
        m.bindPopup(`<b>${esc(a.title || a.place)}</b>${esc(a.place)} · ${fmtDate(a.date)}<br><span style="color:var(--ink-2)">${esc(a.story || "")}</span><br><button class="btn sm" type="button" data-open="${esc(a.id)}">View photos</button>`);
      });
      if (pts.length > 1) {
        L.polyline(albums.slice().reverse().filter((a) => a.coords).map((a) => a.coords), { color: "#e2c07c", weight: 1, opacity: 0.45, dashArray: "4 6" }).addTo(map);
        map.fitBounds(pts, { padding: [40, 40] });
      }
    }).catch(() => { $("mapFallback").textContent = "The map could not load — perhaps the network is asleep."; });
  }
  document.getElementById("map").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) selectAlbum(b.dataset.open);
  });

  /* ================= view switch ================= */
  const sw = $("viewSwitch");
  function setView(v) {
    state.view = v;
    sw.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    $("wallView").hidden = v !== "wall";
    $("mapView").hidden = v !== "map";
    if (v === "map") initMap();
  }
  sw.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setView(b.dataset.view); });

  renderWall();
})();
