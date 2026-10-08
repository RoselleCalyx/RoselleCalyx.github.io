/* =====================================================================
   Saturn & Cassini — the home page story.

   Everything is placed in the coordinates of the painting (1672 × 941)
   via window.HOME_FRAME, so the live layers line up with the painted
   foreground (assets/home-landscape.webp) on every screen.

   Layers, back to front:
     #sky (sky.js)  stars, Milky Way, shooting stars
     #saturn        horizon glow, ray-traced Saturn, moons
     .hero-land     painted clouds, mountain, the traveller and the cat
     #fx            Cassini, its plasma trail, the final burn

   Scrolling through .story moves Cassini toward Saturn; it enters the
   atmosphere, breaks apart and becomes light — 15 September 2017.
   ===================================================================== */
(function () {
  const story = document.querySelector(".story");
  const hero = document.getElementById("hero");
  const cvS = document.getElementById("saturn"), cS = cvS && cvS.getContext("2d");
  const cvF = document.getElementById("fx"), cF = cvF && cvF.getContext("2d");
  if (!story || !cS || !cF) return;
  const land = document.getElementById("heroLand");
  const ui = document.getElementById("heroUI");
  const dim = document.getElementById("heroDim");
  const finale = document.getElementById("finale");
  const logEl = document.getElementById("missionLog");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia("(pointer: coarse)").matches;

  /* ---------- the painting's geometry ---------- */
  const LAND_Y0 = 180;                                  // the foreground image starts at this row
  const SAT = { x: 573, y: 318, R: 262 };              // Saturn in painting pixels
  const TILT = 0.31;                                     // on-screen tilt of the ring plane
  const B = 0.33;                                        // ring opening angle (~19°)
  const MOONS = [{ x: 1550, y: 222, r: 30 }, { x: 1455, y: 437, r: 11 }];
  const SUN = { x: 960, y: 602 };                        // the glow on the horizon
  const CASSINI = { x: 920, y: 368, ang: -2.74, size: 380 };   // start pose (boom tip → dish ≈ 380 px)
  const ENTRY = { x: 742, y: 292 };                      // where it meets the clouds of Saturn

  const LOG = [
    [0.1, "1997 · Cape Canaveral", "Cassini leaves Earth — a small light on a long road."],
    [0.2, "2004 · Saturn", "Seven years across the dark, it arrives."],
    [0.31, "13 years · 294 orbits", "Oceans beneath Enceladus' ice. Methane seas on Titan."],
    [0.42, "2017 · The Grand Finale", "Twenty-two dives between the rings and the sky."],
    [0.53, "Fuel nearly gone", "To keep those worlds pristine, it turns toward Saturn itself."],
    [0.63, "15 September 2017", "Entering the atmosphere at 120,000 km/h."],
    [0.74, "Final signal · received on Earth 11:55 UTC", "The voice falls silent. The light goes on."],
    [0.84, "", ""]
  ];

  /* ---------- math ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const h1 = (i) => { const s = Math.sin(i * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
  const n1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; };

  /* ---------- Saturn colour tables (soft cream and peach, as painted) ---------- */
  const BANDS = [
    [-90, 128, 128, 132], [-60, 176, 156, 132], [-40, 206, 178, 146], [-24, 226, 198, 164],
    [-12, 240, 216, 184], [-3, 248, 230, 202], [5, 242, 220, 186], [11, 212, 172, 132],
    [16, 230, 198, 160], [22, 204, 164, 124], [29, 230, 202, 166], [37, 202, 168, 130],
    [46, 222, 196, 162], [56, 186, 166, 140], [66, 158, 150, 140], [78, 128, 132, 140], [90, 112, 118, 128]
  ];
  const bandLUT = new Float32Array(721 * 3);
  for (let i = 0; i <= 720; i++) {
    const lat = -90 + i / 4;
    let k = 0;
    while (k < BANDS.length - 2 && BANDS[k + 1][0] < lat) k++;
    const a = BANDS[k], b = BANDS[k + 1], t = smooth(0, 1, (lat - a[0]) / (b[0] - a[0]));
    for (let c = 0; c < 3; c++) bandLUT[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * t;
  }
  const RMIN = 1.05, RMAX = 2.36, RN = 4096;
  const ringO = new Float32Array(RN), ringC = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) {
    const r = RMIN + ((RMAX - RMIN) * i) / (RN - 1);
    let o = 0, col = [0, 0, 0];
    const fine = 0.72 + 0.28 * n1(r * 160) * (0.6 + 0.4 * n1(r * 41));
    if (r > 1.11 && r < 1.239) { o = 0.04; col = [130, 116, 102]; }
    else if (r >= 1.239 && r < 1.527) { const t = (r - 1.239) / 0.288; o = (0.12 + 0.14 * t) * (0.55 + 0.45 * n1(r * 70)); col = [168, 146, 124]; }
    else if (r >= 1.527 && r < 1.951) {
      const t = (r - 1.527) / 0.424;
      o = 0.7 + 0.24 * Math.sin(t * Math.PI) + 0.06 * (n1(r * 95) - 0.5);
      const br = 0.88 + 0.12 * n1(r * 55);
      col = [244 * br, 222 * br, 192 * br];
    } else if (r >= 1.951 && r < 2.027) { o = 0.06 + 0.05 * n1(r * 200); col = [96, 84, 74]; }
    else if (r >= 2.027 && r < 2.269) {
      const t = (r - 2.027) / 0.242;
      o = 0.62 - 0.12 * t;
      if (Math.abs(r - 2.214) < 0.0045) o *= 0.12;
      if (Math.abs(r - 2.265) < 0.0016) o *= 0.3;
      col = [222, 200, 172];
    } else if (Math.abs(r - 2.324) < 0.0035) { o = 0.38; col = [236, 220, 196]; }
    ringO[i] = clamp(o * fine, 0, 1);
    ringC[i * 3] = col[0]; ringC[i * 3 + 1] = col[1]; ringC[i * 3 + 2] = col[2];
  }
  (function () {
    const tmp = ringO.slice();
    for (let i = 2; i < RN - 2; i++) ringO[i] = (tmp[i - 2] + 2 * tmp[i - 1] + 3 * tmp[i] + 2 * tmp[i + 1] + tmp[i + 2]) / 9;
  })();
  const ringIdx = (r) => (((r - RMIN) / (RMAX - RMIN)) * (RN - 1)) | 0;

  // yield between chunks (MessageChannel is not throttled like setTimeout)
  const mc = new MessageChannel(), queue = [];
  mc.port1.onmessage = () => { const f = queue.shift(); if (f) f(); };
  const yieldThen = (f) => { queue.push(f); mc.port2.postMessage(0); };

  /* ---------- ray-trace Saturn once per size ---------- */
  let buildToken = 0;
  function renderSaturn(Rp, done) {
    const token = ++buildToken;
    const sB = Math.sin(B), cB = Math.cos(B);
    let Lx = 0.74, Ly = 0.08, Lz = 0.67;                 // sunlight from the right, as in the painting
    const ll = Math.hypot(Lx, Ly, Lz); Lx /= ll; Ly /= ll; Lz /= ll;
    const Ln = Ly * cB + Lz * sB;
    const w = Math.ceil(2 * RMAX * Rp + 6), h = Math.ceil(2 * Math.max(1, RMAX * sB) * Rp + 8);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const c2 = cv.getContext("2d");
    const img = c2.createImageData(w, h), D = img.data;
    const ox = w / 2, oy = h / 2, edge = 1 + 3 / Rp;
    const rc = [0, 0, 0];
    function ring(x, y) {
      const zr = (-y * cB) / sB;
      const rr = Math.sqrt(x * x + y * y + zr * zr);
      if (rr <= RMIN || rr >= RMAX) return 0;
      const i = ringIdx(rr), o = ringO[i];
      if (o < 0.003) return 0;
      let lit = 0.62 + 0.62 * Ln + 0.12 * Math.max(0, x / rr);   // a little brighter toward the sun
      const bq = x * Lx + y * Ly + zr * Lz, disc = bq * bq - (rr * rr - 1);
      if (disc > 0 && -bq - Math.sqrt(disc) > 0) lit *= 1 - 0.93 * Math.min(1, disc * 30);
      rc[0] = ringC[i * 3] * lit; rc[1] = ringC[i * 3 + 1] * lit; rc[2] = ringC[i * 3 + 2] * lit;
      return o;
    }
    let row = 0;
    function chunk() {
      if (token !== buildToken) return;
      const t0 = performance.now();
      for (; row < h && performance.now() - t0 < 24; row++) {
        const py = row;
        for (let px = 0; px < w; px++) {
          const x = (px + 0.5 - ox) / Rp;
          let ar = 0, ag = 0, ab = 0, aa = 0;
          let ro = 0, rr0 = 0, rg0 = 0, rb0 = 0;
          for (let s = 0; s < 2; s++) {
            const o = ring(x, (oy - py - 0.25 - 0.5 * s) / Rp);
            ro += o * 0.5; rr0 += rc[0] * o * 0.5; rg0 += rc[1] * o * 0.5; rb0 += rc[2] * o * 0.5;
          }
          const y = (oy - py - 0.5) / Rp;
          const zr = (-y * cB) / sB;
          if (ro > 0) { rr0 /= ro; rg0 /= ro; rb0 /= ro; }
          const d2 = x * x + y * y;
          let front = true;
          if (d2 < edge) {
            const dist = Math.sqrt(d2);
            const cov = clamp((1 - dist) * Rp + 0.5, 0, 1);
            let nx = x, ny = y, nz = 0;
            if (dist >= 1) { nx /= dist; ny /= dist; } else nz = Math.sqrt(1 - d2);
            front = zr > nz;
            if (ro > 0 && !front) { ar = rr0 * ro; ag = rg0 * ro; ab = rb0 * ro; aa = ro; }
            if (cov > 0) {
              const sinLat = ny * cB + nz * sB;
              const lat = Math.asin(clamp(sinLat, -1, 1)) * 57.29578;
              const lon = Math.atan2(ny * sB - nz * cB, nx);
              const latW = lat + 0.6 * Math.sin(lon * 5 + lat * 0.23) * smooth(8, 30, Math.abs(lat)) * (1 - smooth(55, 75, Math.abs(lat)));
              const li = Math.round((clamp(latW, -90, 90) + 90) * 4) * 3;
              let br = bandLUT[li], bg = bandLUT[li + 1], bb = bandLUT[li + 2];
              const m = 1 + 0.08 * (n1(latW * 2.1) - 0.5) + 0.07 * (n1(latW * 9.3 + Math.sin(lon * 3) * 0.6) - 0.5);
              br *= m; bg *= m; bb *= m;
              const dl = nx * Lx + ny * Ly + nz * Lz;
              let sh = Math.pow(Math.max(0, dl), 0.7) * 1.08 * smooth(-0.12, 0.2, dl);
              sh *= 0.62 + 0.38 * Math.pow(nz, 0.3);
              const ts = -sinLat / Ln;
              if (ts > 0) {
                const qx = nx + ts * Lx, qy = ny + ts * Ly, qz = nz + ts * Lz;
                const rq = Math.sqrt(qx * qx + qy * qy + qz * qz);
                if (rq > RMIN && rq < RMAX) sh *= 1 - 0.78 * ringO[ringIdx(rq)];
              }
              // the night side keeps a faint cold ringshine, like the painting's grey-blue limb
              let pr = br * sh + 26 * (1 - sh), pg = bg * sh + 30 * (1 - sh), pb = bb * sh + 42 * (1 - sh);
              const rim = Math.pow(1 - nz, 2.5) * Math.max(0, dl + 0.2);
              pr += 60 * rim; pg += 40 * rim; pb += 22 * rim;
              ar = pr * cov + ar * (1 - cov); ag = pg * cov + ag * (1 - cov); ab = pb * cov + ab * (1 - cov);
              aa = cov + aa * (1 - cov);
            }
          }
          if (ro > 0 && (front || d2 >= edge)) {
            ar = rr0 * ro + ar * (1 - ro); ag = rg0 * ro + ag * (1 - ro); ab = rb0 * ro + ab * (1 - ro);
            aa = ro + aa * (1 - ro);
          }
          if (aa > 0) {
            const k = (py * w + px) * 4;
            D[k] = ar / aa; D[k + 1] = ag / aa; D[k + 2] = ab / aa; D[k + 3] = aa * 255;
          }
        }
      }
      if (row < h) yieldThen(chunk);
      else { c2.putImageData(img, 0, 0); done(cv); }
    }
    chunk();
  }

  function moonSprite(r, seed) {
    const S = Math.ceil(r * 2 + 4), c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d"), m = S / 2;
    g.fillStyle = "#23232a"; g.beginPath(); g.arc(m, m, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(m, m, r, 0, 7); g.clip();
    const lg = g.createRadialGradient(m - r * 0.55, m + r * 0.3, r * 0.1, m - r * 0.3, m + r * 0.15, r * 1.25);
    lg.addColorStop(0, "#f1e2c8"); lg.addColorStop(0.45, "#a99a88"); lg.addColorStop(1, "rgba(60,58,62,0)");
    g.fillStyle = lg; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) {
      const a = h1(seed + i) * 6.28, d = h1(seed + i + 50) * r * 0.8, cr = r * (0.06 + h1(seed + i + 9) * 0.14);
      g.fillStyle = "rgba(40,36,40,.28)"; g.beginPath(); g.arc(m + Math.cos(a) * d, m + Math.sin(a) * d, cr, 0, 7); g.fill();
    }
    g.restore();
    return c;
  }

  /* ---------- layout ---------- */
  let vw = 0, vh = 0, dpr = 1, F = null, planet = null, planetAt = 0, Rpx = 0, moons = [];
  const P = (x, y) => [(F.left + x * F.S) * dpr, (F.top + y * F.S) * dpr];
  function layout() {
    const r = hero.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    vw = r.width; vh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    cvS.width = cvF.width = Math.round(vw * dpr);
    cvS.height = cvF.height = Math.round(vh * dpr);
    F = window.HOME_FRAME(vw, vh);
    if (land) {
      land.style.width = F.IW * F.S + "px";
      land.style.left = F.left + "px";
      land.style.top = F.top + LAND_Y0 * F.S + "px";
    }
    const want = Math.min(Math.round(SAT.R * F.S * dpr), lowPower ? 320 : 480);
    if (!planet || Math.abs(want - Rpx) / Rpx > 0.08) {
      const first = !planet;
      const full = () => renderSaturn(want, (cv) => { planet = cv; Rpx = want; });
      if (first) {
        // a quick low-resolution pass so Saturn appears at once, then the full render
        renderSaturn(Math.max(60, Math.round(want / 4)), (cv) => { planet = cv; Rpx = Math.max(60, Math.round(want / 4)); planetAt = performance.now(); full(); });
      } else full();
    }
    moons = MOONS.map((m, i) => moonSprite(m.r * F.S * dpr, i * 17 + 3));
  }

  /* ---------- Cassini, drawn as in the painting: boom forward, dish behind ---------- */
  function drawCassini(c, x, y, s, ang, heat) {
    c.save();
    c.translate(x, y); c.rotate(ang); c.scale(s, s);
    // magnetometer boom reaching forward
    c.strokeStyle = "#2a2c33"; c.lineWidth = 2.4; c.lineCap = "round";
    c.beginPath(); c.moveTo(8, -3); c.lineTo(116, -6); c.stroke();
    c.strokeStyle = "rgba(255,210,150,.75)"; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(8, -1.9); c.lineTo(116, -4.9); c.stroke();
    c.fillStyle = "#3a3c44";
    for (let k = 20; k < 112; k += 12) c.fillRect(k, -5.6 + k * -0.028, 1.6, 4);
    c.fillStyle = "#4a4c55"; c.fillRect(112, -9, 9, 6);
    c.fillStyle = "rgba(255,200,140,.8)"; c.fillRect(112, -4, 9, 1);
    // antenna mast and small instruments
    c.strokeStyle = "#2a2c33"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(5, -27); c.stroke();
    c.beginPath(); c.moveTo(-6, -9); c.lineTo(-10, -20); c.stroke();
    c.fillStyle = "#565964"; c.fillRect(3, -30, 5, 4); c.fillRect(-12, -23, 4, 4);
    // RTGs and thrusters at the rear
    c.strokeStyle = "#1f2026"; c.lineWidth = 3.4;
    [[-12, 8, -4, 21], [-16, 6, -14, 20], [-10, -8, -2, -18]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
    c.strokeStyle = "rgba(255,190,120,.6)"; c.lineWidth = 0.8;
    [[-12, 8, -4, 21], [-16, 6, -14, 20]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a + 1.2, b); c.lineTo(d + 1.2, e); c.stroke(); });
    // main body: dark steel with gold foil
    const g = c.createLinearGradient(0, -10, 0, 10);
    g.addColorStop(0, "#1b1d23"); g.addColorStop(0.3, "#8e929c"); g.addColorStop(0.55, "#3a3d46"); g.addColorStop(1, "#121318");
    c.fillStyle = g; c.fillRect(-20, -9, 26, 18);
    const gg = c.createLinearGradient(0, -9, 0, 9);
    gg.addColorStop(0, "#5c3a0c"); gg.addColorStop(0.3, "#f0c66c"); gg.addColorStop(0.6, "#a8741f"); gg.addColorStop(1, "#3e2606");
    c.fillStyle = gg; c.fillRect(-8, -9.5, 7, 19);
    c.fillStyle = "#2e3038"; c.fillRect(6, -7, 10, 14);
    c.fillStyle = gg; c.fillRect(8, -6, 3, 12);
    c.fillStyle = "#6b6f7a"; c.fillRect(-18, 9, 6, 3); c.fillRect(-2, 9, 5, 4); c.fillRect(-14, -12, 7, 3); c.fillRect(2, -12, 4, 3);
    // warm rim light from the horizon
    c.strokeStyle = "rgba(255,190,120,.85)"; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-20, 9); c.lineTo(16, 7); c.stroke();
    // high-gain antenna at the rear, its face lit by the fire
    const dg = c.createLinearGradient(-30, -20, -20, 20);
    dg.addColorStop(0, "#fbf6ea"); dg.addColorStop(0.5, "#d9d2c2"); dg.addColorStop(1, "#8d8778");
    c.fillStyle = dg;
    c.beginPath(); c.ellipse(-25, 1, 7.5, 21, 0.08, 0, 6.283); c.fill();
    c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = "rgba(255,220,170,.55)";
    c.beginPath(); c.ellipse(-27, 1, 4.5, 15, 0.08, 0, 6.283); c.fill();
    c.fillStyle = "#2a2c33"; c.fillRect(-33, -0.8, 6, 2.2);
    if (heat > 0) {
      c.globalCompositeOperation = "lighter";
      const r = 22 + heat * 50;
      const hg = c.createRadialGradient(-30, 1, 0, -30, 1, r);
      hg.addColorStop(0, `rgba(255,250,230,${0.95 * heat})`);
      hg.addColorStop(0.3, `rgba(255,186,100,${0.6 * heat})`);
      hg.addColorStop(1, "rgba(255,100,30,0)");
      c.fillStyle = hg; c.fillRect(-30 - r, 1 - r, r * 2, r * 2);
      c.globalCompositeOperation = "source-over";
    }
    c.restore();
  }

  const FIRE = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,240,1)"); gr.addColorStop(0.25, "rgba(255,206,120,.8)");
    gr.addColorStop(0.6, "rgba(255,120,40,.25)"); gr.addColorStop(1, "rgba(255,70,10,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  })();
  function spr(c, x, y, size, a) {
    c.globalAlpha = clamp(a, 0, 1);
    c.drawImage(FIRE, x - size / 2, y - size / 2, size, size);
  }

  /* ---------- the plasma jet trailing behind the dish ---------- */
  function drawJet(c, x, y, dirx, diry, len, width, heat) {
    if (len < 2) return;
    const nx = -diry, ny = dirx;
    const ex = x + dirx * len, ey = y + diry * len;
    c.globalCompositeOperation = "lighter";
    for (const [wMul, a, col] of [[2.4, 0.12, "255,130,50"], [1.0, 0.34, "255,186,110"], [0.32, 0.85, "255,246,224"]]) {
      const g = c.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0, `rgba(${col},${a * (0.6 + 0.4 * heat)})`);
      g.addColorStop(0.18, `rgba(${col},${a * 0.6})`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g;
      const w0 = width * wMul;
      c.beginPath();
      c.moveTo(x + nx * w0, y + ny * w0);
      c.quadraticCurveTo(x + dirx * len * 0.5 + nx * w0 * 0.45, y + diry * len * 0.5 + ny * w0 * 0.45, ex, ey);
      c.quadraticCurveTo(x + dirx * len * 0.5 - nx * w0 * 0.45, y + diry * len * 0.5 - ny * w0 * 0.45, x - nx * w0, y - ny * w0);
      c.closePath(); c.fill();
    }
    c.globalCompositeOperation = "source-over";
  }

  /* ---------- particles ---------- */
  let sparks = [], frags = [], broke = false;
  const SPARK_MAX = lowPower ? 360 : 900;
  function emit(x, y, dirx, diry, n, speed, heat) {
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 0.22;
      const vx = dirx * Math.cos(spread) - diry * Math.sin(spread), vy = diry * Math.cos(spread) + dirx * Math.sin(spread);
      const v = speed * (0.35 + Math.random());
      const life = 1 + Math.random() * 2.2;
      sparks.push({ x, y, vx: vx * v, vy: vy * v, l: life, m: life, s: (1.2 + Math.random() * 2.6) * dpr * (0.6 + heat) });
    }
    if (sparks.length > SPARK_MAX) sparks.splice(0, sparks.length - SPARK_MAX);
  }

  /* ---------- scroll progress ---------- */
  let pTarget = 0, p = 0;
  const pinned = parseFloat(new URLSearchParams(location.search).get("p"));   // ?p=0.7 freezes the story (for previews)
  function readScroll() {
    const r = story.getBoundingClientRect();
    const total = story.offsetHeight - (vh || innerHeight);
    pTarget = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  }
  addEventListener("scroll", readScroll, { passive: true });

  let logIndex = -1;
  function updateLog() {
    if (!logEl) return;
    let i = -1;
    for (let k = 0; k < LOG.length; k++) if (p >= LOG[k][0]) i = k;
    if (i === logIndex) return;
    logIndex = i;
    logEl.classList.remove("on");
    if (i < 0 || !LOG[i][1]) { logEl.innerHTML = ""; return; }
    logEl.innerHTML = `<small>${LOG[i][1]}</small>${LOG[i][2]}`;
    void logEl.offsetWidth;                 // restart the fade
    logEl.classList.add("on");
  }

  /* ---------- frame ---------- */
  let visible = true, last = performance.now(), time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(1, (now - last) / 1000), dt = Math.min(0.05, real);
    last = now;
    if (!visible || document.hidden || !F) return;
    time += dt;
    const calm = reduce || (window.Sky && Sky.calm);
    if (pinned >= 0) pTarget = pinned;
    p += (pTarget - p) * (1 - Math.exp(-real * 3.2));
    if (Math.abs(pTarget - p) < 0.0005) p = pTarget;
    const S = F.S * dpr;

    // ---- back layer: horizon glow, Saturn, moons ----
    cS.clearRect(0, 0, cvS.width, cvS.height);
    const [sx, sy] = P(SUN.x, SUN.y);
    const g = cS.createRadialGradient(sx, sy, 0, sx, sy, 760 * S);
    g.addColorStop(0, "rgba(255,196,120,.85)"); g.addColorStop(0.12, "rgba(255,150,80,.42)");
    g.addColorStop(0.4, "rgba(170,90,110,.12)"); g.addColorStop(1, "rgba(60,40,90,0)");
    cS.save(); cS.translate(sx, sy); cS.scale(1, 0.32); cS.translate(-sx, -sy);
    cS.fillStyle = g; cS.fillRect(sx - 760 * S, sy - 760 * S, 1520 * S, 1520 * S);
    cS.restore();
    if (planet) {
      const [px, py] = P(SAT.x, SAT.y);
      const k = (SAT.R * S) / Rpx;
      cS.globalAlpha = smooth(0, 1600, now - planetAt);
      const hz = cS.createRadialGradient(px, py, SAT.R * S * 0.95, px, py, SAT.R * S * 1.5);
      hz.addColorStop(0, "rgba(255,210,160,.12)"); hz.addColorStop(1, "rgba(255,210,160,0)");
      cS.fillStyle = hz; cS.fillRect(px - SAT.R * S * 1.5, py - SAT.R * S * 1.5, SAT.R * S * 3, SAT.R * S * 3);
      cS.save(); cS.translate(px, py); cS.rotate(TILT); cS.scale(k, k);
      cS.drawImage(planet, -planet.width / 2, -planet.height / 2);
      cS.restore();
      cS.globalAlpha = 1;
    }
    MOONS.forEach((m, i) => {
      if (!moons[i]) return;
      const [x, y] = P(m.x, m.y);
      cS.drawImage(moons[i], x - moons[i].width / 2, y - moons[i].height / 2);
    });

    // ---- front layer: Cassini and fire ----
    cF.clearRect(0, 0, cvF.width, cvF.height);
    const A0 = 0.06, A1 = 0.62, B1 = 0.8;
    const t = smooth(A0, A1, p);
    const bob = calm ? 0 : Math.sin(time * 0.7) * 4;
    const c1 = { x: 860, y: 330 }, c2 = { x: 795, y: 300 }, u = 1 - t;
    const ix = u * u * u * CASSINI.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * ENTRY.x;
    const iy = u * u * u * CASSINI.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * ENTRY.y;
    let [cx, cy] = P(ix, iy + bob * (1 - t));
    let scale = (CASSINI.size / 152) * S * (1 - 0.93 * Math.pow(t, 1.5));
    const ang = CASSINI.ang + (calm ? 0 : Math.sin(time * 0.4) * 0.012) + t * 0.12;
    const back = { x: -Math.cos(ang), y: -Math.sin(ang) };          // direction of the trail
    const burn = smooth(A1, B1, p);
    const heat = 0.35 + 0.65 * burn;
    if (burn > 0) {                                                   // keep sinking in as it burns
      const d = 34 * S * burn;
      cx -= back.x * d; cy -= back.y * d;
      scale *= 1 - 0.5 * burn;
    }
    const dishX = cx + back.x * 30 * scale, dishY = cy + back.y * 30 * scale;
    if (burn < 0.62) {
      broke = false; frags.length = 0;
      const jetLen = 330 * S * (1 - 0.85 * Math.pow(t, 1.5)) * (1 + burn * 0.8);
      drawJet(cF, dishX, dishY, back.x, back.y, jetLen, 9 * scale * (1 + burn), heat);
      const rate = (lowPower ? 70 : 170) * (calm ? 0.25 : 1) * (1 + burn * 3);
      emit(dishX, dishY, back.x, back.y, Math.round(rate * dt + Math.random() * 0.8), 270 * S * (0.25 + 0.75 * (1 - t)) + burn * 60 * dpr, heat);
      drawCassini(cF, cx, cy, scale, ang, heat);
    } else if (!broke) {
      broke = true;
      for (let k = 0; k < 12; k++) {
        const a = ang + (Math.random() - 0.5) * 1.2;
        const v = (20 + Math.random() * 60) * dpr;
        frags.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1.6 + Math.random() * 1.6 });
      }
    }
    // the flash of the breakup and the afterglow on Saturn's face
    const fl = smooth(0.56, 0.66, burn) * (1 - smooth(0.7, 1, burn));
    const glow = smooth(0.6, 1, burn) * (1 - smooth(0.82, 1, p) * 0.6);
    if (fl > 0 || glow > 0) {
      cF.globalCompositeOperation = "lighter";
      const r = SAT.R * S * (0.25 + 0.5 * fl);
      const gr = cF.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(255,252,236,${0.95 * fl + 0.25 * glow})`);
      gr.addColorStop(0.3, `rgba(255,180,90,${0.5 * fl + 0.18 * glow})`);
      gr.addColorStop(1, "rgba(255,90,20,0)");
      cF.fillStyle = gr; cF.fillRect(cx - r, cy - r, r * 2, r * 2);
      cF.globalCompositeOperation = "source-over";
    }
    cF.globalCompositeOperation = "lighter";
    const drag = Math.pow(0.55, dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const q = sparks[i];
      q.l -= dt; if (q.l <= 0) { sparks.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= drag; q.vy *= drag;
      const k = q.l / q.m;
      spr(cF, q.x, q.y, q.s * (0.5 + k), k * 0.9);
    }
    for (let i = frags.length - 1; i >= 0; i--) {
      const f = frags[i];
      f.l -= dt; if (f.l <= 0) { frags.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      spr(cF, f.x, f.y, 10 * dpr * Math.min(1, f.l), Math.min(1, f.l));
      if (Math.random() < 0.6) sparks.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 10 * dpr, vy: (Math.random() - 0.5) * 10 * dpr, l: 0.6, m: 0.6, s: 6 * dpr });
    }
    cF.globalAlpha = 1;
    cF.globalCompositeOperation = "source-over";

    // ---- the page around the story ----
    const uiA = 1 - smooth(0.02, 0.1, p);
    ui.style.opacity = uiA.toFixed(3);
    ui.style.visibility = uiA < 0.01 ? "hidden" : "";
    dim.style.opacity = (smooth(0.8, 0.97, p) * 0.62).toFixed(3);
    const fA = smooth(0.84, 0.92, p);
    finale.style.opacity = fA.toFixed(3);
    finale.style.transform = `translate(-50%, ${-40 - fA * 10}%)`;
    updateLog();
  }

  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); readScroll(); }, 200); });
  if ("IntersectionObserver" in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(story);
  layout();
  readScroll();
  p = pinned >= 0 ? pinned : pTarget;
  requestAnimationFrame(frame);
})();
