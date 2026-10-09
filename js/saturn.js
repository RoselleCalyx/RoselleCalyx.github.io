/* =====================================================================
   Saturn & Cassini — the home page story.

   Everything is placed in the coordinates of the painting (1672 × 941)
   via window.HOME_FRAME, so the live layers line up with the painted
   foreground (assets/home-landscape.webp) on every screen.

   Layers, back to front:
     #sky (sky.js)  stars, Milky Way, shooting stars
     #saturn        horizon glow, ray-traced Saturn, moons
     .hero-land     painted clouds, mountain, the traveller and the cat
     #fx            outer near-side rings
     #rings         inner rings and ice, then Cassini and its final burn

   Scrolling through .story moves Cassini toward Saturn; it enters the
   atmosphere, breaks apart and becomes light — 15 September 2017.
   ===================================================================== */
(function () {
  const story = document.querySelector(".story");
  const hero = document.getElementById("hero");
  const cvS = document.getElementById("saturn"), cS = cvS && cvS.getContext("2d");
  const cvF = document.getElementById("fx"), cF = cvF && cvF.getContext("2d");
  const cvR = document.getElementById("rings"), cR = cvR ? cvR.getContext("2d") : cF;   // foreground rings and spacecraft
  if (!story || !cS || !cF) return;
  const land = document.getElementById("heroLand");
  const ui = document.getElementById("heroUI");
  const cosmos = document.getElementById("heroCosmos");
  const veil = document.getElementById("heroVeil");
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
  const CASSINI = { x: 915, y: 350, size: 420 };   // projected foreground scale
  const ENTRY = { x: 805, y: 370 };                      // where it meets the clouds of Saturn

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
    // Irregular density waves at several scales, rather than evenly spaced stripes.
    const fine = 0.67 + 0.24 * n1(r * 143) + 0.09 * n1(r * 673);
    if (r > 1.11 && r < 1.239) { o = 0.04; col = [130, 116, 102]; }
    else if (r >= 1.239 && r < 1.527) { const t = (r - 1.239) / 0.288; o = (0.12 + 0.14 * t) * (0.55 + 0.45 * n1(r * 70)); col = [168, 146, 124]; }
    else if (r >= 1.527 && r < 1.951) {
      const t = (r - 1.527) / 0.424;
      o = 0.7 + 0.24 * Math.sin(t * Math.PI) + 0.06 * (n1(r * 95) - 0.5);
      const br = 0.88 + 0.12 * n1(r * 55);
      col = [231 * br, 217 * br, 198 * br];
    } else if (r >= 1.951 && r < 2.027) { o = 0.06 + 0.05 * n1(r * 200); col = [96, 84, 74]; }
    else if (r >= 2.027 && r < 2.269) {
      const t = (r - 2.027) / 0.242;
      o = 0.62 - 0.12 * t;
      if (Math.abs(r - 2.214) < 0.0045) o *= 0.12;
      if (Math.abs(r - 2.265) < 0.0016) o *= 0.3;
      col = [211, 201, 185];
    } else if (Math.abs(r - 2.324) < 0.0035) { o = 0.38; col = [236, 220, 196]; }
    const edgeFade = smooth(1.11, 1.125, r) * (1 - smooth(2.266, 2.269, r));
    const density = o * fine * (r < 2.27 ? edgeFade : 1);
    // Slant through the ring plane determines transmission; dense and dusty
    // regions retain different optical depths instead of a uniform flat wash.
    ringO[i] = clamp(1 - Math.exp(-density * 0.65 / Math.sin(B)), 0, 1);
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
    const front = c2.createImageData(w, h), FD = front.data;
    const inner = c2.createImageData(w, h), ID = inner.data;     // B and C rings, inside the Cassini division
    const CASSINI_DIV = 1.951;
    const ox = w / 2, oy = h / 2, edge = 1 + 3 / Rp;
    const rc = [0, 0, 0];
    function ring(x, y) {
      const zr = (-y * cB) / sB;
      const rr = Math.sqrt(x * x + y * y + zr * zr);
      if (rr <= RMIN || rr >= RMAX) return 0;
      const i = ringIdx(rr), o = ringO[i];
      if (o < 0.003) return 0;
      const azimuth = Math.atan2(zr, x);
      const grain = 0.97 + 0.06 * h1(Math.floor(x * Rp) * 17 + Math.floor(y * Rp) * 131);
      const scatter = 0.045 * Math.cos(azimuth - Math.atan2(Lz, Lx));
      let lit = (0.56 + 0.66 * Ln + 0.14 * Math.max(0, x / rr) + scatter) * grain;
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
          const seen = ro > 0 && (front || d2 >= edge);
          const isInner = seen && Math.sqrt(x * x + y * y + zr * zr) < CASSINI_DIV;
          if (seen && !isInner) {
            ar = rr0 * ro + ar * (1 - ro); ag = rg0 * ro + ag * (1 - ro); ab = rb0 * ro + ab * (1 - ro);
            aa = ro + aa * (1 - ro);
          }
          const k = (py * w + px) * 4;
          if (isInner) { ID[k] = rr0; ID[k + 1] = rg0; ID[k + 2] = rb0; ID[k + 3] = ro * 255; }   // drawn above every other layer
          if (aa > 0) {
            D[k] = ar / aa; D[k + 1] = ag / aa; D[k + 2] = ab / aa; D[k + 3] = aa * 255;
            if (!isInner && zr > 0 && d2 > 1.015 && ro > 0) {
              FD[k] = rr0; FD[k + 1] = rg0; FD[k + 2] = rb0; FD[k + 3] = ro * 255;
              D[k + 3] = 0;
            }
          }
        }
      }
      if (row < h) yieldThen(chunk);
      else {
        c2.putImageData(img, 0, 0);
        const rings = document.createElement("canvas"); rings.width = w; rings.height = h;
        rings.getContext("2d").putImageData(front, 0, 0);
        const inn = document.createElement("canvas"); inn.width = w; inn.height = h;
        inn.getContext("2d").putImageData(inner, 0, 0);
        cv.frontRings = rings; cv.innerRings = inn; done(cv);
      }
    }
    chunk();
  }


  // Cache a lit sphere with surface relief; no texture work runs during animation.
  function moonSprite(r, seed) {
    const size = Math.ceil(r * 2 + 6), cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d"), im = c.createImageData(size, size), mid = size / 2;
    const craters = Array.from({length: 45}, (_, i) => ({
      x: (h1(seed + i * 3) * 2 - 1) * .87,
      y: (h1(seed + i * 3 + 1) * 2 - 1) * .87,
      r: .024 + h1(seed + i * 3 + 2) * .13
    }));
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x + .5 - mid) / r, ny = (y + .5 - mid) / r, dd = nx * nx + ny * ny;
      if (dd >= 1) continue;
      const nz = Math.sqrt(1 - dd);
      let relief = .86 + .09 * n1(nx * 25 + ny * 38 + seed) + .05 * n1(ny * 85 - nx * 44);
      for (const q of craters) {
        const d = Math.hypot(nx - q.x, ny - q.y) / q.r;
        if (d < 1.25) relief += d < .85 ? -.19 * (1 - d * .4) : .12 * (1 - Math.abs(d - 1) * 4);
      }
      const light = .07 + .93 * Math.pow(Math.max(0, nx * -.66 + ny * .35 + nz * .66), .8);
      const k = (y * size + x) * 4;
      im.data[k] = 226 * relief * light; im.data[k + 1] = 217 * relief * light;
      im.data[k + 2] = 203 * relief * light; im.data[k + 3] = clamp((1 - Math.sqrt(dd)) * r, 0, 1) * 255;
    }
    c.putImageData(im, 0, 0); return cv;
  }

  // The painted clouds give way wherever they overlap Saturn's inner rings, or rise above them:
  // everything above the lower edge of the inner rings' near arc fades out, softly, and less toward the ring tips.
  function ringCut(px, py) {
    const A = 1.951 * SAT.R, Bm = A * Math.sin(B), ct = Math.cos(TILT), st = Math.sin(TILT);
    const dx = px - SAT.x, dy = py - SAT.y, u = dx * ct + dy * st, v = -dx * st + dy * ct;
    const q = Math.min(1, Math.abs(u) / A), edge = Bm * Math.sqrt(Math.max(0, 1 - q * q));
    const keep = smooth(edge - 56, edge + 4, v);                 // 0 above the ring line, 1 below it
    const reach = 1 - smooth(0.86 * A, 1.04 * A, Math.abs(u));   // no cut beyond the ring tips
    return 1 - (1 - keep) * reach;
  }

  // Feather the original cutout in canvas while keeping the traveller and cat opaque.
  const landscape = new Image();
  landscape.onload = () => {
    land.width = landscape.naturalWidth; land.height = landscape.naturalHeight;
    const c = land.getContext("2d"); c.drawImage(landscape, 0, 0);
    const im = c.getImageData(0, 0, land.width, land.height), d = im.data;
    for (let x = 0; x < land.width; x++) {
      let edge = -1;
      for (let y = 0; y < land.height; y++) {
        const k = (y * land.width + x) * 4;
        if (edge < 0 && d[k + 3] > 48) edge = y;
        if (edge < 0) { d[k + 3] = 0; continue; }
        const subjectDistance = Math.hypot((x - 580) / 220, (y + LAND_Y0 - 650) / 240);
        const protection = 1 - smooth(.65, 1, subjectDistance);
        const edgeFade = smooth(0, 100, y - edge);
        const feather = edgeFade + protection * (1 - edgeFade);
        const bottom = 1 - smooth(land.height - 155, land.height, y);
        d[k + 3] *= feather * bottom * ringCut(x, y + LAND_Y0);
      }
    }
    c.putImageData(im, 0, 0);
  };
  landscape.src = "assets/home-landscape.webp";
  function skyStyle() {
    document.body.dataset.homeSky = window.Sky ? Sky.style : "realist";
  }
  addEventListener("skystyle", skyStyle); skyStyle();

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
    if (cvR) { cvR.width = cvS.width; cvR.height = cvS.height; }
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
    if (veil) {                                             // deep space wrapped around the planet and its rings
      const R = SAT.R * F.S, w = R * 4.8, h = R * 2.8;
      veil.style.width = w + "px"; veil.style.height = h + "px";
      veil.style.transform = `translate(${F.left + SAT.x * F.S - w / 2}px, ${F.top + SAT.y * F.S - h / 2}px) rotate(${TILT}rad)`;
    }
  }

  /* ---------- Cassini, drawn as in the painting: boom forward, dish behind ---------- */
  function drawCassini(c, x, y, s, ang, heat) {
    if (window.CassiniArt) CassiniArt.draw(c, x, y, s, ang);
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


  // One continuous flyby: broad curved coast, then an accelerating atmospheric descent.
  // This is an artistic projection, not mission ephemeris.
  function flight(progress) {
    const t = clamp((progress - .035) / .575, 0, 1);
    const u = .16 * t + .84 * Math.pow(t, 1.65), v = 1 - u;
    const mobile = vw < 760;
    const a = mobile ? {x: 725, y: 505} : CASSINI;
    const b = mobile ? {x: 865, y: 485} : {x: 1210, y: 390};
    const c = mobile ? {x: 865, y: 410} : {x: 945, y: 500}, d = ENTRY;
    let x = v*v*v*a.x + 3*v*v*u*b.x + 3*v*u*u*c.x + u*u*u*d.x;
    let y = v*v*v*a.y + 3*v*v*u*b.y + 3*v*u*u*c.y + u*u*u*d.y;
    const dx = 3*v*v*(b.x-a.x) + 6*v*u*(c.x-b.x) + 3*u*u*(d.x-c.x);
    const dy = 3*v*v*(b.y-a.y) + 6*v*u*(c.y-b.y) + 3*u*u*(d.y-c.y);
    const angle = .34 + (Math.atan2(dy, dx) - .34) * smooth(0, .3, u), sink = smooth(.61, .8, progress);
    const elapsed = clamp(progress - .61, 0, .21);
    const entrySpeed = Math.hypot(dx, dy) * (1.546 / .575);
    const descent = entrySpeed * elapsed * (1 + 1.8 * elapsed);
    x += Math.cos(angle) * descent; y += Math.sin(angle) * descent;
    return {x,y,angle,u,scale: ((mobile ? 235 : CASSINI.size) / 340) * (1 - .82 * u) * (1 - .4 * sink)};
  }

  // Always render the same state at the same scroll position, including when scrolling back.
  function drawArrival(c, progress, S, motionTime) {
    const f = flight(progress), [x,y] = P(f.x,f.y), s = f.scale*S;
    const heat = smooth(.55,.68,progress), gone = smooth(.71,.79,progress);
    if (progress > .03 && progress < .61) {
      c.lineWidth = .7*dpr; c.strokeStyle = "rgba(204,218,241,.11)";
      c.beginPath();
      for (let i=0;i<=45;i++) {
        const q=flight(.035+(.61-.035)*i/45), v=P(q.x,q.y);
        if(i===0)c.moveTo(...v); else c.lineTo(...v);
      }
      c.stroke();
    }
    if (heat > 0 && gone < 1) {
      c.save(); c.globalAlpha = heat * (1-gone);
      const backX = -Math.cos(f.angle), backY = -Math.sin(f.angle);
      drawJet(c,x,y,backX,backY,(75+150*heat)*S,(2+7*heat)*S,heat);
      c.globalCompositeOperation = "lighter";
      for(let i=0;i<(lowPower?36:85);i++) {
        const phase=(h1(i+9)+motionTime*.22)%1, distance=phase*(70+170*heat);
        const side=(h1(i+80)-.5)*22*phase;
        const px=x+(backX*distance-backY*side)*S, py=y+(backY*distance+backX*side)*S;
        spr(c,px,py,(1+h1(i+56)*4)*S,(1-phase)*heat*(1-gone)*.7);
      }
      c.restore();
    }
    if (gone < 1) {
      c.save(); c.globalAlpha=1-gone;
      drawCassini(c,x,y,s,f.angle,heat*.75);
      c.restore();
    }
    const breakup = smooth(.70,.84,progress), fade = 1-smooth(.79,.91,progress);
    if(breakup>0 && fade>0) {
      const at=flight(.715), [bx,by]=P(at.x,at.y);
      c.save(); c.globalCompositeOperation="lighter";
      for(let i=0;i<(lowPower?22:52);i++) {
        const angle=at.angle+(h1(i+140)-.5)*.65;
        const distance=(14+h1(i+210)*105)*breakup*S;
        const px=bx+Math.cos(angle)*distance, py=by+Math.sin(angle)*distance;
        const length=(5+h1(i+170)*28)*S*breakup;
        const tailX=px-Math.cos(angle)*length, tailY=py-Math.sin(angle)*length;
        const trail=c.createLinearGradient(px,py,tailX,tailY);
        trail.addColorStop(0,"rgba(255,233,183,"+fade*.75+")"); trail.addColorStop(1,"rgba(255,115,46,0)");
        c.strokeStyle=trail; c.lineWidth=(.5+h1(i+88))*S;
        c.beginPath(); c.moveTo(px,py); c.lineTo(tailX,tailY); c.stroke();
        spr(c,px,py,(2+h1(i+310)*6)*S,fade*(.3+h1(i+45)*.5));
      }
      const flash = smooth(.70,.735,progress)*(1-smooth(.745,.82,progress));
      spr(c,bx,by,(28+90*breakup)*S,flash*.75);
      // Localized warm cloud illumination, dissipating along the limb.
      c.globalAlpha=1;
      const glow=c.createRadialGradient(bx,by,0,bx,by,125*S);
      glow.addColorStop(0,"rgba(255,188,102,"+flash*.18+")");
      glow.addColorStop(1,"rgba(255,115,62,0)");
      c.fillStyle=glow; c.fillRect(bx-125*S,by-125*S,250*S,250*S);
      c.restore();
    }
    c.globalAlpha=1; c.globalCompositeOperation="source-over";
  }

  function drawRingImage(c, S, image) {
    if (!planet || !image) return;
    const [px, py] = P(SAT.x, SAT.y), k = SAT.R * S / Rpx;
    c.save(); c.translate(px, py); c.rotate(TILT); c.scale(k, k);
    c.drawImage(image, -planet.width / 2, -planet.height / 2); c.restore();
  }
  function drawRingDust(c, S, motionTime) {
    const [px, py] = P(SAT.x, SAT.y);
    drawRingImage(c, S, planet && planet.innerRings);
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    for (let i = 0; i < (lowPower ? 100 : 240); i++) {
      const radius = SAT.R * (1.55 + h1(i + 50) * .75), a = h1(i + 110) * Math.PI + motionTime * .009 / (radius / SAT.R);
      const dx = Math.cos(a) * radius, dy = Math.sin(a) * radius * Math.sin(B);
      const x = px + (dx * ct - dy * st) * S, y = py + (dx * st + dy * ct) * S;
      if (Math.hypot(dx, dy) < SAT.R * 1.035) continue;
      c.fillStyle = "rgba(235,224,206," + (.10 + h1(i + 310) * .20) + ")";
      const size = (.2 + h1(i + 410) * .45) * S;
      c.beginPath(); c.ellipse(x, y, size, size * .58, TILT, 0, Math.PI * 2); c.fill();
    }
  }

  /* ---------- scroll progress ---------- */
  let pTarget = 0, p = 0;
  const pinned = parseFloat(new URLSearchParams(location.search).get("p"));   // ?p=0.7 freezes the story (for previews)
  function readScroll() {
    const r = story.getBoundingClientRect();
    const total = story.offsetHeight - (vh || innerHeight);
    pTarget = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    leaving(r);
  }
  let leaveLast = -1;
  function leaving(r) {
    const H = innerHeight, k = clamp((H - r.bottom) / (H * 0.7), 0, 1), e = k * k * (3 - 2 * k);
    if (Math.abs(e - leaveLast) < 0.002) return;
    leaveLast = e;
    hero.classList.toggle("leaving", e > 0);
    hero.style.setProperty("--leave", e.toFixed(3));
    hero.style.opacity = (1 - e * 0.85).toFixed(3);
    document.body.style.setProperty("--home-sky", (0.48 + e * 0.37).toFixed(3));
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

  // Staggered showers in the open sky; tails fade, heads flare briefly.
  function drawMeteors(c, t, S) {
    const configs = [[13, 10.8, .92, .05, .20, .24], [21, 16.3, .84, .22, .18, .21], [29, 25.5, .97, .40, .14, .17]];
    for (const [period, offset, sx, sy, dx, dy] of configs) {
      const phase=(t+offset)%period, life=1.65;
      if(phase>life)continue;
      const u=phase/life, alpha=Math.sin(Math.PI*u)*.88;
      const x=(sx-dx*u)*cvS.width,y=(sy+dy*u)*cvS.height;
      const len=(85+u*70)*S, angle=Math.atan2(dy*cvS.height,-dx*cvS.width);
      const tx=x-Math.cos(angle)*len,ty=y-Math.sin(angle)*len;
      const g=c.createLinearGradient(x,y,tx,ty);g.addColorStop(0,`rgba(255,243,210,${alpha})`);g.addColorStop(.24,`rgba(255,196,129,${alpha*.55})`);g.addColorStop(1,'rgba(179,207,255,0)');
      c.strokeStyle=g;c.lineWidth=1.15*dpr;c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();
      c.save();c.globalCompositeOperation='lighter';spr(c,x,y,10*dpr,alpha*.8);c.restore();
    }
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
    p += (pTarget - p) * (calm ? 1 : 1 - Math.exp(-real * 5));
    if (Math.abs(pTarget - p) < 0.0005) p = pTarget;
    const S = F.S * dpr;

    // ---- back layer: horizon glow, Saturn, moons ----
    cS.clearRect(0, 0, cvS.width, cvS.height);

    // Sparse live stars sit above the photographic sky, behind Saturn and the landscape.
    cS.save();
    for (let i = 0; i < (lowPower ? 38 : 75); i++) {
      const x = h1(i + 580) * cvS.width, y = h1(i + 780) * cvS.height * .62;
      const twinkle = calm ? .5 : .5 + .5 * Math.sin(time * (.25 + h1(i + 840) * .4) + i);
      cS.fillStyle = "rgba(226,235,255," + (.12 + twinkle * .33) + ")";
      cS.beginPath(); cS.arc(x, y, (.4 + h1(i + 960) * .5) * dpr, 0, Math.PI * 2); cS.fill();
    }
    if (!calm) drawMeteors(cS, time, S);

    cS.restore();
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
      const drift = calm ? 0 : Math.sin(time * .035 + i) * 4;
      const [x, y] = P(m.x + drift, m.y + drift * .25);
      cS.drawImage(moons[i], x - moons[i].width / 2, y - moons[i].height / 2);
    });


    // Front ring arc, ice particles, then the spacecraft.
    cF.clearRect(0, 0, cvF.width, cvF.height);
    const motionTime = calm ? 0 : time;
    if (cR !== cF) cR.clearRect(0, 0, cvR.width, cvR.height);
    drawRingImage(cF, S, planet && planet.frontRings);          // the outer ring's near arc, just above the landscape
    drawRingDust(cR, S, motionTime);
    // Cassini is foreground: all near-side ring surfaces must be behind it.
    drawArrival(cR, p, S, motionTime);
    if (cosmos) cosmos.style.transform = calm ? "none" : `translate3d(${Math.sin(time*.025)*.35}%, ${-p*1.5}%, 0) scale(1.02)`;

    // ---- the page around the story ----
    const uiA = 1 - smooth(0.02, 0.1, p);
    ui.style.opacity = uiA.toFixed(3);
    ui.style.visibility = uiA < 0.01 ? "hidden" : "";
    const dimA = smooth(0.8, 1, p) * 0.46;
    dim.style.opacity = dimA.toFixed(3);
    if (cvR) cvR.style.opacity = (1 - dimA).toFixed(3);              // the top layer dims with the rest at the end
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
