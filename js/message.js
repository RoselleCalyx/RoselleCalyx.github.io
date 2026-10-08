/* Message in a Bottle */
(function () {
  const { esc, ICON, store } = window.Site;
  const $ = (id) => document.getElementById(id);
  const form = $("bottleForm"), text = $("bText"), count = $("bCount"), status = $("bStatus");
  const anon = $("bAnon"), nameIn = $("bName"), bottle = $("heroBottle");
  const MAX = 500;
  if (window.Backend) Backend.guard(form);

  /* tabs */
  const tabs = document.querySelectorAll(".letter-tabs button");
  tabs.forEach((t) => t.addEventListener("click", () => {
    tabs.forEach((x) => { x.classList.toggle("active", x === t); x.setAttribute("aria-selected", x === t); });
    $("writePane").hidden = t.dataset.tab !== "write";
    $("readPane").hidden = t.dataset.tab !== "read";
    if (t.dataset.tab === "read") renderList();
  }));

  text.addEventListener("input", () => { count.textContent = `${text.value.length}/${MAX}`; });
  anon.addEventListener("change", () => { nameIn.disabled = anon.checked; if (anon.checked) nameIn.value = ""; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = text.value.trim();
    if (msg.length < 2) { status.textContent = "The bottle is empty — write a few words first."; return; }
    const problem = window.Backend ? Backend.check(form, "bottle") : "";
    if (problem) { status.textContent = problem; return; }
    const name = anon.checked ? "" : nameIn.value.trim();
    const contact = $("bContact").value.trim();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.textContent = "Corking the bottle…";
    const res = await Site.send("Message in a Bottle", { name, contact, message: msg },
      { table: "bottles", row: { name: name || null, contact: contact || null, text: msg } });
    btn.disabled = false;
    if (!res.ok) { status.textContent = "The tide is out. Please try again later."; return; }
    if (window.Backend) Backend.stamp("bottle");
    const mine = store.get("my-bottles", []);
    mine.unshift({ from: name || "You", date: new Date().toISOString().slice(0, 10), text: msg, mine: true });
    store.set("my-bottles", mine.slice(0, 20));
    toss();
    text.value = ""; count.textContent = `0/${MAX}`;
    status.textContent = res.via === "mail"
      ? "Your mail app has opened with the letter inside — press send to cast it into the sea."
      : "Your bottle is drifting across the stars. It will reach me.";
  });

  function toss() {
    if (!bottle) return;
    bottle.classList.remove("back");
    bottle.classList.add("toss");
    for (let i = 0; i < 3; i++) setTimeout(() => window.Sky && Sky.meteor(), 600 + i * 500);
    setTimeout(() => { bottle.classList.remove("toss"); bottle.classList.add("back"); }, 4200);
  }

  /* drifting bottles */
  let remote = [];
  if (window.Backend && Backend.enabled) {
    Backend.select("bottles", "select=name,text,reply,created_at&approved=eq.true&order=created_at.desc&limit=50")
      .then((rows) => { remote = rows.map((r) => ({ from: r.name || "Anonymous", date: (r.created_at || "").slice(0, 10), text: r.text, reply: r.reply })); renderList(); })
      .catch(() => {});
  }
  const all = () => [...store.get("my-bottles", []), ...remote, ...(window.BOTTLES || [])];
  const list = $("bottleList");
  function renderList() {
    const b = all();
    list.innerHTML = b.map((x, i) => `<li><button type="button" data-i="${i}">${ICON.bottle}
      <span><span style="display:block">${esc(x.from || "Anonymous")}${x.mine ? " · <em>yours, drifting</em>" : ""}</span><span class="ex">${esc(x.text)}</span></span>
      <small>${esc(x.date || "")}</small></button></li>`).join("") || `<li class="status">No bottles on the shore tonight.</li>`;
  }
  list.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) openBottle(all()[+b.dataset.i]); });
  $("pickBottle").addEventListener("click", () => {
    const b = all().filter((x) => !x.mine);
    if (b.length) openBottle(b[(Math.random() * b.length) | 0]);
  });
  function openBottle(b) {
    Site.modal(`<div class="letter-body unrolled">
        <p class="kicker" style="color:#8a6a3a">A bottle washed ashore · ${esc(b.date || "")}</p>
        <div>${esc(b.text)}</div>
        <div class="sig">— ${esc(b.from || "Anonymous")}</div>
        ${b.reply ? `<div class="reply"><b>Reply:</b> ${esc(b.reply)}</div>` : ""}
      </div>`, { className: "letter" });
  }

  /* lanterns rising over the sea */
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (let i = 0; i < 9; i++) {
      const l = document.createElement("div");
      l.className = "lantern";
      l.style.left = (8 + Math.random() * 60) + "vw";
      l.style.bottom = (8 + Math.random() * 22) + "vh";
      l.style.setProperty("--dx", (Math.random() * 80 - 20) + "px");
      l.style.animationDuration = (18 + Math.random() * 16) + "s";
      l.style.animationDelay = (-Math.random() * 30) + "s";
      const k = 0.5 + Math.random() * 0.6;
      l.style.width = 12 * k + "px"; l.style.height = 16 * k + "px";
      document.body.appendChild(l);
    }
  }
})();
