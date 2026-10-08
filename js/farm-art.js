/* =====================================================================
   Farm art: cartoon animals and seasonal fruit trees, drawn as SVG.
   Animals face right in a 120 × 100 box with their feet at y ≈ 96.
   ===================================================================== */
(function () {
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, "0")).join("");
  };

  /* ---------- a chibi four-legged animal ---------- */
  function quad(o) {
    const body = o.body, head = o.head || body, leg = o.leg || body, paw = o.paw || leg;
    const by = 68, legH = o.legH || 14, ear = o.ear || body, earIn = o.earIn || "#f2b5b5";
    const legs = (x, cls, dark) => {
      const c = dark ? shade(leg, 0.82) : leg, p = dark ? shade(paw, 0.82) : paw;
      return `<g class="${cls}"><rect x="${x}" y="${by + 4}" width="9.5" height="${legH + 6}" rx="4.75" fill="${c}"/><ellipse cx="${x + 4.75}" cy="${by + legH + 9}" rx="5.6" ry="3.2" fill="${p}"/></g>`;
    };
    const tails = {
      long: `<path d="M34 66 C14 64 6 48 14 32 C16 28 20 30 19 34 C14 46 20 58 36 60 Z" fill="${o.tail || body}"/>`,
      ringed: `<path d="M34 66 C12 66 2 48 10 30 C13 25 19 27 18 32 C12 46 18 58 36 59 Z" fill="${o.tail || body}"/>
               <path d="M13 36 l6 2 M10 44 l7 1 M12 52 l7 -1 M18 59 l5 -4" stroke="${o.ring || "#5d636e"}" stroke-width="3.2" stroke-linecap="round"/>`,
      bushy: `<path d="M34 64 C10 72 0 52 8 34 C14 46 24 54 36 56 Z" fill="${o.tail || body}"/><path d="M8 34 C4 42 6 50 12 54 C12 46 10 40 8 34 Z" fill="${o.tailTip || "#fff"}"/>`,
      pom: `<circle cx="31" cy="62" r="7.5" fill="${o.tail || "#fff"}"/>`,
      curl: `<path d="M36 60 C24 60 22 44 32 42 C42 40 44 52 36 54" fill="none" stroke="${o.tail || body}" stroke-width="7.5" stroke-linecap="round"/>`,
      stub: `<circle cx="32" cy="63" r="4.5" fill="${o.tail || body}"/>`
    };
    const ears = {
      point: `<path d="M71 36 L72 13 L87 27 Z" fill="${ear}"/><path d="M89 26 L103 12 L105 35 Z" fill="${ear}"/>
              <path d="M74 31 L75 19 L83 27 Z" fill="${earIn}"/><path d="M92 26 L101 18 L102 31 Z" fill="${earIn}"/>`,
      cat: `<path d="M70 37 Q69 18 74 13 Q80 18 88 27 Z" fill="${ear}"/><path d="M89 26 Q98 16 104 13 Q107 22 106 36 Z" fill="${ear}"/>
            <path d="M73 31 Q73 21 75 18 L83 27 Z" fill="${earIn}"/><path d="M92 26 Q98 20 102 19 Q103 25 103 31 Z" fill="${earIn}"/>
            <path d="M72 16 Q74 12 76 14 L74 19 Z M102 15 Q105 12 105 17 L102 18 Z" fill="${o.earTip || ear}"/>`,
      round: `<circle cx="72" cy="28" r="7.5" fill="${ear}"/><circle cx="103" cy="27" r="7.5" fill="${ear}"/>`,
      long: `<ellipse cx="78" cy="14" rx="5.5" ry="17" transform="rotate(-14 78 14)" fill="${ear}"/><ellipse cx="95" cy="12" rx="5.5" ry="17" transform="rotate(12 95 12)" fill="${ear}"/>
             <ellipse cx="78" cy="15" rx="2.6" ry="12" transform="rotate(-14 78 15)" fill="${earIn}"/><ellipse cx="95" cy="13" rx="2.6" ry="12" transform="rotate(12 95 13)" fill="${earIn}"/>`
    };
    const eye = (x) => o.iris
      ? `<ellipse cx="${x}" cy="44" rx="3.4" ry="4.2" fill="${o.iris}"/><ellipse cx="${x + 0.4}" cy="44.4" rx="1.8" ry="3" fill="#1b1d22"/><circle cx="${x + 1.2}" cy="42.4" r="1.1" fill="#fff"/>`
      : `<ellipse cx="${x}" cy="44" rx="2.9" ry="3.7" fill="#1d1a1a"/><circle cx="${x + 1}" cy="42.6" r="1.1" fill="#fff"/>`;
    return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="96" rx="34" ry="3.5" fill="#000" opacity=".25"/>
      ${legs(36, "leg-b", true)}${legs(74, "leg-a", true)}
      <g class="tail">${tails[o.tailType || "stub"]}</g>
      <ellipse cx="58" cy="${by}" rx="29" ry="17" fill="${body}"/>
      ${o.belly ? `<ellipse cx="62" cy="${by + 7}" rx="19" ry="8.5" fill="${o.belly}"/>` : ""}
      ${o.extra || ""}
      ${legs(43, "leg-a", false)}${legs(81, "leg-b", false)}
      ${ears[o.earType || "point"]}
      <circle cx="88" cy="44" r="21.5" fill="${head}"/>
      ${o.muzzle ? `<ellipse cx="96" cy="53" rx="10.5" ry="7.5" fill="${o.muzzle}"/>` : ""}
      ${o.extraHead || ""}
      <g class="blink">${eye(82)}${eye(98)}</g>
      <path d="M100.5 48.5 h6.5 l-3.25 3.6 z" fill="${o.nose || "#3a2a2a"}" stroke="${o.nose || "#3a2a2a"}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M103.8 52.5 q-2 3 -4.2 1.2 M103.8 52.5 q2 3 4.2 1.2" fill="none" stroke="#4a3434" stroke-width="1.1" stroke-linecap="round"/>
      <ellipse cx="79" cy="53" rx="4" ry="2.4" fill="${o.cheek || "#f3a1a1"}" opacity=".5"/>
    </svg>`;
  }

  const rosettes = (pts, col) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-width="2"/><circle cx="${x + 0.5}" cy="${y + 0.3}" r="${r * 0.35}" fill="${col}" opacity=".55"/>`).join("");

  const ART = {
    snowcat: () => quad({
      body: "#eef0f3", belly: "#fbfcfd", tail: "#e6e9ee", ring: "#6a707c", tailType: "ringed",
      earType: "cat", ear: "#e6e9ee", earIn: "#f5c7cc", earTip: "#5b616c", iris: "#8fd0f0", nose: "#e98f9c", cheek: "#f6b5bd",
      leg: "#e9ecf0", paw: "#f7f8fa",
      extra: rosettes([[42, 60, 3.6], [53, 56, 3.2], [64, 58, 3.5], [48, 70, 3], [70, 67, 3.2], [36, 70, 2.6], [59, 66, 2.4]], "#6a707c"),
      extraHead: `<circle cx="84" cy="30" r="1.4" fill="#6a707c"/><circle cx="89" cy="28" r="1.4" fill="#6a707c"/><circle cx="93" cy="31" r="1.2" fill="#6a707c"/><circle cx="76" cy="36" r="1.2" fill="#6a707c"/>
                  <path d="M108 50 l8 -2 M108 53 l8 1" stroke="#c9ccd2" stroke-width=".9"/>`
    }),
    rabbit: () => quad({ body: "#f7f2ea", belly: "#fffdf8", earType: "long", earIn: "#f3b7c1", tailType: "pom", tail: "#ffffff", nose: "#e88a9a", legH: 9, leg: "#f2ece3" }),
    panda: () => quad({
      body: "#f7f6f2", leg: "#25252a", paw: "#1c1c20", earType: "round", ear: "#25252a", tailType: "stub", tail: "#f2f1ec", nose: "#25252a",
      extra: `<path d="M68 52 C80 54 86 68 82 84 L70 84 C66 72 62 60 68 52 Z" fill="#25252a"/>`,
      extraHead: `<ellipse cx="81" cy="45" rx="5.5" ry="7" transform="rotate(-20 81 45)" fill="#25252a"/><ellipse cx="99" cy="45" rx="5.5" ry="7" transform="rotate(20 99 45)" fill="#25252a"/>`
    }),
    fox: () => quad({
      body: "#e27b36", belly: "#fbefe2", muzzle: "#fbefe2", leg: "#e27b36", paw: "#4b2a1c", ear: "#e27b36", earIn: "#3d2219",
      tailType: "bushy", tail: "#e8823b", tailTip: "#fdf6ee", cheek: "#ffb9a0",
      extraHead: `<path d="M70 50 C76 60 88 62 96 58 C88 64 76 64 70 50 Z" fill="#fbefe2"/>`
    }),
    shiba: () => quad({
      body: "#dc9a52", belly: "#f7e6cb", muzzle: "#f7e6cb", ear: "#dc9a52", earIn: "#f7e6cb", tailType: "curl", tail: "#e3a660", leg: "#dc9a52", paw: "#f7e6cb",
      extraHead: `<ellipse cx="79" cy="38" rx="2.6" ry="1.6" fill="#f7e6cb"/><ellipse cx="96" cy="38" rx="2.6" ry="1.6" fill="#f7e6cb"/><path d="M68 52 C74 62 84 64 92 60 C84 68 72 64 68 52 Z" fill="#f7e6cb"/>`
    }),
    hedgehog: () => `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="96" rx="32" ry="3.5" fill="#000" opacity=".25"/>
      <g class="leg-b"><rect x="44" y="82" width="8" height="12" rx="4" fill="#9a7a62"/></g><g class="leg-a"><rect x="70" y="82" width="8" height="12" rx="4" fill="#9a7a62"/></g>
      <path d="M22 84 L18 72 L26 70 L22 58 L32 60 L30 46 L40 52 L42 38 L50 47 L56 34 L62 45 L70 34 L74 47 L82 40 L84 54 L92 50 L90 64 L98 66 L94 84 Z" fill="#6e5544"/>
      <path d="M30 80 L28 70 L36 70 L34 58 L44 62 L46 50 L54 57 L60 46 L66 56 L74 50 L76 62 L86 60 L86 80 Z" fill="#8a6c56"/>
      <path d="M80 60 C92 54 106 58 112 72 C106 80 92 84 80 82 Z" fill="#f2dcb9"/>
      <circle cx="113" cy="71" r="3.4" fill="#2a1e1a"/>
      <g class="blink"><ellipse cx="98" cy="66" rx="2.6" ry="3.2" fill="#1d1a1a"/><circle cx="99" cy="64.8" r="1" fill="#fff"/></g>
      <circle cx="88" cy="60" r="4" fill="#d9bf98"/>
      <ellipse cx="94" cy="74" rx="3.6" ry="2.2" fill="#f3a1a1" opacity=".5"/>
    </svg>`,
    duckling: () => `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="96" rx="24" ry="3" fill="#000" opacity=".25"/>
      <g class="leg-b"><path d="M52 84 v8 l-5 3 h10 z" fill="#f29a2e"/></g><g class="leg-a"><path d="M64 84 v8 l-5 3 h10 z" fill="#f29a2e"/></g>
      <g class="tail"><path d="M36 66 L26 58 L34 72 Z" fill="#f7cf45"/></g>
      <ellipse cx="58" cy="72" rx="24" ry="17" fill="#ffd94e"/>
      <path d="M44 68 C52 62 64 64 68 72 C60 80 50 80 44 68 Z" fill="#f6c43a"/>
      <circle cx="78" cy="46" r="16" fill="#ffdc55"/>
      <path d="M90 47 C98 45 104 47 104 50 C100 54 94 54 90 52 Z" fill="#f29a2e"/>
      <path d="M74 31 C76 26 80 26 80 30" fill="none" stroke="#f7cf45" stroke-width="2.5" stroke-linecap="round"/>
      <g class="blink"><ellipse cx="84" cy="43" rx="2.6" ry="3.2" fill="#1d1a1a"/><circle cx="85" cy="41.8" r="1" fill="#fff"/></g>
      <ellipse cx="78" cy="52" rx="3.6" ry="2.2" fill="#f7a07a" opacity=".55"/>
    </svg>`,
    penguin: () => `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="96" rx="22" ry="3" fill="#000" opacity=".25"/>
      <g class="leg-b"><ellipse cx="52" cy="93" rx="7" ry="3" fill="#f29a2e"/></g><g class="leg-a"><ellipse cx="68" cy="93" rx="7" ry="3" fill="#f29a2e"/></g>
      <ellipse cx="60" cy="58" rx="24" ry="34" fill="#1f2433"/>
      <ellipse cx="64" cy="64" rx="16" ry="26" fill="#f8f6f0"/>
      <path d="M68 34 C78 30 86 38 84 48 C78 46 70 46 64 44 Z" fill="#f8f6f0"/>
      <g class="tail"><path d="M38 56 C30 64 30 76 36 82 C40 74 42 64 40 56 Z" fill="#1f2433"/></g>
      <path d="M80 60 C88 66 90 76 86 82 C82 74 80 68 78 62 Z" fill="#1f2433"/>
      <path d="M82 42 C90 41 96 43 96 45 C92 48 86 48 82 46 Z" fill="#f29a2e"/>
      <g class="blink"><ellipse cx="76" cy="38" rx="2.5" ry="3" fill="#1d1a1a"/><circle cx="77" cy="37" r="1" fill="#fff"/></g>
      <ellipse cx="74" cy="47" rx="3.5" ry="2" fill="#f3a1a1" opacity=".55"/>
    </svg>`
  };
  const SPECIES = {
    snowcat: { label: "Snow leopard cat", zh: "雪山豹猫", size: 1.3, speed: 2.4 },
    rabbit: { label: "Rabbit", zh: "兔子", size: 0.8, speed: 4, gait: "hop" },
    panda: { label: "Panda", zh: "熊猫", size: 1.12, speed: 1.6 },
    fox: { label: "Fox", zh: "狐狸", size: 0.98, speed: 3.4 },
    shiba: { label: "Shiba Inu", zh: "柴犬", size: 0.95, speed: 3.2 },
    hedgehog: { label: "Hedgehog", zh: "刺猬", size: 0.68, speed: 1.4 },
    duckling: { label: "Duckling", zh: "小鸭", size: 0.66, speed: 2 },
    penguin: { label: "Penguin", zh: "企鹅", size: 0.84, speed: 1.5 }
  };

  /* ---------- fruit trees ---------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const TREES = {
    apple: { label: "Apple", zh: "苹果", blossom: ["#fdf0f3", "#f7d3dd"], fruit: "#d8423a", leafAutumn: ["#6f8a36", "#a78e35", "#c4692d"] },
    peach: { label: "Peach", zh: "桃", blossom: ["#f7a9c0", "#fbd0dc"], fruit: "#f6a77e", leafAutumn: ["#7a8b38", "#b38a37", "#cf7a3a"] },
    orange: { label: "Orange", zh: "橙子", blossom: ["#fffaf0", "#fff1d8"], fruit: "#f39a22", leafAutumn: ["#2f6a3a", "#3f8748", "#4f9a50"] },
    cherry: { label: "Cherry", zh: "樱桃", blossom: ["#f8c6d4", "#fde3eb"], fruit: "#b5162c", leafAutumn: ["#8a7a34", "#c45a2c", "#a83c2a"] }
  };
  const shapes = {};
  function treeShape(seed) {
    if (shapes[seed]) return shapes[seed];
    const r = rng(seed * 7919 + 13), segs = [], tips = [];
    (function grow(x, y, ang, len, w, depth) {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      segs.push([x, y, x2, y2, w]);
      if (depth === 0) { tips.push([x2, y2]); return; }
      const n = depth > 2 ? 2 : 2 + (r() < 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) grow(x2, y2, ang + (i - (n - 1) / 2) * 0.62 + (r() - 0.5) * 0.5, len * (0.7 + r() * 0.1), w * 0.64, depth - 1);
    })(100, 236, -Math.PI / 2 + (r() - 0.5) * 0.12, 60, 13, 4);
    return (shapes[seed] = { segs, tips, r });
  }
  // stage: sapling | winter | spring | summer | autumn ; picked: indices of fruits already taken
  function treeSVG(tree) {
    const T = TREES[tree.type] || TREES.apple, st = tree.stage;
    const { segs, tips } = treeShape(tree.seed);
    const r = rng(tree.seed * 31 + (tree.cycle || 0) * 101 + 7);
    const branches = segs.map(([x1, y1, x2, y2, w]) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#4a3527" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`).join("");
    let canopy = "", extra = "", fruits = "";
    const blob = (cols, rad, n, alpha = 1) => tips.map(([x, y]) => {
      let s = "";
      for (let k = 0; k < n; k++) {
        const a = r() * 6.28, d = r() * rad * 0.8;
        s += `<circle cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d * 0.8).toFixed(1)}" r="${(rad * (0.55 + r() * 0.5)).toFixed(1)}" fill="${cols[(r() * cols.length) | 0]}" opacity="${alpha}"/>`;
      }
      return s;
    }).join("");
    if (st === "winter") {
      extra = segs.filter((s) => s[4] > 2).map(([x1, y1, x2, y2, w]) => `<line x1="${x1.toFixed(1)}" y1="${(y1 - w * 0.35).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y2 - w * 0.35).toFixed(1)}" stroke="#f4f7fb" stroke-width="${(w * 0.42).toFixed(1)}" stroke-linecap="round" opacity=".9"/>`).join("")
        + `<ellipse cx="100" cy="236" rx="44" ry="6" fill="#eef2f8" opacity=".85"/>`;
    } else if (st === "spring") {
      canopy = blob(["#8fc47a", "#a6d38a"], 16, 2, 0.55) + blob(T.blossom, 12, 6);
    } else if (st === "summer") {
      canopy = blob(["#24543a", "#2f6a3a"], 22, 4) + blob(["#3f8748", "#58a35a"], 17, 4);
      fruits = tips.slice(0, 7).map(([x, y]) => `<circle cx="${(x + (r() - 0.5) * 16).toFixed(1)}" cy="${(y + 6 + r() * 6).toFixed(1)}" r="3.2" fill="#a7c75a"/>`).join("");
    } else if (st === "autumn") {
      canopy = blob([shade(T.leafAutumn[0], 0.8), T.leafAutumn[0]], 22, 4) + blob(T.leafAutumn, 17, 4);
      const picked = new Set(tree.picked || []);
      const spots = tips.map(([x, y]) => [x + (r() - 0.5) * 18, y + 4 + r() * 10]);
      fruits = spots.slice(0, tree.fruitN || 8).map(([x, y], i) => picked.has(i) ? "" : fruitSVG(tree.type, x, y, i, T)).join("");
    } else {                                   // sapling
      return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg"><g transform="translate(100 236) scale(.42) translate(-100 -236)">${branches}<g class="canopy">${blob(["#5aa45a", "#7cc06a"], 14, 3)}</g></g></svg>`;
    }
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">${branches}<g class="canopy">${canopy}</g>${extra}${fruits}</svg>`;
  }
  function fruitSVG(type, x, y, i, T) {
    const X = x.toFixed(1), Y = y.toFixed(1);
    let body;
    if (type === "cherry") body = `<path d="M${X} ${Y} q-5 6 -6 12 M${X} ${Y} q4 6 5 12" stroke="#5a3b1e" stroke-width="1.2" fill="none"/><circle cx="${(x - 6).toFixed(1)}" cy="${(y + 14).toFixed(1)}" r="4.6" fill="${T.fruit}"/><circle cx="${(x + 5).toFixed(1)}" cy="${(y + 14).toFixed(1)}" r="4.6" fill="${T.fruit}"/><circle cx="${(x - 7.5).toFixed(1)}" cy="${(y + 12.5).toFixed(1)}" r="1.2" fill="#fff" opacity=".7"/>`;
    else {
      body = `<line x1="${X}" y1="${Y}" x2="${X}" y2="${(y + 4).toFixed(1)}" stroke="#5a3b1e" stroke-width="1.4"/><circle cx="${X}" cy="${(y + 10).toFixed(1)}" r="7" fill="${T.fruit}"/><circle cx="${(x - 2.4).toFixed(1)}" cy="${(y + 7.6).toFixed(1)}" r="1.8" fill="#fff" opacity=".55"/>`;
      if (type === "peach") body += `<path d="M${(x + 1).toFixed(1)} ${(y + 3.5).toFixed(1)} q-3 6 0 13" stroke="#e7806e" stroke-width="1" fill="none"/><circle cx="${(x + 3).toFixed(1)}" cy="${(y + 12).toFixed(1)}" r="3.6" fill="#ef7f8a" opacity=".45"/>`;
      if (type === "apple") body += `<path d="M${X} ${(y + 3).toFixed(1)} q5 -4 8 -1 q-4 3 -8 1z" fill="#5f9a3e"/>`;
    }
    return `<g class="fruit" data-i="${i}">${body}</g>`;
  }
  function fruitIcon(type) {
    const T = TREES[type];
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="9.5" r="5.5" fill="${T.fruit}"/><path d="M8 4 v-2.5" stroke="#5a3b1e" stroke-width="1.3"/><path d="M8 4 q3 -3 5.5 -1 q-3 2.5 -5.5 1z" fill="#5f9a3e"/></svg>`;
  }

  window.FarmArt = { ART, SPECIES, TREES, treeSVG, fruitIcon, treeShape };
})();
