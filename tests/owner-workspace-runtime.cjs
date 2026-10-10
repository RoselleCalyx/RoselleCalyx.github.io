// Browser integration with an in-memory API. No credentials or writes reach a service.
// node tests/owner-workspace-runtime.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/Users/cassini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const output = process.env.OWNER_QA_DIR || '/tmp';
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const copy = value => JSON.parse(JSON.stringify(value));
const field = (page, name) => page.locator('[data-owner-field="' + name + '"]');

async function serve() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
      const body = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream' }); response.end(body);
    } catch (_) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, base:'http://127.0.0.1:' + server.address().port };
}

async function main() {
  const { validateSiteContent } = await import(pathToFileURL(path.join(root, 'services/message-worker/src/site-content.js')).href);
  const { server, base } = await serve();
  const defaults = JSON.parse(await fs.readFile(path.join(root, 'data/site-defaults.json'), 'utf8'));
  const state = { revision:0, content:{}, failure:'', fallback:false, saves:[], patches:[], reviews:[], removals:[], contentGets:0 };
  const letter = { id:1, created_at:'2026-10-10T00:00:00Z', name:'A visitor', contact:'visitor@example.invalid', text:'A private question about your research.', read_at:null, status:'new', host_note:'' };
  const residentId = 'ce031e53-83cf-4a2b-9c4a-c30a7e253ed4';
  const adoptions = [
    { id:7, species:'rabbit', name:'Clover', adoptedBy:'A visitor', note:'May Clover join the meadow?', created_at:'2026-10-10T00:00:00Z', status:'pending' },
    { id:residentId, species:'fox', name:'Fern', adoptedBy:'Another visitor', note:'An approved visitor resident.', created_at:'2026-10-09T00:00:00Z', status:'approved' },
    { id:'a6a053e7-11f8-47dd-a285-390fbb7d9190', species:'panda', name:'Seed', adoptedBy:'A visitor', note:'A declined request.', created_at:'2026-10-08T00:00:00Z', status:'rejected' }
  ];
  const trees = [{ id:'initial-apple', type:'apple', slot:0, seed:13, variant:0, plantedAbs:0, water:1, canRemove:true }];
  const envelope = () => ({ ok:true, revision:state.revision, updatedAt:state.revision ? '2026-10-10T01:00:00Z' : null, content:copy(state.content) });
  const errors = [], apiErrors = [];
  let browser;
  try {
    browser = await chromium.launch({ executablePath:chrome, headless:true });
    const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, reducedMotion:'reduce' });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === base) return route.continue();
      if (!url.pathname.startsWith('/api/')) return route.abort();
      const method = request.method(), pathname = url.pathname;
      const respond = (data, status=200) => route.fulfill({ status, contentType:'application/json', headers:{ 'Access-Control-Allow-Origin':base, 'Access-Control-Allow-Methods':'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Farm-Token' }, body:JSON.stringify(data) });
      try {
        if (method === 'OPTIONS') return respond({}, 200);
        if (pathname === '/api/site-content') return state.fallback ? route.abort() : respond(envelope());
        if (pathname === '/api/host/login') {
          assert.deepEqual(request.postDataJSON(), { email:'owner-qa@example.invalid', password:'local-qa-password' });
          return respond({ access_token:'qa-access-token', refresh_token:'qa-refresh-token', expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'host', email:'owner-qa@example.invalid' } });
        }
        if (pathname.startsWith('/api/host/') || method === 'DELETE') assert.equal(request.headers().authorization, 'Bearer qa-access-token');
        if (pathname === '/api/host/me') return respond({ id:'host', email:'owner-qa@example.invalid' });
        if (pathname === '/api/host/site-content') {
          if (method === 'GET') { state.contentGets++; return respond(envelope()); }
          assert.equal(method, 'PUT');
          if (state.failure === 'network') return route.abort();
          if (state.failure === 'conflict') return respond({ ok:false, code:'content_conflict', message:'Another host session changed the website.' }, 409);
          const body = request.postDataJSON(); assert.equal(body.revision, state.revision);
          validateSiteContent(body.content); state.content = copy(body.content); state.revision++; state.saves.push(copy(body));
          return respond(envelope());
        }
        if (pathname === '/api/host/messages') return respond([copy(letter)]);
        if (pathname === '/api/host/messages/1' && method === 'PATCH') {
          const body = request.postDataJSON(); state.patches.push(copy(body)); if (state.messageGate) await state.messageGate; Object.assign(letter, body); return respond([copy(letter)]);
        }
        if (pathname === '/api/farm' && method === 'GET') return respond({ ok:true, maxTrees:8, trees:copy(trees), residents:[] });
        if (pathname === '/api/host/farm/adoptions') return respond(copy(adoptions.filter(row => row.status === url.searchParams.get('status'))));
        if (pathname === '/api/host/farm/residents' && method === 'GET') return respond(adoptions.filter(row => row.status === 'approved' && row.id === residentId).map(row => ({ id:row.id, name:row.name, species:row.species, adoptedBy:row.adoptedBy, note:row.note, created_at:row.created_at, since:row.since || row.created_at.slice(0,7), active:row.active !== false, version:row.version || 0 })));
        if (pathname === '/api/host/farm/residents/' + residentId && method === 'PATCH') {
          const row = adoptions[1], changes = request.postDataJSON(); assert.equal(changes.version, row.version || 0);
          Object.assign(row, changes); row.version++;
          return respond({ id:row.id, name:row.name, species:row.species, adoptedBy:row.adoptedBy, note:row.note, created_at:row.created_at, since:row.since || row.created_at.slice(0,7), active:row.active !== false, version:row.version });
        }
        if (pathname === '/api/host/farm/adoptions/7' && method === 'PATCH') {
          Object.assign(adoptions[0], request.postDataJSON()); state.reviews.push(copy(adoptions[0])); return respond(copy(adoptions[0]));
        }
        if (pathname === '/api/host/farm/residents/' + residentId && method === 'DELETE') { adoptions[1].status = 'rejected'; state.removals.push(residentId); return respond({ ok:true, deleted:true }); }
        if (pathname === '/api/farm/trees/initial-apple' && method === 'DELETE') { trees.splice(0); return respond({ ok:true, deleted:true }); }
        if (pathname === '/api/host/logout') return respond({ ok:true });
        throw Error('Unexpected mocked API request: ' + method + ' ' + pathname);
      } catch (error) { apiErrors.push(error.message); return respond({ ok:false, code:'test_failure', message:error.message }, 500); }
    });
    const owner = await context.newPage(), publicPage = await context.newPage();
    const tab = async name => owner.locator('[data-owner-tab="' + name + '"]').click();
    const save = async () => {
      const before = state.revision;
      await owner.locator('#saveContentButton').click();
      await owner.waitForFunction(() => document.querySelector('#ownerSaveState').textContent === 'Published content');
      assert.equal(state.revision, before + 1, 'save increments published version');
      assert.match(await owner.locator('#ownerEditorStatus').innerText(), /^Published\./);
    };
    const publicOpen = async page => { await publicPage.goto(base + '/' + page); await publicPage.evaluate(() => SiteContent.started); };
    await owner.goto(base + '/inbox.html'); await owner.locator('#loginPanel').waitFor({ state:'visible' });
    await owner.locator('#hostEmail').fill('owner-qa@example.invalid'); await owner.locator('#hostPassword').fill('local-qa-password'); await owner.locator('#loginButton').click();
    await field(owner, 'site.name').waitFor(); assert.equal(await field(owner, 'site.name').inputValue(), defaults.site.name);
    assert.equal(await owner.locator('#hostPassword').inputValue(), '', 'password clears after successful sign-in');
    await field(owner, 'site.name').fill('Published Researcher'); await field(owner, 'site.brand').fill('Published Researcher');
    await field(owner, 'site.links.github').fill('https://github.com/published-owner'); await field(owner, 'site.links.linkedin').fill(''); await save();
    await publicOpen('index.html'); assert.equal(await publicPage.locator('[data-site="name"]').first().innerText(), 'Published Researcher');
    assert.equal(await publicPage.locator('[data-link="github"]').first().getAttribute('href'), 'https://github.com/published-owner');
    assert.equal(await publicPage.locator('[data-link="linkedin"]').first().isVisible(), false, 'empty links are hidden');
    console.log('[owner] Unified login, profile and public link publication passed');

    // Added editorial fields travel through the same authenticated publication.
    await field(owner, 'site.pages.papers.navLabel').fill('Research');
    await field(owner, 'site.pages.home.description').fill('A researcher’s editable public profile.');
    await owner.getByRole('button', { name:'＋ Add additional link', exact:true }).click();
    await field(owner, 'site.extraLinks.0.label').fill('Research laboratory');
    await field(owner, 'site.extraLinks.0.href').fill('https://example.org/lab');
    await field(owner, 'site.extraLinks.0.icon').selectOption('globe');
    await tab('home');
    await field(owner, 'home.avatarAlt').fill('Researcher looking at the sky');
    await field(owner, 'home.labels.education').fill('Research journey');
    await field(owner, 'home.visibility.news').uncheck();
    await field(owner, 'home.finale.title').fill('Always looking beyond.');
    await tab('public');
    await field(owner, 'message.introKicker').fill('A letter from your world');
    await field(owner, 'message.placeholder').fill('Tell me about your idea…');
    await save();
    assert.equal(state.content.site.extraLinks[0].href, 'https://example.org/lab');
    assert.equal(state.content.home.visibility.news, false);
    await publicOpen('index.html');
    assert.equal(await publicPage.locator('.nav a[href="papers.html"]').innerText(), 'Research');
    assert.equal(await publicPage.locator('meta[name="description"]').getAttribute('content'), 'A researcher’s editable public profile.');
    assert.equal(await publicPage.getByRole('link', { name:'Research laboratory', exact:true }).count(), 1);
    assert.equal(await publicPage.locator('.bio-portrait img').getAttribute('alt'), 'Researcher looking at the sky');
    assert.equal(await publicPage.locator('#education h2').innerText(), 'Research journey');
    assert.equal(await publicPage.locator('#news').isVisible(), false);
    assert.equal(await publicPage.locator('#finale h2').textContent(), 'Always looking beyond.');
    await publicOpen('message.html');
    assert.equal(await publicPage.locator('#bText').getAttribute('placeholder'), 'Tell me about your idea…');
    assert.match(await publicPage.locator('.shore-kicker').innerText(), /A letter from your world/i);
    await publicPage.locator('[name="delivery"][value="email"]').check();
    assert.match(await publicPage.locator('#deliveryNote').innerText(), /Published Researcher/);
    await tab('home'); await field(owner, 'home.visibility.news').check(); await save();
    console.log('[owner] Additional links, navigation, descriptions, home visibility/labels, portrait text and Message copy publish');

    await tab('papers'); const paperIndex = defaults.papers.length;
    await owner.locator('[data-owner-panel="papers"] > .owner-group > .owner-add').click();
    const paperPath = 'papers.' + paperIndex;
    for (const [key, value] of Object.entries({ title:'A Complete Cloud Publication', authors:'Published Researcher\nSecond Author', venue:'Clinical AI Journal', year:'2026', topics:'Medical Imaging\nQA Topic', abstract:'A complete abstract published from the host workspace.', image:'assets/avatar.jpg', 'links.pdf':'https://example.org/research.pdf', 'links.code':'https://github.com/published-owner/research', 'links.project':'https://example.org/research', 'links.data':'https://example.org/dataset', bibtex:'@article{qa2026, title={A Complete Cloud Publication}}' })) await field(owner, paperPath + '.' + key).fill(value);
    await field(owner, paperPath + '.type').selectOption('publication'); await field(owner, paperPath + '.selected').check();
    const paperCard = field(owner, paperPath + '.title').locator('..').locator('..');
    await paperCard.locator('.owner-group > .owner-add').click();
    await field(owner, paperPath + '.figures.0.src').fill('assets/home-landscape.webp'); await field(owner, paperPath + '.figures.0.caption').fill('Published detailed figure');
    await field(owner, paperPath + '.imageAlt').fill('Paper overview diagram'); await field(owner, paperPath + '.figures.0.alt').fill('Detailed method diagram');
    await save(); await publicOpen('papers.html');
    const publicPaper = publicPage.locator('.paper').filter({ has:publicPage.getByRole('heading', { name:'A Complete Cloud Publication', exact:true }) });
    assert.equal(await publicPaper.count(), 1); assert.equal(await publicPaper.locator('.paper-authors strong').innerText(), 'Published Researcher');
    assert.match(await publicPaper.innerText(), /Clinical AI Journal/); assert.match(await publicPaper.locator('.paper-abs').innerText(), /complete abstract/);
    for (const [caption, href] of [['PDF','https://example.org/research.pdf'], ['Code','https://github.com/published-owner/research'], ['Project','https://example.org/research'], ['Data','https://example.org/dataset']]) assert.equal(await publicPaper.getByRole('link', { name:caption, exact:true }).getAttribute('href'), href);
    await publicPaper.locator('[data-act="figures"]').click(); await publicPage.locator('.lightbox').waitFor();
    assert.equal(await publicPage.locator('.lightbox h3').innerText(), 'A Complete Cloud Publication'); await publicPage.locator('.lb-nav.next').click();
    assert.equal(await publicPage.locator('.lightbox h3').innerText(), 'Published detailed figure'); await publicPage.locator('.lb-close').click();
    await publicPaper.locator('[data-act="bib"]').click(); assert.match(await publicPaper.locator('.bibtex').innerText(), /qa2026/);
    console.log('[owner] Complete paper publication, figures, links and BibTeX passed');

    await field(owner, paperPath + '.title').evaluate(input => { input.closest('details').open = true; });
    await field(owner, paperPath + '.published').uncheck(); await save(); await publicOpen('papers.html');
    assert.equal(await publicPage.getByRole('heading', { name:'A Complete Cloud Publication', exact:true }).count(), 0);
    assert.equal(state.content.papers[paperIndex].title, 'A Complete Cloud Publication', 'hidden papers retain all owner fields');
    await field(owner, paperPath + '.title').evaluate(input => { input.closest('details').open = true; });
    await field(owner, paperPath + '.published').check(); await save(); await publicOpen('papers.html');
    assert.equal(await publicPage.getByRole('heading', { name:'A Complete Cloud Publication', exact:true }).count(), 1);
    await field(owner, paperPath + '.title').evaluate(input => { input.closest('details').open = true; });
    console.log('[owner] Paper can be hidden and restored without data loss');

    const deleteCard = field(owner, paperPath + '.title').locator('..').locator('..');
    owner.once('dialog', dialog => dialog.accept()); await deleteCard.locator(':scope > summary .owner-delete').click(); await save();
    await publicOpen('papers.html'); assert.equal(await publicPage.getByRole('heading', { name:'A Complete Cloud Publication', exact:true }).count(), 0);
    console.log('[owner] Paper deletion publishes to the public page');

    await tab('gallery'); const albumPath = 'gallery.' + defaults.gallery.length;
    await owner.locator('[data-owner-panel="gallery"] > .owner-group > .owner-add').click();
    for (const [key, value] of Object.entries({ id:'qa-munich', place:'Munich QA', title:'A Published Footprint', date:'2026-10', 'coords.0':'48.14', 'coords.1':'11.58', tags:'Nature\nPublished Tag', story:'A host-managed gallery story.' })) await field(owner, albumPath + '.' + key).fill(value);
    await field(owner, albumPath + '.favorite').check();
    const albumCard = field(owner, albumPath + '.id').locator('..').locator('..').locator('..');
    await albumCard.locator('.owner-group > .owner-add').click(); await field(owner, albumPath + '.photos.0.src').fill('assets/avatar.jpg'); await field(owner, albumPath + '.photos.0.caption').fill('Published photo caption');
    await field(owner, albumPath + '.photos.0.alt').fill('A photo near the Isar'); await field(owner, albumPath + '.photos.0.text').fill('The longer story of this particular photo.');
    await save(); await publicOpen('gallery.html');
    assert.ok(await publicPage.locator('#trail').innerText().then(text => text.includes('Munich QA')));
    assert.equal(await publicPage.locator('#tags').getByRole('button', { name:'Published Tag', exact:true }).count(), 1);
    assert.equal(await publicPage.evaluate(() => GALLERY.find(album => album.id === 'qa-munich').photos[0].caption), 'Published photo caption');
    assert.equal(state.content.gallery.at(-1).photos[0].text, 'The longer story of this particular photo.');
    assert.equal(state.content.gallery.at(-1).photos[0].alt, 'A photo near the Isar');
    console.log('[owner] Gallery album, coordinates, custom tags and photo stories/descriptions publish');

    await tab('animals'); await field(owner, 'farm.keeper.name').fill('Chai'); await field(owner, 'farm.keeper.title').fill('The meadow caretaker');
    await field(owner, 'farm.keeper.species').selectOption('fox'); await field(owner, 'farm.keeper.note').fill('A keeper story published from the workspace.'); await save();
    await publicOpen('farm.html');
    assert.equal(await publicPage.locator('#meetKeeper img').getAttribute('src'), 'assets/farm/fox.webp');
    assert.equal(await publicPage.locator('#meetKeeper b').innerText(), 'Chai is keeping watch.');
    assert.equal(await publicPage.locator('#meetKeeper small').textContent(), 'The meadow caretaker');
    assert.match(await publicPage.locator('#meetKeeper').innerText(), /A keeper story published from the workspace\./);
    console.log('[owner] Published keeper species, name, title and story appear on the farm card');

    await tab('profile'); await field(owner, 'site.tagline').fill('A draft kept through publishing failures');
    const revisionBefore = state.revision; state.failure = 'conflict'; await owner.locator('#saveContentButton').click();
    await owner.waitForFunction(() => document.querySelector('#ownerEditorStatus').classList.contains('is-error'));
    assert.match(await owner.locator('#ownerEditorStatus').innerText(), /another|changed|draft|reload/i);
    assert.equal(await field(owner, 'site.tagline').inputValue(), 'A draft kept through publishing failures'); assert.equal(await owner.locator('#ownerSaveState').innerText(), 'Unpublished changes');
    state.failure = 'network'; await owner.locator('#saveContentButton').click();
    await owner.waitForFunction(() => document.querySelector('#ownerEditorStatus').textContent.includes('could not be reached'));
    assert.equal(await field(owner, 'site.tagline').inputValue(), 'A draft kept through publishing failures'); assert.equal(state.revision, revisionBefore); assert.equal(await owner.locator('#saveContentButton').isDisabled(), false);
    state.failure = ''; await save(); console.log('[owner] Conflict and network failure keep the unpublished draft');

    await tab('letters'); await owner.locator('.letter-management textarea').fill('Private follow-up note'); await owner.locator('.letter-management select').selectOption('done');
    await owner.locator('.letter-management textarea').focus(); await owner.locator('.letter-management textarea').evaluate(input => input.setSelectionRange(3, 8));
    const refreshed = owner.waitForResponse(response => new URL(response.url()).pathname === '/api/host/messages');
    await owner.evaluate(() => document.querySelector('#refreshButton').click()); await refreshed;
    await owner.waitForFunction(() => !document.querySelector('#refreshButton').disabled);
    assert.equal(await owner.locator('.letter-management textarea').inputValue(), 'Private follow-up note', 'refresh retains an unpublished handling note');
    assert.equal(await owner.locator('.letter-management select').inputValue(), 'done', 'refresh retains an unpublished handling status');
    assert.deepEqual(await owner.locator('.letter-management textarea').evaluate(input => ({ focused:document.activeElement === input, start:input.selectionStart, end:input.selectionEnd })), { focused:true, start:3, end:8 }, 'refresh restores edit focus and text selection');
    await owner.getByRole('button', { name:'Save handling', exact:true }).click();
    await owner.waitForFunction(() => document.querySelector('#inboxStatus').textContent.includes('handling saved'));
    assert.deepEqual(state.patches.at(-1), { status:'done', host_note:'Private follow-up note' }); assert.equal(JSON.stringify(state.content).includes('Private follow-up note'), false);
    await owner.locator('.letter-management textarea').fill('Submitted handling note'); await owner.locator('.letter-management select').selectOption('archived');
    let releaseMessage; state.messageGate = new Promise(resolve => { releaseMessage = resolve; });
    const handlingSent = owner.waitForRequest(request => new URL(request.url()).pathname === '/api/host/messages/1' && request.method() === 'PATCH');
    await owner.getByRole('button', { name:'Save handling', exact:true }).click(); await handlingSent;
    const locked = await owner.locator('.letter-management textarea').evaluate(input => input.disabled || Boolean(input.closest('[inert]')));
    if (!locked) { await owner.locator('.letter-management textarea').fill('Typed while save is pending'); await owner.locator('.letter-management select').selectOption('new'); }
    state.messageGate = null; releaseMessage(); await owner.waitForFunction(() => !document.querySelector('.letter-management button').disabled);
    if (!locked) {
      assert.equal(await owner.locator('.letter-management textarea').inputValue(), 'Typed while save is pending', 'a delayed PATCH must preserve a newer note draft');
      assert.equal(await owner.locator('.letter-management select').inputValue(), 'new', 'a delayed PATCH must preserve a newer status draft');
      await owner.getByRole('button', { name:'Save handling', exact:true }).click(); await owner.waitForFunction(() => !document.querySelector('.letter-management button').disabled);
    }
    await owner.getByRole('button', { name:'Approve Clover', exact:true }).click(); await owner.waitForFunction(() => document.querySelector('#adoptionList').children.length === 0); assert.equal(state.reviews[0].status, 'approved');
    await owner.locator('#adoptionFilter').selectOption('approved'); await owner.getByRole('button', { name:'Manage animal Fern', exact:true }).waitFor();
    assert.equal(await owner.getByRole('button', { name:'Approve Fern', exact:true }).count(), 0, 'approved filter does not offer another approval');
    await owner.getByRole('button', { name:'Manage animal Fern', exact:true }).click();
    const fern = owner.locator('[data-resident-id="' + residentId + '"]');
    await fern.getByRole('button', { name:'Send indoors', exact:true }).click();
    await fern.getByRole('button', { name:'Save animal', exact:true }).click();
    await owner.waitForFunction(() => document.querySelector('.owner-adopted-animal .owner-animal-badge').textContent === 'Resting indoors');
    assert.equal(adoptions[1].status, 'approved'); assert.equal(adoptions[1].active, false); assert.deepEqual(state.removals, []);
    await tab('letters');
    await owner.locator('#adoptionFilter').selectOption('rejected'); await owner.waitForFunction(() => document.querySelector('#adoptionList').textContent.includes('Seed'));
    assert.equal((await owner.locator('#adoptionList').innerText()).includes('Fern'), false, 'indoor rest preserves approved adoption status'); assert.equal(await owner.locator('#adoptionList button').count(), 0, 'rejected history has no mutation controls');
    await owner.getByRole('button', { name:'Remove Apple tree in space 1', exact:true }).click(); await owner.getByRole('button', { name:'Remove Apple tree in space 1', exact:true }).click(); await owner.waitForFunction(() => document.querySelector('#orchardList').children.length === 0);
    console.log('[owner] Handling drafts/focus survive refresh; private notes, adoption filters/approval, reversible resident rest and orchard removal passed');

    await tab('profile');
    const downloadReady = owner.waitForEvent('download'); await owner.locator('#exportContentButton').click(); const download = await downloadReady;
    const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(backup.format, 'quiet-shore-content-v1'); assert.deepEqual(backup.content, state.content); assert.equal(backup.revision, state.revision);
    await owner.locator('#importContentFile').setInputFiles({ name:'website-backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup)) });
    await owner.waitForFunction(() => document.querySelector('#ownerEditorStatus').textContent.includes('Backup imported'));
    assert.equal(await owner.locator('#ownerSaveState').innerText(), 'Unpublished changes'); await save();
    await tab('gallery'); const originalAlbumTitle = await field(owner, 'gallery.0.title').inputValue(); await field(owner, 'gallery.0.title').fill('');
    await tab('papers'); const originalTitle = await field(owner, 'papers.0.title').inputValue(); await field(owner, 'papers.0.title').fill(''); await tab('profile');
    const beforeInvalid = state.revision; await owner.locator('#saveContentButton').click();
    assert.equal(await owner.locator('[data-owner-tab="papers"]').getAttribute('aria-pressed'), 'true', 'native validation reveals an invalid hidden tab');
    assert.equal(await owner.evaluate(() => document.activeElement.dataset.ownerField), 'papers.0.title'); assert.equal(state.revision, beforeInvalid, 'invalid fields never publish');
    await field(owner, 'papers.0.title').fill(originalTitle); await tab('gallery'); await field(owner, 'gallery.0.title').fill(originalAlbumTitle); await save(); console.log('[owner] Backup export/import and multiple hidden-field validation routing passed');

    await tab('profile'); const contentGetsBeforeExpiry = state.contentGets;
    await field(owner, 'site.tagline').fill('A draft restored after automatic session expiry');
    await owner.evaluate(() => dispatchEvent(new CustomEvent('host-auth-expired'))); await owner.locator('#loginPanel').waitFor({ state:'visible' });
    assert.equal(await owner.evaluate(() => HostInbox.signedIn), false); assert.equal(await owner.locator('#ownerEditor').isVisible(), false);
    assert.equal(await owner.locator('#messageList').innerText(), '', 'automatic expiry hides and clears private letters');
    await owner.locator('#hostEmail').fill('owner-qa@example.invalid'); await owner.locator('#hostPassword').fill('local-qa-password'); await owner.locator('#loginButton').click();
    await owner.waitForFunction(() => document.querySelector('#ownerEditorStatus').textContent.includes('Signed in again'));
    assert.equal(await field(owner, 'site.tagline').inputValue(), 'A draft restored after automatic session expiry');
    assert.equal(state.contentGets, contentGetsBeforeExpiry, 'sign-in resumes the dirty draft without force-reloading the published snapshot');
    assert.equal(await owner.locator('#ownerSaveState').innerText(), 'Unpublished changes'); await save();
    console.log('[owner] Automatic session expiry hides private data and preserves the unpublished draft through sign-in and publication');

    await tab('profile'); await owner.evaluate(() => scrollTo(0, 0)); await fs.mkdir(output, { recursive:true });
    assert.ok(await owner.locator('#inboxPanel').evaluate(el => el.getBoundingClientRect().width) >= 900, 'desktop workspace uses a wide editing area');
    await owner.screenshot({ path:path.join(output, 'owner-workspace-desktop.png') });
    await owner.setViewportSize({ width:390, height:844 });
    for (const name of ['profile', 'home', 'papers', 'gallery', 'animals', 'public', 'letters']) {
      await tab(name); assert.equal(await owner.locator('[data-owner-tab="' + name + '"]').getAttribute('aria-pressed'), 'true');
      const widths = await owner.evaluate(() => ({ width:innerWidth, scroll:document.documentElement.scrollWidth }));
      assert.ok(widths.scroll <= widths.width + 1, name + ' mobile form must not overflow horizontally: ' + JSON.stringify(widths));
    }
    await tab('profile'); await owner.evaluate(() => scrollTo(0, 0));
    await owner.screenshot({ path:path.join(output, 'owner-workspace-mobile.png') });
    const initialField = await field(owner, 'site.name').boundingBox();
    const initialFieldClickable = await field(owner, 'site.name').evaluate(input => { const r = input.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === input; });
    await publicPage.setViewportSize({ width:390, height:844 }); await publicOpen('index.html');
    const home = await publicPage.evaluate(() => { const social = document.querySelector('.hero-text .social'), foot = document.querySelector('.hero-foot'); return { width:innerWidth, scroll:document.documentElement.scrollWidth, socialBottom:social.getBoundingClientRect().bottom, footTop:foot.getBoundingClientRect().top }; });
    assert.ok(home.scroll <= home.width + 1, 'Home mobile has no horizontal overflow'); assert.ok(home.socialBottom < home.footTop, 'Home social/host links do not overlap footer');
    console.log('[owner] 390 × 844 host tabs/forms and Home host login layout passed');

    const published = copy(state.content);
    state.content.papers = []; state.content.gallery = []; state.content.bottles = [];
    state.content.home.news = []; state.content.home.education = []; state.content.home.interests = [];
    await publicOpen('papers.html'); assert.equal(await publicPage.locator('.paper').count(), 0); assert.equal(await publicPage.locator('#paperList .empty').count(), 1);
    await publicOpen('gallery.html'); assert.equal(await publicPage.evaluate(() => GALLERY.length), 0);
    await publicOpen('index.html'); assert.equal(await publicPage.locator('.news li').count(), 0); assert.equal(await publicPage.locator('.bio-content .chips .chip').count(), 0);
    state.content = published; console.log('[owner] Empty cloud collections clear static papers, gallery, news and interests');

    state.fallback = true;
    for (const name of ['index.html', 'papers.html', 'gallery.html', 'starmap.html', 'farm.html']) {
      await publicOpen(name); assert.equal(await publicPage.evaluate(() => SiteContent.source), 'static');
      if (name === 'papers.html') assert.equal(await publicPage.locator('.paper').count(), defaults.papers.length);
      if (name === 'starmap.html') assert.ok((await publicPage.locator('#smList').innerHTML()).length > 0);
      if (name === 'farm.html') assert.ok(await publicPage.locator('.actor').count() > 0);
    }
    assert.deepEqual(apiErrors, []); assert.deepEqual(errors, []);
    console.log('[owner] Static fallback starts Home, Papers, Gallery, Starmap and Farm without JavaScript errors');
    await owner.locator('#logoutButton').click(); await owner.locator('#loginPanel').waitFor({ state:'visible' });
    assert.equal(await owner.locator('#ownerContentForm [data-owner-field]').count(), 0, 'signout clears the owner forms');
    assert.equal(await owner.evaluate(() => HostInbox.signedIn), false); assert.equal(await owner.evaluate(() => sessionStorage.getItem('message-host-session-v1')), null);
    assert.equal(await owner.locator('#messageList').innerText(), '', 'signout clears private letters'); console.log('[owner] Signout clears public drafts, private letters and the shared host session');
    assert.ok(initialField.y + initialField.height <= 844, 'first editable field appears in the initial mobile viewport: ' + JSON.stringify(initialField));
    assert.ok(initialFieldClickable, 'first mobile field remains clickable and is not covered by the publish bar');
    console.log('[owner] Completed ' + state.saves.length + ' mocked publications; no remote writes. Screenshots: ' + path.join(output, 'owner-workspace-desktop.png') + ', ' + path.join(output, 'owner-workspace-mobile.png'));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
