/* =====================================================================
   Orrery & Cassini's journey.

   A top-down solar system on a square-root distance scale (so Neptune
   fits while the inner planets stay readable). Planets move on their
   real elliptical orbits from mean orbital elements; time runs at a
   chosen speed and you can click a planet.

   Cassini's journey replays the mission on real dates:
     cruise (1997-10-15 → 2004-07-01): the spacecraft threads the actual
       gravity-assist sequence, Venus · Venus · Earth · Jupiter → Saturn,
       meeting each planet where it really was on the flyby date
     tour (2004 → 2017): the view drops into the Saturn system, seen from
       above the pole; petal-shaped orbits build up, Huygens lands on
       Titan, the ring-grazing orbits, the 22 Grand Finale dives, and the
       final plunge into Saturn on 15 September 2017.
   The cruise path between flybys is a smooth interpolation (not an
   integrated trajectory), but every flyby happens at the right place
   and time.
   ===================================================================== */
(function () {
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const norm = (a) => ((a % 360) + 360) % 360;
  const day = (iso) => Date.parse(iso + "T12:00:00Z") / 86400000 + 2440587.5 - 2451545.0;   // days since J2000
  const dateOf = (d) => new Date((d + 2451545.0 - 2440587.5) * 86400000);
  const fmt = (d) => dateOf(d).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

  // mean elements: L0 (°), daily motion (°/day), a (AU), e, longitude of perihelion (°), colour, dot radius, name
  const EL = {
    mercury: [252.25, 4.09233, 0.387, 0.2056, 77.46, "#bdb2a6", 2.6, "Mercury"],
    venus: [181.98, 1.60213, 0.723, 0.0068, 131.6, "#ecd9a8", 3.8, "Venus"],
    earth: [100.46, 0.985647, 1, 0.0167, 102.9, "#6fa8e6", 4, "Earth"],
    mars: [355.43, 0.524033, 1.524, 0.0934, 336.04, "#e07a52", 3.2, "Mars"],
    jupiter: [34.35, 0.083091, 5.203, 0.0484, 14.75, "#e3c9a2", 7.5, "Jupiter"],
    saturn: [50.08, 0.03346, 9.537, 0.0539, 92.43, "#ecd28e", 6.5, "Saturn"],
    uranus: [314.06, 0.011733, 19.19, 0.0473, 170.96, "#a9e1e6", 5, "Uranus"],
    neptune: [304.35, 0.005965, 30.07, 0.0086, 44.97, "#7a9cf0", 4.8, "Neptune"]
  };
  function helio(k, d) {
    const [L0, n, a, e, w] = EL[k];
    const M = (norm(L0 + n * d) - w) * D2R;
    const v = M + (2 * e - (e * e * e) / 4) * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M);
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(v));
    return { r, lon: v + w * D2R };
  }

  /* ---------- Cassini's cruise ---------- */
  const FLYBYS = [["1997-10-15", "earth", "Launch · Cape Canaveral"], ["1998-04-26", "venus", "Venus flyby 1"], ["1999-06-24", "venus", "Venus flyby 2"],
    ["1999-08-18", "earth", "Earth flyby"], ["2000-12-30", "jupiter", "Jupiter flyby"], ["2004-07-01", "saturn", "Saturn orbit insertion"]];
  const BULGE = [-0.05, 0.85, 0.02, 0.35, 0.6];           // how far each leg swings outward between flybys (AU)
  const NODES = FLYBYS.map(([iso, body, label]) => { const d = day(iso), p = helio(body, d); return { d, r: p.r, lon: p.lon, body, label, iso }; });
  NODES[0].lonU = NODES[0].lon;
  for (let i = 1; i < NODES.length; i++) {
    // choose how many extra laps a leg makes so its average angular speed is roughly Keplerian
    const a = NODES[i - 1], b = NODES[i], days = b.d - a.d;
    const base = (((b.lon - a.lon) % TAU) + TAU) % TAU;
    const rm = (a.r + b.r) / 2 + BULGE[i - 1] * 0.6;
    const expected = days * 0.017202 * Math.pow(rm, -1.5);
    let best = base;
    for (let k = 1; k < 4; k++) if (Math.abs(base + k * TAU - expected) < Math.abs(best - expected)) best = base + k * TAU;
    b.lonU = a.lonU + best;
  }
  const LAUNCH = NODES[0].d, SOI = NODES[NODES.length - 1].d, END = day("2017-09-15");
  function cassini(d) {
    if (d <= LAUNCH) return { r: NODES[0].r, lon: NODES[0].lon };
    if (d >= SOI) return helio("saturn", d);
    let i = 0; while (d > NODES[i + 1].d) i++;
    const a = NODES[i], b = NODES[i + 1], s = (d - a.d) / (b.d - a.d);
    // faster near the Sun, slower far out: ease the angle with the radius profile
    const r = a.r + (b.r - a.r) * smooth(0, 1, s) + BULGE[i] * Math.sin(Math.PI * s);
    const sk = s + (BULGE[i] > 0.2 ? -0.08 * Math.sin(TAU * s) : 0);
    return { r, lon: a.lonU + (b.lonU - a.lonU) * sk };
  }

  /* ---------- the tour around Saturn (radii of Saturn, seen from above the pole) ---------- */
  const TOUR = [];
  (function () {
    const seg = (n, from, to, q0, q1, Q0, Q1, w0, dw, name) => {
      for (let i = 0; i < n; i++) {
        const f = n > 1 ? i / (n - 1) : 0;
        TOUR.push({ q: q0 + (q1 - q0) * f, Q: Q0 + (Q1 - Q0) * f * (0.6 + 0.4 * Math.sin(i * 1.7) ** 2), w: w0 + dw * i, name, d0: from + (to - from) * (i / n), d1: from + (to - from) * ((i + 1) / n) });
      }
    };
    seg(20, day("2004-07-01"), day("2008-07-01"), 4.5, 3.4, 48, 26, 0.3, 0.42, "prime");
    seg(8, day("2008-07-01"), day("2010-09-27"), 3.2, 3.8, 22, 18, 2.6, 0.55, "equinox");
    seg(14, day("2010-09-27"), day("2016-11-30"), 3.6, 4.4, 30, 20, 5.4, 0.36, "solstice");
    seg(10, day("2016-11-30"), day("2017-04-22"), 2.45, 2.42, 17, 17, 1.2, 0.05, "grazing");
    seg(12, day("2017-04-26"), day("2017-09-11"), 1.06, 1.05, 21, 21, 1.6, 0.04, "finale");
  })();
  const PHASE2 = day("2004-07-01");
  const TOUR_SECONDS = { prime: 10, equinox: 4, solstice: 7, grazing: 3.5, finale: 5 };

  const CAPTIONS = [
    ["1997-10-15", "Launch · Cape Canaveral", "Too heavy to fly straight to Saturn, Cassini borrows speed from planets."],
    ["1998-04-26", "Venus flyby 1", "Swinging past Venus to gain energy."],
    ["1999-06-24", "Venus flyby 2", "A second pass, 600 km above the clouds of Venus."],
    ["1999-08-18", "Earth flyby", "Home, one last time, 1,171 km over the Pacific."],
    ["2000-12-30", "Jupiter flyby", "Photographing Jupiter together with the Galileo orbiter."],
    ["2004-06-11", "Phoebe flyby", "First close look at Saturn's dark outer moon."],
    ["2004-07-01", "Saturn orbit insertion", "Through the gap between the F and G rings, into orbit."],
    ["2004-12-25", "Huygens released", "The European probe leaves for Titan."],
    ["2005-01-14", "Huygens lands on Titan", "The first landing in the outer solar system."],
    ["2005-07-14", "Enceladus", "Geysers of ice spray from its south pole, an ocean below."],
    ["2006-07-22", "Lakes on Titan", "Seas of liquid methane and ethane."],
    ["2008-07-01", "Equinox mission", "The first extension: sunlight edge-on to the rings."],
    ["2010-09-27", "Solstice mission", "Seven more years, to watch the seasons turn."],
    ["2015-10-28", "Through the plume", "The deepest dive through Enceladus' spray, 49 km up."],
    ["2016-11-30", "Ring-grazing orbits", "Twenty orbits skimming the outer edge of the main rings."],
    ["2017-04-26", "The Grand Finale", "Twenty-two dives through the gap between the rings and Saturn."],
    ["2017-09-15", "Into Saturn", "Final signal at 11:55 UTC. Cassini became part of Saturn."]
  ].map(([iso, k, t]) => [day(iso), k, t]);

  function create(canvas, opts = {}) {
    const ctx = canvas.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;
    const today = Date.now() / 86400000 + 2440587.5 - 2451545.0;
    let d = today, speed = 20, playing = true, running = false, raf = 0, last = 0, hover = null;
    let amax = 32, amaxT = 32;              // distance scale (AU at the rim)
    let J = null;                            // journey state
    const belt = Array.from({ length: 420 }, () => ({ a: 2.2 + Math.random() * 1.1, l0: Math.random() * 360, w: Math.random() }));
    let stars = null;

    function fit() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!w) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        stars = document.createElement("canvas"); stars.width = canvas.width; stars.height = canvas.height;
        const s = stars.getContext("2d");
        for (let i = 0; i < 360; i++) { s.fillStyle = `rgba(230,232,255,${(Math.random() * 0.6).toFixed(2)})`; s.fillRect(Math.random() * stars.width, Math.random() * stars.height, dpr, dpr); }
      }
      W = w; H = h; cx = W / 2; cy = H / 2; R = Math.min(W, H) * 0.46;
    }
    const map = (r, lon) => { const f = R * Math.sqrt(r / amax); return [cx + f * Math.cos(lon), cy - f * Math.sin(lon)]; };

    function glow(x, y, rad, rgb, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    function planetDot(k, x, y, sunAng, big) {
      const c = EL[k][5], r = EL[k][6] * (big || 1);
      if (k === "saturn") { ctx.strokeStyle = "rgba(236,210,142,.75)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, r * 2.1, r * 0.75, -0.4, 0, TAU); ctx.stroke(); }
      const g = ctx.createRadialGradient(x - Math.cos(sunAng) * r * 0.5, y + Math.sin(sunAng) * r * 0.5, r * 0.1, x, y, r * 1.1);
      g.addColorStop(0, "#fffbee"); g.addColorStop(0.35, c); g.addColorStop(1, "#11141f");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }

    // every name on the map goes through one layout pass, so none of them collide
    let tags = [], blocks = [];
    const tag = (text, x, y, r, size, serif, color, pri) => tags.push({ text, x, y, r, size, serif, color, pri });
    const block = (x, y, r) => blocks.push([x - r, y + r, r * 2, r * 2]);      // somewhere no name should sit
    function placeTags() {
      const placed = tags.map((t) => [t.x - t.r, t.y + t.r, t.r * 2, t.r * 2]).concat(blocks);   // the dots themselves
      tags.sort((a, b) => b.pri - a.pri);
      ctx.textAlign = "left";
      for (const t of tags) {
        ctx.font = t.serif ? `${t.size}px "Montserrat", "Segoe UI", sans-serif` : `${t.size}px "Inter", sans-serif`;
        const tw = ctx.measureText(t.text).width, th = t.size * 0.82, r = t.r + 4, { x, y } = t;
        const spots = [[x + r, y + th / 2], [x - r - tw, y + th / 2], [x + r * 0.7, y - r * 0.7], [x + r * 0.7, y + r * 0.7 + th],
          [x - tw / 2, y + r + th], [x - tw / 2, y - r - 1], [x - r * 0.7 - tw, y - r * 0.7], [x - r * 0.7 - tw, y + r * 0.7 + th]];
        const own = (q) => q[0] === x - t.r && q[1] === y + t.r;
        const spot = spots.find(([lx, ly]) => lx > 4 && lx + tw < W - 4 && ly - th > 4 && ly < H - 4 &&
          !placed.some((q) => !own(q) && lx < q[0] + q[2] + 3 && lx + tw + 3 > q[0] && ly - th - 2 < q[1] && ly + 2 > q[1] - q[3]));
        if (!spot) continue;
        placed.push([spot[0], spot[1], tw, th]);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, spot[0], spot[1]);
      }
      tags = []; blocks = [];
    }

    /* ---------- the solar system ---------- */
    function drawSystem(dd, labels) {
      ctx.globalCompositeOperation = "lighter";
      glow(cx, cy, R * 0.16, "255,200,110", 0.55); glow(cx, cy, R * 0.05, "255,240,200", 1);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff3c8"; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
      block(cx, cy, R * 0.07);
      // the asteroid belt
      ctx.fillStyle = "rgba(200,190,170,.35)";
      for (const b of belt) {
        const lon = (b.l0 + 0.9856 * Math.pow(b.a, -1.5) * dd) * D2R, [x, y] = map(b.a, lon);
        ctx.fillRect(x, y, 1, 1);
      }
      const pos = {};
      for (const k of Object.keys(EL)) {
        const [, , a, e, w] = EL[k];
        if (a > amax * 1.05) continue;
        ctx.strokeStyle = hover === k ? "rgba(244,226,180,.55)" : "rgba(170,190,240,.16)"; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const v = (i / 120) * TAU, r = (a * (1 - e * e)) / (1 + e * Math.cos(v)), [x, y] = map(r, v + w * D2R);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        const p = helio(k, dd), [x, y] = map(p.r, p.lon);
        pos[k] = [x, y];
        planetDot(k, x, y, p.lon, hover === k ? 1.35 : 1);
        if (labels) tag(EL[k][7], x, y, EL[k][6] * (hover === k ? 1.35 : 1) + 1, hover === k ? 15 : 13, true, hover === k ? "#f4e2b4" : "rgba(220,215,200,.7)", hover === k ? 9 : 1);
      }
      return pos;
    }

    /* ---------- the journey ---------- */
    function startJourney() {
      J = { phase: 1, d: LAUNCH, trail: [], t2: 0, orbitsDone: 0, flash: 0, end: 0, huygens: null, landed: false, caption: -1 };
      for (let x = LAUNCH; x <= SOI; x += 2) J.trail.push(cassini(x));
      d = LAUNCH; amaxT = 11; playing = true;
      opts.onJourney && opts.onJourney(true);
    }
    function stopJourney() { J = null; amaxT = 32; d = today; speed = 20; opts.onJourney && opts.onJourney(false); setCaption(null); }
    function setCaption(c) { if (opts.onCaption) opts.onCaption(c); }
    function updateCaption(dd) {
      let i = -1; for (let k = 0; k < CAPTIONS.length; k++) if (dd >= CAPTIONS[k][0]) i = k;
      if (i !== J.caption) { J.caption = i; setCaption(i >= 0 ? { date: fmt(CAPTIONS[i][0]), title: CAPTIONS[i][1], text: CAPTIONS[i][2] } : null); }
    }
    function cruiseSpeed(dd) {            // days per second, slowing near each flyby
      let near = 1e9; for (const n of NODES) near = Math.min(near, Math.abs(dd - n.d));
      return 22 + 70 * smooth(10, 80, near);
    }
    function drawCruise(dt) {
      if (playing) J.d = Math.min(SOI, J.d + cruiseSpeed(J.d) * dt);
      const pos = drawSystem(J.d, true);
      // the path so far
      const n = Math.min(J.trail.length, Math.floor((J.d - LAUNCH) / 2) + 1);
      ctx.lineCap = "round";
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? "rgba(255,232,170,.95)" : "rgba(255,190,90,.25)"; ctx.lineWidth = pass ? 1.4 : 5;
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const [x, y] = map(J.trail[i].r, J.trail[i].lon); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      // flybys already passed
      NODES.forEach((nd) => {
        if (J.d < nd.d) return;
        const [x, y] = map(nd.r, nd.lon);
        ctx.strokeStyle = "rgba(244,226,180,.8)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
        tag(nd.label, x, y, 9, 11, false, "rgba(244,226,180,.85)", 2);
      });
      const c = cassini(J.d), [sx, sy] = map(c.r, c.lon);
      ctx.globalCompositeOperation = "lighter"; glow(sx, sy, 16, "255,226,160", 0.9); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, TAU); ctx.fill();
      tag("Cassini", sx, sy, 5, 14, true, "#fff4d6", 5);
      updateCaption(J.d);
      if (J.d >= SOI) { J.hold = (J.hold || 0) + dt; if (J.hold > 1.8) { J.phase = 2; J.t2 = 0; } }
      return pos;
    }

    /* Saturn seen from above its north pole, pre-rendered */
    let saturnTop = null;
    // Saturn's rings outward from the cloud tops (radii of Saturn): C, B, the Cassini division, A with the Encke gap, F
    const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    function ringProfile(r) {
      if (r < 1.24 || r > 2.33) return [0, 0, 0, 0];
      if (r < 1.53) return [150, 132, 112, 0.35 + (0.15 * (r - 1.24)) / 0.29];
      const i = Math.floor(r / 0.03);
      if (r < 1.95) return [228 + 18 * hash(i), 208 + 16 * hash(i), 172 + 14 * hash(i), 0.78 + 0.16 * hash(i + 50)];
      if (r < 2.03) return [80, 70, 60, 0.18];
      if (r < 2.27) return Math.abs(r - 2.215) < 0.004 ? [40, 36, 34, 0.15] : [204 + 14 * hash(i + 100), 188 + 12 * hash(i + 100), 160 + 12 * hash(i + 100), 0.58 + 0.1 * hash(i + 150)];
      if (r > 2.312 && r < 2.326) return [225, 214, 194, 0.55];
      return [0, 0, 0, 0];
    }
    function makeSaturnTop(px) {
      const c = document.createElement("canvas"); c.width = c.height = Math.ceil(px * 2 * 2.4);
      const g = c.getContext("2d"), m = c.width / 2;
      // rings in one sweep, filtered to one colour stop per pixel so the edges stay soft at any size
      const r0 = 1.24, r1 = 2.34, rg = g.createRadialGradient(m, m, r0 * px, m, m, r1 * px);
      const N = Math.max(24, Math.min(320, Math.ceil((r1 - r0) * px))), hw = (r1 - r0) / N / 2;
      let rgb = "150,132,112";                                     // transparent stops keep their neighbour’s colour (no dark fringes)
      for (let i = 0; i <= N; i++) {
        const r = r0 + ((r1 - r0) * i) / N;
        let cr = 0, cg = 0, cb = 0, ca = 0;
        for (let j = 0; j < 6; j++) { const p = ringProfile(r - hw + (hw * 2 * (j + 0.5)) / 6); cr += p[0] * p[3]; cg += p[1] * p[3]; cb += p[2] * p[3]; ca += p[3]; }
        if (ca) rgb = `${Math.round(cr / ca)},${Math.round(cg / ca)},${Math.round(cb / ca)}`;
        rg.addColorStop(i / N, `rgba(${rgb},${(ca / 6).toFixed(3)})`);
      }
      g.fillStyle = rg; g.beginPath(); g.arc(m, m, r1 * px, 0, TAU); g.arc(m, m, r0 * px, 0, TAU, true); g.fill();
      // the planet's shadow falls across the rings, away from the sun (on the left)
      g.save(); g.globalCompositeOperation = "source-atop";
      const sg = g.createLinearGradient(0, m - px, 0, m + px);
      sg.addColorStop(0, "rgba(4,6,14,0)"); sg.addColorStop(0.08, "rgba(4,6,14,.78)"); sg.addColorStop(0.92, "rgba(4,6,14,.78)"); sg.addColorStop(1, "rgba(4,6,14,0)");
      g.fillStyle = sg; g.fillRect(m, m - px, c.width, px * 2);
      g.restore();
      // the planet: concentric cloud bands around the pole, the hexagon, the polar vortex
      const pg = g.createRadialGradient(m, m, 0, m, m, px);
      pg.addColorStop(0, "#5f6a78"); pg.addColorStop(0.18, "#7c8590"); pg.addColorStop(0.35, "#b8a07a"); pg.addColorStop(0.55, "#e2cf9e"); pg.addColorStop(0.75, "#d4b886"); pg.addColorStop(1, "#c9aa76");
      g.fillStyle = pg; g.beginPath(); g.arc(m, m, px, 0, TAU); g.fill();
      for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(${k % 2 ? "255,240,210" : "120,90,60"},.12)`; g.lineWidth = px * 0.03; g.beginPath(); g.arc(m, m, px * (0.4 + k * 0.065), 0, TAU); g.stroke(); }
      g.strokeStyle = "rgba(150,170,190,.55)"; g.lineWidth = px * 0.035; g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (k / 6) * TAU + 0.3, x = m + Math.cos(a) * px * 0.3, y = m + Math.sin(a) * px * 0.3; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.fillStyle = "#3d4652"; g.beginPath(); g.arc(m, m, px * 0.06, 0, TAU); g.fill();
      // night half: the sun is to the left
      const sh = g.createLinearGradient(m - px, 0, m + px, 0);
      sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(0.55, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.65)");
      g.save(); g.beginPath(); g.arc(m, m, px, 0, TAU); g.clip(); g.fillStyle = sh; g.fillRect(m - px, m - px, px * 2, px * 2); g.restore();
      return { c, px };
    }
    function kepler(M, e) { let E = M; for (let i = 0; i < 6; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
    function pointAtE(o, E) {
      const a = (o.q + o.Q) / 2, e = (o.Q - o.q) / (o.Q + o.q);
      const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      const r = a * (1 - e * Math.cos(E));
      return { x: r * Math.cos(nu + o.w), y: r * Math.sin(nu + o.w), r };
    }
    const anomaly = (o, frac) => kepler(frac * TAU + Math.PI, (o.Q - o.q) / (o.Q + o.q));   // orbits start at apoapsis
    const orbitPoint = (o, frac) => pointAtE(o, anomaly(o, frac));
    function tourAt(t) {                  // seconds into the tour -> orbit index and fraction
      let acc = 0;
      for (const name of Object.keys(TOUR_SECONDS)) {
        const list = TOUR.filter((o) => o.name === name), dur = TOUR_SECONDS[name];
        if (t < acc + dur) { const f = ((t - acc) / dur) * list.length, i = Math.floor(f); return { o: list[i], idx: TOUR.indexOf(list[i]), frac: f - i, done: false }; }
        acc += dur;
      }
      return { o: TOUR[TOUR.length - 1], idx: TOUR.length - 1, frac: 1, done: true };
    }
    function drawTour(dt) {
      if (playing) J.t2 += dt;
      const st = tourAt(J.t2);
      const o = st.o, dd = o.d0 + (o.d1 - o.d0) * st.frac;
      J.d = st.done ? END : dd;
      const finale = o.name === "finale" || st.done;
      // drop in close for the Grand Finale
      const span = 26 - 13 * (st.done ? 1 : smooth(24.5, 27.5, J.t2));
      J.span = J.span ? J.span + (span - J.span) * Math.min(1, dt * 1.5) : span;
      const k = R / J.span;                                            // px per Saturn radius
      if (!saturnTop || Math.abs(saturnTop.px - k * dpr) > 3) saturnTop = makeSaturnTop(k * dpr);
      const P = (x, y) => [cx + x * k, cy - y * k];
      block(cx, cy, k * 2.34);
      // moons
      [["Titan", 20.3, 16, "#d9a45a", 3.2], ["Rhea", 8.7, 4.5, "#c9c4bc", 1.6], ["Enceladus", 3.95, 1.4, "#f4f8ff", 1.3]].forEach(([nm, r, per, col, s]) => {
        ctx.strokeStyle = "rgba(170,190,240,.14)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, TAU); ctx.stroke();
        const a = (J.d / per) * TAU, [x, y] = P(Math.cos(a) * r, Math.sin(a) * r);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, s + 0.5, 0, TAU); ctx.fill();
        tag(nm, x, y, s + 1, 11, false, "rgba(220,215,200,.65)", 1);
        if (nm === "Titan") J.titan = [x, y];
      });
      // finished orbits sit faintly beneath the planet
      const orbitPath = (ob, upto) => {
        ctx.beginPath();
        if (upto >= 1) {                                               // a whole orbit is an exact ellipse
          const a = (ob.q + ob.Q) / 2, e = (ob.Q - ob.q) / (ob.Q + ob.q), [ex, ey] = P(-a * e * Math.cos(ob.w), -a * e * Math.sin(ob.w));
          ctx.ellipse(ex, ey, a * k, a * Math.sqrt(1 - e * e) * k, -ob.w, 0, TAU);
        } else {                                                       // part of one, evenly spaced along its path
          const E1 = anomaly(ob, upto), steps = Math.max(2, Math.ceil(((E1 - Math.PI) / TAU) * 220));
          for (let s = 0; s <= steps; s++) { const p = pointAtE(ob, Math.PI + ((E1 - Math.PI) * s) / steps), [x, y] = P(p.x, p.y); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        }
        ctx.stroke();
      };
      ctx.lineWidth = 1;
      for (let i = 0; i < (st.done ? TOUR.length : st.idx); i++) {
        ctx.strokeStyle = TOUR[i].name === "finale" ? "rgba(255,160,90,.3)" : "rgba(255,226,160,.12)";
        orbitPath(TOUR[i], 1);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sk = k * dpr / saturnTop.px;
      ctx.drawImage(saturnTop.c, cx * dpr - saturnTop.c.width / 2 * sk, cy * dpr - saturnTop.c.height / 2 * sk, saturnTop.c.width * sk, saturnTop.c.height * sk);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the orbit in progress, bright, over everything
      if (!st.done) { ctx.strokeStyle = "rgba(255,226,160,.9)"; ctx.lineWidth = 1.4; orbitPath(o, st.frac); }
      // the spacecraft — and at the very end its last fall, from apoapsis into the clouds
      let sp = orbitPoint(o, st.frac);
      const DIVE = 2.4;
      if (st.done) {
        J.end += dt;
        const fin = J.fin || (J.fin = { q: 0.45, Q: o.Q, w: o.w + 0.05 });
        const a = (fin.q + fin.Q) / 2, e = (fin.Q - fin.q) / (fin.Q + fin.q);
        const Ehit = TAU - Math.acos((1 - 1.02 / a) / e), Mhit = Ehit - e * Math.sin(Ehit);
        const E = kepler(Math.PI + (Mhit - Math.PI) * Math.min(1, J.end / DIVE), e);
        sp = pointAtE(fin, E);
        ctx.strokeStyle = "rgba(255,170,90,.95)"; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let s = 0; s <= 120; s++) { const p = pointAtE(fin, Math.PI + ((E - Math.PI) * s) / 120), [x, y] = P(p.x, p.y); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        if (J.end > DIVE) J.flash = Math.max(J.flash, 1 - smooth(DIVE, DIVE + 3.4, J.end));
      }
      const [sx, sy] = P(sp.x, sp.y);
      if (!st.done || J.end < DIVE + 0.05) {
        ctx.globalCompositeOperation = "lighter"; glow(sx, sy, 14, finale ? "255,170,90" : "255,226,160", 0.9); ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, TAU); ctx.fill();
      }
      if (J.flash > 0) {
        ctx.globalCompositeOperation = "lighter";
        glow(sx, sy, k * (0.5 + 1.6 * J.flash), "255,170,90", J.flash * 0.8);
        glow(sx, sy, k * (0.15 + 0.45 * J.flash), "255,236,200", J.flash);
        ctx.globalCompositeOperation = "source-over";
      }
      // Huygens: released on Christmas 2004, lands on Titan three weeks later
      const rel = day("2004-12-25"), land = day("2005-01-14");
      if (J.d >= rel && J.d < land + 40 && J.titan) {
        if (!J.huygens) J.huygens = { from: [sx, sy] };
        const f = smooth(rel, land, J.d), [tx, ty] = J.titan;
        const hx = J.huygens.from[0] + (tx - J.huygens.from[0]) * f, hy = J.huygens.from[1] + (ty - J.huygens.from[1]) * f;
        ctx.fillStyle = "#cfe3ff"; ctx.beginPath(); ctx.arc(hx, hy, 1.8, 0, TAU); ctx.fill();
        if (J.d >= land) { ctx.globalCompositeOperation = "lighter"; glow(tx, ty, 14, "200,225,255", 1 - smooth(land, land + 40, J.d)); ctx.globalCompositeOperation = "source-over"; }
      }
      updateCaption(J.d);
      if (st.done && J.end > DIVE + 3.6) { placeTags(); drawEndCard(Math.min(1, (J.end - DIVE - 3.6) / 1.5)); }
    }
    function drawEndCard(a) {
      ctx.fillStyle = `rgba(3,5,12,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = a; ctx.textAlign = "center";
      ctx.font = `400 ${Math.round(R * 0.11)}px "Montserrat", "Segoe UI", sans-serif`; ctx.fillStyle = "#f4e2b4";
      ctx.fillText("Cassini · 1997 – 2017", cx, cy - R * 0.12);
      ctx.font = `${Math.round(R * 0.055)}px "Montserrat", "Segoe UI", sans-serif`; ctx.fillStyle = "rgba(236,230,214,.85)";
      ctx.fillText("7.9 billion km · 294 orbits of Saturn · 453,048 images", cx, cy + R * 0.0);
      ctx.fillText("It became part of the world it loved.", cx, cy + R * 0.1);
      ctx.globalAlpha = 1;
    }

    /* ---------- loop ---------- */
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      fit();
      if (!W) return;
      amax += (amaxT - amax) * Math.min(1, dt * 1.6);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.4);
      bg.addColorStop(0, "#0d1330"); bg.addColorStop(1, "#04060f");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      if (stars) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(stars, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      const calm = reduce || (window.Sky && Sky.calm);
      if (J) {
        const step = calm ? dt * 0.5 : dt;
        if (J.phase === 1) J.pos = drawCruise(step); else drawTour(step);
      } else {
        if (playing && !calm) d += speed * dt;
        current = drawSystem(d, true);
      }
      placeTags();
      if (opts.onDate) opts.onDate(fmt(J ? J.d : d), J ? (J.phase === 1 ? "cruise" : "tour") : "live");
    }
    let current = {};
    function pick(px, py) {
      if (J) return null;
      let best = null, bd = 16;
      for (const [k, [x, y]] of Object.entries(current)) { const dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = k; } }
      if (Math.hypot(px - cx, py - cy) < 14) best = "sun";
      return best;
    }
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect(); hover = pick(e.clientX - r.left, e.clientY - r.top);
      canvas.style.cursor = hover ? "pointer" : "default";
    });
    canvas.addEventListener("pointerleave", () => { hover = null; });
    canvas.addEventListener("click", (e) => {
      const r = canvas.getBoundingClientRect(), k = pick(e.clientX - r.left, e.clientY - r.top);
      if (k && opts.onPick) opts.onPick(k);
    });

    return {
      start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } },
      stop() { running = false; cancelAnimationFrame(raf); },
      play(v) { playing = v == null ? !playing : v; return playing; },
      faster() { speed = Math.min(365 * 2, speed * 2); return speed; },
      slower() { speed = Math.max(1, speed / 2); return speed; },
      today() { d = Date.now() / 86400000 + 2440587.5 - 2451545.0; },
      journey: startJourney,
      endJourney: stopJourney,
      get inJourney() { return !!J; },
      get speed() { return speed; }
    };
  }
  window.Orrery = { create };
})();
