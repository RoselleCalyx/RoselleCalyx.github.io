/* =====================================================================
   Shared by the woods and the pond (window.Wild):
   - the farm's season clock (same formula, so every page agrees)
   - the walk back to the farm, with its entry and exit animations
   - a seeded random, small canvas helpers, rewards that fly to the HUD
   - the field journal / catch log
   ===================================================================== */
(function () {
  const { esc, store, modal } = window.Site;
  const params = new URLSearchParams(location.search);
  const SEASONS = ["spring", "summer", "autumn", "winter"];
  const SEASON_MS = 8 * 60 * 1000;
  const ICONS = { spring: "✿", summer: "☀", autumn: "❦", winter: "❄" };
  const forced = SEASONS.includes(params.get("season")) ? params.get("season") : null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia("(pointer: coarse)").matches;

  function season() {
    const now = Date.now(), abs = Math.floor(now / SEASON_MS);
    return { abs, name: forced || SEASONS[abs % 4], left: SEASON_MS - (now % SEASON_MS) };
  }
  const withSeason = (url) => (forced ? url + (url.includes("?") ? "&" : "?") + "season=" + forced : url);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  function seasonChip(el) {
    const s = season(), next = SEASONS[(SEASONS.indexOf(s.name) + 1) % 4], left = Math.ceil(s.left / 1000);
    el.innerHTML = `<span class="si">${ICONS[s.name]}</span><b>${cap(s.name)}</b>${forced ? "" : `<span class="muted"> · ${next} in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}</span>`}`;
  }

  /* ---------- arriving from the farm, and walking back ---------- */
  function arrive(kind) {
    const from = sessionStorage.getItem("wild-arrive");
    sessionStorage.removeItem("wild-arrive");
    if (from !== kind || reduce) return;
    document.body.classList.add("wild-arriving");
    setTimeout(() => document.body.classList.remove("wild-arriving"), 1600);
  }
  function back(kind) {
    sessionStorage.setItem("farm-return", kind);
    document.body.classList.add("wild-leaving");
    let fromFarm = false;
    try { fromFarm = history.length > 1 && /farm\.html/.test(new URL(document.referrer).pathname); } catch (e) {}
    setTimeout(() => (fromFarm ? history.back() : (location.href = withSeason("farm.html"))), reduce ? 0 : 620);
  }
  addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("wild-leaving"); });

  /* ---------- small tools ---------- */
  function rng(seed) {                         // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, t) { const a = hex(c1), b = hex(c2); return "#" + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, "0")).join(""); }
  function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // a crescent moon, cut cleanly out of a small offscreen disc
  function moon(g, x, y, r) {
    const s = Math.ceil(r * 2 + 6) * 2, c = document.createElement("canvas"); c.width = c.height = s;
    const m = c.getContext("2d"), q = s / 2, rr = r * 2;
    const mg = m.createRadialGradient(q - rr * 0.3, q - rr * 0.2, rr * 0.1, q, q, rr);
    mg.addColorStop(0, "#fffbea"); mg.addColorStop(1, "#e9dfbd");
    m.fillStyle = mg; m.beginPath(); m.arc(q, q, rr, 0, Math.PI * 2); m.fill();
    m.globalCompositeOperation = "destination-out";
    m.beginPath(); m.arc(q + rr * 0.48, q - rr * 0.18, rr * 0.88, 0, Math.PI * 2); m.fill();
    g.drawImage(c, x - s / 4, y - s / 4, s / 2, s / 2);
  }
  // a mountain range: filled ridge, faint rock ribs, snow fading down from the highest summits
  function range(g, pts, bottom, col, snowA, rib) {
    g.save();
    g.beginPath(); g.moveTo(pts[0][0], bottom); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(pts[pts.length - 1][0], bottom); g.closePath();
    g.fillStyle = col; g.fill(); g.clip();
    const top = Math.min(...pts.map((p) => p[1])), span = bottom - top;
    if (rib) {
      g.strokeStyle = "rgba(20,18,40,.18)"; g.lineWidth = 1.2;
      pts.forEach(([x, y], i) => {
        for (let j = Math.max(0, i - 6); j <= Math.min(pts.length - 1, i + 6); j++) if (j !== i && pts[j][1] <= y) return;   // only from the real summits
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * rib * 0.25, y + rib * 0.4, x + s * rib * 0.6, y + rib * 0.9); g.stroke(); }
      });
    }
    if (snowA) {
      const sg = g.createLinearGradient(0, top, 0, top + span * 0.32);
      sg.addColorStop(0, `rgba(244,246,255,${snowA})`); sg.addColorStop(0.5, `rgba(244,246,255,${snowA * 0.45})`); sg.addColorStop(1, "rgba(244,246,255,0)");
      g.fillStyle = sg; g.fillRect(pts[0][0], top, pts[pts.length - 1][0] - pts[0][0], span * 0.32);
    }
    g.restore();
  }
  // render a drawing function into a small image (for the HUD and the journal)
  const iconCache = {};
  function icon(key, draw, size = 96) {
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d");
    draw(g, size / 2, size * 0.86, size * 0.72);
    return (iconCache[key] = c.toDataURL());
  }

  // the farm has no canvas art of its own for wild things: leave it small copies of the icons
  function shareIcons(ids, iconOf) {
    const shared = store.get("wild-icons", {});
    let changed = false;
    ids.forEach((id) => {
      if (shared[id]) return;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = 48;
        c.getContext("2d").drawImage(img, 0, 0, 48, 48);
        const all = store.get("wild-icons", {}); all[id] = c.toDataURL(); store.set("wild-icons", all);
      };
      img.src = iconOf(id); changed = true;
    });
    return changed;
  }

  /* ---------- rewards ---------- */
  function float(stage, x, y, text, cls = "") {
    const d = document.createElement("div");
    d.className = "wild-float " + cls; d.textContent = text;
    d.style.left = x + "px"; d.style.top = y + "px";
    stage.appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }
  function fly(src, fromX, fromY, toEl, delay = 0) {       // client coordinates
    const to = toEl.getBoundingClientRect();
    const d = document.createElement("img");
    d.className = "wild-fly"; d.src = src; d.alt = "";
    d.style.left = fromX - 18 + "px"; d.style.top = fromY - 18 + "px";
    document.body.appendChild(d);
    const dx = to.left + 16 - fromX, dy = to.top + to.height / 2 - fromY;
    setTimeout(() => {
      d.animate([
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0.2 }
      ], { duration: reduce ? 1 : 900, easing: "cubic-bezier(.4,0,.3,1)", fill: "forwards" });
      setTimeout(() => { d.remove(); toEl.classList.remove("bump"); void toEl.offsetWidth; toEl.classList.add("bump"); }, reduce ? 0 : 880);
    }, delay);
  }

  /* ---------- the journal ---------- */
  function journal({ title, sub, items, seen, counts, best, iconOf, note }) {
    const found = items.filter((it) => seen[it.id]).length;
    const cards = items.map((it) => {
      const s = seen[it.id];
      return `<li class="${s ? "found" : "unknown"}${it.poison ? " poison" : ""}">
        <img src="${iconOf(it.id)}" alt="" width="72" height="72">
        <b>${s ? esc(it.name) : "?"}</b><span class="zh">${s ? esc(it.zh) : ""}</span>
        <small>${s ? esc(it.text) : esc(it.hint || "Not found yet.")}</small>
        <span class="meta">${s ? `${it.poison ? "seen" : "×" + (counts[it.id] || 0)}${best && best[it.id] ? " · best " + best[it.id] + " cm" : ""}` : ""}${"★".repeat(it.rarity || 1)}</span>
      </li>`;
    }).join("");
    modal(`<h2>${esc(title)}</h2><p class="muted">${esc(sub)} · ${found} / ${items.length} found</p>${note ? `<p class="journal-note">${note}</p>` : ""}<ul class="journal">${cards}</ul>`, { className: "wide" });
  }

  window.Wild = { season, seasonChip, withSeason, arrive, back, rng, lerp, clamp, smooth, mix, glow, moon, range, icon, shareIcons, float, fly, journal, store, reduce, lowPower, cap, ICONS };
})();
