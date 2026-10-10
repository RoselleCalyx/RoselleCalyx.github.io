const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/site-content.js'), 'utf8');
const defaults = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../data/site-defaults.json'), 'utf8'));
const newSpecies = ['redpanda', 'raccoon', 'wolf', 'crocodile', 'fennec'];
const plain = value => JSON.parse(JSON.stringify(value));

function page({ fetch, settings = {}, placeholders = [], timeout = false } = {}) {
  const order = [], timers = new Map(); let nextTimer = 0;
  const context = {
    window: { SITE: { name: 'Static host', links: { github: 'https://github.com/static' }, messageApi: 'https://content.example', ...settings },
      PAPERS: [{ title: 'Static paper' }], GALLERY: [{ id: 'static' }], BOTTLES: [{ text: 'Static note' }],
      FARM: { keeper: { species: 'snowcat', name: 'Matcha' }, residents: [{ species: 'rabbit', name: 'Mochi' }] },
      location: { href: 'https://public.example/index.html' } },
    fetch: fetch || (async () => { throw new Error('offline'); }), URL, TextEncoder, AbortController,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); if (timeout) queueMicrotask(() => timers.has(id) && callback()); return id; },
    clearTimeout(id) { timers.delete(id); },
    CustomEvent: function (type, options) { this.type = type; this.detail = options.detail; },
    document: { querySelectorAll: () => placeholders.map(src => ({ getAttribute: () => src, replaceWith(script) { order.push(script.src); queueMicrotask(script.onload); } })),
      createElement: () => ({}), dispatchEvent(event) { order.push(event.type); } }, console
  };
  vm.runInNewContext(source, context);
  return { context, api: context.window.SiteContent, order };
}
const response = content => ({ ok: true, text: async () => JSON.stringify({ ok: true, revision: 3, updatedAt: '2026-10-10T10:00:00Z', content }) });

test('cloud content replaces public arrays including deliberate empty collections, preserving infrastructure', async () => {
  const p = page({ settings: { formEndpoint: '/unchanged', turnstileSiteKey: 'static-key', supabase: { url: 'static-db' } },
    fetch: async () => response({ site: { name: 'New host', messageApi: 'https://evil.example', formEndpoint: 'https://evil.example', turnstileSiteKey: 'evil', supabase: {}, links: { github: '' } },
      papers: [], gallery: [], bottles: [], farm: { residents: [] }, home: { bio: [], interests: [] } }) });
  await p.api.started;
  const state = p.context.window;
  assert.equal(state.SITE.name, 'New host'); assert.equal(state.SITE.messageApi, 'https://content.example');
  assert.equal(state.SITE.formEndpoint, '/unchanged'); assert.equal(state.SITE.turnstileSiteKey, 'static-key'); assert.equal(state.SITE.supabase.url, 'static-db');
  assert.equal(state.SITE.links.github, '');
  assert.deepEqual(plain(state.PAPERS), []); assert.deepEqual(plain(state.GALLERY), []); assert.deepEqual(plain(state.BOTTLES), []);
  assert.deepEqual(plain(state.FARM.residents), []); assert.equal(state.FARM.keeper.name, 'Matcha');
  assert.deepEqual(plain(state.HOME_CONTENT.bio), []); assert.equal(p.api.source, 'cloud'); assert.equal(p.api.revision, 3);
});

test('the static baseline survives network errors, malformed JSON, failed HTTP responses and hung reads', async () => {
  for (const fetch of [async () => { throw new Error('offline'); }, async () => ({ ok: true, text: async () => '{' }), async () => ({ ok: false }), () => new Promise(() => {})]) {
    const p = page({ fetch, timeout: true }); await p.api.started;
    assert.equal(p.api.source, 'static'); assert.equal(p.context.window.PAPERS[0].title, 'Static paper');
  }
});

test('runtime modules start once and in dependency order after content is available', async () => {
  let resolve; const delayed = new Promise(done => { resolve = done; });
  const p = page({ placeholders: ['js/sky.js', 'js/common.js', 'js/papers.js'], fetch: async () => { await delayed; return response({ site: { name: 'Loaded before startup' } }); } });
  assert.deepEqual(p.order, []); resolve(); await p.api.started;
  assert.equal(p.context.window.SITE.name, 'Loaded before startup');
  assert.deepEqual(p.order, ['js/sky.js', 'js/common.js', 'js/papers.js', 'site-content-ready']);
});

test('URL normalization rejects active protocols, protocol-relative targets and control characters', async () => {
  const p = page(); await p.api.started;
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '//foreign.example/x', 'https://x.test/\nx', 'https://user:pass@x.test', 'https:\\evil.test']) assert.equal(p.api.url(value), '');
  for (const value of ['assets/figure.png', './papers.html', '#about', 'https://example.com/paper?q=1']) assert.equal(p.api.url(value), value);
  assert.equal(p.api.url('mailto:host@example.com'), ''); assert.equal(p.api.url('mailto:host@example.com', { email: true }), 'mailto:host@example.com');
  const clean = p.api.normalize({ papers: [{ title: 'Paper', authors: ['Host'], image: 'javascript:alert(1)', figures: [{ src: 'assets/diagram.png', caption: '<b>Figure</b>' }], links: { pdf: 'data:text/html,test', code: 'https://example.com' } }],
    home: { explore: [{ title: '<script>', href: 'javascript:alert(1)' }] } });
  assert.equal(clean.papers[0].image, ''); assert.equal(clean.papers[0].links.pdf, ''); assert.equal(clean.papers[0].figures[0].src, 'assets/diagram.png');
  assert.equal(clean.home.explore[0].href, '');
});

