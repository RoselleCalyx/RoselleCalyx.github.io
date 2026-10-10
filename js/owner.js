/* The host workspace uses the inbox account and publishes through the same service. */
(function () {
  "use strict";
  const api = window.HostInbox;
  const $ = id => document.getElementById(id);
  if (!api || !$("ownerContentForm")) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const species = ["snowcat", "rabbit", "panda", "fox", "shiba", "hedgehog", "duckling", "penguin", "redpanda", "raccoon", "wolf", "crocodile", "fennec"];
  const speciesLabels = { snowcat: "Snow leopard cat", rabbit: "Rabbit", panda: "Panda", fox: "Fox", shiba: "Shiba Inu", hedgehog: "Hedgehog", duckling: "Duckling", penguin: "Penguin", redpanda: "Red panda", raccoon: "Raccoon", wolf: "Wolf", crocodile: "Crocodile", fennec: "Fennec fox" };
  const sections = ["site", "home", "papers", "gallery", "bottles", "farm", "voyager"];
  let defaults, draft, revision = 0, dirty = false, busy = false, generation = 0, tab = "profile";
  let updatedAt = null;
  const newAnimalIds = new Set();

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, run, className) {
    const el = node("button", text, className); el.type = "button"; el.addEventListener("click", run); return el;
  }
  function status(text, error = false) {
    $("ownerEditorStatus").textContent = text;
    $("ownerEditorStatus").classList.toggle("is-error", error);
  }
  function setDirty(value = true) {
    dirty = value;
    $("ownerSaveState").textContent = dirty ? "Unpublished changes" : "Published content";
    $("saveContentButton").disabled = busy || !draft || !dirty;
    $("ownerEditor").classList.toggle("has-draft", dirty);
  }
  function read(path) { return path.reduce((value, key) => value && value[key], draft); }
  function write(path, value) {
    let parent = draft;
    for (const key of path.slice(0, -1)) { if (parent[key] == null) parent[key] = typeof key === "number" ? [] : {}; parent = parent[key]; }
    parent[path[path.length - 1]] = value;
    setDirty();
  }
  function field(path, title, { type = "text", options, required = false, rows = 3, min, max, maxLength, pattern, placeholder, help, image = false, ratio = "original" } = {}) {
    const label = node("label", undefined, "owner-field");
    label.append(node("span", title));
    const input = node(options ? "select" : type === "textarea" || type === "lines" || type === "json" ? "textarea" : "input");
    input.dataset.ownerField = path.join(".");
    if (options) for (const item of options) { const option = node("option", path.at(-1) === "species" ? speciesLabels[item] || item : item); option.value = item; input.append(option); }
    else if (input.tagName === "INPUT") input.type = type === "checkbox" ? "checkbox" : type === "number" ? "number" : type === "email" ? "email" : "text";
    else input.rows = rows;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (maxLength !== undefined) input.maxLength = maxLength;
    if (pattern) input.pattern = pattern;
    if (placeholder) input.placeholder = placeholder;
    input.required = required;
    let value = read(path);
    if (type === "checkbox") { input.checked = Boolean(value); label.classList.add("owner-check"); }
    else input.value = type === "json" ? JSON.stringify(value == null ? [] : value, null, 2) : type === "lines" ? (value || []).join("\n") : value == null ? "" : value;
    if (path[0] === "voyager" && path[path.length - 1] === "title" && (!Array.isArray(value) || value.length !== 2 || value.some(line => !line.trim()))) input.setCustomValidity("Please enter exactly two nonempty title lines.");
    input.addEventListener("input", () => {
      input.setCustomValidity("");
      let next = input.value;
      if (type === "checkbox") next = input.checked;
      else if (type === "number") next = input.value === "" ? null : Number(input.value);
      else if (type === "lines") next = input.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (path[0] === "voyager" && path[path.length - 1] === "date" && next === "") next = null;
      if (path[0] === "voyager" && path[path.length - 1] === "title" && (!Array.isArray(next) || next.length !== 2)) input.setCustomValidity("Please enter exactly two nonempty title lines.");
      else if (type === "json") {
        try { next = JSON.parse(input.value); }
        catch (_) { input.setCustomValidity("Please enter valid JSON."); setDirty(); return; }
      }
      write(path, next);
    });
    label.append(input);
    if (help) label.append(node("small", help));
    if (image && window.OwnerImages) {
      const wrapper = node("div", undefined, "owner-image-field");
      wrapper.append(label);
      window.OwnerImages.attach(wrapper, {
        input, ratio, label: title,
        canUse: () => api.signedIn && !busy && input.isConnected,
        upload: blob => api.uploadImage(blob),
        onCommit: () => {
          status("Image added to your draft. Save & publish to update the website.");
        }
      });
      return wrapper;
    }
    return label;
  }
  function group(title, text) {
    const el = node("div", undefined, "owner-group");
    el.append(node("h3", title));
    if (text) el.append(node("p", text, "owner-help"));
    return el;
  }
  function grid(parent, fields) {
    const el = node("div", undefined, "owner-field-grid"); el.append(...fields); parent.append(el);
  }
  function collection(parent, path, title, text, blank, build, { removable = true } = {}) {
    const wrapper = group(title, text), list = node("div", undefined, "owner-collection");
    const add = button("＋ Add " + title.toLowerCase().replace(/s$/, ""), () => {
      const items = read(path); items.push(clone(typeof blank === "function" ? blank() : blank)); setDirty(); render();
      const target = document.querySelector('[data-owner-field="' + path.join(".") + "." + (items.length - 1) + '.title"]') ||
        document.querySelector('[data-owner-field^="' + path.join(".") + "." + (items.length - 1) + '."]');
      if (target) { for (let parent = target.closest("details"); parent; parent = parent.parentElement.closest("details")) parent.open = true; target.focus({ preventScroll: false }); }
    }, "owner-add");
    wrapper.append(add, list);
    const items = read(path) || [];
    if (!items.length) list.append(node("p", "No items yet. Add one to get started.", "owner-empty"));
    items.forEach((item, index) => {
      const card = node("details", undefined, "owner-item"); card.open = index === 0;
      const heading = node("summary", undefined, "owner-item-heading");
      const titleNode = node("h4", item.title && (Array.isArray(item.title) ? item.title.join(" ") : item.title) || item.name || item.place || item.from || "Item " + (index + 1));
      const actions = node("div", undefined, "owner-item-actions");
      const reorder = (step) => {
        const target = index + step;
        if (target < 0 || target >= items.length) return;
        [items[index], items[target]] = [items[target], items[index]]; setDirty(); render();
      };
      const up = button("↑", event => { event.preventDefault(); reorder(-1); }); up.disabled = index === 0; up.setAttribute("aria-label", "Move item up");
      const down = button("↓", event => { event.preventDefault(); reorder(1); }); down.disabled = index === items.length - 1; down.setAttribute("aria-label", "Move item down");
      const remove = button("Delete", event => {
        event.preventDefault();
        if (!window.confirm("Remove this item? The removal will become public when you save.")) return;
        items.splice(index, 1); setDirty(); render();
      }, "owner-delete");
      actions.append(up, down); if (removable) actions.append(remove); heading.append(titleNode, actions); card.append(heading);
      build(card, path.concat(index), item); list.append(card);
    });
    parent.append(wrapper);
  }
  function profilePanel(root) {
    const info = group("Site information", "Your name and public contact information across the website.");
    grid(info, [["name", "Name"], ["brand", "Navigation name"], ["tagline", "Tagline"], ["role", "Role"], ["affiliation", "Affiliation"], ["location", "Location"], ["email", "Email"]].map(([key, label]) => field(["site", key], label, { type: key === "email" ? "email" : "text" })));
    info.append(field(["site", "footer"], "Footer text"));
    root.append(info);
    const links = group("Public links", "Use an HTTPS URL or a site asset path. Leave a link empty to hide it.");
    grid(links, [["scholar", "Google Scholar"], ["linkedin", "LinkedIn"], ["github", "GitHub"], ["cv", "CV / résumé"]].map(([key, label]) => field(["site", "links", key], label, { placeholder: key === "cv" ? "assets/cv.pdf" : "https://" })));
    root.append(links);
    const observer = group("Star map location", "The sky is calculated from these coordinates.");
    grid(observer, [field(["site", "observer", "place"], "Place"), field(["site", "observer", "lat"], "Latitude", { type: "number", min: -90, max: 90 }), field(["site", "observer", "lon"], "Longitude", { type: "number", min: -180, max: 180 })]);
    observer.querySelectorAll('input[type="number"]').forEach(input => { input.step = "any"; });
    root.append(observer);
    const pages = group("Page headings", "Edit each page’s title and introduction.");
    for (const key of ["papers", "gallery", "message", "starmap", "farm", "woods", "pond", "voyager"]) {
      const row = node("div", undefined, "owner-page-copy"); row.append(node("h4", key[0].toUpperCase() + key.slice(1)));
      grid(row, [field(["site", "pages", key, "title"], "Title"), field(["site", "pages", key, "subtitle"], "Introduction", { type: "textarea", rows: 2 })]); pages.append(row);
    }
    root.append(pages);
  }
  function homePanel(root) {
    const hero = group("Welcome & about", "Line breaks in the hero title and introduction are preserved.");
    grid(hero, [field(["home", "heroTitle"], "Hero title", { type: "textarea", rows: 2 }), field(["home", "heroLede"], "Hero introduction", { type: "textarea", rows: 2 }), field(["home", "avatar"], "Portrait image", { placeholder: "assets/avatar.jpg", image: true, ratio: "3:4" }), field(["home", "heroFoot"], "Hero footer")]);
    hero.append(field(["home", "bio"], "Biography", { type: "lines", rows: 6, help: "One paragraph per line." }), field(["home", "interests"], "Research interests", { type: "lines", help: "One interest per line." }), field(["home", "beyond"], "Beyond the lab", { type: "textarea" }), field(["home", "coda"], "Story closing text", { type: "textarea" })); root.append(hero);
    collection(root, ["home", "education"], "Education", "", { date: "", title: "", detail: "" }, (card, path) => grid(card, [field(path.concat("date"), "Date / period"), field(path.concat("title"), "Qualification", { required: true }), field(path.concat("detail"), "Details", { type: "textarea" })]));
    collection(root, ["home", "news"], "News", "", { date: "", text: "", href: "" }, (card, path) => grid(card, [field(path.concat("date"), "Date"), field(path.concat("text"), "News", { type: "textarea", required: true }), field(path.concat("href"), "Optional link")]));
    collection(root, ["home", "explore"], "Explore cards", "Change destinations and descriptions here.", { title: "", text: "", href: "", icon: "star4" }, (card, path) => grid(card, [field(path.concat("title"), "Title", { required: true }), field(path.concat("text"), "Description"), field(path.concat("href"), "Destination", { required: true }), field(path.concat("icon"), "Icon", { options: ["book", "image", "bottle", "constel", "planet", "paw", "star4", "globe", "mail"] })]));
  }
  function paperPanel(root) {
    collection(root, ["papers"], "Papers", "Add publications, preprints, or projects. The first image is the card cover; extra figures open in the image viewer.", () => ({ title: "", authors: [draft.site.name || ""], venue: "", year: new Date().getFullYear(), type: "publication", topics: [], image: "", selected: false, abstract: "", links: { pdf: "", code: "", project: "", data: "" }, bibtex: "", figures: [] }), (card, path, paper) => {
      paper.links ||= {}; paper.figures ||= [];
      card.append(field(path.concat("title"), "Title", { required: true }));
      grid(card, [field(path.concat("authors"), "Authors in order", { type: "lines", help: "One full author name per line.", required: true }), field(path.concat("venue"), "Venue / journal / status"), field(path.concat("year"), "Year", { type: "number", min: 1900, max: 2200, required: true }), field(path.concat("type"), "Type", { options: ["publication", "preprint", "project"] }), field(path.concat("topics"), "Topics", { type: "lines", help: "One topic per line." }), field(path.concat("selected"), "Selected paper", { type: "checkbox" })]);
      card.append(field(path.concat("abstract"), "Abstract", { type: "textarea", rows: 6 }), field(path.concat("image"), "Cover figure URL / asset path", { image: true, ratio: "4:3" }));
      if (paper.image) { const img = node("img", undefined, "owner-image-preview"); img.src = paper.image; img.alt = "Current paper cover"; img.loading = "lazy"; card.append(img); }
      grid(card, [["pdf", "PDF"], ["code", "Code"], ["project", "Project website"], ["data", "Dataset"]].map(([key, title]) => field(path.concat("links", key), title)));
      card.append(field(path.concat("bibtex"), "BibTeX", { type: "textarea", rows: 5, help: "Optional. Leave empty to generate a citation from the paper fields." }));
      collection(card, path.concat("figures"), "Figures", "Upload and crop an image, or use an image URL or existing site asset.", { src: "", caption: "" }, (figure, figPath) => grid(figure, [field(figPath.concat("src"), "Image", { required: true, image: true }), field(figPath.concat("caption"), "Caption")]));
    });
  }
  function galleryPanel(root) {
    collection(root, ["gallery"], "Albums", "Each album appears in the timeline, photo wall, and map.", () => ({ id: "album-" + Date.now(), place: "", title: "", date: new Date().toISOString().slice(0, 7), coords: [0, 0], tags: ["Travel"], favorite: false, story: "", photos: [] }), (card, path, album) => {
      album.photos ||= [];
      grid(card, [field(path.concat("id"), "Unique album ID", { required: true }), field(path.concat("place"), "Place", { required: true }), field(path.concat("title"), "Title", { required: true }), field(path.concat("date"), "Month (YYYY-MM)", { required: true }), field(path.concat("coords", 0), "Latitude", { type: "number", min: -90, max: 90 }), field(path.concat("coords", 1), "Longitude", { type: "number", min: -180, max: 180 }), field(path.concat("tags"), "Tags", { type: "lines", help: "Travel, Nature, Life, Food, People; one per line." }), field(path.concat("favorite"), "Favorite album", { type: "checkbox" })]);
      card.querySelectorAll('input[type="number"]').forEach(input => { input.step = "any"; });
      card.append(field(path.concat("story"), "Story", { type: "textarea" }));
      collection(card, path.concat("photos"), "Photos", "Leave image empty to display a painted placeholder.", { src: "", caption: "", paint: { sky: "dusk", land: "mountains" } }, (photo, pth, data) => {
        data.paint ||= { sky: "dusk", land: "mountains" };
        grid(photo, [field(pth.concat("src"), "Image URL / asset path", { image: true }), field(pth.concat("caption"), "Caption"), field(pth.concat("paint", "sky"), "Placeholder sky", { options: ["dusk", "aurora", "milkyway", "sunset", "night", "dawn"] }), field(pth.concat("paint", "land"), "Placeholder landscape", { options: ["mountains", "sea", "city", "hills", "desert", "lake", "sakura", "fuji"] }), field(pth.concat("paint", "cabin"), "Cabin in placeholder", { type: "checkbox" })]);
      });
    });
  }
  function publicPanel(root) {
    collection(root, ["bottles"], "Public bottles", "Only these curated letters appear publicly. Private inbox letters are never published automatically.", () => ({ from: draft.site.name || "", date: new Date().toISOString().slice(0, 10), text: "", reply: "" }), (card, path) => {
      grid(card, [field(path.concat("from"), "From"), field(path.concat("date"), "Date (YYYY-MM-DD)")]);
      card.append(field(path.concat("text"), "Letter", { type: "textarea", required: true, rows: 5 }), field(path.concat("reply"), "Public reply", { type: "textarea" }));
    });
    collection(root, ["voyager"], "Voyager stops", "Edit the journey’s story and scene images. Existing body IDs and positions keep the scene connected to its map.", () => ({ id: "stop-" + Date.now(), date: new Date().toISOString().slice(0, 10), place: "", en: "", title: ["", ""], poem: "", fact: "", body: "saturn", chapter: 0, color: "#dfc69e", map: [50, 50], scene: { art: "", target: "", label: "", vantage: "", terrain: "", pose: "", haze: 0, particles: "", description: "" } }), (card, path, stop) => {
      stop.scene ||= {};
      grid(card, [field(path.concat("id"), "Unique stop ID", { required: true }), field(path.concat("date"), "Date (YYYY-MM-DD)"), field(path.concat("place"), "Place", { required: true }), field(path.concat("en"), "Scene heading"), field(path.concat("title"), "Title lines", { type: "lines", required: true, help: "Exactly two nonempty title lines." }), field(path.concat("body"), "Celestial body", { options: ["earth", "venus", "jupiter", "saturn", "titan", "enceladus", "iapetus", "phoebe", "nebula"] }), field(path.concat("chapter"), "Chapter", { type: "number", min: 0, max: 3 }), field(path.concat("color"), "Accent color"), field(path.concat("map", 0), "Map X (%)", { type: "number", min: 0, max: 100 }), field(path.concat("map", 1), "Map Y (%)", { type: "number", min: 0, max: 100 })]);
      card.append(field(path.concat("poem"), "Poem", { type: "textarea" }), field(path.concat("fact"), "Mission fact", { type: "textarea" }));
      card.append(field(path.concat("source"), "Source link"));
      grid(card, ["equinox", "eclipse", "plume", "close", "farewell"].map(key => field(path.concat(key), "Scene effect: " + key, { type: "checkbox" })));
      grid(card, ["art", "target", "label", "vantage", "terrain", "pose", "description", "particles", "haze"].map(key => field(path.concat("scene", key), "Scene " + key, key === "haze" ? { type: "number", min: 0, max: 1 } : key === "art" ? { required: true, image: true } : key === "particles" ? { options: ["", "ice"] } : {})));
      card.querySelectorAll('input[type="number"]').forEach(input => { input.step = "any"; });
    });
    const extras = group("Additional text & links", "Structured page content is editable above. The JSON backup contains the full public content for transfer or recovery.");
    extras.append(node("p", "Choose Upload & crop beside an image field, or use an HTTPS URL or a path such as assets/paper1.png. Uploaded images enter your draft; Save & publish makes the change visible on the website.", "owner-help")); root.append(extras);
  }
  function animalsPanel(root) {
    const keeper = group("Farm keeper", "The character who looks after the farm. These changes publish with Save & publish.");
    grid(keeper, [field(["farm", "keeper", "name"], "Name", { required: true, maxLength: 24 }), field(["farm", "keeper", "title"], "Title", { maxLength: 200 }), field(["farm", "keeper", "species"], "Species", { options: species }), field(["farm", "keeper", "note"], "Story", { type: "textarea", maxLength: 2000 })]); root.append(keeper);
    collection(root, ["farm", "residents"], "Farm residents", "Add animals, edit their details, or send them indoors to rest. Resting animals keep their information and can return at any time. There are 24 resident homes, including resting animals and approved adoptions; the keeper has a separate home. Save & publish applies these changes to the website.", () => {
      const id = "resident-" + crypto.randomUUID(); newAnimalIds.add(id);
      return { id, species: "rabbit", name: "", adoptedBy: draft.site.name || "", note: "", since: new Date().toISOString().slice(0, 7), active: true };
    }, (card, path, animal) => {
      const activity = node("div", undefined, "owner-animal-activity");
      const badge = node("span", animal.active !== false ? "Out on the farm" : "Resting indoors", "owner-animal-badge");
      const toggle = button(animal.active !== false ? "Send indoors" : "Let outside", () => {
        write(path.concat("active"), animal.active === false);
        badge.textContent = animal.active !== false ? "Out on the farm" : "Resting indoors";
        toggle.textContent = animal.active !== false ? "Send indoors" : "Let outside";
        status("Animal activity changed in your draft. Save & publish to update the farm.");
      });
      activity.append(badge, toggle); card.append(activity);
      if (newAnimalIds.has(animal.id)) activity.append(button("Remove draft animal", () => {
        const animals = read(["farm", "residents"]); animals.splice(path[path.length - 1], 1); newAnimalIds.delete(animal.id); setDirty(); render();
        status("New animal removed from your unpublished draft.");
      }, "owner-delete"));
      grid(card, [field(path.concat("name"), "Name", { required: true, maxLength: 24 }), field(path.concat("species"), "Species", { options: species }), field(path.concat("adoptedBy"), "Adopted by", { maxLength: 40 }), field(path.concat("since"), "Since (YYYY-MM)", { required: true, pattern: "[0-9]{4}-(0[1-9]|1[0-2])", placeholder: "YYYY-MM" }), field(path.concat("note"), "Story", { type: "textarea", maxLength: 140 })]);
      card.append(node("p", "The activity above is a draft. Save & publish applies it for every visitor.", "owner-help"));
    }, { removable: false });
  }
  function render() {
    if (!draft) return;
    window.OwnerImages?.cleanup();
    for (const [key, fn] of [["profile", profilePanel], ["home", homePanel], ["papers", paperPanel], ["gallery", galleryPanel], ["animals", animalsPanel], ["public", publicPanel]]) {
      const root = document.querySelector('[data-owner-panel="' + key + '"]'); root.replaceChildren(); fn(root);
    }
    showTab(tab);
  }
  function showTab(value) {
    tab = ["profile", "home", "papers", "gallery", "animals", "public", "letters"].includes(value) ? value : "profile";
    document.querySelectorAll("[data-owner-tab]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.ownerTab === tab)));
    document.querySelectorAll("[data-owner-panel]").forEach(el => { el.hidden = el.dataset.ownerPanel !== tab || !api.signedIn; });
    $("ownerEditor").hidden = tab === "letters" || !api.signedIn;
    $("ownerViewPage").href = { papers: "papers.html", gallery: "gallery.html", animals: "farm.html", public: "message.html" }[tab] || "index.html";
    $("refreshButton").hidden = tab !== "letters";
    $("notifyButton").hidden = tab !== "letters";
    $("messageCount").hidden = tab !== "letters";
  }
  function merged(content) {
    const result = clone(defaults);
    for (const key of sections) if (Object.hasOwn(content, key)) result[key] = clone(content[key]);
    // Public overrides may contain only a subset of site/home fields.
    result.site = { ...clone(defaults.site), ...(content.site || {}), links: { ...defaults.site.links, ...(content.site || {}).links }, observer: { ...defaults.site.observer, ...(content.site || {}).observer }, pages: Object.fromEntries(Object.entries(defaults.site.pages).map(([key, values]) => [key, { ...values, ...(content.site || {}).pages?.[key] }])) };
    result.home = { ...clone(defaults.home), ...(content.home || {}) };
    return result;
  }
  function setBusy(value) {
    busy = value;
    $("ownerContentForm").inert = value;
    $("reloadContentButton").disabled = value;
    $("importContentFile").disabled = value;
    $("saveContentButton").disabled = value || !draft || !dirty;
  }
  async function load(force = false) {
    if (busy || !api.signedIn) return;
    if (dirty && !force && !window.confirm("Discard your unpublished changes and reload the published website? Export a backup first if you want to keep this draft.")) return;
    const version = generation;
    setBusy(true); status("Loading the published website…");
    try {
      if (!defaults) {
        const response = await fetch("data/site-defaults.json?v=20261010-owner1", { cache: "no-store" });
        if (!response.ok) throw new Error("The website’s starting content could not be loaded.");
        defaults = await response.json();
      }
      const result = await api.getContent();
      if (version !== generation || !api.signedIn) return;
      draft = merged(result.content); revision = result.revision; updatedAt = result.updatedAt; newAnimalIds.clear();
      $("ownerRevision").textContent = "Version " + revision + (updatedAt ? " · " + new Date(updatedAt).toLocaleString() : " · Original website content");
      render(); setDirty(false); status("Choose a section to edit. Save & publish updates the website for everyone.");
    } catch (error) {
      if (version !== generation) return;
      status(error.message || "Website content could not be loaded. Please try again.", true);
      $("ownerSaveState").textContent = draft ? "Unpublished changes" : "Content unavailable";
      if (error.code === "auth_expired" || error.code === "forbidden") window.dispatchEvent(new CustomEvent("host-auth-expired"));
    } finally { if (version === generation) setBusy(false); }
  }
  $("ownerContentForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !draft || !dirty || !api.signedIn) return;
    // Reveal the first invalid field even when it belongs to a different tab.
    const invalid = $("ownerContentForm").querySelector(":invalid");
    if (invalid) { const panel = invalid.closest("[data-owner-panel]"); if (panel) showTab(panel.dataset.ownerPanel); for (let parent = invalid.closest("details"); parent; parent = parent.parentElement.closest("details")) parent.open = true; invalid.reportValidity(); return; }
    const version = generation, submitted = clone(draft);
    setBusy(true); status("Saving and publishing your changes…");
    try {
      const result = await api.saveContent(revision, submitted);
      if (version !== generation || !api.signedIn) return;
      revision = result.revision; updatedAt = result.updatedAt; draft = merged(result.content); newAnimalIds.clear();
      $("ownerRevision").textContent = "Version " + revision + " · " + new Date(updatedAt).toLocaleString();
      render(); setDirty(false); status("Published. Visitors will see your changes when they open or refresh a page.");
    } catch (error) {
      if (version !== generation) return;
      status(error.message || "Publishing failed. Your unpublished changes are still here.", true);
      if (error.code === "auth_expired" || error.code === "forbidden") window.dispatchEvent(new CustomEvent("host-auth-expired"));
    } finally { if (version === generation) setBusy(false); }
  });
  // Native validation cannot focus a field in a hidden section; route it first.
  $("ownerContentForm").addEventListener("invalid", event => {
    const panel = event.target.closest("[data-owner-panel]");
    if (panel) showTab(panel.dataset.ownerPanel);
    for (let parent = event.target.closest("details"); parent; parent = parent.parentElement.closest("details")) parent.open = true;
  }, true);
  $("reloadContentButton").addEventListener("click", () => load());
  document.querySelectorAll("[data-owner-tab]").forEach(el => el.addEventListener("click", () => {
    showTab(el.dataset.ownerTab); history.replaceState(null, "", "#" + tab);
  }));
  $("exportContentButton").addEventListener("click", () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify({ format: "quiet-shore-content-v1", revision, updatedAt, content: draft }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = node("a"); link.href = url; link.download = "website-content-" + new Date().toISOString().slice(0, 10) + ".json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("importContentFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file || !draft || busy) return;
    const version = generation;
    try {
      if (file.size > 1048576) throw new Error("The backup is larger than 1 MB.");
      const data = JSON.parse(await file.text());
      if (version !== generation || !api.signedIn) return;
      if (data.format !== "quiet-shore-content-v1" || !data.content || typeof data.content !== "object" || Array.isArray(data.content) || Object.keys(data.content).some(key => !sections.includes(key))) throw new Error("Choose a website content backup exported from this workspace.");
      if (dirty && !window.confirm("Replace your unpublished draft with this backup?")) return;
      const previous = draft;
      try { draft = merged(data.content); render(); } catch (_) { draft = previous; render(); throw new Error("The backup does not match the website content format."); }
      setDirty(); status("Backup imported as an unpublished draft. Review the fields, then save to publish.");
    } catch (error) { if (version === generation) status(error.message, true); }
    finally { event.target.value = ""; }
  });
  window.addEventListener("beforeunload", event => { if (dirty && draft) { event.preventDefault(); event.returnValue = ""; } });
  window.addEventListener("host-manage-residents", () => { showTab("animals"); history.replaceState(null, "", "#animals"); });
  window.addEventListener("host-session-change", event => {
    window.OwnerImages?.cancelAll();
    generation += 1; busy = false;
    if (event.detail.signedIn) {
      const hash = location.hash.slice(1); showTab(hash === "inbox" ? "letters" : hash || "profile");
      if (draft && dirty) { setBusy(false); status("Signed in again. Your unpublished draft is still here. Save to publish, or export a backup."); }
      else load(true);
    } else {
      $("ownerEditor").hidden = true; $("lettersWorkspace").hidden = true; $("ownerAdoptionAnimals").hidden = true;
      if (event.detail.explicit || !dirty) {
        window.OwnerImages?.cleanup();
        draft = null; dirty = false; newAnimalIds.clear();
        document.querySelectorAll("#ownerContentForm [data-owner-panel]").forEach(el => el.replaceChildren());
        status("");
      }
      setBusy(false);
    }
  });
  showTab(location.hash.slice(1));
  if (api.signedIn) load(true);
})();
