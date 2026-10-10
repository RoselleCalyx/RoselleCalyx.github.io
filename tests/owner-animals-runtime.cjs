// Owner animal integration against an isolated HTTP server and in-memory API.
// Every external request is intercepted; test credentials never leave Chromium.
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
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const copy = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, entered; const promise = new Promise(done => { resolve = done; }), enteredPromise = new Promise(done => { entered = done; }); return { promise, resolve, entered, enteredPromise }; };
const field = (page, name) => page.locator('[data-owner-field="' + name + '"]');
const card = (page, id) => page.locator('[data-resident-id="' + id + '"]');
const animalField = (page, id, name) => card(page, id).locator('[data-resident-field="' + name + '"]');
async function expose(locator) {
  await locator.evaluate(el => { for (let parent = el.closest('details'); parent; parent = parent.parentElement.closest('details')) parent.open = true; });
}
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
  const defaults = JSON.parse(await fs.readFile(path.join(root, 'data/site-defaults.json'), 'utf8'));
  assert.equal(defaults.farm.residents.length, 10, 'fixture starts with the ten original residents');
  const { server, base } = await serve();
  const state = { revision:0, content:{}, residents:[], patches:[], saves:[], failure:'', gate:null, gets:0, auth:0 };
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
        if (pathname === '/api/site-content') return respond(envelope());
        if (pathname === '/api/host/login') {
          assert.deepEqual(request.postDataJSON(), { email:'animals-qa@example.invalid', password:'local-animal-test-password' });
          state.auth++;
          return respond({ access_token:'qa-animal-access-' + state.auth, refresh_token:'qa-animal-refresh-' + state.auth, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'host', email:'animals-qa@example.invalid' } });
        }
        if (pathname === '/api/host/refresh') {
          assert.match(request.postDataJSON().refresh_token || '', /^qa-animal-refresh-\d+$/);
          if (state.failure === 'auth') return respond({ ok:false, code:'auth_expired', message:'Your session expired. Please sign in again.' }, 401);
          return respond({ access_token:'qa-animal-access-' + state.auth, refresh_token:'qa-animal-refresh-' + state.auth, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'host', email:'animals-qa@example.invalid' } });
        }
        if (pathname.startsWith('/api/host/')) assert.match(request.headers().authorization || '', /^Bearer qa-animal-access-\d+$/);
        if (pathname === '/api/host/me') return respond({ id:'host', email:'animals-qa@example.invalid' });
        if (pathname === '/api/host/logout') return respond({ ok:true });
        if (pathname === '/api/host/messages' || pathname === '/api/host/farm/adoptions') return respond([]);
        if (pathname === '/api/host/site-content') {
          if (method === 'GET') return respond(envelope());
          assert.equal(method, 'PUT'); const body = request.postDataJSON(); assert.equal(body.revision, state.revision);
          validateSiteContent(body.content); state.content = copy(body.content); state.revision++; state.saves.push(copy(body)); return respond(envelope());
        }
        if (pathname === '/api/farm') return respond({ ok:true, maxTrees:8, trees:[], residents:state.residents.filter(row => row.active).map(row => ({ id:row.id, species:row.species, name:row.name, adoptedBy:row.adoptedBy, note:row.note, since:row.since })) });
        if (pathname === '/api/host/farm/residents' && method === 'GET') { state.gets++; return respond(copy(state.residents)); }
        const match = /^\/api\/host\/farm\/residents\/([0-9a-f-]{36})$/i.exec(pathname);
        if (match && method === 'PATCH') {
          const body = request.postDataJSON(), row = state.residents.find(item => item.id === match[1]);
          assert.ok(row, 'mocked resident exists'); state.patches.push({ id:row.id, body:copy(body) });
          assert.equal(body.version, row.version, 'every mutation carries the confirmed version');
          if (state.failure === 'network') return route.abort();
          if (state.failure === 'auth') return respond({ ok:false, code:'auth_expired', message:'Your session expired. Please sign in again.' }, 401);
          if (state.failure === 'conflict') { row.version++; row.name = 'Changed elsewhere'; return respond({ ok:false, code:'resident_conflict', message:'This animal changed in another session. Your draft is preserved.' }, 409); }
          for (const key of Object.keys(body)) assert.ok(['name','species','adoptedBy','note','since','active','version'].includes(key), 'no private or unrelated fields in an animal mutation');
          for (const key of ['name','species','adoptedBy','note','since','active']) if (Object.hasOwn(body, key)) row[key] = body[key];
          row.version++; const result = copy(row), gate = state.gate;
          if (gate) { gate.entered(); await gate.promise; }
          return respond(result);
        }
        throw Error('Unexpected mocked API request: ' + method + ' ' + pathname);
      } catch (error) { apiErrors.push(error.message); return respond({ ok:false, code:'test_failure', message:error.message }, 500); }
    });
    const owner = await context.newPage(), publicPage = await context.newPage();
    const tab = async () => owner.locator('[data-owner-tab="animals"]').click();
    const login = async () => {
      await owner.locator('#hostEmail').fill('animals-qa@example.invalid'); await owner.locator('#hostPassword').fill('local-animal-test-password'); await owner.locator('#loginButton').click();
      await owner.locator('[data-owner-tab="animals"]').waitFor({ state:'visible' }); await tab();
      await field(owner, 'farm.residents.0.name').waitFor({ state:'attached' });
    };
    const publish = async () => {
      const before = state.revision; await owner.locator('#saveContentButton').click();
      await owner.waitForFunction(() => document.querySelector('#ownerSaveState').textContent === 'Published content');
      assert.equal(state.revision, before + 1);
    };
    const publicOpen = async () => { await publicPage.goto(base + '/farm.html'); await publicPage.evaluate(() => SiteContent.started); await publicPage.locator('#farmSharedStatus').filter({ hasText:'A shared orchard' }).waitFor(); };
    const outsideCount = () => publicPage.locator('.actor:not(.keeper)').count();
    const action = (id, label) => card(owner, id).getByRole('button', { name:label, exact:true });
    const status = id => card(owner, id).locator('.owner-animal-status');
    const waitSettled = async id => {
      await owner.waitForFunction(id => { const row = document.querySelector('[data-resident-id="' + id + '"]'); return row && row.getAttribute('aria-busy') === 'false'; }, id);
    };
    const refresh = async () => {
      const before = state.gets, response = owner.waitForResponse(response => new URL(response.url()).pathname === '/api/host/farm/residents' && response.request().method() === 'GET');
      await owner.getByRole('button', { name:'Refresh animals', exact:true }).click(); await response;
      await owner.waitForFunction(() => !document.querySelector('#ownerAdoptionAnimals button').disabled); assert.ok(state.gets > before);
      assert.match(await owner.locator('#ownerAnimalsStatus').innerText(), /up to date|refreshed/i, 'a refresh confirms valid latest records');
    };
    await owner.goto(base + '/inbox.html'); await owner.locator('#loginPanel').waitFor({ state:'visible' }); await login();
    const originalName = defaults.farm.residents[0].name;
    await publicOpen(); assert.equal(await outsideCount(), 10); assert.equal(await publicPage.locator('.actor.keeper').count(), 1);
    await expose(field(owner, 'farm.residents.0.name'));
    const originalCard = field(owner, 'farm.residents.0.name').locator('xpath=ancestor::details[1]');
    await originalCard.getByRole('button', { name:'Send indoors', exact:true }).click();
    assert.equal(state.saves.length, 0, 'indoors remains a draft until publication'); await publish(); await publicOpen();
    assert.equal(await outsideCount(), 9); assert.equal(await publicPage.locator('.actor.keeper').count(), 1, 'sending a resident indoors never removes Matcha');
    assert.equal(state.content.farm.residents.length, 10, 'indoors preserves the original resident record');
    assert.equal(await publicPage.locator('.resident-label').filter({ hasText:originalName }).count(), 0);
    await originalCard.getByRole('button', { name:'Let outside', exact:true }).click(); await publish(); await publicOpen(); assert.equal(await outsideCount(), 10);
    console.log('[animals] Original residents sleep and return through Save & publish; keeper and records remain');

    for (let index = 10; index < 12; index++) {
      await owner.locator('[data-owner-panel="animals"] .owner-add').click();
      await field(owner, 'farm.residents.' + index + '.name').fill(originalName);
    }
    await publish();
    const duplicateIds = state.content.farm.residents.slice(10).map(row => row.id);
    assert.equal(new Set(duplicateIds).size, 2); assert.ok(duplicateIds.every(id => typeof id === 'string' && id.length > 0));
    await publicOpen(); assert.equal(await outsideCount(), 12); assert.equal(await publicPage.locator('.resident-label').filter({ hasText:originalName }).count(), 3, 'same names remain independent animals');
    console.log('[animals] New original animals get independent stable identities even with duplicate names');

    const newSpecies = ['redpanda','raccoon','wolf','crocodile','fennec'];
    state.residents = newSpecies.map((species, index) => ({ id:'11111111-1111-4111-8111-' + String(index + 1).padStart(12,'0'), species, name:'Visitor ' + species, adoptedBy:'Initial adopter', note:'An approved friend.', since:'2026-09', active:true, version:0, created_at:'2026-09-12T00:00:00Z' }));
    await refresh();
    for (const [index, species] of newSpecies.entries()) {
      const id = state.residents[index].id; await expose(animalField(owner, id, 'name'));
      for (const [key, value] of Object.entries({ name:'Updated ' + species, adoptedBy:'New adopter ' + index, note:'New basic story ' + index, since:'2026-10' })) await animalField(owner, id, key).fill(value);
      await animalField(owner, id, 'species').selectOption(species); await action(id, 'Save animal').click(); await waitSettled(id);
      assert.equal(state.residents[index].name, 'Updated ' + species); assert.equal(state.residents[index].adoptedBy, 'New adopter ' + index); assert.equal(state.residents[index].since, '2026-10');
    }
    await publicOpen(); assert.equal(await outsideCount(), 17);
    await publicPage.locator('#btnAnimals').click();
    const roster = await publicPage.locator('.roster').innerText();
    for (const [index, species] of newSpecies.entries()) { assert.match(roster, new RegExp('Updated ' + species)); assert.match(roster, new RegExp('New adopter ' + index)); assert.match(roster, new RegExp('New basic story ' + index)); }
    await publicPage.locator('.modal-close').click();
    console.log('[animals] All five new species accept published name, adopter, story and month edits');

    const id = state.residents[0].id;
    await action(id, 'Send indoors').click();
    assert.equal(state.residents[0].active, true, 'activity remains a draft until Save animal');
    assert.equal(await card(owner, id).locator('.owner-animal-badge').innerText(), 'Out on the farm', 'badge stays confirmed until the save succeeds');
    await action(id, 'Save animal').click(); await waitSettled(id); assert.equal(state.residents[0].active, false);
    await animalField(owner, id, 'note').fill('Still loved while sleeping indoors'); await action(id, 'Save animal').click(); await waitSettled(id);
    assert.equal(state.residents[0].active, false, 'saving an indoor animal does not accidentally let it outside');
    assert.equal(state.residents.length, 5, 'sleep keeps every approved resident record');
    await publicPage.bringToFront();
    await publicPage.waitForFunction(() => document.querySelectorAll('.actor:not(.keeper)').length === 16, undefined, { timeout:25000 });
    assert.equal(await outsideCount(), 16, 'an already-open farm removes an indoor animal on its next shared refresh');
    await action(id, 'Let outside').click(); await action(id, 'Save animal').click(); await waitSettled(id); await publicOpen(); assert.equal(await outsideCount(), 17);
    assert.equal(state.residents[0].note, 'Still loved while sleeping indoors');
    console.log('[animals] Approved animals sleep, remain editable and return without losing their records');

    await animalField(owner, id, 'name').fill('Network failure draft'); state.failure = 'network';
    await action(id, 'Save animal').click(); await waitSettled(id);
    assert.equal(await animalField(owner, id, 'name').inputValue(), 'Network failure draft'); assert.match(await status(id).innerText(), /interrupted|network|connection|try again/i);
    assert.notEqual(state.residents[0].name, 'Network failure draft'); state.failure = '';
    await action(id, 'Save animal').click(); await waitSettled(id); assert.equal(state.residents[0].name, 'Network failure draft');
    await animalField(owner, id, 'name').fill('Version conflict draft'); state.failure = 'conflict';
    await action(id, 'Save animal').click(); await waitSettled(id);
    assert.equal(await animalField(owner, id, 'name').inputValue(), 'Version conflict draft'); assert.match(await status(id).innerText(), /changed|conflict|another|draft/i);
    state.failure = ''; await refresh(); assert.equal(await animalField(owner, id, 'name').inputValue(), 'Version conflict draft', 'refresh preserves a conflicted draft');
    owner.once('dialog', dialog => dialog.accept()); await action(id, 'Cancel changes').click();
    assert.equal(await animalField(owner, id, 'name').inputValue(), 'Changed elsewhere');
    console.log('[animals] Network and stale-version failures preserve drafts; explicit cancel restores latest confirmed details');

    await animalField(owner, id, 'name').fill('Double click save'); const gate = deferred(); state.gate = gate;
    const beforeDouble = state.patches.length, sent = owner.waitForRequest(request => new URL(request.url()).pathname.endsWith('/residents/' + id) && request.method() === 'PATCH');
    await action(id, 'Save animal').evaluate(button => { button.click(); button.click(); }); await sent; await gate.enteredPromise;
    assert.equal(state.patches.length, beforeDouble + 1); assert.equal(await action(id, 'Save animal').isDisabled(), true);
    state.gate = null; gate.resolve(); await waitSettled(id); assert.equal(state.residents[0].name, 'Double click save');
    console.log('[animals] A repeated save while pending sends one request');

    await owner.setViewportSize({ width:390, height:844 }); await tab(); await expose(animalField(owner, id, 'name'));
    const widths = await owner.evaluate(() => ({ width:innerWidth, scroll:document.documentElement.scrollWidth }));
    assert.ok(widths.scroll <= widths.width + 1, 'animal editor does not overflow 390px: ' + JSON.stringify(widths));
    await card(owner, id).screenshot({ path:path.join(process.env.OWNER_QA_DIR || '/tmp', 'owner-animals-mobile.png') });
    await owner.setViewportSize({ width:1440, height:1000 });

    await animalField(owner, id, 'name').fill('Old session response'); const sessionGate = deferred(); state.gate = sessionGate;
    const oldSent = owner.waitForRequest(request => new URL(request.url()).pathname.endsWith('/residents/' + id) && request.method() === 'PATCH');
    await action(id, 'Save animal').click(); await oldSent; await sessionGate.enteredPromise;
    await owner.locator('#logoutButton').click(); await owner.locator('#loginPanel').waitFor({ state:'visible' });
    assert.equal(await owner.locator('#ownerAdoptionAnimals').isVisible(), false, 'logout hides resident details');
    await login(); await card(owner, id).waitFor({ state:'visible' }); await expose(animalField(owner, id, 'name'));
    await animalField(owner, id, 'name').fill('New session draft'); state.gate = null;
    const oldResponse = owner.waitForResponse(response => new URL(response.url()).pathname.endsWith('/residents/' + id) && response.request().method() === 'PATCH');
    sessionGate.resolve(); await oldResponse; await owner.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await animalField(owner, id, 'name').inputValue(), 'New session draft', 'a late save from a logged-out session cannot overwrite a new session draft');
    console.log('[animals] Late responses after logout cannot overwrite the new session; mobile layout stays within viewport');

    await animalField(owner, id, 'name').fill('Expiry protected draft'); state.failure = 'auth';
    await action(id, 'Save animal').click(); await owner.locator('#loginPanel').waitFor({ state:'visible' });
    assert.equal(await owner.locator('#ownerAdoptionAnimals').isVisible(), false, 'expired credentials hide approved animal details');
    assert.equal(await owner.locator('#hostPassword').inputValue(), '', 'expired credentials do not repopulate the login password');
    state.failure = ''; await login(); await card(owner, id).waitFor({ state:'visible' }); await expose(animalField(owner, id, 'name'));
    assert.equal(await animalField(owner, id, 'name').inputValue(), 'Expiry protected draft', 'automatic expiry retains animal edits through sign-in');
    assert.equal(await action(id, 'Save animal').isDisabled(), false);
    await action(id, 'Save animal').click(); await waitSettled(id); assert.equal(state.residents[0].name, 'Expiry protected draft');
    console.log('[animals] Automatic 401 expiry hides details and preserves the animal draft for successful publication after sign-in');
    assert.deepEqual(apiErrors, [], 'mock assertions all passed'); assert.deepEqual(errors, [], 'no uncaught browser errors');
    console.log(JSON.stringify({ ok:true, publications:state.saves.length, mutations:state.patches.length, species:newSpecies.length, browserErrors:errors.length, apiErrors:apiErrors.length }));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
