import { HTTPError } from "./errors.js";

const invalid = (path) => { throw new HTTPError(400, "validation", "Please check the public content field: " + path + "."); };
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const string = (max = 2000, required = false) => (value, path) => {
  if (typeof value !== "string" || Array.from(value).length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (required && !value.trim())) invalid(path);
};
const number = (min, max, integer = false) => (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(path);
};
const boolean = (value, path) => { if (typeof value !== "boolean") invalid(path); };
const oneOf = (...choices) => (value, path) => { if (!choices.includes(value)) invalid(path); };
const pattern = (regex, max = 200) => (value, path) => { string(max)(value, path); if (!regex.test(value)) invalid(path); };
const array = (validator, max, min = 0) => (value, path) => {
  if (!Array.isArray(value) || value.length > max || value.length < min) invalid(path);
  value.forEach((item, index) => validator(item, path + "[" + index + "]"));
};
const object = (fields, required = []) => (value, path) => {
  if (!record(value) || Object.keys(value).some((key) => !Object.hasOwn(fields, key)) || required.some((key) => !Object.hasOwn(value, key))) invalid(path);
  for (const [key, entry] of Object.entries(value)) fields[key](entry, path + "." + key);
};
const nullable = (validator) => (value, path) => { if (value !== null) validator(value, path); };
const link = (value, path) => {
  string(2048)(value, path);
  if (!value) return;
  if (/[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith("//")) invalid(path);
  try {
    const url = new URL(value, "https://site.example/");
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) invalid(path);
    // Relative references are paths, not alternative URL schemes.
    if (!/^https?:\/\//i.test(value) && /^[^/?#]*:/.test(value)) invalid(path);
  } catch (_) { invalid(path); }
};
const requiredLink = (value, path) => { string(2048, true)(value, path); link(value, path); };
const id = pattern(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, 64);
const month = pattern(/^\d{4}-(0[1-9]|1[0-2])$/, 7);
const day = (value, path) => {
  pattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 10)(value, path);
  if (!Number.isFinite(new Date(value).getTime()) || new Date(value).toISOString().slice(0, 10) !== value) invalid(path);
};
const species = oneOf("snowcat", "rabbit", "panda", "fox", "shiba", "hedgehog", "duckling", "penguin", "redpanda", "raccoon", "wolf", "crocodile", "fennec");
const resident = object({ id, species, name: string(24, true), adoptedBy: string(40), note: string(140), since: month, active: boolean }, ["species", "name"]);
const photo = object({ src: link, caption: string(2000), paint: object({ sky: oneOf("dusk", "aurora", "milkyway", "sunset", "night", "dawn"), land: oneOf("mountains", "sea", "city", "hills", "desert", "lake", "sakura", "fuji"), cabin: boolean }) }, ["src"]);
const pair = (min, max) => array(number(min, max), 2, 2);
const page = object({ title: string(300), subtitle: string(2000) });

