/* Selects share predictable click, keyboard and touch behavior throughout the workspace. */
(function () {
  "use strict";
  const controls = new WeakMap();
  let active = null, sequence = 0;
  const eligible = select => !select.multiple && select.size <= 1;
  const unavailable = state => state.select.matches(":disabled") || Boolean(state.select.closest("[inert]"));
  const visible = state => state.select.isConnected && state.trigger.getClientRects().length && !state.trigger.closest("[hidden], details:not([open])");
  const enabledOptions = state => [...state.select.options].filter(option => !option.hidden && !option.disabled && !option.closest("optgroup[disabled]"));

  function close() {
    if (!active) return;
    const state = active; active = null;
    state.trigger.setAttribute("aria-expanded", "false");
    state.trigger.removeAttribute("aria-activedescendant");
    state.popup.remove(); state.popup = null; state.search = "";
  }
  function sync(state) {
    state.value.textContent = state.select.selectedOptions[0]?.label || "Choose an option";
    state.trigger.disabled = unavailable(state);
    state.trigger.setAttribute("aria-required", String(state.select.required));
    if (state.select.getAttribute("aria-invalid")) state.trigger.setAttribute("aria-invalid", state.select.getAttribute("aria-invalid"));
    else state.trigger.removeAttribute("aria-invalid");
    if (active === state && (!visible(state) || unavailable(state))) close();
  }
  function highlight(state, index) {
    if (!state.items.length) return;
    state.index = Math.max(0, Math.min(index, state.items.length - 1));
    for (let i = 0; i < state.items.length; i++) state.items[i].element.classList.toggle("is-highlighted", i === state.index);
    const item = state.items[state.index].element;
    state.trigger.setAttribute("aria-activedescendant", item.id);
    const top = item.offsetTop, bottom = top + item.offsetHeight;
    if (top < state.popup.scrollTop) state.popup.scrollTop = top;
    else if (bottom > state.popup.scrollTop + state.popup.clientHeight) state.popup.scrollTop = bottom - state.popup.clientHeight;
  }
  function position(state) {
    const bounds = state.trigger.getBoundingClientRect(), viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft || 0, topEdge = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    const below = topEdge + height - bounds.bottom - 12, above = bounds.top - topEdge - 12;
    const down = below >= Math.min(240, above);
    const popup = state.popup;
    popup.style.width = Math.min(bounds.width, width - 24) + "px";
    popup.style.left = Math.max(leftEdge + 12, Math.min(bounds.left, leftEdge + width - popup.offsetWidth - 12)) + "px";
    popup.style.maxHeight = Math.max(48, Math.min(280, down ? below : above)) + "px";
    popup.style.top = (down ? bounds.bottom + 6 : Math.max(topEdge + 6, bounds.top - popup.offsetHeight - 6)) + "px";
  }
  function choose(state, option) {
    if (unavailable(state) || !option || !enabledOptions(state).includes(option)) return;
    const changed = state.select.selectedIndex !== option.index;
    state.select.selectedIndex = option.index;
    close(); sync(state); state.trigger.focus({ preventScroll: true });
    if (changed) {
      state.select.dispatchEvent(new Event("input", { bubbles: true }));
      state.select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function open(state) {
    if (unavailable(state) || !visible(state)) return;
    close(); sync(state);
    const popup = document.createElement("div");
    popup.className = "owner-select-menu"; popup.id = state.menuId; popup.setAttribute("role", "listbox");
    popup.setAttribute("aria-label", state.trigger.getAttribute("aria-label") || "Options");
    if (state.trigger.hasAttribute("aria-labelledby")) popup.setAttribute("aria-labelledby", state.trigger.getAttribute("aria-labelledby"));
    state.popup = popup; state.items = []; state.search = ""; state.searchAt = 0;
    for (const option of enabledOptions(state)) {
      const item = document.createElement("div"); item.className = "owner-select-option";
      item.id = state.menuId + "-" + option.index; item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected)); item.textContent = option.label;
      if (option.selected) { const check = document.createElement("span"); check.className = "owner-select-check"; check.setAttribute("aria-hidden", "true"); check.textContent = "✓"; item.append(check); }
      item.addEventListener("pointerdown", event => { if (event.pointerType !== "touch") event.preventDefault(); });
      item.addEventListener("pointermove", () => highlight(state, state.items.findIndex(entry => entry.element === item)));
      item.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); choose(state, option); });
      state.items.push({ option, element: item }); popup.append(item);
    }
    (state.trigger.closest("dialog") || document.body).append(popup);
    active = state; state.trigger.setAttribute("aria-expanded", "true");
    position(state); highlight(state, Math.max(0, state.items.findIndex(entry => entry.option.selected)));
  }
  function keydown(state, event) {
    if (unavailable(state)) return;
    const isOpen = active === state;
    if (event.key === "Escape") {
      if (isOpen) { event.preventDefault(); event.stopPropagation(); close(); }
      return;
    }
    if (event.key === "Tab") { if (isOpen) close(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!isOpen) { open(state); if (event.key === "Home") highlight(state, 0); else if (event.key === "End") highlight(state, state.items.length - 1); return; }
      if (event.key === "Enter" || event.key === " ") choose(state, state.items[state.index]?.option);
      else highlight(state, event.key === "Home" ? 0 : event.key === "End" ? state.items.length - 1 : state.index + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); if (!isOpen) open(state);
      const now = Date.now(), character = event.key.toLocaleLowerCase();
      state.search = now - state.searchAt > 700 ? character : state.search + character; state.searchAt = now;
      if ([...state.search].every(letter => letter === character)) state.search = character;
      const start = state.search.length === 1 ? state.index + 1 : state.index;
      for (let step = 0; step < state.items.length; step++) {
        const index = (start + step) % state.items.length;
        if (state.items[index].option.label.toLocaleLowerCase().startsWith(state.search)) { highlight(state, index); break; }
      }
    }
  }
  function enhance(select) {
    if (controls.has(select) || !eligible(select)) return;
    const hadFocus = document.activeElement === select;
    const wrapper = document.createElement("span"); wrapper.className = "owner-select";
    const trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "owner-select-trigger";
    trigger.setAttribute("role", "combobox"); trigger.setAttribute("aria-haspopup", "listbox"); trigger.setAttribute("aria-expanded", "false");
    const value = document.createElement("span"); value.className = "owner-select-value"; trigger.append(value);
    const id = "owner-select-" + ++sequence;
    const name = select.getAttribute("aria-label"), labelledBy = select.getAttribute("aria-labelledby");
    if (labelledBy) trigger.setAttribute("aria-labelledby", labelledBy);
    else if (name) trigger.setAttribute("aria-label", name);
    else {
      const label = select.labels?.[0], caption = label?.querySelector(":scope > span");
      if (caption) { caption.id ||= id + "-label"; trigger.setAttribute("aria-labelledby", caption.id); }
      else trigger.setAttribute("aria-label", [...(label?.childNodes || [])].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(" ").trim() || "Choose an option");
    }
    if (select.hasAttribute("aria-describedby")) trigger.setAttribute("aria-describedby", select.getAttribute("aria-describedby"));
    trigger.setAttribute("aria-controls", id + "-menu");
    // The inbox retains the focused handling field during its periodic refresh.
    for (const key of ["letterId", "handlingField"]) if (select.dataset[key]) trigger.dataset[key] = select.dataset[key];
    const state = { select, wrapper, trigger, value, menuId: id + "-menu", popup: null, items: [], index: 0 };
    controls.set(select, state);
    select.before(wrapper); wrapper.append(select, trigger);
    select.classList.add("owner-select-native"); select.tabIndex = -1; select.setAttribute("aria-hidden", "true");
    trigger.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); if (active === state) close(); else open(state); });
    trigger.addEventListener("keydown", event => keydown(state, event));
    select.addEventListener("focus", () => trigger.focus());
    select.addEventListener("click", event => { event.preventDefault(); trigger.focus(); if (active === state) close(); else open(state); });
    select.addEventListener("input", () => sync(state));
    select.addEventListener("change", () => { if (active === state) close(); sync(state); });
    select.addEventListener("invalid", event => { event.preventDefault(); trigger.focus(); trigger.setAttribute("aria-invalid", "true"); });
    sync(state);
    if (hadFocus) trigger.focus({ preventScroll: true });
  }
  function scan(root) {
    if (root instanceof Element && root.matches("select")) enhance(root);
    root.querySelectorAll?.("select").forEach(enhance);
  }
  scan(document);
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      const select = record.target instanceof Element && record.target.closest("select");
      if (select && controls.has(select)) sync(controls.get(select));
      if (record.type === "attributes" && ["disabled", "inert"].includes(record.attributeName)) record.target.querySelectorAll?.("select").forEach(select => { const state = controls.get(select); if (state) sync(state); });
    }
    if (active && (!visible(active) || unavailable(active))) close();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "inert", "open", "selected", "label", "aria-invalid"] });
  document.addEventListener("pointerdown", event => { if (active && !active.wrapper.contains(event.target) && !active.popup.contains(event.target)) close(); }, true);
  document.addEventListener("focusin", event => { if (active && !active.wrapper.contains(event.target) && !active.popup.contains(event.target)) close(); });
  document.addEventListener("click", event => { if (event.target.closest("[data-owner-tab], #logoutButton")) close(); }, true);
  document.addEventListener("reset", event => requestAnimationFrame(() => event.target.querySelectorAll("select").forEach(select => { const state = controls.get(select); if (state) sync(state); })));
  document.addEventListener("scroll", event => {
    if (!active || event.target === active.popup) return;
    const bounds = active.trigger.getBoundingClientRect();
    if (!visible(active) || bounds.bottom < 0 || bounds.top > innerHeight) close();
    else position(active);
  }, true);
  window.addEventListener("host-session-change", () => {
    close(); document.querySelectorAll("select").forEach(select => { const state = controls.get(select); if (state) sync(state); });
  });
  window.addEventListener("resize", close);
  window.visualViewport?.addEventListener("resize", close);
})();
