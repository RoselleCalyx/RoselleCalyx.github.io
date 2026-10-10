/* Local image preparation for the owner workspace. Uploading changes only the draft. */
(function (root) {
  "use strict";
  const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
  const MAX_SOURCE_PIXELS = 32000000;
  const MAX_UPLOAD_BYTES = 1024 * 1024;
  const MAX_OUTPUT_SIDE = 2048;
  const MIN_RATIO = 0.1, MAX_RATIO = 10;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // Both the canvas preview and the exported file use this exact source rectangle.
  function cropGeometry(width, height, ratio, zoom = 1, x = 0.5, y = 0.5, maxSide = MAX_OUTPUT_SIDE) {
    if (![width, height, ratio, zoom, x, y, maxSide].every(Number.isFinite) || width <= 0 || height <= 0 || ratio <= 0 || maxSide < 1) throw new Error("Invalid crop dimensions.");
    zoom = clamp(zoom, 1, 4); x = clamp(x, 0, 1); y = clamp(y, 0, 1);
    const cropWidth = Math.min(width, height * ratio) / zoom;
    const cropHeight = cropWidth / ratio;
    const scale = Math.min(1, maxSide / cropWidth, maxSide / cropHeight);
    return {
      sx: (width - cropWidth) * x, sy: (height - cropHeight) * y,
      sw: cropWidth, sh: cropHeight,
      width: Math.max(1, Math.round(cropWidth * scale)), height: Math.max(1, Math.round(cropHeight * scale))
    };
  }
  function dragPosition(geometry, sourceWidth, sourceHeight, previewWidth, previewHeight, x, y, dx, dy) {
    return {
      x: sourceWidth > geometry.sw ? clamp(x - dx * geometry.sw / previewWidth / (sourceWidth - geometry.sw), 0, 1) : x,
      y: sourceHeight > geometry.sh ? clamp(y - dy * geometry.sh / previewHeight / (sourceHeight - geometry.sh), 0, 1) : y
    };
  }
  // Read common raster headers before decoding so a highly compressed oversized image
  // cannot allocate a huge bitmap just to be rejected. Unknown formats are checked after decoding.
  function headerDimensions(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = (offset, size) => String.fromCharCode(...bytes.subarray(offset, offset + size));
    const size = (width, height) => width > 0 && height > 0 ? { width, height } : null;
    if (bytes.length >= 24 && bytes[0] === 137 && text(1, 7) === "PNG\r\n\x1a\n" && text(12, 4) === "IHDR") return size(view.getUint32(16), view.getUint32(20));
    if (bytes.length >= 10 && /^GIF8[79]a$/.test(text(0, 6))) return size(view.getUint16(6, true), view.getUint16(8, true));
    if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
      let offset = 2;
      while (offset + 3 < bytes.length) {
        if (bytes[offset++] !== 255) return null;
        while (bytes[offset] === 255) offset += 1;
        const marker = bytes[offset++];
        if (marker === 217 || marker === 218) return null;
        if (marker === 1 || marker >= 208 && marker <= 216) continue;
        if (offset + 2 > bytes.length) return null;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) return null;
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) return size(view.getUint16(offset + 5), view.getUint16(offset + 3));
        offset += length;
      }
    }
    if (bytes.length >= 20 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
      let offset = 12;
      while (offset + 8 <= bytes.length) {
        const kind = text(offset, 4), length = view.getUint32(offset + 4, true), data = offset + 8;
        if (kind === "VP8X" && length >= 10 && data + 10 <= bytes.length) {
          const int24 = at => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
          return size(int24(data + 4) + 1, int24(data + 7) + 1);
        }
        if (kind === "VP8 " && length >= 10 && data + 10 <= bytes.length && bytes[data + 3] === 157 && bytes[data + 4] === 1 && bytes[data + 5] === 42) return size(view.getUint16(data + 6, true) & 16383, view.getUint16(data + 8, true) & 16383);
        if (kind === "VP8L" && length >= 5 && data + 5 <= bytes.length && bytes[data] === 47) {
          const bits = view.getUint32(data + 1, true);
          return size((bits & 16383) + 1, (bits >>> 14 & 16383) + 1);
        }
        if (data + length > bytes.length) return null;
        offset = data + length + (length & 1);
      }
    }
    return null;
  }
  function validateSourceSize(width, height) {
    if (width * height > MAX_SOURCE_PIXELS || width > 16384 || height > 16384) throw new Error("This image is too large to process. Use an image up to 32 megapixels and 16,384 pixels per side.");
  }
  // Exporting these helpers allows tests to check the actual crop, rather than DOM implementation details.
  if (typeof module !== "undefined" && module.exports) module.exports = { cropGeometry, dragPosition, headerDimensions, validateSourceSize, MAX_OUTPUT_SIDE, MAX_UPLOAD_BYTES };
  if (!root || !root.document) return;
  const document = root.document;
  const attachments = new Set();
  let active = null, generation = 0, nextId = 0;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const button = (text, id) => { const el = node("button", text); el.type = "button"; if (id) el.id = id; return el; };
  function errorText(error) {
    if (error && error.name === "AbortError") return "Upload canceled. Your current image has not changed.";
    return error && error.message || "The image could not be uploaded. Please try again.";
  }
  function safePreviewUrl(value) {
    const text = String(value || "").trim();
    if (!text || /[\u0000-\u001f\u007f]/.test(text) || text.startsWith("//")) return "";
    try { const url = new URL(text, root.location.href); return /^(https?:)$/.test(url.protocol) && !url.username && !url.password ? url.href : ""; }
    catch (_) { return ""; }
  }
  function isCurrent(state) {
    return active === state && state.version === generation && !state.attachment.destroyed && state.attachment.input.isConnected && state.attachment.getSignedIn();
  }
  function disposeSource(state) {
    if (state.image && typeof state.image.close === "function") state.image.close();
    state.image = null;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  function closeCrop({ returnFocus = true } = {}) {
    const state = active;
    generation += 1; active = null;
    if (!state) return;
    state.controller.abort();
    state.resizeObserver && state.resizeObserver.disconnect();
    if (state.resizeFallback) root.removeEventListener("resize", state.resizeFallback);
    disposeSource(state);
    if (state.dialog.open) state.dialog.close();
    state.dialog.remove();
    if (returnFocus && state.attachment.trigger.isConnected && state.attachment.getSignedIn()) state.attachment.trigger.focus({ preventScroll: true });
  }
  async function decodeFile(file, state) {
    if (typeof root.createImageBitmap === "function") {
      try { return await root.createImageBitmap(file, { imageOrientation: "from-image" }); }
      catch (_) { /* Some browsers do not support every format through ImageBitmap. */ }
    }
    if (!isCurrent(state)) throw new DOMException("Canceled", "AbortError");
    state.objectUrl = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const finish = (error) => {
        image.onload = null; image.onerror = null;
        state.controller.signal.removeEventListener("abort", abort);
        if (error) reject(error); else resolve(image);
      };
      const abort = () => { image.src = ""; finish(new DOMException("Canceled", "AbortError")); };
      image.onload = () => finish();
      image.onerror = () => finish(new Error("This file could not be decoded as an image. Try a JPEG, PNG, WebP, AVIF, or GIF file."));
      state.controller.signal.addEventListener("abort", abort, { once: true });
      image.src = state.objectUrl;
    });
  }
  function sourceSize(image) { return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }; }
  function chooseRatio(state) {
    if (state.ratio.value === "original") return state.width / state.height;
    if (state.ratio.value === "custom") {
      const width = Number(state.ratioWidth.value), height = Number(state.ratioHeight.value);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Enter a positive width and height for the crop ratio.");
      const ratio = width / height;
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) throw new Error("Use a crop ratio between 1:10 and 10:1.");
      return ratio;
    }
    return Number(state.ratio.value);
  }
  function setStatus(state, text, isError = false) {
    state.status.textContent = text;
    state.status.classList.toggle("is-error", isError);
  }
  function renderCrop(state) {
    if (!isCurrent(state) || !state.image) return;
    try {
      state.geometry = cropGeometry(state.width, state.height, chooseRatio(state), Number(state.zoom.value), Number(state.x.value) / 100, Number(state.y.value) / 100);
      const { geometry: crop, canvas } = state;
      const availableWidth = Math.max(1, state.stage.clientWidth || 640);
      const availableHeight = Math.max(180, Math.min(380, (root.innerHeight || 800) * 0.43));
      const previewScale = Math.min(1, availableWidth / crop.width, availableHeight / crop.height);
      const width = Math.max(1, Math.round(crop.width * previewScale)), height = Math.max(1, Math.round(crop.height * previewScale));
      const density = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(width * density)); canvas.height = Math.max(1, Math.round(height * density));
      canvas.style.width = width + "px"; canvas.style.height = height + "px";
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(state.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
      state.zoomOutput.textContent = Math.round(Number(state.zoom.value) * 100) + "%";
      state.dimensions.textContent = crop.width + " × " + crop.height + " px · proportions preserved";
      state.upload.disabled = state.busy;
      state.x.disabled = state.busy || Math.abs(state.width - crop.sw) < 0.01;
      state.y.disabled = state.busy || Math.abs(state.height - crop.sh) < 0.01;
      if (!state.busy) setStatus(state, "Drag the picture or use the position sliders. Uploading adds it to your draft; Save & publish shows it on the website.");
    } catch (error) { state.upload.disabled = true; setStatus(state, errorText(error), true); }
  }
  function setBusy(state, value) {
    state.busy = value;
    state.dialog.setAttribute("aria-busy", String(value));
    state.upload.textContent = value ? "Uploading…" : "Upload cropped image";
    state.upload.disabled = value;
    [state.ratio, state.ratioWidth, state.ratioHeight, state.zoom, state.x, state.y].forEach(input => { input.disabled = value; });
    if (!value) renderCrop(state);
  }
  function canvasBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The browser could not prepare this image. Try another image file.")), mimeType, quality);
    });
  }
  async function prepareUpload(state) {
    let crop = state.geometry;
    if (!crop) throw new Error("Choose a valid crop ratio before uploading.");
    const canvas = document.createElement("canvas");
    // Keep transparency, including PNG artwork, when WebP is supported.
    for (let resize = 0; resize < 5; resize += 1) {
      canvas.width = crop.width; canvas.height = crop.height;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, crop.width, crop.height);
      context.drawImage(state.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.width, crop.height);
      let blob;
      for (const quality of [0.9, 0.82, 0.72, 0.6]) {
        if (!isCurrent(state)) throw new DOMException("Canceled", "AbortError");
        blob = await canvasBlob(canvas, "image/webp", quality);
        // toBlob may fall back to PNG. It remains lossless and keeps transparency.
        if (blob.size <= MAX_UPLOAD_BYTES) return { blob, width: crop.width, height: crop.height, mimeType: blob.type };
      }
      crop = { ...crop, width: Math.max(1, Math.round(crop.width * 0.75)), height: Math.max(1, Math.round(crop.height * 0.75)) };
    }
    throw new Error("This image is still too large to upload. Try a tighter crop or a smaller source image.");
  }
  async function submitCrop(state) {
    if (!isCurrent(state) || state.busy || state.upload.disabled) return;
    setBusy(state, true); setStatus(state, "Preparing and uploading the cropped image…");
    try {
      const image = await prepareUpload(state);
      if (!isCurrent(state)) return;
      const extension = image.mimeType === "image/webp" ? "webp" : image.mimeType === "image/png" ? "png" : "jpg";
      const stem = state.file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "image";
      const result = await state.attachment.upload(image.blob, { filename: stem + "." + extension, width: image.width, height: image.height, mimeType: image.mimeType, signal: state.controller.signal });
      if (!isCurrent(state)) return;
      const url = typeof result === "string" ? result : result && result.url;
      if (!safePreviewUrl(url)) throw new Error("The upload service returned an invalid image URL. Please try again.");
      state.attachment.input.value = url;
      state.attachment.input.dispatchEvent(new Event("input", { bubbles: true }));
      state.attachment.refresh();
      state.attachment.message.textContent = "Image uploaded to your draft. Save & publish to update the website.";
      if (state.attachment.onCommit) state.attachment.onCommit(url, image);
      closeCrop();
    } catch (error) {
      if (!isCurrent(state)) return;
      setBusy(state, false); setStatus(state, errorText(error), true);
    }
  }
  function slider(state, labelText, id, min, max, step, value) {
    const label = node("label", undefined, "owner-crop-control"), name = node("span", labelText);
    const input = node("input"); input.type = "range"; input.id = id; input.min = min; input.max = max; input.step = step; input.value = value;
    input.addEventListener("input", () => renderCrop(state));
    label.append(name, input); return { label, input, name };
  }
  async function openCrop(attachment, file) {
    if (attachment.destroyed || !attachment.getSignedIn()) { attachment.message.textContent = "Sign in to upload an image."; return; }
    if (!file || !ALLOWED_TYPES.has(file.type)) { attachment.message.textContent = "Choose a JPEG, PNG, WebP, AVIF, or GIF image. Animated files use their first frame."; return; }
    if (file.size > MAX_SOURCE_BYTES) { attachment.message.textContent = "Choose an image smaller than 20 MB."; return; }
    closeCrop({ returnFocus: false });
    const dialog = node("dialog", undefined, "owner-image-dialog"); dialog.id = "ownerImageCropDialog"; dialog.setAttribute("aria-labelledby", "ownerCropTitle");
    const header = node("div", undefined, "owner-crop-heading");
    const heading = node("h2", "Crop & upload image"); heading.id = "ownerCropTitle";
    const close = button("×", "ownerCropClose"); close.setAttribute("aria-label", "Cancel image upload"); close.addEventListener("click", () => closeCrop());
    header.append(heading, close);
    const intro = node("p", attachment.targetLabel ? "Choose the crop for " + attachment.targetLabel + "." : "Choose the proportions and framing for this image.", "owner-crop-intro");
    const state = { attachment, file, dialog, version: generation, controller: new AbortController(), image: null, objectUrl: null, busy: false, width: 1, height: 1 };
    active = state;
    const ratioLabel = node("label", undefined, "owner-crop-control"); ratioLabel.append(node("span", "Crop ratio"));
    state.ratio = node("select"); state.ratio.id = "ownerCropRatio";
    for (const [value, text] of [["original", "Original"], ["1", "1:1 · square"], ["0.75", "3:4 · portrait"], [String(4 / 3), "4:3 · landscape"], [String(16 / 9), "16:9 · wide"], ["custom", "Custom"]]) {
      const option = node("option", text); option.value = value; state.ratio.append(option);
    }
    const targetRatio = Number(attachment.targetRatio);
    if (Number.isFinite(targetRatio) && targetRatio >= MIN_RATIO && targetRatio <= MAX_RATIO) {
      const matching = [...state.ratio.options].find(option => Math.abs(Number(option.value) - targetRatio) < 0.00001);
      if (matching) state.ratio.value = matching.value;
      else { const option = node("option", "Target · " + (attachment.targetLabel || targetRatio.toFixed(2))); option.value = String(targetRatio); state.ratio.append(option); state.ratio.value = option.value; }
    } else state.ratio.value = "original";
    ratioLabel.append(state.ratio);
    const custom = node("div", undefined, "owner-crop-custom"); custom.hidden = true;
    for (const [key, labelText, id] of [["ratioWidth", "Ratio width", "ownerCropRatioWidth"], ["ratioHeight", "Ratio height", "ownerCropRatioHeight"]]) {
      const label = node("label", undefined, "owner-crop-control"); label.append(node("span", labelText));
      const input = node("input"); input.type = "number"; input.min = "0.01"; input.step = "any"; input.value = key === "ratioWidth" ? "3" : "4"; input.id = id; input.addEventListener("input", () => renderCrop(state));
      state[key] = input; label.append(input); custom.append(label);
    }
    state.ratio.addEventListener("change", () => { custom.hidden = state.ratio.value !== "custom"; renderCrop(state); });
    const options = node("div", undefined, "owner-crop-options"); options.append(ratioLabel, custom);
    state.stage = node("div", undefined, "owner-crop-stage"); state.canvas = node("canvas"); state.canvas.id = "ownerCropCanvas"; state.canvas.setAttribute("aria-label", "Preview of the cropped image. Drag to change its position, or use the position sliders below.");
    state.stage.append(state.canvas);
    const controls = node("div", undefined, "owner-crop-sliders");
    const zoom = slider(state, "Zoom", "ownerCropZoom", 1, 4, 0.01, 1); state.zoom = zoom.input; state.zoomOutput = node("output", "100%"); state.zoomOutput.htmlFor = state.zoom.id; zoom.name.append(" ", state.zoomOutput);
    const x = slider(state, "Horizontal position", "ownerCropX", 0, 100, 0.1, 50); state.x = x.input;
    const y = slider(state, "Vertical position", "ownerCropY", 0, 100, 0.1, 50); state.y = y.input;
    controls.append(zoom.label, x.label, y.label);
    state.dimensions = node("p", "", "owner-crop-dimensions"); state.dimensions.id = "ownerCropDimensions";
    state.status = node("p", "Opening image…", "owner-crop-status"); state.status.id = "ownerCropStatus"; state.status.setAttribute("role", "status"); state.status.setAttribute("aria-live", "polite");
    const footer = node("div", undefined, "owner-crop-actions");
    const cancel = button("Cancel", "ownerCropCancel"); cancel.addEventListener("click", () => closeCrop());
    state.upload = button("Upload cropped image", "ownerCropUpload"); state.upload.disabled = true; state.upload.addEventListener("click", () => submitCrop(state)); footer.append(cancel, state.upload);
    dialog.append(header, intro, options, state.stage, controls, state.dimensions, state.status, footer);
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeCrop(); });
    dialog.addEventListener("close", () => { if (active === state) closeCrop(); });
    dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("button, input, select, [tabindex]")].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    let drag = null;
    state.canvas.addEventListener("pointerdown", event => {
      if (!isCurrent(state) || state.busy || !state.geometry || !event.isPrimary || event.button !== 0) return;
      const rect = state.canvas.getBoundingClientRect(); drag = { id: event.pointerId, px: event.clientX, py: event.clientY, x: Number(state.x.value) / 100, y: Number(state.y.value) / 100, rect, geometry: state.geometry };
      state.canvas.setPointerCapture(event.pointerId); event.preventDefault();
    });
    state.canvas.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId || state.busy) return;
      const position = dragPosition(drag.geometry, state.width, state.height, drag.rect.width, drag.rect.height, drag.x, drag.y, event.clientX - drag.px, event.clientY - drag.py);
      state.x.value = String(position.x * 100); state.y.value = String(position.y * 100); renderCrop(state); event.preventDefault();
    });
    const finishDrag = () => { drag = null; };
    state.canvas.addEventListener("pointerup", finishDrag); state.canvas.addEventListener("pointercancel", finishDrag); state.canvas.addEventListener("lostpointercapture", finishDrag);
    document.body.append(dialog); dialog.showModal(); close.focus();
    if (root.ResizeObserver) { state.resizeObserver = new ResizeObserver(() => renderCrop(state)); state.resizeObserver.observe(state.stage); }
    else { state.resizeFallback = () => renderCrop(state); root.addEventListener("resize", state.resizeFallback); }
    try {
      const dimensions = headerDimensions(new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()));
      if (!isCurrent(state)) return;
      if (dimensions) validateSourceSize(dimensions.width, dimensions.height);
      const image = await decodeFile(file, state);
      if (!isCurrent(state)) { if (typeof image.close === "function") image.close(); return; }
      state.image = image;
      Object.assign(state, sourceSize(image));
      validateSourceSize(state.width, state.height);
      renderCrop(state);
    } catch (error) {
      if (!isCurrent(state)) return;
      disposeSource(state); state.upload.disabled = true; setStatus(state, errorText(error), true);
    }
  }
  function attach(wrapper, { input, getSignedIn, canUse, upload, onCommit, targetRatio, targetLabel, ratio, label } = {}) {
    if (targetRatio === undefined && ratio !== undefined && ratio !== "original") {
      const parts = String(ratio).split(":").map(Number);
      targetRatio = parts.length === 2 ? parts[0] / parts[1] : Number(ratio);
    }
    if (targetLabel === undefined) targetLabel = label;
    if (getSignedIn === undefined) getSignedIn = canUse;
    if (!wrapper || !input || typeof upload !== "function") throw new Error("Image uploads require a field, input and upload callback.");
    const attachment = { wrapper, input, getSignedIn: typeof getSignedIn === "function" ? getSignedIn : () => true, upload, onCommit, targetRatio, targetLabel, destroyed: false };
    const tools = node("div", undefined, "owner-image-tools");
    attachment.trigger = button("Upload & crop"); attachment.trigger.className = "owner-image-upload";
    const file = node("input"); file.type = "file"; file.className = "owner-image-file"; file.id = "ownerImageFile" + (++nextId); file.accept = "image/jpeg,image/png,image/webp,image/avif,image/gif"; file.hidden = true; file.tabIndex = -1;
    attachment.message = node("small", "Choose an image from your device, or keep using an image URL.", "owner-image-message"); attachment.message.setAttribute("role", "status");
    const preview = node("img", undefined, "owner-image-current"); preview.alt = targetLabel ? "Current " + targetLabel : "Current image"; preview.loading = "lazy"; preview.hidden = true;
    attachment.refresh = () => {
      const src = safePreviewUrl(input.value);
      if (!src) { preview.hidden = true; preview.removeAttribute("src"); return; }
      if (preview.getAttribute("src") !== src) { preview.hidden = true; preview.src = src; }
    };
    preview.addEventListener("load", () => { preview.hidden = false; }); preview.addEventListener("error", () => { preview.hidden = true; });
    attachment.trigger.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      if (!attachment.getSignedIn()) { attachment.message.textContent = "Sign in to upload an image."; return; }
      file.value = ""; file.click();
    });
    file.addEventListener("change", () => { const selected = file.files && file.files[0]; if (selected) openCrop(attachment, selected); });
    input.addEventListener("input", attachment.refresh);
    tools.append(attachment.trigger, file, attachment.message, preview); wrapper.append(tools); attachments.add(attachment); attachment.refresh();
    attachment.destroy = () => {
      if (attachment.destroyed) return;
      if (active && active.attachment === attachment) closeCrop({ returnFocus: false });
      attachment.destroyed = true; input.removeEventListener("input", attachment.refresh); preview.removeAttribute("src"); tools.remove(); attachments.delete(attachment);
    };
    return { destroy: attachment.destroy, refresh: attachment.refresh };
  }
  root.OwnerImages = {
    attach,
    cancelAll: () => closeCrop({ returnFocus: false }),
    cleanup: () => { closeCrop({ returnFocus: false }); for (const attachment of [...attachments]) attachment.destroy(); },
    cropGeometry, dragPosition
  };
})(typeof window !== "undefined" ? window : null);
