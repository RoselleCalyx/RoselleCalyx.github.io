import { HTTPError } from "./errors.js";

export const MEDIA_MAX_BYTES = 1024 * 1024;
export const MEDIA_MAX_DIMENSION = 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PUBLIC_COLUMNS = "id, mime, width, height, bytes";
const invalid = () => new HTTPError(400, "media_invalid", "This image could not be read. Please crop and export a JPEG, PNG, or WebP image again.");
function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MEDIA_MAX_DIMENSION || height > MEDIA_MAX_DIMENSION) {
    throw new HTTPError(400, "media_dimensions", "The cropped image must be between 1 and 2048 pixels on each side.");
  }
  return { width, height };
}
function join(chunks) {
  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
const ascii = (bytes, start, size) => String.fromCharCode(...bytes.subarray(start, start + size));
const u16be = (bytes, at) => (bytes[at] << 8) | bytes[at + 1];
const u32be = (bytes, at) => ((bytes[at] * 0x1000000) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3]) >>> 0;
const u32le = (bytes, at) => (bytes[at] + (bytes[at + 1] << 8) + (bytes[at + 2] << 16) + bytes[at + 3] * 0x1000000) >>> 0;
const u24le = (bytes, at) => bytes[at] + (bytes[at + 1] << 8) + (bytes[at + 2] << 16);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit++) current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : current >>> 1;
  return current >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function png(bytes) {
  if (bytes.length < 57 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) throw invalid();
  const safe = [bytes.subarray(0, 8)];
  let offset = 8, frame = null, color = null, palette = false, transparency = false, dataSeen = false, dataEnded = false, dataBytes = 0, zlib = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw invalid();
    const size = u32be(bytes, offset), kind = ascii(bytes, offset + 4, 4), start = offset + 8, end = start + size;
    if (!/^[A-Za-z]{4}$/.test(kind) || end + 4 > bytes.length || crc32(bytes.subarray(offset + 4, end)) !== u32be(bytes, end)) throw invalid();
    if (!frame && kind !== "IHDR") throw invalid();
    if (["acTL", "fcTL", "fdAT"].includes(kind)) throw invalid(); // Only still crop exports are supported.
    let retain = false;
    if (kind === "IHDR") {
      if (frame || size !== 13) throw invalid();
      frame = dimensions(u32be(bytes, start), u32be(bytes, start + 4));
      const depth = bytes[start + 8]; color = bytes[start + 9];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!depths[color]?.includes(depth) || bytes[start + 10] !== 0 || bytes[start + 11] !== 0 || bytes[start + 12] > 1) throw invalid();
      retain = true;
    } else if (kind === "PLTE") {
      if (palette || dataSeen || [0, 4].includes(color) || size < 3 || size > 768 || size % 3) throw invalid();
      palette = true; retain = true;
    } else if (kind === "tRNS") {
      if (transparency || dataSeen || ![0, 2, 3].includes(color) || (color === 0 && size !== 2) || (color === 2 && size !== 6) || (color === 3 && (!palette || size < 1 || size > 256))) throw invalid();
      transparency = true; retain = true;
    } else if (kind === "IDAT") {
      if (dataEnded || (color === 3 && !palette)) throw invalid();
      dataSeen = true; dataBytes += size;
      for (let index = start; zlib.length < 2 && index < end; index++) zlib.push(bytes[index]);
      retain = true;
    } else if (kind === "IEND") {
      if (size !== 0 || !dataSeen || dataBytes < 6 || zlib.length !== 2 || (zlib[0] & 15) !== 8 || (zlib[0] >> 4) > 7 || (zlib[1] & 32) || ((zlib[0] << 8) + zlib[1]) % 31 || end + 4 !== bytes.length) throw invalid();
      safe.push(bytes.subarray(offset, end + 4));
      return { ...frame, data: join(safe) };
    } else {
      // Keep only color-rendering chunks. Discard EXIF/text/profile metadata.
      if (kind === "sRGB") { if (dataSeen || size !== 1 || bytes[start] > 3) throw invalid(); retain = true; }
      else if (kind === "gAMA") { if (dataSeen || size !== 4 || u32be(bytes, start) === 0) throw invalid(); retain = true; }
      else if (kind === "cHRM") { if (dataSeen || size !== 32) throw invalid(); retain = true; }
      else if (kind.charCodeAt(0) < 97) throw invalid(); // An unknown critical chunk is not a raster we can verify.
    }
    if (dataSeen && kind !== "IDAT") dataEnded = true;
    if (retain) safe.push(bytes.subarray(offset, end + 4));
    offset = end + 4;
  }
  throw invalid();
}
function jpeg(bytes) {
  if (bytes.length < 25 || bytes[0] !== 255 || bytes[1] !== 216) throw invalid();
  const safe = [bytes.subarray(0, 2)];
  let offset = 2, frame = null, components = null, quantization = false, huffman = false, scan = false;
  while (offset < bytes.length) {
    const markerStart = offset;
    if (bytes[offset++] !== 255) throw invalid();
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 217) {
      if (!frame || !quantization || !huffman || !scan || offset !== bytes.length) throw invalid();
      safe.push(new Uint8Array([255, 217]));
      return { ...frame, data: join(safe) };
    }
    if (marker === undefined || marker === 0 || marker === 216 || (marker >= 208 && marker <= 215) || offset + 2 > bytes.length) throw invalid();
    const size = u16be(bytes, offset), start = offset + 2, end = offset + size;
    if (size < 2 || end > bytes.length) throw invalid();
    if (marker >= 224 && marker <= 239 || marker === 254) { offset = end; continue; } // Strip APPn and comment metadata.
    if (marker === 192 || marker === 194) {
      if (frame || size < 11 || bytes[start] !== 8) throw invalid();
      const count = bytes[start + 5];
      if (![1, 3].includes(count) || size !== 8 + 3 * count) throw invalid();
      frame = dimensions(u16be(bytes, start + 3), u16be(bytes, start + 1));
      components = new Set(Array.from({ length: count }, (_, index) => bytes[start + 6 + index * 3]));
      if (components.size !== count) throw invalid();
      for (let index = 0; index < count; index++) {
        const sampling = bytes[start + 7 + index * 3];
        if ((sampling & 15) < 1 || (sampling & 15) > 4 || (sampling >> 4) < 1 || (sampling >> 4) > 4 || bytes[start + 8 + index * 3] > 3) throw invalid();
      }
    } else if (marker === 219) {
      let table = start;
      while (table < end) {
        const spec = bytes[table++];
        if ((spec >> 4) > 1 || (spec & 15) > 3) throw invalid();
        table += (spec >> 4) ? 128 : 64;
        if (table > end) throw invalid();
      }
      if (size < 67) throw invalid(); quantization = true;
    } else if (marker === 196) {
      let table = start;
      while (table < end) {
        if (table + 17 > end) throw invalid();
        const spec = bytes[table++];
        if ((spec >> 4) > 1 || (spec & 15) > 3) throw invalid();
        let values = 0;
        for (let bit = 0; bit < 16; bit++) values += bytes[table++];
        if (values < 1 || values > 256 || table + values > end) throw invalid();
        table += values;
      }
      if (size < 20) throw invalid(); huffman = true;
    } else if (marker === 221) { if (size !== 4) throw invalid(); }
    else if (marker === 218) {
      if (!frame || !quantization || !huffman || size < 8) throw invalid();
      const count = bytes[start];
      if (count < 1 || count > components.size || size !== 6 + 2 * count) throw invalid();
      const selected = new Set();
      for (let index = 0; index < count; index++) {
        const component = bytes[start + 1 + index * 2], table = bytes[start + 2 + index * 2];
        if (!components.has(component) || selected.has(component) || (table >> 4) > 3 || (table & 15) > 3) throw invalid();
        selected.add(component);
      }
      const spectral = start + 1 + count * 2;
      if (bytes[spectral] > 63 || bytes[spectral + 1] > 63 || bytes[spectral] > bytes[spectral + 1] || (bytes[spectral + 2] >> 4) > 13 || (bytes[spectral + 2] & 15) > 13) throw invalid();
      safe.push(bytes.subarray(markerStart, end));
      let cursor = end, entropy = false;
      while (cursor < bytes.length) {
        if (bytes[cursor] !== 255) { cursor++; entropy = true; continue; }
        const next = bytes[cursor + 1];
        if (next === 0 || (next >= 208 && next <= 215)) { cursor += 2; entropy = true; continue; }
        if (next === 255) { cursor++; continue; }
        break;
      }
      if (!entropy || cursor === bytes.length) throw invalid();
      safe.push(bytes.subarray(end, cursor)); scan = true; offset = cursor; continue;
    } else throw invalid();
    safe.push(bytes.subarray(markerStart, end)); offset = end;
  }
  throw invalid();
}
function webp(bytes) {
  if (bytes.length < 26 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP" || u32le(bytes, 4) !== bytes.length - 8) throw invalid();
  let offset = 12, frame = null, extended = null, alpha = false, image = false;
  const safe = [];
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw invalid();
    const kind = ascii(bytes, offset, 4), size = u32le(bytes, offset + 4), start = offset + 8, end = start + size, paddedEnd = end + (size % 2);
    if (paddedEnd > bytes.length || (size % 2 && bytes[end] !== 0)) throw invalid();
    if (kind === "VP8X") {
      if (extended || offset !== 12 || size !== 10 || bytes[start] & 0xc3 || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) throw invalid();
      extended = dimensions(u24le(bytes, start + 4) + 1, u24le(bytes, start + 7) + 1);
      const chunk = bytes.slice(offset, paddedEnd);
      chunk[8] &= 0x10; // The cropped file keeps alpha; strips ICC, EXIF, and XMP flags.
      safe.push(chunk);
    } else if (kind === "ALPH") {
      if (!extended || alpha || image || size < 2 || bytes[start] & 0xc0 || (bytes[start] & 3) > 1 || ((bytes[start] >> 4) & 3) > 1) throw invalid();
      alpha = true; safe.push(bytes.subarray(offset, paddedEnd));
    } else if (kind === "VP8 ") {
      if (image || size < 11 || bytes[start] & 1 || ((bytes[start] >> 1) & 7) > 3 || bytes[start + 3] !== 157 || bytes[start + 4] !== 1 || bytes[start + 5] !== 42) throw invalid();
      const partition = (u24le(bytes, start) >> 5);
      if (!(bytes[start] & 16) || partition < 1 || partition + 3 > size) throw invalid();
      frame = dimensions((bytes[start + 6] | bytes[start + 7] << 8) & 0x3fff, (bytes[start + 8] | bytes[start + 9] << 8) & 0x3fff);
      image = true; safe.push(bytes.subarray(offset, paddedEnd));
    } else if (kind === "VP8L") {
      if (image || alpha || size < 6 || bytes[start] !== 47 || (bytes[start + 4] & 0xe0)) throw invalid();
      const bits = u32le(bytes, start + 1);
      frame = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      image = true; safe.push(bytes.subarray(offset, paddedEnd));
    } else if (["ICCP", "EXIF", "XMP "].includes(kind)) { if (!extended) throw invalid(); }
    else throw invalid();
    offset = paddedEnd;
  }
  if (!image || (extended && (frame.width !== extended.width || frame.height !== extended.height))) throw invalid();
  const body = join(safe), header = bytes.slice(0, 12);
  const size = body.length + 4;
  for (let index = 0; index < 4; index++) header[4 + index] = (size >>> (index * 8)) & 255;
  return { ...frame, data: join([header, body]) };
}

