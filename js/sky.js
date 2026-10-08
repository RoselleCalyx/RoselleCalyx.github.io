/* =====================================================================
   The night sky behind every page.
   Two painting styles: "realist" (star field + Milky Way) and
   "impressionist" (swirling brush strokes, after Van Gogh).
   Shooting stars fall in both.  Pages may set window.SKY_OPTIONS first.
   ===================================================================== */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const O = Object.assign(
    { moon: [0.22, 0.085], moonSize: 15, milkyWay: true, meteors: 1, angle: 0.62 },
    window.SKY_OPTIONS || {}
  );
  const STYLES = ["realist", "impressionist"];
  const LABELS = { realist: "Realist sky", impressionist: "Impressionist sky" };

  const canvas = document.createElement("canvas");
  canvas.id = "sky";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let style = "realist";
  try {
    const s = localStorage.getItem("sky-style");
    if (STYLES.includes(s)) style = s;
  } catch (e) {}

  let calm = false;                        // "calm sky": no shooting stars, no twinkling
  try { calm = localStorage.getItem("calm") === "1"; } catch (e) {}

  let W = 0, H = 0, dpr = 1, cssW = 0, cssH = 0;
  let base = null, moonSprite = null;
  let twinkles = [], halos = [];
  let paint = null, pctx = null, buckets = [], pw = 0, ph = 0;
  let meteors = [], nextMeteor = 1.2;
  let last = performance.now(), time = 0;

  /* ---------- helpers ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function blob(c, x, y, r, color) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const STAR_COLORS = ["#a9bcff", "#cfdcff", "#ffffff", "#fff4e6", "#ffe1bd", "#ffd0a0"];
  function glowSprite(rgb) {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d").createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.18, `rgba(${rgb},.55)`);
    g.addColorStop(0.45, `rgba(${rgb},.12)`); g.addColorStop(1, `rgba(${rgb},0)`);
    const x = c.getContext("2d"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return c;
  }
  const SPR = {
    white: glowSprite("255,255,255"), blue: glowSprite("190,210,255"),
    warm: glowSprite("255,226,180"), gold: glowSprite("255,214,120")
  };
  const sprFor = (col) => (col === "#a9bcff" || col === "#cfdcff" ? SPR.blue : col === "#ffffff" ? SPR.white : SPR.warm);

  /* ---------- build ---------- */
  function resize(force) {
    const nw = innerWidth, nh = innerHeight;
    if (!nw || !nh) return;                 // hidden tab / zero-size frame: wait for a real size
    // ignore small height changes (mobile URL bar) to avoid rebuilding
    if (!force && nw === cssW && Math.abs(nh - cssH) < 140) return;
    cssW = nw; cssH = nh;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = canvas.width = Math.round(cssW * dpr);
    H = canvas.height = Math.round(cssH * dpr);
    build();
  }

  function build() {
    const r = rng(20240915);
    const area = cssW * cssH;
    twinkles = [];
    const nt = Math.min(260, Math.round(area / 8500));
    for (let i = 0; i < nt; i++) {
      const col = STAR_COLORS[(r() * STAR_COLORS.length) | 0];
      twinkles.push({
        x: r() * W, y: r() * H * (r() < 0.75 ? 0.75 : 1), s: (0.9 + Math.pow(r(), 3) * 2.6) * dpr,
        ph: r() * 6.28, sp: 0.4 + r() * 2.2, col, spr: sprFor(col), spike: r() < 0.06
      });
    }
    moonSprite = makeMoon();
    if (style === "realist") buildRealist(r); else buildImpressionist(r);
  }

  function buildRealist(r) {
    paint = null; buckets = [];
    base = document.createElement("canvas");
    base.width = W; base.height = H;
    const b = base.getContext("2d");
    const g = b.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#02040a"); g.addColorStop(0.55, "#060a18"); g.addColorStop(1, "#0d1328");
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    const m = Math.min(W, H);
    blob(b, W * 0.12, H * 0.22, m * 0.55, "rgba(70,45,120,.10)");
    blob(b, W * 0.88, H * 0.12, m * 0.5, "rgba(30,60,130,.10)");
    blob(b, W * 0.6, H * 0.85, m * 0.6, "rgba(100,55,90,.07)");

    if (O.milkyWay) {
      // the band runs from mw.a to mw.b (viewport fractions); "rich" adds warm dust and knots
      const mw = Object.assign({ a: [-0.1, 0.95], b: [1.1, 0.02], width: 0.17, rich: false, core: 0.5 }, O.mw || {});
      const ax = mw.a[0] * W, ay = mw.a[1] * H, bx = mw.b[0] * W, by = mw.b[1] * H;
      const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      const bw = m * mw.width;
      const wob = (t) => Math.sin(t * 9.0) * bw * 0.12 + Math.sin(t * 23.0) * bw * 0.05;
      const at = (s, off) => [ax + (bx - ax) * s + nx * (off + wob(s)), ay + (by - ay) * s + ny * (off + wob(s))];
      const coreW = (s) => mw.rich ? 0.45 + 0.9 * Math.exp(-Math.pow((s - mw.core) / 0.22, 2)) : 1;
      b.globalCompositeOperation = "lighter";
      const tints = ["rgba(120,145,210,", "rgba(205,185,165,", "rgba(150,120,195,"];
      for (let i = 0; i < (mw.rich ? 170 : 90); i++) {
        const t = r();
        const [x, y] = at(t, gauss(r) * bw * 0.5);
        blob(b, x, y, bw * (0.3 + r() * 0.9), tints[(r() * 3) | 0] + ((0.016 + r() * 0.028) * coreW(t)).toFixed(3) + ")");
      }
      if (mw.rich) {
        for (let i = 0; i < 70; i++) {                      // warm galactic core light
          const t = mw.core + gauss(r) * 0.12;
          const [x, y] = at(t, gauss(r) * bw * 0.28);
          blob(b, x, y, bw * (0.15 + r() * 0.45), (r() < 0.6 ? "rgba(255,176,110," : "rgba(255,214,170,") + (0.03 + r() * 0.05).toFixed(3) + ")");
        }
        for (let i = 0; i < 110; i++) {                     // pink and violet nebular knots
          const t = r();
          const [x, y] = at(t, gauss(r) * bw * 0.32);
          blob(b, x, y, bw * (0.02 + r() * 0.07), (r() < 0.5 ? "rgba(240,120,210," : "rgba(170,110,240,") + ((0.1 + r() * 0.16) * coreW(t)).toFixed(3) + ")");
        }
      }
      const nd = Math.round(((W * H) / (dpr * dpr) / 260) * (mw.rich ? 8 : 1));
      for (let i = 0; i < nd; i++) {
        const t = r();
        const [x, y] = at(t, gauss(r) * bw * (mw.rich ? 0.3 : 0.4));
        b.fillStyle = `rgba(235,235,255,${Math.min(1, (0.12 + r() * 0.5) * coreW(t)).toFixed(2)})`;
        const sz = (0.3 + r() * 0.75) * dpr;
        b.fillRect(x, y, sz, sz);
      }
      b.globalCompositeOperation = "source-over";
      for (let i = 0; i < (mw.rich ? 180 : 60); i++) {      // dark dust lanes
        const t = r();
        const [x, y] = at(t, gauss(r) * bw * 0.08 + bw * 0.04);
        blob(b, x, y, bw * (mw.rich ? 0.03 + r() * 0.09 : 0.12 + r() * 0.3), `rgba(3,4,10,${mw.rich ? 0.22 : 0.2})`);
      }
      if (mw.rich) {                                     // bright stars scattered through the band, drawn last
        b.globalCompositeOperation = "lighter";
        for (let i = 0; i < 420; i++) {
          const t = r();
          const [x, y] = at(t, gauss(r) * bw * 0.36);
          const sz = (0.8 + Math.pow(r(), 3) * 1.8) * dpr;
          b.fillStyle = `rgba(${r() < 0.4 ? "255,226,190" : "225,232,255"},${(0.5 + r() * 0.5).toFixed(2)})`;
          b.beginPath(); b.arc(x, y, sz, 0, 6.283); b.fill();
        }
        b.globalCompositeOperation = "source-over";
      }
    }
    const n = Math.round((W * H) / (dpr * dpr) / 1000);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H;
      const big = r() < 0.08;
      const s = (big ? 0.9 + r() * 0.7 : 0.3 + r() * 0.6) * dpr;
      b.globalAlpha = 0.25 + r() * 0.7;
      b.fillStyle = STAR_COLORS[(r() * STAR_COLORS.length) | 0];
      b.beginPath(); b.arc(x, y, s, 0, 6.283); b.fill();
    }
    b.globalAlpha = 1;
  }

  /* --- impressionist: a flow field of brush strokes --- */
  const PAL = ["#0e1f5c", "#18358a", "#2550a6", "#3d6cbf", "#6f98d4", "#a9c8ea", "#e6d38a", "#f6ebbd"];
  const PAL_W = [0.15, 0.2, 0.2, 0.16, 0.12, 0.08, 0.05, 0.04];
  const VORT = [
    { x: 0.36, y: 0.32, r: 0.17, s: 1 }, { x: 0.58, y: 0.25, r: 0.11, s: -1 },
    { x: 0.78, y: 0.44, r: 0.14, s: 1 }, { x: 0.14, y: 0.58, r: 0.12, s: -1 }
  ];
  function pickColor(r) {
    let x = r(), i = 0;
    while (i < PAL.length - 1 && x > PAL_W[i]) { x -= PAL_W[i]; i++; }
    return i;
  }
  function buildImpressionist(r) {
    base = null;
    const sc = 0.5;
    pw = Math.max(200, Math.round(cssW * sc)); ph = Math.max(200, Math.round(cssH * sc));
    paint = document.createElement("canvas"); paint.width = pw; paint.height = ph;
    pctx = paint.getContext("2d");
    const g = pctx.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, "#0a1748"); g.addColorStop(0.6, "#152c72"); g.addColorStop(1, "#1b2d5e");
    pctx.fillStyle = g; pctx.fillRect(0, 0, pw, ph);
    pctx.lineCap = "round";
    buckets = PAL.map(() => []);
    const n = Math.min(2600, Math.round((pw * ph) / 230));
    for (let i = 0; i < n; i++) buckets[pickColor(r)].push(spawnStroke({}));
    for (let i = 0; i < (reduce ? 260 : 140); i++) stepStrokes(1.4);
    halos = [];
    const nh = Math.max(7, Math.round((cssW * cssH) / 110000));
    for (let i = 0; i < nh; i++) {
      halos.push({ x: r() * W, y: r() * H * 0.7, s: (3 + r() * 6) * dpr, ph: r() * 6.28 });
    }
  }
  function spawnStroke(s) {
    s.x = Math.random() * pw; s.y = Math.random() * ph; s.life = 30 + Math.random() * 140;
    return s;
  }
  function field(x, y) {
    let vx = 1, vy = 0.2 * Math.sin(x * 7 + y * 4);
    const a = noise(x * 3.2, y * 3.2 + time * 0.015) * 6.283;
    vx += Math.cos(a) * 0.55; vy += Math.sin(a) * 0.55;
    for (let i = 0; i < VORT.length; i++) {
      const v = VORT[i], dx = x - v.x, dy = (y - v.y) * 0.75, d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
      const e = Math.exp(-(d * d) / (v.r * v.r)) * 3.2 * v.s;
      vx += (-dy / d) * e - (dx / d) * Math.abs(e) * 0.12;
      vy += (dx / d) * e - (dy / d) * Math.abs(e) * 0.12;
    }
    return Math.atan2(vy, vx);
  }
  function stepStrokes(speed) {
    pctx.globalAlpha = 0.4;
    for (let c = 0; c < buckets.length; c++) {
      const list = buckets[c];
      pctx.strokeStyle = PAL[c];
      pctx.lineWidth = c > 5 ? 1.3 : 1.8;
      pctx.beginPath();
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const a = field(s.x / pw, s.y / ph);
        const nx = s.x + Math.cos(a) * speed, ny = s.y + Math.sin(a) * speed;
        pctx.moveTo(s.x, s.y); pctx.lineTo(nx, ny);
        s.x = nx; s.y = ny;
        if (--s.life < 0 || nx < -4 || ny < -4 || nx > pw + 4 || ny > ph + 4) spawnStroke(s);
      }
      pctx.stroke();
    }
    pctx.globalAlpha = 1;
  }

  function makeMoon() {
    const R = O.moonSize * dpr, S = Math.ceil(R * 2 + 4);
    const c = document.createElement("canvas"); c.width = c.height = S;
    const m = c.getContext("2d");
    const g = m.createRadialGradient(S / 2 - R * 0.3, S / 2 - R * 0.3, R * 0.1, S / 2, S / 2, R);
    g.addColorStop(0, "#fffaf0"); g.addColorStop(1, "#e9d9b4");
    m.fillStyle = g; m.beginPath(); m.arc(S / 2, S / 2, R, 0, 6.283); m.fill();
    m.globalCompositeOperation = "destination-out";
    m.beginPath(); m.arc(S / 2 + R * 0.5, S / 2 - R * 0.28, R * 0.92, 0, 6.283); m.fill();
    return c;
  }

  /* ---------- draw ---------- */
  function drawTwinkles(warm) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < twinkles.length; i++) {
      const t = twinkles[i];
      const a = reduce || calm ? 0.8 : 0.5 + 0.5 * Math.sin(time * t.sp + t.ph);
      const s = t.s * 7;
      ctx.globalAlpha = 0.25 + a * 0.75;
      ctx.drawImage(warm ? SPR.gold : t.spr, t.x - s / 2, t.y - s / 2, s, s);
      if (t.spike) {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = "#fff";
        ctx.fillRect(t.x - t.s * 9, t.y - 0.5 * dpr, t.s * 18, dpr);
        ctx.fillRect(t.x - 0.5 * dpr, t.y - t.s * 9, dpr, t.s * 18);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function drawMoon(impr) {
    if (!O.moon) return;
    const x = O.moon[0] * W, y = O.moon[1] * H, R = O.moonSize * dpr;
    if (impr) {
      ctx.globalCompositeOperation = "lighter";
      for (let k = 3; k >= 1; k--) {
        const rr = R * (1.4 + k * 0.9) * (1 + 0.04 * Math.sin(time * 0.7 + k));
        ctx.strokeStyle = `rgba(245,215,120,${0.12 + 0.06 * k})`;
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    const glow = impr ? SPR.gold : SPR.warm, gs = R * (impr ? 9 : 7);
    ctx.globalAlpha = impr ? 0.7 : 0.35;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glow, x - gs / 2, y - gs / 2, gs, gs);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (impr) ctx.filter = "sepia(.6) saturate(2.2) brightness(1.05)";
    ctx.drawImage(moonSprite, x - moonSprite.width / 2, y - moonSprite.height / 2);
    ctx.filter = "none";
  }
  function drawHalos() {
    ctx.globalCompositeOperation = "lighter";
    for (const h of halos) {
      const p = 1 + 0.08 * Math.sin(time * 0.9 + h.ph);
      const s = h.s * 6 * p;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(SPR.gold, h.x - s / 2, h.y - s / 2, s, s);
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = "rgba(240,222,150,.32)";
      ctx.beginPath(); ctx.arc(h.x, h.y, h.s * 2.1 * p, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = "rgba(170,200,240,.22)";
      ctx.beginPath(); ctx.arc(h.x, h.y, h.s * 3.3 * p, 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function spawnMeteor(big) {
    const ang = O.angle + (Math.random() - 0.5) * 0.3;
    const sp = (big ? 650 : 900 + Math.random() * 900) * dpr;
    meteors.push({
      x: (0.25 + Math.random() * 0.95) * W, y: (-0.05 + Math.random() * 0.45) * H,
      vx: -Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0,
      max: big ? 1.9 : 0.45 + Math.random() * 0.9,
      len: (big ? 420 : 110 + Math.random() * 230) * dpr,
      w: (big ? 2.6 : 0.9 + Math.random() * 1.2) * dpr, big, sparks: []
    });
  }
  function drawMeteors(dt, warm) {
    nextMeteor -= dt;
    if (nextMeteor <= 0 && !calm) {
      const big = Math.random() < 0.06;
      spawnMeteor(big);
      if (!big && Math.random() < 0.12) setTimeout(() => spawnMeteor(false), 160 + Math.random() * 300);
      nextMeteor = ((0.5 + Math.random() * 2.3) / O.meteors) * (reduce ? 5 : 1);
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      const k = m.life / m.max;
      if (k >= 1) { meteors.splice(i, 1); continue; }
      const a = Math.sin(Math.PI * k);
      const sp = Math.hypot(m.vx, m.vy), ux = m.vx / sp, uy = m.vy / sp;
      const L = m.len * (0.4 + 0.6 * a);
      const tx = m.x - ux * L, ty = m.y - uy * L;
      const col = m.big || warm ? "255,222,170" : "220,232,255";
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.15, `rgba(${col},${a * 0.6})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = m.w; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      const hs = m.w * (m.big ? 14 : 8);
      ctx.globalAlpha = a;
      ctx.drawImage(m.big || warm ? SPR.warm : SPR.white, m.x - hs / 2, m.y - hs / 2, hs, hs);
      ctx.globalAlpha = 1;
      if (m.big) {
        if (Math.random() < 0.6) m.sparks.push({ x: m.x, y: m.y, vx: m.vx * 0.15 + (Math.random() - 0.5) * 120 * dpr, vy: m.vy * 0.15 + (Math.random() - 0.5) * 120 * dpr, l: 0.6 });
        for (let j = m.sparks.length - 1; j >= 0; j--) {
          const s = m.sparks[j];
          s.l -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.l <= 0) { m.sparks.splice(j, 1); continue; }
          ctx.fillStyle = `rgba(255,200,130,${s.l})`;
          ctx.fillRect(s.x, s.y, 1.6 * dpr, 1.6 * dpr);
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden && (base || paint)) {
      time += dt;
      if (style === "realist") {
        ctx.drawImage(base, 0, 0);
        drawTwinkles(false);
        drawMoon(false);
        drawMeteors(dt, false);
      } else {
        if (!reduce && !calm) {
          stepStrokes(1.1);
          pctx.fillStyle = "rgba(12,26,72,0.012)";
          pctx.fillRect(0, 0, pw, ph);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(paint, 0, 0, W, H);
        ctx.fillStyle = "rgba(4,8,26,.22)";            // a soft veil so text stays readable
        ctx.fillRect(0, 0, W, H);
        drawHalos();
        drawTwinkles(true);
        drawMoon(true);
        drawMeteors(dt, true);
      }
    }
    requestAnimationFrame(frame);
  }

  window.Sky = {
    STYLES, LABELS,
    get style() { return style; },
    setStyle(s) {
      if (!STYLES.includes(s)) return;
      style = s;
      try { localStorage.setItem("sky-style", s); } catch (e) {}
      build();
      window.dispatchEvent(new CustomEvent("skystyle", { detail: s }));
    },
    cycle() { this.setStyle(STYLES[(STYLES.indexOf(style) + 1) % STYLES.length]); },
    get calm() { return calm || reduce; },
    setCalm(v) {
      calm = !!v;
      try { localStorage.setItem("calm", calm ? "1" : "0"); } catch (e) {}
      window.dispatchEvent(new CustomEvent("skycalm", { detail: calm }));
    },
    meteor() { spawnMeteor(Math.random() < 0.3); }
  };

  addEventListener("resize", () => resize(false));
  resize(true);
  requestAnimationFrame(frame);
})();
