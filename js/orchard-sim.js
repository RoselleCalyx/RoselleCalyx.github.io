/* =====================================================================
   Living orchard: a simulation layer over the painted fruit trees.

   The watercolour sprites (assets/farm/tree-<season>.webp) stay as the
   base and cross-fade between seasons. On top, one canvas per tree
   grows what changes slowly through the season (progress p, 0 → 1):
     spring  buds swell and open one by one; late spring the petals fall
     summer  small green fruit sets and grows; cherries and peaches blush
     autumn  leaves fall more and more and pile up under the tree
     winter  snow builds up along the branches, sometimes slides off,
             and drifts at the foot of the trunk; it melts as spring nears
   Anchor points come from the painting itself: blossoms open where the
   spring painting has blossom, snow settles on the top edge of branches,
   falling leaves take the colour of the painted leaves.
   Everything is drawn in the painting's 320 × 320 coordinates.
   ===================================================================== */
(function () {
  const SRC = { spring: "assets/farm/tree-spring.webp", summer: "assets/farm/tree-summer.webp", autumn: "assets/farm/tree-autumn.webp", winter: "assets/farm/tree-winter.webp" };
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia("(pointer: coarse)").matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const mixRGB = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

  /* ---------- read the paintings ---------- */
  const A = { ground: 302, tops: { winter: [], summer: [] }, blossoms: [], leaves: { autumn: [], summer: [] } };
  let ready = null;
  const speciesArt=new Map();
  function prepareSpecies(type,variant=0){
    if(!window.FarmArt.TREES[type]?.asset)return prepare();
    const key=`${type}:${variant}`;
    if(speciesArt.has(key))return speciesArt.get(key);
    const promise=Promise.all(['summer','autumn','winter'].map(s=>load(FarmArt.treeSrc(type,s,variant)).then(img=>[s,img]))).then(pairs=>{
      const img=Object.fromEntries(pairs),a={ground:302,tops:{summer:[],winter:[]},blossoms:[],leaves:{summer:[],autumn:[]},leafEdges:[]},branches=[];
      for(const s of ['summer','winter'])scan(img[s],(x,y,r,g,b,top,fy,i,j,alpha)=>{
        if(top&&fy<.85&&alpha(i,j+2)>100){
          const edge=col=>{for(let v=j-4;v<=j+4;v++)if(alpha(col,v)>100&&alpha(col,v-2)<40)return v;return j;};
          a.tops[s].push([x,y,Math.atan2(edge(i+3)-edge(i-3),6)]);
        }
        if(s==='summer'&&fy<.82&&g>r*.93&&g>b*1.08){
          const point=[x,y,r,g,b];a.leaves.summer.push(point);
          if(alpha(i-3,j)<80||alpha(i+3,j)<80||alpha(i,j-3)<80||alpha(i,j+3)<80)a.leafEdges.push(point);
        }
        if(s==='summer'&&y>70&&y<235&&r>g*1.12&&r>b*1.2)branches.push([x,y]);
      });
      scan(img.autumn,(x,y,r,g,b,top,fy)=>{if(fy<.82&&r>g*1.05)a.leaves.autumn.push([x,y,r,g,b]);});
      for(const s of ['summer','winter'])a.tops[s]=spread(a.tops[s],5);
      a.leaves.summer=spread(a.leaves.summer,5);a.leaves.autumn=spread(a.leaves.autumn,5);
      a.leafEdges=spread(a.leafEdges,6);
      a.blossoms=a.leaves.summer.map(p=>p.slice(0,2));
      // Hang fruit on this actual plant's foliage/branches, including irregular vine supports.
      const candidates=type==='durian'&&branches.length?branches:a.blossoms;
      const used=[];
      const slots=FarmArt.fruitSlots(type,variant).map(([x,y])=>{
        const points=candidates.filter(p=>used.every(q=>Math.hypot(p[0]-q[0],p[1]-q[1])>23));
        const nearest=(points.length?points:candidates).reduce((best,p)=>!best||Math.hypot(p[0]-x,p[1]-y)<Math.hypot(best[0]-x,best[1]-y)?p:best,null)||[x,y];
        const point=nearest.slice(0,2);used.push(point);return point;
      });
      FarmArt.registerFruitSlots(type,variant,slots);
      return a;
    });speciesArt.set(key,promise);return promise;
  }
  function load(src) {
    return new Promise((ok, bad) => { const i = new Image(); i.decoding = "async"; i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  }
  function scan(img, fn) {
    const N = 256, S = 320 / N;
    const c = document.createElement("canvas"); c.width = c.height = N;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N).data;
    const alpha = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 0 : d[(j * N + i) * 4 + 3]);
    for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
      const k = (j * N + i) * 4;
      if (d[k + 3] < 200) continue;
      fn(i * S, j * S, d[k], d[k + 1], d[k + 2], alpha(i, j - 3) < 40, j / N, i, j, alpha);
    }
  }
  // keep one point per grid cell so anchors spread evenly
  function spread(list, cell) {
    const seen = new Set(), out = [];
    for (const p of list) { const key = Math.floor(p[0] / cell) + "," + Math.floor(p[1] / cell); if (!seen.has(key)) { seen.add(key); out.push(p); } }
    return out;
  }
  function prepare() {
    if (ready) return ready;
    ready = Promise.all(Object.entries(SRC).map(([k, s]) => load(s).then((img) => [k, img]))).then((pairs) => {
      const img = Object.fromEntries(pairs);
      let base = 0;
      const S = 320 / 256, tops = new Map();
      scan(img.winter, (x, y, r, g, b, top, fy, i, j, alpha) => {
        // a branch top thick enough to hold snow
        if (top && fy < 0.8 && alpha(i, j + 2) > 200 && alpha(i, j + 3) > 200) {
          A.tops.winter.push([x, y, i, j]);
          (tops.get(i) || tops.set(i, []).get(i)).push(j);
        }
        if (y > base) base = y;
      });
      // the slope of the branch under each point, from neighbouring top edges
      const near = (i, j) => { const col = tops.get(i); if (!col) return null; let best = null; for (const y of col) if (Math.abs(y - j) <= 3 && (best == null || Math.abs(y - j) < Math.abs(best - j))) best = y; return best; };
      A.tops.winter = A.tops.winter.map(([x, y, i, j]) => {
        const l = near(i - 3, j), r = near(i + 3, j);
        const ang = l != null && r != null ? Math.atan2(r - l, 6) : l != null ? Math.atan2(j - l, 3) : r != null ? Math.atan2(r - j, 3) : 0;
        return [x, y, ang];
      });
      A.ground = base - 4;
      const ctops = new Map();
      scan(img.summer, (x, y, r, g, b, top, fy, i, j, alpha) => {
        // upward-facing, fairly level top of the crown (where snow can settle on an evergreen)
        if (top && fy < 0.62 && alpha(i - 3, j) > 200 && alpha(i + 3, j) > 200 && alpha(i, j + 3) > 200) {
          A.tops.summer.push([x, y, i, j]);
          (ctops.get(i) || ctops.set(i, []).get(i)).push(j);
        }
        if (fy < 0.72 && g > r) A.leaves.summer.push([x, y, r, g, b]);
      });
      scan(img.spring, (x, y, r, g, b, top, fy) => { if (fy < 0.72 && r + g + b > 540 && r >= g) A.blossoms.push([x, y, r, g, b]); });
      scan(img.autumn, (x, y, r, g, b, top, fy) => { if (fy < 0.72 && r > g + 18) A.leaves.autumn.push([x, y, r, g, b]); });
      A.tops.winter = spread(A.tops.winter, 5);
      const cnear = (i, j) => { const col = ctops.get(i); if (!col) return null; let best = null; for (const y of col) if (Math.abs(y - j) <= 3 && (best == null || Math.abs(y - j) < Math.abs(best - j))) best = y; return best; };
      A.tops.summer = spread(A.tops.summer.map(([x, y, i, j]) => { const l = cnear(i - 3, j), r = cnear(i + 3, j); return [x, y, l != null && r != null ? Math.atan2(r - l, 6) : 0]; }), 6);
      A.blossoms = spread(A.blossoms, 5);
      A.leaves.autumn = spread(A.leaves.autumn, 4);
      A.leaves.summer = spread(A.leaves.summer, 4);
      return A;
    });
    return ready;
  }
  function pick(list, n, r) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  }

  /* ---------- small sprites ---------- */
  const FLOWER = {
    cherry: { petal: "#fbd0dc", edge: "#f2a3bb", eye: "#e0607f", bud: "#e57a98" },
    peach: { petal: "#f8b2c6", edge: "#e6799a", eye: "#b8405f", bud: "#d9587c" },
    apple: { petal: "#fff7f6", edge: "#f4c7cf", eye: "#e2b84a", bud: "#ef9fae" },
    orange: { petal: "#fffdf6", edge: "#efe6cf", eye: "#f0c040", bud: "#f4ead2" },
    kiwi:{petal:'#fffbea',edge:'#e8dfb8',eye:'#d8ad31',bud:'#dcd9a0'},
    grape:{petal:'#d8de9b',edge:'#9ba55e',eye:'#c9b458',bud:'#9caf63'},
    durian:{petal:'#fff5d8',edge:'#d9cba3',eye:'#d7b45e',bud:'#d8c698'},
    mango:{petal:'#f7e4b8',edge:'#e0bf82',eye:'#d6a448',bud:'#bf9980'}
  };
  const sprites = {};
  function flowerSprite(type) {
    if (sprites[type]) return sprites[type];
    const f = FLOWER[type], S = 48, c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d"), m = S / 2;
    if(type==='grape'||type==='mango'){
      g.strokeStyle='#8d8956';g.lineWidth=1;g.beginPath();g.moveTo(m,42);g.lineTo(m,5);g.stroke();
      for(let i=0;i<28;i++){const y=8+(i/28)*29,w=3+(i/28)*13,x=m+(i%2?-1:1)*hash(i+29)*w;g.strokeStyle='#a2a071';g.beginPath();g.moveTo(m,y+3);g.lineTo(x,y);g.stroke();g.fillStyle=i%3?f.petal:f.eye;g.beginPath();g.arc(x,y,type==='grape'?1.1:1.5,0,Math.PI*2);g.fill();}
      return sprites[type]=c;
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.save(); g.translate(m + Math.cos(a) * 9.5, m + Math.sin(a) * 9.5); g.rotate(a + Math.PI / 2);
      const gr = g.createRadialGradient(0, 4, 1, 0, 0, 11);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, f.petal); gr.addColorStop(1, f.edge);
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 7.2, 10.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = f.eye; g.beginPath(); g.arc(m, m, 3.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f8e08a";
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.beginPath(); g.arc(m + Math.cos(a) * 5, m + Math.sin(a) * 5, 1, 0, Math.PI * 2); g.fill(); }
    return (sprites[type] = c);
  }
  function butterflySprite(col) {
    const key = "b" + col;
    if (sprites[key]) return sprites[key];
    const c = document.createElement("canvas"); c.width = 32; c.height = 24;
    const g = c.getContext("2d");
    g.fillStyle = col;
    g.beginPath(); g.ellipse(9, 9, 8, 7, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(10, 17, 6, 5, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(8, 8, 2.4, 0, Math.PI * 2); g.fill();
    return (sprites[key] = c);
  }

  /* ---------- what each tree does through the year ---------- */
  const RIPE = { apple: [214, 59, 51], peach: [244, 162, 124], orange: [243, 154, 31], cherry: [179, 20, 43],kiwi:[145,97,63],grape:[114,80,149],durian:[133,146,66],mango:[239,187,69] };
  const GREEN = [190, 206, 96];
  const EVERGREEN = { orange: true,durian:true,mango:true };
  // the painted base: which two sprites to show and how far we are between them
  function base(type, season, p) {
    if (EVERGREEN[type]) return FarmArt.TREES[type].asset?[season,season,0]:["summer", "summer", 0];
    if (season === "spring") return p < 0.6 ? ["winter", "spring", smooth(0.12, 0.42, p)] : ["spring", "summer", smooth(0.62, 0.96, p)];
    if (season === "autumn") return ["summer", "autumn", smooth(0.04, 0.45, p)];
    if (season === "winter") return ["autumn", "winter", smooth(0, 0.2, p)];
    return ["summer", "summer", 0];
  }
  // growing (not yet ripe) fruit; ripe fruit is the clickable SVG layer
  function growth(type, season, p) {
    if(type==='kiwi'||type==='grape')return season==='summer'?{g:.18+.82*p,ripe:.4*smooth(.65,1,p),from:0,to:.25}:null;
    if(type==='durian'||type==='mango')return season==='spring'?{g:smooth(.55,1,p),ripe:.5*smooth(.8,1,p),from:.55,to:.78}:null;
    if (type === "cherry" || type === "peach") return season === "spring" ? { g: smooth(0.55, 1, p), ripe: 0.65 * smooth(0.82, 1, p), from: 0.55, to: 0.82 } : null;
    if (type === "apple") return season === "summer" ? { g: 0.25 + 0.75 * p, ripe: 0.35 * smooth(0.72, 1, p), from: 0, to: 0.3 } : null;
    if (type === "orange") {
      if (season === "summer") return { g: 0.2 + 0.5 * p, ripe: 0, from: 0, to: 0.3 };
      if (season === "autumn") return { g: 0.7 + 0.3 * p, ripe: 0.85 * p, from: 0, to: 0 };
    }
    return null;
  }

  /* ---------- one living tree ---------- */
  const sims = new Set();
  function markup() {
    return `<div class="tree-inner living"><img class="tree-img base-a" alt="" draggable="false"><img class="tree-img base-b" alt="" draggable="false"><canvas class="tree-sim" aria-hidden="true"></canvas><div class="fruit-layer"></div></div>`;
  }
  function attach(tree, el, onReady) {
    const sim = {
      tree, el, a: el.querySelector(".base-a"), b: el.querySelector(".base-b"), cv: el.querySelector(".tree-sim"),
      ctx: null, cw: 0, ch: 0, dpr: 1, flowers: [], caps: [], parts: [], resting: [], flyers: [],
      abs: null, slideT: 0, leafT: 0, petalT: 0, built: false, lastDraw: 0, canopy: null
    };
    sim.ctx = sim.cv.getContext("2d");
    sim.a.src = FarmArt.treeSrc(tree.type,'summer',FarmArt.treeVariant(tree));
    sims.add(sim);
    prepareSpecies(tree.type,FarmArt.treeVariant(tree)).then(a => {if(!sim.el.isConnected)return;sim.anchors=a;build(sim);if(onReady)onReady();}).catch(error => console.error('Orchard texture failed to load',error));
    return sim;
  }
  function detach(tree) { for (const s of sims) if (s.tree === tree) sims.delete(s); }
  function build(sim) {
    const A=sim.anchors;
    const t = sim.tree, r = rng(t.seed * 9973 + 17), k = lowPower ? 0.6 : 1;
    const nFlowers = Math.round((({kiwi:65,grape:48,durian:24,mango:24})[t.type]||(t.type === "cherry" ? 130 : t.type === "orange" ? 50 : 95)) * k);
    const fsrc = t.type==='durian'?FarmArt.fruitSlots(t.type,FarmArt.treeVariant(t)).flatMap(([x,y])=>[[-4,0],[0,4],[4,0]].map(([u,v])=>[x+u,y+v])):t.type==='mango'?A.tops.summer:FarmArt.TREES[t.type].asset?A.blossoms:EVERGREEN[t.type]?A.tops.summer:A.blossoms;
    sim.flowers = pick(fsrc, nFlowers, r).map((p, i) => {
      const bud = 0.02 + r() * 0.22;
      const size=t.type==='grape'?4:t.type==='mango'?13:t.type==='durian'?13:6.5;
      return { x: p[0] + (r() - 0.5) * 3, y: p[1] + (r() - 0.5) * 3, s: size + r() * 4.5, rot: r() * 6.28, bud, open: bud + 0.1 + r() * 0.2, drop: 0.6 + r() * 0.34, dropped: false, ph: r() * 6.28 };
    });
    const csrc = FarmArt.TREES[t.type].asset?A.tops.winter:EVERGREEN[t.type]?A.tops.summer:A.tops.winter;
    sim.caps = pick(csrc, Math.round((EVERGREEN[t.type] ? 80 : 140) * k), r).map(([x, y, ang]) => ({ x, y, ang: ang || 0, start: r() * 0.45, w: 2.2 + r() * 2.2, k: 1 }));
    sim.leafSrc = EVERGREEN[t.type] ? A.leaves.summer : A.leaves.autumn;
    sim.flyers = Array.from({ length: t.type === "cherry" ? 2 : 1 }, (_, i) => ({ ph: r() * 6.28 + i * 2, col: ["#f6e49a", "#bcd6f4", "#fdf7f2", "#f7c6d8"][(r() * 4) | 0] }));
    sim.canopy = buildCanopy(sim);
    sim.built = true;
  }
  function fit(sim) {
    const w = sim.cv.clientWidth, h = sim.cv.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75);
    if (w && (w !== sim.cw || h !== sim.ch || dpr !== sim.dpr)) {
      sim.cw = w; sim.ch = h; sim.dpr = dpr;
      sim.cv.width = Math.round(w * dpr); sim.cv.height = Math.round(h * dpr);
    }
  }
  function spawn(sim, kind, x, y, col, size) {
    if (sim.parts.length > (lowPower ? 90 : 180)) return;
    sim.parts.push({ kind, x, y, col, size, vx: (Math.random() - 0.5) * 8, vy: kind === "clump" ? 10 : 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3, ph: Math.random() * 6.28 });
  }
  function leafShape(g,type,size){
    g.beginPath();
    if(type==='kiwi'){
      g.moveTo(0,size*.6);g.bezierCurveTo(-size*1.7,-size*.3,-size*.6,-size*1.5,0,-size*.6);g.bezierCurveTo(size*.6,-size*1.5,size*1.7,-size*.3,0,size*.6);
    }else if(type==='grape'){
      for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=size*(i%2?.52:1);const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)g.lineTo(x,y);else g.moveTo(x,y);}g.closePath();
    }else{
      const narrow=type==='mango'?.28:type==='durian'?.42:.8;
      g.moveTo(-size,0);g.quadraticCurveTo(0,-size*narrow,size,0);g.quadraticCurveTo(0,size*narrow,-size,0);
    }g.fill();
  }

  /* Cached leaf clusters follow the painted foliage, leaving branch gaps open.
     Only a handful of outer shoots move; density stays the same on phones. */
  const LEAF = {
    apple: { length: 6.2, width: .57 }, peach: { length: 7.4, width: .27 },
    cherry: { length: 6.5, width: .44 }, orange: { length: 6.3, width: .50 },
    kiwi: { length: 7.8, width: .81 }, grape: { length: 7.5, width: .87 },
    durian: { length: 7.4, width: .33 }, mango: { length: 8.5, width: .25 }
  };
  function leafOutline(g, type) {
    g.beginPath();
    if (type === 'kiwi') {
      g.moveTo(0,-.06);g.bezierCurveTo(-.62,.15,-1.12,-.14,-.83,-.53);
      g.bezierCurveTo(-.64,-.83,-.20,-.91,0,-1.06);
      g.bezierCurveTo(.20,-.91,.64,-.83,.83,-.53);
      g.bezierCurveTo(1.12,-.14,.62,.15,0,-.06);
    } else if (type === 'grape') {
      const points=[[0,0],[-.26,-.09],[-.66,-.02],[-.49,-.29],[-.96,-.43],[-.65,-.56],[-.73,-.83],[-.32,-.74],[0,-1.08],[.32,-.74],[.73,-.83],[.65,-.56],[.96,-.43],[.49,-.29],[.66,-.02],[.26,-.09]];
      points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
    } else {
      const bend=type==='mango'?.20:type==='peach'?-.12:.04;
      g.moveTo(0,0);g.bezierCurveTo(-.91,-.24,-.93,-.69,bend,-1.04);
      g.bezierCurveTo(.65,-.83,1,-.30,0,0);
    }
    g.closePath();
  }
  function leafPalette(points, fallback) {
    if (!points.length) return fallback;
    const total=points.reduce((sum,p)=>sum.map((v,i)=>v+p[i+2]),[0,0,0]);
    return total.map(v=>v/points.length);
  }
  function canopyLeaf(type, color, tone) {
    const c=document.createElement('canvas');c.width=64;c.height=80;
    const g=c.getContext('2d'),rgb=(light,warm=0)=>`rgb(${color.map((v,i)=>Math.round(clamp(v*light+(i===2?0:warm),0,255))).join(',')})`;
    const light=.70+tone*.14;
    g.translate(32,70);g.scale(25,56);
    leafOutline(g,type);
    const shade=g.createLinearGradient(-.65,-.90,.65,-.12);
    shade.addColorStop(0,rgb(light*1.24,6));shade.addColorStop(.48,rgb(light));shade.addColorStop(1,rgb(light*.66));
    g.fillStyle=shade;g.fill();
    g.strokeStyle='rgba(20,37,22,.22)';g.lineWidth=.025;g.stroke();
    g.save();g.clip();
    g.strokeStyle='rgba(215,224,170,.29)';g.lineWidth=.022;
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(.05,-.52,type==='mango'?.20:0,-1.02);g.stroke();
    for(let i=1;i<=4;i++){
      const y=-i*.18;
      g.beginPath();g.moveTo(0,y);g.quadraticCurveTo(-.30,y-.12,-.65,y-.13);
      g.moveTo(0,y);g.quadraticCurveTo(.30,y-.10,.65,y-.14);g.stroke();
    }
    g.restore();
    return c;
  }
  function buildCanopy(sim) {
    const a=sim.anchors,t=sim.tree,type=t.type,profile=LEAF[type],source=a.leaves.summer;
    if (!profile||!source.length) return null;
    const r=rng(t.seed*701+FarmArt.treeVariant(t)*977+53),density=.86+r()*.28;
    const colors=leafPalette(source,[78,104,48]);
    const amber=EVERGREEN[type]?colors:leafPalette(a.leaves.autumn,[166,116,49]);
    const palettes=EVERGREEN[type]?[colors]:[colors,amber];
    const sprites=palettes.map(color=>[0,1,2,3,4].map(tone=>canopyLeaf(type,color,tone)));
    const layers=palettes.map(()=>{const c=document.createElement('canvas');c.width=c.height=640;return c;});
    const contexts=layers.map(c=>{const g=c.getContext('2d');g.scale(2,2);return g;});
    const edges=a.leafEdges||[];
    const positions=[...pick(source,Math.round(175*density),r).map(p=>({p,edge:false})),...pick(edges,Math.round(105*density),r).map(p=>({p,edge:true}))];
    const shoots=[];
    for (const {p,edge} of positions) {
      const cluster={x:p[0],y:p[1],ph:r()*Math.PI*2,leaves:[],edge};
      const outward=Math.atan2(p[0]-160,150-p[1]);
      const n=2+(r()>.35?1:0);
      for(let i=0;i<n;i++){
        const length=profile.length*(.66+r()*.52)*(edge?1:.86);
        cluster.leaves.push({x:(r()-.5)*3,y:(r()-.5)*3,length,width:length*profile.width*2,angle:outward+(i-(n-1)/2)*.74+(r()-.5)*.75,tone:clamp(Math.round(2+(160-p[0])/160-p[1]/230+r()*2),0,4),alpha:edge?.86:.53});
      }
      if(edge&&shoots.length<(lowPower?8:14)&&r()>.55)shoots.push(cluster);
      else contexts.forEach((g,i)=>drawLeafCluster(g,cluster,sprites[i],0));
    }
    return {layers,sprites,shoots,density};
  }
  function drawLeafCluster(g,cluster,sprites,sway) {
    g.save();g.translate(cluster.x,cluster.y);g.rotate(sway);
    for (const leaf of cluster.leaves) {
      g.save();g.translate(leaf.x,leaf.y);g.rotate(leaf.angle);
      g.globalAlpha*=leaf.alpha;
      g.drawImage(sprites[leaf.tone],-leaf.width/2,-leaf.length,leaf.width,leaf.length*80/70);
      g.restore();
    }
    g.restore();
  }
  function drawCanopy(sim,time,season,p,calm,wind) {
    const canopy=sim.canopy,type=sim.tree.type;
    if(!canopy)return;
    let fullness=1,amber=0;
    if(!EVERGREEN[type]){
      if(season==='winter'){amber=1;fullness=.35*(1-smooth(0,.2,p));}
      if(season==='spring')fullness=FarmArt.TREES[type].vine?smooth(.12,.48,p):smooth(.52,.94,p);
      if(season==='autumn'){amber=smooth(.04,.45,p);fullness=1-.65*smooth(.55,1,p);}
    }
    if(fullness<.01)return;
    const g=sim.ctx;
    g.save();g.globalAlpha=fullness*(season==='winter'&&EVERGREEN[type]?.72:1);
    for(let i=0;i<canopy.layers.length;i++){
      const opacity=i?amber:1-amber;
      if(opacity<.01)continue;
      g.save();g.globalAlpha*=opacity;g.drawImage(canopy.layers[i],0,0,320,320);
      for(const shoot of canopy.shoots){
        const sway=calm?0:Math.sin(time*1.15+shoot.ph)*.025+wind*.035;
        drawLeafCluster(g,shoot,canopy.sprites[i],sway);
      }
      g.restore();
    }
    g.restore();
  }

  function step(sim, dt, time, season, p, calm, wind) {
    if (!sim.built) return;
    const t = sim.tree, type = t.type;
    const A=sim.anchors;
    // a new season: buds reset, snow comes back
    if (sim.abs !== season.abs) {
      if (sim.abs != null && season.name !== "autumn") sim.resting = sim.resting.filter((q) => q.kind !== "leaf" || Math.random() < 0.3);
      sim.abs = season.abs;
      sim.flowers.forEach((f) => { f.dropped = season.name === "spring" ? p >= f.drop : true; });
      sim.caps.forEach((c) => { c.k = 1; });
    }
    // painted base, cross-faded
    const [ka, kb, mix] = base(type, season.name, p);
    if (sim.ka !== ka) { sim.a.src = FarmArt.treeSrc(type,ka,FarmArt.treeVariant(t)); sim.ka = ka; }
    if (sim.kb !== kb) { sim.b.src = FarmArt.treeSrc(type,kb,FarmArt.treeVariant(t)); sim.kb = kb; }
    // both sprites have transparent backgrounds: hold both opaque through the middle, then let the old one go,
    // so the trunk never turns see-through and old leaves never show through the new picture
    sim.b.style.opacity = Math.min(1, mix * 2).toFixed(3);
    sim.a.style.opacity = Math.min(1, (1 - mix) * 2).toFixed(3);

    if (!calm) {
      // spring: flowers drop their petals one by one
      if (season.name === "spring") for (const f of sim.flowers) {
        if (!f.dropped && p >= f.drop) {
          f.dropped = true;
          const c = FLOWER[type].petal;
          for (let i = 0; i < 3; i++) spawn(sim, "petal", f.x + (Math.random() - 0.5) * 5, f.y, c, 2.6 + Math.random() * 1.4);
        }
      }
      // autumn (and the first days of winter): leaves let go
      if ((season.name === "autumn" || (season.name === "winter" && p < 0.18)) && !EVERGREEN[type] && sim.leafSrc.length) {
        const rate = season.name === "autumn" ? 0.4 + 5 * p * p : 2.5 * (1 - p / 0.18);
        sim.leafT += dt * rate;
        while (sim.leafT > 1) {
          sim.leafT -= 1;
          const q = sim.leafSrc[(Math.random() * sim.leafSrc.length) | 0];
          spawn(sim, "leaf", q[0], q[1], `rgb(${q[2]},${q[3]},${q[4]})`, 3.2 + Math.random() * 2.2);
        }
      }
      if (season.name === "summer" && Math.random() < dt * 0.12 && sim.leafSrc.length) {
        const q = A.leaves.summer[(Math.random() * A.leaves.summer.length) | 0];
        if (q) spawn(sim, "leaf", q[0], q[1], `rgb(${q[2]},${q[3]},${q[4]})`, 3.4);
      }
      // winter: now and then a clump of snow slides off a branch
      if (season.name === "winter" && p > 0.25 && p < 0.85) {
        sim.slideT += dt * 0.22;
        if (sim.slideT > 1) {
          sim.slideT = 0;
          const c = sim.caps[(Math.random() * sim.caps.length) | 0];
          if (c && c.k > 0.8) { c.k = 0.1; spawn(sim, "clump", c.x, c.y, "#f4f7fc", 2 + c.w * 0.6); }
        }
      }
      sim.caps.forEach((c) => { if (c.k < 1) c.k = Math.min(1, c.k + dt * 0.015); });
      // falling things
      const ground = A.ground;
      for (let i = sim.parts.length - 1; i >= 0; i--) {
        const q = sim.parts[i];
        const fall = q.kind === "clump" ? 120 : q.kind === "leaf" ? 26 : 18;
        q.vy += (fall - q.vy) * Math.min(1, dt * (q.kind === "clump" ? 3 : 1.4));
        q.y += q.vy * dt;
        q.x += (q.vx + wind * 6 + (q.kind === "clump" ? 0 : Math.sin(time * 2.2 + q.ph) * 16)) * dt;
        q.rot += q.vr * dt * (q.kind === "clump" ? 0 : 1);
        if (q.y >= ground - Math.random() * 6) {
          sim.parts.splice(i, 1);
          if (q.kind !== "clump") { q.life = 14 + Math.random() * 16; q.y = Math.min(q.y, ground); sim.resting.push(q); }
        }
      }
      for (let i = sim.resting.length - 1; i >= 0; i--) {
        const q = sim.resting[i];
        q.life -= dt * (season.name === "autumn" ? 0.35 : 1);
        if (q.life <= 0) sim.resting.splice(i, 1);
      }
      if (sim.resting.length > 160) sim.resting.splice(0, sim.resting.length - 160);
    }
    // draw at most ~30 fps (a few times a second when calm)
    const minGap = calm ? 1 : 1 / 30;
    if (time - sim.lastDraw < minGap) return;
    sim.lastDraw = time;
    draw(sim, time, season, p, calm, wind);
  }

  function draw(sim, time, season, p, calm, wind) {
    const A=sim.anchors;
    fit(sim);
    const { ctx, cw, dpr } = sim, t = sim.tree, type = t.type;
    if (!cw) return;
    // the canvas overhangs the tree box: 25% each side, 8% above, 8% below
    const k = (cw / 1.5) / 320;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, sim.cv.width, sim.cv.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * cw * (0.25 / 1.5), dpr * (cw / 1.5) * 0.08);
    const ground = A.ground;

    // snow drift at the foot of the tree
    let drift = 0;
    if (season.name === "winter") drift = smooth(0.05, 0.65, p) * (1 - smooth(0.86, 1, p));
    if (drift > 0.01) {
      const rx=22+55*drift,h=3+7*drift;
      ctx.save();ctx.translate(160,ground+3);
      const shade=ctx.createLinearGradient(0,-h,0,h*.5);shade.addColorStop(0,'#fafcff');shade.addColorStop(.55,'#e3ebf5');shade.addColorStop(1,'#bccde3');ctx.fillStyle=shade;
      ctx.beginPath();ctx.moveTo(-rx,2);ctx.bezierCurveTo(-rx*.85,0,-rx*.8,-h*.55,-rx*.5,-h*.5);ctx.bezierCurveTo(-rx*.3,-h*.85,-rx*.15,-h*.45,0,-h);ctx.bezierCurveTo(rx*.25,-h*.85,rx*.3,-h*.25,rx*.53,-h*.45);ctx.bezierCurveTo(rx*.78,-h*.6,rx*.9,1,rx,3);ctx.quadraticCurveTo(rx*.15,h*.75,-rx,2);ctx.fill();
      ctx.restore();
    }
    // leaves and petals resting on the ground
    for (const q of sim.resting) {
      ctx.globalAlpha = clamp(q.life / 4, 0, 1) * 0.95;
      ctx.fillStyle = q.col;
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);ctx.scale(1,.6);
      if(q.kind==='leaf')leafShape(ctx,type,q.size);else{ctx.beginPath();ctx.ellipse(0,0,q.size,q.size*.62,0,0,Math.PI*2);ctx.fill();}ctx.restore();
    }
    ctx.globalAlpha = 1;

    drawCanopy(sim,time,season.name,p,calm,wind);

    // snow building up on the branches
    if (season.name === "winter") {
      const melt = 1 - smooth(0.84, 1, p);
      for (const c of sim.caps) {
        const th = 3.6 * smooth(c.start, c.start + 0.35, p) * melt * c.k;
        if (th < 0.25) continue;
        // a soft ridge of snow lying along the branch
        ctx.save(); ctx.translate(c.x, c.y + 0.6); ctx.rotate(c.ang);
        ctx.fillStyle = "rgba(170,188,218,.8)";
        ctx.beginPath(); ctx.ellipse(0.3, -th * 0.2, c.w + th * 1.1, th * 0.42, 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f7faff";
        ctx.beginPath(); ctx.ellipse(0, -th * 0.28, c.w + th * 1.05, th * 0.55, 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // blossoms: buds swell, open, then drop
    if (season.name === "spring" || (season.name === "winter" && p > 0.9 && !EVERGREEN[type])) {
      const spr = flowerSprite(type), bud = FLOWER[type].bud;
      for (const f of sim.flowers) {
        if (season.name === "winter") {           // the very first buds, late in winter
          const s = smooth(0.9, 1, p) * (f.bud < 0.1 ? 1 : 0);
          if (s > 0) { ctx.fillStyle = bud; ctx.beginPath(); ctx.arc(f.x, f.y, 0.8 * s, 0, Math.PI * 2); ctx.fill(); }
          continue;
        }
        if (p < f.bud || f.dropped) continue;
        const o = smooth(f.bud + 0.04, f.open, p);
        const sway = 1 + 0.04 * Math.sin(time * 1.6 + f.ph);
        if (o < 0.98) {
          ctx.globalAlpha = 1 - o * 0.8;
          ctx.fillStyle = bud;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, 1 + smooth(f.bud, f.bud + 0.05, p) * 1.6, 1.4 + smooth(f.bud, f.bud + 0.05, p) * 2, f.rot, 0, Math.PI * 2); ctx.fill();
        }
        if (o > 0.02) {
          const fade = 1 - smooth(f.drop - 0.04, f.drop, p);
          const s = f.s * (0.35 + 0.65 * o) * sway;
          ctx.globalAlpha = Math.min(1, o * 1.4) * fade;
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot + Math.sin(time * 0.9 + f.ph) * 0.05);
          ctx.drawImage(spr, -s / 2, -s / 2, s, s);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }

    // fruit setting and growing (ripe fruit is the clickable layer above)
    const gr = growth(type, season.name, p);
    if (gr) {
      FarmArt.fruitSlots(type,FarmArt.treeVariant(t)).forEach(([x, y], i) => {
        x += Math.sin(t.seed * 3 + i) * 6; y += Math.cos(t.seed + i) * 5;
        const appear = gr.from + hash(t.seed * 31 + i) * (gr.to - gr.from);
        const size = gr.g * smooth(appear, appear + 0.15, p);
        if (size < 0.04) return;
        const col = mixRGB(GREEN, RIPE[type], gr.ripe * (0.7 + 0.3 * hash(i + t.seed)));
        if(['kiwi','grape','durian','mango'].includes(type)){
          const key=type+Math.round(gr.ripe*16);
          if(!sprites[key]){const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${FarmArt.fruitSVG(type,24,1,0,col)}</svg>`);sprites[key]=img;}
          const img=sprites[key];if(img.complete&&img.naturalWidth)ctx.drawImage(img,x-24*size,y,48*size,48*size);
          return;
        }
        const drawOne = (cx, cy, R) => {
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = Math.max(0.6, R * 0.16); ctx.strokeStyle = "rgba(58,70,22,.7)"; ctx.stroke();
          ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.arc(cx + R * 0.25, cy + R * 0.3, R * 0.75, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(cx - R * 0.35, cy - R * 0.35, R * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#5a3b1e"; ctx.lineWidth = 1.1;
        };
        ctx.strokeStyle = "#5a3b1e"; ctx.lineWidth = 1.1;
        if (type === "cherry") {
          const R = 4.8 * size;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 5, y + 6, x - 6.5, y + 15 - R); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y + 6, x + 5, y + 15 - R); ctx.stroke();
          drawOne(x - 6.5, y + 15, R); drawOne(x + 5, y + 15, R);
        } else {
          const R = 7.4 * size;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 11 - R); ctx.stroke();
          drawOne(x, y + 11, R);
        }
      });
    }

    // butterflies in spring and summer
    if (!calm && (season.name === "spring" || season.name === "summer")) {
      for (const b of sim.flyers) {
        const bx = 160 + Math.sin(time * 0.31 + b.ph) * 95 + Math.sin(time * 0.9 + b.ph) * 18;
        const by = 120 + Math.sin(time * 0.47 + b.ph * 2) * 55;
        const flap = Math.abs(Math.sin(time * 13 + b.ph)) * 0.85 + 0.15;
        const dir = Math.cos(time * 0.31 + b.ph) > 0 ? 1 : -1;
        const spr = butterflySprite(b.col);
        ctx.save(); ctx.translate(bx, by); ctx.scale(dir, 1);
        ctx.globalAlpha = 0.95;
        ctx.save(); ctx.scale(flap, 1); ctx.drawImage(spr, -16, -12, 16, 12); ctx.restore();
        ctx.save(); ctx.scale(-flap, 1); ctx.drawImage(spr, -16, -12, 16, 12); ctx.restore();
        ctx.fillStyle = "#4a3a2c"; ctx.fillRect(-0.6, -6, 1.2, 8);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // things falling right now
    for (const q of sim.parts) {
      ctx.fillStyle = q.col;
      if (q.kind === "clump") { ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill(); continue; }
      const flip = Math.abs(Math.cos(time * 3 + q.ph));
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, 0.3 + flip * 0.7);
      if(q.kind==='leaf')leafShape(ctx,type,q.size);
      else{ctx.beginPath();ctx.ellipse(0,0,q.size,q.size*.62,0,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
  }

  function update(dt, time, season, p, calm, wind) {
    for (const s of sims) {
      if (!s.el.isConnected) { sims.delete(s); continue; }
      step(s, dt, time, season, p, calm, wind || 0);
    }
  }

  window.OrchardSim = { prepare, markup, attach, detach, update };
})();