test('all checked-in public defaults round-trip through the cloud parser, including every Voyager stop', async () => {
  const p = page({ fetch: async () => response(defaults) }); await p.api.started;
  assert.equal(p.context.window.VOYAGER_STOPS.length, defaults.voyager.length);
  for (const value of defaults.voyager) for (const key of ['equinox', 'eclipse', 'plume', 'close', 'farewell']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) assert.equal(p.context.window.VOYAGER_STOPS.find(stop => stop.id === value.id)[key], value[key]);
  }
  assert.equal(p.context.window.PAPERS.length, defaults.papers.length);
  assert.equal(p.context.window.GALLERY.length, defaults.gallery.length);
  assert.equal(p.context.window.FARM.keeper.name, defaults.farm.keeper.name);
  assert.deepEqual(plain(p.context.window.FARM.residents), defaults.farm.residents);
  assert.deepEqual(plain(p.context.window.HOME_CONTENT), { ...defaults.home, news: defaults.home.news.map(item => ({ ...item, href: '' })) });
});

test('all ten farm defaults match the static roster and retain the five new species through CMS parsing', async () => {
  const staticContext = { window: {} };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../data/farm.js'), 'utf8'), staticContext);
  assert.deepEqual(plain(staticContext.window.FARM), defaults.farm);
  assert.equal(defaults.farm.residents.length, 10, 'shared capacity reserves ten baseline residents');
  const content = { farm: { ...defaults.farm, residents: [...defaults.farm.residents, { species: 'dragon', name: 'Unknown' }] } };
  const p = page({ fetch: async () => response(content) }); await p.api.started;
  assert.deepEqual(plain(p.context.window.FARM.residents), defaults.farm.residents, 'known residents survive and unknown species are filtered');
  for (const species of newSpecies) {
    const resident = p.context.window.FARM.residents.find(value => value.species === species);
    assert.deepEqual(plain(resident), defaults.farm.residents.find(value => value.species === species), species);
  }
});

test('published indoor/outdoor state survives public parsing without inventing a state on legacy records', async () => {
  const residents = defaults.farm.residents.slice(0, 3).map((resident, index) => ({ ...resident, ...(index === 0 ? {} : { active: index === 2 }) }));
  const p = page({ fetch: async () => response({ farm: { residents } }) }); await p.api.started;
  assert.deepEqual(plain(p.context.window.FARM.residents), residents);
  assert.equal(Object.hasOwn(p.context.window.FARM.residents[0], 'active'), false);
  assert.equal(p.context.window.FARM.residents[1].active, false);
  assert.equal(p.context.window.FARM.residents[2].active, true);
});

test('owner presentation fields survive public parsing and partial page overrides keep earlier copy', async () => {
  const content = {
    site: { pages: { home: { navLabel: 'Start', description: 'A research notebook.' }, papers: { navLabel: 'Research' } },
      extraLinks: [{ label: 'Research group', href: 'https://example.com/lab', icon: 'globe' }] },
    home: { avatarAlt: 'Portrait in a garden', labels: { about: 'Hello', news: 'Updates' }, visibility: { about: true, education: false }, finale: { date: 'Today', title: 'Keep looking.', text: 'A new horizon.' } },
    message: { introKicker: 'Say hello', placeholder: 'Your thought…', sharedIntro: 'From the shore', emptyText: 'No shared notes yet.' },
    papers: [{ title: 'Paper', authors: ['Host'], imageAlt: 'Architecture diagram', figures: [{ src: 'assets/figure.png', caption: 'A figure', alt: 'Three linked views' }] }],
    gallery: [{ id: 'garden', photos: [{ src: 'assets/garden.jpg', caption: 'Spring', text: 'A longer story.', alt: 'Cherry blossoms against a clear sky' }] }]
  };
  const p = page({ settings: { pages: { papers: { title: 'Existing title', subtitle: 'Existing introduction' } } }, fetch: async () => response(content) });
  await p.api.started;
  assert.deepEqual(plain(p.context.window.SITE.pages.papers), { title: 'Existing title', subtitle: 'Existing introduction', navLabel: 'Research' });
  assert.deepEqual(plain(p.context.window.SITE.pages.home), content.site.pages.home);
  assert.deepEqual(plain(p.context.window.SITE.extraLinks), content.site.extraLinks);
  assert.deepEqual(plain(p.context.window.HOME_CONTENT), content.home);
  assert.deepEqual(plain(p.context.window.MESSAGE_CONTENT), content.message);
  assert.equal(p.context.window.PAPERS[0].imageAlt, 'Architecture diagram');
  assert.equal(p.context.window.PAPERS[0].figures[0].alt, 'Three linked views');
  assert.equal(p.context.window.GALLERY[0].photos[0].text, 'A longer story.');
  assert.equal(p.context.window.GALLERY[0].photos[0].alt, 'Cherry blossoms against a clear sky');
});

