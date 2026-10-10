/* =====================================================================
   My Little Farm
   - one season clock for everyone: each season lasts 8 minutes of real
     time (a year is 32 minutes), so all visitors share the same weather
   - each fruit ripens in its own season, as in a real orchard:
     cherries & peaches in summer, apples in autumn, oranges in winter
   - the shared orchard and approved adoptions live in the farm service
   - baskets, friendship hearts and personal harvests belong to each visitor
   Preview a season with farm.html?season=winter
   ===================================================================== */
(function () {
  const { esc, ICON, store, toast, modal } = window.Site;
  const { ART, SPECIES, TREES, PHENO, FRUIT, WALK, walkSrc, walkSprite, jumpSprite, poseSprite, treeSVG, treeInline, fruitIcon, defs } = window.FarmArt;
  const Motion = window.FarmMotion;
  const FARM = window.FARM || { residents: [] };
  const Cloud = window.FarmCloud;
  // Renaming the keeper preserves the visitor's accumulated hearts.
  const keeperHearts = store.get('farm-hearts', {});
  if (keeperHearts['snowcat:Yuki'] !== undefined) {
    keeperHearts['snowcat:Matcha'] = (keeperHearts['snowcat:Matcha'] || 0) + keeperHearts['snowcat:Yuki'];
    delete keeperHearts['snowcat:Yuki']; store.set('farm-hearts', keeperHearts);
  }
  const params = new URLSearchParams(location.search);
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = motionPreference.matches;
  motionPreference.addEventListener("change", (e) => { reduce = e.matches; setWeather(season.name); });
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia("(pointer: coarse)").matches;
  const world = document.getElementById("world");
  const actorsEl = document.getElementById("actors");
  const viewport = document.getElementById("farmViewport");

  /* ================= the season clock ================= */
  const SEASONS = ["spring", "summer", "autumn", "winter"];
  const SEASON_MS = 8 * 60 * 1000;
  const ICONS = { spring: "✿", summer: "☀", autumn: "❦", winter: "❄" };
  const forced = SEASONS.includes(params.get("season")) ? params.get("season") : null;
  const SPEED = Math.min(240, Math.max(1, parseFloat(params.get("speed")) || 1));   // ?speed=30 fast-forwards the year
  const PIN = parseFloat(params.get("p"));                                            // ?p=0.5 freezes the season at halfway
  const T0 = Date.now();
  function clock() {
    const now = T0 + (Date.now() - T0) * SPEED, abs = Math.floor(now / SEASON_MS);
    const left = PIN >= 0 && PIN <= 1 ? SEASON_MS * (1 - PIN) : SEASON_MS - (now % SEASON_MS);
    return { abs, name: forced || SEASONS[abs % 4], left, p: 1 - left / SEASON_MS };
  }
  let season = clock();
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  /* ================= the painted world (1600 × 900) ================= */

  function background() {
    // A few foreground blades add local wind motion without moving the painting.
    const grass = Array.from({ length: 24 }, (_, i) => {
      const x = i < 18 ? 22 + i * 37 : 1440 + (i - 18) * 26;
      const y = 851 + (i * 13) % 45, h = 9 + (i * 7) % 15;
      return `<g class="meadow-tuft" style="--lean:${i % 2 ? -1 : 1}"><path d="M${x} ${y} q-3 -${h * .7} -8 -${h} M${x} ${y} q1 -${h} 4 -${h + 4} M${x} ${y} q8 -${h * .6} 12 -${h * .8}"/></g>`;
    }).join('');
    return '<div class="farm-landscapes" aria-hidden="true">' +
      '<img class="farm-bg farm-landscape" data-s="spring summer" src="assets/farm/meadow-spring.webp" alt="" width="1920" height="1080" draggable="false" fetchpriority="high">' +
      '<img class="farm-bg farm-landscape" data-s="autumn" src="assets/farm/meadow-autumn.webp" alt="" width="1920" height="1080" draggable="false">' +
      '<img class="farm-bg farm-landscape" data-s="winter" src="assets/farm/meadow-winter.webp" alt="" width="1920" height="1080" draggable="false">' +
      '<div class="pond-open-water"></div><div class="pond-shimmer"><i></i><i></i></div>' +
      '<svg class="meadow-breeze" viewBox="0 0 1600 900">' + grass + '</svg>' +
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
    const W = weather.w, H = weather.h, wind = breeze(t) * 14 + (window.FarmFX ? FarmFX.wind * 140 : 0);
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
  const SLOTS = [{ x: 8, y: 67 }, { x: 47, y: 65 }, { x: 81, y: 64 }, { x: 93, y: 91 }, { x: 31, y: 94 }, {x:27,y:66}, {x:64,y:65}, {x:11,y:96}];
  const HOMES = { rabbit: {x: 37,y: 72.5}, panda: {x: 47,y: 92}, fox: {x: 56,y: 65.5}, shiba: {x: 30,y: 92}, duckling: {x: 76,y: 94} };
  const inPond = (x, y) => ((x - POND.cx) / POND.rx) ** 2 + ((y - POND.cy) / POND.ry) ** 2 < 1;
  const depth = (y) => 0.72 + ((y - 66) / 30) * 0.5;
  const crowded = (x,y,self) => animals.some(a => a !== self && Math.hypot((x-a.x)/8, (y-a.y)/11) < 1);
  const behindFrontTree = (x,y) => trees && trees.some(t => SLOTS[t.slot].y > 82 && Math.abs(x-SLOTS[t.slot].x) < 8 && y < SLOTS[t.slot].y && y > SLOTS[t.slot].y-23);
  function randomSpot(nearX, self) {
    for (let i = 0; i < 70; i++) {
      const x = Math.max(GROUND.x0, Math.min(GROUND.x1, nearX == null ? GROUND.x0 + Math.random() * (GROUND.x1 - GROUND.x0) : nearX + (Math.random() - 0.5) * 34));
      // Side-view art reads best on mostly lateral paths, rather than marching
      // straight towards the camera while still showing its side.
      const y = self ? Math.max(GROUND.y0, Math.min(GROUND.y1, self.y + (Math.random() - .5) * 10)) : GROUND.y0 + Math.random() * (GROUND.y1 - GROUND.y0);
      if ((!self || Math.abs(x - self.x) > 3) && !inPond(x, y) && !crowded(x,y,self) && !behindFrontTree(x,y) && !(Math.abs(x - ROCK.x) < 9 && y > 66 && y < 89)) return { x, y };
    }
    return self ? {x: self.x, y: self.y} : { x: 35, y: 94 };
  }

  /* ---------- walk cycles: show them only once decoded, so a first step never flashes blank ---------- */
  const walkReady = new Set(),jumpReady=new Set();
  function preloadWalks() {
    const run = () => Object.keys(WALK).forEach((sp) => {
      const jump=new Image();jump.decoding='async';jump.src=`assets/farm/jump/${sp}-v3.webp`;
      jump.onload=async()=>{
        if(jump.naturalWidth!==8*384||jump.naturalHeight!==384)return;
        try{await jump.decode();jumpReady.add(sp);document.querySelectorAll(`.actor[data-species="${sp}"]`).forEach(el=>el.classList.add('jump-ready'));}catch{}
      };
      const img = new Image();
      img.decoding = "async";
      img.src = walkSrc(sp);
      new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; if (img.complete && img.naturalWidth) ok(); })
        .then(async () => {
          if (img.naturalWidth !== Motion.GAITS[sp].frames * 384 || img.naturalHeight !== 384) return;
          if (img.decode) await img.decode();
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
    const art = `<div class="flip"><div class="bob">${ART[def.species]()}${walkSprite(def.species)}${jumpSprite(def.species)}${poseSprite(def.species)}<canvas class="reaction-art" width="320" height="320" aria-hidden="true"></canvas></div></div>`;
    el.innerHTML = art
      + `<span class="resident-label">${esc(def.name)}</span>`
      + (opts.pending ? `<span class="tag">waiting for approval</span>` : "");
    actorsEl.appendChild(el);
    const a = { def, sp, el, sprite: el.querySelector('.walk-sprite'), nextSprite: el.querySelector('.walk-sprite-next'), lift: 0, x: pos.x, y: pos.y, tx: pos.x, ty: pos.y, state: "idle", pose: opts.keeper ? 'sleep' : 'sit', phase: 0, speed: 0, until: performance.now() + 2500 + Math.random() * 5000, dir: 1, keeper: !!opts.keeper, pending: !!opts.pending, held: false };
    el.querySelectorAll('.pose-sprite').forEach(img => {
      const ready = async () => {
        if (img.dataset.loading) return;
        img.dataset.loading = 'true';
        try { if (img.decode) await img.decode(); }
        catch { return; } // keep the sitting image if a pose cannot be decoded
        img.dataset.ready = 'true'; setPose(a, a.pose);
      };
      img.addEventListener('load', ready, { once: true });
      if (img.complete && img.naturalWidth) ready();
    });
    el.addEventListener("click", (e) => { e.stopPropagation(); openAnimal(a); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAnimal(a, true); } });
    if (walkReady.has(def.species)) el.classList.add("walk-ready");
    if (jumpReady.has(def.species)) el.classList.add("jump-ready");
    animals.push(a);
    const count = document.getElementById("residentCount"); if (count) count.textContent = animals.length + " little lives";
    setPose(a, a.pose); place(a);
    return a;
  }
  function setPose(a, pose) {
    a.pose = pose;
    const img = a.el.querySelector(`.pose-sprite[data-pose="${pose}"]`);
    a.el.dataset.pose = pose === 'walk' || (img && img.dataset.ready) ? pose : 'sit';
  }
  function rest(a, now, duration, pose = 'sit') {
    a.state = 'idle'; a.speed = 0; a.until = now + duration;
    setPose(a, pose);
  }
  function planWalk(a, target, now) {
    if(!walkReady.has(a.def.species)){rest(a,now,1200,'sit');return;}
    if (Math.hypot(target.x - a.x, target.y - a.y) < .3) { rest(a, now, 3000); return; }
    if(a.perch){leaveRock(a,now);return;}
    a.tx = target.x; a.ty = target.y; a.speed = 0; a.phase = 0;
    a.turnDir = Math.abs(target.x - a.x) > .2 ? Math.sign(target.x - a.x) : a.dir;
    // Wake, then stand before starting: a sleepy kitten never jumps directly
    // from its curled sleeping silhouette into a moving side profile.
    const waking = a.pose === 'sleep';
    a.state = 'prepare'; a.until = now + (waking ? 1600 : 420);
    a.standAt = waking ? now + 1100 : now;
    setPose(a, waking && a.def.species === 'snowcat' ? 'stretch' : a.def.species === 'snowcat' ? 'stand' : 'sit');
  }
  function place(a) {
    const s = depth(a.y) * a.sp.size * (a.keeper ? 1.13 : 1);
    a.el.style.left = a.x + "%";
    const bound=a.state==='walk'&&a.sp.gait==='hop'?Math.sin(Math.PI*Math.min(1,Math.max(0,(a.phase-.26)/.56)))*.7:0;
    a.el.style.top = (a.y - (a.lift || 0) - bound) + "%";
    a.el.classList.toggle("leaping", a.state === "hop");
    a.el.style.width = 8.1 * s + "%";
    a.el.style.zIndex = Math.round(a.y * 10) + (a.perch || a.state === "hop" ? 2 : 0);
    a.el.classList.toggle("left", a.dir < 0);
    a.el.classList.toggle("walking", a.state === "walk" && a.sp.gait !== "hop");
    a.el.classList.toggle("hopping", a.state === "walk" && a.sp.gait === "hop");
    a.el.classList.toggle('sleeping', a.pose === 'sleep');
    const sample = Motion.sample(a.phase, a.def.species), frame = sample.frame;
    const leap=Motion.leap(a.jumpPhase||0),j=a.el.querySelector('.jump-sprite'),jn=a.el.querySelector('.jump-sprite-next');
    if(j){j.style.backgroundPositionX=leap.frame*100/7+'%';jn.style.backgroundPositionX=leap.next*100/7+'%';a.el.style.setProperty('--jump-blend',leap.blend.toFixed(3));}
    if (a.nextSprite) {
      a.nextSprite.style.backgroundPositionX = sample.next * 100 / (Motion.GAITS[a.def.species].frames - 1) + "%";
      a.el.style.setProperty("--gait-blend", sample.blend.toFixed(3));
    }
    if (a.sprite && a.lastFrame !== frame) {
      a.sprite.style.backgroundPositionX = Motion.position(a.phase, a.def.species) + '%';
      a.lastFrame = frame;
    }
  }
  function emote(a, ch) {
    const s = document.createElement("span");
    s.className = "emote"; s.textContent = ch;
    a.el.appendChild(s);
    setTimeout(() => s.remove(), 2500);
  }
  const climbable = a => ['snowcat','rabbit','fox','shiba'].includes(a.def.species);
  function startHop(a, target, now, rock = null) {
    if(!jumpReady.has(a.def.species)){rest(a,now,1200,'sit');return false;}
    a.hop = {x:a.x,y:a.y,lift:a.lift||0,tx:target.x,ty:target.y,endLift:rock?rock.lift:0,rock,start:now,duration:1000};
    a.jumpPhase=0;
    a.state='hop';a.speed=0;a.petUntil=0;
    a.dir=Math.sign(target.x-a.x)||a.dir;
    setPose(a,a.def.species==='snowcat'?'stretch':'walk');place(a);
  }
  function finishHop(a, now) {
    const h=a.hop;if(!h)return;
    a.x=h.tx;a.y=h.ty;a.lift=h.endLift;a.perch=h.rock;a.hop=null;
    rest(a,now,4000+Math.random()*3500,a.def.species==='snowcat'?'stand':'sit');place(a);
  }
  function leaveRock(a, now) {
    for(const [dx,dy] of [[4.5,1],[-4.5,1],[0,4],[-4.5,2.5],[4.5,2.5]]) {
      const target={x:a.x+dx,y:a.y+dy};
      if(target.x>=GROUND.x0&&target.x<=GROUND.x1&&target.y<=GROUND.y1&&!inPond(target.x,target.y)&&!crowded(target.x,target.y,a)) {startHop(a,target,now);return true;}
    }
    rest(a,now,3000);return false;
  }
  function think(a, now) {
    if(a.perch){leaveRock(a,now);return;}
    if(window.MeadowProps && climbable(a) && Math.random()<.28) {
      const rock=MeadowProps.PROPS.find(p=>p.kind==='rock'&&Math.hypot(p.x-a.x,(p.y-a.y)*1.78)<7&&!crowded(p.x,p.y,a)&&!inPond((p.x+a.x)/2,(p.y+a.y)/2));
      if(rock){startHop(a,{x:rock.x,y:rock.y},now,rock);return;}
    }
    if (a.keeper) {
      // The keeper naps and stretches on her rock, with occasional patrols.
      const home = Math.hypot(a.x - ROCK.x, a.y - ROCK.y) < 1;
      if (home && Math.random() < 0.72) {
        const pose = ['sleep', 'sleep', 'sit', 'sniff', 'stretch'][(Math.random() * 5) | 0];
        rest(a, now, pose === 'stretch' ? 1800 : 5000 + Math.random() * 9000, pose);
        if (pose === 'sleep' && Math.random() < .3) emote(a, 'z z');
        return;
      }
      const t = home ? randomSpot(28, a) : { x: ROCK.x, y: ROCK.y };
      planWalk(a, t, now); return;
    }
    if (Math.random() < 0.35) {
      const pose = Math.random() < .45 ? 'sleep' : a.def.species === 'snowcat' ? 'sniff' : 'sit';
      rest(a, now, 3500 + Math.random() * 6500, pose);
      if (Math.random() < 0.3) emote(a, ["♪", "♥", "✿", "…"][(Math.random() * 4) | 0]);
      return;
    }
    const t = randomSpot(a.x, a);
    planWalk(a, t, now);
  }
  function stepAnimal(a, dt, now) {
    if (a.petUntil && now > a.petUntil) { a.petUntil = 0; a.reaction=null;a.el.classList.remove('petting','reaction-ready'); setPose(a, 'sit'); place(a); }
    if (a.held) return;
    if (a.state==='hop') {
      const h=a.hop,u=Math.min(1,Math.max(0,(now-h.start)/h.duration)),air=Math.min(1,Math.max(0,(u-.26)/.56)),ease=air*air*(3-2*air);
      a.jumpPhase=u;
      a.x=h.x+(h.tx-h.x)*ease;a.y=h.y+(h.ty-h.y)*ease;
      a.lift=h.lift+(h.endLift-h.lift)*ease+Math.sin(Math.PI*air)*3;
      if(u>.65)setPose(a,a.def.species==='snowcat'?'stand':'sit');
      if(u>=1)finishHop(a,now);else place(a);
      return;
    }
    if (a.state === 'prepare') {
      if (now >= a.standAt) setPose(a, a.def.species === 'snowcat' ? 'stand' : 'sit');
      if (now >= a.until - 150) a.dir = a.turnDir;
      if (now >= a.until) { a.state = 'walk'; setPose(a, 'walk'); }
      place(a); return;
    }
    if (a.state === "idle") { if (now > a.until) { think(a, now); place(a); } return; }
    const dx = a.tx - a.x, dy = (a.ty - a.y) * 1.78, d = Math.hypot(dx, dy);
    const travel = Motion.travel(a.speed, a.sp.speed * depth(a.y), d, dt), v = travel.distance;
    a.speed = travel.speed;
    const oldX = a.x, oldY = a.y;
    if (d < .025) { a.x = a.tx; a.y = a.ty; rest(a, now, 1600 + Math.random() * 3000, a.def.species === 'snowcat' ? 'stand' : 'sit'); }
    else {
      let nx = a.x + (dx / d) * v, ny = a.y + (dy / d / 1.78) * v;
      if (inPond(nx, ny)) { ny += (ny < POND.cy ? -1 : 1) * v; nx = a.x + (dx / d) * v * 0.5; }
      if (crowded(nx,ny,a) || behindFrontTree(nx,ny)) { rest(a, now, 1500 + Math.random()*2000, a.def.species === 'snowcat' ? 'sniff' : 'sit'); place(a); return; }
      a.x = nx; a.y = ny;
    }
    const distance = Math.hypot(a.x - oldX, (a.y - oldY) * 1.78);
    const square = 8.1 * depth(a.y) * a.sp.size * (a.keeper ? 1.13 : 1);
    a.phase = Motion.advance(a.phase, distance, square, a.def.species);
    place(a);
  }

  /* ---------- anchored interactions and orchard details ---------- */
  let bubble = null;
  function closeBubble() {
    if (!bubble) return;
    const focusAnimal = bubble.a && bubble.el.contains(document.activeElement) ? bubble.a.el : null;
    if (bubble.a) {
      const now = performance.now();
      bubble.a.held = (bubble.a.reactUntil || 0) > now;
      bubble.a.until = Math.max(bubble.a.reactUntil || 0, now + 1800);
    }
    bubble.el.remove(); bubble = null;
    if (focusAnimal) focusAnimal.focus({ preventScroll: true });
  }
  function showBubble(html, anchorEl, a, mode = 'details') {
    closeBubble();
    const el = document.createElement("div");
    el.className = "bubble" + (mode === 'animal-actions' ? ' animal-actions' : mode === 'animal-food' ? ' animal-food' : '');
    el.innerHTML = (mode === 'animal-actions' ? '' : `<button class="x" type="button" aria-label="Close">×</button>`) + html;
    world.appendChild(el);
    bubble = { el, anchor: anchorEl, a, mode };
    if (a) {
      if(a.state==='hop')finishHop(a,performance.now());
      a.held = true;
      if (a.state !== 'idle') rest(a, performance.now(), 2000, a.def.species === 'snowcat' ? 'stand' : 'sit');
      place(a);
    }
    const close = el.querySelector(".x"); if (close) close.onclick = closeBubble;
    el.addEventListener("click", (e) => e.stopPropagation());
    positionBubble();
    return el;
  }
  function positionBubble() {
    if (!bubble) return;
    // The three action icons stay above their friend on every screen size.
    if (bubble.mode === 'animal-actions') {
      const el = bubble.el, r = bubble.anchor.getBoundingClientRect(), vr = viewport.getBoundingClientRect();
      if (el.parentNode !== document.body) document.body.appendChild(el);
      el.hidden = r.right <= vr.left || r.left >= vr.right || r.bottom <= vr.top || r.top >= vr.bottom || r.bottom <= 0 || r.top >= innerHeight;
      const width = Math.min(140, viewport.clientWidth - 24), half = width / 2;
      el.style.width = width + 'px';
      el.style.left = Math.max(Math.max(12, vr.left + 12) + half, Math.min(Math.min(innerWidth - 12, vr.right - 12) - half, r.left + r.width / 2)) + 'px';
      el.style.top = Math.max(el.offsetHeight + 8, r.top - 6) + 'px';
      return;
    }
    // A fixed sheet keeps the expanded feeding tray clear of the clipped garden.
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    bubble.el.classList.toggle('mobile-sheet', mobile);
    if (mobile) {
      if (bubble.el.parentNode !== document.body) document.body.appendChild(bubble.el);
      bubble.el.style.width = '';
      bubble.el.style.left = '';
      bubble.el.style.top = '';
      return;
    }
    if (bubble.el.parentNode !== world) world.appendChild(bubble.el);
    const w = world.getBoundingClientRect(), r = bubble.anchor.getBoundingClientRect();
    const vr = viewport.getBoundingClientRect();
    const half = Math.min(125, viewport.clientWidth / 2 - 12);
    bubble.el.style.width = Math.min(250, viewport.clientWidth - 24) + "px";
    const min = vr.left - w.left + half + 12, max = vr.right - w.left - half - 12;
    const left = Math.max(min, Math.min(max, r.left + r.width / 2 - w.left));
    bubble.el.style.left = left + "px";
    // open upward when there is room, otherwise below the animal so nothing is clipped by the frame
    const hgt = bubble.el.offsetHeight + 16, above = r.top - w.top + 6, roomBelow = w.height - (r.bottom - w.top);
    const below = above - hgt < 0 && roomBelow > above;
    bubble.el.classList.toggle("below", below);
    bubble.el.style.top = (below ? r.bottom - w.top - 6 : Math.max(Math.min(250, hgt), above)) + "px";
  }
  world.addEventListener("click", closeBubble);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBubble(); });
  // a touch on empty ground: a little sparkle, a ripple on the pond, a puff of snow in winter
  world.addEventListener("click", (e) => {
    if (!window.FarmFX) return;
    const r = world.getBoundingClientRect();
    FarmFX.touch(e.clientX - r.left, e.clientY - r.top, season.name);
  });
  const fxAt = (el, kind, text) => {
    if (!window.FarmFX || !el) return;
    const b = worldPoint(el);
    FarmFX.burst(b.x + b.w / 2, b.y + b.h * (kind === "heart" ? 0.25 : 0.5), kind, text);
  };
  /* ================= feeding: orchard fruit, finds from the woods, fish from the pond ================= */
  const FOOD = {
    apple: ["Apple", "farm"], peach: ["Peach", "farm"], orange: ["Orange", "farm"], cherry: ["Cherries", "farm"],
    kiwi:['Kiwi','farm'],grape:['Grapes','farm'],durian:['Durian','farm'],mango:['Mango','farm'],
    bayberry: ["Wild bayberry", "woods"], strawberry: ["Wild strawberry", "woods"], shoot: ["Bamboo shoot", "woods"], rosehip: ["Rose hip", "woods"],
    morel: ["Morel", "woods"], chanterelle: ["Chanterelle", "woods"], porcini: ["Porcini", "woods"], shiitake: ["Shiitake", "woods"], matsutake: ["Matsutake", "woods"], pinecone: ["Pine cone", "woods"],
    crucian: ["Crucian carp", "pond"], carp: ["Carp", "pond"], koi: ["Koi", "pond"], goldkoi: ["Golden koi", "pond"], catfish: ["Catfish", "pond"], mandarin: ["Mandarin fish", "pond"],
    bitterling: ["Bitterling", "pond"], minnow: ["Stone moroko", "pond"], loach: ["Loach", "pond"], eel: ["Rice-field eel", "pond"], shrimp: ["River shrimp", "pond"], crayfish: ["Crayfish", "pond"], crab: ["Mitten crab", "pond"], lotus: ["Lotus seed pod", "pond"]
  };
  const FISH = ["crucian", "carp", "koi", "goldkoi", "catfish", "mandarin", "bitterling", "minnow", "loach", "eel"];
  // what each friend loves, likes, and how it shows its joy
  const DIET = {
    snowcat: { love: FISH.concat(["shrimp"]), like: ["crab", "crayfish"], act: "knead", does: "kneads the grass and purrs like a small engine" },
    rabbit: { love: ["strawberry", "apple"], like: ["peach", "cherry", "rosehip"], act: "binky", does: "does a happy binky, a twisting leap" },
    panda: { love: ["shoot"], like: ["apple", "peach", "lotus"], act: "roll", does: "rolls right over with delight" },
    fox: { love: ["bayberry", "cherry", "crucian", "minnow"], like: ["apple", "strawberry", "rosehip", "shrimp", "loach"], act: "pounce", does: "pounces round in a joyful little circle" },
    shiba: { love: ["apple", "peach"], like: ["crucian", "carp", "porcini", "shiitake"], act: "spin", does: "spins and spins, tail going wild" },
    hedgehog: { love: ["strawberry", "chanterelle"], like: ["apple", "bayberry", "porcini", "morel"], act: "curl", does: "curls into a ball, then pops out beaming" },
    duckling: { love: ["shrimp", "minnow", "bitterling"], like: ["lotus", "strawberry", "loach"], act: "flap", does: "flaps its tiny wings and peeps" },
    penguin: { love: ["crucian", "minnow", "bitterling", "shrimp", "mandarin"], like: ["crab", "crayfish", "loach", "carp"], act: "slide", does: "toboggans across the grass on its tummy" }
  };
  const EMOJI = { farm: "🍎", woods: "🍄", pond: "🐟" };
  function pantry() {
    const woods = store.get("wild-woods", {}).basket || {}, pond = store.get("wild-pond", {}).creel || {}, icons = store.get("wild-icons", {});
    const list = [];
    Object.entries(FOOD).forEach(([id, [name, from]]) => {
      const n = from === "farm" ? basket[id] || 0 : from === "woods" ? woods[id] || 0 : pond[id] || 0;
      if (n > 0) list.push({ id, name, from, n, icon: from === "farm" ? fruitIcon(id) : icons[id] ? `<img src="${icons[id]}" alt="">` : `<span class="emo">${EMOJI[from]}</span>` });
    });
    return list;
  }
  function useFood(f) {
    if (f.from === "farm") { basket[f.id] = Math.max(0, (basket[f.id] || 0) - 1); if (!basket[f.id]) delete basket[f.id]; store.set("farm-basket", basket); }
    else {
      const key = f.from === "woods" ? "wild-woods" : "wild-pond", bag = f.from === "woods" ? "basket" : "creel", st = store.get(key, {});
      st[bag] = st[bag] || {}; st[bag][f.id] = Math.max(0, (st[bag][f.id] || 0) - 1); if (!st[bag][f.id]) delete st[bag][f.id];
      store.set(key, st);
    }
    renderBasket();
  }
  const fed = {};                                              // recent snacks, to know when someone is full
  const happyActions={snowcat:['knead','wave','happy-hop'],rabbit:['binky','happy-hop','wave'],panda:['wave','happy-hop','pet-stretch'],fox:['pounce','happy-hop','wave'],shiba:['wag','wave','happy-hop'],hedgehog:['curl','wave','happy-hop'],duckling:['flap','happy-hop','wave'],penguin:['flap','wave','happy-hop']};
  const petActions={snowcat:['knead','pet-nuzzle','wave','pet-stretch'],rabbit:['binky','pet-nuzzle','wave','pet-stretch'],panda:['wave','pet-nuzzle','pet-stretch'],fox:['wave','pet-nuzzle','pounce','pet-stretch'],shiba:['wag','pet-nuzzle','wave','pet-stretch'],hedgehog:['curl','pet-nuzzle','wave'],duckling:['flap','pet-nuzzle','wave'],penguin:['flap','pet-nuzzle','wave']};
  const actionText={wave:'waves a little paw',wag:'wags that curly tail', 'happy-hop':'hops up with delight',flap:'flutters tiny wings'};
  function react(a, kind, options = {}) {
    [...a.el.classList].filter((c) => c.startsWith("react")).forEach((c) => a.el.classList.remove(c));
    void a.el.offsetWidth;
    a.el.classList.add("react", "react-" + kind);
    const now = performance.now(), duration = options.duration || (kind === "nap" ? 9000 : 2400);
    a.reaction={kind,start:now,duration};
    a.petUntil = 0;a.el.classList.remove('petting');
    const catPose=kind==='knead'?'stretch':kind==='munch'?'sniff':'stand';
    rest(a, now, duration, kind === "nap" ? "sleep" : a.def.species === "snowcat" ? catPose : "sit");
    a.reactUntil = now + duration;
    a.held = true; place(a);
    if(window.AnimalReactions)AnimalReactions.draw(a,now,reduce);
    clearTimeout(a.reactT);
    a.reactT = setTimeout(() => {
      a.el.classList.remove("react", "react-" + kind);
      a.reactUntil = 0; a.until = performance.now() + 1800;
      a.reaction=null;a.el.classList.remove('reaction-ready');
      setPose(a,a.def.species==='snowcat'?'stand':'sit');place(a);
      if(options.onFinish){options.onFinish();return;}
      if (!bubble || bubble.a !== a) a.held = false;
    }, duration);
  }
  function flyTreat(fromEl, toEl, f) {
    const r = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
    const d = document.createElement("div");
    d.className = "fly-treat"; d.innerHTML = f.icon;
    d.style.left = r.left + r.width / 2 - 14 + "px"; d.style.top = r.top + r.height / 2 - 14 + "px";
    document.body.appendChild(d);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height * 0.45 - (r.top + r.height / 2);
    d.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 50}px) scale(1.15)`, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) scale(.4)`, opacity: 0.3 }],
      { duration: reduce ? 1 : 620, easing: "cubic-bezier(.4,0,.3,1)", fill: "forwards" });
    setTimeout(() => d.remove(), 700);
  }
  function feed(a, f, line, fromEl) {
    if(a.feeding){line.textContent=`${a.def.name} is still enjoying that bite…`;return;}
    const d = DIET[a.def.species] || { love: [], like: [], act: "munch", does: "" };
    const key = a.def.species + ":" + a.def.name, now = Date.now(), name = a.def.name, food = f.name.toLowerCase();
    const known = store.get("farm-diet", {}); known[a.def.species] = known[a.def.species] || {};
    fed[key] = (fed[key] || []).filter((t) => now - t < 4 * 60 * 1000);
    if (fed[key].length >= 3) { react(a, "nap"); emote(a, "z z"); line.textContent = `${name} is too full for another bite — time for a little nap.`; return; }
    if (f.id === "pinecone") {                                // not food, but a wonderful toy
      useFood(f); react(a, "pounce"); emote(a, "!");
      known[a.def.species].pinecone = "play"; store.set("farm-diet", known);
      line.textContent = `${name} isn’t hungry for a pine cone — but what a toy! Off it rolls into the grass.`;
      return;
    }
    const kind = d.love.includes(f.id) ? "love" : d.like.includes(f.id) ? "like" : "meh";
    known[a.def.species][f.id] = kind; store.set("farm-diet", known);
    if (kind === "meh") { react(a, "shake"); emote(a, "…"); line.textContent = `${name} sniffs the ${food}… and politely declines.`; return; }
    useFood(f); fed[key].push(now);
    a.feeding=true;
    clearTimeout(a.reactT);a.petUntil=0;a.reaction=null;
    a.el.classList.remove('petting','reaction-ready');
    [...a.el.classList].filter(c=>c.startsWith('react')).forEach(c=>a.el.classList.remove(c));
    // Hold the animal throughout delivery, eating, and its response.
    const delivery=fromEl&&!reduce?620:0;
    const responseDuration=kind==='love'?2400:2000;
    rest(a,performance.now(),delivery+2200+responseDuration,'sit');
    a.held=true;a.reactUntil=performance.now()+delivery+2200+responseDuration;place(a);
    if (fromEl) flyTreat(fromEl, a.el, f);
    const hearts = store.get("farm-hearts", {});
    hearts[key] = (hearts[key] || 0) + (kind === "love" ? 3 : 1); store.set("farm-hearts", hearts);
    a.feedT=setTimeout(() => {
      const treat=document.createElement('span');treat.className='bite-treat';treat.setAttribute('aria-hidden','true');treat.innerHTML=f.icon||EMOJI[f.from];
      a.el.querySelector('.bob').appendChild(treat);
      line.textContent=`${name} lowers their head and munches the ${food}…`;
      react(a,'munch',{duration:2200,onFinish:()=>{
        treat.remove();
        const choices=happyActions[a.def.species]||[d.act],act=choices[(a.snackAction||0)%choices.length];a.snackAction=(a.snackAction||0)+1;
        react(a,act,{duration:responseDuration,onFinish:()=>{a.feeding=false;if(!bubble||bubble.a!==a)a.held=false;}});
        emote(a,kind==='love'?'♥':'♪');fxAt(a.el,'heart');
        if(kind==='love')setTimeout(()=>fxAt(a.el,'heart'),380);
        line.textContent=`${name} ${kind==='love'?'loves':'enjoys'} ${food} — ${actionText[act]||d.does}! ${kind==='love'?'♥':'♪'}`;
      }});
    },delivery);
  }
  function openTray(a) {
    const el = showBubble(`<h4>Choose a snack</h4><p class="by">For ${esc(a.def.name)}</p><div class="feed-tray"></div>`, a.el, a, 'animal-food');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Choose food for ${a.def.name}`);
    const tray = el.querySelector(".feed-tray"), line = document.getElementById('farmFeedback');
    const list = pantry(), known = store.get("farm-diet", {})[a.def.species] || {};
    tray.hidden = false;
    if (!list.length) { tray.innerHTML = `<p class="feed-empty">Nothing to offer yet. Pick ripe fruit in the orchard, forage in <a href="woods.html">the woods</a>, or fish at <a href="pond.html">the pond</a>.</p>`; positionBubble(); el.querySelector('.x').focus({ preventScroll: true }); return; }
    const mark = { love: "♥", like: "♪", meh: "✕", play: "✦" };
    tray.innerHTML = list.map((f, i) => `<button type="button" class="treat ${known[f.id] || ""}" data-i="${i}" title="${esc(f.name)}" aria-label="Offer ${esc(f.name)}">${f.icon}<b>${f.n}</b>${known[f.id] ? `<i>${mark[known[f.id]]}</i>` : ""}</button>`).join("");
    tray.onclick = (e) => {
      const b = e.target.closest(".treat"); if (!b) return;
      e.stopPropagation();
      feed(a, list[+b.dataset.i], line, b);
      // Capture the food's position for delivery, then clear the view this frame.
      closeBubble();
    };
    positionBubble();
    tray.querySelector('.treat')?.focus({ preventScroll: true });
  }

  const animalActionIcons = {
    pet: `<svg viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <g fill="#c6afe9">
        <ellipse cx="7.5" cy="17" rx="4.4" ry="5.5" transform="rotate(-25 7.5 17)"/>
        <ellipse cx="15" cy="9" rx="4.4" ry="5.5" transform="rotate(-12 15 9)"/>
        <ellipse cx="25" cy="9" rx="4.4" ry="5.5" transform="rotate(12 25 9)"/>
        <ellipse cx="32.5" cy="17" rx="4.4" ry="5.5" transform="rotate(25 32.5 17)"/>
        <path d="M20 18c-4 0-5.5 4.8-8.5 7.8-2.7 2.7-4.4 5.4-2.7 8C10.5 37 15 35 20 35s9.5 2 11.2-1.2c1.7-2.6 0-5.3-2.7-8C25.5 22.8 24 18 20 18Z"/>
      </g>
    </svg>`,
    feed: `<svg viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 15V9" stroke="#bd9a75" stroke-width="1.4"/>
      <path d="M20 12c0-5 5-7 10-5-1 5-6 7-10 5Z" fill="#9ecb83"/>
      <path d="M20 15c-6-5-14-1-14 7 0 7 5 13 10 13 2 0 3-1 4-1s2 1 4 1c5 0 10-6 10-13 0-8-8-12-14-7Z" fill="#e76158"/>
    </svg>`,
    heart: `<svg viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="animal-heart-shape" d="M20 35S5 26 5 15C5 6 14 5 20 12 26 5 35 6 35 15c0 11-15 20-15 20Z" fill="none" stroke="#e75860" stroke-width="2.3"/>
    </svg>`
  };
  function openAnimal(a, focus = false) {
    const d = a.def, hearts = store.get("farm-hearts", {}), key = d.species + ":" + d.name;
    const liked = !!store.get('farm-liked', {})[key];
    const line = document.getElementById('farmFeedback');
    const el = showBubble(`
      <button class="animal-action" type="button" data-pet title="Pet" aria-label="Pet ${esc(d.name)}">${animalActionIcons.pet}</button>
      <button class="animal-action" type="button" data-feed title="Feed" aria-label="Feed ${esc(d.name)}">${animalActionIcons.feed}</button>
      <button class="animal-action" type="button" data-heart data-liked="${liked}" title="${liked ? 'Liked' : 'Like'} · ${hearts[key] || 0} hearts" aria-label="${liked ? 'Send more love to' : 'Like'} ${esc(d.name)}, ${hearts[key] || 0} hearts">${animalActionIcons.heart}</button>`, a.el, a, 'animal-actions');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', `Actions for ${d.name}`);
    el.querySelector("[data-feed]").onclick = () => {
      if (a.feeding) { line.textContent = `${d.name} is still enjoying that bite…`; return; }
      openTray(a);
    };
    el.querySelector("[data-heart]").onclick = (e) => {
      const current = store.get('farm-hearts', {});
      current[key] = (current[key] || 0) + 1; store.set("farm-hearts", current);
      const likes = store.get('farm-liked', {}); likes[key] = true; store.set('farm-liked', likes);
      e.currentTarget.dataset.liked = 'true';
      e.currentTarget.title = `Liked · ${current[key]} hearts`;
      e.currentTarget.setAttribute('aria-label', `Send more love to ${d.name}, ${current[key]} hearts`);
      line.textContent = `A little love for ${d.name}. ${current[key]} hearts.`;
      emote(a, "♥");
      fxAt(a.el, "heart");
    };
    el.querySelector("[data-pet]").onclick = () => {
      if(a.feeding){line.textContent=`Let ${a.def.name} finish that bite first…`;return;}
      const choices=petActions[d.species],act=choices[(a.petAction||0)%choices.length];
      a.petAction=(a.petAction||0)+1;
      react(a,act,{duration:2600});
      line.textContent=`${d.name} ${actionText[act]||({knead:'stretches and kneads with soft paws',binky:'makes a happy little bunny hop',pounce:'crouches, then springs up',curl:'tucks in, then peeks out','pet-nuzzle':'leans into your hand','pet-stretch':'takes a long, contented stretch'}[act]||'looks very happy')}.`;
      emote(a, a.keeper ? 'purr…' : ['♪', '♥', '✿'][(Math.random() * 3) | 0]);
    };
    if (focus) el.querySelector('[data-pet]').focus({ preventScroll: true });
  }

  /* ================= orchard ================= */
  const LOOKS = { bare: "resting through winter", bloom: "in blossom", green: "in full leaf", autumn: "turning gold" };
  const MAX_TREES = 8;
  let trees = [], sharedReady = false, sharedSync = null;
  const personalPicked = store.get("farm-picked", {});
  function renderOrchardCount() {
    const count = document.getElementById("orchardCount");
    if (count) count.textContent = sharedReady ? `${trees.length} of ${MAX_TREES} shared spaces used` : "Connecting to the shared orchard…";
  }
  // Only this visitor's harvest is local. Tree positions and growth come from
  // the server, so an older browser can never overwrite another visitor's tree.
  const saveTrees = () => {
    trees.forEach(t => { personalPicked[t.id] = t.picked; });
    renderOrchardCount();
    return store.set("farm-picked", personalPicked);
  };
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
    t.el.style.setProperty('--tree-flex', (.7 + (t.seed % 7) * .07).toFixed(2));
    const out = treeSVG({ type: t.type, seed: t.seed, variant:t.variant, stage: isSapling(t) ? "sapling" : "mature", season: season.name, picked: pickedNow(t), live: !!window.OrchardSim });
    if (!isSapling(t) && window.OrchardSim) {
      // a living tree: painted base + simulated blossoms, fruit, leaves and snow
      if (!t.sim) { t.el.innerHTML = OrchardSim.markup(); t.sim = OrchardSim.attach(t, t.el,()=>renderTree(t)); t.art = "living"; t.url = null; }
    } else if (t.art !== out.art) {
      if (t.sim) { OrchardSim.detach(t); t.sim = null; }                       // re-rasterise only when the tree itself changes
      t.art = out.art;
      if (t.url && t.url.startsWith("blob:")) URL.revokeObjectURL(t.url);
      t.url = out.src || URL.createObjectURL(new Blob([out.art], { type: "image/svg+xml" }));
      t.el.innerHTML = `<div class="tree-inner"><img class="tree-img" src="${t.url}" alt="" draggable="false"><div class="fruit-layer"></div></div>`;
    }
    t.el.querySelector(".fruit-layer").innerHTML = out.fruits;
    const ripe = out.ripe;
    t.el.classList.toggle("ripe", ripe > 0);
    t.el.setAttribute("aria-label", `${T.label} ${T.vine?'vine':'tree'}, ${isSapling(t) ? "a young sapling" : LOOKS[PHENO[t.type][season.name].fol]}${ripe ? `, ${ripe} ripe fruit` : ""}`);
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
      <span class="sp">${esc(T.label)} ${T.vine?'vine':'tree'}</span>
      <h4>${sap ? "A young sapling" : cap(LOOKS[ph.fol])}</h4>
      <p>${line}</p>
      <div class="bubble-actions">
        ${sap ? `<button class="btn sm" type="button" data-water>${ICON.drop} Water</button>` : ""}
        ${t.canRemove ? `<button class="btn sm" type="button" data-dig>Dig up</button>` : ""}
      </div>
      ${t.canRemove ? "" : `<p class="muted">A shared tree. Its planter or the keeper can make room for a new one.</p>`}`, t.el, null);
    const w = el.querySelector("[data-water]");
    if (w) w.onclick = async () => {
      w.disabled = true;
      try {
        await Cloud.water(t.id); water(t); closeBubble();
        try { await refreshShared(true); toast("Watered. Everyone can see this tree grow."); }
        catch (_) { toast("Watering is saved. Refresh the farm to see the latest orchard.", 5000); }
      } catch (error) { toast(error.message); w.disabled = false; }
    };
    const dig = el.querySelector("[data-dig]");
    if (dig) dig.onclick = async () => {
      dig.disabled = true;
      try {
        await Cloud.remove(t.id); closeBubble();
        try { await refreshShared(true); toast("The tree returns to the soil. Its shared space is free again."); }
        catch (_) { toast("The tree was removed. Refresh the farm to see the latest orchard.", 5000); }
      }
      catch (error) { toast(error.message); dig.disabled = false; }
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
    const sum = (bag) => Object.entries(bag || {}).filter(([id]) => FOOD[id]).reduce((n, [, v]) => n + v, 0);
    const wn = sum(store.get("wild-woods", {}).basket), pn = sum(store.get("wild-pond", {}).creel);
    if (wn) parts.push(`<a class="fi wild-count" href="woods.html" title="Finds from the woods">🍄${wn}</a>`);
    if (pn) parts.push(`<a class="fi wild-count" href="pond.html" title="Catch from the pond">🐟${pn}</a>`);
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
    fxAt(el, "fruit", "+1");
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
      fr.forEach((f, k) => { flyFruit(t.type, f, k * 60); if (k < 5) fxAt(f, "fruit"); });
      fxAt(fr[0], "fruit", "+" + fr.length);
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

  /* ---------- one shared orchard, with approved residents ---------- */
  function sharedMessage(message, failed = false) {
    const el = document.getElementById("farmSharedStatus");
    el.textContent = message; el.classList.toggle("unavailable", failed);
  }
  function applySharedFarm(snapshot) {
    const present = new Set(snapshot.trees.map(t => t.id));
    trees.filter(t => !present.has(t.id)).forEach(t => {
      if (bubble?.anchor === t.el) closeBubble();
      if (window.OrchardSim) OrchardSim.detach(t);
      t.el?.remove(); delete personalPicked[t.id];
    });
    const previous = new Map(trees.map(t => [t.id, t]));
    trees = snapshot.trees.map(record => {
      let t = previous.get(record.id);
      const changed = !t || ["type", "slot", "seed", "variant", "plantedAbs", "water"].some(key => t[key] !== record[key]);
      if (!t) {
        const picked = personalPicked[record.id];
        t = { picked: picked && Number.isInteger(picked.abs) && Array.isArray(picked.list) ? picked : { abs: -1, list: [] } };
      }
      Object.assign(t, record);
      if (changed) { if (bubble?.anchor === t.el) closeBubble(); renderTree(t); }
      return t;
    });
    const residentIds = new Set(snapshot.residents.map(r => r.id));
    animals.filter(a => a.sharedId && !residentIds.has(a.sharedId)).forEach(a => {
      if (bubble?.anchor === a.el) closeBubble();
      a.el.remove(); animals.splice(animals.indexOf(a), 1);
    });
    snapshot.residents.forEach(def => {
      if (animals.some(a => a.sharedId === def.id)) return;
      const a = addAnimal(def); if (a) a.sharedId = def.id;
    });
    document.getElementById("residentCount").textContent = animals.length + " little lives";
    sharedReady = true; renderOrchardCount();
    sharedMessage("A shared orchard · changes appear for everyone. Animal requests join after the keeper approves them.");
  }
  function refreshShared(afterMutation = false) {
    if (!(Cloud && Cloud.enabled)) return Promise.reject(new Error("The shared farm is not connected."));
    if (sharedSync) return afterMutation
      ? sharedSync.catch(() => {}).then(() => refreshShared(true))
      : sharedSync;
    sharedSync = Cloud.load().then(applySharedFarm).catch(error => {
      sharedMessage(sharedReady ? "The farm could not refresh. Your saved trees are still on the server. Try again shortly." : error.message, true);
      throw error;
    }).finally(() => { sharedSync = null; });
    return sharedSync;
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
    if(window.MeadowProps)MeadowProps.mount(actorsEl,season.name);
    document.body.dataset.farmSeason = season.name;
    setWeather(season.name);
    trees.forEach(renderTree);
    renderChip();
    if (announce) {
      const words = { spring: "Spring has come — the orchard is in blossom.", summer: "Summer — cherries, peaches, mangoes and durians ripen.", autumn: "Autumn — apples, kiwis and grapes ripen.", winter: "Winter — snow on the branches, oranges glowing." };
      toast(`${ICONS[season.name]} ${words[season.name]}`, 4200);
    }
  }

  /* ================= modals ================= */
  const speciesGrid = (exclude) => Object.entries(SPECIES).filter(([k]) => k !== exclude)
    .map(([k, s], i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-sp="${k}" class="${i === 0 ? "active" : ""}">${ART[k]()}<span>${esc(s.label)}</span></button>`).join("");

  function adoptModal() {
    modal(`
      <h2>Adopt an Animal</h2>
      <p class="muted">Choose a friend for our shared farm. The keeper reads every request; once approved, it lives here for everyone to see.</p>
      <form id="adoptForm" novalidate>
        <div class="species-grid" role="radiogroup" aria-label="Species">${speciesGrid("snowcat")}</div>
        <label class="label" for="aName">Its name</label>
        <input class="input" id="aName" maxlength="24" placeholder="e.g. Comet" required>
        <label class="label" for="aBy">Your name</label>
        <input class="input" id="aBy" maxlength="40" placeholder="optional">
        <label class="label" for="aNote">A few words about it</label>
        <input class="input" id="aNote" maxlength="140" placeholder="What does it love?">
        <div class="modal-actions"><button class="btn primary" type="submit">Send request</button></div>
        <p class="muted" id="aStatus" role="status"></p>
      </form>`, {
      onOpen(m) {
        const form = m.card.querySelector("form");
        if (window.Backend) Backend.guard(form);
        let submitting = false;
        let sp = m.card.querySelector(".species-grid button").dataset.sp;
        m.card.querySelector(".species-grid").addEventListener("click", (e) => {
          const b = e.target.closest("button"); if (!b) return;
          sp = b.dataset.sp;
          m.card.querySelectorAll(".species-grid button").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-checked", x === b ? "true" : "false"); });
        });
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (submitting) return;
          const name = form.querySelector("#aName").value.trim(), by = form.querySelector("#aBy").value.trim(), note = form.querySelector("#aNote").value.trim();
          const status = form.querySelector("#aStatus");
          if (!name) { status.textContent = "Every friend needs a name."; return; }
          const problem = window.Backend ? Backend.check(form, "adopt", 30) : "";
          if (problem) { status.textContent = problem; return; }
          if (!(Cloud && Cloud.enabled)) { status.textContent = "The shared farm is not connected. Please try again later."; return; }
          submitting = true;
          const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
          status.textContent = "Sending…";
          try {
            await Cloud.adopt({ species: sp, name, adoptedBy: by || "a visitor", note, website: form.querySelector('[name="website"]')?.value || "" });
            if (window.Backend) Backend.stamp("adopt");
            m.close(); toast(`${name}'s request is saved. The keeper will review it before it joins the shared farm.`, 5000);
          } catch (error) { status.textContent = error.message; submitting = false; submit.disabled = false; }
        });
      }
    });
  }

  function plantModal() {
    if (!sharedReady) { toast("The shared orchard is still connecting. Please refresh the farm and try again."); return; }
    if (trees.length >= MAX_TREES) { toast(`The shared orchard holds ${MAX_TREES} trees or vines. Remove one you planted, or ask the keeper to make room.`); return; }
    let planting = false;
    const preview = (k) => treeInline({ type: k, seed: 5, stage: "mature", season: TREES[k].ripe, picked: [] });
    modal(`
      <h2>Plant a Tree</h2>
      <p class="muted">${trees.length} of ${MAX_TREES} shared spaces used. Your tree will be visible to every visitor.</p>
      <p class="muted">Choose a fruit tree or climbing vine. Each planting grows into one of three unique shapes. Summer brings cherries, peaches, mangoes and durians; autumn brings apples, kiwis and grapes; oranges ripen in winter. Saplings grow after a season or three waterings.</p>
      <div class="species-grid tree-grid">${Object.entries(TREES).map(([k, T]) => `<button type="button" data-tree="${k}">${preview(k)}<span>${T.label}<br><small>${T.vine?'Climbing vine · ':''}ripe in ${T.ripe}</small></span></button>`).join("")}</div>`, {
      onOpen(m) {
        const feedback = document.createElement("p"); feedback.className = "muted"; feedback.setAttribute("role", "status"); m.card.appendChild(feedback);
        m.card.querySelector(".tree-grid").addEventListener("click", async (e) => {
          const b = e.target.closest("button"); if (!b) return;
          if (planting || !Object.hasOwn(TREES, b.dataset.tree)) return;
          planting = true; feedback.textContent = "Planting in the shared orchard…";
          m.card.querySelectorAll("[data-tree]").forEach(button => { button.disabled = true; });
          try {
            await Cloud.plant(b.dataset.tree); m.close();
            try { await refreshShared(true); toast("Your tree is saved in the shared orchard. Every visitor can see it.", 4000); }
            catch (_) { toast("Your tree is saved. Refresh the farm to see the latest orchard.", 5000); }
          } catch (error) {
            feedback.textContent = error.message; planting = false;
            m.card.querySelectorAll("[data-tree]").forEach(button => { button.disabled = false; });
            refreshShared().catch(() => {});
          }
        });
      }
    });
  }

  function rosterModal() {
    const list = animals.map((a, i) => `<li><button type="button" data-i="${i}">${ART[a.def.species]()}<span><b>${esc(a.def.name)}</b><small>${esc(a.sp.label)}${a.keeper ? " · keeper" : a.def.adoptedBy ? " · adopted by " + esc(a.def.adoptedBy) : ""}</small>${a.keeper && a.def.title ? `<small>${esc(a.def.title)}</small>` : ""}${a.def.note ? `<small class="resident-note">${esc(a.def.note)}</small>` : ""}</span>${a.pending ? `<span class="st">pending</span>` : ""}</button></li>`).join("");
    modal(`<h2>Farm Residents</h2><p class="muted">${animals.length} lovely lives on our shared farm.</p><ul class="roster">${list}</ul>`, {
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

  /* ================= ways out: the woods and the pond ================= */
  // the forest belt behind the fence, traced over the painting (percent of the world)
  const WOODS = [
    [[0, 12], [10, 10], [19, 15], [22, 28], [21, 46], [0, 47]],
    [[36, 31], [40, 22], [46, 23], [50, 31], [57, 36], [57, 47], [37, 48]],
    [[57, 45], [66, 41], [76, 44], [88, 43], [90, 53], [57, 52]],
    [[87, 14], [100, 9], [100, 52], [90, 53], [86, 40]]
  ];
  const WATER = { cx: 64.5, cy: 79, rx: 21.5, ry: 7.2 };
  const WAYS = {
    woods: { url: "woods.html", label: "Into the woods", at: [12, 32], c: "#040a07" },
    pond: { url: "pond.html", label: "Go fishing", at: [64.5, 79], c: "#030812" }
  };
  const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const zoneAt = (x, y) => (((x - WATER.cx) / WATER.rx) ** 2 + ((y - WATER.cy) / WATER.ry) ** 2 < 1 ? "pond" : WOODS.some((p) => inPoly(x, y, p)) ? "woods" : null);
  const zoneTip = document.createElement("div");
  zoneTip.className = "farm-zone-tip"; zoneTip.setAttribute("aria-hidden", "true");
  const pct = (e) => { const r = world.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]; };
  const busyTarget = (e) => e.target.closest(".actor, .tree, .bubble, .farm-sign");
  world.addEventListener("mousemove", (e) => {
    const z = busyTarget(e) ? null : zoneAt(...pct(e));
    viewport.classList.toggle("zone-hover", !!z);
    if (!z) { zoneTip.classList.remove("on"); return; }
    const [x, y] = pct(e);
    zoneTip.textContent = `${WAYS[z].label} →`;
    zoneTip.style.left = x + "%"; zoneTip.style.top = y + "%";
    zoneTip.classList.add("on");
  });
  world.addEventListener("mouseleave", () => { zoneTip.classList.remove("on"); viewport.classList.remove("zone-hover"); });
  world.addEventListener("click", (e) => { if (busyTarget(e)) return; const [x, y] = pct(e), z = zoneAt(x, y); if (z) goWild(z, x, y); });

  // two wooden signposts, so the ways out are easy to find
  function signpost(kind) {
    const left = kind === "woods", tx = left ? 79 : 61, id = `sign-${kind}`;
    // Burned lettering follows the timber's grain; a sunlit lower chisel edge
    // gives it depth without a bright outline floating over the board.
    const letters = `<text x="${tx}" y="41" font-size="15.5" font-weight="600">${left ? "The woods" : "Fishing"}</text>
      <text x="${tx}" y="55.5" font-size="10.2" font-weight="500" letter-spacing=".35">${left ? "Gather" : "Cast a line"}</text>`;
    return `<svg viewBox="0 0 140 146" aria-hidden="true">
      <defs>
        <filter id="${id}-chisel" x="-5%" y="-8%" width="110%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency=".055 .48" numOctaves="2" seed="7" result="grain"/>
          <feDisplacementMap in="SourceGraphic" in2="grain" scale=".32" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <mask id="${id}-wear"><rect width="140" height="72" fill="white"/>
          <path d="M24 34.8 Q62 34.1 112 35.2 M20 44.9 Q76 45.5 116 44.8 M26 51.1 L111 51.7 M36 56.2 L109 56.5" fill="none" stroke="black" stroke-width=".5" opacity=".22"/>
        </mask>
      </defs>
      <ellipse cx="${left ? 82 : 58}" cy="143" rx="22" ry="3" fill="#111a14" opacity=".28"/>
      <image href="assets/wild/equipment/farm-sign-v1.webp" width="140" height="146" ${left ? '' : 'transform="translate(140 0) scale(-1 1)"'}/>
      <g font-family="Georgia, Noto Serif SC, serif" text-anchor="middle" filter="url(#${id}-chisel)" mask="url(#${id}-wear)">
        <g fill="#dfbd82" opacity=".52" transform="translate(.22 .52)">${letters}</g>
        <g fill="#302117" opacity=".9">${letters}</g>
      </g>
      <path class="snowcap" d="M${left ? 25 : 5} 25 Q45 21 68 24 T${left ? 137 : 115} 24 L${left ? 136 : 115} 28 Q100 26 74 28 T${left ? 22 : 5} 29 Z" fill="#edf2f7" opacity=".92"/>
    </svg>`;
  }
  const SIGNS = { woods: [24, 57.5], pond: [61, 97] };
  function placeSigns() {
    Object.entries(SIGNS).forEach(([kind, [x, y]]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "farm-sign " + (kind === "pond" ? "pondway" : "woodsway");
      b.style.left = x + "%"; b.style.top = y + "%"; b.style.zIndex = Math.round(y * 10);
      b.setAttribute("aria-label", WAYS[kind].label);
      b.innerHTML = signpost(kind);
      b.addEventListener("click", (e) => { e.stopPropagation(); goWild(kind, x, y - 4); });
      actorsEl.appendChild(b);
    });
  }

  let leaving = false;
  function portal(kind, cx, cy, dir) {
    const ov = document.createElement("div");
    ov.className = "farm-portal"; ov.style.setProperty("--c", WAYS[kind].c);
    document.body.appendChild(ov);
    const far = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) + 120, feather = 90;
    const dur = dir === "in" ? 1000 : 1250, t0 = performance.now(), c = WAYS[kind].c;
    const ease = dir === "in" ? (t) => t * t * t : (t) => 1 - Math.pow(1 - t, 3);
    (function iris(now) {
      const t = Math.min(1, (now - t0) / dur), e = ease(t), r = Math.max(0, (dir === "in" ? 1 - e : e) * far);
      ov.style.background = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${Math.max(0, r - feather)}px, ${c} ${r}px)`;
      if (t < 1 && ov.isConnected) requestAnimationFrame(iris);
    })(t0);
    const M = Math.max(innerWidth, innerHeight);
    if (kind === "woods") {
      const cols = { spring: ["#7aa65a", "#f2b8c8", "#a8c87a"], summer: ["#3f7a3a", "#5c9a4a", "#2c5a2c"], autumn: ["#d98a2a", "#b5482a", "#e6b23a"], winter: ["#e8eef6", "#cfd9ea", "#ffffff"] }[season.name];
      for (let i = 0; i < 30; i++) {
        const l = document.createElement("i"); l.className = "leaf"; l.style.setProperty("--leaf", cols[i % 3]); ov.appendChild(l);
        const a = Math.random() * Math.PI * 2, d = M * (0.6 + Math.random() * 0.6), spin = (Math.random() - 0.5) * 900;
        const near = `translate(${cx}px, ${cy}px) rotate(0deg) scale(.15)`, far = `translate(${cx + Math.cos(a) * d}px, ${cy + Math.sin(a) * d}px) rotate(${spin}deg) scale(${2 + Math.random() * 3})`;
        l.animate(dir === "in" ? [{ transform: near, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: far, opacity: 0.9 }] : [{ transform: far, opacity: 0.9 }, { opacity: 1, offset: 0.75 }, { transform: near, opacity: 0 }],
          { duration: 850 + Math.random() * 450, delay: Math.random() * 280, easing: dir === "in" ? "cubic-bezier(.5,0,.75,.4)" : "cubic-bezier(.2,.6,.4,1)", fill: "both" });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const r = document.createElement("i"); r.className = "ring"; ov.appendChild(r);
        const sz = M * 1.4; r.style.width = r.style.height = sz + "px"; r.style.left = cx - sz / 2 + "px"; r.style.top = cy - sz / 2 + "px";
        r.animate([{ transform: "scale(.02, .007)", opacity: 0.95 }, { transform: "scale(1, .36)", opacity: 0 }], { duration: 1300, delay: i * 170, easing: "cubic-bezier(.2,.6,.4,1)", fill: "both" });
      }
    }
    if (dir === "out") setTimeout(() => ov.remove(), 1500);
  }
  function goWild(kind, xp, yp) {
    if (leaving) return;
    leaving = true;
    closeBubble(); zoneTip.classList.remove("on");
    sessionStorage.setItem("wild-arrive", kind);
    sessionStorage.setItem("farm-zone", JSON.stringify({ kind, x: xp, y: yp }));
    const url = WAYS[kind].url + (forced ? "?season=" + forced : "");
    if (reduce) { location.href = url; return; }
    let r = world.getBoundingClientRect();
    const px = (xp / 100) * r.width;
    if (px < viewport.scrollLeft || px > viewport.scrollLeft + viewport.clientWidth) { viewport.scrollLeft = px - viewport.clientWidth / 2; r = world.getBoundingClientRect(); }
    const wx = r.left + px, wy = r.top + (yp / 100) * r.height;
    world.style.transformOrigin = `${xp}% ${yp}%`;
    world.classList.add("portal-in");
    portal(kind, Math.max(0, Math.min(innerWidth, wx)), Math.max(0, Math.min(innerHeight, wy)), "in");
    setTimeout(() => { location.href = url; }, 1050);
  }
  function comeBack() {
    const kind = sessionStorage.getItem("farm-return");
    sessionStorage.removeItem("farm-return");
    document.querySelectorAll(".farm-portal").forEach((o) => o.remove());
    world.classList.remove("portal-in", "portal-from", "portal-back");
    leaving = false;
    if (!WAYS[kind] || reduce) return;
    let z = {}; try { z = JSON.parse(sessionStorage.getItem("farm-zone") || "{}"); } catch (e) {}
    const [xp, yp] = z.kind === kind ? [z.x, z.y] : WAYS[kind].at;
    viewport.scrollLeft = Math.max(0, (world.offsetWidth * xp) / 100 - viewport.clientWidth / 2);
    const r = world.getBoundingClientRect(), wx = r.left + (xp / 100) * r.width, wy = r.top + (yp / 100) * r.height;
    world.style.transformOrigin = `${xp}% ${yp}%`;
    world.classList.add("portal-from");
    void world.offsetWidth;
    world.classList.add("portal-back"); world.classList.remove("portal-from");
    setTimeout(() => world.classList.remove("portal-back"), 1600);
    portal(kind, Math.max(0, Math.min(innerWidth, wx)), Math.max(0, Math.min(innerHeight, wy)), "out");
  }
  addEventListener("pageshow", (e) => { if (e.persisted) comeBack(); });

  /* ================= start ================= */
  document.body.insertAdjacentHTML("afterbegin", defs());
  world.insertAdjacentHTML("afterbegin", background());
  world.appendChild(zoneTip);
  placeSigns();
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
  if (window.FarmFX) FarmFX.init(world);
  preloadWalks();
  if (FARM.keeper) addAnimal(FARM.keeper, { keeper: true });
  (FARM.residents || []).forEach((d) => addAnimal(d));
  document.getElementById("residentCount").textContent = animals.length + " little lives";
  document.getElementById("meetKeeper").onclick = () => {
    const keeper = animals.find(a => a.keeper); if (!keeper) return;
    viewport.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    viewport.scrollTo({left: keeper.el.offsetLeft - viewport.clientWidth / 2, behavior: reduce ? "auto" : "smooth"});
    setTimeout(() => openAnimal(keeper), reduce ? 0 : 400);
  };
  applySeason(false);
  saveTrees();
  renderBasket();
  renderOrchardCount();
  document.getElementById("btnFarmRefresh").onclick = async (event) => {
    const button = event.currentTarget; button.disabled = true;
    try { await refreshShared(); } catch (_) {} finally { button.disabled = false; }
  };
  if (Cloud?.enabled) {
    Cloud.watch(applySharedFarm, error => sharedMessage(error.message, true));
    addEventListener("pageshow", event => { if (event.persisted) refreshShared().catch(() => {}); });
  } else sharedMessage("The shared farm is not connected yet.", true);

  const act = (id, fn) => { document.getElementById(id).onclick = () => { closeBubble(); fn(); }; };
  act("btnAdopt", adoptModal);
  act("btnPlant", plantModal);
  act("btnHarvest", harvestAll);
  act("btnAnimals", rosterModal);
  act("btnWoods", () => goWild("woods", ...WAYS.woods.at));
  act("btnPond", () => goWild("pond", ...WAYS.pond.at));
  addEventListener("skycalm", () => setWeather(season.name));

  // start the view where the keeper and the orchard are
  requestAnimationFrame(() => { viewport.scrollLeft = Math.max(0, world.offsetWidth * ROCK.x / 100 - viewport.clientWidth * .32); comeBack(); });

  // One shared breeze moves weather, tree crowns and foreground grass.
  function breeze(t) { return Math.sin(t * .38) * .65 + Math.sin(t * .91 + 1.4) * .22; }
  let last = performance.now(), tick = 0, time = 0, windTick = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.max(0, now - last), dt = Math.min(0.1, elapsed / 1000); last = now;
    if (document.hidden) {
      animals.forEach(a => { if(a.hop) a.hop.start += elapsed; });
      return;
    }
    time += dt;
    const calm = reduce || (window.Sky && Sky.calm);
    document.body.classList.toggle("farm-calm", !!calm);
    document.body.classList.toggle('farm-reduced-motion',reduce);
    if (!calm) animals.forEach((a) => stepAnimal(a, dt, now));
    else animals.forEach(a => { if(a.hop) a.hop.start += elapsed; });
    animals.forEach(a=>{
      if(a.reaction&&['happy-hop','binky','pounce'].includes(a.reaction.kind)){
        a.jumpPhase=Math.min(1,Math.max(0,(now-a.reaction.start)/a.reaction.duration));place(a);
      }
      if(window.AnimalReactions)AnimalReactions.draw(a,now,reduce);
    });
    windTick += dt;
    if (windTick > .12) {
      windTick = 0;
      world.style.setProperty('--tree-bend', (calm ? 0 : breeze(time) * .65) + 'deg');
      world.style.setProperty('--grass-bend', (calm ? 0 : breeze(time) * 5) + 'deg');
    }
    positionBubble();
    drawWeather(calm ? 0 : dt, calm ? 0 : time);
    const gust = window.FarmFX ? FarmFX.wind : 0;
    if (window.OrchardSim) OrchardSim.update(dt, time, season, clock().p, calm, breeze(time) * 1.4 + gust * 14);
    if (window.FarmFX) FarmFX.update(dt, time, {
      season: season.name, calm,
      animals: animals.map((a) => ({ id: a.def.species + ":" + a.def.name, x: a.x, y: a.y, dir: a.dir, walking: a.state === "walk", size: a.sp.size * depth(a.y) }))
    });
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
