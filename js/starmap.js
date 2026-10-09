/* =====================================================================
   Starmap — a planisphere centred on the north celestial pole,
   rotated so tonight's meridian (for SITE.observer) points down.
   Drag to pan, wheel/pinch to zoom, click a constellation to fly to it.
   ===================================================================== */
(function () {
  const { esc, ICON, store } = window.Site;
  const CONS = window.CONSTELLATIONS || [], DSO = window.DEEP_SKY || [];
  const OBS = Object.assign({ place: "Munich", lat: 48.14, lon: 11.58 }, (window.SITE || {}).observer);
  const D2R = Math.PI / 180, DEC_MIN = -66;
  const $ = (id) => document.getElementById(id);
  const canvas = $("chart"), ctx = canvas.getContext("2d"), wrap = canvas.parentElement;
  const zc = $("zoomChart"), zctx = zc.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileMap = matchMedia("(max-width: 760px)");

  /* ---------- time & sky geometry ---------- */
  const now = new Date();
  const days = now.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const norm = (a) => ((a % 360) + 360) % 360;
  const LST = norm(280.46061837 + 360.98564736629 * days + OBS.lon);
  const RA0 = LST;
  function proj(ra, dec) {
    const r = (90 - dec) / (90 - DEC_MIN), a = (ra - RA0) * D2R;
    return { x: -r * Math.sin(a), y: r * Math.cos(a) };
  }
  function eclToEq(lam, beta) {
    const e = 23.4393 * D2R, l = lam * D2R, b = beta * D2R;
    const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / D2R;
    const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) / D2R;
    return { ra: norm(ra), dec };
  }
  function galToEq(l, b) {
    const ag = 192.85948 * D2R, dg = 27.12825 * D2R, lc = 122.93192 * D2R;
    l *= D2R; b *= D2R;
    const sd = Math.sin(dg) * Math.sin(b) + Math.cos(dg) * Math.cos(b) * Math.cos(lc - l);
    const ra = ag + Math.atan2(Math.cos(b) * Math.sin(lc - l), Math.cos(dg) * Math.sin(b) - Math.sin(dg) * Math.cos(b) * Math.cos(lc - l));
    return { ra: norm(ra / D2R), dec: Math.asin(sd) / D2R };
  }

  /* ---------- planets for today (mean orbital elements, ±1–2°) ---------- */
  const PLANET_EL = [
    ["mercury", "Mercury", "水星", 252.25, 4.09233, 0.387, 0.2056, 77.46, "#c9b9a6", "The swiftest planet: a year lasts 88 days. Seen only low in twilight, never far from the Sun."],
    ["venus", "Venus", "金星", 181.98, 1.60213, 0.723, 0.0068, 131.6, "#f6e7b8", "The Evening and Morning Star (启明 · 长庚). Brightest of all planets, wrapped in clouds of sulphuric acid."],
    ["earth", "Earth", "", 100.46, 0.985647, 1, 0.0167, 102.9],
    ["mars", "Mars", "火星", 355.43, 0.524033, 1.524, 0.0934, 336.04, "#e2775a", "The red planet (荧惑). Rust-coloured dust, the tallest volcano in the solar system, and rovers still exploring."],
    ["jupiter", "Jupiter", "木星", 34.35, 0.083091, 5.203, 0.0484, 14.75, "#e8d2a8", "The giant (岁星). Even small binoculars show its four large moons, as Galileo saw them in 1610."],
    ["saturn", "Saturn", "土星", 50.08, 0.03346, 9.537, 0.0539, 92.43, "#ecd28e", "Home of Cassini's last dive (镇星). Its rings are bright ice, most of them thinner than a building is tall."],
    ["uranus", "Uranus", "天王星", 314.06, 0.011733, 19.19, 0.0473, 170.96, "#a9e1e6", "An ice giant rolling on its side, barely visible to the naked eye under truly dark skies."],
    ["neptune", "Neptune", "海王星", 304.35, 0.005965, 30.07, 0.0086, 44.97, "#7a9cf0", "Found by mathematics before it was seen (1846). Winds there blow faster than sound."]
  ];
  function helio(el) {
    const L = norm(el[3] + el[4] * days), e = el[6], wbar = el[7];
    const M = (L - wbar) * D2R;
    const v = M + (2 * e - e * e * e / 4) * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M);
    const r = (el[5] * (1 - e * e)) / (1 + e * Math.cos(v));
    const lon = v + wbar * D2R;
    return { x: r * Math.cos(lon), y: r * Math.sin(lon) };
  }
  const earth = helio(PLANET_EL[2]);
  const PLANETS = PLANET_EL.filter((p) => p[0] !== "earth").map((p) => {
    const h = helio(p);
    const lam = norm(Math.atan2(h.y - earth.y, h.x - earth.x) / D2R);
    return Object.assign({ id: p[0], name: p[1], zh: p[2], color: p[8], text: p[9] }, eclToEq(lam, 0));
  });
  (function () {
    const sunLam = norm(Math.atan2(-earth.y, -earth.x) / D2R);
    PLANETS.unshift(Object.assign({ id: "sun", name: "Sun", zh: "太阳", color: "#ffd77a", text: "Our star. Where it stands today, the constellations behind it are hidden in daylight — the ones opposite are tonight's sky." }, eclToEq(sunLam, 0)));
    const L = 218.316 + 13.176396 * days, M = (134.963 + 13.064993 * days) * D2R, F = (93.272 + 13.22935 * days) * D2R;
    const ml = norm(L + 6.289 * Math.sin(M)), mb = 5.128 * Math.sin(F);
    const age = norm(ml - sunLam) / 360;
    const phase = age < 0.03 || age > 0.97 ? "new" : age < 0.22 ? "waxing crescent" : age < 0.28 ? "first quarter" : age < 0.47 ? "waxing gibbous" : age < 0.53 ? "full" : age < 0.72 ? "waning gibbous" : age < 0.78 ? "last quarter" : "waning crescent";
    PLANETS.splice(1, 0, Object.assign({ id: "moon", name: "Moon", zh: "月亮", color: "#f3efe2", text: `Today the Moon is ${phase}. It drifts eastward against the stars by about its own width every hour.` }, eclToEq(ml, mb)));
  })();
  // what you see when you open a world
  const WORLDS = {
    sun: { name: "Sun", zh: "太阳", rows: [["Diameter", "1,392,700 km"], ["Turns once in", "about 25 days"], ["Surface", "about 5,500 °C"], ["Age", "4.6 billion years"]] },
    mercury: { name: "Mercury", zh: "水星", rows: [["Diameter", "4,879 km"], ["Day", "59 Earth days"], ["Year", "88 days"], ["Moons", "0"]] },
    venus: { name: "Venus", zh: "金星", rows: [["Diameter", "12,104 km"], ["Day", "243 days, spinning backwards"], ["Year", "225 days"], ["Moons", "0"]] },
    earth: { name: "Earth", zh: "地球", text: "Home: the only world we know with oceans under an open sky — and someone looking up.", rows: [["Diameter", "12,742 km"], ["Day", "24 hours"], ["Year", "365.25 days"], ["Moons", "1"]] },
    moon: { name: "Moon", zh: "月亮", rows: [["Diameter", "3,474 km"], ["Day", "27.3 days"], ["Distance", "384,400 km"], ["Always shows", "the same face"]] },
    mars: { name: "Mars", zh: "火星", rows: [["Diameter", "6,779 km"], ["Day", "24.6 hours"], ["Year", "687 days"], ["Moons", "2"]] },
    jupiter: { name: "Jupiter", zh: "木星", rows: [["Diameter", "139,820 km"], ["Day", "9.9 hours"], ["Year", "11.9 years"], ["Moons", "95+"]] },
    saturn: { name: "Saturn", zh: "土星", rows: [["Diameter", "116,460 km"], ["Day", "10.7 hours"], ["Year", "29.4 years"], ["Moons", "270+"]] },
    uranus: { name: "Uranus", zh: "天王星", rows: [["Diameter", "50,724 km"], ["Day", "17.2 hours, on its side"], ["Year", "84 years"], ["Moons", "28+"]] },
    neptune: { name: "Neptune", zh: "海王星", rows: [["Diameter", "49,244 km"], ["Day", "16.1 hours"], ["Year", "165 years"], ["Moons", "16"]] }
  };
  function nearestConstellation(ra, dec) {
    const p = proj(ra, dec);
    let best = null, bd = 1e9;
    CONS.forEach((c) => c.stars.forEach((s) => {
      const q = proj(s[1], s[2]), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }));
    return best;
  }

  /* ---------- state ---------- */
  let size = 0, dpr = 1, Rc = 0, cx = 0, cy = 0;
  const view = { k: 1, x: 0, y: 0 };
  let target = null, mode = "const", selected = { type: "const", id: "ori" }, hover = null;
  let favs = store.get("sky-favs", []);
  let bg = null, time = 0, last = performance.now();
  const quiz = { on: false, round: 0, score: 0, order: [], flash: null, lock: false, timer: 0, generation: 0 };

  const sx = (p) => cx + view.x + p.x * Rc * view.k;
  const sy = (p) => cy + view.y + p.y * Rc * view.k;
  const toS = (ra, dec) => { const p = proj(ra, dec); return [sx(p), sy(p)]; };

  /* ---------- background: milky way and faint stars ---------- */
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function buildBg() {
    const B = Math.min(2600, Math.round(Rc * 2 * dpr * 1.6));
    bg = document.createElement("canvas"); bg.width = bg.height = B;
    const b = bg.getContext("2d"), h = B / 2;
    const g = b.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, "#0b1230"); g.addColorStop(0.75, "#070b1e"); g.addColorStop(1, "#05081a");
    b.fillStyle = g; b.beginPath(); b.arc(h, h, h, 0, 7); b.fill();
    const r = rng(42);
    const at = (ra, dec) => { const p = proj(ra, dec); return [h + p.x * h, h + p.y * h]; };
    b.globalCompositeOperation = "lighter";
    for (let i = 0; i < 520; i++) {
      const l = r() * 360, bb = (r() + r() + r() - 1.5) * 9;
      const q = galToEq(l, bb);
      if (q.dec < DEC_MIN - 4) continue;
      const [x, y] = at(q.ra, q.dec);
      const rad = B * (0.012 + r() * 0.03) * (1 + 0.6 * Math.cos(((l - 0) * D2R)));
      const rg = b.createRadialGradient(x, y, 0, x, y, rad);
      const tint = r() < 0.5 ? "150,160,220" : r() < 0.5 ? "200,170,200" : "220,200,170";
      const core = 0.45 + 0.55 * Math.pow((1 + Math.cos(l * D2R)) / 2, 2);
      rg.addColorStop(0, `rgba(${tint},${(0.012 + r() * 0.03) * core})`); rg.addColorStop(1, `rgba(${tint},0)`);
      b.fillStyle = rg; b.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 3200; i++) {
      const l = r() * 360, bb = (r() + r() - 1) * 7;
      const q = galToEq(l, bb);
      if (q.dec < DEC_MIN) continue;
      const [x, y] = at(q.ra, q.dec);
      b.fillStyle = `rgba(230,230,255,${(0.06 + r() * 0.3).toFixed(2)})`;
      b.fillRect(x, y, dpr * 0.8, dpr * 0.8);
    }
    b.globalCompositeOperation = "source-over";
    for (let i = 0; i < 2600; i++) {
      const ra = r() * 360, dec = Math.asin(r() * (1 - Math.sin(DEC_MIN * D2R)) + Math.sin(DEC_MIN * D2R)) / D2R;
      const [x, y] = at(ra, dec);
      const s = (0.5 + Math.pow(r(), 4) * 1.6) * dpr;
      b.fillStyle = `rgba(${r() < 0.3 ? "200,215,255" : "255,245,230"},${(0.2 + r() * 0.6).toFixed(2)})`;
      b.beginPath(); b.arc(x, y, s, 0, 7); b.fill();
    }
  }

  const GLOW = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.2, "rgba(220,230,255,.6)"); rg.addColorStop(1, "rgba(200,215,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return c;
  })();
  const starR = (mag) => Math.max(0.9, (4.6 - mag) * 0.85);

  /* ---------- sizing ---------- */
  function resize() {
    const w = wrap.clientWidth;
    if (!w) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = w;
    canvas.width = canvas.height = Math.round(w * dpr);
    Rc = w / 2 - 26; cx = w / 2; cy = w / 2;
    buildBg();
    zc.width = zc.clientWidth * dpr; zc.height = zc.clientHeight * dpr;
    renderInfo();
  }

  /* ---------- drawing ---------- */
  function line(a, b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  function isFav(key) { return favs.includes(key); }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const ox = cx + view.x, oy = cy + view.y, R = Rc * view.k;
    ctx.save();
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, 7); ctx.clip();
    ctx.drawImage(bg, ox - R, oy - R, R * 2, R * 2);

    // grid
    ctx.strokeStyle = "rgba(170,190,240,.12)"; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
    [60, 30, 0, -30, -60].forEach((d) => { ctx.beginPath(); ctx.arc(ox, oy, R * (90 - d) / (90 - DEC_MIN), 0, 7); ctx.stroke(); });
    for (let h = 0; h < 24; h += 2) line(toS(h * 15, 89), toS(h * 15, DEC_MIN));
    ctx.setLineDash([]);

    // tonight's horizon
    ctx.strokeStyle = "rgba(226,192,124,.35)"; ctx.setLineDash([6, 6]); ctx.beginPath();
    const phi = OBS.lat * D2R;
    for (let A = 0; A <= 360; A += 3) {
      const a = A * D2R;
      const sd = Math.cos(phi) * Math.cos(a), dec = Math.asin(sd);
      const H = Math.atan2(-Math.sin(a), -Math.sin(phi) * Math.cos(a)) / D2R;
      const [x, y] = toS(norm(LST - H), dec / D2R);
      A ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);

    // ecliptic
    if (mode === "planets") {
      ctx.strokeStyle = "rgba(244,226,180,.35)"; ctx.setLineDash([3, 4]); ctx.beginPath();
      for (let l = 0; l <= 360; l += 3) { const q = eclToEq(l, 0); const [x, y] = toS(q.ra, q.dec); l ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // constellations
    const dimOthers = selected && selected.type === "const" && view.k > 1.4;
    const compactLabels = mobileMap.matches && view.k <= 1.4;
    const labels = [];
    CONS.forEach((c) => {
      const isSel = selected && selected.type === "const" && selected.id === c.id;
      const isHov = hover && hover.type === "const" && hover.id === c.id;
      const fl = quiz.flash && quiz.flash.id === c.id ? quiz.flash.color : null;
      const pts = c.stars.map((s) => toS(s[1], s[2]));
      let a = mode === "const" || mode === "fav" ? 0.38 : 0.2;
      if (dimOthers && !isSel) a = 0.16;
      ctx.strokeStyle = fl || (isSel ? "rgba(244,226,180,.95)" : isHov ? "rgba(244,226,180,.8)" : `rgba(190,205,240,${a})`);
      ctx.lineWidth = isSel || fl ? 1.6 : isHov ? 1.3 : 1;
      c.lines.forEach(([i, j]) => line(pts[i], pts[j]));
      ctx.globalCompositeOperation = "lighter";
      c.stars.forEach((s, i) => {
        const tw = reduce ? 1 : 0.85 + 0.15 * Math.sin(time * 1.7 + s[1]);
        const r = starR(s[3]) * Math.sqrt(view.k) * (isSel ? 1.25 : 1);
        const g = r * 6 * tw;
        ctx.globalAlpha = dimOthers && !isSel ? 0.5 : 1;
        ctx.drawImage(GLOW, pts[i][0] - g / 2, pts[i][1] - g / 2, g, g);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (!quiz.on && (mode !== "deep" || isSel)) {
        const m = centroid(pts);
        const label = {
          text: c.name, x: m[0], y: isSel ? Math.min(...pts.map((q) => q[1])) - 16 : m[1] - 14,
          font: `${isSel ? 17 : 14}px "Montserrat", "Segoe UI", sans-serif`,
          color: isSel || isHov ? "#f4e2b4" : "rgba(220,215,200,.62)",
          priority: isSel ? 2 : isHov ? 1 : 0
        };
        if (compactLabels) labels.push(label); else drawConstellationLabel(label);
        if (isSel && view.k > 1.6) {
          ctx.font = '11px "Inter", sans-serif'; ctx.fillStyle = "rgba(244,226,180,.75)";
          c.stars.forEach((s, i) => { if (s[3] < 2.6) ctx.fillText(s[0], pts[i][0], pts[i][1] + 16); });
        }
      }
    });
    if (compactLabels) drawCompactLabels(labels);

    // deep sky
    if (mode === "deep" || mode === "fav") {
      DSO.forEach((o) => {
        if (mode === "fav" && !isFav("dso:" + o.id)) return;
        const [x, y] = toS(o.ra, o.dec);
        const isSel = selected && selected.type === "dso" && selected.id === o.id;
        const isHov = hover && hover.type === "dso" && hover.id === o.id;
        ctx.strokeStyle = isSel || isHov ? "#f4e2b4" : "rgba(168,195,234,.8)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(x, y, 7, 4.5, -0.5, 0, 7); ctx.stroke();
        ctx.font = '11px "Inter", sans-serif'; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = "left";
        ctx.fillText(o.code, x + 10, y + 4);
      });
    }

    // planets
    if (mode === "planets") {
      PLANETS.forEach((p) => {
        const [x, y] = toS(p.ra, p.dec);
        const isSel = selected && selected.type === "planet" && selected.id === p.id;
        const r = p.id === "sun" ? 7 : p.id === "moon" ? 6 : 4;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.6;
        ctx.drawImage(GLOW, x - r * 4, y - r * 4, r * 8, r * 8);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        if (p.id === "saturn") { ctx.strokeStyle = p.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, r * 2.3, r * 0.8, -0.35, 0, 7); ctx.stroke(); }
        if (isSel) { ctx.strokeStyle = "#f4e2b4"; ctx.beginPath(); ctx.arc(x, y, r + 6 + Math.sin(time * 3) * 1.5, 0, 7); ctx.stroke(); }
        ctx.font = '14px "Montserrat", "Segoe UI", sans-serif'; ctx.fillStyle = "#f4e2b4"; ctx.textAlign = "left";
        ctx.fillText(p.name, x + r + 6, y + 4);
      });
    }
    ctx.restore();

    // rim and hour labels
    ctx.strokeStyle = "rgba(236,230,214,.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = "rgba(236,230,214,.12)";
    ctx.beginPath(); ctx.arc(ox, oy, R + 8, 0, 7); ctx.stroke();
    ctx.font = '10px "Inter", sans-serif'; ctx.fillStyle = "rgba(205,199,184,.6)"; ctx.textAlign = "center";
    for (let h = 0; h < 24; h++) {
      const p = proj(h * 15, DEC_MIN); const len = Math.hypot(p.x, p.y);
      const x = ox + (p.x / len) * (R + 17), y = oy + (p.y / len) * (R + 17) + 3;
      if (x > 0 && x < size && y > 0 && y < size) ctx.fillText(h + "h", x, y);
    }
  }
  function drawConstellationLabel(label) {
    ctx.font = label.font; ctx.fillStyle = label.color; ctx.textAlign = "center";
    ctx.fillText(label.text, label.x, label.y);
  }
  function drawCompactLabels(labels) {
    const occupied = [];
    labels.sort((a, b) => b.priority - a.priority).forEach((label) => {
      ctx.font = label.font;
      const metrics = ctx.measureText(label.text);
      const bounds = {
        left: label.x - metrics.width / 2 - 4, right: label.x + metrics.width / 2 + 4,
        top: label.y - (metrics.actualBoundingBoxAscent || parseFloat(label.font)) - 3,
        bottom: label.y + (metrics.actualBoundingBoxDescent || 3) + 3
      };
      const overlaps = occupied.some((other) => bounds.left < other.right && bounds.right > other.left
        && bounds.top < other.bottom && bounds.bottom > other.top);
      // The active objects remain named even if they overlap one another.
      if (!label.priority && overlaps) return;
      drawConstellationLabel(label);
      occupied.push(bounds);
    });
  }
  function centroid(pts) {
    let x = 0, y = 0; pts.forEach((p) => { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }

  /* ---------- hit testing ---------- */
  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  }
  function hit(px, py) {
    let best = null, bd = 18;
    if (mode === "planets") PLANETS.forEach((p) => { const [x, y] = toS(p.ra, p.dec); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { type: "planet", id: p.id }; } });
    if (mode === "deep" || mode === "fav") DSO.forEach((o) => { if (mode === "fav" && !isFav("dso:" + o.id)) return; const [x, y] = toS(o.ra, o.dec); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { type: "dso", id: o.id }; } });
    if (best) return best;
    CONS.forEach((c) => {
      const pts = c.stars.map((s) => toS(s[1], s[2]));
      let d = Math.min(...pts.map((p) => Math.hypot(px - p[0], py - p[1])));
      c.lines.forEach(([i, j]) => { d = Math.min(d, segDist(px, py, pts[i], pts[j]) + 3); });
      if (d < bd) { bd = d; best = { type: "const", id: c.id }; }
    });
    return best;
  }

  /* ---------- camera ---------- */
  function focus(sel) {
    let pts;
    if (sel.type === "const") pts = CONS.find((c) => c.id === sel.id).stars.map((s) => proj(s[1], s[2]));
    else if (sel.type === "dso") { const o = DSO.find((x) => x.id === sel.id); pts = [proj(o.ra, o.dec)]; }
    else { const p = PLANETS.find((x) => x.id === sel.id); pts = [proj(p.ra, p.dec)]; }
    const m = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const ext = Math.max(0.04, ...pts.map((p) => Math.hypot(p.x - m.x, p.y - m.y)));
    const k = Math.max(1.6, Math.min(5, 0.32 / ext));
    target = { k, x: -m.x * Rc * k, y: -m.y * Rc * k };
  }
  function resetView() { target = { k: 1, x: 0, y: 0 }; }
  function zoomAt(f, mx, my) {
    target = null;
    const nk = Math.max(1, Math.min(6, view.k * f));
    const r = nk / view.k;
    view.x = mx - cx - (mx - cx - view.x) * r;
    view.y = my - cy - (my - cy - view.y) * r;
    view.k = nk;
    if (nk === 1) { view.x *= 0.5; view.y *= 0.5; }
  }

  /* ---------- pointer input ---------- */
  const pointers = new Map();
  let drag = null, pinch = 0;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) drag = { start: local(e), vx: view.x, vy: view.y, moved: false };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (drag) drag.moved = true;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    else if (pointers.size) return;
    if (pointers.size > 1) {
      if (pointers.size !== 2) return;
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoomAt(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      pinch = d; if (drag) drag.moved = true; return;
    }
    if (drag) {
      const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
      if (Math.hypot(dx, dy) > 4) { drag.moved = true; target = null; canvas.classList.add("dragging"); }
      if (drag.moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; }
      return;
    }
    hover = hit(p[0], p[1]);
    canvas.classList.toggle("hovering", !!hover);
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (e.type === "pointerup" && drag && !drag.moved && pointers.size === 0) click(local(e));
    if (pointers.size === 1) {
      drag = { start: [...pointers.values()][0], vx: view.x, vy: view.y, moved: true };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    if (pointers.size === 0) { drag = null; canvas.classList.remove("dragging"); }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => { hover = null; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); const p = local(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p[0], p[1]); }, { passive: false });
  $("zoomIn").onclick = () => zoomAt(1.4, cx, cy);
  $("zoomOut").onclick = () => zoomAt(1 / 1.4, cx, cy);
  $("zoomReset").onclick = resetView;

  function click(p) {
    const h = hit(p[0], p[1]);
    if (quiz.on) { answer(h); return; }
    if (!h) return;
    select(h, true);
  }
  function select(sel, fly, visit = true) {
    selected = sel;
    if (fly && mode !== "orrery" && sel.id !== "earth") focus(sel);
    renderInfo(); renderList();
    if (visit && sel.type === "planet") openStage(sel.id);
  }

  /* ---------- side list & modes ---------- */
  const listEl = $("smList");
  document.querySelectorAll(".sm-modes button").forEach((b) => b.addEventListener("click", () => {
    if (quiz.on) stopQuiz();
    mode = b.dataset.mode;
    document.querySelectorAll(".sm-modes button").forEach((x) => x.classList.toggle("active", x === b));
    closeStage();
    showOrrery(mode === "orrery");
    if (mode === "planets" || mode === "orrery") select({ type: "planet", id: "saturn" }, false, false);
    else if (mode === "deep") select({ type: "dso", id: "m42" }, false);
    resetView(); renderList();
  }));
  function listItems() {
    if (mode === "planets") return PLANETS.map((p) => ({ key: { type: "planet", id: p.id }, name: p.name, zh: p.zh }));
    if (mode === "orrery") return ["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"].map((k) => ({ key: { type: "planet", id: k }, name: WORLDS[k].name, zh: WORLDS[k].zh }));
    if (mode === "deep") return DSO.map((o) => ({ key: { type: "dso", id: o.id }, name: o.name, zh: o.code }));
    const cons = CONS.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ key: { type: "const", id: c.id }, name: c.name, zh: c.zh }));
    if (mode === "fav") {
      return [...cons, ...DSO.map((o) => ({ key: { type: "dso", id: o.id }, name: o.name, zh: o.code }))]
        .filter((it) => isFav(it.key.type + ":" + it.key.id));
    }
    return cons;
  }
  function renderList() {
    const items = listItems();
    listEl.innerHTML = items.length ? items.map((it, i) => `<li><button type="button" data-i="${i}" class="${selected && selected.type === it.key.type && selected.id === it.key.id ? "active" : ""}"><span>${esc(it.name)}</span><span class="zh">${esc(it.zh)}</span></button></li>`).join("")
      : `<li class="muted" style="padding:6px 12px;font-style:italic">Tap ☆ on a constellation to keep it here.</li>`;
    listEl.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const key = items[+b.dataset.i].key;
      if (quiz.on) answer(key); else select(key, true);
    };
  }

  /* ---------- info panel ---------- */
  const info = $("smInfo");
  function renderInfo() {
    if (!selected) return;
    let head = "", body = "", facts = [], key = selected.type + ":" + selected.id, favable = selected.type !== "planet";
    if (selected.type === "const") {
      const c = CONS.find((x) => x.id === selected.id);
      const bright = c.stars.reduce((a, s) => (s[3] < a[3] ? s : a));
      head = `<h2>${esc(c.name)} <span class="zh">${esc(c.zh)}</span></h2><p class="tagline">${esc(c.tagline)}</p>`;
      body = c.story;
      facts = [["Brightest", `${bright[0]} (mag ${bright[3]})`], ["Best seen", c.season], ["Stars drawn", c.stars.length]];
    } else if (selected.type === "dso") {
      const o = DSO.find((x) => x.id === selected.id);
      head = `<h2>${esc(o.name)} <span class="zh">${esc(o.code)}</span></h2><p class="tagline">${esc(o.kind)} · ${esc(o.dist)} away</p>`;
      body = o.text;
      const nc = nearestConstellation(o.ra, o.dec);
      facts = [["Type", o.kind], ["Distance", o.dist], ["In", nc ? nc.name : "—"]];
    } else {
      const p = PLANETS.find((x) => x.id === selected.id), w = WORLDS[selected.id] || {};
      const nc = p ? nearestConstellation(p.ra, p.dec) : null;
      head = `<h2>${esc(w.name || p.name)} <span class="zh">${esc(w.zh || p.zh)}</span></h2><p class="tagline">${p ? `Where it is today, ${now.toLocaleDateString("en", { day: "numeric", month: "long" })}.` : "Under your feet."}</p>`;
      body = (p && p.text) || w.text || "";
      facts = (w.rows || []).concat(p ? [["In the direction of", nc ? `${nc.name} ${nc.zh}` : "—"]] : []);
    }
    info.querySelector(".info-head").innerHTML = head;
    info.querySelector(".story").textContent = body;
    info.querySelector(".facts").innerHTML = facts.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join("");
    const fb = info.querySelector(".fav-btn");
    fb.hidden = !favable;
    fb.setAttribute("aria-pressed", isFav(key));
    fb.innerHTML = (isFav(key) ? ICON.starF : ICON.starO) + (isFav(key) ? "In my favorites" : "Add to my favorites");
    drawZoom();
  }
  info.querySelector(".fav-btn").addEventListener("click", () => {
    const key = selected.type + ":" + selected.id;
    favs = isFav(key) ? favs.filter((k) => k !== key) : [...favs, key];
    store.set("sky-favs", favs);
    renderInfo(); if (mode === "fav") renderList();
  });

  function drawZoom() {
    const W = zc.width, H = zc.height;
    if (!W) return;
    const z = zctx;
    z.setTransform(1, 0, 0, 1, 0, 0);
    z.clearRect(0, 0, W, H);
    const r = rng(selected.id.length * 977 + selected.id.charCodeAt(0));
    for (let i = 0; i < 160; i++) { z.fillStyle = `rgba(230,230,255,${(r() * 0.5).toFixed(2)})`; z.fillRect(r() * W, r() * H, dpr, dpr); }
    z.globalCompositeOperation = "lighter";
    if (selected.type === "const") {
      const c = CONS.find((x) => x.id === selected.id);
      const ra0 = c.stars.reduce((a, s) => a + s[1], 0) / c.stars.length;
      const dec0 = c.stars.reduce((a, s) => a + s[2], 0) / c.stars.length;
      const wrapD = (d) => ((d + 540) % 360) - 180;
      let pts;
      if (dec0 > 70) pts = c.stars.map((s) => { const p = proj(s[1], s[2]); return [p.x, p.y]; });
      else pts = c.stars.map((s) => [-wrapD(s[1] - ra0) * Math.cos(dec0 * D2R), -(s[2] - dec0)]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const pad = 34 * dpr, sc = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1));
      const P = pts.map(([x, y]) => [W / 2 + (x - (minX + maxX) / 2) * sc, H / 2 + (y - (minY + maxY) / 2) * sc]);
      z.globalCompositeOperation = "source-over";
      z.strokeStyle = "rgba(244,226,180,.75)"; z.lineWidth = 1.2 * dpr;
      c.lines.forEach(([i, j]) => { z.beginPath(); z.moveTo(P[i][0], P[i][1]); z.lineTo(P[j][0], P[j][1]); z.stroke(); });
      z.globalCompositeOperation = "lighter";
      c.stars.forEach((s, i) => { const g = starR(s[3]) * 9 * dpr; z.drawImage(GLOW, P[i][0] - g / 2, P[i][1] - g / 2, g, g); });
      z.globalCompositeOperation = "source-over";
      z.font = `${11 * dpr}px Inter, sans-serif`; z.fillStyle = "rgba(205,199,184,.8)"; z.textAlign = "center";
      c.stars.forEach((s, i) => { if (s[3] < 3.2) z.fillText(s[0], P[i][0], P[i][1] + 17 * dpr); });
    } else if (selected.type === "dso") {
      const o = DSO.find((x) => x.id === selected.id);
      const X = W / 2, Y = H / 2;
      if (o.kind.includes("Galaxy")) {
        z.save(); z.translate(X, Y); z.rotate(-0.5); z.scale(1, 0.38);
        const g = z.createRadialGradient(0, 0, 0, 0, 0, W * 0.38);
        g.addColorStop(0, "rgba(255,240,215,.95)"); g.addColorStop(0.15, "rgba(230,215,240,.45)"); g.addColorStop(1, "rgba(120,140,220,0)");
        z.fillStyle = g; z.beginPath(); z.arc(0, 0, W * 0.38, 0, 7); z.fill(); z.restore();
      } else if (o.kind.includes("cluster")) {
        for (let i = 0; i < (o.kind.startsWith("Globular") ? 900 : 60); i++) {
          const a = r() * 7, d = (o.kind.startsWith("Globular") ? Math.pow(r(), 2) : r()) * H * 0.35;
          const g = (o.kind.startsWith("Globular") ? 3 : 6 + r() * 14) * dpr;
          z.drawImage(GLOW, X + Math.cos(a) * d - g / 2, Y + Math.sin(a) * d - g / 2, g, g);
        }
      } else {
        for (let i = 0; i < 70; i++) {
          const a = r() * 7, d = r() * H * 0.3, rad = (20 + r() * 50) * dpr;
          const col = o.kind.includes("Planetary") ? (d < H * 0.12 ? "80,200,220" : "230,110,120") : r() < 0.5 ? "230,110,150" : "120,150,240";
          const x = X + Math.cos(a) * d * (o.kind.includes("Planetary") ? 0.6 : 1.3), y = Y + Math.sin(a) * d * 0.7;
          const g = z.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, `rgba(${col},.12)`); g.addColorStop(1, `rgba(${col},0)`);
          z.fillStyle = g; z.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
      }
    } else {
      const p = PLANETS.find((x) => x.id === selected.id) || { id: selected.id, color: "#5f9fd8" };
      const R = H * 0.28, X = W / 2, Y = H / 2;
      z.globalCompositeOperation = "source-over";
      const g = z.createRadialGradient(X - R * 0.35, Y - R * 0.35, R * 0.1, X, Y, R);
      g.addColorStop(0, "#fff"); g.addColorStop(0.25, p.color); g.addColorStop(1, "#0c0f1c");
      z.fillStyle = g; z.beginPath(); z.arc(X, Y, R, 0, 7); z.fill();
      if (p.id === "saturn") { z.strokeStyle = "rgba(236,210,142,.8)"; z.lineWidth = 6 * dpr; z.beginPath(); z.ellipse(X, Y, R * 2, R * 0.55, -0.3, 0, 7); z.stroke(); }
    }
    z.globalCompositeOperation = "source-over";
  }

  /* ---------- quiz ---------- */
  const qbar = $("quizBar");
  $("playQuiz").addEventListener("click", () => (quiz.on ? stopQuiz() : startQuiz()));
  function cancelNextRound() {
    clearTimeout(quiz.timer); quiz.timer = 0; quiz.generation++;
    quiz.flash = null; quiz.lock = false;
  }
  function startQuiz() {
    cancelNextRound();
    mode = "const";
    document.querySelectorAll(".sm-modes button").forEach((x) => x.classList.toggle("active", x.dataset.mode === "const"));
    quiz.on = true; quiz.round = 0; quiz.score = 0; quiz.lock = false;
    quiz.order = CONS.map((c) => c.id).sort(() => Math.random() - 0.5).slice(0, 8);
    selected = null; closeStage(); showOrrery(false); resetView(); renderList();
    $("playQuiz").innerHTML = ICON.close + "Stop the game";
    ask();
  }
  function stopQuiz() {
    cancelNextRound();
    quiz.on = false; qbar.classList.remove("on", "right", "wrong");
    $("playQuiz").innerHTML = ICON.target + "Find the constellation";
    selected = { type: "const", id: "ori" }; renderInfo(); renderList();
  }
  function ask() {
    const c = CONS.find((x) => x.id === quiz.order[quiz.round]);
    qbar.className = "quiz-bar glass on";
    qbar.innerHTML = `<div class="q">Find <b>${esc(c.zh)} · ${esc(c.name)}</b></div><small>Round ${quiz.round + 1} / ${quiz.order.length} · Score ${quiz.score}</small>`;
  }
  function answer(h) {
    if (!quiz.on || quiz.lock || !h || h.type !== "const") return;
    const want = quiz.order[quiz.round];
    const ok = h.id === want;
    quiz.lock = true;
    if (ok) quiz.score++;
    quiz.flash = { id: want, color: ok ? "rgba(140,230,160,.95)" : "rgba(244,140,120,.95)" };
    qbar.classList.add(ok ? "right" : "wrong");
    if (!ok) { selected = { type: "const", id: want }; focus(selected); }
    const generation = quiz.generation;
    quiz.timer = setTimeout(() => {
      if (!quiz.on || quiz.generation !== generation) return;
      quiz.timer = 0;
      quiz.flash = null; quiz.lock = false; quiz.round++;
      selected = null; resetView();
      if (quiz.round < quiz.order.length) ask(); else finish();
    }, ok ? 900 : 1900);
  }
  function finish() {
    const best = Math.max(store.get("sky-best", 0), quiz.score);
    store.set("sky-best", best);
    qbar.className = "quiz-bar glass on";
    const lines = ["The sky is still a stranger, but it's patient.", "A few old friends already.", "You could navigate by night.", "The stars know your name."];
    qbar.innerHTML = `<div class="q">You found <b>${quiz.score} / ${quiz.order.length}</b></div><small>${lines[Math.min(3, Math.floor(quiz.score / 2.1))]} · Best ${best}</small>`;
    quiz.on = false;
    $("playQuiz").innerHTML = ICON.target + "Play again";
    setTimeout(() => { if (!quiz.on) qbar.classList.remove("on"); }, 6000);
    selected = { type: "const", id: "ori" }; renderInfo();
  }

  /* ---------- loop ---------- */
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000); last = t; time += dt;
    if (document.hidden || !bg || mode === "orrery") return;
    if (target) {
      const f = 1 - Math.pow(0.002, dt);
      view.k += (target.k - view.k) * f; view.x += (target.x - view.x) * f; view.y += (target.y - view.y) * f;
      if (Math.abs(target.k - view.k) < 0.002 && Math.abs(target.x - view.x) < 0.3) target = null;
    }
    draw();
  }

  /* ---------- a world up close ---------- */
  const stage = $("planetStage");
  const globe = window.PlanetGlobe ? PlanetGlobe.create($("globe")) : null;
  function openStage(id) {
    if (!globe || !PlanetGlobe.has(id) || quiz.on) return;
    const w = WORLDS[id] || {};
    $("psName").innerHTML = `${esc(w.name || id)} <span class="zh">${esc(w.zh || "")}</span>`;
    $("psSub").textContent = (w.rows || []).slice(0, 3).map((r) => r[1]).join(" · ");
    const moons = globe.moons(id);
    $("psMoons").textContent = moons.length ? "Orbiting: " + moons.join(" · ") : id === "sun" ? "Granulation, sunspots and the corona" : "";
    globe.show(id);
    stage.hidden = false;
    globe.start();
  }
  function closeStage() { if (stage.hidden) return; stage.hidden = true; if (globe) globe.stop(); }
  $("psClose").addEventListener("click", closeStage);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeStage(); });

  /* ---------- the solar system and Cassini's journey ---------- */
  const oc = $("orrery"), bar = $("orreryBar"), cap = $("journeyCaption");
  let lastDate = "";
  const orrery = window.Orrery ? Orrery.create(oc, {
    onPick: (k) => select({ type: "planet", id: k }, false),
    onDate: (txt) => { if (txt !== lastDate) { lastDate = txt; $("oDate").textContent = txt; } },
    onCaption: (c) => {
      cap.classList.toggle("on", !!c);
      if (c) cap.innerHTML = `<small>${esc(c.date)}</small><b>${esc(c.title)}</b><span>${esc(c.text)}</span>`;
    },
    onJourney: (on) => {
      $("oExit").hidden = !on;
      ["oSlower", "oFaster", "oSpeed"].forEach((id) => ($(id).hidden = on));
      $("cassiniBtn").classList.toggle("active", on);
    }
  }) : null;
  const speedLabel = () => { const v = orrery.speed; $("oSpeed").textContent = v >= 365 ? (v / 365).toFixed(v >= 730 ? 0 : 1) + " yr/s" : Math.round(v) + " days/s"; };
  function showOrrery(on) {
    if (!orrery) return;
    oc.hidden = !on; bar.hidden = !on;
    canvas.style.visibility = on ? "hidden" : "";
    document.querySelector(".chart-ctrl").style.display = on ? "none" : "";
    $("chartNote").style.display = on ? "none" : "";
    $("playQuiz").style.display = on ? "none" : "";
    if (on) { orrery.start(); speedLabel(); } else { if (orrery.inJourney) orrery.endJourney(); orrery.stop(); cap.classList.remove("on"); }
  }
  if (orrery) {
    $("oPlay").addEventListener("click", () => { const p = orrery.play(); $("oPlay").textContent = p ? "❚❚" : "▶"; $("oPlay").setAttribute("aria-label", p ? "Pause" : "Play"); });
    $("oFaster").addEventListener("click", () => { orrery.faster(); speedLabel(); });
    $("oSlower").addEventListener("click", () => { orrery.slower(); speedLabel(); });
    $("oExit").addEventListener("click", () => orrery.endJourney());
    $("cassiniBtn").addEventListener("click", () => {
      if (quiz.on) stopQuiz();
      closeStage();
      if (mode !== "orrery") document.querySelector('.sm-modes button[data-mode="orrery"]').click();
      orrery.journey();
      orrery.play(true);
      $("oPlay").textContent = "❚❚";
    });
  } else $("cassiniBtn").hidden = true;

  $("chartNote").textContent = `Oriented to tonight's sky over ${OBS.place} · dashed gold line: horizon`;
  $("playQuiz").innerHTML = ICON.target + "Find the constellation";
  addEventListener("resize", () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 150); });
  resize();
  renderList();
  requestAnimationFrame(frame);
})();