test('public pages exclude unpublished records while legacy items remain visible', async () => {
  const p = page({ fetch: async () => response({
    papers: [{ title: 'Legacy paper' }, { title: 'Published paper', published: true }, { title: 'Draft paper', published: false }],
    gallery: [{ id: 'legacy' }, { id: 'draft', published: false }],
    bottles: [{ text: 'Legacy note' }, { text: 'Draft note', published: false }]
  }) });
  await p.api.started;
  assert.deepEqual(plain(p.context.window.PAPERS.map(item => item.title)), ['Legacy paper', 'Published paper']);
  assert.deepEqual(plain(p.context.window.GALLERY.map(item => item.id)), ['legacy']);
  assert.deepEqual(plain(p.context.window.BOTTLES.map(item => item.text)), ['Legacy note']);
});

test('new display fields keep plain text, reject unsafe links and ignore invalid visibility types', async () => {
  const p = page(); await p.api.started;
  const clean = p.api.normalize({ site: { extraLinks: [
    { label: '<script>text only</script>', href: 'https://example.com', icon: 'unknown' },
    { label: 'Unsafe', href: 'javascript:alert(1)', icon: 'globe' },
    { label: 'Temporarily hidden link', href: '', icon: 'book' },
    { label: ' ', href: 'https://example.com', icon: 'globe' }
  ], pages: { home: { title: '<b>text only</b>', description: 'Description', navLabel: 123 } } },
  home: { visibility: { about: 'false', education: false, news: 0 }, labels: { news: '<b>Updates</b>', unknown: 'Ignore' } } });
  assert.deepEqual(plain(clean.site.extraLinks), [{ label: '<script>text only</script>', href: 'https://example.com', icon: 'globe' }]);
  assert.deepEqual(plain(clean.site.pages.home), { title: '<b>text only</b>', description: 'Description' });
  assert.deepEqual(plain(clean.home.visibility), { education: false });
  assert.deepEqual(plain(clean.home.labels), { news: '<b>Updates</b>' });
});

test('each public HTML page uses data defaults before the cloud gate and retains runtime ordering', () => {
  for (const page of ['index', 'papers', 'gallery', 'message', 'starmap', 'voyager', 'farm', 'woods', 'pond']) {
    const html = fs.readFileSync(require('node:path').join(__dirname, '../' + page + '.html'), 'utf8');
    assert.ok(html.indexOf('js/config.js') < html.indexOf('js/site-content.js'), page);
    assert.equal((html.match(/<script src="js\/site-content\.js/g) || []).length, 1, page);
    assert.ok(html.includes('type="text/plain" data-site-src="js/common.js'), page);
    const directRuntime = [...html.matchAll(/<script src="(js\/[^\"]+)/g)].filter(match => !/^js\/(config|site-content)\.js/.test(match[1]));
    assert.deepEqual(directRuntime, [], page);
  }
});

test('the farm keeper card reflects published text and species with a fixed built-in image path', () => {
  const common = fs.readFileSync(require('node:path').join(__dirname, '../js/common.js'), 'utf8');
  const start = common.indexOf('/* ---------- farm keeper card ---------- */'), end = common.indexOf('/* ---------- shared chrome ---------- */', start);
  const image = {}, title = {}, heading = {}, note = {}, attrs = {};
  const card = { querySelector: key => ({ img: image, small: title, b: heading, 'span span': note })[key], setAttribute: (key, value) => { attrs[key] = value; } };
  const context = { window: { FARM: { keeper: { species: 'fox', name: '<Chai>', title: 'Keeper & explorer', note: '<script>just text</script>' } } }, document: { getElementById: () => card } };
  vm.runInNewContext(common.slice(start, end), context);
  assert.equal(card.hidden, false); assert.equal(image.src, 'assets/farm/fox.webp');
  assert.equal(title.textContent, 'Keeper & explorer'); assert.equal(heading.textContent, '<Chai> is keeping watch.'); assert.equal(note.textContent, '<script>just text</script>');
  assert.equal(attrs['aria-label'], 'Meet <Chai>, Keeper & explorer, Fox');
});

test('Voyager IDs accepted by the service survive public parsing; unsafe attribute characters do not', async () => {
  const p = page(); await p.api.started;
  const base = defaults.voyager[0];
  for (const id of ['Stop_A', 'New-Stop_2026', '1' + 'a'.repeat(63)]) {
    const content = p.api.normalize({ voyager: [{ ...base, id }] });
    assert.equal(content.voyager[0].id, id);
  }
  for (const id of ['_leading', '-leading', 'A'.repeat(65), 'stop"onclick="alert(1)', '<stop>']) {
    assert.equal(Object.hasOwn(p.api.normalize({ voyager: [{ ...base, id }] }), 'voyager'), false);
  }
});
