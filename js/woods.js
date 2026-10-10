/* =====================================================================
   Into the Woods — foraging beyond the farm fence.
   One canvas, painted in layers: a static backdrop (sky, mountains, three
   rows of forest, the floor, the bayberry tree, the bamboo grove, the log),
   a static foreground frame (big trunks, overhanging boughs, ferns), and
   between them everything that moves or can be picked.
   What grows follows the farm's season clock:
     spring  wild strawberries, bamboo shoots, morels, shiitake
     summer  wild bayberries (杨梅) on the tree, chanterelles, porcini
     autumn  matsutake, porcini, shiitake, pine cones, rose hips
     winter  winter bamboo shoots under the snow, pine cones, rose hips
   The fly agaric is lovely and poisonous: you can only admire it.
   ===================================================================== */
(function () {
  const Wd = window.Wild, { esc, toast } = window.Site;
  const { rng, lerp, clamp, smooth, glow, mix } = Wd;
  const stage = document.getElementById("stage"), cv = document.getElementById("scene"), ctx = cv.getContext("2d");
  const tip = document.getElementById("tip"), basketEl = document.getElementById("basket"), hint = document.getElementById("hint");
  const TAU = Math.PI * 2;

  /* ================= what can be found ================= */
  const ITEMS = [
    { id: "bayberry", name: "Wild bayberry", rarity: 1, seasons: ["summer"], text: "Dark red, bumpy and sweet-sour. It ripens in the plum-rain weeks of early summer.", hint: "Look up into the evergreen tree in summer." },
    { id: "strawberry", name: "Wild strawberry", rarity: 1, seasons: ["spring"], text: "Tiny and fierce with flavour, hiding under three-fingered leaves.", hint: "Low in the grass, in spring." },
    { id: "shoot", name: "Bamboo shoot", rarity: 1, seasons: ["spring", "winter"], text: "After a spring rain they push up overnight; in winter they wait, sweet, beneath the snow.", hint: "At the foot of the bamboo, spring or winter." },
    { id: "morel", name: "Morel", rarity: 3, seasons: ["spring"], text: "A honeycomb cap that appears for a few weeks of spring, then is gone.", hint: "Rare, in spring." },
    { id: "chanterelle", name: "Chanterelle", rarity: 2, seasons: ["summer", "autumn"], text: "Golden trumpets that smell faintly of apricots.", hint: "Summer and autumn, in the moss." },
    { id: "porcini", name: "Porcini", rarity: 2, seasons: ["summer", "autumn"], text: "A fat stem and a glossy brown cap — the king of the forest floor.", hint: "Summer and autumn." },
    { id: "shiitake", name: "Shiitake", rarity: 1, seasons: ["spring", "autumn"], text: "They grow in shelves on fallen oak, cracked like old porcelain.", hint: "On the fallen log, spring and autumn." },
    { id: "matsutake", name: "Matsutake", rarity: 4, seasons: ["autumn"], text: "Half hidden under pine needles; one of the most prized mushrooms in the world.", hint: "Very rare, under the pines in autumn." },
    { id: "pinecone", name: "Pine cone", rarity: 1, seasons: ["autumn", "winter"], text: "For the fire, for the squirrels, for a windowsill.", hint: "Under the pines, autumn and winter." },
    { id: "rosehip", name: "Rose hip", rarity: 1, seasons: ["autumn", "winter"], text: "The wild rose's winter fruit: tart, bright, full of vitamin C.", hint: "On the wild rose, autumn and winter." },
    { id: "amanita", name: "Fly agaric", rarity: 2, poison: true, seasons: ["summer", "autumn"], text: "The fairy-tale toadstool — and poisonous. Admire it, leave it for the fairies.", hint: "Red with white spots. Look, don't pick." }
  ];
  const BY = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
  const SPAWN = {
    spring: [["strawberry", 3], ["shoot", 3], ["morel", 0.7], ["shiitake", 2]],
    summer: [["chanterelle", 3], ["porcini", 2.2], ["amanita", 1.2]],
    autumn: [["porcini", 2], ["chanterelle", 1.2], ["shiitake", 2], ["matsutake", 0.6], ["amanita", 1], ["pinecone", 2.4]],
    winter: [["shoot", 2.6], ["pinecone", 3]]
  };
  // each species keeps to its own kind of ground
  const WHERE = { strawberry: "open", shoot: "grove", shiitake: "log", morel: "log", matsutake: "pine", pinecone: "pine", porcini: "pine", chanterelle: "moss", amanita: "moss" };
  const GROW = { strawberry: 30, shoot: 24, morel: 46, chanterelle: 28, porcini: 34, shiitake: 26, matsutake: 52, pinecone: 2, amanita: 30 };   // seconds to grow up
  const MUSH = { porcini: ["#8a5430", "#efe4cc"], chanterelle: ["#e8a33a", "#f2c46a"], amanita: ["#f4eee4", "#ffffff"], shiitake: ["#6a4228", "#e8dcc4"], matsutake: ["#8a5a34", "#f2ead8"], morel: ["#b8925a", "#efe2c4"] };
  // rocks to roll aside and tufts to part; in winter the tufts are snow, and in autumn the pines drop needle piles
  const COVERS = [
    { u: 0.6, v: 0.972, kind: "rock", w: 72, h: 32, hab: "moss" },
    { u: 0.37, v: 0.966, kind: "rock", w: 50, h: 24, hab: "open" },
    { u: 0.81, v: 0.952, kind: "rock", w: 58, h: 26, hab: "pine" },
    { u: 0.265, v: 0.878, kind: "grass", w: 66, h: 46, hab: "open" },
    { u: 0.715, v: 0.862, kind: "grass", w: 60, h: 42, hab: "moss" },
    { u: 0.485, v: 0.935, kind: "grass", w: 60, h: 44, hab: "open" },
    { u: 0.905, v: 0.842, kind: "grass", w: 58, h: 40, hab: "pine" },
    { u: 0.205, v: 0.742, kind: "grass", w: 54, h: 38, hab: "grove" },
    { u: 0.585, v: 0.684, kind: "leaves", w: 56, h: 18, hab: "pine", only: "autumn" },
    { u: 0.845, v: 0.703, kind: "leaves", w: 60, h: 20, hab: "pine", only: "autumn" }
  ];
  const SPOTS = {
    moss: [[0.36, 0.73], [0.26, 0.76], [0.63, 0.7], [0.79, 0.81], [0.67, 0.89], [0.9, 0.9], [0.29, 0.95], [0.77, 0.73], [0.44, 0.71], [0.55, 0.82]],
    log: [[0.315, 0.818], [0.355, 0.806], [0.395, 0.794], [0.435, 0.782]],
    grove: [[0.09, 0.735], [0.135, 0.75], [0.18, 0.725], [0.225, 0.71]],
    pine: [[0.585, 0.67], [0.845, 0.69], [0.93, 0.75], [0.405, 0.675], [0.74, 0.67]],
    open: [[0.4, 0.9], [0.585, 0.94], [0.685, 0.79], [0.24, 0.87], [0.86, 0.86], [0.49, 0.78]]
  };

  /* ================= saved state ================= */
  const save = Wd.store.get("wild-woods", { basket: {}, seen: {} });
  const persist = () => Wd.store.set("wild-woods", save);

  /* ================= scene state ================= */
  let W = 0, H = 0, k = 1, dpr = 1, season = Wd.season(), time = 0;
  const bg = document.createElement("canvas"), fg = document.createElement("canvas");
  const painting=window.SceneTextures?.create("woods",()=>{if(W){paintBackground();paintForeground();}});
  const objects=window.WoodsObjects;
  objects?.ready.then(()=>{stage.dataset.objects=objects.loaded()===45?'natural':'partial';if(W){paintForeground();renderBasket();}});
  // The lantern is shared with the pond; its woodland support is blunt timber.
  const lampMaterials={};
  for(const [name,file] of Object.entries({lantern:'lantern.webp',post:'woods-lamp-post-v1.webp'})){
    const img=new Image();img.decoding='async';
    img.onload=async()=>{try{await img.decode();lampMaterials[name]=img;if(lampMaterials.lantern&&lampMaterials.post)stage.dataset.lantern='material';}catch{}};
    img.src=`assets/wild/equipment/${file}`;
  }
  let items = [], berries = [], hips = [], parts = [], weather = [], flies = [], motes = [];
  let hover = null, nextSpawn = 0, rain = { on: false, until: 0, next: 60 + Math.random() * 60, drops: [] };
  const P = (u, v) => [u * W, v * H];
  const LANTERN = { u: .415, v: .70 };

  const PAL = {
    spring: { sky: ["#141a3d", "#3e3a6e", "#c48797"], glow: "255,190,190", far: "#3a4766", mid: "#2d5446", midHi: "#5f8f6e", leaf: "#4f8a46", ground: "#34502f", groundLo: "#1c2c1c", moss: ["#5d8a47", "#7aa65a", "#3e6533"], dec: ["#5f9a4e", "#86bd68", "#3d6e38"] },
    summer: { sky: ["#10173a", "#35346a", "#cf8c70"], glow: "255,196,140", far: "#33405f", mid: "#21473a", midHi: "#4c7f5d", leaf: "#2e6a35", ground: "#2b4628", groundLo: "#162514", moss: ["#4b7b3a", "#6a9c4b", "#2f5a2a"], dec: ["#3f7d3c", "#5f9e4f", "#2b5a2c"] },
    autumn: { sky: ["#151634", "#3d305e", "#c97650"], glow: "255,170,110", far: "#423f5e", mid: "#2f4638", midHi: "#7b8a52", leaf: "#c8792e", ground: "#4a3d24", groundLo: "#241c12", moss: ["#7a6a34", "#9a7a3a", "#5a4a26"], dec: ["#c8742a", "#e8a640", "#9a3f22"] },
    winter: { sky: ["#0c1230", "#2c3463", "#7c86b6"], glow: "200,215,255", far: "#5b6788", mid: "#26394a", midHi: "#7a94a8", leaf: "#2c4a3e", ground: "#d6dfef", groundLo: "#8796b8", moss: ["#e8eef8", "#cfd9ea", "#b6c3dc"], dec: ["#6a5a50", "#86766a", "#4a3e36"] }
  };

  /* ================= painting helpers ================= */
  function conifer(g, x, y, h, col, hi, snow, r) {
    if (!hi) {                                              // distant trees: a soft three-tier silhouette
      const w = h * 0.3;
      g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h);
      [[0.32, 0.45], [0.36, 0.7], [0.62, 0.72], [0.66, 0.92], [1, 1]].forEach(([f, ww]) => g.lineTo(x + w * ww, y - h + h * f));
      [[1, 1], [0.66, 0.92], [0.62, 0.72], [0.36, 0.7], [0.32, 0.45]].forEach(([f, ww]) => g.lineTo(x - w * ww, y - h + h * f));
      g.closePath(); g.fill();
      if (snow) { g.fillStyle = "rgba(236,242,252,.7)"; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w * 0.3, y - h * 0.68); g.lineTo(x - w * 0.3, y - h * 0.68); g.closePath(); g.fill(); }
      return;
    }
    const tiers = 6 + ((r() * 3) | 0), w = h * (0.34 + r() * 0.08);
    if (hi) { g.fillStyle = "#1e1712"; g.fillRect(x - h * 0.018, y - h * 0.14, h * 0.036, h * 0.16); }
    for (let i = 0; i < tiers; i++) {
      const f = (i + 1) / tiers, ty = y - h + h * 0.86 * (i / tiers), th = h * 0.86 / tiers * 1.55, tw = w * (0.28 + 0.72 * f);
      g.beginPath(); g.moveTo(x, ty);
      const n = 5;
      for (let j = 1; j <= n; j++) { const q = j / n; g.lineTo(x + tw * q + (r() - 0.5) * tw * 0.12, ty + th * (0.45 + 0.55 * q) + (j % 2 ? th * 0.12 : -th * 0.04)); }
      g.lineTo(x + tw * 0.15, ty + th * 0.78);
      g.lineTo(x - tw * 0.15, ty + th * 0.78);
      for (let j = n; j >= 1; j--) { const q = j / n; g.lineTo(x - tw * q + (r() - 0.5) * tw * 0.12, ty + th * (0.45 + 0.55 * q) + (j % 2 ? th * 0.12 : -th * 0.04)); }
      g.closePath(); g.fillStyle = col; g.fill();
      if (hi) {                                              // moonlight on the left flank
        g.save(); g.clip();
        const lg = g.createLinearGradient(x - tw, 0, x + tw * 0.2, 0);
        lg.addColorStop(0, hi); lg.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.35; g.fillStyle = lg; g.fillRect(x - tw, ty, tw * 1.2, th);
        g.restore(); g.globalAlpha = 1;
      }
      if (snow) {
        g.fillStyle = "rgba(240,246,255,.92)";
        for (let s = -1; s <= 1; s += 2) {
          g.beginPath(); g.moveTo(x, ty + th * 0.05);
          g.quadraticCurveTo(x + s * tw * 0.5, ty + th * 0.36, x + s * tw * 0.92, ty + th * 0.86);
          g.quadraticCurveTo(x + s * tw * 0.55, ty + th * 0.6, x + s * tw * 0.05, ty + th * 0.32);
          g.fill();
        }
      }
    }
  }
  function blobTree(g, x, y, h, cols, r, snow) {
    g.strokeStyle = "#2a1f18"; g.lineWidth = h * 0.05; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + h * 0.03, y - h * 0.3, x - h * 0.02, y - h * 0.55); g.stroke();
    const n = 22;
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * h * 0.3;
      const bx = x + Math.cos(a) * d * 1.1 - (pass - 1) * h * 0.04, by = y - h * 0.62 + Math.sin(a) * d * 0.8 - (pass - 1) * h * 0.04;
      g.fillStyle = cols[[2, 0, 1][pass]];
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(bx, by, h * (0.07 + r() * 0.07), 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    if (snow) { g.fillStyle = "rgba(240,246,255,.85)"; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * h * 0.5, y - h * 0.82 + r() * h * 0.2, h * 0.08, h * 0.03, 0, 0, TAU); g.fill(); } }
  }
  function bamboo(g, x, y, h, lean, r, sname) {
    const segs = 9, top = [x + lean * h, y - h];
    const green = sname === "winter" ? "#4f7a5c" : sname === "autumn" ? "#6f8a46" : "#5f9a4a";
    g.lineCap = "round";
    g.strokeStyle = green; g.lineWidth = h * 0.028;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * h * 0.3, y - h * 0.5, top[0], top[1]); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = h * 0.008;
    g.beginPath(); g.moveTo(x - h * 0.006, y); g.quadraticCurveTo(x + lean * h * 0.3 - h * 0.006, y - h * 0.5, top[0] - h * 0.006, top[1]); g.stroke();
    g.strokeStyle = "rgba(20,40,20,.55)"; g.lineWidth = h * 0.006;
    for (let i = 1; i < segs; i++) {                       // nodes
      const t = i / segs, px = lerp(x, top[0], t * t * 0.6 + t * 0.4), py = lerp(y, top[1], t);
      g.beginPath(); g.moveTo(px - h * 0.017, py); g.lineTo(px + h * 0.017, py); g.stroke();
      if (i > 3 && r() < 0.7) {                             // leaf sprays
        const side = r() < 0.5 ? -1 : 1;
        for (let l = 0; l < 4; l++) {
          const a = side * (0.5 + l * 0.32) + (r() - 0.5) * 0.3, len = h * (0.09 + r() * 0.05);
          const ex = px + Math.sin(a) * len, ey = py + Math.cos(a) * len * 0.5 + len * 0.15;
          g.fillStyle = sname === "winter" ? (l % 2 ? "#5a7a66" : "#e8eef6") : sname === "autumn" ? (l % 2 ? "#8a9a4a" : "#b3a050") : (l % 2 ? "#4f8a3e" : "#78b05a");
          g.beginPath(); g.moveTo(px, py);
          g.quadraticCurveTo(px + Math.sin(a + 0.3) * len * 0.6, py + Math.cos(a + 0.3) * len * 0.3, ex, ey);
          g.quadraticCurveTo(px + Math.sin(a - 0.3) * len * 0.6, py + Math.cos(a - 0.3) * len * 0.3 + len * 0.1, px, py);
          g.fill();
        }
      }
    }
  }
  function fern(g, x, y, s, ang, col, colHi) {
    if(objects?.draw(g,'fern',x,y,s*1.75,s,Math.round(Math.abs(x))%3,{season:season.name,snow:season.name==='winter'}))return;
    for (let f = 0; f < 6; f++) {
      const a = ang + (f - 2.5) * 0.36, len = s * (0.75 + (f % 3) * 0.12);
      const ex = x + Math.sin(a) * len, ey = y - Math.cos(a) * len * 0.9;
      const cx1 = x + Math.sin(a) * len * 0.5, cy1 = y - Math.cos(a) * len * 0.9 - len * 0.1;
      g.strokeStyle = col; g.lineWidth = Math.max(1, s * 0.02);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx1, cy1, ex, ey); g.stroke();
      for (let i = 1; i < 12; i++) {
        const t = i / 12, px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx1 + t * t * ex, py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy1 + t * t * ey;
        const l = s * 0.16 * (1 - t * 0.8);
        g.fillStyle = i % 2 ? col : colHi;
        for (const sd of [-1, 1]) {
          g.beginPath(); g.ellipse(px + Math.cos(a) * l * 0.5 * sd, py + Math.sin(a) * l * 0.5 * sd, l * 0.55, l * 0.18, a + sd * 0.4, 0, TAU); g.fill();
        }
      }
    }
  }
  function rock(g, x, y, w, h, snow, moss) {
    const rg = g.createLinearGradient(x - w / 2, y - h, x + w / 2, y);
    rg.addColorStop(0, "#7d8090"); rg.addColorStop(1, "#2e3140");
    g.fillStyle = rg; g.beginPath();
    g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * 0.5, y - h * 0.8, x - w * 0.1, y - h); g.quadraticCurveTo(x + w * 0.45, y - h * 0.95, x + w / 2, y); g.closePath(); g.fill();
    if (moss) { g.fillStyle = moss; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(x - w * 0.1, y - h * 0.82, w * 0.32, h * 0.2, -0.2, 0, TAU); g.fill(); g.globalAlpha = 1; }
    if (snow) { g.fillStyle = "#eef3fb"; g.beginPath(); g.ellipse(x - w * 0.05, y - h * 0.9, w * 0.42, h * 0.18, -0.1, 0, TAU); g.fill(); }
  }

  /* ================= the things you can pick ================= */
  const ART = {};
  function naturalFind(g,id,x,y,w,h,variant,blend,fallback,options={}){
    if(!objects?.has(id,variant)){fallback();return;}
    if(blend<1){g.save();g.globalAlpha*=1-blend;fallback();g.restore();}
    if(blend>0){g.save();g.globalAlpha*=blend;objects.draw(g,id,x,y,w,h,variant,{season:season.name,...options});g.restore();}
  }
  function stem(g, x, y, w, h, c1, c2, flare = 1.2) {
    const sg = g.createLinearGradient(x - w, 0, x + w, 0);
    sg.addColorStop(0, c1); sg.addColorStop(1, c2);
    g.fillStyle = sg; g.beginPath();
    g.moveTo(x - w * flare, y); g.quadraticCurveTo(x - w * 0.85, y - h * 0.5, x - w * 0.7, y - h);
    g.lineTo(x + w * 0.7, y - h); g.quadraticCurveTo(x + w * 0.85, y - h * 0.5, x + w * flare, y); g.closePath(); g.fill();
  }
  function dome(g, x, y, w, h, c1, c2, c3) {                 // a cap, lit from the upper left
    const cg = g.createRadialGradient(x - w * 0.35, y - h * 0.8, w * 0.05, x, y - h * 0.3, w * 1.1);
    cg.addColorStop(0, c1); cg.addColorStop(0.55, c2); cg.addColorStop(1, c3);
    g.fillStyle = cg; g.beginPath();
    g.moveTo(x - w, y); g.bezierCurveTo(x - w, y - h * 1.25, x + w, y - h * 1.25, x + w, y);
    g.quadraticCurveTo(x, y + h * 0.22, x - w, y); g.fill();
  }
  ART.porcini = (g, x, y, s) => {
    stem(g, x, y, s * 0.2, s * 0.62, "#f3ead6", "#bfae8a", 1.35);
    g.strokeStyle = "rgba(150,120,80,.35)"; g.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x - s * 0.15, y - s * (0.2 + i * 0.08)); g.lineTo(x + s * 0.15, y - s * (0.24 + i * 0.08)); g.stroke(); }
    g.fillStyle = "#e9d9a8"; g.beginPath(); g.ellipse(x, y - s * 0.6, s * 0.36, s * 0.06, 0, 0, TAU); g.fill();
    dome(g, x, y - s * 0.6, s * 0.4, s * 0.36, "#d9965a", "#8a4f28", "#4a2814");
    g.fillStyle = "rgba(255,240,210,.35)"; g.beginPath(); g.ellipse(x - s * 0.14, y - s * 0.86, s * 0.1, s * 0.04, -0.4, 0, TAU); g.fill();
  };
  ART.chanterelle = (g, x, y, s) => {
    const cg = g.createLinearGradient(x, y - s, x, y);
    cg.addColorStop(0, "#ffd677"); cg.addColorStop(1, "#d98a28");
    g.fillStyle = cg; g.beginPath();
    g.moveTo(x - s * 0.08, y); g.quadraticCurveTo(x - s * 0.1, y - s * 0.45, x - s * 0.42, y - s * 0.78);
    for (let i = 0; i <= 6; i++) g.lineTo(x - s * 0.42 + (s * 0.84 * i) / 6, y - s * (0.8 + (i % 2 ? 0.06 : 0)));
    g.quadraticCurveTo(x + s * 0.1, y - s * 0.45, x + s * 0.08, y); g.closePath(); g.fill();
    g.strokeStyle = "rgba(160,90,20,.45)"; g.lineWidth = 0.7;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * s * 0.01, y - s * 0.2); g.quadraticCurveTo(x + i * s * 0.03, y - s * 0.55, x + i * s * 0.12, y - s * 0.78); g.stroke(); }
    g.fillStyle = "#ffe7a3"; g.beginPath(); g.ellipse(x, y - s * 0.82, s * 0.4, s * 0.07, 0, 0, TAU); g.fill();
  };
  ART.amanita = (g, x, y, s) => {
    stem(g, x, y, s * 0.11, s * 0.66, "#ffffff", "#cfcabd", 1.6);
    g.fillStyle = "#f4f0e6"; g.beginPath(); g.ellipse(x, y - s * 0.42, s * 0.15, s * 0.04, 0, 0, TAU); g.fill();
    dome(g, x, y - s * 0.64, s * 0.42, s * 0.34, "#ff7a5e", "#d3261c", "#7a0f0c");
    g.fillStyle = "#fffaf0";
    [[-0.22, 0.76], [0.02, 0.86], [0.2, 0.74], [-0.05, 0.7], [0.3, 0.66], [-0.32, 0.67], [0.12, 0.92]].forEach(([dx, dy], i) => { g.beginPath(); g.ellipse(x + dx * s, y - dy * s, s * (0.035 + (i % 3) * 0.01), s * 0.025, 0, 0, TAU); g.fill(); });
  };
  ART.shiitake = (g, x, y, s) => {
    g.fillStyle = "#e8dcc4"; g.beginPath(); g.ellipse(x, y - s * 0.2, s * 0.08, s * 0.2, 0.2, 0, TAU); g.fill();
    dome(g, x, y - s * 0.38, s * 0.42, s * 0.3, "#a47048", "#5e3820", "#2a160a");
    g.strokeStyle = "rgba(245,230,205,.75)"; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.35; g.beginPath(); g.moveTo(x + Math.cos(a) * s * 0.12, y - s * 0.52 + Math.sin(a) * s * 0.06); g.lineTo(x + Math.cos(a) * s * 0.28, y - s * 0.5 + Math.sin(a) * s * 0.14); g.stroke(); }
    g.fillStyle = "#d8c4a0"; g.beginPath(); g.ellipse(x, y - s * 0.36, s * 0.4, s * 0.05, 0, 0, TAU); g.fill();
  };
  ART.matsutake = (g, x, y, s) => {
    stem(g, x, y, s * 0.17, s * 0.7, "#f6f0e4", "#c9b79a", 1.1);
    g.fillStyle = "rgba(140,95,55,.6)";
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + (i % 2 ? 0.06 : -0.06) * s, y - s * (0.15 + i * 0.07), s * 0.05, s * 0.015, 0, 0, TAU); g.fill(); }
    dome(g, x, y - s * 0.68, s * 0.27, s * 0.3, "#c28a58", "#7a4a26", "#3a200e");
    g.strokeStyle = "rgba(60,30,10,.4)"; g.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x - s * 0.2 + i * s * 0.1, y - s * 0.72); g.lineTo(x - s * 0.18 + i * s * 0.1, y - s * 0.85); g.stroke(); }
    g.strokeStyle = "#8a6a3a"; g.lineWidth = 1;                // pine needles at its foot
    for (let i = 0; i < 9; i++) { const a = -0.6 + i * 0.15; g.beginPath(); g.moveTo(x - s * 0.35 + i * s * 0.08, y); g.lineTo(x - s * 0.35 + i * s * 0.08 + Math.cos(a) * s * 0.2, y - s * 0.05 - Math.abs(Math.sin(a)) * s * 0.08); g.stroke(); }
  };
  ART.morel = (g, x, y, s) => {
    stem(g, x, y, s * 0.13, s * 0.42, "#f2e8d0", "#c8b48c", 1.3);
    const cg = g.createLinearGradient(x - s * 0.2, 0, x + s * 0.2, 0);
    cg.addColorStop(0, "#d8b47a"); cg.addColorStop(1, "#8a6436");
    g.fillStyle = cg; g.beginPath();
    g.moveTo(x - s * 0.2, y - s * 0.4); g.quadraticCurveTo(x - s * 0.22, y - s * 0.85, x, y - s * 1.0); g.quadraticCurveTo(x + s * 0.22, y - s * 0.85, x + s * 0.2, y - s * 0.4); g.closePath(); g.fill();
    g.fillStyle = "rgba(60,38,16,.55)";
    for (let r = 0; r < 5; r++) for (let c = -2; c <= 2; c++) {
      const w = 0.2 * (1 - r * 0.15); if (Math.abs(c) * 0.08 > w) continue;
      g.beginPath(); g.ellipse(x + c * s * 0.07 + (r % 2) * s * 0.035, y - s * (0.47 + r * 0.1), s * 0.024, s * 0.035, 0, 0, TAU); g.fill();
    }
  };
  ART.strawberry = (g, x, y, s, ripe = 1) => {
    g.strokeStyle = "#3e6a2e"; g.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + i * s * 0.2, y - s * 0.4, x + i * s * 0.3, y - s * 0.62); g.stroke();
      for (let l = -1; l <= 1; l++) { g.fillStyle = l ? "#4f8a3a" : "#64a248"; g.beginPath(); g.ellipse(x + i * s * 0.3 + l * s * 0.09, y - s * 0.68 - (l ? 0 : s * 0.05), s * 0.08, s * 0.12, l * 0.6, 0, TAU); g.fill(); }
    }
    for (const [dx, dy, sz] of [[0.2, 0.18, 1], [-0.16, 0.12, 0.8]]) {
      const bx = x + dx * s, by = y - dy * s, r = s * 0.11 * sz;
      if (ripe < 0.35) {                                       // first a white five-petalled flower
        g.fillStyle = "#fbf7ee"; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(bx + Math.cos(p * 1.257) * r * 0.7, by + Math.sin(p * 1.257) * r * 0.7, r * 0.55, 0, TAU); g.fill(); }
        g.fillStyle = "#f2c94c"; g.beginPath(); g.arc(bx, by, r * 0.4, 0, TAU); g.fill();
        continue;
      }
      const rr = smooth(0.35, 1, ripe);
      const bgd = g.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r * 1.2);
      bgd.addColorStop(0, mix("#f4f6d8", "#ff7a6e", rr)); bgd.addColorStop(1, mix("#b8c878", "#b8141e", rr));
      g.fillStyle = bgd; g.beginPath(); g.moveTo(bx - r, by - r * 0.4); g.quadraticCurveTo(bx - r, by + r * 0.9, bx, by + r * 1.25); g.quadraticCurveTo(bx + r, by + r * 0.9, bx + r, by - r * 0.4); g.quadraticCurveTo(bx, by - r * 1.1, bx - r, by - r * 0.4); g.fill();
      g.fillStyle = "#ffe08a"; for (let d = 0; d < 6; d++) g.fillRect(bx - r * 0.6 + (d % 3) * r * 0.55, by - r * 0.1 + Math.floor(d / 3) * r * 0.55, 1, 1);
      g.fillStyle = "#3f7a2c"; g.beginPath(); g.ellipse(bx, by - r * 0.6, r * 0.7, r * 0.22, 0, 0, TAU); g.fill();
    }
  };
  ART.shoot = (g, x, y, s, snow) => {
    const sg = g.createLinearGradient(x - s * 0.18, 0, x + s * 0.18, 0);
    sg.addColorStop(0, "#a8844e"); sg.addColorStop(0.5, "#7a5630"); sg.addColorStop(1, "#4a3018");
    g.fillStyle = sg; g.beginPath();
    g.moveTo(x - s * 0.2, y); g.quadraticCurveTo(x - s * 0.17, y - s * 0.6, x + s * 0.02, y - s); g.quadraticCurveTo(x + s * 0.12, y - s * 0.55, x + s * 0.2, y); g.closePath(); g.fill();
    g.strokeStyle = "rgba(40,24,10,.6)"; g.lineWidth = 0.8;
    for (let i = 1; i < 5; i++) { const t = i / 5; g.beginPath(); g.moveTo(x - s * 0.2 * (1 - t * 0.8), y - s * t * 0.9); g.quadraticCurveTo(x, y - s * t * 0.9 - s * 0.06, x + s * 0.2 * (1 - t * 0.8), y - s * t * 0.82); g.stroke(); }
    g.fillStyle = "#9ab85a"; g.beginPath(); g.ellipse(x + s * 0.02, y - s * 0.96, s * 0.03, s * 0.08, 0.3, 0, TAU); g.fill();
    if (snow) { g.fillStyle = "#eef3fb"; g.beginPath(); g.ellipse(x, y + s * 0.02, s * 0.42, s * 0.14, 0, Math.PI, TAU); g.fill(); }
  };
  ART.pinecone = (g, x, y, s) => {
    const cx = x, cy = y - s * 0.42;
    g.save(); g.translate(cx, cy); g.rotate(-0.5);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) {
      const t = r / 6, w = Math.sin(t * Math.PI) * s * 0.3 + s * 0.05;
      const px = (c / 3 - 0.5) * w * 1.6 + (r % 2) * s * 0.04, py = -s * 0.45 + t * s * 0.9;
      const sc = g.createLinearGradient(px, py - s * 0.06, px, py + s * 0.06);
      sc.addColorStop(0, "#a8723e"); sc.addColorStop(1, "#4a2a12");
      g.fillStyle = sc; g.beginPath(); g.ellipse(px, py, s * 0.09, s * 0.065, 0, 0, TAU); g.fill();
    }
    g.restore();
  };
  ART.rosehip = (g, x, y, s, ripe = 1) => {
    const r = s * 0.3 * (0.6 + 0.4 * Math.min(1, ripe / 0.75)), t = smooth(0, 1, ripe);
    const hg = g.createRadialGradient(x - r * 0.3, y - r * 1.3, r * 0.1, x, y - r, r * 1.3);
    hg.addColorStop(0, t < 0.5 ? mix("#c8dc8a", "#ffc07a", t * 2) : mix("#ffc07a", "#ffb07a", t * 2 - 1));
    hg.addColorStop(0.5, t < 0.5 ? mix("#7a9a3a", "#e8862a", t * 2) : mix("#e8862a", "#e2421e", t * 2 - 1));
    hg.addColorStop(1, t < 0.5 ? mix("#3a5418", "#8a3a10", t * 2) : mix("#8a3a10", "#7a1408", t * 2 - 1));
    g.fillStyle = hg; g.beginPath(); g.ellipse(x, y - r, r * 0.8, r, 0, 0, TAU); g.fill();
    g.strokeStyle = "#3a2010"; g.lineWidth = 1; g.beginPath(); g.moveTo(x - r * 0.3, y - r * 1.95); g.lineTo(x, y - r * 1.8); g.lineTo(x + r * 0.3, y - r * 1.95); g.stroke();
  };
  ART.bayberry = (g, x, y, s, ripe = 1) => {
    if (ripe < 0.15) {                                         // a tiny catkin of blossom
      g.fillStyle = "#e8e4b0"; g.beginPath(); g.ellipse(x, y - s * 0.3, s * 0.14, s * 0.3, 0.2, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,250,210,.7)"; g.beginPath(); g.arc(x - s * 0.04, y - s * 0.45, s * 0.07, 0, TAU); g.fill();
      return;
    }
    const r = s * 0.42 * (0.55 + 0.45 * Math.min(1, ripe / 0.75)), cy = y - r;
    const c1 = ripe > 0.7 ? "#e0405a" : ripe > 0.3 ? "#e86a60" : "#b8cf6a", c2 = ripe > 0.7 ? "#8a0f2c" : ripe > 0.3 ? "#b8343a" : "#6f8f34", c3 = ripe > 0.7 ? "#3a0412" : ripe > 0.3 ? "#5a1414" : "#3a5418";
    const bg2 = g.createRadialGradient(x - r * 0.35, cy - r * 0.35, r * 0.1, x, cy, r * 1.1);
    bg2.addColorStop(0, c1); bg2.addColorStop(0.5, c2); bg2.addColorStop(1, c3);
    g.fillStyle = bg2; g.beginPath(); g.arc(x, cy, r, 0, TAU); g.fill();
    if (r > 2.2) {                                            // the knobbly skin
      g.fillStyle = "rgba(255,190,200,.22)";
      for (let i = 0; i < 9; i++) { const a = i * 2.4, d = r * (0.25 + (i % 3) * 0.22); g.beginPath(); g.arc(x + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.13, 0, TAU); g.fill(); }
    }
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(x - r * 0.38, cy - r * 0.4, r * 0.16, 0, TAU); g.fill();
  };
  // a mushroom just pushing up: a tight button on a stub of stem
  function button(g, x, y, s, id) {
    const [cap, st] = MUSH[id];
    g.fillStyle = st; g.beginPath(); g.ellipse(x, y - s * 0.12, s * 0.12, s * 0.16, 0, 0, TAU); g.fill();
    const cg = g.createRadialGradient(x - s * 0.1, y - s * 0.38, s * 0.02, x, y - s * 0.25, s * 0.3);
    cg.addColorStop(0, mix(cap, "#ffffff", 0.35)); cg.addColorStop(1, mix(cap, "#000000", 0.25));
    g.fillStyle = cg; g.beginPath(); g.ellipse(x, y - s * 0.28, s * 0.2, s * 0.17, 0, 0, TAU); g.fill();
    if (id === "amanita") { g.fillStyle = "rgba(210,40,30,.75)"; g.beginPath(); g.ellipse(x, y - s * 0.4, s * 0.12, s * 0.06, 0, 0, TAU); g.fill(); }
  }
  const iconOf = (id) => objects?.has(id)?objects.src(id):Wd.icon("woods-" + id, (g, x, y, s) => (id === "bayberry" ? ART.bayberry(g, x, y - s * 0.1, s * 0.75) : id === "rosehip" ? ART.rosehip(g, x, y - s * 0.05, s * 0.8) : ART[id](g, x, y, s)));

  /* ================= the static backdrop ================= */
  const TREE = { u: 0.705, v: 0.7 };
  const crown = () => ({ x: TREE.u * W, y: TREE.v * H - 205 * k, rx: Math.min(150 * k, W * 0.2), ry: 118 * k });
  function paintBackground() {
    const g = bg.getContext("2d"), pal = PAL[season.name], r = rng(1234), snow = season.name === "winter";
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if(painting?.draw(g,W,H,season.name)) {
      paintRays();stage.dataset.texture='illustrated';return;
    }
    stage.dataset.texture='procedural';
    // sky and the glow over the clearing
    const sky = g.createLinearGradient(0, 0, 0, H * 0.66);
    sky.addColorStop(0, pal.sky[0]); sky.addColorStop(0.5, pal.sky[1]); sky.addColorStop(1, pal.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { const y = r() * H * 0.42; g.fillStyle = `rgba(235,236,255,${(0.2 + r() * 0.7) * (1 - y / (H * 0.45))})`; g.fillRect(r() * W, y, r() < 0.1 ? 1.6 : 1, r() < 0.1 ? 1.6 : 1); }
    glow(g, W * 0.49, H * 0.6, H * 0.55, pal.glow, 0.32);
    // the moon
    const mx = W * 0.79, my = H * 0.12, mr = 15 * k;
    glow(g, mx, my, mr * 7, "220,230,255", 0.16);
    Wd.moon(g, mx, my, mr);
    // two mountain ranges through the gap
    [[0.43, "#6f6c9e", snow ? 0.95 : 0.42], [0.5, "#454675", snow ? 0.55 : 0]].forEach(([base, col, snowA], ri) => {
      const pts = [], mr2 = rng(40 + ri);
      for (let x = -10; x <= W + 20; x += 9 * k) {
        const n = Math.sin(x * 0.004 / k + ri * 2) * 0.5 + 0.5, m = Math.abs(Math.sin(x * 0.013 / k + ri * 1.7)), j = (mr2() - 0.5) * 0.008;
        pts.push([x, H * base - n * H * 0.1 - m * H * 0.055 + j * H]);
      }
      Wd.range(g, pts, H * 0.7, col, snowA, 26 * k);
    });
    // far forest, then mist
    for (let x = -10; x < W + 20; x += (7 + r() * 9) * k) conifer(g, x, H * (0.585 + r() * 0.03), (50 + r() * 45) * k, pal.far, null, snow, r);
    paintRays();
    const mist = g.createLinearGradient(0, H * 0.45, 0, H * 0.62);
    mist.addColorStop(0, "rgba(200,190,230,0)"); mist.addColorStop(0.7, "rgba(200,190,230,.13)"); mist.addColorStop(1, "rgba(200,190,230,0)");
    g.fillStyle = mist; g.fillRect(0, H * 0.45, W, H * 0.2);
    // middle forest, leaving the clearing open
    const midTrees = [];
    for (let x = -20; x < W + 30; x += (26 + r() * 30) * k) { const u = x / W; if (u > 0.36 && u < 0.62) continue; midTrees.push(x); }
    midTrees.forEach((x) => {
      const h = (150 + r() * 120) * k, y = H * (0.64 + r() * 0.03);
      if (season.name === "autumn" && r() < 0.45) blobTree(g, x, y, h * 0.8, pal.dec, r, false);
      else if (season.name === "spring" && r() < 0.25) blobTree(g, x, y, h * 0.75, ["#e8b8c8", "#f6d6e0", "#c890a8"], r, false);
      else conifer(g, x, y, h, pal.mid, pal.midHi, snow, r);
    });
    // the forest floor
    const gr = g.createLinearGradient(0, H * 0.62, 0, H);
    gr.addColorStop(0, pal.ground); gr.addColorStop(1, pal.groundLo);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, H * 0.66);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H * (0.645 + Math.sin(x * 0.01) * 0.008));
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    if (snow) { g.fillStyle = "rgba(120,140,190,.25)"; for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(r() * W, H * (0.68 + r() * 0.3), (30 + r() * 80) * k, (4 + r() * 6) * k, 0, 0, TAU); g.fill(); } }
    for (let i = 0; i < (snow ? 260 : 1400); i++) {           // moss, litter, sparkle
      const y = H * (0.65 + Math.pow(r(), 0.8) * 0.35), x = r() * W, d = 0.6 + (y / H - 0.65) * 3;
      g.fillStyle = pal.moss[(r() * 3) | 0]; g.globalAlpha = snow ? 0.9 : 0.55;
      if (snow) g.fillRect(x, y, 1.2, 1.2);
      else { g.beginPath(); g.ellipse(x, y, (1 + r() * 2.4) * d * k, (0.6 + r()) * d * k, 0, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    if (season.name === "autumn") for (let i = 0; i < 260; i++) { const y = H * (0.66 + r() * 0.34); g.fillStyle = ["#c8742a", "#e8a640", "#9a3f22", "#b5562a"][(r() * 4) | 0]; g.save(); g.translate(r() * W, y); g.rotate(r() * TAU); g.beginPath(); g.ellipse(0, 0, 3.2 * k * (0.7 + (y / H - 0.66) * 2), 1.5 * k, 0, 0, TAU); g.fill(); g.restore(); }
    if (!snow) for (let i = 0; i < 230; i++) {                 // tufts of grass
      const y = H * (0.66 + Math.pow(r(), 0.7) * 0.34), x = r() * W, d = 0.6 + (y / H - 0.65) * 3, n = 5 + ((r() * 4) | 0);
      for (let j = 0; j < n; j++) {
        const a = -Math.PI / 2 + (j / (n - 1) - 0.5) * 1.1 + (r() - 0.5) * 0.2, L = (7 + r() * 7) * d * k;
        g.strokeStyle = pal.moss[(r() * 3) | 0]; g.lineWidth = Math.max(0.8, 1.1 * d); g.globalAlpha = 0.8;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.4, y + Math.sin(a) * L * 0.6, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
    }
    g.globalAlpha = 1;
    // the path into the clearing
    g.save();
    g.beginPath(); g.moveTo(W * 0.4, H); g.bezierCurveTo(W * 0.46, H * 0.86, W * 0.58, H * 0.8, W * 0.53, H * 0.72); g.quadraticCurveTo(W * 0.505, H * 0.67, W * 0.52, H * 0.645);
    g.lineTo(W * 0.535, H * 0.645); g.quadraticCurveTo(W * 0.535, H * 0.68, W * 0.575, H * 0.72); g.bezierCurveTo(W * 0.66, H * 0.8, W * 0.56, H * 0.88, W * 0.64, H); g.closePath();
    g.fillStyle = snow ? "rgba(230,236,248,.9)" : "rgba(140,118,84,.55)"; g.filter = `blur(${2 * k}px)`; g.fill(); g.filter = "none";
    g.restore();
    for (let i = 0; i < 6; i++) { const t = i / 6, x = lerp(W * 0.52, W * 0.52, t) + Math.sin(t * 5) * W * 0.03, y = lerp(H * 0.69, H * 0.97, t * t), s = 9 + t * 24; g.fillStyle = snow ? "rgba(170,180,210,.5)" : "rgba(170,165,150,.75)"; g.beginPath(); g.ellipse(x, y, s * k, s * 0.35 * k, 0, 0, TAU); g.fill(); g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.ellipse(x - s * 0.2 * k, y - s * 0.08 * k, s * 0.5 * k, s * 0.12 * k, 0, 0, TAU); g.fill(); }
    // the bamboo grove on the left
    const gr2 = rng(77);
    for (let i = 0; i < 9; i++) bamboo(g, W * (0.05 + gr2() * 0.2), H * (0.7 + gr2() * 0.04), (230 + gr2() * 150) * k, (gr2() - 0.4) * 0.15, gr2, season.name);
    // the wild rose bush
    const rb = { x: W * 0.885, y: H * 0.78 };
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.4, len = (40 + r() * 50) * k;
      g.strokeStyle = "#4a2e1e"; g.lineWidth = 1.6 * k; g.beginPath(); g.moveTo(rb.x, rb.y); g.quadraticCurveTo(rb.x + Math.cos(a) * len * 0.5, rb.y + Math.sin(a) * len * 0.8, rb.x + Math.cos(a) * len, rb.y + Math.sin(a) * len); g.stroke();
      if (season.name !== "winter") { g.fillStyle = season.name === "autumn" ? ["#c8742a", "#9a3f22", "#d99a3a"][i % 3] : ["#3f7a34", "#5b9a46", "#2e5a28"][i % 3]; for (let l = 0; l < 4; l++) { g.beginPath(); g.ellipse(rb.x + Math.cos(a) * len * (0.4 + l * 0.18) + (r() - 0.5) * 8 * k, rb.y + Math.sin(a) * len * (0.4 + l * 0.18), 5 * k, 3 * k, r() * 3, 0, TAU); g.fill(); } }
      if ((season.name === "spring" || season.name === "summer") && r() < 0.5) { const fx = rb.x + Math.cos(a) * len, fy = rb.y + Math.sin(a) * len; g.fillStyle = "#f7b8cc"; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(fx + Math.cos(p * 1.26) * 3 * k, fy + Math.sin(p * 1.26) * 3 * k, 2.6 * k, 0, TAU); g.fill(); } g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(fx, fy, 1.4 * k, 0, TAU); g.fill(); }
      if (snow && r() < 0.5) { g.fillStyle = "#eef3fb"; g.beginPath(); g.ellipse(rb.x + Math.cos(a) * len * 0.7, rb.y + Math.sin(a) * len * 0.7 - 2 * k, 6 * k, 2.4 * k, a + Math.PI / 2, 0, TAU); g.fill(); }
    }
    // the bayberry tree
    const c = crown(), tx = TREE.u * W, ty = TREE.v * H;
    const tg = g.createLinearGradient(tx - 14 * k, 0, tx + 14 * k, 0);
    tg.addColorStop(0, "#6a5040"); tg.addColorStop(1, "#2a1c14");
    g.fillStyle = tg; g.beginPath(); g.moveTo(tx - 16 * k, ty); g.quadraticCurveTo(tx - 8 * k, ty - 80 * k, tx - 4 * k, c.y + c.ry * 0.3); g.lineTo(tx + 8 * k, c.y + c.ry * 0.3); g.quadraticCurveTo(tx + 10 * k, ty - 80 * k, tx + 18 * k, ty); g.closePath(); g.fill();
    g.strokeStyle = "#3a281c"; g.lineWidth = 6 * k; g.lineCap = "round";
    [[-0.6, 0.55], [0.5, 0.6], [-0.2, 0.75], [0.2, 0.8]].forEach(([dx, h]) => { g.beginPath(); g.moveTo(tx, c.y + c.ry * 0.4); g.quadraticCurveTo(tx + dx * c.rx * 0.4, c.y + c.ry * 0.2, tx + dx * c.rx * 0.8, c.y - c.ry * (h - 0.5)); g.stroke(); });
    const tr = rng(99), leafCols = ["#1f4a2a", "#2d6a38", "#3f8246", "#58a05a"];
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < 420; i++) {
      const a = tr() * TAU, d = Math.sqrt(tr());
      const lx = c.x + Math.cos(a) * d * c.rx, ly = c.y + Math.sin(a) * d * c.ry * 0.95;
      const lit = (-(Math.cos(a) * d) * 0.6 - Math.sin(a) * d * 0.8 + 1) / 2;   // upper left is brighter
      if (pass === 3 && lit < 0.6) continue;
      if (pass === 0 && lit > 0.55) continue;
      g.fillStyle = leafCols[pass]; g.globalAlpha = 0.95;
      g.beginPath(); g.ellipse(lx, ly, (7 + tr() * 4) * k, (2.6 + tr() * 1.4) * k, tr() * TAU, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    if (snow) { g.fillStyle = "rgba(242,247,255,.95)"; for (let i = 0; i < 60; i++) { const a = -Math.PI * (0.1 + tr() * 0.8), d = 0.6 + tr() * 0.4; g.beginPath(); g.ellipse(c.x + Math.cos(a) * d * c.rx, c.y + Math.sin(a) * d * c.ry * 0.9, (9 + tr() * 8) * k, (3 + tr() * 2) * k, a + Math.PI / 2 + 1.57, 0, TAU); g.fill(); } }
    // the fallen log (shiitake grow on its flank)
    const l0 = P(0.28, 0.86), l1 = P(0.47, 0.795), lr = 20 * k;
    const ang = Math.atan2(l1[1] - l0[1], l1[0] - l0[0]), len = Math.hypot(l1[0] - l0[0], l1[1] - l0[1]);
    g.save(); g.translate(l0[0], l0[1]); g.rotate(ang);
    const lg = g.createLinearGradient(0, -lr, 0, lr); lg.addColorStop(0, "#7a5a40"); lg.addColorStop(0.5, "#4a3424"); lg.addColorStop(1, "#22160e");
    g.fillStyle = lg; g.beginPath(); g.roundRect(0, -lr, len, lr * 2, lr * 0.4); g.fill();
    g.strokeStyle = "rgba(20,12,6,.45)"; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { const x0 = r() * len; g.beginPath(); g.moveTo(x0, -lr * 0.8); g.lineTo(x0 + 20 * k, -lr * 0.7 + r() * lr * 1.4); g.stroke(); }
    g.fillStyle = snow ? "#eef3fb" : "rgba(110,150,70,.85)"; g.beginPath(); g.ellipse(len * 0.45, -lr * 0.85, len * 0.36, lr * 0.28, 0, 0, TAU); g.fill();
    g.fillStyle = "#b08a62"; g.beginPath(); g.ellipse(len, 0, lr * 0.45, lr, 0, 0, TAU); g.fill();
    g.strokeStyle = "rgba(90,60,30,.6)"; for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(len, 0, lr * 0.45 * i / 4, lr * i / 4, 0, 0, TAU); g.stroke(); }
    g.restore();
  }

  const rays = document.createElement("canvas");
  function paintRays() {
    rays.width = Math.round(W * dpr / 2); rays.height = Math.round(H * dpr / 2);
    const g = rays.getContext("2d"), pal = PAL[season.name];
    g.setTransform(dpr / 2, 0, 0, dpr / 2, 0, 0);
    g.filter = `blur(${10 * k}px)`;
    for (let i = 0; i < 4; i++) {
      const x0 = W * (0.43 + i * 0.045), w0 = (14 + i * 4) * k, x1 = W * (0.27 + i * 0.11), w1 = (70 + i * 18) * k;
      const rg = g.createLinearGradient(0, H * 0.3, 0, H * 0.98);
      rg.addColorStop(0, `rgba(${pal.glow},.5)`); rg.addColorStop(1, `rgba(${pal.glow},0)`);
      g.fillStyle = rg; g.beginPath(); g.moveTo(x0 - w0, H * 0.3); g.lineTo(x0 + w0, H * 0.3); g.lineTo(x1 + w1, H * 0.98); g.lineTo(x1 - w1, H * 0.98); g.closePath(); g.fill();
    }
    g.filter = "none";
  }
  function paintForeground() {
    const g = fg.getContext("2d"), pal = PAL[season.name], r = rng(4321), snow = season.name === "winter";
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if(painting?.ready(season.name)){
      [[.035,1.025,58],[.98,1.035,68],[.91,1.025,42]].forEach(([u,v,s],i)=>objects?.draw(g,'fern',u*W,v*H,s*k*1.7,s*k,i,{season:season.name,snow}));
      return;
    }
    // two great trunks frame the view
    [[W * 0.03, 1], [W * 0.975, -1]].forEach(([x, side]) => {
      const w = 64 * k;
      const tg = g.createLinearGradient(x - w, 0, x + w, 0);
      tg.addColorStop(0, side > 0 ? "#0c0a0a" : "#3a3436"); tg.addColorStop(0.6, "#151112"); tg.addColorStop(1, side > 0 ? "#3a3236" : "#0c0a0a");
      g.fillStyle = tg; g.beginPath(); g.moveTo(x - w * 0.7, -10); g.lineTo(x + w * 0.6, -10); g.quadraticCurveTo(x + w * 0.5, H * 0.6, x + w * 1.1, H + 10); g.lineTo(x - w * 1.2, H + 10); g.quadraticCurveTo(x - w * 0.6, H * 0.6, x - w * 0.7, -10); g.fill();
      g.strokeStyle = "rgba(255,255,255,.05)"; g.lineWidth = 2;
      for (let i = 0; i < 18; i++) { const bx = x + (r() - 0.5) * w * 1.2; g.beginPath(); g.moveTo(bx, r() * H); g.lineTo(bx + (r() - 0.5) * 6, r() * H); g.stroke(); }
      const mg = g.createLinearGradient(0, H * 0.55, 0, H);           // moss creeping up from the roots
      mg.addColorStop(0, "rgba(60,90,50,0)"); mg.addColorStop(1, snow ? "rgba(225,232,245,.35)" : "rgba(60,90,50,.4)");
      g.fillStyle = mg; g.fillRect(x - w * 1.2, H * 0.55, w * 2.4, H * 0.46);
    });
    // boughs reaching in from the top corners: tufts of needles along curving branches
    for (const side of [-1, 1]) for (let b = 0; b < 3; b++) {
      const x0 = side < 0 ? -10 : W + 10, y0 = (b * 30 - 8) * k, len = (150 + b * 46 + r() * 30) * k, droop = (30 + b * 12) * k;
      const pt = (t) => [x0 - side * len * t, y0 + droop * t * t + Math.sin(t * 3) * 6 * k];
      g.strokeStyle = "#0b0907"; g.lineWidth = (5 - b) * k; g.lineCap = "round";
      g.beginPath(); for (let i = 0; i <= 20; i++) { const [x, y] = pt(i / 20); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      const col = b === 0 ? "#060a09" : b === 1 ? "#0a1311" : "#0f1b18";
      for (let i = 2; i <= 22; i++) {
        const t = i / 22, [x, y] = pt(t), L = (20 - t * 9) * k;
        g.strokeStyle = col; g.lineWidth = 1.3;
        for (let n = 0; n < 15; n++) {                         // one tuft: needles fanning down and out
          const a = Math.PI / 2 + side * 0.2 + (n / 14 - 0.5) * 2.2;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L * (0.7 + r() * 0.4), y + Math.sin(a) * L * (0.7 + r() * 0.4)); g.stroke();
        }
      }
      if (snow) {                                              // snow lying along the top of the bough
        g.strokeStyle = "rgba(238,243,252,.95)"; g.lineWidth = (3.4 - b * 0.6) * k; g.lineCap = "round";
        g.beginPath(); for (let i = 1; i <= 18; i++) { const [x, y] = pt(i / 20); const yy = y - 2.2 * k + Math.sin(i * 1.7) * 0.8 * k; i > 1 ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
        g.fillStyle = "rgba(238,243,252,.9)";
        for (let i = 3; i < 18; i += 4) { const [x, y] = pt(i / 20); g.beginPath(); g.ellipse(x + side * 3 * k, y + 3 * k, 6 * k, 3.2 * k, side * 0.3, 0, TAU); g.fill(); }
      }
    }
    // ferns and grass along the bottom corners
    const fc = snow ? ["#3a4c46", "#5a6c66"] : season.name === "autumn" ? ["#7a5a2a", "#a07a3a"] : ["#244a2a", "#3f6e3a"];
    [[0.06, 1.01, 120], [0.17, 1.03, 90], [0.92, 1.02, 130], [0.82, 1.04, 80], [0.3, 1.04, 70]].forEach(([u, v, s], i) => fern(g, u * W, v * H, s * k, (i % 2 ? 0.2 : -0.2), fc[0], fc[1]));
    if (snow) { g.fillStyle = "rgba(238,244,252,.9)"; [[0.06, 1.0, 140], [0.92, 1.0, 150]].forEach(([u, v, s]) => { g.beginPath(); g.ellipse(u * W, v * H, s * k, 30 * k, 0, Math.PI, TAU); g.fill(); }); }
    // a soft vignette
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,4,8,.55)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  /* ================= berries, hips, ground finds ================= */
  function makeBerries() {
    berries = [];
    if (season.name === "autumn" || season.name === "winter") return;
    const c = crown(), r = rng(555);
    const n = season.name === "summer" ? 26 : 18;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.05 + r() * Math.PI * 1.1 + (r() < 0.3 ? Math.PI : 0), d = 0.45 + r() * 0.5;
      berries.push({ variant:i%3, x: c.x + Math.cos(a) * d * c.rx * 0.95, y: c.y + Math.sin(a) * d * c.ry * 0.85 + 6 * k, ripe: season.name === "summer" ? (r() < 0.45 ? 1 : r() * 0.7) : r() * 0.3, speed: 0.7 + r() * 0.6, picked: false, regrow: 0, ph: r() * TAU, s: (10 + r() * 3) * k });
    }
  }
  function makeHips() {
    hips = [];
    if (season.name !== "autumn" && season.name !== "winter") return;
    const r = rng(808), rb = { x: W * 0.885, y: H * 0.78 };
    for (let i = 0; i < 11; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.2, len = (34 + r() * 46) * k; hips.push({ variant:i%3, x: rb.x + Math.cos(a) * len, y: rb.y + Math.sin(a) * len + 6 * k, picked: false, regrow: 0, s: 15 * k, ph: r() * TAU, ripe: season.name === "winter" ? 1 : r() < 0.4 ? 1 : 0.1 + r() * 0.5, speed: 0.7 + r() * 0.6 }); }
  }
  const depthScale = (y) => 0.72 + (y / H - 0.65) * 1.6;
  let covers = [];
  function setupCovers() {
    covers = COVERS.filter((c) => !c.only || c.only === season.name).map((c,i) => ({ ...c, variant:i%3, kind: season.name === "winter" && c.kind === "grass" ? "snow" : c.kind, off: 0, target: 0, closeAt: 0, rustle: 0, rustleNext: time + 2 + Math.random() * 5, ph: Math.random() * TAU, seed: (Math.random() * 1e6) | 0 }));
  }
  const coverItem = (c) => items.find((it) => !it.gone && it.cover === c);
  function spawn(now, quiet) {
    const table = SPAWN[season.name], max = Wd.lowPower ? 6 : 8;
    if (items.filter((it) => !it.gone).length >= max) return;
    let tot = table.reduce((a, [, w]) => a + w, 0), x = Math.random() * tot, id = table[0][0];
    for (const [k2, w] of table) { if ((x -= w) <= 0) { id = k2; break; } }
    if (id === "amanita" && items.some((it) => it.id === "amanita" && !it.gone)) id = table[0][0];
    const hab = WHERE[id] || "moss";
    const free = (u, v) => !items.some((it) => !it.gone && Math.hypot(it.u - u, it.v - v) < 0.035);
    const open = SPOTS[hab].filter(([u, v]) => free(u, v));
    const hide = id === "amanita" ? [] : covers.filter((c) => c.hab === hab && c.off < 0.1 && !coverItem(c));
    const hidden = hide.length && (!open.length || Math.random() < (BY[id].rarity >= 3 ? 0.75 : 0.4));
    let u, v, cover = null;
    if (hidden) { cover = hide[(Math.random() * hide.length) | 0]; u = cover.u + (Math.random() - 0.5) * 0.012; v = cover.v - 0.006; }
    else if (open.length) [u, v] = open[(Math.random() * open.length) | 0];
    else return;
    const base = { shiitake: 34, porcini: 46, chanterelle: 38, amanita: 50, matsutake: 46, morel: 40, strawberry: 36, shoot: 44, pinecone: 26 }[id];
    const grown = quiet ? 0.25 + Math.random() * 0.75 : 0;
    let size = base * 0.85 * k * depthScale(v * H) * (0.85 + Math.random() * 0.3);
    if (cover) size = Math.min(size, cover.h * k * depthScale(cover.v * H) * (cover.kind === "rock" ? 0.82 : cover.kind === "leaves" ? 1.6 : 0.78));   // small enough to stay hidden
    items.push({ id, u, v, cover, variant:Math.floor(Math.random()*3), g: grown, born: now + (quiet ? -2 : Math.random() * 0.6), s: size, wob: 0, shake: 0, gone: false, flip: Math.random() < 0.5 ? -1 : 1 });
  }
  const READY = 0.72;
  const isMush = (id) => !!MUSH[id];
  const ready = (it) => it.g >= READY;
  const hiddenNow = (it) => it.cover && it.cover.off < 0.7;
  function itemBox(it) {
    const [x, y] = P(it.u, it.v), s = it.s * (0.35 + 0.65 * smooth(0, 1, it.g));
    return { x: x - s * 0.5, y: y - s * 1.05, w: s, h: s * 1.1, cx: x, cy: y - s * 0.5 };
  }

  /* ================= living things ================= */
  function setupParticles() {
    const n = { spring: 14, summer: 40, autumn: 6, winter: 0 }[season.name] * (Wd.lowPower ? 0.5 : 1);
    flies = Array.from({ length: Math.round(n) }, () => ({ x: Math.random() * W, y: H * (0.45 + Math.random() * 0.5), ph: Math.random() * TAU, sp: 0.4 + Math.random() * 0.6, r: 1 + Math.random() * 1.6 }));
    const wk = { spring: "petal", summer: "", autumn: "leaf", winter: "snow" }[season.name];
    const wn = { petal: 22, leaf: 26, snow: 110, "": 0 }[wk] * (Wd.lowPower ? 0.5 : 1);
    weather = Array.from({ length: Math.round(wn) }, () => newFlake(wk, true));
    motes = Array.from({ length: 30 }, () => ({ x: W * (0.38 + Math.random() * 0.26), y: H * (0.3 + Math.random() * 0.45), ph: Math.random() * TAU }));
  }
  function newFlake(kind, anywhere) {
    const z = Math.random();
    return { kind, x: Math.random() * W * 1.1 - W * 0.05, y: anywhere ? Math.random() * H : -20, z, vy: kind === "snow" ? 20 + z * 50 : 22 + z * 30, vx: kind === "snow" ? 0 : 10 + Math.random() * 20, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 3, ph: Math.random() * TAU, col: kind === "petal" ? ["#fbd3df", "#f7b6c9", "#ffe6ee"][(Math.random() * 3) | 0] : ["#d98a2a", "#b5482a", "#e6b23a", "#a0522d"][(Math.random() * 4) | 0] };
  }
  function burst(x, y, cols, n = 14, up = 1) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -(60 + Math.random() * 140) * up, life: 0.7 + Math.random() * 0.5, age: 0, r: 1.2 + Math.random() * 2.2, col: cols[(Math.random() * cols.length) | 0] });
  }
  function sparkle(x, y, n = 10, col = "255,236,170") {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 30 + Math.random() * 90; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.5, age: 0, r: 1 + Math.random() * 1.5, col: `rgba(${col},1)`, star: true, g: 0 }); }
  }

  /* ================= rocks, tufts, snow and needles you can move ================= */
  function drawCover(c, now) {
    const [bx, by] = P(c.u, c.v), sc = depthScale(by), w = c.w * k * sc, h = c.h * k * sc, o = smooth(0, 1, c.off), r = rng(c.seed);
    const shake = c.rustle > now ? Math.sin((c.rustle - now) * 40) * (1 - (0.6 - (c.rustle - now)) / 0.6) : 0;
    const side = c.u < 0.5 ? -1 : 1, snow = season.name === "winter";
    if (hover === c) { ctx.globalCompositeOperation = "lighter"; glow(ctx, bx + (c.kind === "rock" ? side * o * w * 1.15 : 0), by - h * 0.45, w * 0.75, "220,240,190", 0.22); ctx.globalCompositeOperation = "source-over"; }
    if (c.kind === "rock") {                                  // rolls aside
      const dx = side * o * w * 1.15, roll = side * Math.sin(o * Math.PI) * 0.35 + side * o * 0.12 + shake * 0.04;   // a half-turn wobble as it rolls, then settles
      ctx.save(); ctx.translate(bx + dx, by - h * 0.45); ctx.rotate(roll); ctx.translate(0, h * 0.45);
      ctx.fillStyle = "rgba(8,12,8,.35)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, h * 0.14, 0, 0, TAU); ctx.fill();
      if(objects?.draw(ctx,'rock',0,0,w*1.2,h*1.1,c.variant,{season:season.name,snow})){}
      else if(window.MeadowProps)ctx.drawImage(MeadowProps.sprite("rock",c.seed,season.name),-w*.6,-h*1.7,w*1.2,h*1.85);
      else rock(ctx, 0, 0, w, h, snow, PAL[season.name].moss[(c.seed % 3)]);
      ctx.restore();
      if (o > 0.05 && o < 0.98) { ctx.fillStyle = "rgba(60,50,40,.25)"; ctx.beginPath(); ctx.ellipse(bx, by, w * 0.45 * (1 - o * 0.4), h * 0.12, 0, 0, TAU); ctx.fill(); }
      return;
    }
    if(['grass','leaves'].includes(c.kind)&&objects?.has(c.kind,c.variant)){
      for(const side of [-1,1]){
        ctx.save();ctx.translate(bx+side*o*w*.46,by);ctx.rotate(side*o*(c.kind==='grass'?.42:.12)+Math.sin(now*1.2+c.ph)*.012);
        ctx.beginPath();ctx.rect(side<0?-w:0,-h*1.3,w,h*1.4);ctx.clip();
        objects.draw(ctx,c.kind,0,0,w*1.2,h*1.1,c.variant,{season:season.name});ctx.restore();
      }return;
    }
    if(c.kind==='grass' && window.MeadowProps) {
      const tile=MeadowProps.sprite('grass',c.seed,season.name);
      for(const side of [-1,1]) {
        ctx.save();ctx.translate(bx+side*o*w*.42,by);ctx.rotate(side*o*.45+Math.sin(now*1.2+c.ph)*.025);
        const sx=side<0?0:128;
        ctx.drawImage(tile,sx,0,128,256,side<0?-w*.6:0,-h*1.2,w*.6,h*1.3);ctx.restore();
      }
      return;
    }
    if (c.kind === "grass") {                                 // parts like a curtain
      const n = 30, autumn = season.name === "autumn";
      const cols = autumn ? ["#8a7a3a", "#b0964a", "#6a5a2a"] : ["#3f6e34", "#5d9446", "#2e5428", "#78b058"];
      ctx.lineCap = "round";
      ctx.fillStyle = autumn ? "rgba(70,58,26,.9)" : "rgba(28,52,26,.92)";      // the dense heart of the tuft
      ctx.beginPath(); ctx.ellipse(bx, by - h * 0.18 * (1 - o), w * 0.42 * (1 - o * 0.6), h * 0.32 * (1 - o * 0.7), 0, 0, TAU); ctx.fill();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5, x0 = bx + t * w * (0.75 + o * 0.5);
        const lean = t * 0.9 + Math.sign(t || 1) * o * 0.7 + Math.sin(now * 1.6 + c.ph + i) * 0.04 + shake * 0.15;
        const L = h * (0.7 + r() * 0.5) * (1 - o * 0.15);
        ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = Math.max(1.4, 3 * k * sc);
        ctx.beginPath(); ctx.moveTo(x0, by); ctx.quadraticCurveTo(x0 + Math.sin(lean) * L * 0.4, by - L * 0.6, x0 + Math.sin(lean) * L, by - Math.cos(lean) * L); ctx.stroke();
      }
      return;
    }
    if (c.kind === "snow") {                                  // dug away
      const hh=h*(.38-o*.3),rx=w*(.56+o*.22),x=bx+shake*2;
      const sg=ctx.createLinearGradient(0,by-hh,0,by+4*k);
      sg.addColorStop(0,'#f4f7fc');sg.addColorStop(.55,'rgba(218,228,242,.94)');sg.addColorStop(1,'rgba(173,192,221,0)');
      ctx.fillStyle=sg;ctx.beginPath();ctx.moveTo(x-rx,by+3*k);
      for(let i=0;i<=12;i++){
        const t=i/12,slope=Math.sin(t*Math.PI)**.8,yy=by-hh*slope*(.72+r()*.28),xx=x-rx+t*rx*2;
        if(i)ctx.quadraticCurveTo(xx-rx/12,yy+(r()-.5)*2*k,xx,yy);else ctx.lineTo(xx,yy);
      }
      ctx.lineTo(x+rx,by+5*k);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(240,246,254,.38)';for(let i=0;i<16;i++){ctx.beginPath();ctx.ellipse(x+(r()-.5)*rx*2.3,by+(r()-.5)*6*k,(1+r()*2.4)*k,.6*k,0,0,TAU);ctx.fill();}
      return;
    }
    // a heap of fallen needles and leaves: swept apart
    for (let i = 0; i < 26; i++) {
      const t = r(), a = r() * TAU, spread = 0.5 + o * 1.1, x = bx + Math.cos(a) * w * 0.45 * t * spread, y = by - (1 - t) * h * (1 - o * 0.7) + Math.sin(a) * h * 0.2;
      ctx.fillStyle = ["#a0622a", "#c8842e", "#7a4a20", "#d9a040"][i % 4];
      ctx.save(); ctx.translate(x + shake * 1.5, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, 4.5 * k * sc, 1.8 * k * sc, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  function coverAt(px, py) {
    for (const c of [...covers].sort((a, b) => b.v - a.v)) {
      const [bx, by] = P(c.u, c.v), sc = depthScale(by), w = c.w * k * sc, h = c.h * k * sc, side = c.u < 0.5 ? -1 : 1;
      const cx = bx + (c.kind === "rock" ? side * smooth(0, 1, c.off) * w * 1.15 : 0);
      if (Math.abs(px - cx) < w * 0.6 + 6 && py < by + 8 && py > by - h * 1.1 - 6) return c;
    }
    return null;
  }
  function moveCover(c, open) {
    c.target = open ? 1 : 0;
    if (open && c.kind === "snow") { const [x, y] = P(c.u, c.v); burst(x, y - 6, ["#ffffff", "#e6eefa", "#cfdaf0"], 14); }
    if (open && c.kind === "leaves") { const [x, y] = P(c.u, c.v); burst(x, y - 4, ["#a0622a", "#c8842e", "#d9a040"], 12); }
    if (open && c.kind === "rock") { const [x, y] = P(c.u, c.v); burst(x, y, ["#6a5a44", "#8a7a60"], 6, 0.5); }
    if (!open) c.closeAt = 0;
  }
  function updateCovers(dt, now) {
    covers.forEach((c) => {
      if (!c.drag) c.off += (c.target - c.off) * Math.min(1, dt * 5);
      const it = coverItem(c);
      if (it && !it.found && c.off > 0.7) {                     // found it!
        it.found = true;
        const [x, y] = P(it.u, it.v);
        sparkle(x, y - it.s * 0.4, 16);
        Wd.float(stage, x, y - it.s - 16, ready(it) ? `Found: ${BY[it.id].name}!` : `${BY[it.id].name} — still growing`, "soft");
      }
      if (c.target === 1 && !it && !c.closeAt) c.closeAt = now + 6;
      if (c.closeAt && now > c.closeAt && !c.drag) { c.target = 0; c.closeAt = 0; }
      if (it && c.off < 0.1 && now > c.rustleNext) { c.rustle = now + 0.6; c.rustleNext = now + 4 + Math.random() * 5; }   // something moves underneath
    });
  }

  /* ================= Matcha came along ================= */
  const yuki = new Image(); yuki.src = Wild.keeper.image;
  const YUKI = { u: 0.155, v: 0.95 };
  const yukiBox = () => { const h = 128 * k, [x, y] = P(YUKI.u, YUKI.v); return { x: x - h / 2, y: y - h, w: h, h, cx: x, cy: y - h / 2 }; };
  const companion = WildCompanion.create({stage, image: yuki, box: yukiBox, onInventory: () => {
    const latest = Wd.store.get("wild-woods", {}) || {};
    save.basket = latest.basket || {}; save.seen = latest.seen || {};
    renderBasket();
  }});
  const YUKI_LINES = {
    spring: ["Matcha sniffs a morel and sneezes.", "Matcha: “After rain, the shoots come up overnight.”", "Matcha is watching a petal very seriously."],
    summer: ["Matcha: “The dark red ones are the sweet ones.”", "Matcha bats at a firefly and misses.", "Matcha will not go near the red mushroom. Wise cat."],
    autumn: ["Matcha: “Matsutake hide under the pines. Look closely.”", "Matcha pounces on a leaf.", "Matcha has found a very good log to sit on."],
    winter: ["Matcha: “The sweetest shoots sleep under the snow.”", "Matcha leaves tiny footprints all the way here.", "Matcha fluffs up against the cold."]
  };

  function drawLantern(now) {
    // A clear patch behind the fallen log, left of the path. Anchor the foot
    // directly to the ground so small views cannot drift onto the log.
    const [px,y]=P(LANTERN.u,LANTERN.v),x=px+17*k,lx=x+18*k,top=y-78*k,ly=top+30*k;
    const fl=.91+.06*Math.sin(now*7)*Math.sin(now*3.1);
    ctx.save();ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(10,14,10,.28)';ctx.beginPath();ctx.ellipse(x-17*k,y+1*k,13*k,3*k,0,0,TAU);ctx.fill();
    ctx.globalCompositeOperation='lighter';
    glow(ctx,lx,ly,65*k*fl,'255,193,113',.2);
    ctx.save();ctx.translate(lx,y);ctx.scale(1,.22);glow(ctx,0,0,55*k,'255,186,99',.14);ctx.restore();
    ctx.globalCompositeOperation='source-over';ctx.filter='brightness(.8) saturate(.85)';
    if(lampMaterials.post)ctx.drawImage(lampMaterials.post,px-9*k,y-93*k,18*k,93*k);
    else{
      ctx.fillStyle='#473629';ctx.beginPath();ctx.moveTo(px-7*k,y);ctx.lineTo(px-8*k,y-91*k);ctx.lineTo(px+7*k,y-93*k);ctx.lineTo(px+8*k,y);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#77604a';ctx.lineWidth=1*k;ctx.beginPath();ctx.moveTo(px+3*k,y-2*k);ctx.lineTo(px+2*k,y-89*k);ctx.stroke();
    }
    // A rough branch arm, lashed to the post, with a short hanging cord.
    ctx.lineCap='round';ctx.strokeStyle='#493425';ctx.lineWidth=5*k;
    ctx.beginPath();ctx.moveTo(x-20*k,y-81*k);ctx.bezierCurveTo(x-6*k,y-88*k,lx-6*k,top-10*k,lx+1*k,top-7*k);ctx.stroke();
    ctx.strokeStyle='#9b7851';ctx.lineWidth=1.1*k;
    ctx.beginPath();ctx.moveTo(x-20*k,y-82*k);ctx.bezierCurveTo(x-6*k,y-89*k,lx-6*k,top-11*k,lx+1*k,top-8*k);ctx.stroke();
    ctx.strokeStyle='#b5a17e';ctx.lineWidth=1*k;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x-24*k,y-(83-i*1.5)*k);ctx.lineTo(x-11*k,y-(79-i*1.5)*k);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(lx+1*k,top-7*k);ctx.quadraticCurveTo(lx-2*k,top-1*k,lx,top+3*k);ctx.stroke();
    ctx.filter='none';
    if(lampMaterials.lantern)ctx.drawImage(lampMaterials.lantern,lx-15*k,top,30*k,30*k*553/342);
    else{
      ctx.fillStyle='#493425';ctx.beginPath();ctx.moveTo(lx-14*k,top+13*k);ctx.lineTo(lx,top+7*k);ctx.lineTo(lx+14*k,top+13*k);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#71553b';ctx.lineWidth=2*k;ctx.strokeRect(lx-10*k,top+14*k,20*k,29*k);
      ctx.fillStyle='rgba(255,210,134,.6)';ctx.fillRect(lx-6*k,top+18*k,12*k,20*k);
    }
    if(season.name==='winter'){
      ctx.strokeStyle='rgba(226,238,250,.7)';ctx.lineWidth=2*k;ctx.beginPath();ctx.moveTo(lx-11*k,top+12*k);ctx.quadraticCurveTo(lx,top+7*k,lx+11*k,top+12*k);ctx.stroke();
    }
    // A few blades overlap the broad foot to seat the timber in the soil.
    ctx.strokeStyle=season.name==='winter'?'#d6dfec':season.name==='autumn'?'#77714a':'#596b3c';ctx.lineWidth=.9*k;
    for(let i=0;i<7;i++){const gx=px+(i-3)*2.3*k;ctx.beginPath();ctx.moveTo(gx,y+1*k);ctx.quadraticCurveTo(gx+(i%2?2:-2)*k,y-3*k,gx+(i%2?3:-3)*k,y-(4+i%3)*k);ctx.stroke();}
    ctx.globalCompositeOperation='lighter';glow(ctx,lx,ly,12*k*fl,'255,219,157',.22);
    ctx.restore();
  }

  /* ================= frame ================= */
  function draw(dt) {
    const now = time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const calm = Wd.reduce || (window.Sky && Sky.calm);
    // light falling into the clearing
    ctx.globalCompositeOperation = "lighter";
    const pal = PAL[season.name];
    ctx.globalAlpha = 0.16 + 0.07 * Math.sin(now * 0.35);
    ctx.drawImage(rays, 0, 0, W, H);
    ctx.globalAlpha = 1;
    motes.forEach((m) => { m.y -= dt * 4; m.x += Math.sin(now * 0.5 + m.ph) * dt * 6; if (m.y < H * 0.3) m.y = H * 0.75; ctx.fillStyle = `rgba(255,240,200,${0.25 + 0.25 * Math.sin(now * 2 + m.ph)})`; ctx.fillRect(m.x, m.y, 1.4, 1.4); });
    ctx.globalCompositeOperation = "source-over";
    // drifting mist
    for (let i = 0; i < 2; i++) {
      const y = H * (0.6 + i * 0.07), off = ((now * (6 + i * 4)) % (W * 0.5));
      for (let j = -1; j < 3; j++) { const x = j * W * 0.5 + off * (i ? -1 : 1); const mg = ctx.createRadialGradient(x, y, 0, x, y, W * 0.28); mg.addColorStop(0, `rgba(210,205,235,${season.name === "winter" ? 0.07 : 0.1})`); mg.addColorStop(1, "rgba(210,205,235,0)"); ctx.fillStyle = mg; ctx.fillRect(x - W * 0.3, y - H * 0.08, W * 0.6, H * 0.16); }
    }
    // bayberries and hips
    berries.forEach((b) => {
      if (b.picked) { if (now > b.regrow) { b.picked = false; b.ripe = 0; b.pop = now; } else return; }
      if (b.ripe < 1 && season.name === "summer") b.ripe = Math.min(1, b.ripe + (dt / 45) * b.speed * (rain.on ? 2 : 1));
      if (season.name === "spring") b.ripe = Math.min(0.32, b.ripe + dt / 120);
      const sw = Math.sin(now * 1.3 + b.ph) * 1.2 * k, grow = b.pop ? smooth(b.pop, b.pop + 0.6, now) : 1;
      const s = b.s * grow;
      ctx.strokeStyle = "#3a2a18"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(b.x + sw, b.y - s * 0.85); ctx.lineTo(b.x + sw * 0.5, b.y - s * 1.3); ctx.stroke();
      naturalFind(ctx,'bayberry',b.x+sw,b.y,s*1.5,s,b.variant,smooth(.55,.8,b.ripe),()=>ART.bayberry(ctx,b.x+sw,b.y,s,b.ripe));
      if (hover === b) { ctx.globalCompositeOperation = "lighter"; glow(ctx, b.x + sw, b.y - s * 0.4, s * 1.4, "255,170,170", 0.4); ctx.globalCompositeOperation = "source-over"; }
    });
    hips.forEach((h) => {
      if (h.picked) { if (now > h.regrow) { h.picked = false; h.ripe = 0.1; } else return; }
      if (h.ripe < 1) h.ripe = Math.min(1, h.ripe + (dt / 50) * h.speed);
      naturalFind(ctx,'rosehip',h.x+Math.sin(now+h.ph)*k,h.y,h.s*1.3,h.s,h.variant,smooth(.55,.8,h.ripe),()=>ART.rosehip(ctx,h.x+Math.sin(now+h.ph)*k,h.y,h.s,h.ripe));
      if (hover === h) { ctx.globalCompositeOperation = "lighter"; glow(ctx, h.x, h.y - h.s * 0.3, h.s * 1.3, "255,170,120", 0.45); ctx.globalCompositeOperation = "source-over"; }
    });
    // Sort by feet on the ground, never by the top of a growing sprite.
    items.forEach((it) => { if (!it.gone && it.g < 1) it.g = Math.min(1, it.g + (dt / (GROW[it.id] || 30)) * (rain.on ? 2 : 1)); });
    const list = [...items.filter((it) => !it.gone), ...covers.map((c) => ({ cover: true, c, v: c.v })),
      { actor: 'lantern', v: LANTERN.v }, { actor: 'matcha', v: YUKI.v }].sort((a, b) => a.v - b.v);
    const drawMatcha = () => {
      if (!yuki.complete || !yuki.naturalWidth) return;
      const b = yukiBox();
      companion.draw(ctx, b, {shadow: true, filter: season.name === "winter" ? "brightness(.82) saturate(.9)" : "brightness(.78) saturate(.92) sepia(.08)"});
      if (hover === "yuki") { ctx.globalCompositeOperation = "lighter"; glow(ctx, b.cx, b.cy, b.w * 0.6, "220,230,255", 0.18); ctx.globalCompositeOperation = "source-over"; }
    };
    list.forEach((it) => {
      if (it.actor === 'lantern') { drawLantern(now); return; }
      if (it.actor === 'matcha') { drawMatcha(); return; }
      if (it.cover === true) { drawCover(it.c, now); return; }
      const [x, y] = P(it.u, it.v), age = now - it.born;
      if (age < 0) return;
      const gs = 0.35 + 0.65 * smooth(0, 1, it.g);
      const g2 = smooth(0, 0.7, age), squash = 1 + Math.sin(Math.min(age, 0.7) * 9) * 0.12 * (1 - g2);
      let sx = squash, sy = g2 / squash, rot = 0, alpha = 1, lift = 0;
      if (it.picking != null) { const p = (now - it.picking) / 0.45; sy *= 1 + p * 0.5; sx *= 1 - p * 0.3; lift = p * 26 * k; alpha = 1 - p; if (p >= 1) { it.gone = true; return; } }
      if (it.shake) { rot = Math.sin((now - it.shake) * 40) * 0.12 * Math.max(0, 1 - (now - it.shake) / 0.6); }
      ctx.fillStyle = "rgba(10,14,10,.32)"; ctx.beginPath(); ctx.ellipse(x, y, it.s * 0.36 * g2 * gs, it.s * 0.07, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y - lift); ctx.rotate(rot); ctx.scale(sx * it.flip, sy);
      if(it.id==='strawberry')naturalFind(ctx,it.id,0,0,it.s*gs,it.s*gs,it.variant||0,smooth(.5,.8,it.g),()=>ART.strawberry(ctx,0,0,it.s*(.6+.4*smooth(0,1,it.g)),smooth(.2,1,it.g)),{shadow:true});
      else if(objects?.draw(ctx,it.id,0,0,it.s*gs,it.s*gs,it.variant||0,{season:season.name,shadow:true,snow:season.name==='winter'&&it.id==='shoot'})){}
      else if (isMush(it.id) && it.g < 0.42) button(ctx, 0, 0, it.s * (0.45 + it.g), it.id);
      else ART[it.id](ctx, 0, 0, it.s * gs, season.name === "winter");
      ctx.restore();
      if (it.g >= 1 && !it.matured && it.picking == null && !hiddenNow(it)) { it.matured = true; sparkle(x, y - it.s * 0.6, 6); }
      if (BY[it.id].rarity >= 3 && ready(it) && it.picking == null) { ctx.globalCompositeOperation = "lighter"; const tw = 0.5 + 0.5 * Math.sin(now * 3 + it.u * 20); glow(ctx, x + it.s * 0.3, y - it.s * 0.9, it.s * 0.35, "255,240,190", 0.5 * tw); ctx.globalCompositeOperation = "source-over"; }
      if (hover === it) { ctx.globalCompositeOperation = "lighter"; glow(ctx, x, y - it.s * 0.5, it.s * 1.1, it.id === "amanita" ? "255,120,110" : "255,236,170", 0.3); ctx.globalCompositeOperation = "source-over"; }
    });
    // the foreground frame
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fireflies, weather, sparks
    ctx.globalCompositeOperation = "lighter";
    flies.forEach((f) => {
      if (!calm) { f.x += Math.cos(now * f.sp + f.ph) * 14 * dt; f.y += Math.sin(now * f.sp * 1.3 + f.ph) * 9 * dt; }
      const a = Math.max(0, Math.sin(now * 1.7 + f.ph * 3)) ** 2;
      glow(ctx, f.x, f.y, 9 * f.r, "235,255,140", 0.28 * a); ctx.fillStyle = `rgba(250,255,200,${0.9 * a})`; ctx.fillRect(f.x - 0.8, f.y - 0.8, 1.6, 1.6);
    });
    ctx.globalCompositeOperation = "source-over";
    if (!calm) weather.forEach((p, i) => {
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(now * 1.2 + p.ph) * 14) * dt; p.rot += p.vr * dt;
      if (p.kind === "snow") { ctx.fillStyle = `rgba(245,248,255,${0.5 + p.z * 0.5})`; ctx.beginPath(); ctx.arc(p.x, p.y, 0.8 + p.z * 2.2, 0, TAU); ctx.fill(); }
      else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.4 + Math.abs(Math.cos(now * 2 + p.ph)) * 0.6); ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, 4 * k, 2.2 * k, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      if (p.y > H + 10 || p.x > W + 30) weather[i] = newFlake(p.kind, false);
    });
    // a passing shower
    if (rain.on) {
      ctx.strokeStyle = "rgba(190,205,235,.35)"; ctx.lineWidth = 1;
      ctx.beginPath();
      rain.drops.forEach((d) => { d.y += 620 * dt; d.x -= 60 * dt; if (d.y > H) { d.y = -20; d.x = Math.random() * W * 1.1; } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 3, d.y - 14); });
      ctx.stroke();
    }
    parts = parts.filter((p) => (p.age += dt) < p.life);
    parts.forEach((p) => {
      p.vy += (p.g == null ? 380 : p.g) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98;
      const a = 1 - p.age / p.life;
      if (p.star) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = p.col.replace(",1)", `,${a})`); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.4, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    });
  }

  /* ================= picking ================= */
  function hitTest(px, py) {
    for (const b of berries) if (!b.picked && Math.hypot(px - b.x, py - (b.y - b.s * 0.42)) < Math.max(b.s * 0.9, 14)) return b;
    for (const h of hips) if (!h.picked && Math.hypot(px - h.x, py - (h.y - h.s * 0.3)) < Math.max(h.s * 0.8, 14)) return h;
    const list = items.filter((it) => !it.gone && it.picking == null && time - it.born > 0.3 && !hiddenNow(it)).sort((a, b) => b.v - a.v);
    for (const it of list) { const b = itemBox(it), pad = 10; if (px > b.x - pad && px < b.x + b.w + pad && py > b.y - pad && py < b.y + b.h + pad) return it; }
    const c = coverAt(px, py);
    if (c) return { coverHit: c };
    const y = yukiBox();
    if (px > y.x + y.w * 0.15 && px < y.x + y.w * 0.85 && py > y.y + y.h * 0.1 && py < y.y + y.h) return "yuki";
    return null;
  }
  function gain(id, x, y) {
    const it = BY[id], first = !save.seen[id];
    save.seen[id] = (save.seen[id] || 0) + 1;
    save.basket[id] = (save.basket[id] || 0) + 1;
    persist();
    const r = cv.getBoundingClientRect();
    Wd.fly(iconOf(id), r.left + x, r.top + y, basketEl);
    Wd.float(stage, x, y - 20, `+1 ${it.name}`);
    setTimeout(renderBasket, 850);
    if (first) { setTimeout(() => toast(`New in your field journal: ${it.name}`, 3200), 500); document.getElementById("btnJournal").classList.add("glint"); }
  }
  function pick(target) {
    if (target === "yuki") {
      const lines = YUKI_LINES[season.name];
      companion.open(Wd.keeperLine(lines[(Math.random() * lines.length) | 0])); tip.classList.remove("on");
      return;
    }
    if (berries.includes(target)) {
      const b = target;
      if (b.ripe < 0.75) { Wd.float(stage, b.x, b.y - 24, season.name === "spring" ? "Blossom and green fruit — ripe in summer" : b.ripe < 0.15 ? "Still blossom…" : `Ripening… ${Math.round((b.ripe / 0.75) * 100)}%`, "soft"); return; }
      b.picked = true; b.regrow = time + 45 + Math.random() * 30;
      burst(b.x, b.y - b.s * 0.4, ["#9a1030", "#c8203e", "#e85a70"], 12);
      gain("bayberry", b.x, b.y - b.s * 0.4);
      return;
    }
    if (hips.includes(target)) {
      const h = target;
      if (h.ripe < 0.75) { Wd.float(stage, h.x, h.y - 24, `Still ${h.ripe < 0.35 ? "green" : "orange"} — ripening`, "soft"); return; }
      h.picked = true; h.regrow = time + 60;
      burst(h.x, h.y - h.s * 0.3, ["#e2421e", "#ff9a5a"], 8);
      gain("rosehip", h.x, h.y - h.s * 0.3);
      return;
    }
    if (target.coverHit) { const c = target.coverHit; moveCover(c, c.target < 0.5); return; }
    const it = target, [x, y] = P(it.u, it.v), info = BY[it.id];
    if (!info.poison && !ready(it)) { it.shake = time; Wd.float(stage, x, y - it.s * 0.8 - 10, `Still growing… ${Math.round((it.g / READY) * 100)}%`, "soft"); return; }
    if (info.poison) {
      it.shake = time;
      if (!save.seen.amanita) { save.seen.amanita = 1; persist(); document.getElementById("btnJournal").classList.add("glint"); }
      Wd.float(stage, x, y - it.s - 10, "Poisonous fly agaric", "warn");
      toast(Wd.keeperLine("Fly agaric: beautiful, and poisonous. Matcha says leave it for the fairies."), 3400);
      return;
    }
    it.picking = time;
    burst(x, y - it.s * 0.2, it.id === "shoot" || it.id === "strawberry" ? ["#5a4026", "#7a5a36", "#3a2a18"] : ["#f4e2b4", "#d9b07a", "#b98a5a"], 10);
    if (info.rarity >= 3) sparkle(x, y - it.s * 0.6, 22);
    if (it.cover) { it.cover.closeAt = time + 4; }
    gain(it.id, x, y - it.s * 0.6);
  }

  /* ================= HUD ================= */
  function renderBasket() {
    const ids = ITEMS.filter((it) => save.basket[it.id]).map((it) => it.id);
    Wd.shareIcons(ids, iconOf);
    basketEl.innerHTML = ids.length
      ? `<span class="b-label">Basket</span>` + ids.map((id) => `<span class="fi"><img src="${iconOf(id)}" alt="${esc(BY[id].name)}" width="20" height="20">${save.basket[id]}</span>`).join("")
      : `<span class="b-label">Your basket is empty</span>`;
  }
  function openJournal() {
    document.getElementById("btnJournal").classList.remove("glint");
    Wd.journal({ title: "Field Journal", sub: "Things found in the woods", items: ITEMS, seen: save.seen, counts: save.basket, iconOf, note: "Everything here grows in its own season — come back when the farm’s clock turns." });
  }
  function lookAround() {
    const marks = [...berries.filter((b) => !b.picked && b.ripe >= 0.75).map((b) => [b.x, b.y - b.s * 0.4]), ...hips.filter((h) => !h.picked && h.ripe >= 0.75).map((h) => [h.x, h.y - h.s * 0.3]), ...items.filter((it) => !it.gone && it.picking == null && ready(it) && !hiddenNow(it)).map((it) => { const [x, y] = P(it.u, it.v); return [x, y - it.s * 0.5]; })];
    const secret = covers.filter((c) => c.off < 0.1 && coverItem(c));
    secret.forEach((c, i) => setTimeout(() => { c.rustle = time + 0.6; const [x, y] = P(c.u, c.v); sparkle(x, y - 10, 5, "200,230,170"); }, 300 + i * 200));
    const growing = items.filter((it) => !it.gone && !ready(it) && !hiddenNow(it)).length;
    if (!marks.length && !secret.length) { toast(growing ? "Things are still growing — give them a little while." : "Nothing ready just now — give the forest a moment.", 2600); return; }
    marks.forEach(([x, y], i) => setTimeout(() => sparkle(x, y, 12), i * 60));
    hint.textContent = `${marks.length} ready to pick${growing ? `, ${growing} still growing` : ""}${secret.length ? ` — and something rustles under ${secret.length > 1 ? "a few rocks and tufts" : "a rock or a tuft"}. Move it to look.` : "."}`;
  }
  function seasonNote() {
    return {
      spring: "Spring: wild strawberries flower, then fruit, along the path; shoots in the bamboo; morels by the old log. Part the grass and roll the rocks — some things hide.",
      summer: "Summer: bayberries blush from green to dark red. Porcini under the pines, chanterelles in the moss — look behind the rocks. Leave the red toadstool alone.",
      autumn: "Autumn: matsutake hide under the needle piles below the pines; shiitake on the log; rose hips turn from green to red.",
      winter: "Winter: brush the snow mounds aside for winter shoots; pine cones and rose hips are ready."
    }[season.name];
  }

  /* ================= sizing & loop ================= */
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return false;
    dpr = Math.min(window.devicePixelRatio || 1, Wd.lowPower ? 1.25 : 1.75);
    if (w === W && h === H && cv.width === Math.round(w * dpr)) return true;
    W = w; H = h; k = Math.min(H / 600, W / 700);
    for (const c of [cv, bg, fg]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    paintBackground(); paintForeground(); makeBerries(); makeHips(); setupParticles();
    rain.drops = Array.from({ length: 140 }, () => ({ x: Math.random() * W * 1.1, y: Math.random() * H }));
    return true;
  }
  function applySeason() {
    document.body.dataset.wildSeason = season.name;
    items = [];
    W = 0; fit();
    setupCovers();
    for (let i = 0; i < 6; i++) spawn(time, true);
    nextSpawn = time + 3;
    hint.textContent = seasonNote();
    Wd.seasonChip(document.getElementById("seasonChip"));
  }

  let last = performance.now(), tick = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (document.hidden || !fit()) return;
    time += dt;
    const calm = Wd.reduce || (window.Sky && Sky.calm);
    if (time > nextSpawn) { spawn(time); nextSpawn = time + (rain.on ? 1.5 : 4) + Math.random() * (rain.on ? 2 : 6); }
    if (!calm && (season.name === "spring" || season.name === "summer")) {
      if (!rain.on && time > rain.next) { rain.on = true; rain.until = time + 16; hint.textContent = "A soft shower passes over — things grow fast after rain."; }
      if (rain.on && time > rain.until) { rain.on = false; rain.next = time + 90 + Math.random() * 90; for (let i = 0; i < 2; i++) spawn(time); }
    }
    updateCovers(dt, time);
    draw(calm ? dt * 0.3 : dt);
    tick += dt;
    if (tick > 1) {
      tick = 0;
      const s = Wd.season();
      if (s.name !== season.name && !drag) { season = s; applySeason(); toast(`${Wd.ICONS[s.name]} The season turns — ${s.name} in the woods.`, 3600); }
      else Wd.seasonChip(document.getElementById("seasonChip"));
    }
  }

  /* ================= input ================= */
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const COVER_TIP = { rock: "Roll the rock aside", grass: "Part the grass", snow: "Brush the snow away", leaves: "Sweep the needles aside" };
  function label(h) {
    if (h === "yuki") return Wild.keeper.name + " · " + Wild.keeper.species;
    if (h.coverHit) return h.coverHit.target > 0.5 ? "Put it back" : COVER_TIP[h.coverHit.kind];
    if (berries.includes(h)) return h.ripe >= 0.75 ? "Wild bayberry" : h.ripe < 0.15 ? "Bayberry blossom" : `Bayberry · ripening ${Math.round((h.ripe / 0.75) * 100)}%`;
    if (hips.includes(h)) return h.ripe >= 0.75 ? "Rose hip" : `Rose hip · ripening ${Math.round((h.ripe / 0.75) * 100)}%`;
    const info = BY[h.id];
    return `${info.name}${info.poison || ready(h) ? "" : ` — growing ${Math.round((h.g / READY) * 100)}%`}`;
  }
  // rocks, tufts, snow and needles can be dragged aside as well as tapped
  let drag = null, swallowClick = false;
  cv.addEventListener("pointerdown", (e) => {
    if (drag || e.isPrimary === false || (e.button != null && e.button !== 0)) return;
    // A suppressed click belongs only to the preceding drag, never the next tap.
    swallowClick = false;
    const [x, y] = local(e), h = hitTest(x, y);
    if (!h || !h.coverHit) return;
    drag = { c: h.coverHit, pointerId: e.pointerId, x0: x, y0: y,
      off0: h.coverHit.off, target0: h.coverHit.target, moved: false, cancelled: false };
    drag.c.drag = true;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = local(e);
    if (drag) {
      if (e.pointerId !== drag.pointerId || drag.cancelled) return;
      const c = drag.c, [, by] = P(c.u, c.v), w = c.w * k * depthScale(by), dx = x - drag.x0, dy = y - drag.y0;
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag.cancelled = true; c.off = drag.off0; c.target = drag.target0;
        return;
      }
      if (Math.abs(dx) > 5 && Math.abs(dx) >= Math.abs(dy)) drag.moved = true;
      if (drag.moved) c.off = clamp(drag.off0 + (drag.off0 > 0.5 ? -1 : 1) * Math.abs(dx) / (c.kind === "rock" ? w * 1.1 : w * 0.6), 0, 1);
      cv.style.cursor = "grabbing";
      return;
    }
    const h = hitTest(x, y);
    hover = h && h.coverHit ? h.coverHit : h;
    cv.style.cursor = h ? (h.coverHit ? "grab" : "pointer") : "default";
    if (h && e.pointerType === "mouse") {
      tip.textContent = label(h);
      const half = tip.offsetWidth / 2 + 8;
      tip.style.left = Math.max(half, Math.min(stage.clientWidth - half, x)) + "px";
      tip.style.top = Math.max(tip.offsetHeight + 24, y) + "px"; tip.classList.add("on");
    }
    else tip.classList.remove("on");
  });
  const endDrag = (e, cancelled = false) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const c = drag.c; c.drag = false;
    if (cancelled || drag.cancelled) { c.off = drag.off0; c.target = drag.target0; }
    else if (drag.moved) { const open = c.off > 0.45; if (open !== (c.target > 0.5)) moveCover(c, open); else c.target = open ? 1 : 0; }
    // A browser-cancelled touch has no compatibility click to suppress.
    swallowClick = !cancelled && (drag.moved || drag.cancelled); drag = null;
  };
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", e => endDrag(e, true));
  cv.addEventListener("lostpointercapture", e => endDrag(e, true));
  cv.addEventListener("pointerleave", () => { hover = null; tip.classList.remove("on"); });
  cv.addEventListener("click", (e) => {
    if (swallowClick) { swallowClick = false; return; }
    const [x, y] = local(e), h = hitTest(x, y);
    if (h) pick(h);
    else sparkle(x, y, 5, "220,230,255");
  });

  document.getElementById("btnBack").addEventListener("click", () => Wd.back("woods"));
  document.getElementById("btnBack2").addEventListener("click", () => Wd.back("woods"));
  document.getElementById("btnJournal").addEventListener("click", openJournal);
  document.getElementById("btnLook").addEventListener("click", lookAround);
  document.getElementById("btnMatcha").addEventListener("click", () => { toast(seasonNote(), 4200); pick("yuki"); });

  function restoreSavedState() {
    const latest = Wd.store.get("wild-woods", { basket: {}, seen: {} }) || {};
    save.basket = latest.basket || {}; save.seen = latest.seen || {};
    renderBasket();
    const current = Wd.season();
    if (current.name !== season.name && !drag) { season = current; applySeason(); }
    else { fit(); Wd.seasonChip(document.getElementById("seasonChip")); }
  }
  addEventListener("pageshow", e => { if (e.persisted) restoreSavedState(); });
  addEventListener("pagehide", () => { if (drag) endDrag({ pointerId: drag.pointerId }, true); });

  Wd.arrive("woods");
  renderBasket();
  applySeason();
  if ("ResizeObserver" in window) new ResizeObserver(() => fit()).observe(stage);
  requestAnimationFrame(frame);
})();
