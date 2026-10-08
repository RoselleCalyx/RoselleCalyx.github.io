/* =====================================================================
   My Little Farm
   - one season clock for everyone: each season lasts 8 minutes of real
     time (a year is 32 minutes), so all visitors share the same weather
   - each fruit ripens in its own season, as in a real orchard:
     cherries & peaches in summer, apples in autumn, oranges in winter
   - residents come from data/farm.js (plus approved adoptions in the
     optional shared database, plus this visitor's pending requests)
   - the orchard itself lives in this visitor's browser
   Preview a season with farm.html?season=winter
   ===================================================================== */
(function () {
  const { esc, ICON, store, toast, modal } = window.Site;
  const { ART, SPECIES, TREES, PHENO, FRUIT, WALK, walkSrc, walkSprite, treeSVG, treeInline, fruitIcon, defs } = window.FarmArt;
  const FARM = window.FARM || { residents: [] };
  const params = new URLSearchParams(location.search);
  const keeperMode = params.has("keeper");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia("(pointer: coarse)").matches;
  const world = document.getElementById("world");
  const actorsEl = document.getElementById("actors");
  const viewport = document.getElementById("farmViewport");

  /* ================= the season clock ================= */
  const SEASONS = ["spring", "summer", "autumn", "winter"];
  const SEASON_MS = 8 * 60 * 1000;
  const ICONS = { spring: "✿", summer: "☀", autumn: "❦", winter: "❄" };
  const forced = SEASONS.includes(params.get("season")) ? params.get("season") : null;
  function clock() {
    const now = Date.now(), abs = Math.floor(now / SEASON_MS);
    return { abs, name: forced || SEASONS[abs % 4], left: SEASON_MS - (now % SEASON_MS) };
  }
  let season = clock();
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  /* ================= the painted world (1600 × 900) ================= */

  function background() {
    return '<div class="farm-landscapes" aria-hidden="true">' +
      '<img class="farm-bg farm-landscape" data-s="spring summer" src="assets/farm/meadow-spring.webp" alt="" width="1920" height="1080" draggable="false" fetchpriority="high">' +
      '<img class="farm-bg farm-landscape" data-s="autumn" src="assets/farm/meadow-autumn.webp" alt="" width="1920" height="1080" draggable="false">' +
      '<img class="farm-bg farm-landscape" data-s="winter" src="assets/farm/meadow-winter.webp" alt="" width="1920" height="1080" draggable="false">' +
      '<div class="pond-shimmer"><i></i><i></i></div>' +
      '<span class="scene-lantern lantern-cottage"></span><span class="scene-lantern lantern-pond"></span></div>';
  }

  /* ================= weather ================= */
  const weather = { cv: null, ctx: null, w: 0, h: 0, dpr: 1, parts: [], kind: "" };
  function setupWeather() {
    const cv = document.createElement("canvas");
    cv.className = "weather";
    world.appendChild(cv);
    weather.cv = cv; weather.ctx = cv.getContext("2d");
    const fit = () => {
      weather.dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
      weather.w = world.offsetWidth; weather.h = world.offsetHeight;
      cv.width = Math.round(weather.w * weather.dpr); cv.height = Math.round(weather.h * weather.dpr);
    };
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(world);
  }
  const FLAKE = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d"), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.45, "rgba(255,255,255,.75)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 32, 32); return c;
  })();
  function makePart(kind, anywhere) {
    const W = weather.w, H = weather.h, R = Math.random;
    const y = anywhere ? R() * H : -20 - R() * 60;
    if (kind === "snow") {
      const z = R();                                  // depth: big, fast flakes in front
      return { x: R() * W, y, z, r: 0.8 + z * z * 4.2, vy: 28 + z * 70, ph: R() * 6.3, sw: 8 + R() * 22 };
    }
    if (kind === "petal") return { x: R() * W * 1.1 - W * 0.1, y, r: 3.2 + R() * 3, vy: 16 + R() * 24, vx: 14 + R() * 30, rot: R() * 6.3, vr: (R() - 0.5) * 3, ph: R() * 6.3, col: ["#fbd3df", "#f7b6c9", "#ffe6ee", "#f49ab4"][(R() * 4) | 0] };
    if (kind === "leaf") return { x: R() * W, y, r: 5 + R() * 4, vy: 26 + R() * 34, vx: (R() - 0.3) * 20, rot: R() * 6.3, vr: (R() - 0.5) * 4, ph: R() * 6.3, col: ["#d98a2a", "#b5482a", "#e6b23a", "#a0522d", "#c96a28"][(R() * 5) | 0] };
    return { x: R() * W, y: anywhere ? H * (0.4 + R() * 0.6) : H + 10, r: 2 + R() * 2, vy: -(6 + R() * 12), vx: 6 + R() * 14, ph: R() * 6.3 };   // dandelion seeds
  }
  function setWeather(name) {
    const kind = { winter: "snow", spring: "petal", autumn: "leaf", summer: "seed" }[name];
    const calm = reduce || (window.Sky && Sky.calm);
    const base = { snow: 95, petal: 24, leaf: 22, seed: 12 }[kind];
    const n = Math.round(base * (lowPower ? 0.5 : 1) * (calm ? 0.3 : 1));
    weather.kind = kind;
    weather.parts = Array.from({ length: n }, () => makePart(kind, true));
  }
  function drawWeather(dt, t) {
    const { ctx, cv, dpr, parts, kind } = weather;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const W = weather.w, H = weather.h, wind = Math.sin(t * 0.15) * 14;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (kind === "snow") {
        p.y += p.vy * dt; p.x += (wind * (0.4 + p.z) + Math.sin(t * 0.8 + p.ph) * p.sw * 0.4) * dt;
        const s = p.r * 3.2;
        ctx.globalAlpha = 0.45 + p.z * 0.55;
        ctx.drawImage(FLAKE, p.x - s / 2, p.y - s / 2, s, s);
      } else if (kind === "petal" || kind === "leaf") {
        p.y += p.vy * dt; p.x += (p.vx + wind + Math.sin(t * 1.3 + p.ph) * 22) * dt; p.rot += p.vr * dt;
        const flip = Math.cos(t * 2.4 + p.ph);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.35 + Math.abs(flip) * 0.65);
        ctx.globalAlpha = 0.92; ctx.fillStyle = p.col;
        ctx.beginPath();
        if (kind === "petal") { ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, 6.283); }
        else { ctx.moveTo(-p.r, 0); ctx.quadraticCurveTo(0, -p.r * 0.75, p.r, 0); ctx.quadraticCurveTo(0, p.r * 0.75, -p.r, 0); }
        ctx.fill();
        if (kind === "leaf") { ctx.strokeStyle = "rgba(80,40,10,.5)"; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(p.r, 0); ctx.stroke(); }
        ctx.restore();
      } else {
        p.y += p.vy * dt; p.x += (p.vx + Math.sin(t + p.ph) * 8) * dt;
        ctx.globalAlpha = 0.75; ctx.strokeStyle = "#f4f1e6"; ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283 + p.ph; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * p.r * 1.6, p.y + Math.sin(a) * p.r * 1.6); }
        ctx.stroke();
      }
      if (p.y > H + 20 || p.y < -80 || p.x > W + 40 || p.x < -60) parts[i] = makePart(kind, false);
    }
    ctx.globalAlpha = 1;
  }

  /* ================= geometry (percent of the world) ================= */
  const GROUND = { x0: 5, x1: 93, y0: 65, y1: 94 };
  const POND = { cx: 64, cy: 78.5, rx: 26, ry: 12 };
  const ROCK = { x: 18, y: 78 };
  const SLOTS = [{ x: 8, y: 67 }, { x: 47, y: 65 }, { x: 81, y: 64 }, { x: 93, y: 91 }, { x: 31, y: 94 }];
  const HOMES = { rabbit: {x: 37,y: 72.5}, panda: {x: 47,y: 92}, fox: {x: 56,y: 65.5}, shiba: {x: 30,y: 92}, duckling: {x: 76,y: 94} };
  const inPond = (x, y) => ((x - POND.cx) / POND.rx) ** 2 + ((y - POND.cy) / POND.ry) ** 2 < 1;
  const depth = (y) => 0.72 + ((y - 66) / 30) * 0.5;
  const crowded = (x,y,self) => animals.some(a => a !== self && Math.hypot((x-a.x)/8, (y-a.y)/11) < 1);
  const behindFrontTree = (x,y) => trees && trees.some(t => SLOTS[t.slot].y > 82 && Math.abs(x-SLOTS[t.slot].x) < 8 && y < SLOTS[t.slot].y && y > SLOTS[t.slot].y-23);
  function randomSpot(nearX, self) {
    for (let i = 0; i < 70; i++) {
      const x = Math.max(GROUND.x0, Math.min(GROUND.x1, nearX == null ? GROUND.x0 + Math.random() * (GROUND.x1 - GROUND.x0) : nearX + (Math.random() - 0.5) * 34));
      const y = GROUND.y0 + Math.random() * (GROUND.y1 - GROUND.y0);
      if (!inPond(x, y) && !crowded(x,y,self) && !behindFrontTree(x,y) && !(Math.abs(x - ROCK.x) < 9 && y > 66 && y < 89)) return { x, y };
    }
    return self ? {x: self.x, y: self.y} : { x: 35, y: 94 };
  }

  /* ---------- walk cycles: show them only once decoded, so a first step never flashes blank ---------- */
  const walkReady = new Set();
  function preloadWalks() {
    const run = () => Object.keys(WALK).forEach((sp) => {
      const img = new Image();
      img.decoding = "async";
      img.src = walkSrc(sp);
      new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; if (img.complete && img.naturalWidth) ok(); })
        .then(() => {
          if (img.decode) img.decode().catch(() => {});   // warm the decoder; never wait on it (it can stall in background tabs)
          walkReady.add(sp);
          document.querySelectorAll(`.actor[data-species="${sp}"]`).forEach((el) => el.classList.add("walk-ready"));
        })
        .catch(() => {});                          // keep the sitting sprite if a sheet fails to load
    });
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 300));
    document.readyState === "complete" ? idle() : addEventListener("load", idle, { once: true });
  }

  /* ================= animals ================= */
  const animals = [];
  function addAnimal(def, opts = {}) {
    const sp = SPECIES[def.species];
    if (!sp) return null;
    const home = HOMES[def.species];
    const first = !animals.some(a => a.def.species === def.species);
    const pos = opts.keeper ? { x: ROCK.x, y: ROCK.y } : home && first ? {...home} : randomSpot();
    const el = document.createElement("div");
    el.className = "actor" + (opts.pending ? " pending" : "") + (opts.keeper ? " keeper sitting" : "");
    el.dataset.species = def.species;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `${def.name}, ${sp.label}`);
    const art = `<div class="flip"><div class="bob">${ART[def.species]()}${walkSprite(def.species)}</div></div>`;
    el.innerHTML = (opts.keeper ? `<div class="art walk">${art}</div><div class="art sit"><div class="flip">${ART.snowcatSit()}</div></div>` : art)
      + `<span class="resident-label">${esc(def.name)}</span>`
      + (opts.pending ? `<span class="tag">waiting for approval</span>` : "");
    actorsEl.appendChild(el);
    const a = { def, sp, el, x: pos.x, y: pos.y, tx: pos.x, ty: pos.y, state: "idle", until: performance.now() + 1500 + Math.random() * 3000, dir: 1, keeper: !!opts.keeper, pending: !!opts.pending, held: false };
    el.addEventListener("click", (e) => { e.stopPropagation(); openAnimal(a); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAnimal(a); } });
    if (walkReady.has(def.species)) el.classList.add("walk-ready");
    animals.push(a);
    const count = document.getElementById("residentCount"); if (count) count.textContent = animals.length + " little lives";
    place(a);
    return a;
  }
  function place(a) {
    const s = depth(a.y) * a.sp.size * (a.keeper ? 1.13 : 1);
    a.el.style.left = a.x + "%";
    a.el.style.top = a.y + "%";
    a.el.style.width = 8.1 * s + "%";
    a.el.style.zIndex = Math.round(a.y * 10);
    a.el.classList.toggle("left", a.dir < 0);
    a.el.classList.toggle("walking", a.state === "walk" && a.sp.gait !== "hop");
    a.el.classList.toggle("hopping", a.state === "walk" && a.sp.gait === "hop");
    if (a.keeper) a.el.classList.toggle("sitting", a.state !== "walk");
  }
  function emote(a, ch) {
    const s = document.createElement("span");
    s.className = "emote"; s.textContent = ch;
    a.el.appendChild(s);
    setTimeout(() => s.remove(), 2500);
  }
  function think(a, now) {
    if (a.keeper) {
      // the keeper mostly sits on her rock, and sometimes patrols the orchard
      const home = Math.hypot(a.x - ROCK.x, a.y - ROCK.y) < 1;
      if (home && Math.random() < 0.8) { a.state = "idle"; a.until = now + 7000 + Math.random() * 9000; a.dir = 1; if (Math.random() < 0.5) emote(a, "z z"); return; }
      const t = home ? randomSpot(28, a) : { x: ROCK.x, y: ROCK.y };
      a.tx = t.x; a.ty = t.y; a.state = "walk"; return;
    }
    if (Math.random() < 0.35) {
      a.state = "idle"; a.until = now + 2000 + Math.random() * 5000;
      if (Math.random() < 0.3) emote(a, ["♪", "♥", "✿", "…"][(Math.random() * 4) | 0]);
      return;
    }
    const t = randomSpot(a.x, a);
    a.tx = t.x; a.ty = t.y; a.state = "walk";
  }
  function stepAnimal(a, dt, now) {
    if (a.held) return;
    if (a.state === "idle") { if (now > a.until) { think(a, now); place(a); } return; }
    const dx = a.tx - a.x, dy = (a.ty - a.y) * 1.78, d = Math.hypot(dx, dy);
    const v = a.sp.speed * dt * depth(a.y);
    if (d <= v) { a.x = a.tx; a.y = a.ty; a.state = "idle"; a.until = now + 1500 + Math.random() * 4000; }
    else {
      let nx = a.x + (dx / d) * v, ny = a.y + (dy / d / 1.78) * v;
      if (inPond(nx, ny)) { ny += (ny < POND.cy ? -1 : 1) * v; nx = a.x + (dx / d) * v * 0.5; }
      if (crowded(nx,ny,a) || behindFrontTree(nx,ny)) { a.state = "idle"; a.until = now + 1500 + Math.random()*2000; place(a); return; }
      a.x = nx; a.y = ny;
      if (Math.abs(dx) > 0.2) a.dir = dx > 0 ? 1 : -1;
    }
    place(a);
  }

  /* ---------- the speech bubble ---------- */
  let bubble = null;
  function closeBubble() {
    if (!bubble) return;
    if (bubble.a) bubble.a.held = false;
    bubble.el.remove(); bubble = null;
  }
  function showBubble(html, anchorEl, a) {
    closeBubble();
    const el = document.createElement("div");
    el.className = "bubble";
    el.innerHTML = `<button class="x" type="button" aria-label="Close">×</button>${html}`;
    world.appendChild(el);
    bubble = { el, anchor: anchorEl, a };
    if (a) { a.held = true; if (a.state === "walk") a.state = "idle"; place(a); }
    el.querySelector(".x").onclick = closeBubble;
    el.addEventListener("click", (e) => e.stopPropagation());
    positionBubble();
    return el;
  }
  function positionBubble() {
    if (!bubble) return;
    const w = world.getBoundingClientRect(), r = bubble.anchor.getBoundingClientRect();
    const vr = viewport.getBoundingClientRect();
    const half = Math.min(125, viewport.clientWidth / 2 - 12);
    bubble.el.style.width = Math.min(250, viewport.clientWidth - 24) + "px";
    const min = vr.left - w.left + half + 12, max = vr.right - w.left - half - 12;
    const left = Math.max(min, Math.min(max, r.left + r.width / 2 - w.left));
    bubble.el.style.left = left + "px";
    bubble.el.style.top = Math.max(250, r.top - w.top + 6) + "px";
  }
  world.addEventListener("click", closeBubble);
  function openAnimal(a) {
    const d = a.def, hearts = store.get("farm-hearts", {}), key = d.species + ":" + d.name;
    const el = showBubble(`
      <span class="sp">${esc(a.sp.label)} · ${esc(a.sp.zh)}</span>
      <h4>${esc(d.name)}</h4>
      ${a.keeper ? `<p class="by">${esc(d.title || "Keeper of the Farm")}</p>` : d.adoptedBy ? `<p class="by">Adopted by ${esc(d.adoptedBy)}${d.since ? " · since " + esc(d.since) : ""}</p>` : ""}
      ${d.note ? `<p>${esc(d.note)}</p>` : ""}
      ${a.pending ? `<p class="by">Your request is on its way to the keeper. Until then, ${esc(d.name)} is visiting just for you.</p>` : ""}
      <div class="bubble-actions"><button class="btn sm" type="button" data-heart>${ICON.heart} <span>${hearts[key] || 0}</span></button><button class="btn sm" type="button" data-pet>Pet</button></div>`, a.el, a);
    el.querySelector("[data-heart]").onclick = (e) => {
      hearts[key] = (hearts[key] || 0) + 1; store.set("farm-hearts", hearts);
      e.currentTarget.querySelector("span").textContent = hearts[key];
      emote(a, "♥");
    };
    el.querySelector("[data-pet]").onclick = () => emote(a, a.keeper ? "purr…" : ["♪", "♥", "✿"][(Math.random() * 3) | 0]);
  }

  /* ================= orchard ================= */
  const LOOKS = { bare: "resting through winter", bloom: "in blossom", green: "in full leaf", autumn: "turning gold" };
  let trees = store.get("farm-trees", null);
  if (!trees) {
    trees = [
      { type: "cherry", slot: 1, seed: 11 }, { type: "apple", slot: 2, seed: 23 },
      { type: "peach", slot: 0, seed: 37 }, { type: "orange", slot: 3, seed: 41 }
    ];
  }
  trees.forEach((t, i) => {
    t.id = t.id || "t" + i + Date.now();
    if (t.plantedAbs == null) { t.plantedAbs = season.abs - 1; t.water = 3; }   // older saves: already grown
    if (!t.picked || Array.isArray(t.picked)) t.picked = { abs: -1, list: [] };
    delete t.stage; delete t.since; delete t.cycle; delete t.fruitN;
  });
  const saveTrees = () => store.set("farm-trees", trees.map(({ el, art, url, ...t }) => t));
  const isSapling = (t) => season.abs <= t.plantedAbs && (t.water || 0) < 3;
  const pickedNow = (t) => (t.picked.abs === season.abs ? t.picked.list : []);
  function renderTree(t) {
    const slot = SLOTS[t.slot];
    if (!t.el) {
      t.el = document.createElement("div");
      t.el.className = "tree";
      t.el.setAttribute("role", "button"); t.el.tabIndex = 0;
      t.el.addEventListener("click", (e) => { e.stopPropagation(); onTreeClick(t, e); });
      t.el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTreeClick(t, e); } });
      actorsEl.appendChild(t.el);
    }
    const T = TREES[t.type], s = depth(slot.y);
    const wide = T.crown === "wide" ? 1.10 : T.crown === "dome" ? .94 : 1;
    t.el.style.left = slot.x + "%";
    t.el.style.top = slot.y + "%";
    t.el.style.width = 19.5 * s * wide + "%";
    t.el.style.zIndex = Math.round(slot.y * 10) - 1;
    const out = treeSVG({ type: t.type, seed: t.seed, stage: isSapling(t) ? "sapling" : "mature", season: season.name, picked: pickedNow(t) });
    if (t.art !== out.art) {                       // re-rasterise only when the tree itself changes
      t.art = out.art;
      if (t.url && t.url.startsWith("blob:")) URL.revokeObjectURL(t.url);
      t.url = out.src || URL.createObjectURL(new Blob([out.art], { type: "image/svg+xml" }));
      t.el.innerHTML = `<div class="tree-inner"><img class="tree-img" src="${t.url}" alt="" draggable="false"><div class="fruit-layer"></div></div>`;
    }
    t.el.querySelector(".fruit-layer").innerHTML = out.fruits;
    const ripe = out.ripe;
    t.el.classList.toggle("ripe", ripe > 0);
    t.el.setAttribute("aria-label", `${T.label} tree, ${isSapling(t) ? "a young sapling" : LOOKS[PHENO[t.type][season.name].fol]}${ripe ? `, ${ripe} ripe fruit` : ""}`);
  }
  function onTreeClick(t, e) {
    const f = e.target.closest(".fruit");
    if (f) { pick(t, +f.dataset.i, f); return; }
    const T = TREES[t.type], ph = PHENO[t.type][season.name], sap = isSapling(t);
    const ripeIn = cap(T.ripe);
    const line = sap ? `A young sapling. Water it three times (${t.water || 0}/3), or wait for the next season, and it will grow up.`
      : ph.fruit === "ripe" ? (t.el.querySelector(".fruit") ? "Ripe! Tap a fruit to pick it, or use Harvest." : "You picked everything this season. It will fruit again next year.")
      : `${T.label === "Orange" ? "Oranges" : T.label.replace(" blossom", "") + "s"} ripen in ${ripeIn.toLowerCase()}.`;
    const el = showBubble(`
      <span class="sp">${esc(T.label)} tree · ${esc(T.zh)}</span>
      <h4>${sap ? "A young sapling" : cap(LOOKS[ph.fol])}</h4>
      <p>${line}</p>
      <div class="bubble-actions">
        ${sap ? `<button class="btn sm" type="button" data-water>${ICON.drop} Water</button>` : ""}
        <button class="btn sm" type="button" data-dig>Dig up</button>
      </div>`, t.el, null);
    const w = el.querySelector("[data-water]");
    if (w) w.onclick = () => {
      t.water = (t.water || 0) + 1; water(t); saveTrees(); closeBubble();
      if (!isSapling(t)) { renderTree(t); toast(`The ${T.label.toLowerCase()} tree has grown up!`); } else toast(`Watered (${t.water}/3).`);
    };
    el.querySelector("[data-dig]").onclick = () => {
      t.el.remove(); trees = trees.filter((x) => x !== t); saveTrees(); closeBubble();
      toast("The tree returns to the soil. Its place is free again.");
    };
  }
  function worldPoint(el) {
    const w = world.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - w.left, y: r.top - w.top, w: r.width, h: r.height };
  }
  function particle(cls, x, y, style) {
    const p = document.createElement("div");
    p.className = "particle " + cls;
    p.style.left = x + "px"; p.style.top = y + "px";
    Object.entries(style || {}).forEach(([k, v]) => p.style.setProperty(k, v));
    world.appendChild(p);
    setTimeout(() => p.remove(), 7000);
  }
  function water(t) {
    const b = worldPoint(t.el);
    for (let i = 0; i < 14; i++) setTimeout(() => particle("drop", b.x + b.w * (0.25 + Math.random() * 0.5), b.y + b.h * 0.3), i * 50);
  }

  /* ---------- basket & harvest ---------- */
  let basket = store.get("farm-basket", {});
  const basketEl = document.getElementById("basket");
  let sharedTotal = null;
  function renderBasket() {
    const parts = Object.keys(TREES).filter((k) => basket[k]).map((k) => `<span class="fi">${fruitIcon(k)}${basket[k]}</span>`);
    basketEl.innerHTML = `${ICON.basket}<span>${parts.length ? parts.join("") : "Your basket is empty"}</span>${sharedTotal != null ? `<span class="muted">· all visitors: ${sharedTotal}</span>` : ""}`;
  }
  function addToBasket(type, n) {
    basket[type] = (basket[type] || 0) + n;
    store.set("farm-basket", basket);
    setTimeout(renderBasket, 700);
    if (window.Backend && Backend.enabled) Backend.rpc("add_harvest", { p_fruit: type, p_n: n }).then(loadShared).catch(() => {});
  }
  function flyFruit(type, fromEl, delay = 0) {
    const r = fromEl.getBoundingClientRect(), b = basketEl.getBoundingClientRect();   // measure now, animate later
    const d = document.createElement("div");
    d.className = "fly-fruit";
    d.style.background = FRUIT[type];
    d.style.left = r.left + r.width / 2 - 8 + "px"; d.style.top = r.top + r.height / 2 - 8 + "px";
    document.body.appendChild(d);
    setTimeout(() => requestAnimationFrame(() => {
      d.style.transform = `translate(${b.left + 20 - r.left - r.width / 2}px, ${b.top + 8 - r.top - r.height / 2}px) scale(.6)`;
      d.style.opacity = "0.2";
    }), delay);
    setTimeout(() => d.remove(), 950 + delay);
  }
  function markPicked(t, ids) {
    if (t.picked.abs !== season.abs) t.picked = { abs: season.abs, list: [] };
    t.picked.list = [...new Set([...t.picked.list, ...ids])];
  }
  function pick(t, i, el) {
    flyFruit(t.type, el);
    markPicked(t, [i]);
    addToBasket(t.type, 1);
    renderTree(t); saveTrees();
    if (!t.el.querySelector(".fruit")) toast(`The last ${TREES[t.type].label.toLowerCase().replace(" blossom", "")} is in your basket.`);
  }
  function harvestAll() {
    let got = 0;
    trees.forEach((t) => {
      const fr = [...t.el.querySelectorAll(".fruit")];
      if (!fr.length) return;
      fr.forEach((f, k) => flyFruit(t.type, f, k * 60));
      markPicked(t, fr.map((f) => +f.dataset.i));
      addToBasket(t.type, fr.length);
      got += fr.length;
      renderTree(t);
    });
    saveTrees();
    if (got) { toast(`Harvest in — ${got} fruit in your basket.`); return; }
    const want = Object.entries(TREES).filter(([, T]) => T.ripe === season.name).map(([, T]) => T.label.replace(" blossom", "").toLowerCase());
    toast(season.name === "spring" ? "Spring is for blossoms — cherries and peaches ripen in summer."
      : want.length && trees.some((t) => TREES[t.type].ripe === season.name) ? "Everything ripe has been picked this season."
      : `Nothing ripens in ${season.name} here yet — plant ${want.length ? "a" + (/^[aeiou]/.test(want[0]) ? "n " : " ") + want[0] + " tree" : "a tree"} for ${season.name} fruit.`, 3600);
  }
  function loadShared() {
    if (!(window.Backend && Backend.enabled)) return;
    Backend.select("farm_stats", "select=fruit,total").then((rows) => {
      sharedTotal = rows.reduce((a, r) => a + (r.total || 0), 0); renderBasket();
    }).catch(() => {});
  }

  /* ---------- the season chip ---------- */
  const chip = document.getElementById("seasonChip");
  function renderChip() {
    const next = SEASONS[(SEASONS.indexOf(season.name) + 1) % 4];
    const left = Math.max(0, Math.ceil(clock().left / 1000));
    chip.innerHTML = `<span class="si">${ICONS[season.name]}</span><b>${cap(season.name)}</b>${forced ? "" : `<span class="muted"> · ${next} in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}</span>`}`;
  }
  function applySeason(announce) {
    world.dataset.season = season.name;
    document.body.dataset.farmSeason = season.name;
    setWeather(season.name);
    trees.forEach(renderTree);
    renderChip();
    if (announce) {
      const words = { spring: "Spring has come — the orchard is in blossom.", summer: "Summer — cherries and peaches are ripe.", autumn: "Autumn — the apples are ready.", winter: "Winter — snow on the branches, oranges glowing." };
      toast(`${ICONS[season.name]} ${words[season.name]}`, 4200);
    }
  }

  /* ================= modals ================= */
  const speciesGrid = (exclude) => Object.entries(SPECIES).filter(([k]) => k !== exclude)
    .map(([k, s], i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-sp="${k}" class="${i === 0 ? "active" : ""}">${ART[k]()}<span>${esc(s.label)}</span></button>`).join("");

  function adoptModal() {
    modal(`
      <h2>${keeperMode ? "Add an animal" : "Adopt an Animal"}</h2>
      <p class="muted">${keeperMode ? "Keeper mode: this creates a line for data/farm.js." : "Choose a friend for the farm. The keeper reads every request; once approved, it lives here for everyone to see."}</p>
      <form id="adoptForm" novalidate>
        <div class="species-grid" role="radiogroup" aria-label="Species">${speciesGrid(keeperMode ? null : "snowcat")}</div>
        <label class="label" for="aName">Its name</label>
        <input class="input" id="aName" maxlength="24" placeholder="e.g. Comet" required>
        <label class="label" for="aBy">${keeperMode ? "Adopted by" : "Your name"}</label>
        <input class="input" id="aBy" maxlength="40" placeholder="${keeperMode ? "Chen" : "optional"}">
        <label class="label" for="aNote">A few words about it</label>
        <input class="input" id="aNote" maxlength="140" placeholder="What does it love?">
        ${keeperMode ? `<label class="label" for="aOut">Paste into data/farm.js → residents</label><textarea class="snippet" id="aOut" readonly></textarea>` : ""}
        <div class="modal-actions"><button class="btn primary" type="submit">${keeperMode ? "Create line" : "Send request"}</button></div>
        <p class="muted" id="aStatus" role="status"></p>
      </form>`, {
      onOpen(m) {
        const form = m.card.querySelector("form");
        if (window.Backend && !keeperMode) Backend.guard(form);
        let sp = m.card.querySelector(".species-grid button").dataset.sp;
        m.card.querySelector(".species-grid").addEventListener("click", (e) => {
          const b = e.target.closest("button"); if (!b) return;
          sp = b.dataset.sp;
          m.card.querySelectorAll(".species-grid button").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-checked", x === b ? "true" : "false"); });
        });
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const name = form.querySelector("#aName").value.trim(), by = form.querySelector("#aBy").value.trim(), note = form.querySelector("#aNote").value.trim();
          const status = form.querySelector("#aStatus");
          if (!name) { status.textContent = "Every friend needs a name."; return; }
          const def = { species: sp, name, adoptedBy: by || (keeperMode ? "Chen" : "a visitor"), note, since: new Date().toISOString().slice(0, 7) };
          if (keeperMode) {
            form.querySelector("#aOut").value = `    { species: "${sp}", name: ${JSON.stringify(name)}, adoptedBy: ${JSON.stringify(def.adoptedBy)}, note: ${JSON.stringify(note)}, since: "${def.since}" },`;
            form.querySelector("#aOut").select();
            const local = store.get("farm-keeper-local", []); local.push(def); store.set("farm-keeper-local", local);
            addAnimal(def);
            status.textContent = "Added here for you. Paste the line into data/farm.js to make it permanent.";
            return;
          }
          const problem = window.Backend ? Backend.check(form, "adopt", 30) : "";
          if (problem) { status.textContent = problem; return; }
          status.textContent = "Sending…";
          const res = await Site.send("Farm adoption", { name: by, animal: `${name} (${SPECIES[sp].label})`, note },
            { table: "adoptions", row: { species: sp, animal_name: name, adopter: by || null, note: note || null } });
          if (!res.ok) { status.textContent = "The road is muddy — please try again later."; return; }
          if (window.Backend) Backend.stamp("adopt");
          const pend = store.get("farm-pending", []); pend.push(def); store.set("farm-pending", pend);
          addAnimal(def, { pending: true });
          m.close();
          toast(res.via === "mail" ? `Your mail app has your request — send it, and ${name} will wait by the gate.` : `${name} is waiting by the gate for the keeper's approval.`, 4200);
        });
      }
    });
  }

  function plantModal() {
    const free = SLOTS.map((_, i) => i).filter((i) => !trees.some((t) => t.slot === i));
    if (!free.length) { toast("The orchard is full. Dig up a tree to make room."); return; }
    const preview = (k) => treeInline({ type: k, seed: 5, stage: "mature", season: TREES[k].ripe, picked: [] });
    modal(`
      <h2>Plant a Tree</h2>
      <p class="muted">Each tree fruits in its own season: cherries &amp; peaches in summer, apples in autumn, oranges in winter. Saplings grow up after a season — or after three waterings.</p>
      <div class="species-grid tree-grid">${Object.entries(TREES).map(([k, T]) => `<button type="button" data-tree="${k}">${preview(k)}<span>${T.label} · ${T.zh}<br><small>ripe in ${T.ripe}</small></span></button>`).join("")}</div>`, {
      onOpen(m) {
        m.card.querySelector(".tree-grid").addEventListener("click", (e) => {
          const b = e.target.closest("button"); if (!b) return;
          const t = { id: "t" + Date.now(), type: b.dataset.tree, slot: free[0], seed: (Math.random() * 1000) | 0, plantedAbs: season.abs, water: 0, picked: { abs: -1, list: [] } };
          trees.push(t); saveTrees(); renderTree(t); m.close();
          water(t);
          toast(`A little ${TREES[t.type].label.toLowerCase()} tree. Water it to help it grow.`);
        });
      }
    });
  }

  function rosterModal() {
    const list = animals.map((a, i) => `<li><button type="button" data-i="${i}">${ART[a.def.species]()}<span><b>${esc(a.def.name)}</b><small>${esc(a.sp.label)}${a.keeper ? " · keeper" : a.def.adoptedBy ? " · adopted by " + esc(a.def.adoptedBy) : ""}</small></span>${a.pending ? `<span class="st">pending</span>` : ""}</button></li>`).join("");
    modal(`<h2>My Animals</h2><p class="muted">${animals.length} lovely lives on the farm.</p><ul class="roster">${list}</ul>`, {
      onOpen(m) {
        m.card.querySelector(".roster").addEventListener("click", (e) => {
          const b = e.target.closest("button"); if (!b) return;
          const a = animals[+b.dataset.i];
          m.close();
          const r = a.el.getBoundingClientRect();
          viewport.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          viewport.scrollBy({ left: r.left + r.width / 2 - viewport.getBoundingClientRect().left - viewport.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
          setTimeout(() => openAnimal(a), 450);
        });
      }
    });
  }

  /* ================= start ================= */
  document.body.insertAdjacentHTML("afterbegin", defs());
  world.insertAdjacentHTML("afterbegin", background());
  for (let i = 0; i < 40; i++) {
    const f = document.createElement("div");
    f.className = "firefly" + (i >= 12 ? " extra" : "");
    f.style.left = (5 + Math.random() * 90) + "%";
    f.style.top = (60 + Math.random() * 29) + "%";
    f.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
    f.style.setProperty("--dy", (Math.random() * -60) + "px");
    f.style.setProperty("--t", (6 + Math.random() * 8) + "s");
    f.style.animationDelay = (-Math.random() * 10) + "s";
    world.appendChild(f);
  }
  setupWeather();
  preloadWalks();
  if (FARM.keeper) addAnimal(FARM.keeper, { keeper: true });
  (FARM.residents || []).forEach((d) => addAnimal(d));
  store.get("farm-keeper-local", []).forEach((d) => addAnimal(d));
  store.get("farm-pending", []).forEach((d) => addAnimal(d, { pending: true }));
  if (window.Backend && Backend.enabled) {
    Backend.select("adoptions", "select=species,animal_name,adopter,note,created_at&approved=eq.true&order=created_at.asc")
      .then((rows) => {
        const pend = store.get("farm-pending", []);
        rows.forEach((r) => {
          // an approved request replaces this visitor's pending copy
          const i = animals.findIndex((a) => a.pending && a.def.name === r.animal_name && a.def.species === r.species);
          if (i >= 0) { animals[i].el.remove(); animals.splice(i, 1); store.set("farm-pending", pend.filter((p) => !(p.name === r.animal_name && p.species === r.species))); }
          addAnimal({ species: r.species, name: r.animal_name, adoptedBy: r.adopter || "a visitor", note: r.note, since: (r.created_at || "").slice(0, 7) });
        });
      }).catch(() => {});
    loadShared();
  }
  document.getElementById("residentCount").textContent = animals.length + " little lives";
  document.getElementById("meetKeeper").onclick = () => {
    const keeper = animals.find(a => a.keeper); if (!keeper) return;
    viewport.scrollTo({left: keeper.el.offsetLeft - viewport.clientWidth / 2, behavior: reduce ? "auto" : "smooth"});
    setTimeout(() => openAnimal(keeper), reduce ? 0 : 400);
  };
  applySeason(false);
  saveTrees();
  renderBasket();

  const act = (id, fn) => { document.getElementById(id).onclick = () => { closeBubble(); fn(); }; };
  act("btnAdopt", adoptModal);
  act("btnPlant", plantModal);
  act("btnHarvest", harvestAll);
  act("btnAnimals", rosterModal);
  if (keeperMode) toast("Keeper mode: “Adopt an Animal” now creates lines for data/farm.js.", 4200);
  addEventListener("skycalm", () => setWeather(season.name));

  // start the view where the keeper and the orchard are
  requestAnimationFrame(() => { viewport.scrollLeft = Math.max(0, world.offsetWidth * ROCK.x / 100 - viewport.clientWidth * .32); });

  let last = performance.now(), tick = 0, time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (document.hidden) return;
    time += dt;
    const calm = reduce || (window.Sky && Sky.calm);
    document.body.classList.toggle("farm-calm", !!calm);
    if (!calm) animals.forEach((a) => stepAnimal(a, dt, now));
    positionBubble();
    drawWeather(calm ? 0 : dt, calm ? 0 : time);
    tick += dt;
    if (tick > 1) {
      tick = 0;
      const c = clock();
      if (c.abs !== season.abs || c.name !== season.name) {
        const changedName = c.name !== season.name;
        season = c;
        if (changedName) applySeason(true); else trees.forEach(renderTree);
        saveTrees();
      } else season.left = c.left;
      renderChip();
    }
  }
  requestAnimationFrame(frame);
})();