const schema = object({
  site: object({
    name: string(200), brand: string(200), tagline: string(300), location: string(300), role: string(300), affiliation: string(500), footer: string(3000),
    email: (value, path) => { string(254)(value, path); if (value && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) invalid(path); },
    links: object({ scholar: link, linkedin: link, github: link, cv: link }),
    observer: object({ place: string(200), lat: number(-90, 90), lon: number(-180, 180) }),
    pages: object({ papers: page, gallery: page, message: page, starmap: page, farm: page, woods: page, pond: page, voyager: page })
  }),
  home: object({
    heroTitle: string(500), heroLede: string(2000), bio: array(string(10000), 30), interests: array(string(100), 50), beyond: string(10000), avatar: link,
    education: array(object({ date: string(100), title: string(300), detail: string(3000) }, ["date", "title", "detail"]), 50),
    news: array(object({ date: string(100), text: string(3000), href: link }, ["date", "text"]), 200),
    explore: array(object({ title: string(200), text: string(2000), href: link, icon: pattern(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/, 40) }, ["title", "text", "href", "icon"]), 32),
    coda: string(3000), heroFoot: string(1000)
  }),
  papers: array(object({
    id, title: string(500, true), authors: array(string(200, true), 100, 1), venue: string(500), year: number(1800, 2200, true),
    type: oneOf("publication", "preprint", "project"), topics: array(string(100), 50), image: link, selected: boolean, abstract: string(30000),
    links: object({ pdf: link, code: link, project: link, data: link }), bibtex: string(30000),
    figures: array(object({ src: link, caption: string(3000) }, ["src", "caption"]), 100)
  }, ["title", "authors", "venue", "year", "type", "topics", "image", "selected", "abstract", "links"]), 500),
  gallery: array(object({
    id, place: string(300), title: string(500), date: month,
    coords: (value, path) => { if (!Array.isArray(value) || value.length !== 2) invalid(path); number(-90, 90)(value[0], path + "[0]"); number(-180, 180)(value[1], path + "[1]"); },
    tags: array(string(100), 30), favorite: boolean, story: string(30000), photos: array(photo, 100)
  }, ["id", "place", "title", "date", "coords", "tags", "story", "photos"]), 100),
  bottles: array(object({ from: string(100), date: day, text: string(10000, true), reply: string(10000) }, ["from", "date", "text", "reply"]), 500),
  farm: object({ keeper: object({ species, name: string(24, true), title: string(200), note: string(2000) }, ["species", "name", "title", "note"]), residents: array(resident, 24) }),
  voyager: array(object({
    id, date: nullable(day), place: string(500), en: string(500), title: array(string(500, true), 2, 2), poem: string(10000), fact: string(10000), body: oneOf("earth", "venus", "jupiter", "saturn", "titan", "enceladus", "iapetus", "phoebe", "nebula"),
    chapter: number(0, 3, true), color: pattern(/^#[0-9a-fA-F]{6}$/, 7), map: pair(0, 100), source: link,
    equinox: boolean, eclipse: boolean, plume: boolean, close: boolean, farewell: boolean,
    scene: object({ art: requiredLink, target: string(500), label: string(300), vantage: string(2000), terrain: string(3000), pose: string(3000), haze: number(0, 1), particles: oneOf("", "ice"), description: string(10000) }, ["art", "target", "label", "vantage", "description"])
  }, ["id", "date", "place", "en", "title", "poem", "fact", "body", "chapter", "color", "map", "scene"]), 200, 1)
});

export function validateSiteContent(content) {
  // Bound traversal before checking individual shapes, including adversarial nesting.
  let count = 0;
  function bound(value, depth) {
    if (++count > 50000 || depth > 12) invalid("content");
    if (Array.isArray(value)) value.forEach((item) => bound(item, depth + 1));
    else if (record(value)) Object.values(value).forEach((item) => bound(item, depth + 1));
  }
  bound(content, 0);
  schema(content, "content");
  for (const section of ["papers", "gallery", "voyager"]) {
    const ids = (content[section] || []).filter((item) => item.id).map((item) => item.id);
    if (new Set(ids).size !== ids.length) invalid("content." + section + ".id");
  }
  return content;
}

export async function readSiteContent(env) {
  const row = await env.DB.prepare("SELECT revision, updated_at, content_json FROM site_content WHERE id = 1").first();
  if (!row) throw Error("content row missing");
  return { ok: true, revision: row.revision, updatedAt: row.updated_at, content: JSON.parse(row.content_json) };
}

export async function saveSiteContent(env, body) {
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) invalid("revision");
  const content = validateSiteContent(body.content);
  const baselineResidents = content.farm && content.farm.residents ? content.farm.residents.length : 10;
  const row = await env.DB.prepare("UPDATE site_content SET revision = revision + 1, updated_at = ?, content_json = ? WHERE id = 1 AND revision = ? AND (SELECT count(*) FROM farm_adoptions WHERE status = 'approved') + ? <= 24 RETURNING revision, updated_at, content_json")
    .bind(new Date().toISOString(), JSON.stringify(content), body.revision, baselineResidents).first();
  if (!row) {
    const current = await env.DB.prepare("SELECT revision FROM site_content WHERE id = 1").first();
    if (current && current.revision === body.revision) throw new HTTPError(409, "farm_capacity", "The farm cannot exceed 24 residents, including animals resting indoors. Cancel a new animal draft before saving.");
    throw new HTTPError(409, "content_conflict", "The site was changed in another session. Reload the latest content before saving again.");
  }
  return { ok: true, revision: row.revision, updatedAt: row.updated_at, content: JSON.parse(row.content_json) };
}
