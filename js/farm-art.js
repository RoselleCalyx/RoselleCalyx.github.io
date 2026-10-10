/* =====================================================================
   Farm art: painted animal and tree assets with live SVG fruit.
   Shared gradients and flower symbols live in one hidden <svg> (defs()),
   so every animal and tree can reference them by id.
   Animals face right in a 120 × 100 box with their feet at y ≈ 96.
   ===================================================================== */
(function () {
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const toHex = (a) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const shade = (h, k) => toHex(hex(h).map((v) => v * k));
  const tint = (h, k) => toHex(hex(h).map((v) => v + (255 - v) * k));

  /* ---------- species ---------- */
  const SPECIES = {
    snowcat: { label: "Snow leopard cat", size: 1.25, speed: 1.25 },
    rabbit: { label: "Rabbit", size: 0.78, speed: 4, gait: "hop" },
    panda: { label: "Panda", size: 1.12, speed: 0.85 },
    fox: { label: "Fox", size: 0.98, speed: 1.55 },
    shiba: { label: "Shiba Inu", size: 0.95, speed: 1.4 },
    hedgehog: { label: "Hedgehog", size: 0.66, speed: 0.65 },
    duckling: { label: "Duckling", size: 0.64, speed: 1 },
    penguin: { label: "Penguin", size: 0.84, speed: 0.75 },
    redpanda: { label: "Red panda", size: 0.92, speed: 1.05 },
    raccoon: { label: "Raccoon", size: 0.86, speed: 1.15 },
    wolf: { label: "Wolf", size: 1.40, speed: 1.5 },
    crocodile: { label: "Crocodile", size: 1.12, speed: 0.9, habitat: "water" },
    fennec: { label: "Fennec fox", size: 0.78, speed: 1.65 }
  };
  /* ---------- trees ---------- */
  const TREES = {
    apple: { label: "Apple", ripe: "autumn", flower: "fl-white", crown: "round" },
    peach: { label: "Peach", ripe: "summer", flower: "fl-peach", crown: "round" },
    orange: { label: "Orange", ripe: "winter", flower: "fl-white", crown: "dome", evergreen: true },
    cherry: { label: "Cherry blossom", ripe: "summer", flower: "fl-sakura", crown: "wide" },
    kiwi: { label: "Kiwi", ripe: "autumn", flower: "fl-white", crown: "wide", vine: true, asset: true },
    grape: { label: "Grape", ripe: "autumn", flower: "fl-white", crown: "wide", vine: true, asset: true },
    durian: { label: "Durian", ripe: "summer", flower: "fl-white", crown: "tall", evergreen: true, asset: true },
    mango: { label: "Mango", ripe: "summer", flower: "fl-white", crown: "dome", evergreen: true, asset: true }
  };
  const FRUIT = { apple: "#d63b33", peach: "#f4a27c", orange: "#f39a1f", cherry: "#b3142b", kiwi:'#91613f',grape:'#725095',durian:'#859242',mango:'#efbb45' };
  // what each tree looks like in each season
  const PHENO = {
    apple: { winter: { fol: "bare" }, spring: { fol: "bloom" }, summer: { fol: "green", fruit: "unripe" }, autumn: { fol: "autumn", fruit: "ripe" } },
    peach: { winter: { fol: "bare" }, spring: { fol: "bloom" }, summer: { fol: "green", fruit: "ripe" }, autumn: { fol: "autumn" } },
    cherry: { winter: { fol: "bare" }, spring: { fol: "bloom" }, summer: { fol: "green", fruit: "ripe" }, autumn: { fol: "autumn" } },
    orange: { winter: { fol: "green", fruit: "ripe", snowcap: true }, spring: { fol: "green", flowers: true }, summer: { fol: "green", fruit: "unripe" }, autumn: { fol: "green", fruit: "turning" } },
    kiwi: { winter:{fol:'bare'},spring:{fol:'green',flowers:true},summer:{fol:'green',fruit:'unripe'},autumn:{fol:'autumn',fruit:'ripe'} },
    grape: { winter:{fol:'bare'},spring:{fol:'green',flowers:true},summer:{fol:'green',fruit:'unripe'},autumn:{fol:'autumn',fruit:'ripe'} },
    durian: { winter:{fol:'green',snowcap:true},spring:{fol:'green',flowers:true},summer:{fol:'green',fruit:'ripe'},autumn:{fol:'green'} },
    mango: { winter:{fol:'green',snowcap:true},spring:{fol:'green',flowers:true},summer:{fol:'green',fruit:'ripe'},autumn:{fol:'green'} }
  };
  Object.values(TREES).forEach(t=>t.asset=true);
  const treeVariant=tree=>Number.isInteger(tree.variant)&&tree.variant>=0&&tree.variant<3?tree.variant:Math.abs(Math.trunc(tree.seed||0))%3;
  const treeSrc=(type,season,variant=0)=>`assets/farm/trees/${type}-${season}-shape${variant+1}-v2.webp`;
  const FRUIT_SLOTS={
    kiwi:[[64,128],[100,143],[142,126],[181,148],[218,130],[256,142],[83,171],[167,172],[231,173]],
    grape:[[64,132],[96,154],[128,139],[162,162],[196,135],[233,153],[269,134],[114,185],[213,185]],
    durian:[[142,118],[177,140],[127,165],[185,179],[151,202],[170,226]],
    mango:[[77,110],[125,94],[178,106],[229,125],[100,145],[152,148],[203,164],[80,183],[178,190]]
  };
  const alignedFruit=new Map();
  const fruitSlots=(type,variant=0)=>alignedFruit.get(`${type}:${variant}`)||FRUIT_SLOTS[type]||[[91,86],[154,73],[212,104],[115,135],[186,151],[76,161],[240,173],[154,181],[205,199]];
  const registerFruitSlots=(type,variant,slots)=>alignedFruit.set(`${type}:${variant}`,slots);

  /* ---------- shared defs ---------- */
  function radial(id, c, cx = 0.36, cy = 0.3) {
    return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".78"><stop offset="0" stop-color="${tint(c, 0.32)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, 0.66)}"/></radialGradient>`;
  }
  function defsMarkup() {
    let g = "";

    const leaf = { summer: ["#3f8a4a", "#2c6a3a"], spring: ["#8fca78", "#5e9e58"], autumn: ["#d9902e", "#b25a24"], evergreen: ["#2f7444", "#1f5232"], bloom: ["#f7c6d5", "#e597b0"], peach: ["#f59ab6", "#d9718f"], white: ["#fbf3f2", "#e8d6d8"] };
    Object.entries(leaf).forEach(([k, [a, b]]) => {
      g += `<radialGradient id="lf-${k}" cx=".35" cy=".28" r=".8"><stop offset="0" stop-color="${tint(a, 0.25)}"/><stop offset=".6" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
    });
    Object.entries(FRUIT).forEach(([k, c]) => { g += radial(`fr-${k}`, c, 0.34, 0.3); });
    g += radial("fr-unripe", "#9cc35a") + radial("fr-turning", "#c9b23a");
    g += `<linearGradient id="bark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a5840"/><stop offset=".45" stop-color="#5a3f2d"/><stop offset="1" stop-color="#2f2018"/></linearGradient>`;
    g += `<radialGradient id="snowg" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d7e1ef"/></radialGradient>`;
    g += `<radialGradient id="mushcap" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#f26a5a"/><stop offset="1" stop-color="#a82a24"/></radialGradient>`;
    const flower = (id, pet, mid) => `<symbol id="${id}" viewBox="-6 -6 12 12" overflow="visible">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-2.6" rx="1.9" ry="2.7" fill="${pet}" transform="rotate(${a})"/>`).join("")}<circle r="1.1" fill="${mid}"/></symbol>`;
    g += flower("fl-sakura", "#fbd3df", "#e8708f") + flower("fl-peach", "#f6a6bf", "#c94a6e") + flower("fl-white", "#fffaf6", "#f0c040");
    g += `<symbol id="mush" viewBox="-10 -14 20 16" overflow="visible"><path d="M-2.6 0 C-3 -4 -2 -7 -1.6 -8 L1.6 -8 C2 -7 3 -4 2.6 0 Z" fill="#f3e6d2"/><path d="M-9 -7.5 C-9 -13 9 -13 9 -7.5 C5 -6 -5 -6 -9 -7.5 Z" fill="url(#mushcap)"/><circle cx="-4" cy="-10" r="1.3" fill="#fff"/><circle cx="2" cy="-11.3" r="1.1" fill="#fff"/><circle cx="5.2" cy="-8.8" r=".9" fill="#fff"/></symbol>`;
    return g;
  }
  let DEFS = null;
  const defsInner = () => DEFS || (DEFS = defsMarkup());
  function defs() { return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defsInner()}</defs></svg>`; }


  // One cohesive set of generated illustrations, reused in scene, adoption and roster.
  const animalImage = (species) => '<img class="animal-sprite" src="assets/farm/' + (species === 'redpanda' ? 'redpanda-v2' : species) + '.webp" alt="" width="320" height="320" draggable="false" decoding="async">';
  const ART = Object.fromEntries(Object.keys(SPECIES).map(species => [species, () => animalImage(species)]));
  ART.snowcatSit = () => animalImage("snowcat");

  // Original sheets have six frames; the revised cat has eight. FarmMotion
  // selects frames from travelled distance instead of an independent CSS timer.
  const WALK = { snowcat: 0.8, rabbit: 0.7, panda: 1, fox: 0.6, shiba: 0.6, hedgehog: 0.45, duckling: 0.8, penguin: 1, redpanda: 0.85, raccoon: 0.8, wolf: 0.7, crocodile: 1.2, fennec: 0.6 };
  const JUMPS = new Set(['snowcat', 'rabbit', 'panda', 'fox', 'shiba', 'hedgehog', 'duckling', 'penguin']);
  const walkSrc = (species) => FarmMotion.GAITS[species].src || "assets/farm/walk/" + species + ".webp";
  const walkSprite = (species) => {
    const g = FarmMotion.GAITS[species];
    if (!g) return "";
    const style=`background-image:url(${walkSrc(species)});background-size:${g.frames * 100}% 100%;--walk-scale:${g.scale};--walk-offset:${(0.94 - g.baseline) * 100}%`;
    return `<div class="walk-sprite" style="${style}" aria-hidden="true"></div><div class="walk-sprite walk-sprite-next" style="${style}" aria-hidden="true"></div>`;
  };
  const jumpSprite=sp=>{
    if (!JUMPS.has(sp)) return '';
    const g=FarmMotion.GAITS[sp],style=`background-image:url(assets/farm/jump/${sp}-v3.webp);background-size:800% 100%;--walk-scale:${g.scale};--walk-offset:.25%`;
    return `<div class="jump-sprite" style="${style}" aria-hidden="true"></div><div class="jump-sprite jump-sprite-next" style="${style}" aria-hidden="true"></div>`;
  };
  const POSES = Object.fromEntries(Object.keys(SPECIES).map(sp => [sp, {
    sleep: `assets/farm/poses/${sp}-sleep${sp === 'redpanda' ? '-v2' : ''}.webp`,
    ...(sp === 'snowcat' ? Object.fromEntries(['stand', 'stretch', 'sniff'].map(p => [p, `assets/farm/poses/snowcat-${p}.webp`])) : {})
  }]));
  const poseSprite = (species) => Object.entries(POSES[species]).map(([pose, src]) =>
    `<img class="pose-sprite" data-pose="${pose}" src="${src}" alt="" width="384" height="384" draggable="false" decoding="async">`).join('');

  /* ================= fruit trees ================= */

  // Painted tree crowns; fruit remains an interactive SVG layer.
  function treeSVG(tree) {
    const season = tree.season || "summer", T = TREES[tree.type] || TREES.apple;
    const ph = PHENO[tree.type][season], sapling = tree.stage === "sapling";
    if (sapling) {
      const art = '<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg"><path d="M160 303 Q155 274 162 253" fill="none" stroke="#826646" stroke-width="5" stroke-linecap="round"/><path d="M160 278 C136 280 133 263 134 258 C150 255 161 263 160 278 Z M161 264 C166 245 183 245 187 249 C184 262 174 267 161 264 Z" fill="' + (season === "autumn" ? "#b48a4d" : "#89ad78") + '"/><ellipse cx="160" cy="305" rx="22" ry="4" fill="#253329" opacity=".2"/></svg>';
      return { art, fruits: "", ripe: 0 };
    }
    const look = T.evergreen ? "summer" : season;
    const variant=treeVariant(tree),src = treeSrc(tree.type,look,variant);
    const slots = fruitSlots(tree.type,variant);
    const picked = new Set(tree.picked || []);
    let ripe = 0;
    let fruits = ph.fruit ? slots.map(([x,y],i) => {
      x += Math.sin(tree.seed * 3 + i) * 6; y += Math.cos(tree.seed + i) * 5;
      if (ph.fruit !== "ripe") return tree.live ? "" : smallFruit(x,y,ph.fruit === "turning" ? "fr-turning" : "fr-unripe");   // growing fruit is simulated
      if (picked.has(i)) return "";
      ripe++; return fruitSVG(tree.type,x,y,i);
    }).join("") : "";
    if (ph.flowers && !tree.live) fruits += slots.slice(0,6).map(([x,y]) => '<use href="#fl-white" x="'+x+'" y="'+y+'" width="10" height="10"/>').join("");
    return {
      src, art: src,
      fruits: fruits ? '<svg class="fruits" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">' + fruits + '</svg>' : "",
      ripe
    };
  }
  function treeInline(tree) {
    const out = treeSVG(tree);
    if (!out.src) return out.art;
    return '<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg"><image href="' + out.src + '" width="320" height="320"/>' + out.fruits.replace(/^<svg[^>]*>/, "").replace("</svg>", "") + '</svg>';
  }
  const smallFruit = (x, y, g) => `<circle cx="${x.toFixed(1)}" cy="${(y + 6).toFixed(1)}" r="4" fill="url(#${g})"/>`;
  function fruitSVG(type, x, y, i, color) {
    const X = (v) => v.toFixed(1);
    const fill=color||`url(#fr-${type})`;
    let b;
    if(['kiwi','grape','durian','mango'].includes(type)){
      b=`<g transform="translate(${X(x)} ${X(y)})"><path d="M0 0 Q2 5 0 8" stroke="#685133" stroke-width="1.3" fill="none"/>`;
      if(type==='kiwi'){
        b+=`<ellipse cy="17" rx="7.6" ry="10" fill="${fill}" stroke="#765436" stroke-width=".65"/>`;
        for(let j=0;j<32;j++){const a=j*2.4,r=2+(j%7);b+=`<path d="M${X(Math.cos(a)*r*.8)} ${X(17+Math.sin(a)*r)} l.5 -1" stroke="${j%2?'#c4a072':'#64452e'}" stroke-width=".5" opacity=".65"/>`;}
      }else if(type==='grape'){
        [[-5,9],[5,9],[-8,15],[0,15],[8,15],[-5,21],[4,21],[0,27]].forEach(([u,v])=>{b+=`<circle cx="${u}" cy="${v}" r="4.3" fill="${fill}" stroke="#513c68" stroke-width=".6"/><ellipse cx="${u-1.2}" cy="${v-1.4}" rx="1.4" ry=".9" fill="#d6c6e5" opacity=".5"/>`;});
        b+='<path d="M0 4 Q8 -2 10 3 Q3 9 0 4" fill="#668e42"/>';
      }else if(type==='durian'){
        b+=`<ellipse cy="21" rx="11" ry="14" fill="${fill}" stroke="#5a6831" stroke-width="1"/>`;
        for(let j=0;j<52;j++){const a=j*2.399,r=Math.sqrt((j+.5)/52);const u=Math.cos(a)*r*10,v=21+Math.sin(a)*r*13;b+=`<path d="M${X(u-1.5)} ${X(v+1.3)} l1.5 -3.1 1.6 3.1z" fill="${j%3?'#a8b15a':'#626f35'}" stroke="#59632d" stroke-width=".35"/>`;}
        b+='<path d="M1 8 Q-2 20 1 34" stroke="#516032" stroke-width=".6" fill="none"/>';
      }else{
        b+=`<path d="M0 7 C-8 5 -12 14 -9 23 C-7 32 4 34 9 25 C16 14 9 6 0 7Z" fill="${fill}" stroke="#a68437" stroke-width=".7"/><ellipse cx="4" cy="16" rx="5" ry="8" fill="#ef7f49" opacity=".23"/><path d="M-4 11 Q-8 17 -5 23" stroke="#fff1ab" stroke-width="1.5" opacity=".6" fill="none"/>`;
      }
      b+='</g>';
    }else if (type === "cherry") {
      b = `<path d="M${X(x)} ${X(y)} q-5 6 -6.5 13 M${X(x)} ${X(y)} q4 6 5 13" stroke="#5a3b1e" stroke-width="1.3" fill="none"/>
        <circle cx="${X(x - 6.5)}" cy="${X(y + 15)}" r="5" fill="url(#fr-cherry)"/><circle cx="${X(x + 5)}" cy="${X(y + 15)}" r="5" fill="url(#fr-cherry)"/>
        <circle cx="${X(x - 8)}" cy="${X(y + 13.4)}" r="1.4" fill="#fff" opacity=".75"/><circle cx="${X(x + 3.5)}" cy="${X(y + 13.4)}" r="1.4" fill="#fff" opacity=".75"/>`;
    } else {
      b = `<line x1="${X(x)}" y1="${X(y)}" x2="${X(x)}" y2="${X(y + 4)}" stroke="#5a3b1e" stroke-width="1.6"/>
        <circle cx="${X(x)}" cy="${X(y + 11)}" r="7.6" fill="url(#fr-${type})"/>
        <ellipse cx="${X(x - 2.6)}" cy="${X(y + 8)}" rx="2.2" ry="1.5" fill="#fff" opacity=".6"/>`;
      if (type === "peach") b += `<path d="M${X(x + 1)} ${X(y + 4)} q-3.4 6.5 0 14" stroke="#e7806e" stroke-width="1" fill="none"/><circle cx="${X(x + 3)}" cy="${X(y + 13)}" r="4" fill="#ef6f86" opacity=".4"/>`;
      if (type === "orange") b += `<circle cx="${X(x + 2)}" cy="${X(y + 13)}" r=".7" fill="#c46f10"/><circle cx="${X(x - 1)}" cy="${X(y + 15)}" r=".6" fill="#c46f10"/>`;
      b += `<path d="M${X(x)} ${X(y + 3)} q6 -5 10 -1 q-5 3.6 -10 1z" fill="#5f9a3e"/>`;
    }
    return `<g class="fruit" data-i="${i}">${b}</g>`;
  }
  function fruitIcon(type) {
    if(['kiwi','grape','durian','mango'].includes(type))return `<svg viewBox="-17 -3 34 40" aria-hidden="true">${fruitSVG(type,0,0,0)}</svg>`;
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="9.5" r="5.5" fill="url(#fr-${type})"/><path d="M8 4 v-2.5" stroke="#5a3b1e" stroke-width="1.3"/><path d="M8 4 q3 -3 5.5 -1 q-3 2.5 -5.5 1z" fill="#5f9a3e"/></svg>`;
  }

  window.FarmArt = { ART, SPECIES, TREES, PHENO, FRUIT, WALK, JUMPS, POSES, walkSrc, walkSprite, jumpSprite, poseSprite, treeVariant, treeSrc, fruitSlots, registerFruitSlots, fruitSVG, treeSVG, treeInline, fruitIcon, defs };
})();