// This validates raster headers/segment boundaries and removes metadata. Browser
// canvas decoding is the first validation step; the Worker does not re-encode or
// claim to perform a complete entropy-stream decode.
export function validateMedia(bytes, mime) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MEDIA_MAX_BYTES) throw invalid();
  if (!MIME_TYPES.has(mime)) throw new HTTPError(415, "media_type", "Please upload a cropped JPEG, PNG, or WebP image.");
  return mime === "image/png" ? png(bytes) : mime === "image/jpeg" ? jpeg(bytes) : webp(bytes);
}
async function readUpload(request) {
  const mime = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!MIME_TYPES.has(mime)) throw new HTTPError(415, "media_type", "Please upload a cropped JPEG, PNG, or WebP image.");
  if (request.headers.get("Content-Encoding") && request.headers.get("Content-Encoding").toLowerCase() !== "identity") throw new HTTPError(415, "media_type", "Please upload the image without content encoding.");
  if (Number(request.headers.get("Content-Length") || 0) > MEDIA_MAX_BYTES) throw new HTTPError(413, "too_large", "The cropped image must be at most 1 MB. Please reduce its output size.");
  if (!request.body) throw invalid();
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MEDIA_MAX_BYTES) { await reader.cancel(); throw new HTTPError(413, "too_large", "The cropped image must be at most 1 MB. Please reduce its output size."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return { mime, ...validateMedia(join(chunks), mime) };
}
function uploaded(request, row, deduplicated) {
  return { ok: true, ...row, url: new URL("/api/media/" + row.id, request.url).href, deduplicated };
}

// Call only after the main Worker's origin and current owner-session checks.
export async function uploadMedia(request, env) {
  const { mime, width, height, data } = await readUpload(request);
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), (value) => value.toString(16).padStart(2, "0")).join("");
  const previous = await env.DB.prepare("SELECT " + PUBLIC_COLUMNS + " FROM owner_media WHERE sha256 = ?").bind(sha256).first();
  if (previous) return uploaded(request, previous, true);
  const id = crypto.randomUUID(), time = Math.floor(Date.now() / 1000);
  let result;
  try {
    result = await env.DB.prepare("INSERT INTO owner_media (id, sha256, mime, width, height, bytes, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sha256) DO NOTHING RETURNING " + PUBLIC_COLUMNS)
      .bind(id, sha256, mime, width, height, data.byteLength, data.buffer, time).first();
  } catch (error) {
    if (String(error.message).includes("media_capacity")) throw new HTTPError(409, "media_capacity", "Image storage is full (100 MB or 1000 images). Use an existing image URL or contact the site administrator.");
    if (String(error.message).includes("media_rate_limit")) throw new HTTPError(429, "media_rate_limit", "The daily limit of 100 new images has been reached. Please try again tomorrow.", { "Retry-After": String(86400 - time % 86400) });
    throw error;
  }
  if (result) return uploaded(request, result, false);
  const stored = await env.DB.prepare("SELECT " + PUBLIC_COLUMNS + " FROM owner_media WHERE sha256 = ?").bind(sha256).first();
  if (!stored) throw Error("image was not stored");
  return uploaded(request, stored, true);
}
export async function readMedia(request, env, id) {
  if (!UUID.test(id)) throw new HTTPError(404, "not_found", "This image was not found.");
  const row = await env.DB.prepare("SELECT mime, bytes, data, sha256 FROM owner_media WHERE id = ?").bind(id.toLowerCase()).first();
  if (!row) throw new HTTPError(404, "not_found", "This image was not found.");
  const headers = { "Content-Type": row.mime, "Content-Length": String(row.bytes), "Cache-Control": "public, max-age=31536000, immutable", "ETag": '"' + row.sha256 + '"', "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "cross-origin" };
  if (request.headers.get("Origin") === env.ALLOWED_ORIGIN) { headers["Access-Control-Allow-Origin"] = env.ALLOWED_ORIGIN; headers.Vary = "Origin"; }
  const validators = (request.headers.get("If-None-Match") || "").split(",").map((value) => value.trim());
  if (validators.some((value) => value === "*" || value.replace(/^W\//, "") === headers.ETag)) return new Response(null, { status: 304, headers });
  return new Response(request.method === "HEAD" ? null : new Uint8Array(row.data), { headers });
}
