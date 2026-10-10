/* Papers page */
(function () {
  const { ICON, esc } = window.Site;
  const S = window.SITE || {};
  const papers = (window.PAPERS || []).slice().sort((a, b) => (b.year || 0) - (a.year || 0));
  const me = S.name || "";

  const KINDS = [
    ["all", "All", "layers", () => true],
    ["publication", "Publications", "book", (p) => p.type === "publication"],
    ["preprint", "Preprints", "draft", (p) => p.type === "preprint"],
    ["project", "Projects", "flask", (p) => p.type === "project"],
    ["code", "With code", "code", (p) => p.links && p.links.code]
  ];
  const LINKS = [["pdf", "PDF", "pdf"], ["code", "Code", "code"], ["project", "Project", "globe"], ["data", "Data", "data"]];
  const state = { kind: "all", topic: "All", q: "" };

  const side = document.getElementById("kinds");
  const chips = document.getElementById("topics");
  const list = document.getElementById("paperList");
  const search = document.getElementById("paperSearch");

  side.innerHTML = KINDS.map(([id, label, icon, fn]) => {
    const n = papers.filter(fn).length;
    return `<button type="button" data-kind="${id}" class="${id === state.kind ? "active" : ""}">${ICON[icon]}${label}<span class="count">${n}</span></button>`;
  }).join("");
  const topics = ["All", "Selected", ...new Set(papers.flatMap((p) => p.topics || []))];
  chips.innerHTML = topics.map((t) => `<button type="button" class="chip${t === "All" ? " active" : ""}" data-topic="${esc(t)}">${esc(t)}</button>`).join("");

  side.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.kind = b.dataset.kind;
    side.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    render();
  });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.topic = b.dataset.topic;
    chips.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    render();
  });
  search.addEventListener("input", () => { state.q = search.value.trim().toLowerCase(); render(); });

  function bibtex(p) {
    if (p.bibtex) return p.bibtex;
    const first = ((p.authors || [])[0] || "anon").split(" ").pop().toLowerCase();
    const word = (p.title.match(/[A-Za-z]{4,}/) || ["paper"])[0].toLowerCase();
    const isConf = p.type === "publication";
    return `@${isConf ? "inproceedings" : "misc"}{${first}${p.year || ""}${word},
  title     = {${p.title}},
  author    = {${(p.authors || []).join(" and ")}},
  ${isConf ? "booktitle" : "note     "} = {${p.venue}},
  year      = {${p.year || ""}}
}`;
  }

  function figures(p) {
    const items = (p.figures || []).filter(f => f && f.src).map(f => ({ src: f.src, title: f.caption || p.title, alt: f.alt || f.caption || p.title, meta: p.venue, text: f.caption || p.abstract }));
    if (p.image) {
      const index = items.findIndex(f => f.src === p.image);
      items.unshift(index < 0 ? { src: p.image, title: p.title, alt: p.imageAlt || p.title, meta: p.venue, text: p.abstract } : { ...items.splice(index, 1)[0], alt: p.imageAlt || p.title });
    }
    return items;
  }

  function card(p, i) {
    const authors = (p.authors || []).map((a) => (a === me ? `<strong>${esc(a)}</strong>` : esc(a))).join(", ");
    const links = LINKS.filter(([k]) => p.links && p.links[k])
      .map(([k, label, icon]) => `<a class="btn sm" href="${esc(p.links[k])}" target="_blank" rel="noopener">${ICON[icon]}${label}</a>`).join("");
    const typeLabel = { publication: "Publication", preprint: "Preprint", project: "Project" }[p.type] || "";
    const images = figures(p), cover = p.image || images[0]?.src;
    return `<article class="paper glass reveal" data-i="${i}">
      <div class="paper-thumb"${cover ? ' role="button" tabindex="0" aria-label="Enlarge paper figures"' : ""}>${cover ? `<img src="${esc(cover)}" alt="${esc(images[0]?.alt ?? images[0]?.title ?? p.title)}" loading="lazy">` : ""}</div>
      <div class="paper-body">
        <div class="paper-top"><h3>${esc(p.title)}</h3>${p.selected ? `<span class="selected" title="Selected">${ICON.starF}</span>` : ""}</div>
        <div class="paper-authors">${authors}</div>
        <div class="paper-venue"><span>${esc(p.venue)}</span>${typeLabel ? `<span class="badge">${typeLabel}</span>` : ""}${(p.topics || []).map((t) => `<span>· ${esc(t)}</span>`).join("")}</div>
        <p class="paper-abs">${esc(p.abstract || "")}</p>
        <div class="paper-actions">
          ${links}
          ${images.length > 1 ? `<button class="btn sm" type="button" data-act="figures">${ICON.image}Figures (${images.length})</button>` : ""}
          <button class="btn sm" type="button" data-act="bib">${ICON.quote}BibTeX</button>
          ${p.abstract ? `<button class="more" type="button" data-act="more">Read more ↓</button>` : ""}
        </div>
        <pre class="bibtex">${esc(bibtex(p))}</pre>
      </div>
    </article>`;
  }

  let shown = [];
  function render() {
    const fn = KINDS.find((k) => k[0] === state.kind)[3];
    shown = papers.filter((p) => {
      if (!fn(p)) return false;
      if (state.topic === "Selected" && !p.selected) return false;
      if (state.topic !== "All" && state.topic !== "Selected" && !(p.topics || []).includes(state.topic)) return false;
      if (state.q) {
        const hay = [p.title, p.venue, p.abstract, ...(p.authors || []), ...(p.topics || [])].join(" ").toLowerCase();
        if (!hay.includes(state.q)) return false;
      }
      return true;
    });
    list.innerHTML = shown.length ? shown.map(card).join("") : `<div class="empty">No paper drifts by here… yet.</div>`;
    Site.reveal(list);
  }

  list.addEventListener("click", async (e) => {
    const art = e.target.closest(".paper"); if (!art) return;
    const p = shown[+art.dataset.i];
    if (e.target.closest(".paper-thumb") && figures(p).length) {
      Site.lightbox(figures(p));
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "figures") {
      Site.lightbox(figures(p));
    } else if (act.dataset.act === "more") {
      const open = art.classList.toggle("open");
      act.textContent = open ? "Less ↑" : "Read more ↓";
    } else if (act.dataset.act === "bib") {
      art.classList.toggle("show-bib");
      try { await navigator.clipboard.writeText(bibtex(p)); Site.toast("BibTeX copied to clipboard"); } catch (err) {}
    }
  });
  list.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("paper-thumb")) { e.preventDefault(); e.target.click(); }
  });

  render();
})();
