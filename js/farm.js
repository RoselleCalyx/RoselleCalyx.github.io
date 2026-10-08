/* =====================================================================
   My Little Farm
   - residents come from data/farm.js (plus approved adoptions in the
     optional shared database, plus this visitor's pending requests)
   - the orchard lives in this visitor's browser: trees grow through
     sapling → spring → summer → autumn (ripe) → harvest → winter → spring…
   ===================================================================== */
(function () {
  const { esc, ICON, store, toast, modal } = window.Site;
  const { ART, SPECIES, TREES, treeSVG, fruitIcon } = window.FarmArt;
  const FARM = window.FARM || { residents: [] };
  const keeperMode = new URLSearchParams(location.search).has("keeper");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const world = document.getElementById("world");
  const actorsEl = document.getElementById("actors");
  const viewport = document.getElementById("farmViewport");

  /* ---------- the painted world (1600 × 900) ---------- */
  function background() {
    const peaks = [[120, 300], [330, 250], [540, 272], [770, 228], [990, 258], [1210, 238], [1450, 268]];
    const snow = peaks.map(([x, y]) => `<path d="M${x} ${y} L${x + 30} ${y + 28} L${x + 16} ${y + 24} L${x + 6} ${y + 34} L${x - 8} ${y + 22} L${x - 22} ${y + 30} Z" fill="#dfe6f3" opacity=".82"/>`).join("");
    let pines = "";
    for (let i = 0; i < 70; i++) {
      const x = (i * 23.3 + ((i * 37) % 17)) % 1600, h = 30 + ((i * 53) % 44), y = 528 + ((i * 29) % 16);
      pines += `<path d="M${x} ${y - h} L${x + h * 0.32} ${y} L${x - h * 0.32} ${y} Z" fill="#0b1324"/>`;
    }
    for (const [x, h] of [[40, 190], [95, 150], [1530, 200], [1580, 160], [610, 120]]) {
      const y = h > 150 ? 600 : 560;
      pines += `<path d="M${x} ${y - h} L${x + h * 0.26} ${y - h * 0.45} L${x + h * 0.14} ${y - h * 0.45} L${x + h * 0.34} ${y} L${x - h * 0.34} ${y} L${x - h * 0.14} ${y - h * 0.45} L${x - h * 0.26} ${y - h * 0.45} Z" fill="#0a1220"/>`;
    }
    let posts = "";
    for (let x = 620; x <= 1560; x += 56) posts += `<rect x="${x}" y="${578 + (x - 620) * -0.01}" width="6" height="34" rx="2" fill="#3a2b20"/>`;
    let flowers = "";
    const cols = ["#f6d6e4", "#ffe9a8", "#cfe0ff", "#ffffff", "#f7b8c9"];
    for (let i = 0; i < 120; i++) {
      const x = (i * 131.7) % 1600, y = 650 + ((i * 47) % 240);
      if (((x - 1000) / 210) ** 2 + ((y - 760) / 75) ** 2 < 1) continue;
      flowers += `<circle cx="${x.toFixed(0)}" cy="${y}" r="${1.4 + (i % 3) * 0.7}" fill="${cols[i % cols.length]}" opacity=".85"/>`;
    }
    let grass = "";
    for (let i = 0; i < 90; i++) {
      const x = (i * 97.3) % 1600, y = 640 + ((i * 61) % 250);
      grass += `<path d="M${x.toFixed(0)} ${y} q-3 -9 -6 -12 M${x.toFixed(0)} ${y} q1 -10 0 -14 M${x.toFixed(0)} ${y} q4 -8 7 -11" stroke="#2f5a38" stroke-width="1.6" fill="none" opacity=".8"/>`;
    }
    const lamps = [[640, 640], [1215, 690], [1500, 628], [470, 548]].map(([x, y], i) => `
      <circle class="lamp" style="animation-delay:-${i * 0.7}s" cx="${x}" cy="${y - 58}" r="46" fill="url(#fLamp)"/>
      ${i < 3 ? `<rect x="${x - 2}" y="${y - 54}" width="4" height="56" fill="#2a1f18"/>` : ""}
      <rect x="${x - 7}" y="${y - 66}" width="14" height="16" rx="3" fill="#ffd27a" stroke="#3a2b20" stroke-width="2"/>`).join("");
    const planks = Array.from({ length: 9 }, (_, i) => `<rect x="${1150 + i * 15}" y="${812 - i * 15}" width="40" height="11" rx="2" transform="rotate(-38 ${1170 + i * 15} ${818 - i * 15})" fill="${i % 2 ? "#5d4532" : "#6a4f39"}"/>`).join("");
    return `<svg class="farm-bg" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2550" stop-opacity="0"/><stop offset="1" stop-color="#3a3a6a" stop-opacity=".45"/></linearGradient>
        <linearGradient id="fMeadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a4530"/><stop offset=".35" stop-color="#1c3424"/><stop offset="1" stop-color="#0c1810"/></linearGradient>
        <linearGradient id="fPond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3d74"/><stop offset="1" stop-color="#0d1736"/></linearGradient>
        <radialGradient id="fLamp"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".75"/><stop offset=".4" stop-color="#ffb860" stop-opacity=".25"/><stop offset="1" stop-color="#ff9a40" stop-opacity="0"/></radialGradient>
        <radialGradient id="fWin"><stop offset="0" stop-color="#ffd690" stop-opacity=".6"/><stop offset="1" stop-color="#ffb050" stop-opacity="0"/></radialGradient>
      </defs>
      <rect x="0" y="160" width="1600" height="400" fill="url(#fHaze)"/>
      <path d="M0 420 L120 300 L210 350 L330 250 L430 330 L540 272 L650 340 L770 228 L880 320 L990 258 L1100 330 L1210 238 L1330 320 L1450 268 L1600 330 V560 H0 Z" fill="#1d2747"/>
      ${snow}
      <path d="M0 470 L160 400 L300 450 L460 390 L620 452 L800 400 L960 458 L1120 404 L1280 456 L1440 410 L1600 450 V560 H0 Z" fill="#141c35"/>
      ${pines}
      <path d="M0 528 Q400 506 800 520 T1600 514 V900 H0 Z" fill="url(#fMeadow)"/>
      <path d="M443 575 C470 640 420 700 520 760 C600 810 580 860 640 900 L560 900 C520 860 520 820 450 770 C360 710 410 640 410 575 Z" fill="#4a4636" opacity=".35"/>
      <g>
        <circle cx="392" cy="520" r="70" fill="url(#fWin)"/><circle cx="497" cy="520" r="70" fill="url(#fWin)"/>
        <rect x="350" y="478" width="190" height="97" fill="#4b3528"/>
        ${[490, 506, 522, 538, 554, 570].map((y) => `<line x1="350" y1="${y}" x2="540" y2="${y}" stroke="#36261c" stroke-width="2"/>`).join("")}
        <rect x="500" y="414" width="18" height="44" fill="#3a2a22"/>
        <path d="M328 486 L445 408 L562 486 Z" fill="#2c1e18"/><path d="M328 486 L445 408 L562 486" fill="none" stroke="#e8edf5" stroke-width="5" stroke-linejoin="round" opacity=".7"/>
        <rect x="375" y="505" width="34" height="30" fill="#ffcf7a"/><rect x="480" y="505" width="34" height="30" fill="#ffcf7a"/>
        <path d="M392 505 v30 M375 520 h34 M497 505 v30 M480 520 h34" stroke="#4b3528" stroke-width="3"/>
        <rect x="428" y="522" width="32" height="53" rx="3" fill="#2e1f17"/><circle cx="453" cy="550" r="2" fill="#d9b070"/>
        <circle class="smoke" cx="509" cy="400" r="9" fill="#cfd6e6" opacity=".25"/><circle class="smoke s2" cx="515" cy="380" r="12" fill="#cfd6e6" opacity=".18"/>
      </g>
      <path d="M620 596 L1562 586 M620 606 L1562 596" stroke="#4a3626" stroke-width="3"/>
      ${posts}
      <ellipse cx="1000" cy="764" rx="206" ry="70" fill="#3d4450"/>
      <ellipse cx="1000" cy="760" rx="190" ry="62" fill="url(#fPond)"/>
      <ellipse cx="1040" cy="742" rx="46" ry="4" fill="#f1e6c6" opacity=".5"/><ellipse cx="1040" cy="752" rx="26" ry="3" fill="#f1e6c6" opacity=".3"/>
      <ellipse cx="900" cy="780" rx="16" ry="5" fill="#3f7a4a"/><ellipse cx="930" cy="792" rx="11" ry="4" fill="#4a8a52"/><circle cx="902" cy="777" r="3" fill="#f7c6d6"/>
      ${planks}
      <path d="M176 792 C180 744 222 724 262 726 C304 728 334 752 338 792 Z" fill="#4b5264"/>
      <path d="M200 760 C214 738 244 732 270 736 C252 742 230 748 214 768 Z" fill="#6b7387" opacity=".8"/>
      <path d="M180 792 C210 784 300 784 336 792" stroke="#2f5a38" stroke-width="6" stroke-linecap="round" opacity=".7"/>
      ${grass}${flowers}${lamps}
      <rect x="0" y="830" width="1600" height="70" fill="#000" opacity=".22"/>
    </svg>`;
  }

  /* ---------- geometry helpers (percent of the world) ---------- */
  const GROUND = { x0: 4, x1: 93, y0: 71, y1: 96 };
  const POND = { cx: 62.5, cy: 84.4, rx: 13.4, ry: 8.8 };
  const ROCK = { x: 16.2, y: 82.2 };
  const SLOTS = [{ x: 8, y: 72 }, { x: 45, y: 70 }, { x: 72, y: 70.5 }, { x: 89, y: 88 }, { x: 30, y: 93 }];
  const inPond = (x, y) => ((x - POND.cx) / POND.rx) ** 2 + ((y - POND.cy) / POND.ry) ** 2 < 1;
  const depth = (y) => 0.72 + ((y - 66) / 30) * 0.5;
  function randomSpot(nearX) {
    for (let i = 0; i < 40; i++) {
      const x = Math.max(GROUND.x0, Math.min(GROUND.x1, (nearX == null ? GROUND.x0 + Math.random() * (GROUND.x1 - GROUND.x0) : nearX + (Math.random() - 0.5) * 34)));
      const y = GROUND.y0 + Math.random() * (GROUND.y1 - GROUND.y0);
      if (!inPond(x, y) && !(Math.abs(x - ROCK.x) < 7 && y > 76 && y < 89)) return { x, y };
    }
    return { x: 40, y: 80 };
  }

  /* ================= animals ================= */
  const animals = [];
  function addAnimal(def, opts = {}) {
    const sp = SPECIES[def.species];
    if (!sp) return null;
    const pos = opts.keeper ? { x: ROCK.x, y: ROCK.y } : randomSpot();
    const el = document.createElement("div");
    el.className = "actor" + (opts.pending ? " pending" : "") + (sp.gait === "hop" ? " hop-gait" : "");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `${def.name}, ${sp.label}`);
    el.innerHTML = `<div class="flip"><div class="bob">${ART[def.species]()}</div></div>${opts.pending ? `<span class="tag">waiting for approval</span>` : ""}`;
    actorsEl.appendChild(el);
    const a = { def, sp, el, x: pos.x, y: pos.y, tx: pos.x, ty: pos.y, state: "idle", until: performance.now() + 1000 + Math.random() * 3000, dir: Math.random() < 0.5 ? 1 : -1, keeper: !!opts.keeper, pending: !!opts.pending, held: false };
    el.addEventListener("click", (e) => { e.stopPropagation(); openAnimal(a); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAnimal(a); } });
    animals.push(a);
    place(a);
    return a;
  }
  function place(a) {
    const s = depth(a.y) * a.sp.size;
    a.el.style.left = a.x + "%";
    a.el.style.top = a.y + "%";
    a.el.style.width = 8.2 * s + "%";
    a.el.style.zIndex = Math.round(a.y * 10);
    a.el.classList.toggle("left", a.dir < 0);
    a.el.classList.toggle("walking", a.state === "walk" && a.sp.gait !== "hop");
    a.el.classList.toggle("hopping", a.state === "walk" && a.sp.gait === "hop");
  }
  function emote(a, ch) {
    const s = document.createElement("span");
    s.className = "emote"; s.textContent = ch;
    a.el.appendChild(s);
    setTimeout(() => s.remove(), 2500);
  }
  function think(a, now) {
    if (a.keeper) {
      // the keeper mostly naps on her warm rock, and sometimes patrols the orchard
      const home = Math.hypot(a.x - ROCK.x, a.y - ROCK.y) < 1;
      if (home && Math.random() < 0.72) { a.state = "idle"; a.until = now + 5000 + Math.random() * 7000; if (Math.random() < 0.6) emote(a, "z z"); a.dir = 1; return; }
      const t = home ? randomSpot(30) : { x: ROCK.x, y: ROCK.y };
      a.tx = t.x; a.ty = t.y; a.state = "walk"; return;
    }
    if (Math.random() < 0.35) {
      a.state = "idle"; a.until = now + 2000 + Math.random() * 5000;
      if (Math.random() < 0.3) emote(a, ["♪", "♥", "✿", "…"][(Math.random() * 4) | 0]);
      return;
    }
    const t = randomSpot(a.x);
    a.tx = t.x; a.ty = t.y; a.state = "walk";
  }
  function stepAnimal(a, dt, now) {
    if (a.held) return;
    if (a.state === "idle") { if (now > a.until) think(a, now); return; }
    const dx = a.tx - a.x, dy = (a.ty - a.y) * 1.78, d = Math.hypot(dx, dy);
    const v = a.sp.speed * dt * depth(a.y);
    if (d <= v) { a.x = a.tx; a.y = a.ty; a.state = "idle"; a.until = now + 1500 + Math.random() * 4000; }
    else {
      let nx = a.x + (dx / d) * v, ny = a.y + (dy / d / 1.78) * v;
      if (inPond(nx, ny)) { ny += (ny < POND.cy ? -1 : 1) * v; nx = a.x + (dx / d) * v * 0.5; }
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
    if (a) { a.held = true; a.state = "idle"; place(a); }
    el.querySelector(".x").onclick = closeBubble;
    el.addEventListener("click", (e) => e.stopPropagation());
    positionBubble();
    return el;
  }
  function positionBubble() {
    if (!bubble) return;
    const w = world.getBoundingClientRect(), r = bubble.anchor.getBoundingClientRect();
    let left = r.left + r.width / 2 - w.left;
    left = Math.max(140, Math.min(w.width - 140, left));
    bubble.el.style.left = left + "px";
    bubble.el.style.top = r.top - w.top + 6 + "px";
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
  const DUR = { sapling: 60, winter: 45, spring: 55, summer: 60 };   // seconds; autumn waits for you
  const NEXT = { sapling: "spring", winter: "spring", spring: "summer", summer: "autumn" };
  const SEASON = { sapling: "a young sapling", winter: "winter rest", spring: "blossoming", summer: "growing fruit", autumn: "ripe — ready to pick" };
  let trees = store.get("farm-trees", null);
  if (!trees) {
    const now = Date.now();
    trees = [
      { type: "cherry", slot: 1, stage: "spring", since: now - 5000, seed: 11 },
      { type: "apple", slot: 2, stage: "autumn", since: now, seed: 23, fruitN: 8, picked: [] },
      { type: "peach", slot: 0, stage: "summer", since: now - 20000, seed: 37 },
      { type: "orange", slot: 3, stage: "winter", since: now - 10000, seed: 41 }
    ];
  }
  trees.forEach((t, i) => { t.id = t.id || "t" + i + Date.now(); t.cycle = t.cycle || 0; });
  const saveTrees = () => store.set("farm-trees", trees.map(({ el, ...t }) => t));
  function advance(t) {
    let changed = false;
    while (t.stage !== "autumn" && Date.now() - t.since >= DUR[t.stage] * 1000) {
      t.since += DUR[t.stage] * 1000;
      t.stage = NEXT[t.stage];
      if (t.stage === "autumn") { t.fruitN = 6 + ((t.seed + t.cycle) % 4); t.picked = []; }
      changed = true;
    }
    return changed;
  }
  function renderTree(t) {
    const slot = SLOTS[t.slot];
    if (!t.el) {
      t.el = document.createElement("div");
      t.el.className = "tree";
      t.el.addEventListener("click", (e) => { e.stopPropagation(); onTreeClick(t, e); });
      actorsEl.appendChild(t.el);
    }
    const s = depth(slot.y);
    t.el.style.left = slot.x + "%";
    t.el.style.top = slot.y + "%";
    t.el.style.width = 19 * s + "%";
    t.el.style.zIndex = Math.round(slot.y * 10) - 1;
    t.el.classList.toggle("ripe", t.stage === "autumn");
    t.el.setAttribute("aria-label", `${TREES[t.type].label} tree, ${SEASON[t.stage]}`);
    t.el.innerHTML = treeSVG(t);
  }
  function onTreeClick(t, e) {
    const f = e.target.closest(".fruit");
    if (f && t.stage === "autumn") { pick(t, +f.dataset.i, f); return; }
    const left = t.stage === "autumn" ? "" : `<p>Next season in about ${Math.max(1, Math.ceil((DUR[t.stage] * 1000 - (Date.now() - t.since)) / 1000))} seconds.</p>`;
    const el = showBubble(`
      <span class="sp">${esc(TREES[t.type].label)} tree · ${esc(TREES[t.type].zh)}</span>
      <h4>${esc(SEASON[t.stage].replace(/^./, (c) => c.toUpperCase()))}</h4>
      ${left}${t.stage === "autumn" ? "<p>Tap a fruit to pick it, or use Harvest.</p>" : ""}
      <div class="bubble-actions">
        ${t.stage !== "autumn" ? `<button class="btn sm" type="button" data-water>${ICON.drop} Water</button>` : ""}
        <button class="btn sm" type="button" data-dig>Dig up</button>
      </div>`, t.el, null);
    const w = el.querySelector("[data-water]");
    if (w) w.onclick = () => { t.since -= 12000; water(t); if (advance(t)) { renderTree(t); onStage(t); } saveTrees(); closeBubble(); };
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
  function leafBurst(t) {
    const b = worldPoint(t.el), cols = TREES[t.type].leafAutumn;
    for (let i = 0; i < 26; i++) {
      particle("leaf", b.x + b.w * (0.15 + Math.random() * 0.7), b.y + b.h * (0.1 + Math.random() * 0.4),
        { background: cols[i % cols.length], "--dx": (Math.random() * 120 - 40) + "px", "--dy": (b.h * 0.55 + Math.random() * 40) + "px", "--t": (2.2 + Math.random() * 1.6) + "s" });
    }
  }
  function onStage(t) { if (t.stage === "winter") leafBurst(t); }

  /* ---------- basket & harvest ---------- */
  let basket = store.get("farm-basket", {});
  const basketEl = document.getElementById("basket");
  let sharedTotal = null;
  function renderBasket() {
    const parts = Object.keys(TREES).filter((k) => basket[k]).map((k) => `<span class="fi">${fruitIcon(k)}${basket[k]}</span>`);
    basketEl.innerHTML = `${ICON.basket}<span>${parts.length ? parts.join("") : "Your basket is empty"}</span>${sharedTotal != null ? `<span class="muted">· all visitors: ${sharedTotal}</span>` : ""}`;
  }
  function addToBasket(type, n, fromEl) {
    basket[type] = (basket[type] || 0) + n;
    store.set("farm-basket", basket);
    if (fromEl) flyFruit(type, fromEl);
    setTimeout(renderBasket, 700);
    if (window.Backend && Backend.enabled) {
      Backend.rpc("add_harvest", { p_fruit: type, p_n: n }).then(loadShared).catch(() => {});
    }
  }
  function flyFruit(type, fromEl, delay = 0) {
    const r = fromEl.getBoundingClientRect(), b = basketEl.getBoundingClientRect();   // measure now, animate later
    const d = document.createElement("div");
    d.className = "fly-fruit";
    d.style.background = TREES[type].fruit;
    d.style.left = r.left + r.width / 2 - 8 + "px"; d.style.top = r.top + r.height / 2 - 8 + "px";
    document.body.appendChild(d);
    setTimeout(() => requestAnimationFrame(() => {
      d.style.transform = `translate(${b.left + 20 - r.left - r.width / 2}px, ${b.top + 8 - r.top - r.height / 2}px) scale(.6)`;
      d.style.opacity = "0.2";
    }), delay);
    setTimeout(() => d.remove(), 950 + delay);
  }
  function pick(t, i, el) {
    t.picked = [...new Set([...(t.picked || []), i])];
    addToBasket(t.type, 1, el);
    if (t.picked.length >= (t.fruitN || 8)) finishHarvest(t);
    else renderTree(t);
    saveTrees();
  }
  function finishHarvest(t) {
    t.stage = "winter"; t.since = Date.now(); t.cycle++; t.picked = [];
    renderTree(t); onStage(t); saveTrees();
  }
  function harvestAll() {
    const ripe = trees.filter((t) => t.stage === "autumn");
    if (!ripe.length) {
      const soonest = trees.slice().sort((a, b) => order(b) - order(a))[0];
      toast(soonest ? `Nothing is ripe yet — the ${TREES[soonest.type].label.toLowerCase()} tree is ${SEASON[soonest.stage]}.` : "Plant a tree first.");
      return;
    }
    ripe.forEach((t) => {
      const left = (t.fruitN || 8) - (t.picked || []).length;
      t.el.querySelectorAll(".fruit").forEach((f, k) => flyFruit(t.type, f, k * 60));
      addToBasket(t.type, left);
      finishHarvest(t);
    });
    toast("Harvest in! The trees rest for winter.");
  }
  const order = (t) => ({ sapling: 0, winter: 1, spring: 2, summer: 3, autumn: 4 }[t.stage]);
  function loadShared() {
    if (!(window.Backend && Backend.enabled)) return;
    Backend.select("farm_stats", "select=fruit,total").then((rows) => {
      sharedTotal = rows.reduce((a, r) => a + (r.total || 0), 0); renderBasket();
    }).catch(() => {});
  }

  /* ---------- falling petals & snow ---------- */
  function ambient() {
    if (reduce || (window.Sky && Sky.calm)) return;
    trees.forEach((t) => {
      if (!t.el || (t.stage !== "spring" && t.stage !== "winter")) return;
      if (Math.random() > 0.35) return;
      const b = worldPoint(t.el);
      if (t.stage === "spring") particle("petal", b.x + b.w * (0.2 + Math.random() * 0.6), b.y + b.h * (0.15 + Math.random() * 0.3),
        { background: TREES[t.type].blossom[0], "--dx": (40 + Math.random() * 80) + "px", "--dy": (b.h * 0.6) + "px", "--t": (5 + Math.random() * 3) + "s" });
      else particle("flake", b.x + Math.random() * b.w, b.y, { "--dx": (Math.random() * 30 - 15) + "px", "--dy": b.h + "px", "--rot": "0deg", "--t": (4 + Math.random() * 3) + "s" });
    });
  }

  /* ================= modals ================= */
  const speciesGrid = (exclude) => Object.entries(SPECIES).filter(([k]) => k !== exclude)
    .map(([k, s], i) => `<button type="button" data-sp="${k}" class="${i === 0 ? "active" : ""}">${ART[k]()}<span>${esc(s.label)}</span></button>`).join("");

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
          m.card.querySelectorAll(".species-grid button").forEach((x) => x.classList.toggle("active", x === b));
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
    if (!free.length) { toast("The orchard is full. Harvest, or dig up a tree to make room."); return; }
    const preview = (k) => treeSVG({ type: k, stage: "autumn", seed: 5, cycle: 0, fruitN: 6, picked: [] });
    modal(`
      <h2>Plant a Tree</h2>
      <p class="muted">It will grow while you're away: blossoms in spring, fruit in autumn, rest in winter.</p>
      <div class="species-grid tree-grid">${Object.entries(TREES).map(([k, T]) => `<button type="button" data-tree="${k}">${preview(k)}<span>${T.label} · ${T.zh}</span></button>`).join("")}</div>`, {
      onOpen(m) {
        m.card.querySelector(".tree-grid").addEventListener("click", (e) => {
          const b = e.target.closest("button"); if (!b) return;
          const t = { id: "t" + Date.now(), type: b.dataset.tree, slot: free[0], stage: "sapling", since: Date.now(), seed: (Math.random() * 1000) | 0, cycle: 0 };
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
          viewport.scrollBy({ left: r.left + r.width / 2 - innerWidth / 2, behavior: "smooth" });
          setTimeout(() => openAnimal(a), 450);
        });
      }
    });
  }

  /* ================= start ================= */
  world.insertAdjacentHTML("afterbegin", background());
  for (let i = 0; i < 24; i++) {
    const f = document.createElement("div");
    f.className = "firefly";
    f.style.left = (5 + Math.random() * 90) + "%";
    f.style.top = (55 + Math.random() * 38) + "%";
    f.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
    f.style.setProperty("--dy", (Math.random() * -60) + "px");
    f.style.setProperty("--t", (6 + Math.random() * 8) + "s");
    f.style.animationDelay = (-Math.random() * 10) + "s";
    world.appendChild(f);
  }
  trees.forEach((t) => { advance(t); renderTree(t); });
  saveTrees();
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
  renderBasket();

  const act = (id, fn) => { document.getElementById(id).onclick = () => { closeBubble(); fn(); }; };
  act("btnAdopt", adoptModal);
  act("btnPlant", plantModal);
  act("btnHarvest", harvestAll);
  act("btnAnimals", rosterModal);
  if (keeperMode) toast("Keeper mode: “Adopt an Animal” now creates lines for data/farm.js.", 4200);

  // start the view where the keeper and the orchard are
  requestAnimationFrame(() => { viewport.scrollLeft = (world.offsetWidth - viewport.clientWidth) * 0.3; });

  let last = performance.now(), tick = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (document.hidden) return;
    animals.forEach((a) => stepAnimal(a, dt, now));
    positionBubble();
    tick += dt;
    if (tick > 1) {
      tick = 0;
      trees.forEach((t) => { if (advance(t)) { renderTree(t); onStage(t); saveTrees(); } });
      ambient();
    }
  }
  requestAnimationFrame(frame);
})();
