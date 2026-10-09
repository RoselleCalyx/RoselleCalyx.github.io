/* =====================================================================
   By the Pond — fishing below the farm.
   The scene is one canvas: a painted sky and far shore, mirrored into
   water that ripples strip by strip, fish shadows gliding under the
   surface, reeds, lily pads, the dock where Yuki sits, and the rod.
   Three ways to fish:
     rod   cast, watch the float, strike on the bite, then hold to reel
           and keep the line's tension in the safe band
     net   a cast net opens over the water and catches what is beneath
     trap  a 地笼 set from a stake soaks for a while (even while you are
           away), then comes up with crabs, crayfish, shrimp and loach
   In winter the pond freezes: there is one hole, for ice fishing.
   ===================================================================== */
(function () {
  const Wd = window.Wild, { esc, toast } = window.Site;
  const { rng, lerp, clamp, smooth, glow } = Wd;
  const stage = document.getElementById("stage"), cv = document.getElementById("scene"), ctx = cv.getContext("2d");
  const tip = document.getElementById("tip"), creelEl = document.getElementById("basket"), hint = document.getElementById("hint");
  const reelEl = document.getElementById("reel"), cardEl = document.getElementById("card");
  const TAU = Math.PI * 2;

  /* ================= what lives here ================= */
  const CATCH = [
    { id: "crucian", name: "Crucian carp", zh: "鲫鱼", rarity: 1, len: [10, 26], fight: 0.3, kind: "fish", text: "The pond’s everyday fish — silver-gold, round and stubborn.", hint: "Rod or net, any season." },
    { id: "carp", name: "Common carp", zh: "鲤鱼", rarity: 2, len: [32, 72], fight: 0.72, kind: "fish", text: "Big scales, two pairs of barbels and one long powerful run.", hint: "On the rod. It pulls hard." },
    { id: "koi", name: "Koi", zh: "锦鲤", rarity: 3, len: [30, 60], fight: 0.55, kind: "fish", text: "Red, white and gold — probably slipped down from the farm pond.", hint: "Rare, on the rod; most often in summer." },
    { id: "goldkoi", name: "Golden koi", zh: "金锦鲤", rarity: 5, len: [48, 72], fight: 0.85, kind: "fish", text: "A legend among anglers. Make a wish before you let it go.", hint: "A summer legend." },
    { id: "catfish", name: "Catfish", zh: "鲶鱼", rarity: 2, len: [35, 85], fight: 0.82, kind: "fish", text: "Whiskered and nocturnal; it pulls like a stubborn ox.", hint: "On the rod, in the warm months." },
    { id: "mandarin", name: "Mandarin fish", zh: "鳜鱼", rarity: 3, len: [25, 46], fight: 0.62, kind: "fish", text: "桃花流水鳜鱼肥 — “peach blossoms on the stream, and the mandarin fish are fat.”", hint: "Rare; best in spring." },
    { id: "bitterling", name: "Bitterling", zh: "鳑鲏", rarity: 1, len: [4, 8], fight: 0.1, kind: "fish", text: "Rainbow-flanked and tiny; it lays its eggs inside freshwater mussels.", hint: "In the net." },
    { id: "minnow", name: "Stone moroko", zh: "麦穗鱼", rarity: 1, len: [5, 11], fight: 0.1, kind: "fish", text: "Quick, small and everywhere in the shallows.", hint: "In the net." },
    { id: "loach", name: "Loach", zh: "泥鳅", rarity: 1, len: [8, 18], fight: 0.2, kind: "fish", text: "Slippery as a rumour; it can breathe air when the water is poor.", hint: "Net or trap." },
    { id: "shrimp", name: "River shrimp", zh: "河虾", rarity: 1, len: [3, 7], fight: 0.05, kind: "crust", text: "Glassy and quick. Delicious, briefly boiled.", hint: "Net or trap." },
    { id: "crayfish", name: "Crayfish", zh: "小龙虾", rarity: 1, len: [8, 14], fight: 0.1, kind: "crust", text: "Red-armoured and indignant, especially in summer.", hint: "In the trap, warm months." },
    { id: "crab", name: "Mitten crab", zh: "大闸蟹", rarity: 2, len: [6, 10], fight: 0.1, kind: "crust", text: "秋风起，蟹脚痒 — “when the autumn wind rises, the crabs’ legs itch.” Hairy claws, golden roe.", hint: "In the trap; best in autumn." },
    { id: "eel", name: "Rice-field eel", zh: "黄鳝", rarity: 3, len: [25, 60], fight: 0.4, kind: "fish", text: "It hides in the mud of the bank by day.", hint: "Rare, in the trap." },
    { id: "lotus", name: "Lotus seed pod", zh: "莲蓬", rarity: 1, len: [0, 0], kind: "plant", text: "Green and full of sweet seeds; the net brought one up with the fish.", hint: "Summer, in the net." },
    { id: "boot", name: "Old boot", zh: "旧靴子", rarity: 1, len: [0, 0], kind: "junk", text: "Someone’s, once. It goes back on the bank to dry.", hint: "Everyone catches one eventually." },
    { id: "bottle", name: "Message in a bottle", zh: "漂流瓶", rarity: 4, len: [0, 0], kind: "junk", text: "There is a note inside: “Whoever finds this — write back.”", hint: "Drifts in now and then." }
  ];
  const BY = Object.fromEntries(CATCH.map((c) => [c.id, c]));
  const ROD = {
    spring: [["crucian", 4], ["carp", 2], ["mandarin", 1.3], ["koi", 0.5], ["bitterling", 0.8], ["boot", 0.3], ["bottle", 0.18]],
    summer: [["crucian", 3], ["carp", 2], ["koi", 1.1], ["catfish", 1.4], ["bitterling", 0.8], ["boot", 0.3], ["bottle", 0.18], ["goldkoi", 0.07]],
    autumn: [["crucian", 3], ["carp", 2.5], ["mandarin", 0.8], ["catfish", 1], ["koi", 0.5], ["boot", 0.3], ["bottle", 0.18]],
    winter: [["crucian", 4], ["carp", 1.2], ["mandarin", 0.4], ["catfish", 0.3], ["boot", 0.2]]
  };
  const NET = {
    spring: [["bitterling", 4], ["minnow", 4], ["shrimp", 3], ["loach", 1.5], ["crucian", 1.4]],
    summer: [["bitterling", 3], ["minnow", 4], ["shrimp", 3], ["loach", 1.5], ["crucian", 1.2], ["lotus", 0.9]],
    autumn: [["bitterling", 3], ["minnow", 3], ["shrimp", 3.5], ["loach", 1.8], ["crucian", 1.4]]
  };
  const TRAP = {
    spring: [["shrimp", 3], ["crayfish", 2], ["loach", 2.5], ["crab", 0.8], ["eel", 0.5], ["boot", 0.2]],
    summer: [["crayfish", 5], ["shrimp", 3], ["loach", 2], ["crab", 1.5], ["eel", 1.1], ["boot", 0.2]],
    autumn: [["crab", 5], ["shrimp", 3], ["loach", 2], ["crayfish", 1], ["eel", 0.6], ["boot", 0.2]]
  };
  const pickFrom = (table) => { const tot = table.reduce((a, [, w]) => a + w, 0); let x = Math.random() * tot; for (const [id, w] of table) if ((x -= w) <= 0) return id; return table[0][0]; };
  function sizeOf(id) {
    const c = BY[id]; if (!c.len[1]) return null;
    const t = Math.pow(Math.random(), 1.6), cm = Math.round(lerp(c.len[0], c.len[1], t) * 10) / 10;
    const kg = c.kind === "fish" ? Math.round(0.0000125 * Math.pow(cm, 3) * 1000) / 1000 : null;
    return { cm, kg };
  }

  /* ================= art: fish, crustaceans, finds ================= */
  const FISH = {
    crucian: { h: 0.42, back: "#5a5a36", side: "#b9a76a", belly: "#efe4bc", fin: "#8a7a4a", tail: "fork" },
    carp: { h: 0.32, back: "#4a3e22", side: "#b08a42", belly: "#efd9a0", fin: "#a0562a", tail: "fork", barbels: true, scales: true, dorsal: "long" },
    koi: { h: 0.3, back: "#ffffff", side: "#ffffff", belly: "#ffffff", fin: "#ffffff", tail: "fork", barbels: true, pattern: "koi", dorsal: "long" },
    goldkoi: { h: 0.3, back: "#f6c445", side: "#ffd66a", belly: "#fff0b8", fin: "#ffdf88", tail: "fork", barbels: true, pattern: "gold", dorsal: "long" },
    catfish: { h: 0.2, back: "#2c2a28", side: "#5a554c", belly: "#cfc7b6", fin: "#3a3632", tail: "round", whiskers: true, flat: true },
    mandarin: { h: 0.34, back: "#5a6a3a", side: "#b6aa6a", belly: "#efe8c6", fin: "#7a6a3a", tail: "round", pattern: "mottle", dorsal: "spiny", mouth: true },
    bitterling: { h: 0.4, back: "#5a7a8a", side: "#c8c8d8", belly: "#f4eaf0", fin: "#e87a8a", tail: "fork", pattern: "rainbow" },
    minnow: { h: 0.24, back: "#6a6a52", side: "#c6c2a6", belly: "#f2eedc", fin: "#9a9474", tail: "fork", pattern: "dots" },
    loach: { h: 0.15, back: "#5a4a2a", side: "#9a8456", belly: "#e6d6a6", fin: "#8a7448", tail: "round", pattern: "dots", whiskers: true, long: true },
    eel: { h: 0.09, back: "#4a3a1a", side: "#a4843e", belly: "#e8c870", fin: "#6a5426", tail: "point", long: true }
  };
  function fishArt(g, x, y, len, id, wig = 0) {
    const f = FISH[id], h = len * f.h, L = len / 2;
    g.save(); g.translate(x, y);
    const body = () => {
      g.beginPath();
      if (f.long) {
        const n = 10; g.moveTo(L, 0);
        for (let i = 0; i <= n; i++) { const t = i / n, px = L - t * len, py = -h * (1 - Math.pow(Math.abs(t - 0.35) / 0.75, 2)) * 0.5 + Math.sin(t * 6 + wig) * h * 0.6 * t; g.lineTo(px, py); }
        for (let i = n; i >= 0; i--) { const t = i / n, px = L - t * len, py = h * (1 - Math.pow(Math.abs(t - 0.35) / 0.75, 2)) * 0.5 + Math.sin(t * 6 + wig) * h * 0.6 * t; g.lineTo(px, py); }
        g.closePath(); return;
      }
      g.moveTo(L, h * 0.05);
      g.bezierCurveTo(L * 0.85, -h * 0.62, -L * 0.3, -h * 0.66, -L * 0.72, -h * 0.12);
      g.lineTo(-L * 0.72, h * 0.12);
      g.bezierCurveTo(-L * 0.3, h * (f.flat ? 0.5 : 0.62), L * 0.8, h * 0.56, L, h * 0.05);
      g.closePath();
    };
    // tail
    if (!f.long) {
      const tw = Math.sin(wig) * h * 0.15;
      g.fillStyle = f.fin; g.beginPath(); g.moveTo(-L * 0.68, 0);
      if (f.tail === "fork") { g.quadraticCurveTo(-L * 0.9, -h * 0.2, -L * 1.05, -h * 0.55 + tw); g.quadraticCurveTo(-L * 0.92, tw, -L * 1.05, h * 0.55 + tw); g.quadraticCurveTo(-L * 0.9, h * 0.2, -L * 0.68, 0); }
      else { g.quadraticCurveTo(-L * 0.85, -h * 0.45, -L * 1.02, -h * 0.32 + tw); g.quadraticCurveTo(-L * 1.08, tw, -L * 1.02, h * 0.32 + tw); g.quadraticCurveTo(-L * 0.85, h * 0.45, -L * 0.68, 0); }
      g.fill();
      // dorsal and pelvic fins
      g.beginPath();
      if (f.dorsal === "long") { g.moveTo(L * 0.25, -h * 0.5); g.quadraticCurveTo(L * 0.05, -h * 0.85, -L * 0.45, -h * 0.4); g.lineTo(L * 0.25, -h * 0.5); }
      else if (f.dorsal === "spiny") { g.moveTo(L * 0.35, -h * 0.48); for (let i = 0; i < 7; i++) g.lineTo(L * (0.3 - i * 0.12), -h * (i % 2 ? 0.62 : 0.82)); g.lineTo(-L * 0.5, -h * 0.35); }
      else { g.moveTo(L * 0.15, -h * 0.52); g.quadraticCurveTo(-L * 0.05, -h * 0.9, -L * 0.25, -h * 0.45); }
      g.fill();
      g.beginPath(); g.moveTo(L * 0.1, h * 0.45); g.quadraticCurveTo(-L * 0.05, h * 0.8, -L * 0.15, h * 0.45); g.fill();
    }
    // the body, shaded dark back to pale belly
    const bg2 = g.createLinearGradient(0, -h * 0.55, 0, h * 0.55);
    bg2.addColorStop(0, f.back); bg2.addColorStop(0.45, f.side); bg2.addColorStop(1, f.belly);
    body(); g.fillStyle = bg2; g.fill();
    g.save(); body(); g.clip();
    if (f.pattern === "koi") {
      g.fillStyle = "#e8401e";
      [[0.35, -0.2, 0.28, 0.32], [-0.1, -0.15, 0.22, 0.3], [-0.45, 0.0, 0.15, 0.25]].forEach(([u, v, rw, rh]) => { g.beginPath(); g.ellipse(u * L, v * h, rw * L, rh * h, 0.3, 0, TAU); g.fill(); });
      g.fillStyle = "#1a1a1a"; [[0.05, -0.32], [-0.28, -0.3]].forEach(([u, v]) => { g.beginPath(); g.ellipse(u * L, v * h, L * 0.06, h * 0.08, 0, 0, TAU); g.fill(); });
    } else if (f.pattern === "gold") {
      g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,240,180,.35)";
      for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(L * (0.6 - (i % 6) * 0.22), h * (-0.25 + Math.floor(i / 6) * 0.22), h * 0.09, 0, TAU); g.fill(); }
      g.globalCompositeOperation = "source-over";
    } else if (f.pattern === "mottle") {
      g.fillStyle = "rgba(40,40,20,.45)";
      for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(L * (0.5 - i * 0.13), h * (Math.sin(i * 2.1) * 0.2 - 0.05), L * 0.07, h * 0.12, 0, 0, TAU); g.fill(); }
    } else if (f.pattern === "rainbow") {
      const rg = g.createLinearGradient(-L, 0, L, 0); rg.addColorStop(0, "rgba(120,200,220,.0)"); rg.addColorStop(0.5, "rgba(160,120,220,.45)"); rg.addColorStop(1, "rgba(240,120,140,.35)");
      g.fillStyle = rg; g.fillRect(-L, -h * 0.05, len, h * 0.16);
    } else if (f.pattern === "dots") {
      g.fillStyle = "rgba(40,30,15,.5)"; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(L * (0.7 - i * 0.11), h * (Math.sin(i * 1.7) * 0.18), h * 0.05, 0, TAU); g.fill(); }
    }
    if (f.scales || f.pattern === "koi" || f.pattern === "gold") {
      g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 0.7;
      for (let c = 0; c < 9; c++) for (let r = -2; r <= 2; r++) { g.beginPath(); g.arc(L * (0.5 - c * 0.13), h * r * 0.2, h * 0.11, -1.2, 1.2); g.stroke(); }
    }
    g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.ellipse(L * 0.2, -h * 0.28, L * 0.45, h * 0.08, -0.05, 0, TAU); g.fill();
    g.restore();
    // gill line, eye, barbels
    if (!f.long) { g.strokeStyle = "rgba(40,30,20,.35)"; g.lineWidth = 1; g.beginPath(); g.arc(L * 0.62, 0, h * 0.42, 2.1, 4.2, true); g.stroke(); }
    const ex = f.long ? L * 0.86 : L * 0.74, ey = -h * (f.flat ? 0.02 : 0.12), er = Math.max(1.2, h * (f.long ? 0.22 : 0.1));
    g.fillStyle = "#f4ecd8"; g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
    g.fillStyle = "#111"; g.beginPath(); g.arc(ex + er * 0.15, ey, er * 0.62, 0, TAU); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(ex - er * 0.15, ey - er * 0.3, er * 0.22, 0, TAU); g.fill();
    if (f.barbels || f.whiskers) {
      g.strokeStyle = f.back; g.lineWidth = Math.max(0.8, h * 0.03);
      const n = f.whiskers ? 2 : 1;
      for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(L * 0.95, h * 0.1); g.quadraticCurveTo(L * 1.1, h * (0.3 + i * 0.2), L * (f.whiskers ? 1.25 : 1.05), h * (0.55 + i * 0.25)); g.stroke(); }
    }
    g.restore();
  }
  const ART = {};
  Object.keys(FISH).forEach((id) => (ART[id] = (g, x, y, s) => fishArt(g, x, y - s * 0.32, s * 1.25, id)));
  ART.shrimp = (g, x, y, s) => {
    g.save(); g.translate(x, y - s * 0.35);
    g.strokeStyle = "rgba(240,180,150,.9)"; g.lineWidth = 1;
    for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(s * 0.32, -s * 0.05); g.quadraticCurveTo(s * 0.6, -s * (0.4 + i * 0.1), s * 0.2, -s * (0.6 + i * 0.1)); g.stroke(); }
    for (let i = 0; i < 6; i++) {
      const t = i / 5, a = -0.3 + t * 2.3, r = s * 0.28;
      const px = Math.cos(a) * r * (1 - t * 0.2) - s * 0.05, py = Math.sin(a) * r * 0.8;
      const sg = g.createRadialGradient(px - 2, py - 2, 1, px, py, s * 0.13);
      sg.addColorStop(0, "rgba(255,230,210,.95)"); sg.addColorStop(1, "rgba(220,140,110,.85)");
      g.fillStyle = sg; g.beginPath(); g.ellipse(px, py, s * (0.13 - t * 0.04), s * 0.09, a + 1.57, 0, TAU); g.fill();
    }
    g.fillStyle = "#222"; g.beginPath(); g.arc(s * 0.3, -s * 0.08, 1.4, 0, TAU); g.fill();
    g.restore();
  };
  ART.crayfish = (g, x, y, s) => {
    g.save(); g.translate(x, y - s * 0.4);
    const red = (a) => { const cg = g.createLinearGradient(0, -s * 0.2, 0, s * 0.2); cg.addColorStop(0, "#e2402a"); cg.addColorStop(1, "#7a140c"); return cg; };
    g.fillStyle = red();
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(-s * 0.08 - i * s * 0.09, 0, s * 0.07, s * 0.1 - i * s * 0.008, 0, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(-s * 0.5, 0); g.lineTo(-s * 0.62, -s * 0.1); g.lineTo(-s * 0.62, s * 0.1); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(s * 0.1, 0, s * 0.16, s * 0.12, 0, 0, TAU); g.fill();
    for (const sd of [-1, 1]) {
      g.strokeStyle = "#a01e12"; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 0.2, sd * s * 0.08); g.quadraticCurveTo(s * 0.35, sd * s * 0.25, s * 0.42, sd * s * 0.28); g.stroke();
      g.fillStyle = red(); g.beginPath(); g.ellipse(s * 0.52, sd * s * 0.3, s * 0.13, s * 0.07, sd * 0.3, 0, TAU); g.fill();
      g.strokeStyle = "#7a140c"; g.lineWidth = 1; for (let l = 0; l < 4; l++) { g.beginPath(); g.moveTo(s * (0.05 - l * 0.06), sd * s * 0.1); g.lineTo(s * (0.0 - l * 0.07), sd * s * 0.24); g.stroke(); }
      g.beginPath(); g.moveTo(s * 0.25, sd * s * 0.04); g.quadraticCurveTo(s * 0.6, sd * s * 0.15, s * 0.75, sd * s * 0.05); g.stroke();
    }
    g.fillStyle = "#111"; g.beginPath(); g.arc(s * 0.24, -s * 0.05, 1.4, 0, TAU); g.arc(s * 0.24, s * 0.05, 1.4, 0, TAU); g.fill();
    g.restore();
  };
  ART.crab = (g, x, y, s) => {
    g.save(); g.translate(x, y - s * 0.38);
    g.strokeStyle = "#4a4224"; g.lineWidth = Math.max(1.4, s * 0.04); g.lineCap = "round";
    for (const sd of [-1, 1]) for (let l = 0; l < 4; l++) { const a = sd * (0.5 + l * 0.32); g.beginPath(); g.moveTo(sd * s * 0.2, s * 0.02); g.lineTo(sd * s * (0.38 + l * 0.03), s * (-0.05 + l * 0.12)); g.lineTo(sd * s * (0.5 + l * 0.02), s * (0.12 + l * 0.12)); g.stroke(); }
    for (const sd of [-1, 1]) {                               // claws, with their famous "mittens"
      g.beginPath(); g.moveTo(sd * s * 0.15, -s * 0.12); g.lineTo(sd * s * 0.3, -s * 0.3); g.stroke();
      g.fillStyle = "#6a5a2a"; g.beginPath(); g.ellipse(sd * s * 0.34, -s * 0.36, s * 0.1, s * 0.07, sd * 0.6, 0, TAU); g.fill();
      g.fillStyle = "rgba(40,30,20,.85)"; g.beginPath(); g.ellipse(sd * s * 0.31, -s * 0.33, s * 0.07, s * 0.05, sd * 0.6, 0, TAU); g.fill();
    }
    const cg = g.createRadialGradient(-s * 0.08, -s * 0.12, s * 0.02, 0, 0, s * 0.3);
    cg.addColorStop(0, "#8a7a46"); cg.addColorStop(1, "#3a3418");
    g.fillStyle = cg; g.beginPath(); g.moveTo(-s * 0.26, s * 0.02); g.quadraticCurveTo(-s * 0.28, -s * 0.2, 0, -s * 0.22); g.quadraticCurveTo(s * 0.28, -s * 0.2, s * 0.26, s * 0.02); g.quadraticCurveTo(0, s * 0.18, -s * 0.26, s * 0.02); g.fill();
    g.fillStyle = "#111"; g.beginPath(); g.arc(-s * 0.06, -s * 0.22, 1.5, 0, TAU); g.arc(s * 0.06, -s * 0.22, 1.5, 0, TAU); g.fill();
    g.restore();
  };
  ART.lotus = (g, x, y, s) => {
    g.strokeStyle = "#4a6a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - s * 0.05, y - s * 0.3, x, y - s * 0.5); g.stroke();
    const lg = g.createLinearGradient(x - s * 0.3, 0, x + s * 0.3, 0); lg.addColorStop(0, "#9ac25a"); lg.addColorStop(1, "#4a7a2a");
    g.fillStyle = lg; g.beginPath(); g.moveTo(x - s * 0.15, y - s * 0.5); g.lineTo(x + s * 0.15, y - s * 0.5); g.lineTo(x + s * 0.32, y - s * 0.86); g.quadraticCurveTo(x, y - s * 0.98, x - s * 0.32, y - s * 0.86); g.closePath(); g.fill();
    g.fillStyle = "#c8dc8a"; g.beginPath(); g.ellipse(x, y - s * 0.88, s * 0.32, s * 0.08, 0, 0, TAU); g.fill();
    g.fillStyle = "#5a7a2a"; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x + Math.cos(i * 0.9) * s * 0.18 * (i ? 1 : 0), y - s * 0.88 + Math.sin(i * 0.9) * s * 0.04, s * 0.03, 0, TAU); g.fill(); }
  };
  ART.boot = (g, x, y, s) => {
    const bg2 = g.createLinearGradient(x, y - s, x, y); bg2.addColorStop(0, "#6a4a30"); bg2.addColorStop(1, "#2a1a10");
    g.fillStyle = bg2; g.beginPath(); g.moveTo(x - s * 0.2, y - s * 0.95); g.lineTo(x + s * 0.12, y - s * 0.95); g.lineTo(x + s * 0.14, y - s * 0.35); g.quadraticCurveTo(x + s * 0.45, y - s * 0.3, x + s * 0.45, y - s * 0.08); g.lineTo(x - s * 0.24, y - s * 0.06); g.closePath(); g.fill();
    g.fillStyle = "#1a120a"; g.fillRect(x - s * 0.26, y - s * 0.08, s * 0.74, s * 0.08);
    g.fillStyle = "rgba(120,170,90,.7)"; g.beginPath(); g.ellipse(x - s * 0.02, y - s * 0.94, s * 0.18, s * 0.05, 0, 0, TAU); g.fill();
  };
  ART.bottle = (g, x, y, s) => {
    g.save(); g.translate(x, y - s * 0.45); g.rotate(-0.5);
    const gg = g.createLinearGradient(-s * 0.15, 0, s * 0.15, 0); gg.addColorStop(0, "rgba(150,220,200,.85)"); gg.addColorStop(1, "rgba(60,130,120,.85)");
    g.fillStyle = gg; g.beginPath(); g.roundRect(-s * 0.16, -s * 0.2, s * 0.32, s * 0.6, s * 0.08); g.fill();
    g.fillRect(-s * 0.06, -s * 0.4, s * 0.12, s * 0.22);
    g.fillStyle = "#a07a4a"; g.fillRect(-s * 0.07, -s * 0.47, s * 0.14, s * 0.09);
    g.fillStyle = "#f4ead0"; g.beginPath(); g.roundRect(-s * 0.08, -s * 0.1, s * 0.16, s * 0.36, 3); g.fill();
    g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(-s * 0.12, -s * 0.15, s * 0.04, s * 0.45);
    g.restore();
  };
  const iconOf = (id) => Wd.icon("pond-" + id, (g, x, y, s) => ART[id](g, x, y - (BY[id].kind === "fish" ? s * 0.08 : 0), BY[id].kind === "fish" ? s * 0.78 : s));

  /* ================= saved state ================= */
  const save = Wd.store.get("wild-pond", { creel: {}, seen: {}, best: {}, traps: [null, null, null] });
  if (!Array.isArray(save.traps)) save.traps = [null, null, null];
  const persist = () => Wd.store.set("wild-pond", save);

  /* ================= scene geometry ================= */
  let W = 0, H = 0, k = 1, dpr = 1, season = Wd.season(), time = 0;
  const bg = document.createElement("canvas"), refl = document.createElement("canvas"), fg = document.createElement("canvas");
  const HZ = 0.4;                                     // the far shore's waterline
  const P = (u, v) => [u * W, v * H];
  const frozen = () => season.name === "winter";
  const HOLE = { u: 0.46, v: 0.69 };
  const STAKES = [{ u: 0.11, v: 0.74 }, { u: 0.3, v: 0.9 }, { u: 0.58, v: 0.75 }];
  const DOCK = { u0: 0.66, u1: 1.02, v0: 0.79 };
  const persp = (y) => clamp((y / H - HZ) / (1 - HZ), 0, 1);   // 0 at the far shore, 1 at our feet
  const scaleAt = (y) => 0.25 + persp(y) * 0.95;
  const inWater = (x, y) => y > H * (HZ + 0.06) && y < H * 0.985 && x > W * 0.02 && x < W * 0.98 && !(x > W * (DOCK.u0 + (1 - y / H) * 0.3) && y > H * DOCK.v0);

  const PAL = {
    spring: { sky: ["#141a3d", "#4a3f74", "#d4949c"], glow: "255,190,190", hills: ["#6f6c9e", "#3e4170"], shore: "#1f3a33", water: "#16304a" },
    summer: { sky: ["#10173a", "#3a3670", "#e09a76"], glow: "255,196,140", hills: ["#6a6896", "#3a3d6a"], shore: "#18332c", water: "#122a44" },
    autumn: { sky: ["#141634", "#40305e", "#d8805a"], glow: "255,170,110", hills: ["#74688e", "#433a62"], shore: "#3a3424", water: "#1a2c40" },
    winter: { sky: ["#0b1230", "#2c3463", "#8a94c4"], glow: "200,215,255", hills: ["#8a90b6", "#4e5684"], shore: "#2a3646", water: "#22344e" }
  };

  /* ================= the static paintings ================= */
  function paintSky(g) {
    const pal = PAL[season.name], r = rng(2468);
    const sky = g.createLinearGradient(0, 0, 0, H * HZ);
    sky.addColorStop(0, pal.sky[0]); sky.addColorStop(0.55, pal.sky[1]); sky.addColorStop(1, pal.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H * HZ + 2);
    for (let i = 0; i < 170; i++) { const y = r() * H * HZ * 0.8; g.fillStyle = `rgba(235,236,255,${(0.2 + r() * 0.7) * (1 - y / (H * HZ))})`; g.fillRect(r() * W, y, r() < 0.1 ? 1.6 : 1, r() < 0.1 ? 1.6 : 1); }
    glow(g, W * 0.42, H * HZ, H * 0.45, pal.glow, 0.32);
    const mx = W * 0.8, my = H * 0.1, mr = 14 * k;
    glow(g, mx, my, mr * 7, "220,230,255", 0.16);
    Wd.moon(g, mx, my, mr);
    pal.hills.forEach((col, i) => {
      const pts = [], mr2 = rng(70 + i);
      for (let x = -10; x <= W + 20; x += 9 * k) {
        const n = Math.sin(x * 0.0045 / k + i * 3) * 0.5 + 0.5, m = Math.abs(Math.sin(x * 0.015 / k + i * 1.3)), j = (mr2() - 0.5) * 0.007;
        pts.push([x, H * (HZ - 0.05 + i * 0.03) - n * H * 0.085 - m * H * 0.04 + j * H]);
      }
      Wd.range(g, pts, H * HZ + 2, col, i ? (season.name === "winter" ? 0.5 : 0) : season.name === "winter" ? 0.95 : 0.65, 22 * k);
    });
    // the far shore: trees, a cottage, lanterns
    const sr = rng(1357);
    g.fillStyle = pal.shore;
    for (let x = -10; x < W + 20; x += (6 + sr() * 9) * k) {
      const h = (14 + sr() * 26) * k, y = H * HZ + 1;
      g.beginPath(); g.moveTo(x - h * 0.3, y); g.lineTo(x, y - h); g.lineTo(x + h * 0.3, y); g.closePath(); g.fill();
      if (season.name === "winter") { g.fillStyle = "rgba(235,240,252,.7)"; g.beginPath(); g.moveTo(x - h * 0.1, y - h * 0.65); g.lineTo(x, y - h); g.lineTo(x + h * 0.1, y - h * 0.65); g.closePath(); g.fill(); g.fillStyle = pal.shore; }
    }
    g.fillRect(0, H * HZ - 3 * k, W, 4 * k);
    const cx = W * 0.2, cy = H * HZ - 2 * k, cw = 34 * k;
    g.fillStyle = "#2a2420"; g.fillRect(cx - cw / 2, cy - cw * 0.5, cw, cw * 0.5);
    g.fillStyle = season.name === "winter" ? "#dfe6f2" : "#3a2a24"; g.beginPath(); g.moveTo(cx - cw * 0.62, cy - cw * 0.48); g.lineTo(cx, cy - cw * 0.95); g.lineTo(cx + cw * 0.62, cy - cw * 0.48); g.closePath(); g.fill();
    g.fillStyle = "#ffcf7a"; g.fillRect(cx - cw * 0.3, cy - cw * 0.34, cw * 0.14, cw * 0.14); g.fillRect(cx + cw * 0.12, cy - cw * 0.34, cw * 0.14, cw * 0.14);
    glow(g, cx, cy - cw * 0.27, cw * 1.2, "255,200,120", 0.25);
    LANTERNS().forEach(([x, y]) => { glow(g, x, y, 12 * k, "255,200,120", 0.5); g.fillStyle = "#ffe2a0"; g.beginPath(); g.arc(x, y, 1.8 * k, 0, TAU); g.fill(); });
  }
  const LANTERNS = () => [[W * 0.2 + 26 * k, H * HZ - 6 * k], [W * 0.38, H * HZ - 5 * k], [W * 0.62, H * HZ - 7 * k], [W * 0.79, H * HZ - 5 * k]];
  function paintBackground() {
    const g = bg.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSky(g);
    const pal = PAL[season.name];
    const wg = g.createLinearGradient(0, H * HZ, 0, H);
    wg.addColorStop(0, pal.water); wg.addColorStop(1, "#060c18");
    g.fillStyle = wg; g.fillRect(0, H * HZ, W, H * (1 - HZ));
    // the mirror image of everything above the waterline
    const rg = refl.getContext("2d");
    rg.setTransform(1, 0, 0, 1, 0, 0);
    rg.clearRect(0, 0, refl.width, refl.height);
    rg.save(); rg.translate(0, Math.round(H * HZ * dpr)); rg.scale(1, -1);
    rg.drawImage(bg, 0, 0, bg.width, Math.round(H * HZ * dpr), 0, 0, bg.width, Math.round(H * HZ * dpr));
    rg.restore();
    rg.globalCompositeOperation = "source-atop";
    const dark = rg.createLinearGradient(0, 0, 0, refl.height);
    dark.addColorStop(0, "rgba(8,16,34,.25)"); dark.addColorStop(1, "rgba(4,10,22,.85)");
    rg.fillStyle = dark; rg.fillRect(0, 0, refl.width, refl.height);
    rg.globalCompositeOperation = "source-over";
    if (frozen()) paintIce(g);
  }
  function paintIce(g) {
    const r = rng(9090);
    const ig = g.createLinearGradient(0, H * HZ, 0, H);
    ig.addColorStop(0, "#9aa8c8"); ig.addColorStop(0.5, "#c6d2e8"); ig.addColorStop(1, "#e6eef8");
    g.fillStyle = ig; g.fillRect(0, H * HZ, W, H);
    g.globalAlpha = 0.22; g.drawImage(refl, 0, 0, refl.width, refl.height, 0, H * HZ, W, H * (1 - HZ)); g.globalAlpha = 1;
    const fade = g.createLinearGradient(0, H * HZ, 0, H);          // the mirror fades as the ice comes closer
    fade.addColorStop(0, "rgba(198,210,232,0)"); fade.addColorStop(0.55, "rgba(206,218,238,.55)"); fade.addColorStop(1, "rgba(230,238,248,.85)");
    g.fillStyle = fade; g.fillRect(0, H * HZ, W, H * (1 - HZ));
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {                         // cracks
      let x = r() * W, y = H * (HZ + 0.05 + r() * 0.55); g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 60 * k; y += (r() - 0.3) * 14 * k; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,.7)"; g.filter = `blur(${2.5 * k}px)`;
    for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(r() * W, H * (HZ + 0.04 + r() * 0.6), (30 + r() * 90) * k * scaleAt(H * 0.7), (3 + r() * 6) * k, 0, 0, TAU); g.fill(); }
    g.filter = "none";
    const [hx, hy] = P(HOLE.u, HOLE.v), hr = 44 * k;
    g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.ellipse(hx, hy, hr * 1.3, hr * 0.42, 0, 0, TAU); g.fill();
    const hg = g.createRadialGradient(hx, hy - hr * 0.1, 2, hx, hy, hr);
    hg.addColorStop(0, "#0a1a30"); hg.addColorStop(1, "#22406a");
    g.fillStyle = hg; g.beginPath(); g.ellipse(hx, hy, hr, hr * 0.3, 0, 0, TAU); g.fill();
  }
  function paintForeground() {
    const g = fg.getContext("2d"), r = rng(5151), snow = frozen();
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // the dock, boards running out over the water
    const y0 = H * DOCK.v0, xl0 = W * DOCK.u0 + W * 0.06, xr0 = W * 1.02, xl1 = W * DOCK.u0 - W * 0.04;
    for (let i = 0; i < 7; i++) {                           // posts
      const t = i / 6, x = lerp(xl0, xl1, t), y = lerp(y0, H, t);
      g.fillStyle = "#1e1610"; g.fillRect(x - 5 * k * (0.6 + t), y - 4 * k, 10 * k * (0.6 + t), 34 * k * (0.6 + t));
    }
    g.beginPath(); g.moveTo(xl0, y0); g.lineTo(xr0, y0 - H * 0.02); g.lineTo(xr0, H + 2); g.lineTo(xl1, H + 2); g.closePath();
    const dg = g.createLinearGradient(0, y0, 0, H); dg.addColorStop(0, "#6a4e34"); dg.addColorStop(1, "#3a2818");
    g.fillStyle = dg; g.fill();
    g.save(); g.clip();
    g.strokeStyle = "rgba(20,12,6,.65)"; g.lineWidth = 1.4;
    for (let i = 1; i < 14; i++) { const t = i / 14, y = lerp(y0, H, t * t * 0.4 + t * 0.6); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y - H * 0.02 * (1 - t)); g.stroke(); }
    g.strokeStyle = "rgba(255,230,190,.08)"; for (let i = 0; i < 30; i++) { const y = y0 + r() * (H - y0); g.beginPath(); g.moveTo(W * 0.62 + r() * W * 0.4, y); g.lineTo(W * 0.62 + r() * W * 0.4 + 30 * k, y); g.stroke(); }
    if (snow) { g.fillStyle = "rgba(238,244,252,.85)"; g.fillRect(0, y0 - 2, W, 8 * k); for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(W * 0.7 + r() * W * 0.3, y0 + r() * (H - y0), 30 * k, 5 * k, 0, 0, TAU); g.fill(); } }
    g.restore();
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(xl0, y0, xr0 - xl0, 3 * k);
    // a lantern on the dock
    const lx = W * 0.95, ly = y0 - 56 * k;
    g.fillStyle = "#2a1e14"; g.fillRect(lx - 2 * k, ly, 4 * k, 54 * k);
    // bank grass in the left corner
    g.fillStyle = snow ? "#dfe7f3" : season.name === "autumn" ? "#4a3e22" : "#1c3020";
    g.beginPath(); g.moveTo(0, H * 0.8); g.quadraticCurveTo(W * 0.12, H * 0.86, W * 0.2, H + 2); g.lineTo(0, H + 2); g.closePath(); g.fill();
    if (!snow) for (let i = 0; i < 70; i++) {                  // grass along the bank
      const t = r(), x = t * W * 0.2, edge = H * 0.8 + (H * 0.2) * Math.pow(t, 1.6), y = edge + r() * (H - edge) + 4 * k;
      for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + (j / 4 - 0.5) * 1.1, L = (9 + r() * 10) * k; g.strokeStyle = season.name === "autumn" ? ["#7a6a34", "#9a7a3a"][j % 2] : ["#3f6a32", "#5a8a42"][j % 2]; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.4, y + Math.sin(a) * L * 0.6, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    }
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,4,10,.5)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  /* ================= living water ================= */
  let shadows = [], ripples = [], parts = [], reeds = [], pads = [], weather = [], flies = [], bubbles = [];
  function makeShadow(anywhere) {
    const id = pickFrom(ROD[season.name].filter(([i]) => BY[i].kind === "fish"));
    const big = BY[id].len[1] > 40;
    let x, y;
    for (let i = 0; i < 30; i++) { x = W * (0.05 + Math.random() * 0.9); y = H * (HZ + 0.1 + Math.random() * 0.48); if (inWater(x, y)) break; }
    return { id, x, y, h: Math.random() * TAU, sp: 0, size: (big ? 42 : 26) * (0.8 + Math.random() * 0.4), wig: Math.random() * TAU, tx: x, ty: y, mode: "wander", until: 0, koi: id === "koi" || id === "goldkoi", alpha: anywhere ? 1 : 0 };
  }
  function setupLife() {
    const r = rng(3131);
    shadows = frozen() ? [] : Array.from({ length: Wd.lowPower ? 6 : 9 }, () => makeShadow(true));
    reeds = [];
    const reedSpots = [[0.0, 0.07, 0.62, 0.92, 26], [0.88, 0.99, 0.5, 0.74, 12], [0.3, 0.38, 0.47, 0.5, 8]];
    reedSpots.forEach(([u0, u1, v0, v1, n]) => { for (let i = 0; i < n; i++) reeds.push({ x: W * lerp(u0, u1, r()), y: H * lerp(v0, v1, r()), h: (60 + r() * 70) * k, ph: r() * TAU, cat: r() < 0.3 }); });
    reeds.sort((a, b) => a.y - b.y);
    pads = [];
    if (!frozen()) [[0.2, 0.56, 6], [0.48, 0.63, 4], [0.7, 0.52, 5], [0.12, 0.83, 3]].forEach(([u, v, n]) => {
      for (let i = 0; i < n; i++) { const x = W * u + (r() - 0.5) * 120 * k, y = H * v + (r() - 0.5) * 30 * k; const s = scaleAt(y); pads.push({ x, y, r: (16 + r() * 12) * k * s, a: r() * TAU, ph: r() * TAU, flower: season.name === "summer" && r() < 0.3, bud: season.name === "spring" && r() < 0.2, yellow: season.name === "autumn" && r() < 0.5 }); }
    });
    const fn = { spring: 10, summer: 26, autumn: 4, winter: 0 }[season.name] * (Wd.lowPower ? 0.5 : 1);
    flies = Array.from({ length: Math.round(fn) }, () => ({ x: Math.random() * W, y: H * (0.3 + Math.random() * 0.5), ph: Math.random() * TAU, sp: 0.4 + Math.random() * 0.6 }));
    const wk = { spring: "petal", summer: "", autumn: "leaf", winter: "snow" }[season.name];
    weather = Array.from({ length: Math.round({ petal: 18, leaf: 20, snow: 100, "": 0 }[wk] * (Wd.lowPower ? 0.5 : 1)) }, () => flake(wk, true));
  }
  function flake(kind, anywhere) {
    const z = Math.random();
    return { kind, x: Math.random() * W * 1.1 - W * 0.05, y: anywhere ? Math.random() * H : -20, z, vy: kind === "snow" ? 20 + z * 50 : 20 + z * 26, vx: kind === "snow" ? 0 : 10 + Math.random() * 18, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 3, ph: Math.random() * TAU, col: kind === "petal" ? ["#fbd3df", "#f7b6c9", "#ffe6ee"][(Math.random() * 3) | 0] : ["#d98a2a", "#b5482a", "#e6b23a", "#a0522d"][(Math.random() * 4) | 0] };
  }
  const ripple = (x, y, size = 1, strength = 1) => ripples.push({ x, y, t: 0, size: size * scaleAt(y), a: strength });
  function splash(x, y, n = 14, power = 1) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 150 * power, vy: -(80 + Math.random() * 160) * power, life: 0.6 + Math.random() * 0.4, age: 0, r: 1 + Math.random() * 1.8, col: "rgba(220,235,255,.9)" });
    ripple(x, y, 1.2 * power); ripple(x, y, 0.6 * power, 0.7);
  }
  function sparkle(x, y, n = 10, col = "255,236,170") {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 30 + Math.random() * 90; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.5, age: 0, r: 1 + Math.random() * 1.5, col: `rgba(${col},1)`, star: true, g: 0 }); }
  }

  /* ================= the tools ================= */
  let tool = "rod";
  const rod = { state: "idle", t0: 0, bob: null, target: null, fish: null, tension: 0.35, progress: 0, slack: 0, nibbles: 0, next: 0, hold: false, surge: 0, hookAt: null };
  let net = null, haul = null, bait = { until: 0 }, busyCard = false;
  const rodBase = () => [W * (W / H < 1.1 ? 0.99 : 0.97), H * 1.04];
  function rodTip() {
    const [bx, by] = rodBase();
    let ang = W / H < 1.1 ? -1.95 : -2.25, bend = 0;                    // steeper on tall screens, clear of Yuki
    if (rod.state === "casting") { const p = (time - rod.t0) / 0.75; ang += p < 0.35 ? -0.5 * smooth(0, 0.35, p) : -0.5 + 0.9 * smooth(0.35, 0.6, p); }
    if (rod.state === "reeling") bend = rod.tension * 0.35 + Math.sin(time * 9) * 0.02 * rod.tension;
    if (rod.state === "bite") bend = 0.12 + Math.sin(time * 30) * 0.03;
    const len = Math.min(Math.max(W * 0.36, H * 0.45), 420 * k);
    return { x: bx + Math.cos(ang - bend * 0.4) * len, y: by + Math.sin(ang - bend * 0.4) * len, ang, bend, len };
  }
  function castTo(x, y) {
    if (frozen()) { [x, y] = P(HOLE.u, HOLE.v); }
    rod.state = "casting"; rod.t0 = time; rod.target = { x, y }; rod.bob = null; rod.fish = null;
    hint.textContent = "The float sails out…";
  }
  function landBobber() {
    rod.state = "waiting"; rod.bob = { x: rod.target.x, y: rod.target.y, dip: 0 };
    splash(rod.bob.x, rod.bob.y, 6, 0.4);
    rod.next = time + (time < bait.until ? 0.6 : 1.2) + Math.random() * (time < bait.until ? 1.2 : 2.6);
    hint.textContent = "Watch the float. Strike when it goes under — not before.";
  }
  function fishApproach() {
    let f = null, best = 1e9;
    shadows.forEach((s) => { if (s.mode === "wander") { const d = Math.hypot(s.x - rod.bob.x, s.y - rod.bob.y); if (d < best) { best = d; f = s; } } });
    if (!f || frozen() || best > 260 * k) {                    // a fish from the deep (or under the ice)
      f = makeShadow(false); f.x = rod.bob.x + (Math.random() - 0.5) * 160 * k; f.y = clamp(rod.bob.y + (Math.random() - 0.5) * 60 * k, H * (HZ + 0.08), H * 0.95); f.hidden = frozen(); shadows.push(f);
    }
    f.id = pickFrom(ROD[season.name]);                        // what is actually on the hook
    f.mode = "approach"; rod.fish = f; rod.nibbles = 1 + ((Math.random() * 3) | 0);
  }
  function strike() {
    if (rod.state === "nibble") { scare("Too early — the fish took fright."); return; }
    if (rod.state !== "bite") return;
    rod.state = "reeling"; rod.tension = 0.45; rod.progress = 0.12; rod.slack = 0; rod.surge = time + 0.6; rod.hookAt = { x: rod.bob.x, y: rod.bob.y };
    splash(rod.bob.x, rod.bob.y, 12, 0.8);
    reelEl.hidden = false;
    hint.textContent = "Hold to reel in · let go when the line grows tight.";
  }
  function scare(msg) {
    if (rod.fish) { rod.fish.mode = "flee"; rod.fish.until = time + 2; if (rod.fish.hidden) shadows = shadows.filter((q) => q !== rod.fish); }
    rod.state = "idle"; rod.bob = null; rod.fish = null; reelEl.hidden = true; rod.hold = false;
    Wd.float(stage, W * 0.5, H * 0.45, msg, "soft");
    hint.textContent = tools.rod.hint;
  }
  function updateRod(dt) {
    if (rod.state === "casting" && time - rod.t0 > 0.75) landBobber();
    if (rod.state === "waiting" && time > rod.next) { fishApproach(); rod.state = "approach"; }
    if (rod.state === "approach") {
      const f = rod.fish;
      if (!f.hidden) { f.tx = rod.bob.x - Math.cos(f.h) * f.size * 0.6 * k; f.ty = rod.bob.y; }
      if (f.hidden || Math.hypot(f.x - rod.bob.x, f.y - rod.bob.y) < f.size * k) { rod.state = "nibble"; rod.next = time + 0.5 + Math.random() * 0.6; }
    }
    if (rod.state === "nibble" && time > rod.next) {
      rod.bob.dip = 1; ripple(rod.bob.x, rod.bob.y, 0.35, 0.6);
      if (--rod.nibbles <= 0) { rod.state = "bite"; rod.t0 = time; rod.bob.dip = 3; splash(rod.bob.x, rod.bob.y, 8, 0.6); Wd.float(stage, rod.bob.x, rod.bob.y - 30, "!", "bang"); }
      else rod.next = time + 0.55 + Math.random() * 0.8;
    }
    if (rod.state === "bite" && time - rod.t0 > (frozen() ? 1.2 : 0.95)) scare("It stole the bait and got away.");
    if (rod.bob) rod.bob.dip = Math.max(rod.state === "bite" ? 2.6 : 0, rod.bob.dip - dt * 4);
    if (rod.state === "reeling") {
      const f = rod.fish, fight = BY[f.id].fight || 0.3;
      if (time > rod.surge) { rod.surge = time + 0.8 + Math.random() * (2.2 - fight); rod.tension += 0.12 + fight * 0.28; rod.progress -= 0.03 * fight; splash(f.x, f.y, 5, 0.5); }
      if (rod.hold) { rod.tension += (0.35 + fight * 0.45) * dt; if (rod.tension > 0.22 && rod.tension < 0.85) rod.progress += (0.2 - fight * 0.08) * dt; }
      else { rod.tension -= 0.55 * dt; rod.progress -= 0.03 * fight * dt; }
      rod.tension = Math.max(0, rod.tension);
      rod.slack = rod.tension < 0.08 ? rod.slack + dt : 0;
      if (rod.tension >= 1) { scare("Snap! The line broke."); return; }
      if (rod.slack > 2.6 || rod.progress < 0) { scare("The hook slipped — it got away."); return; }
      const [ex, ey] = [W * 0.74, H * 0.9];
      f.x = lerp(rod.hookAt.x, ex, rod.progress) + Math.sin(time * 2.3) * 40 * k * (1 - rod.progress);
      f.y = lerp(rod.hookAt.y, ey, rod.progress) + Math.sin(time * 3.1) * 8 * k;
      f.h = Math.atan2(Math.cos(time * 2.3), 1) + Math.PI;
      if (rod.progress >= 1) land();
      renderReel();
    }
  }
  function renderReel() {
    reelEl.style.setProperty("--t", Math.min(1, rod.tension).toFixed(3));
    reelEl.style.setProperty("--p", clamp(rod.progress, 0, 1).toFixed(3));
    reelEl.classList.toggle("danger", rod.tension > 0.85 || rod.tension < 0.1);
    reelEl.classList.toggle("holding", rod.hold);
  }
  function land() {
    const f = rod.fish;
    reelEl.hidden = true; rod.state = "landed"; rod.hold = false;
    splash(f.x, f.y, 22, 1.2);
    shadows = shadows.filter((s) => s !== f);
    setTimeout(() => { if (!frozen()) shadows.push(makeShadow(false)); }, 4000);
    showCatch([{ id: f.id, ...(sizeOf(f.id) || {}) }], "rod", f.x, f.y);
  }

  /* ---------- the cast net ---------- */
  function throwNet(x, y) {
    if (net || frozen()) return;
    const s = scaleAt(y);
    net = { x, y, r: 96 * k * s, t0: time, phase: "fly", caught: [] };
    hint.textContent = "The net opens like a flower over the water…";
  }
  function updateNet() {
    if (!net) return;
    const t = time - net.t0;
    if (net.phase === "fly" && t > 0.8) {
      net.phase = "sink"; net.t1 = time;
      splash(net.x, net.y, 18, 0.9); ripple(net.x, net.y, net.r / (40 * k), 1);
      shadows.forEach((s) => { if (((s.x - net.x) / net.r) ** 2 + ((s.y - net.y) / (net.r * 0.34)) ** 2 < 1) { s.mode = "trapped"; net.caught.push(s); } });
    }
    if (net.phase === "sink" && time - net.t1 > 1.3) { net.phase = "pull"; net.t2 = time; }
    if (net.phase === "pull" && time - net.t2 > 0.9) {
      const got = net.caught.map((s) => ({ id: BY[s.id].len[1] > 40 && Math.random() < 0.5 ? "crucian" : s.id }));
      net.caught.forEach((s) => { shadows = shadows.filter((q) => q !== s); setTimeout(() => shadows.push(makeShadow(false)), 5000 + Math.random() * 4000); });
      const n = 2 + ((Math.random() * 3) | 0) + (time < bait.until ? 1 : 0);
      for (let i = 0; i < n; i++) got.push({ id: pickFrom(NET[season.name]) });
      const at = { x: net.x, y: net.y };
      net = null;
      showCatch(got.map((g) => ({ ...g, ...(sizeOf(g.id) || {}) })), "net", at.x, at.y);
    }
  }
  function drawNet() {
    if (!net) return;
    const t = time - net.t0, [bx, by] = [W * 0.86, H * 0.82];
    let x = net.x, y = net.y, r = net.r, open = 1, a = 1, lift = 0;
    if (net.phase === "fly") { const p = smooth(0, 0.8, t); x = lerp(bx, net.x, p); y = lerp(by, net.y, p) - Math.sin(p * Math.PI) * 120 * k; open = smooth(0.15, 0.85, p); a = 0.95; }
    if (net.phase === "sink") a = 0.75 - 0.35 * smooth(0, 1.3, time - net.t1);
    if (net.phase === "pull") { const p = smooth(0, 0.9, time - net.t2); open = 1 - p * 0.85; lift = p * 50 * k; a = 0.5 + p * 0.4; x = lerp(net.x, bx, p * 0.7); y = lerp(net.y, by, p * 0.7); if (Math.random() < 0.5) parts.push({ x: x + (Math.random() - 0.5) * r * open, y: y - lift, vx: 0, vy: 20, life: 0.5, age: 0, r: 1.2, col: "rgba(220,235,255,.8)" }); }
    const rx = r * open, ry = r * 0.34 * open + (net.phase === "fly" ? r * 0.25 * (1 - open) : 0);
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = "rgba(235,228,205,.75)"; ctx.lineWidth = 0.8;
    const top = [x, y - lift - (net.phase === "pull" ? 40 * k : 0)];
    for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(x + Math.cos(an) * rx, y - lift + Math.sin(an) * ry); ctx.stroke(); }
    for (let ring = 1; ring <= 4; ring++) { ctx.beginPath(); ctx.ellipse(lerp(top[0], x, ring / 4), lerp(top[1], y - lift, ring / 4), rx * ring / 4, ry * ring / 4, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = "#c8c0a8";
    for (let i = 0; i < 20; i++) { const an = (i / 20) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(an) * rx, y - lift + Math.sin(an) * ry, 1.8 * k * scaleAt(y), 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- the crab traps ---------- */
  const trapState = (i) => { const tr = save.traps[i]; if (!tr) return "free"; return Date.now() >= tr.t0 + tr.dur ? "ready" : "soaking"; };
  function setTrap(i) {
    if (frozen()) { toast("The pond is frozen — traps can wait for spring.", 2800); return; }
    save.traps[i] = { t0: Date.now(), dur: (40 + Math.random() * 30) * 1000, splash: time };
    persist();
    const [x, y] = trapFloat(i);
    splash(x, y, 14, 0.8);
    for (let b = 0; b < 8; b++) bubbles.push({ x: x + (Math.random() - 0.5) * 20 * k, y, t: -Math.random() * 1.5 });
    Wd.float(stage, x, y - 30, "Set! Come back in a minute", "soft");
    hint.textContent = "The trap is soaking. It keeps working even if you wander off.";
  }
  function haulTrap(i) {
    const [x, y] = trapFloat(i);
    save.traps[i] = null; persist();
    haul = { i, t0: time, x, y };
    splash(x, y, 20, 1);
    const n = 2 + ((Math.random() * 3) | 0);
    const got = []; for (let j = 0; j < n; j++) got.push({ id: pickFrom(TRAP[season.name] || TRAP.autumn) });
    setTimeout(() => { haul = null; showCatch(got.map((g) => ({ ...g, ...(sizeOf(g.id) || {}) })), "trap", x, y); }, Wd.reduce ? 0 : 1300);
  }
  const trapFloat = (i) => { const s = STAKES[i]; return [W * s.u + 52 * k * scaleAt(H * s.v) * (s.u < 0.5 ? 1 : -1), H * s.v - 22 * k * scaleAt(H * s.v)]; };
  function drawTraps() {
    STAKES.forEach((s, i) => {
      const [x, y] = P(s.u, s.v), sc = scaleAt(y), st = trapState(i);
      ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x - 3 * k * sc, y - 46 * k * sc, 6 * k * sc, 52 * k * sc);
      ctx.fillStyle = "#5a4028"; ctx.fillRect(x - 4 * k * sc, y - 48 * k * sc, 8 * k * sc, 5 * k * sc);
      if (st === "free") {
        if (hoverTrap === i || (tool === "trap" && !frozen())) { ctx.globalCompositeOperation = "lighter"; glow(ctx, x, y - 30 * k * sc, 30 * k * sc, "255,230,170", hoverTrap === i ? 0.4 : 0.15 + 0.1 * Math.sin(time * 3)); ctx.globalCompositeOperation = "source-over"; }
        return;
      }
      const [fx, fy] = trapFloat(i), bob = Math.sin(time * 2 + i) * 2 * k * sc + (st === "ready" ? Math.sin(time * 8) * 2 * k : 0);
      if (haul && haul.i === i) return;
      ctx.strokeStyle = "rgba(220,200,160,.7)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 40 * k * sc); ctx.quadraticCurveTo((x + fx) / 2, fy + 6 * k, fx, fy + bob); ctx.stroke();
      ctx.fillStyle = "#e8642a"; ctx.beginPath(); ctx.ellipse(fx, fy + bob, 6 * k * sc, 4 * k * sc, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff4e0"; ctx.beginPath(); ctx.ellipse(fx, fy + bob - 2 * k * sc, 6 * k * sc, 1.6 * k * sc, 0, 0, TAU); ctx.fill();
      if (Math.random() < 0.02) ripple(fx, fy, 0.4, 0.5);
      // a timer ring above the stake
      const tr = save.traps[i], p = clamp((Date.now() - tr.t0) / tr.dur, 0, 1), cx = x, cy = y - 66 * k * sc, rr = 11 * k * Math.max(sc, 0.7);
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = st === "ready" ? "#ffd27a" : "rgba(244,226,180,.9)"; ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
      if (st === "ready") { ctx.globalCompositeOperation = "lighter"; glow(ctx, cx, cy, rr * 3, "255,210,120", 0.35 + 0.2 * Math.sin(time * 5)); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#3a2410"; ctx.font = `600 ${Math.round(rr * 1.3)}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", cx, cy + 1); }
      if (hoverTrap === i) { ctx.globalCompositeOperation = "lighter"; glow(ctx, x, y - 30 * k * sc, 34 * k * sc, "255,230,170", 0.35); ctx.globalCompositeOperation = "source-over"; }
    });
    if (haul) {                                               // the 地笼 comes up dripping
      const p = smooth(0, 1.2, time - haul.t0), s = STAKES[haul.i], [sx, sy] = P(s.u, s.v), sc = scaleAt(sy);
      const x = lerp(haul.x, sx, p * 0.6), y = lerp(haul.y, sy - 30 * k * sc, p) - Math.sin(p * Math.PI) * 30 * k;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2);
      const L = 110 * k * sc, R = 14 * k * sc;
      ctx.fillStyle = "rgba(40,70,50,.55)"; ctx.fillRect(-L / 2, -R, L, R * 2);
      ctx.strokeStyle = "rgba(170,210,170,.8)"; ctx.lineWidth = 1.4;
      for (let h = 0; h <= 6; h++) { ctx.beginPath(); ctx.ellipse(-L / 2 + (L * h) / 6, 0, R * 0.35, R, 0, 0, TAU); ctx.stroke(); }
      ctx.lineWidth = 0.6; for (let l = -2; l <= 2; l++) { ctx.beginPath(); ctx.moveTo(-L / 2, (l * R) / 2.2); ctx.lineTo(L / 2, (l * R) / 2.2); ctx.stroke(); }
      ctx.restore();
      if (Math.random() < 0.6) parts.push({ x: x + (Math.random() - 0.5) * 100 * k * sc, y: y + 10 * k, vx: 0, vy: 30, life: 0.5, age: 0, r: 1.3, col: "rgba(220,235,255,.85)" });
    }
  }

  /* ================= Yuki keeps you company on the dock ================= */
  const yuki = new Image(); yuki.src = "assets/farm/snowcat.webp";
  const yukiBox = () => { const h = 108 * k, x = W * 0.745, y = H * 0.9; return { x: x - h / 2, y: y - h, w: h, h, cx: x, cy: y - h / 2 }; };
  const YUKI = ["Yuki watches the float without blinking.", "Yuki: “The big ones bite at dusk.”", "Yuki is hoping you share.", "Yuki: “Patience. Then — strike!”", "Yuki dips a paw in the water and regrets it."];

  /* ================= drawing ================= */
  let hover = null, hoverTrap = -1;
  function drawWater(dt) {
    const y0 = Math.round(H * HZ), rows = H - y0;
    if (frozen()) return;
    // reflected sky, rippled strip by strip
    for (let y = 0; y < rows;) {
      const t = y / rows, band = Math.max(1, Math.round(1 + t * 3));
      const amp = (0.5 + t * t * 9) * k, off = Math.sin(y * 0.09 / (0.3 + t) + time * 1.4) * amp + Math.sin(y * 0.031 + time * 0.7) * amp * 0.6;
      const sy = Math.min(refl.height - 1, Math.round((y + Math.sin(y * 0.2 + time * 2) * t * 1.5) * dpr));
      ctx.drawImage(refl, 0, sy, refl.width, Math.max(1, band * dpr), off, y0 + y, W, band);
      y += band;
    }
    // depth: the water darkens and clears toward us
    const pal = PAL[season.name];
    const wg = ctx.createLinearGradient(0, y0, 0, H);
    wg.addColorStop(0, "rgba(20,40,70,.05)"); wg.addColorStop(1, "rgba(6,14,28,.55)");
    ctx.fillStyle = wg; ctx.fillRect(0, y0, W, rows);
    // moon path and lantern streaks
    ctx.globalCompositeOperation = "lighter";
    const mx = W * 0.8;
    for (let i = 0; i < 70; i++) {
      const t = i / 70, y = y0 + 4 + t * t * rows * 0.75, w = (6 + t * 40) * k * (0.5 + 0.5 * Math.sin(time * 3 + i * 1.7));
      ctx.fillStyle = `rgba(230,236,255,${0.25 * (1 - t) + 0.05})`; ctx.fillRect(mx - w / 2 + Math.sin(time * 2 + i) * 4 * k * t, y, w, 1.2);
    }
    LANTERNS().forEach(([lx], j) => {
      for (let i = 0; i < 22; i++) { const t = i / 22, y = y0 + 3 + t * rows * 0.35, w = (2 + t * 10) * k * (0.6 + 0.4 * Math.sin(time * 4 + i + j)); ctx.fillStyle = `rgba(255,200,120,${0.3 * (1 - t)})`; ctx.fillRect(lx - w / 2 + Math.sin(time * 2.4 + i) * 2 * k, y, w, 1.2); }
    });
    // glints
    for (let i = 0; i < 40; i++) { const sx = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, t = ((i * 0.137 + time * 0.05) % 1), sy = y0 + t * t * rows; const a = Math.max(0, Math.sin(time * 2 + i * 3)) * 0.3; ctx.fillStyle = `rgba(${pal.glow},${a})`; ctx.fillRect(sx, sy, (3 + t * 14) * k, 1); }
    ctx.globalCompositeOperation = "source-over";
  }
  function drawShadows(dt) {
    const calm = Wd.reduce || (window.Sky && Sky.calm);
    shadows.forEach((s) => {
      if (s.hidden) return;
      s.alpha = Math.min(1, s.alpha + dt * 0.5);
      if (!calm && s.mode !== "trapped") {
        if (s.mode === "wander" || s.mode === "flee") {
          if (time > s.until || Math.hypot(s.tx - s.x, s.ty - s.y) < 10) {
            for (let i = 0; i < 12; i++) { const tx = W * (0.05 + Math.random() * 0.9), ty = H * (HZ + 0.1 + Math.random() * 0.48); if (inWater(tx, ty)) { s.tx = tx; s.ty = ty; break; } }
            if (time < bait.until && bait.x != null) { s.tx = bait.x + (Math.random() - 0.5) * 60 * k; s.ty = bait.y + (Math.random() - 0.5) * 20 * k; }
            s.until = time + 3 + Math.random() * 5; if (s.mode === "flee" && time > s.until - 3) s.mode = "wander";
          }
        }
        if (s.mode !== "hooked" && !(rod.fish === s && rod.state === "reeling")) {
          const want = Math.atan2(s.ty - s.y, s.tx - s.x);
          let dh = ((want - s.h + Math.PI * 3) % TAU) - Math.PI; s.h += clamp(dh, -1.6 * dt, 1.6 * dt);
          const sp = (s.mode === "flee" ? 90 : s.mode === "approach" ? 75 : 18) * k * scaleAt(s.y);
          if (s.mode !== "approach" || Math.hypot(s.tx - s.x, s.ty - s.y) > 4) { const nx = s.x + Math.cos(s.h) * sp * dt, ny = s.y + Math.sin(s.h) * sp * dt * 0.45; if (inWater(nx, ny)) { s.x = nx; s.y = ny; } else s.until = 0; }
        }
      }
      s.wig += dt * (s.mode === "flee" ? 14 : 5);
      const sc = scaleAt(s.y), len = s.size * k * sc, ww = len * 0.28;
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, 0.5); ctx.rotate(s.h);
      ctx.globalAlpha = s.alpha * (s.koi ? 0.42 : 0.42);
      ctx.fillStyle = s.koi ? (s.id === "goldkoi" ? "#c8a03a" : "#c8602e") : "#04080e";
      if (s.koi) ctx.filter = `blur(${1.2 * k}px)`;
      ctx.beginPath(); ctx.ellipse(0, 0, len / 2, ww, 0, 0, TAU); ctx.fill();
      const tw = Math.sin(s.wig) * ww * 0.8;
      ctx.beginPath(); ctx.moveTo(-len * 0.42, 0); ctx.lineTo(-len * 0.72, -ww + tw); ctx.lineTo(-len * 0.72, ww + tw); ctx.closePath(); ctx.fill();
      if (s.koi) { ctx.fillStyle = "rgba(235,230,220,.5)"; ctx.beginPath(); ctx.ellipse(len * 0.1, 0, len * 0.14, ww * 0.6, 0, 0, TAU); ctx.fill(); }
      ctx.filter = "none"; ctx.restore(); ctx.globalAlpha = 1;
      if (s.mode === "trapped") s.x += Math.sin(time * 20 + s.wig) * 0.6;
    });
  }
  function drawPads() {
    pads.forEach((p) => {
      const bob = Math.sin(time * 0.8 + p.ph) * 0.8 * k;
      ctx.save(); ctx.translate(p.x, p.y + bob); ctx.scale(1, 0.36);
      ctx.fillStyle = p.yellow ? "#8a8a3a" : "#2f6a3a";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, p.r, p.a + 0.25, p.a + TAU - 0.25); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(160,210,140,.35)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.92, p.a + 0.4, p.a + TAU - 0.4); ctx.stroke();
      ctx.restore();
      if (p.flower || p.bud) {
        const fx = p.x + p.r * 0.2, fy = p.y + bob - 2 * k, fs = p.r * (p.bud ? 0.4 : 0.6);
        for (let i = 0; i < (p.bud ? 3 : 8); i++) {
          const a = -Math.PI / 2 + (i - (p.bud ? 1 : 3.5)) * (p.bud ? 0.25 : 0.38);
          const pg = ctx.createLinearGradient(fx, fy, fx + Math.cos(a) * fs, fy + Math.sin(a) * fs);
          pg.addColorStop(0, "#fff0f4"); pg.addColorStop(1, "#f08aaa");
          ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * fs * 0.45, fy + Math.sin(a) * fs * 0.5, fs * 0.22, fs * 0.5, a + Math.PI / 2, 0, TAU); ctx.fill();
        }
        if (p.flower) { ctx.fillStyle = "#ffd65a"; ctx.beginPath(); ctx.arc(fx, fy - fs * 0.1, fs * 0.16, 0, TAU); ctx.fill(); }
      }
    });
  }
  function drawReeds(dt) {
    const wind = Math.sin(time * 0.4) * 0.06;
    reeds.forEach((r) => {
      const sw = Math.sin(time * 1.3 + r.ph) * 0.05 + wind, tx = r.x + Math.sin(sw) * r.h, ty = r.y - Math.cos(sw) * r.h;
      ctx.strokeStyle = frozen() ? "#8a8a70" : season.name === "autumn" ? "#9a8040" : "#3e6a30"; ctx.lineWidth = Math.max(1, 2.2 * k * scaleAt(r.y)); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.quadraticCurveTo(r.x + Math.sin(sw) * r.h * 0.3, r.y - r.h * 0.6, tx, ty); ctx.stroke();
      ctx.strokeStyle = frozen() ? "#9a9a80" : season.name === "autumn" ? "#b8a050" : "#5a8a3a"; ctx.lineWidth = Math.max(1, 3 * k * scaleAt(r.y));
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.quadraticCurveTo(r.x - r.h * 0.15, r.y - r.h * 0.4, r.x - r.h * 0.3 + Math.sin(sw) * r.h * 0.4, r.y - r.h * 0.55); ctx.stroke();
      if (r.cat) { ctx.fillStyle = "#5a3a1e"; ctx.save(); ctx.translate(lerp(r.x, tx, 0.85), lerp(r.y, ty, 0.85)); ctx.rotate(sw); ctx.beginPath(); ctx.roundRect(-2.6 * k, -12 * k, 5.2 * k, 16 * k, 2.6 * k); ctx.fill(); ctx.restore(); }
      if (frozen()) { ctx.fillStyle = "rgba(240,246,255,.8)"; ctx.beginPath(); ctx.arc(tx, ty, 1.6 * k, 0, TAU); ctx.fill(); }
    });
  }
  function drawRod() {
    const tipP = rodTip(), [bx, by] = rodBase();
    // the rod: a tapering curve that bends under load
    const mx = lerp(bx, tipP.x, 0.55) + Math.sin(tipP.ang) * tipP.bend * tipP.len * 0.25, my = lerp(by, tipP.y, 0.55) - Math.cos(tipP.ang) * tipP.bend * tipP.len * 0.25 * -1;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = ["#2a1a10", "#5a3a20", "#8a6038"][i]; ctx.lineWidth = [7, 4.5, 2][i] * k; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, tipP.x, tipP.y); ctx.stroke(); }
    ctx.fillStyle = "#c8a060"; ctx.beginPath(); ctx.arc(lerp(bx, mx, 0.25), lerp(by, my, 0.25), 6 * k, 0, TAU); ctx.fill();
    // the line and the float
    let end = null;
    if (rod.state === "casting") {
      const p = clamp((time - rod.t0 - 0.3) / 0.45, 0, 1);
      if (p > 0) { end = { x: lerp(tipP.x, rod.target.x, p), y: lerp(tipP.y, rod.target.y, p) - Math.sin(p * Math.PI) * Math.min(90 * k, Math.abs(tipP.y - rod.target.y) * 0.5 + 30 * k) }; }
    } else if (rod.bob && rod.state !== "reeling") end = { x: rod.bob.x, y: rod.bob.y + rod.bob.dip * 3 * k };
    else if (rod.state === "reeling") end = { x: rod.fish.x, y: rod.fish.y };
    if (end) {
      ctx.strokeStyle = "rgba(235,235,225,.55)"; ctx.lineWidth = 0.8;
      const sag = rod.state === "reeling" ? (1 - rod.tension) * 40 * k : 30 * k;
      ctx.beginPath(); ctx.moveTo(tipP.x, tipP.y); ctx.quadraticCurveTo((tipP.x + end.x) / 2, Math.max(tipP.y, end.y) + sag, end.x, end.y); ctx.stroke();
      if (rod.state !== "reeling") {
        const fx = end.x, fy = end.y, s = 7 * k * scaleAt(fy) + 2;
        if (rod.state !== "casting") { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(fx, fy + 1, s * 1.1, s * 0.3, 0, 0, TAU); ctx.fill(); }
        const sink = rod.bob ? Math.min(1, rod.bob.dip / 3) : 0;
        ctx.save(); ctx.beginPath(); ctx.rect(fx - s * 2, fy - s * 3, s * 4, s * 3 + (rod.state === "casting" ? s * 3 : 0)); ctx.clip();
        ctx.fillStyle = "#f4f0e0"; ctx.beginPath(); ctx.ellipse(fx, fy - s * 0.6 + sink * s * 1.6, s * 0.45, s * 0.75, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#e8402a"; ctx.beginPath(); ctx.ellipse(fx, fy - s * 1.1 + sink * s * 1.6, s * 0.42, s * 0.4, 0, 0, TAU); ctx.fill();
        ctx.restore();
        if (rod.state === "bite") { ctx.globalCompositeOperation = "lighter"; glow(ctx, fx, fy, 30 * k, "255,220,150", 0.35 + 0.25 * Math.sin(time * 20)); ctx.globalCompositeOperation = "source-over"; }
      } else {
        const f = rod.fish, sc = scaleAt(f.y), len = Math.max(20, (BY[f.id].len[1] || 30)) * k * sc * 0.9;
        ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(f.x, f.y); ctx.scale(1, 0.5); ctx.rotate(f.h); ctx.fillStyle = "#04080e"; ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len * 0.15, 0, 0, TAU); ctx.fill(); ctx.restore();
        if (Math.random() < 0.2) ripple(f.x, f.y, 0.5, 0.6);
      }
    }
  }
  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWater(dt);
    drawShadows(dt);
    // ripples
    ripples = ripples.filter((r) => (r.t += dt) < 2.2);
    ripples.forEach((r) => {
      const p = r.t / 2.2, R = (8 + p * 70) * k * r.size;
      ctx.strokeStyle = frozen() ? `rgba(30,60,100,${0.5 * (1 - p) * r.a})` : `rgba(220,232,255,${0.45 * (1 - p) * r.a})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, R, R * (0.22 + persp(r.y) * 0.18), 0, 0, TAU); ctx.stroke();
      if (p < 0.5) { ctx.beginPath(); ctx.ellipse(r.x, r.y, R * 0.55, R * 0.55 * (0.22 + persp(r.y) * 0.18), 0, 0, TAU); ctx.stroke(); }
    });
    bubbles = bubbles.filter((b) => (b.t += dt) < 1);
    bubbles.forEach((b) => { if (b.t > 0) { ctx.strokeStyle = `rgba(220,235,255,${0.7 * (1 - b.t)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y - b.t * 4, 1.5 + b.t * 2, 0, TAU); ctx.stroke(); } });
    drawPads();
    // bait pellets
    if (time < bait.until && bait.x != null) { ctx.fillStyle = "rgba(200,170,110,.8)"; for (let i = 0; i < 10; i++) { const a = i * 2.4; ctx.beginPath(); ctx.arc(bait.x + Math.cos(a) * 20 * k * (i / 10), bait.y + Math.sin(a) * 6 * k * (i / 10), 1.4, 0, TAU); ctx.fill(); } }
    drawTraps();
    drawNet();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // dock lantern
    const lx = W * 0.95, ly = H * DOCK.v0 - 62 * k, fl = 0.85 + 0.15 * Math.sin(time * 7) * Math.sin(time * 3.1);
    ctx.globalCompositeOperation = "lighter"; glow(ctx, lx, ly, 80 * k * fl, "255,190,110", 0.32); glow(ctx, lx, ly, 14 * k, "255,232,180", 0.9); ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(40,28,18,.9)"; ctx.lineWidth = 1.2; ctx.strokeRect(lx - 5 * k, ly - 7 * k, 10 * k, 14 * k);
    // Yuki
    if (yuki.complete && yuki.naturalWidth) {
      const b = yukiBox();
      ctx.save(); ctx.translate(b.cx, b.y + b.h); ctx.scale(-1, 1 + Math.sin(time * 1.6) * 0.012);
      ctx.filter = "brightness(.78) saturate(.92)"; ctx.drawImage(yuki, -b.w / 2, -b.h, b.w, b.h); ctx.filter = "none"; ctx.restore();
      if (hover === "yuki") { ctx.globalCompositeOperation = "lighter"; glow(ctx, b.cx, b.cy, b.w * 0.6, "220,230,255", 0.18); ctx.globalCompositeOperation = "source-over"; }
    }
    drawReeds(dt);
    if (tool === "rod" || rod.state !== "idle") drawRod();
    // fireflies, weather, sparks
    const calm = Wd.reduce || (window.Sky && Sky.calm);
    ctx.globalCompositeOperation = "lighter";
    flies.forEach((f) => { if (!calm) { f.x += Math.cos(time * f.sp + f.ph) * 14 * dt; f.y += Math.sin(time * f.sp * 1.3 + f.ph) * 9 * dt; } const a = Math.max(0, Math.sin(time * 1.7 + f.ph * 3)) ** 2; glow(ctx, f.x, f.y, 10, "235,255,140", 0.28 * a); });
    ctx.globalCompositeOperation = "source-over";
    if (!calm) weather.forEach((p, i) => {
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(time * 1.2 + p.ph) * 14) * dt; p.rot += p.vr * dt;
      if (p.kind === "snow") { ctx.fillStyle = `rgba(245,248,255,${0.5 + p.z * 0.5})`; ctx.beginPath(); ctx.arc(p.x, p.y, 0.8 + p.z * 2.2, 0, TAU); ctx.fill(); }
      else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.4 + Math.abs(Math.cos(time * 2 + p.ph)) * 0.6); ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, 4 * k, 2.2 * k, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      if (p.y > H + 10 || p.x > W + 30) weather[i] = flake(p.kind, false);
    });
    parts = parts.filter((p) => (p.age += dt) < p.life);
    parts.forEach((p) => {
      p.vy += (p.g == null ? 420 : p.g) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      if (p.star) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = p.col.replace(",1)", `,${a})`); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.4, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    });
    if (hover === "water" && !busy()) {                        // where the cast will land
      ctx.strokeStyle = "rgba(244,226,180,.55)"; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      const s = scaleAt(hoverAt[1]), r = (tool === "net" ? 96 : 12) * k * s;
      ctx.beginPath(); ctx.ellipse(hoverAt[0], hoverAt[1], r, r * 0.34, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  /* ================= catches ================= */
  function showCatch(list, how, x, y) {
    busyCard = true;
    const firsts = list.filter((c) => !save.seen[c.id]).map((c) => c.id);
    const single = list.length === 1;
    const c0 = list[0], info = BY[c0.id];
    const stats = (c) => (c.cm ? `${c.cm} cm${c.kg ? ` · ${c.kg < 1 ? Math.max(1, Math.round(c.kg * 1000)) + " g" : c.kg.toFixed(1) + " kg"}` : ""}` : "");
    cardEl.innerHTML = single ? `
      <div class="cc-art"><img src="${iconOf(c0.id)}" alt="" width="160" height="160"></div>
      <p class="cc-kicker">${firsts.length ? "New in your log!" : how === "rod" ? "On the line" : how === "net" ? "In the net" : "In the trap"}</p>
      <h3>${esc(info.name)} <span class="zh">${esc(info.zh)}</span></h3>
      <p class="cc-stats">${stats(c0)}${stats(c0) ? " · " : ""}<span class="stars">${"★".repeat(info.rarity)}</span></p>
      <p class="cc-text">${esc(info.text)}</p>
      <div class="cc-actions">${c0.id === "bottle" ? `<a class="btn sm primary" href="message.html">Read the bottles →</a>` : ""}<button class="btn sm primary" type="button" data-keep>${info.kind === "junk" ? "Keep it" : "Into the creel"}</button>${info.kind === "fish" || info.kind === "crust" ? `<button class="btn sm" type="button" data-release>Let it go</button>` : ""}</div>`
      : `
      <p class="cc-kicker">${how === "net" ? "The net comes up" : "The trap comes up"}${firsts.length ? " · something new!" : ""}</p>
      <h3>${list.length} in the ${how === "net" ? "net" : "trap"}</h3>
      <ul class="cc-list">${list.map((c) => `<li class="${firsts.includes(c.id) ? "new" : ""}"><img src="${iconOf(c.id)}" alt="" width="56" height="56"><b>${esc(BY[c.id].name)}</b><span class="zh">${esc(BY[c.id].zh)}</span><small>${stats(c)}</small></li>`).join("")}</ul>
      <div class="cc-actions"><button class="btn sm primary" type="button" data-keep>Keep them all</button><button class="btn sm" type="button" data-release>Let them go</button></div>`;
    cardEl.hidden = false;
    cardEl.classList.remove("show"); void cardEl.offsetWidth; cardEl.classList.add("show");
    if (list.some((c) => BY[c.id].rarity >= 3)) sparkle(x, y, 26);
    list.forEach((c) => { save.seen[c.id] = (save.seen[c.id] || 0) + 1; if (c.cm && (!save.best[c.id] || c.cm > save.best[c.id])) save.best[c.id] = c.cm; });
    persist();
    if (firsts.length) document.getElementById("btnLog").classList.add("glint");
    const done = (keep) => {
      cardEl.classList.remove("show"); setTimeout(() => (cardEl.hidden = true), 260);
      busyCard = false; rod.state = "idle"; rod.bob = null; rod.fish = null;
      hint.textContent = tools[tool].hint;
      if (keep) {
        const r = cv.getBoundingClientRect();
        list.forEach((c, i) => { save.creel[c.id] = (save.creel[c.id] || 0) + 1; Wd.fly(iconOf(c.id), r.left + W * 0.5, r.top + H * 0.45, creelEl, i * 90); });
        persist(); setTimeout(renderCreel, 900 + list.length * 90);
      } else {
        splash(W * 0.6, H * 0.8, 12, 0.7);
        Wd.float(stage, W * 0.6, H * 0.74, list.length > 1 ? "Back they go ♡" : "Back it goes ♡", "soft");
      }
    };
    cardEl.querySelector("[data-keep]").onclick = () => done(true);
    const rel = cardEl.querySelector("[data-release]"); if (rel) rel.onclick = () => done(false);
    setTimeout(() => { const b = cardEl.querySelector("[data-keep]"); if (b) b.focus({ preventScroll: true }); }, 50);
  }
  const busy = () => busyCard || rod.state !== "idle" || !!net;

  /* ================= HUD & tools ================= */
  const tools = {
    rod: { hint: "Tap the water to cast. Strike when the float goes under, then hold to reel." },
    net: { hint: "Tap where the fish shadows gather to throw the cast net." },
    trap: { hint: "Tap a stake to set a 地笼 trap. It soaks for about a minute — even if you leave." }
  };
  function setTool(t) {
    if (frozen() && t !== "rod") { toast("The pond is frozen — only ice fishing today.", 2600); return; }
    tool = t;
    document.querySelectorAll("[data-tool]").forEach((b) => { b.classList.toggle("active", b.dataset.tool === t); b.setAttribute("aria-pressed", b.dataset.tool === t ? "true" : "false"); });
    hint.textContent = frozen() ? "The pond is frozen. Tap the ice to drop your line through the hole." : tools[t].hint;
  }
  function renderCreel() {
    const ids = CATCH.filter((c) => save.creel[c.id]).map((c) => c.id);
    Wd.shareIcons(ids, iconOf);
    creelEl.innerHTML = ids.length ? `<span class="b-label">Creel</span>` + ids.map((id) => `<span class="fi"><img src="${iconOf(id)}" alt="${esc(BY[id].name)}" width="20" height="20">${save.creel[id]}</span>`).join("") : `<span class="b-label">Your creel is empty</span>`;
  }
  function openLog() {
    document.getElementById("btnLog").classList.remove("glint");
    Wd.journal({ title: "Catch Log", sub: "Everything the pond has given up", items: CATCH, seen: save.seen, counts: save.creel, best: save.best, iconOf, note: "Released fish still count — the log remembers who you met." });
  }
  function scatterBait() {
    if (frozen()) { toast("The fish are slow under the ice. Bait won’t carry.", 2600); return; }
    const x = W * (0.3 + Math.random() * 0.35), y = H * (0.58 + Math.random() * 0.2);
    bait = { x, y, until: time + 25 };
    for (let i = 0; i < 10; i++) setTimeout(() => ripple(x + (Math.random() - 0.5) * 40 * k, y + (Math.random() - 0.5) * 12 * k, 0.3, 0.8), i * 60);
    shadows.forEach((s) => { s.until = 0; });
    Wd.float(stage, x, y - 30, "The fish come to see…", "soft");
  }

  /* ================= input ================= */
  let hoverAt = [0, 0];
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function whatIsAt(x, y) {
    const yb = yukiBox();
    if (x > yb.x + yb.w * 0.15 && x < yb.x + yb.w * 0.85 && y > yb.y + yb.h * 0.1 && y < yb.y + yb.h) return { kind: "yuki" };
    for (let i = 0; i < STAKES.length; i++) {
      const [sx, sy] = P(STAKES[i].u, STAKES[i].v), sc = scaleAt(sy), [fx, fy] = trapFloat(i);
      if ((Math.abs(x - sx) < 24 * k * sc + 8 && y > sy - 80 * k * sc && y < sy + 10) || (save.traps[i] && Math.hypot(x - fx, y - fy) < 18 * k)) return { kind: "trap", i };
    }
    if (frozen()) return y > H * (HZ + 0.04) && y < H * DOCK.v0 ? { kind: "water" } : null;
    return inWater(x, y) ? { kind: "water" } : null;
  }
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = local(e), w = whatIsAt(x, y);
    hoverAt = [x, y]; hoverTrap = w && w.kind === "trap" ? w.i : -1;
    hover = w ? (w.kind === "water" ? ((tool === "rod" && rod.state === "idle") || (tool === "net" && !net) ? "water" : null) : w.kind) : null;
    cv.style.cursor = hover || hoverTrap >= 0 ? "pointer" : rod.state === "reeling" ? "grabbing" : "default";
    if (e.pointerType === "mouse" && (hover === "yuki" || hoverTrap >= 0)) {
      const st = hoverTrap >= 0 ? trapState(hoverTrap) : "";
      tip.textContent = hover === "yuki" ? "Yuki · 雪山豹猫" : st === "free" ? "Set a 地笼 crab trap" : st === "ready" ? "Haul up the trap!" : `Soaking… ${Math.ceil((save.traps[hoverTrap].t0 + save.traps[hoverTrap].dur - Date.now()) / 1000)}s`;
      tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.add("on");
    } else tip.classList.remove("on");
  });
  cv.addEventListener("pointerleave", () => { hover = null; hoverTrap = -1; tip.classList.remove("on"); });
  cv.addEventListener("pointerdown", (e) => {
    if (busyCard) return;
    if (rod.state === "reeling") { rod.hold = true; cv.setPointerCapture(e.pointerId); return; }
    if (rod.state === "bite" || rod.state === "nibble") { strike(); return; }
    const [x, y] = local(e), w = whatIsAt(x, y);
    if (!w) return;
    if (w.kind === "yuki") { const b = yukiBox(); Wd.float(stage, b.cx, b.y + 6, YUKI[(Math.random() * YUKI.length) | 0], "say"); sparkle(b.cx, b.y + b.h * 0.3, 8, "220,230,255"); return; }
    if (w.kind === "trap") { const st = trapState(w.i); if (st === "free") setTrap(w.i); else if (st === "ready") haulTrap(w.i); else Wd.float(stage, x, y - 20, `Soaking… ${Math.ceil((save.traps[w.i].t0 + save.traps[w.i].dur - Date.now()) / 1000)}s`, "soft"); return; }
    if (tool === "rod" && rod.state === "idle") castTo(x, y);
    else if (tool === "rod" && (rod.state === "waiting" || rod.state === "approach")) { rod.state = "idle"; rod.bob = null; if (rod.fish) rod.fish.mode = "wander"; rod.fish = null; castTo(x, y); }
    else if (tool === "net") throwNet(x, y);
    else if (tool === "trap") Wd.float(stage, x, y - 16, "Tap one of the wooden stakes", "soft");
  });
  const release = () => { rod.hold = false; };
  cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
  addEventListener("keydown", (e) => {
    if (e.code !== "Space" || busyCard || e.target.closest("input, textarea, button, a")) return;
    e.preventDefault();
    if (rod.state === "reeling") rod.hold = true;
    else if (rod.state === "bite" || rod.state === "nibble") strike();
    else if (rod.state === "idle" && tool === "rod") castTo(W * (0.3 + Math.random() * 0.4), H * (0.55 + Math.random() * 0.25));
  });
  addEventListener("keyup", (e) => { if (e.code === "Space") rod.hold = false; });

  document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  document.getElementById("btnBack").addEventListener("click", () => Wd.back("pond"));
  document.getElementById("btnBack2").addEventListener("click", () => Wd.back("pond"));
  document.getElementById("btnLog").addEventListener("click", openLog);
  document.getElementById("btnBait").addEventListener("click", scatterBait);
  document.getElementById("btnTips").addEventListener("click", () => toast("Rod: wait until the float goes right under, then strike. While reeling, hold to pull and let go before the needle reaches the red. Space works too. Net: throw it where shadows gather. Traps: set one at a stake and come back in a minute.", 6000));

  /* ================= sizing & loop ================= */
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return false;
    dpr = Math.min(window.devicePixelRatio || 1, Wd.lowPower ? 1.25 : 1.75);
    if (w === W && h === H && cv.width === Math.round(w * dpr)) return true;
    W = w; H = h; k = Math.min(H / 600, W / 700);
    for (const c of [cv, bg, fg]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    refl.width = Math.round(W * dpr); refl.height = Math.round(H * (1 - HZ) * dpr) + 2;
    paintBackground(); paintForeground(); setupLife();
    return true;
  }
  function applySeason() {
    document.body.dataset.wildSeason = season.name;
    W = 0; fit();
    document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("disabled", frozen() && b.dataset.tool !== "rod"));
    setTool(frozen() ? "rod" : tool);
    Wd.seasonChip(document.getElementById("seasonChip"));
  }
  let last = performance.now(), tick = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (document.hidden || !fit()) return;
    time += dt;
    updateRod(dt); updateNet();
    if (!frozen() && Math.random() < dt * 0.25) { const s = shadows[(Math.random() * shadows.length) | 0]; if (s && s.mode === "wander") ripple(s.x, s.y, 0.5, 0.5); }
    if (!frozen() && Math.random() < dt * 0.03 && shadows.length) { const s = shadows[(Math.random() * shadows.length) | 0]; if (s.mode === "wander") splash(s.x, s.y, 10, 0.6); }
    draw(dt);
    tick += dt;
    if (tick > 1) {
      tick = 0;
      const s = Wd.season();
      if (s.name !== season.name && rod.state === "idle" && !net && !busyCard) { season = s; applySeason(); toast(`${Wd.ICONS[s.name]} The season turns — ${s.name} by the pond.`, 3600); }
      else Wd.seasonChip(document.getElementById("seasonChip"));
    }
  }

  Wd.arrive("pond");
  renderCreel();
  applySeason();
  if ("ResizeObserver" in window) new ResizeObserver(() => fit()).observe(stage);
  requestAnimationFrame(frame);
})();
