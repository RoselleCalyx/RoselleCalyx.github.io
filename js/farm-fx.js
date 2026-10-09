/* =====================================================================
   Farm FX: ambient life and little events over the painted valley.

   Two canvases share the world's coordinates (percent of the 16:9 scene):
     ambient (under the animals)  twinkling stars, shooting stars that set
       behind the mountains, winter aurora, geese, the moon's breath,
       village lights, glints on the far lake, the waterfall, chimney
       smoke, window and lantern glow (with moths in summer), the pond
       (ripples, koi shadows, a koi that jumps, ice glints in winter),
       paw prints in the snow, and the rainbow after rain
     foreground (over the animals)  rain, gusts of wind with their
       streaks and flying debris, and the sparkles when you touch things
   Positions are read from the painting (assets/farm/meadow-*.webp).
   Add ?fx=demo to the page to see every event within a few seconds.
   ===================================================================== */
(function () {
  const params = new URLSearchParams(location.search);
  const DEMO = params.get("fx") === "demo";
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia("(pointer: coarse)").matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const R = Math.random, rr = (a, b) => a + R() * (b - a);

  /* ---------- the painting's geometry (percent) ---------- */
  const SKYLINE = [[0, 9], [9, 14], [17, 10], [20, 7.5], [23, 10], [26, 13], [30, 16.5], [34, 17], [38, 17.5], [41, 16], [43, 15], [45, 17.5], [48, 20.5], [52, 21], [55, 21.5], [60, 22.5], [65, 23.5], [70, 22.5], [73, 20.5], [78, 19.5], [82, 18], [88, 16.5], [92, 13.5], [95, 11.5], [100, 10]];
  const skyY = (x) => { for (let i = 1; i < SKYLINE.length; i++) { const [x1, y1] = SKYLINE[i], [x0, y0] = SKYLINE[i - 1]; if (x <= x1) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0 || 1)); } return 10; };
  const MOON = [90.1, 6.7];
  const POND = { cx: 64.5, cy: 79, rx: 21.5, ry: 7.2 };
  const POND_GLINTS = [[42.7, 74.5], [52.1, 77], [79.6, 75.5], [62, 73.5]];
  const LANTERNS = [[31.5, 55.4], [42.4, 65.3], [54.7, 84.7], [79.4, 54.2], [94.3, 66.2], [13.3, 47.7], [38.3, 49.1]];
  const WINDOWS = [[27.4, 39.6], [32.3, 40], [27.4, 44.8], [35.9, 44.8], [32.3, 45.6]];
  const VILLAGE = [[83.9, 40.1], [85.9, 39.8], [88, 39.6], [93.8, 29.6], [95.3, 29.2], [61.5, 34.7], [64, 35.1], [74, 36], [78.1, 42.1], [81.2, 42.3], [56.5, 34.3]];
  const CHIMNEY = [30.3, 31.3];
  const FALL = { x: 89.6, y0: 33, y1: 38.4 };
  const LAKE = { x0: 60, x1: 90, y0: 36, y1: 47 };

  let world = null, amb = null, fg = null, actx = null, fctx = null, W = 0, H = 0, dpr = 1;
  const S = {
    stars: [], meteors: [], birds: null, smoke: [], smokeT: 0, ripples: [], fish: null, splash: [], koi: [],
    prints: [], printT: new Map(), gust: null, debris: [], drops: [], rain: 0, rainOn: false, rainEnd: 0, rainbow: 0,
    bursts: [], texts: [], aurora: 0, last: -1, lastSeason: "", next: {}
  };
  const api = { wind: 0 };

  /* ---------- sprites ---------- */
  function glow(rgb, soft) {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(soft ? 0.35 : 0.2, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  }
  const WARM = glow("255,206,128", true), WHITE = glow("255,255,255"), PINK = glow("255,210,230"), SMOKE = glow("214,208,228", true), GOLD = glow("255,226,150");

  /* ---------- set up ---------- */
  function init(worldEl) {
    world = worldEl;
    amb = document.createElement("canvas"); amb.className = "farm-fx farm-fx-ambient";
    fg = document.createElement("canvas"); fg.className = "farm-fx farm-fx-front";
    const land = world.querySelector(".farm-landscapes");
    if (land && land.nextSibling) world.insertBefore(amb, land.nextSibling); else world.prepend(amb);
    world.appendChild(fg);
    world.classList.add("fx-on");
    actx = amb.getContext("2d"); fctx = fg.getContext("2d");
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
      W = world.offsetWidth; H = world.offsetHeight;
      for (const c of [amb, fg]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    };
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(world);
    const n = lowPower ? 40 : 80;
    for (let i = 0; i < n; i++) {
      let x, y, k = 0;
      do { x = rr(1, 99); y = rr(0.8, skyY(x) - 2.5); k++; } while ((Math.hypot(x - MOON[0], (y - MOON[1]) * 1.7) < 4 || y < 0.5) && k < 20);
      S.stars.push({ x, y, s: rr(0.5, 1.4) * (R() < 0.12 ? 1.8 : 1), ph: rr(0, 6.3), sp: rr(0.6, 2.2) });
    }
    S.koi = [{ ph: 0, sp: 0.07, col: "236,120,60" }, { ph: 2.4, sp: 0.055, col: "244,236,226" }, { ph: 4.1, sp: 0.065, col: "232,96,70" }];
    const now = 0;
    S.next = DEMO
      ? { meteor: 1.5, birds: 3, fish: 2, gust: 4, rain: 6 }
      : { meteor: rr(4, 12), birds: rr(15, 35), fish: rr(8, 20), gust: rr(14, 30), rain: rr(70, 140) };
    S.t0 = now;
  }
  const px = (x) => (x / 100) * W, py = (y) => (y / 100) * H;
  function skyClip(c) {
    c.beginPath(); c.moveTo(0, 0);
    for (const [x, y] of SKYLINE) c.lineTo(px(x), py(y));
    c.lineTo(W, 0); c.closePath(); c.clip();
  }
  const inPond = (x, y, k = 1) => ((x - POND.cx) / (POND.rx * k)) ** 2 + ((y - POND.cy) / (POND.ry * k)) ** 2 < 1;
  function pondPoint(k = 0.8) {
    for (let i = 0; i < 20; i++) { const x = rr(POND.cx - POND.rx, POND.cx + POND.rx), y = rr(POND.cy - POND.ry, POND.cy + POND.ry); if (inPond(x, y, k)) return [x, y]; }
    return [POND.cx, POND.cy];
  }

  /* ---------- events ---------- */
  function ripple(x, y, size = 1) { if (S.ripples.length < 60) S.ripples.push({ x, y, r: 0, max: rr(10, 22) * size * (W / 1400), life: 0, dur: rr(1.8, 2.6) }); }
  function startGust(time) {
    S.gust = { t0: time, dur: DEMO ? 3.2 : rr(3, 4.2), dir: R() < 0.75 ? 1 : -1, hit: new Set() };
    S.gustLines = Array.from({ length: lowPower ? 8 : 16 }, () => ({ y: rr(38, 96), len: rr(7, 15), off: rr(-16, 16), curl: R() < 0.45, w: rr(1.3, 2.6), wave: rr(6, 14) * (R() < 0.5 ? -1 : 1) }));
  }
  function startFish() {
    const [x, y] = pondPoint(0.6), dir = R() < 0.5 ? 1 : -1;
    S.fish = { x0: x, y0: y, x1: clamp(x + dir * rr(3.5, 5.5), POND.cx - POND.rx * 0.7, POND.cx + POND.rx * 0.7), y1: y + rr(-1, 1), t: 0, dur: 0.95, h: rr(3, 4.5), splashed: false, col: R() < 0.6 ? "236,120,60" : "244,236,226" };
    splash(x, y);
  }
  function splash(x, y) {
    ripple(x, y, 1.4); ripple(x, y, 0.8);
    for (let i = 0; i < 12; i++) S.splash.push({ x: px(x), y: py(y), vx: rr(-60, 60) * (W / 1400), vy: rr(-150, -60) * (W / 1400), life: rr(0.5, 0.9) });
  }
  function burst(x, y, kind, text) {
    if (!W) return;
    const n = kind === "heart" ? 9 : kind === "fruit" ? 16 : 12;
    for (let i = 0; i < n; i++) {
      const a = rr(0, 6.28), sp = rr(30, 110) * (kind === "heart" ? 0.6 : 1);
      S.bursts.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === "heart" ? 50 : 30), life: rr(0.7, 1.3), max: 1.3, s: rr(3, 6), rot: rr(0, 6.3) });
    }
    if (text) S.texts.push({ x, y, text, life: 1.3 });
  }
  function touch(x, y, season) {        // pixels within the world
    const xp = (x / W) * 100, yp = (y / H) * 100;
    if (inPond(xp, yp, 0.95)) { if (season === "winter") burst(x, y, "ice"); else { ripple(xp, yp, 1.3); ripple(xp, yp, 0.7); } return; }
    burst(x, y, season === "winter" ? "snow" : "touch");
  }

  /* ---------- update ---------- */
  function update(dt, time, info) {
    if (!actx || !W) return;
    const { season, calm, animals } = info;
    if (season !== S.lastSeason) { S.lastSeason = season; S.prints = []; if (season !== "spring" && season !== "summer") { S.rainOn = false; } }
    if (!calm) schedule(time, season);
    if (!calm) step(dt, time, season, animals || []);
    api.wind = 0;
    if (S.gust) {
      const g = (time - S.gust.t0) / S.gust.dur;
      if (g >= 1 || calm) { S.gust = null; }
      else { api.wind = Math.sin(Math.PI * g) * S.gust.dir; sweepTrees(g); }
    }
    // draw at ~30 fps (once a second when calm)
    if (time - S.last < (calm ? 1 : 1 / 30)) return;
    S.last = time;
    drawAmbient(time, season, calm);
    drawFront(time, season, calm);
  }

  function schedule(time, season) {
    const N = S.next, wait = (k, a, b) => { N[k] = time + (DEMO ? a / 4 : rr(a, b)); };
    if (time > N.meteor) { S.meteors.push(newMeteor()); if (R() < 0.15) setTimeout(() => S.meteors.push(newMeteor()), 400); wait("meteor", 9, 22); }
    if (time > N.birds) { if (season !== "winter" && !S.birds) S.birds = newBirds(time); wait("birds", 40, 80); }
    if (time > N.fish) { if (season !== "winter" && !S.fish) startFish(); wait("fish", 16, 34); }
    if (time > N.gust) { if (!S.gust) startGust(time); wait("gust", 24, 48); }
    if (time > N.rain) {
      if ((season === "spring" || season === "summer") && !S.rainOn) { S.rainOn = true; S.rainEnd = time + (DEMO ? 12 : rr(22, 34)); }
      wait("rain", 160, 280);
    }
    if (S.rainOn && time > S.rainEnd) { S.rainOn = false; S.rainbowT = time; }
  }
  function newMeteor() {
    const dir = R() < 0.5 ? 1 : -1, x = dir > 0 ? rr(5, 55) : rr(45, 95);
    const a = rr(0.28, 0.5), sp = rr(55, 80);       // percent of width per second
    return { x, y: rr(0.5, 5), vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp * (W / H), life: 0, len: rr(5, 9) };
  }
  function newBirds(time) {
    const dir = R() < 0.5 ? 1 : -1, n = 5 + ((R() * 4) | 0);
    return { t0: time, dir, y: rr(8, 15), dur: DEMO ? 12 : rr(22, 30), n, ph: rr(0, 6) };
  }
  function sweepTrees(g) {
    const front = S.gust.dir > 0 ? -20 + 140 * g : 120 - 140 * g;
    world.querySelectorAll(".tree").forEach((t) => {
      if (S.gust.hit.has(t)) return;
      const x = parseFloat(t.style.left);
      if ((S.gust.dir > 0 && front >= x) || (S.gust.dir < 0 && front <= x)) {
        S.gust.hit.add(t);
        const inner = t.querySelector(".tree-inner");
        if (!inner) return;
        inner.classList.remove("gust"); void inner.offsetWidth; inner.classList.add("gust");
        inner.style.setProperty("--gust-dir", S.gust.dir);
        setTimeout(() => inner.classList.remove("gust"), 2600);
      }
    });
  }

  function step(dt, time, season, animals) {
    const scale = W / 1400;
    // shooting stars
    for (let i = S.meteors.length - 1; i >= 0; i--) {
      const m = S.meteors[i]; m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.y > skyY(m.x) + 3 || m.x < -10 || m.x > 110 || m.life > 3) S.meteors.splice(i, 1);
    }
    if (S.birds && time - S.birds.t0 > S.birds.dur) S.birds = null;
    // chimney smoke
    S.smokeT += dt;
    if (S.smokeT > 0.45) {
      S.smokeT = 0;
      S.smoke.push({ x: px(CHIMNEY[0]) + rr(-2, 2) * scale, y: py(CHIMNEY[1]), vx: rr(2, 8) * scale, vy: rr(-20, -13) * scale, r: rr(3, 5) * scale, life: 0, dur: rr(5.5, 7.5), ph: rr(0, 6.3) });
    }
    for (let i = S.smoke.length - 1; i >= 0; i--) {
      const s = S.smoke[i]; s.life += dt;
      s.x += (s.vx + Math.sin(time * 0.8 + s.ph) * 4 * scale + api.wind * 60 * scale) * dt; s.y += s.vy * dt; s.vy *= 0.995; s.r += 3.6 * scale * dt;
      if (s.life > s.dur) S.smoke.splice(i, 1);
    }
    // pond
    if (season !== "winter") {
      if (R() < dt * (0.45 + S.rain * 9)) { const [x, y] = pondPoint(0.85); ripple(x, y, S.rain > 0.3 ? 0.6 : 1); }
      if (S.fish) {
        const f = S.fish; f.t += dt / f.dur;
        if (f.t >= 1 && !f.splashed) { f.splashed = true; splash(f.x1, f.y1); }
        if (f.t > 1.2) S.fish = null;
      }
    } else S.fish = null;
    for (let i = S.ripples.length - 1; i >= 0; i--) { const q = S.ripples[i]; q.life += dt; if (q.life > q.dur) S.ripples.splice(i, 1); }
    for (let i = S.splash.length - 1; i >= 0; i--) { const q = S.splash[i]; q.life -= dt; q.vy += 380 * scale * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) S.splash.splice(i, 1); }
    // paw prints in the snow
    if (season === "winter") {
      for (const a of animals) {
        if (!a.walking) continue;
        // one print every stride, left and right feet alternating
        const last = S.printT.get(a.id);
        const stride = 1.15 * a.size;
        if (!last || Math.hypot(a.x - last.x, (a.y - last.y) * 1.78) > stride) {
          const foot = last ? -last.foot : 1;
          S.printT.set(a.id, { x: a.x, y: a.y, foot });
          S.prints.push({ x: a.x, y: a.y + foot * 0.45 * a.size, s: a.size * 0.85, life: 16, dir: a.dir });
          if (S.prints.length > 200) S.prints.shift();
        }
      }
      for (let i = S.prints.length - 1; i >= 0; i--) { S.prints[i].life -= dt; if (S.prints[i].life <= 0) S.prints.splice(i, 1); }
    }
    // rain and the rainbow after it
    S.rain += ((S.rainOn ? 1 : 0) - S.rain) * Math.min(1, dt * 0.6);
    if (S.rainOn || S.rain > 0.02) {
      const want = Math.round((lowPower ? 140 : 300) * S.rain);
      while (S.drops.length < want) S.drops.push({ x: rr(0, W), y: rr(-H, H), len: rr(12, 22) * scale, sp: rr(700, 1000) * scale });
      if (S.drops.length > want) S.drops.length = want;
      for (const d of S.drops) { d.y += d.sp * dt; d.x += (-0.18 + api.wind * 0.6) * d.sp * dt; if (d.y > H) { d.y = rr(-60, -10); d.x = rr(0, W * 1.1); } }
    } else S.drops.length = 0;
    S.rainbow = S.rainbowT ? smooth(0, 4, time - S.rainbowT) * (1 - smooth(16, 26, time - S.rainbowT)) : 0;
    if (S.rainbowT && time - S.rainbowT > 26) S.rainbowT = 0;
    S.aurora += ((season === "winter" ? 1 : 0) - S.aurora) * Math.min(1, dt * 0.2);
    // gust debris
    if (S.gust) {
      const g = (time - S.gust.t0) / S.gust.dur, front = S.gust.dir > 0 ? -20 + 140 * g : 120 - 140 * g;
      for (let n = 0; n < 2; n++) if (R() < dt * 30 * Math.sin(Math.PI * g)) {
        const col = { spring: ["#fbd3df", "#f7b6c9", "#ffffff"], summer: ["#9cc56a", "#f4f1e6", "#c9d98a"], autumn: ["#d98a2a", "#b5482a", "#e6b23a"], winter: ["#ffffff", "#e8eefb"] }[season];
        S.debris.push({ x: px(front - S.gust.dir * rr(0, 12)), y: py(rr(45, 95)), vx: S.gust.dir * rr(260, 420) * scale, vy: rr(-40, 10) * scale, life: rr(1.2, 2.2), rot: rr(0, 6.3), vr: rr(-6, 6), s: rr(3, 6) * scale * (season === "winter" ? 0.6 : 1), col: col[(R() * col.length) | 0], ph: rr(0, 6.3), snow: season === "winter" });
      }
    }
    for (let i = S.debris.length - 1; i >= 0; i--) {
      const d = S.debris[i]; d.life -= dt; d.x += d.vx * dt; d.y += (d.vy + Math.sin(time * 5 + d.ph) * 40 * scale) * dt; d.rot += d.vr * dt; d.vx *= 0.995;
      if (d.life <= 0) S.debris.splice(i, 1);
    }
    // touch sparkles
    for (let i = S.bursts.length - 1; i >= 0; i--) { const b = S.bursts[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.96; b.vy = b.vy * 0.96 + (b.kind === "heart" ? -20 : 60) * dt; if (b.life <= 0) S.bursts.splice(i, 1); }
    for (let i = S.texts.length - 1; i >= 0; i--) { const t = S.texts[i]; t.life -= dt; t.y -= 34 * dt; if (t.life <= 0) S.texts.splice(i, 1); }
  }

  /* ---------- draw: behind the animals ---------- */
  function spr(c, img, x, y, s, a) { c.globalAlpha = clamp(a, 0, 1); c.drawImage(img, x - s / 2, y - s / 2, s, s); }
  function drawAmbient(time, season, calm) {
    const c = actx, scale = W / 1400, still = calm ? 0 : 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = "lighter";

    // the sky: aurora and rainbow sit behind the mountains
    c.save(); skyClip(c);
    if (S.aurora > 0.02) drawAurora(c, time, S.aurora);
    if (S.rainbow > 0.01) drawRainbow(c, S.rainbow);
    for (const m of S.meteors) {
      const hx = px(m.x), hy = py(m.y), sp = Math.hypot(m.vx, m.vy), tx = hx - (m.vx / sp) * px(m.len), ty = hy - (m.vy / sp) * px(m.len);
      const a = Math.min(1, m.life * 4) * (1 - smooth(skyY(m.x) - 4, skyY(m.x) + 2, m.y));
      const g = c.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); g.addColorStop(0.2, `rgba(220,230,255,${0.5 * a})`); g.addColorStop(1, "rgba(200,215,255,0)");
      c.strokeStyle = g; c.lineWidth = 1.6 * scale + 0.4; c.lineCap = "round";
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
      spr(c, WHITE, hx, hy, 10 * scale + 4, a);
    }
    c.restore();

    // stars and the moon's breath
    const dim = 1 - S.rain * 0.85;
    for (const s of S.stars) {
      const tw = still ? 0.5 + 0.5 * Math.sin(time * s.sp + s.ph) : 0.7;
      spr(c, WHITE, px(s.x), py(s.y), (3 + s.s * 4) * scale + 2, (0.25 + 0.75 * tw * tw) * 0.85 * dim);
    }
    spr(c, WARM, px(MOON[0]), py(MOON[1]), (110 + 8 * Math.sin(time * 0.5)) * scale, 0.22 * dim);

    // far away: village lights, glints on the lake, the waterfall
    VILLAGE.forEach(([x, y], i) => spr(c, WARM, px(x), py(y), 9 * scale, 0.35 + 0.35 * (still ? Math.max(0, Math.sin(time * (1.3 + (i % 3) * 0.4) + i)) : 0.5)));
    for (let i = 0; i < 14; i++) {
      const x = LAKE.x0 + ((i * 37) % 100) / 100 * (LAKE.x1 - LAKE.x0), y = LAKE.y0 + ((i * 53) % 100) / 100 * (LAKE.y1 - LAKE.y0);
      const a = still ? Math.max(0, Math.sin(time * 1.4 + i * 1.7)) : 0.4;
      c.globalAlpha = a * 0.5; c.fillStyle = i % 3 ? "#ffd9c0" : "#ffffff";
      c.fillRect(px(x), py(y), (6 + (i % 4) * 3) * scale, 1.2 * scale + 0.3);
    }
    c.globalAlpha = 0.5; c.fillStyle = "#eef4ff";
    for (let i = 0; i < 6; i++) {
      const y = py(FALL.y0) + (((time * 26 * scale + i * 17 * scale) % (py(FALL.y1) - py(FALL.y0))));
      c.fillRect(px(FALL.x) + (i % 3 - 1) * 2 * scale, y, 1.4 * scale + 0.2, 5 * scale);
    }
    spr(c, WHITE, px(FALL.x), py(FALL.y1), 22 * scale, 0.25 + 0.08 * Math.sin(time * 2));

    // the cottage and the lanterns, breathing warm light
    WINDOWS.forEach(([x, y], i) => spr(c, WARM, px(x), py(y), 34 * scale, 0.32 + (still ? 0.1 * Math.sin(time * 2.3 + i * 1.9) * Math.sin(time * 0.7 + i) : 0)));
    LANTERNS.forEach(([x, y], i) => {
      const fl = still ? 0.12 * Math.sin(time * 3.1 + i * 2.1) + 0.06 * Math.sin(time * 7.3 + i) : 0;
      spr(c, WARM, px(x), py(y), (y > 80 ? 120 : 76) * scale, 0.42 + fl);
      if (season === "summer" && still && i < 4) for (let k = 0; k < 2; k++) {
        const a = time * (2.2 + k) + i * 3 + k * 2;
        c.globalAlpha = 0.8; c.fillStyle = "#fff4d6";
        c.fillRect(px(x) + Math.cos(a) * 12 * scale, py(y) - 6 * scale + Math.sin(a * 1.3) * 8 * scale, 1.6 * scale + 0.3, 1.6 * scale + 0.3);
      }
    });

    // pond: reflections, koi under the surface, ripples, a jumping koi
    if (season !== "winter") {
      POND_GLINTS.forEach(([x, y], i) => {
        const a = still ? 0.35 + 0.35 * Math.sin(time * 1.8 + i * 2) : 0.5;
        c.globalAlpha = a * 0.7; c.fillStyle = "#ffe6b8";
        const wob = still ? Math.sin(time * 2.6 + i) * 3 * scale : 0;
        c.fillRect(px(x) - 10 * scale + wob, py(y), 20 * scale, 1.3 * scale + 0.3);
        c.fillRect(px(x) - 6 * scale - wob, py(y) + 3 * scale, 12 * scale, 1 * scale + 0.3);
      });
    }
    c.globalCompositeOperation = "source-over";
    if (season !== "winter") {
      c.save();
      c.beginPath(); c.ellipse(px(POND.cx), py(POND.cy), px(POND.rx), py(POND.ry), 0, 0, Math.PI * 2); c.clip();
      for (const k of S.koi) {
        const a = time * k.sp * (still || 0.0001) + k.ph;
        const x = px(POND.cx + Math.cos(a) * POND.rx * 0.6), y = py(POND.cy + Math.sin(a * 1.7) * POND.ry * 0.5);
        const ang = Math.atan2(Math.cos(a * 1.7) * 1.7 * py(POND.ry) * 0.5, -Math.sin(a) * px(POND.rx) * 0.6);
        c.save(); c.translate(x, y); c.rotate(ang); c.globalAlpha = 0.32;
        c.fillStyle = `rgb(${k.col})`;
        c.beginPath(); c.ellipse(0, 0, 9 * scale, 3.4 * scale, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(-8 * scale, 0); c.lineTo(-14 * scale, -3.5 * scale + Math.sin(time * 6 + k.ph) * 1.5 * scale); c.lineTo(-14 * scale, 3.5 * scale + Math.sin(time * 6 + k.ph) * 1.5 * scale); c.fill();
        c.restore();
      }
      c.restore();
      c.lineWidth = 1;
      for (const q of S.ripples) {
        const k = q.life / q.dur, r = q.max * (0.15 + 0.85 * Math.sqrt(k));
        c.globalAlpha = (1 - k) * 0.7; c.strokeStyle = "#e8e4ff";
        c.beginPath(); c.ellipse(px(q.x), py(q.y), r, r * 0.34, 0, 0, Math.PI * 2); c.stroke();
        if (k < 0.6) { c.globalAlpha = (0.6 - k) * 0.6; c.beginPath(); c.ellipse(px(q.x), py(q.y), r * 0.55, r * 0.19, 0, 0, Math.PI * 2); c.stroke(); }
      }
      if (S.fish && S.fish.t < 1) {
        const f = S.fish, t = f.t, x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t - Math.sin(Math.PI * t) * f.h;
        const dx = px(f.x1 - f.x0), dy = py(f.y1 - f.y0) - Math.cos(Math.PI * t) * Math.PI * py(f.h);
        c.save(); c.translate(px(x), py(y)); c.rotate(Math.atan2(dy, dx)); c.globalAlpha = 1;
        c.fillStyle = `rgb(${f.col})`;
        c.beginPath(); c.ellipse(0, 0, 10 * scale, 4 * scale, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.ellipse(2 * scale, -1 * scale, 4 * scale, 1.6 * scale, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = `rgb(${f.col})`;
        c.beginPath(); c.moveTo(-9 * scale, 0); c.lineTo(-16 * scale, -5 * scale); c.lineTo(-15 * scale, 5 * scale); c.fill();
        c.fillStyle = "#1d1a1a"; c.beginPath(); c.arc(7 * scale, -1 * scale, 0.9 * scale + 0.3, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      c.fillStyle = "#f2f0ff";
      for (const q of S.splash) { c.globalAlpha = clamp(q.life * 1.6, 0, 1); c.beginPath(); c.arc(q.x, q.y, 1.4 * scale + 0.3, 0, Math.PI * 2); c.fill(); }
    } else {
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 16; i++) {           // glints on the ice
        const x = POND.cx + Math.cos(i * 2.39) * POND.rx * 0.75 * ((i % 5) / 5 + 0.2), y = POND.cy + Math.sin(i * 2.39) * POND.ry * 0.7 * ((i % 4) / 4 + 0.2);
        const a = still ? Math.pow(Math.max(0, Math.sin(time * 1.1 + i * 1.3)), 6) : 0.2;
        spr(c, WHITE, px(x), py(y), 9 * scale, a);
        if (a > 0.5) { c.globalAlpha = a * 0.7; c.fillStyle = "#fff"; c.fillRect(px(x) - 5 * scale, py(y) - 0.4, 10 * scale, 0.8); c.fillRect(px(x) - 0.4, py(y) - 5 * scale, 0.8, 10 * scale); }
      }
      c.globalCompositeOperation = "source-over";
      // paw prints
      for (const p of S.prints) {
        // a paw pressed into the snow: blue shadow inside, a bright lip of snow just below
        const fade = clamp(p.life / 5, 0, 1);
        const x = px(p.x), y = py(p.y), s = 3.4 * scale * p.s + 0.8;
        const pad = (fill, dy) => {
          c.fillStyle = fill;
          c.beginPath(); c.ellipse(x, y + dy, s, s * 0.62, 0, 0, Math.PI * 2); c.fill();
          for (let k = -1; k <= 1; k++) { c.beginPath(); c.ellipse(x + k * s * 0.78 + p.dir * s * 0.45, y + dy - s * 0.95, s * 0.34, s * 0.26, 0, 0, Math.PI * 2); c.fill(); }
        };
        c.globalAlpha = fade * 0.55; pad("#ffffff", s * 0.18);
        c.globalAlpha = fade * 0.75; pad("rgb(104,118,164)", 0);
      }
    }

    // chimney smoke
    for (const s of S.smoke) {
      const k = s.life / s.dur;
      spr(c, SMOKE, s.x, s.y, s.r * 2.4, Math.sin(Math.PI * Math.min(1, k * 1.4)) * 0.26 * (1 - k));
    }

    // geese crossing the sky
    if (S.birds) {
      const b = S.birds, g = (time - b.t0) / b.dur;
      const lead = b.dir > 0 ? -8 + 116 * g : 108 - 116 * g;
      c.strokeStyle = "rgba(28,26,44,.75)"; c.lineWidth = 1.3 * scale + 0.3; c.lineCap = "round"; c.globalAlpha = 1;
      for (let i = 0; i < b.n; i++) {
        const row = Math.ceil(i / 2), side = i === 0 ? 0 : i % 2 ? -1 : 1;
        const x = px(lead - b.dir * row * 1.8), y = py(b.y + side * row * 1.1 + Math.sin(time * 0.8 + i) * 0.2);
        const flap = Math.sin(time * 7 + i * 0.9 + b.ph) * 3 * scale, w = 6 * scale;
        c.beginPath(); c.moveTo(x - w, y - flap); c.quadraticCurveTo(x - w * 0.4, y - 2 * scale, x, y); c.quadraticCurveTo(x + w * 0.4, y - 2 * scale, x + w, y - flap); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }
  function drawAurora(c, time, amt) {
    const scale = W / 1400, step = Math.max(4, 5 * scale);
    c.globalCompositeOperation = "lighter";
    [[0, "90,255,170", "120,170,255", 19], [2.1, "120,255,200", "190,120,255", 14], [4.2, "80,230,160", "100,200,255", 10]].forEach(([ph, c1, c2, hgt], k) => {
      const h = py(hgt);
      const g = c.createLinearGradient(0, 0, 0, -h);
      g.addColorStop(0, `rgba(${c1},0)`); g.addColorStop(0.12, `rgba(${c1},.55)`); g.addColorStop(0.55, `rgba(${c2},.18)`); g.addColorStop(1, `rgba(${c2},0)`);
      c.fillStyle = g;
      for (let x = px(4); x < px(96); x += step) {
        const u = x / W;
        const base = py(15 + 3.5 * Math.sin(u * 7 + time * 0.09 + ph) + 1.5 * Math.sin(u * 19 - time * 0.21 + ph));
        const a = amt * (0.25 + 0.35 * Math.max(0, Math.sin(u * 23 + time * 0.55 + ph)) + 0.2 * Math.sin(u * 4 - time * 0.3 + k)) * 0.8;
        if (a <= 0.01) continue;
        c.globalAlpha = a;
        c.setTransform(dpr, 0, 0, dpr, x * dpr, base * dpr);
        c.fillRect(0, -h, step + 1, h);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    c.globalAlpha = 1;
  }
  function drawRainbow(c, amt) {
    const cx = px(58), cy = py(78), r0 = px(44), band = px(3.4);
    const cols = ["255,90,90", "255,160,80", "255,230,110", "120,220,120", "100,170,255", "130,120,240", "190,110,230"];
    c.globalCompositeOperation = "lighter";
    cols.forEach((col, i) => {
      c.strokeStyle = `rgba(${col},${0.12 * amt})`; c.lineWidth = band / cols.length + 1;
      c.beginPath(); c.arc(cx, cy, r0 - i * (band / cols.length), Math.PI * 1.02, Math.PI * 1.98); c.stroke();
    });
  }

  /* ---------- draw: in front of the animals ---------- */
  function drawFront(time, season, calm) {
    const c = fctx, scale = W / 1400;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // rain
    if (S.rain > 0.01) {
      c.globalAlpha = 0.16 * S.rain; c.fillStyle = "#1a2442"; c.fillRect(0, 0, W, H);
      c.globalAlpha = 0.38 * S.rain; c.strokeStyle = "#cdd9ff"; c.lineWidth = 1;
      c.beginPath();
      for (const d of S.drops) { c.moveTo(d.x, d.y); c.lineTo(d.x - d.len * (0.18 - api.wind * 0.6), d.y - d.len); }
      c.stroke();
    }
    // gust: streaks across the meadow and a soft sheen over the grass
    if (S.gust) {
      const g = (time - S.gust.t0) / S.gust.dur, env = Math.sin(Math.PI * g), dir = S.gust.dir;
      const front = dir > 0 ? -20 + 140 * g : 120 - 140 * g;
      c.globalCompositeOperation = "lighter";
      const gx = px(front), sheen = c.createRadialGradient(gx, py(78), 0, gx, py(78), px(16));
      sheen.addColorStop(0, `rgba(255,248,220,${0.13 * env})`); sheen.addColorStop(1, "rgba(255,248,220,0)");
      c.save(); c.translate(gx, py(78)); c.scale(1, 0.45); c.translate(-gx, -py(78)); c.fillStyle = sheen; c.fillRect(gx - px(16), py(78) - px(16), px(32), px(32)); c.restore();
      c.globalCompositeOperation = "source-over";
      c.strokeStyle = "#ffffff"; c.lineCap = "round";
      for (const l of S.gustLines) {
        const x0 = px(front + l.off), len = px(l.len) * dir, y = py(l.y);
        // a swoosh that fades in from its tail and out at its head
        const sg = c.createLinearGradient(x0 - len, y, x0, y);
        sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.55, "rgba(255,255,255,.9)"); sg.addColorStop(1, "rgba(255,255,255,.15)");
        c.strokeStyle = sg; c.globalAlpha = 0.55 * env; c.lineWidth = l.w * scale + 0.4;
        const wv = l.wave * scale;
        c.beginPath(); c.moveTo(x0 - len, y + wv * 0.3);
        c.bezierCurveTo(x0 - len * 0.65, y - wv, x0 - len * 0.3, y + wv, x0, y - wv * 0.2);
        if (l.curl) { const r = 5 * scale; c.arc(x0 + dir * r * 0.2, y - 2 * scale - r, r, Math.PI / 2, dir > 0 ? -Math.PI : Math.PI * 2, dir < 0); }
        c.stroke();
      }
    }
    for (const d of S.debris) {
      c.globalAlpha = clamp(d.life, 0, 1) * 0.9; c.fillStyle = d.col;
      if (d.snow) { c.beginPath(); c.arc(d.x, d.y, d.s, 0, Math.PI * 2); c.fill(); continue; }
      c.save(); c.translate(d.x, d.y); c.rotate(d.rot); c.scale(1, 0.35 + Math.abs(Math.cos(time * 4 + d.ph)) * 0.65);
      c.beginPath(); c.ellipse(0, 0, d.s, d.s * 0.6, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    // sparkles, hearts, +1
    for (const b of S.bursts) {
      const a = clamp(b.life / 0.6, 0, 1);
      if (b.kind === "heart") {
        c.globalAlpha = a; c.fillStyle = "#f46a8c";
        const s = b.s * scale + 2;
        c.beginPath(); c.moveTo(b.x, b.y + s * 0.8);
        c.bezierCurveTo(b.x - s * 1.4, b.y - s * 0.2, b.x - s * 0.5, b.y - s * 1.2, b.x, b.y - s * 0.35);
        c.bezierCurveTo(b.x + s * 0.5, b.y - s * 1.2, b.x + s * 1.4, b.y - s * 0.2, b.x, b.y + s * 0.8); c.fill();
      } else if (b.kind === "snow" || b.kind === "ice") {
        c.globalAlpha = a; c.fillStyle = "#ffffff"; c.beginPath(); c.arc(b.x, b.y, (b.s * 0.5) * scale + 1, 0, Math.PI * 2); c.fill();
      } else {
        c.globalCompositeOperation = "lighter";
        spr(c, b.kind === "fruit" ? GOLD : PINK, b.x, b.y, (b.s * 3) * scale + 6, a);
        c.globalAlpha = a; c.fillStyle = "#fff8e0";
        const s = b.s * scale + 1; c.save(); c.translate(b.x, b.y); c.rotate(b.rot);
        c.fillRect(-s, -0.5, s * 2, 1); c.fillRect(-0.5, -s, 1, s * 2); c.restore();
        c.globalCompositeOperation = "source-over";
      }
    }
    for (const t of S.texts) {
      c.globalAlpha = clamp(t.life / 0.5, 0, 1);
      c.font = `600 ${Math.round(16 * scale + 8)}px "Montserrat", "Segoe UI", sans-serif`;
      c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "rgba(40,30,10,.55)"; c.strokeText(t.text, t.x, t.y);
      c.fillStyle = "#ffe08a"; c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
  }

  window.FarmFX = Object.assign(api, { init, update, burst, touch, ripple, get raining() { return S.rain > 0.3; } });
})();
