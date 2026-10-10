/* Approved adoption records are saved separately from the website content draft. */
(function () {
  "use strict";
  const api = window.HostInbox, root = document.getElementById("ownerAdoptionAnimals");
  if (!api || !root) return;
  const species = ["rabbit", "panda", "fox", "shiba", "hedgehog", "duckling", "penguin", "redpanda", "raccoon", "wolf", "crocodile", "fennec"];
  const speciesLabels = { rabbit: "Rabbit", panda: "Panda", fox: "Fox", shiba: "Shiba Inu", hedgehog: "Hedgehog", duckling: "Duckling", penguin: "Penguin", redpanda: "Red panda", raccoon: "Raccoon", wolf: "Wolf", crocodile: "Crocodile", fennec: "Fennec fox" };
  const keys = ["name", "species", "adoptedBy", "note", "since", "active"];
  const records = new Map();
  let generation = 0, listTicket = 0, loading = false, loaded = false, refreshQueued = false, message = "", messageError = false, focusId = null;
  const copy = row => Object.fromEntries(keys.map(key => [key, key === "active" ? row.active !== false : row[key] || ""]));
  const same = (a, b) => keys.every(key => a[key] === b[key]);
  const dirty = state => !same(state.draft, copy(state.row));
  const anyDirty = () => [...records.values()].some(dirty);
  const anyBusy = () => [...records.values()].some(state => state.busy);
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, run, className) {
    const el = node("button", text, className); el.type = "button"; el.addEventListener("click", run); return el;
  }
  function report(text, error = false) {
    message = text; messageError = error;
    const status = root.querySelector("#ownerAnimalsStatus");
    if (status) { status.textContent = text; status.classList.toggle("is-error", error); }
  }
  function field(state, key, title, options = {}) {
    const label = node("label", undefined, "owner-field"); label.append(node("span", title));
    const input = node(key === "species" ? "select" : key === "note" ? "textarea" : "input");
    input.dataset.residentField = key;
    input.name = key;
    if (key === "species") for (const value of species) { const option = node("option", speciesLabels[value]); option.value = value; input.append(option); }
    else if (key === "note") input.rows = 3;
    else input.type = "text";
    input.value = state.draft[key];
    input.required = !!options.required;
    if (options.maxLength) input.maxLength = options.maxLength;
    if (options.pattern) input.pattern = options.pattern;
    if (options.placeholder) input.placeholder = options.placeholder;
    input.addEventListener("input", () => {
      state.draft[key] = input.value;
      input.setCustomValidity(key === "name" && !input.value.trim() ? "Please give this animal a name." : "");
      state.error = ""; refreshCard(state);
    });
    if (key === "name" && !input.value.trim()) input.setCustomValidity("Please give this animal a name.");
    label.append(input); return label;
  }
  function refreshCard(state) {
    const card = state.card;
    if (!card) return;
    card.dataset.busy = String(state.busy); card.setAttribute("aria-busy", String(state.busy));
    card.classList.toggle("has-animal-draft", dirty(state));
    card.querySelector(".owner-animal-badge").textContent = state.row.active !== false ? "Out on the farm" : "Resting indoors";
    card.querySelector(".owner-animal-toggle").textContent = state.draft.active ? "Send indoors" : "Let outside";
    const status = card.querySelector(".owner-animal-status");
    status.textContent = state.error || (state.busy ? "Saving this animal…" : state.stale ? "This animal changed elsewhere. Your edits are kept here. Cancel changes reloads its latest published information." : dirty(state) ? "Unsaved animal changes. Save animal publishes these details and activity." : "Published animal information.");
    status.classList.toggle("is-error", !!state.error || state.stale);
    const form = card.querySelector("form"); form.inert = state.busy;
    card.querySelector(".owner-animal-toggle").disabled = state.busy || !api.signedIn || state.missing;
    card.querySelector(".owner-animal-save").disabled = state.busy || !api.signedIn || !dirty(state) || state.missing;
    card.querySelector(".owner-animal-cancel").disabled = state.busy || !dirty(state) && !state.stale;
    card.querySelector("h4").textContent = state.row.name;
    card.dataset.residentVersion = String(state.row.version);
    const backup = root.querySelector(".owner-animal-backup"); if (backup) backup.disabled = !anyDirty();
  }
  function render() {
    const previousOpen = new Set([...root.querySelectorAll("details[open][data-resident-id]")].map(card => card.dataset.residentId));
    root.replaceChildren();
    const group = node("div", undefined, "owner-group owner-adopted-animals");
    const header = node("div", undefined, "owner-animals-heading");
    header.append(node("h3", "Approved adoption animals"));
    const actions = node("div", undefined, "owner-actions");
    const refresh = button("Refresh animals", () => load()); refresh.disabled = loading || anyBusy();
    const backup = button("Export animal drafts", exportDrafts); backup.disabled = !anyDirty(); backup.className = "owner-animal-backup";
    actions.append(refresh, backup); header.append(actions); group.append(header);
    group.append(node("p", "Visitor adoptions approved in Letters & requests appear here. Save animal immediately updates that animal for every visitor. These records are separate from Save & publish above. Refresh keeps your unsaved animal edits. Resting animals keep their home within the farm’s 24 resident spaces; the keeper is counted separately.", "owner-help"));
    const status = node("p", message, "owner-status"); status.id = "ownerAnimalsStatus"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.classList.toggle("is-error", messageError); group.append(status);
    const list = node("div", undefined, "owner-collection");
    if (!records.size) list.append(node("p", loading ? "Loading approved animals…" : loaded ? "No approved visitor animals yet. You can add original residents above, or approve an adoption in Letters & requests." : "Refresh to load approved animals.", "owner-empty"));
    for (const [id, state] of records) {
      const card = node("details", undefined, "owner-item owner-adopted-animal"); card.dataset.residentId = id; state.card = card;
      card.open = previousOpen.has(id) || focusId === id || records.size === 1;
      const summary = node("summary", undefined, "owner-item-heading"); summary.append(node("h4", state.row.name));
      const badge = node("span", "", "owner-animal-badge"); summary.append(badge); card.append(summary);
      const form = node("form"); form.noValidate = true;
      const grid = node("div", undefined, "owner-field-grid");
      grid.append(field(state, "name", "Name", { required: true, maxLength: 24 }), field(state, "species", "Species"), field(state, "adoptedBy", "Adopted by", { maxLength: 40 }), field(state, "since", "Since (YYYY-MM)", { required: true, pattern: "[0-9]{4}-(0[1-9]|1[0-2])", placeholder: "YYYY-MM" }), field(state, "note", "Story", { maxLength: 140 }));
      form.append(grid);
      const controls = node("div", undefined, "owner-animal-controls");
      controls.append(button("", () => { state.draft.active = !state.draft.active; state.error = ""; refreshCard(state); }, "owner-animal-toggle"));
      const save = node("button", "Save animal", "owner-animal-save"); save.type = "submit";
      controls.append(save, button("Cancel changes", () => cancel(state, id), "owner-animal-cancel"));
      form.append(controls);
      const animalStatus = node("p", "", "owner-status owner-animal-status"); animalStatus.setAttribute("role", "status"); animalStatus.setAttribute("aria-live", "polite"); form.append(animalStatus);
      form.addEventListener("submit", event => { event.preventDefault(); saveAnimal(id, state); }); card.append(form); list.append(card); refreshCard(state);
    }
    group.append(list); root.append(group);
    if (focusId) {
      const target = [...root.querySelectorAll("[data-resident-id]")].find(card => card.dataset.residentId === focusId);
      if (target && !root.hidden) { target.open = true; target.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
  }
  function cancel(state, id) {
    if (state.busy) return;
    if ((dirty(state) || state.stale) && !window.confirm("Discard this animal’s unsaved changes and use its latest published information? Export animal drafts first to keep a backup.")) return;
    if (state.missing) records.delete(id);
    else { state.row = state.latest || state.row; state.draft = copy(state.row); state.stale = false; state.error = ""; }
    render();
  }
  function exportDrafts() {
    const drafts = [...records.values()].filter(dirty).map(state => ({ id: state.row.id, version: state.row.version, ...state.draft }));
    if (!drafts.length) return;
    const blob = new Blob([JSON.stringify({ format: "quiet-shore-animal-drafts-v1", animals: drafts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = node("a"); link.href = url; link.download = "animal-drafts-" + new Date().toISOString().slice(0, 10) + ".json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function load() {
    if (!api.signedIn || loading) return;
    if (anyBusy()) { refreshQueued = true; return; }
    if (typeof api.listResidents !== "function") { report("Animal management is unavailable. Refresh the workspace and try again.", true); render(); return; }
    const session = generation, ticket = ++listTicket;
    loading = true; report("Loading approved animals…"); render();
    try {
      const rows = await api.listResidents();
      if (session !== generation || ticket !== listTicket || !api.signedIn) return;
      const returned = new Set(rows.map(row => row.id));
      for (const row of rows) {
        const state = records.get(row.id);
        if (!state) records.set(row.id, { row, draft: copy(row), busy: false, stale: false, error: "" });
        else if (dirty(state)) { state.latest = row; state.missing = false; state.stale = row.version !== state.row.version; }
        else { state.row = row; state.draft = copy(row); state.latest = null; state.stale = false; state.missing = false; state.error = ""; }
      }
      for (const [id, state] of records) if (!returned.has(id)) {
        if (dirty(state)) { state.missing = true; state.stale = true; state.error = "This animal was removed elsewhere. Your draft is kept here and can be exported. Cancel changes removes this draft."; }
        else records.delete(id);
      }
      loaded = true; report(anyDirty() ? "Published animals refreshed. Your unsaved edits are still here." : "Approved animals are up to date.");
    } catch (error) {
      if (session !== generation || ticket !== listTicket) return;
      report(error.message || "Animals could not be loaded. Your unsaved edits are still here.", true);
      if (error.code === "auth_expired" || error.code === "forbidden") window.dispatchEvent(new CustomEvent("host-auth-expired"));
    } finally {
      if (session === generation && ticket === listTicket) { loading = false; render(); }
    }
  }
  async function saveAnimal(id, state) {
    if (!api.signedIn || state.busy || state.missing || !dirty(state)) return;
    const invalid = state.card.querySelector(":invalid");
    if (invalid) { state.card.open = true; invalid.reportValidity(); return; }
    const session = generation, submitted = { version: state.row.version, ...state.draft };
    // A list response started before this save cannot replace its confirmed result.
    listTicket += 1; loading = false; state.busy = true; state.error = ""; refreshCard(state);
    try {
      const row = await api.updateResident(id, submitted);
      if (session !== generation || !api.signedIn || !records.has(id)) return;
      state.row = row; state.draft = copy(row); state.latest = null; state.stale = false; state.missing = false;
      report("Saved “" + row.name + "”. Visitors see its new information and activity when they open or refresh the farm.");
      window.dispatchEvent(new CustomEvent("host-residents-changed", { detail: { id, source: "animals" } }));
    } catch (error) {
      if (session !== generation || !records.has(id)) return;
      state.error = error.code === "resident_conflict" ? "This animal changed elsewhere. Your edits are kept here. Refresh animals checks its latest information; Cancel changes reloads it after confirmation." : error.message || "Saving failed. Your unsaved animal edits are still here.";
      if (error.code === "resident_conflict") state.stale = true;
      if (error.code === "auth_expired" || error.code === "forbidden") window.dispatchEvent(new CustomEvent("host-auth-expired"));
    } finally {
      if (session === generation && records.has(id)) {
        state.busy = false; refreshCard(state);
        const backup = root.querySelector(".owner-animal-backup"); if (backup) backup.disabled = !anyDirty();
        if (refreshQueued) { refreshQueued = false; load(); }
      }
    }
  }
  window.addEventListener("host-session-change", event => {
    generation += 1; listTicket += 1; loading = false; refreshQueued = false;
    for (const state of records.values()) state.busy = false;
    if (event.detail.signedIn) { render(); load(); }
    else {
      root.hidden = true;
      if (event.detail.explicit) { records.clear(); loaded = false; message = ""; messageError = false; focusId = null; root.replaceChildren(); }
      else render();
    }
  });
  window.addEventListener("host-residents-changed", event => { if (event.detail?.source !== "animals") load(); });
  window.addEventListener("host-manage-residents", event => { focusId = event.detail?.id || null; render(); load(); });
  window.addEventListener("beforeunload", event => { if (anyDirty()) { event.preventDefault(); event.returnValue = ""; } });
  document.querySelector('[data-owner-tab="animals"]')?.addEventListener("click", () => { if (!loaded) load(); });
  render();
  if (api.signedIn) load();
})();
