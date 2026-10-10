// Real-browser interaction against local files and an in-memory API; no service writes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/Users/cassini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
const field = (page, name) => page.locator('[data-owner-field="' + name + '"]');
const trigger = select => select.locator('..').getByRole('combobox');
async function main() {
  const errors = [], unexpected = [], saves = [], handling = [];
  let browser, revision = 0, content = {};
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/inbox.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
      response.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream' }); response.end(await fs.readFile(file));
    } catch (_) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const resident = { id:'ce031e53-83cf-4a2b-9c4a-c30a7e253ed4', name:'Clover', species:'rabbit', adoptedBy:'QA visitor', note:'A calm animal.', since:'2026-10', active:true, version:0, created_at:'2026-10-10T00:00:00Z' };
  const letter = { id:1, created_at:'2026-10-10T00:00:00Z', name:'A visitor', contact:'visitor@example.invalid', text:'A private question.', read_at:'2026-10-10T00:00:00Z', status:'new', host_note:'' };
  try {
    browser = await chromium.launch({ executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
    const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, hasTouch:true, reducedMotion:'reduce' });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method();
      if (url.origin === base) return route.continue();
      if (!url.pathname.startsWith('/api/')) return route.abort();
      const respond = (data, status=200) => route.fulfill({ status, contentType:'application/json', headers:{ 'Access-Control-Allow-Origin':base, 'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization' }, body:JSON.stringify(data) });
      if (method === 'OPTIONS') return respond({});
      if (url.pathname === '/api/host/login') return respond({ access_token:'qa-token', refresh_token:'qa-refresh', expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'host', email:'owner-qa@example.invalid' } });
      if (url.pathname === '/api/host/me') return respond({ id:'host', email:'owner-qa@example.invalid' });
      if (['/api/host/site-content', '/api/site-content'].includes(url.pathname)) {
        if (method === 'PUT') { const body = request.postDataJSON(); assert.equal(body.revision, revision); content = body.content; saves.push(body); revision++; }
        return respond({ ok:true, content, revision, updatedAt:revision ? '2026-10-10T01:00:00Z' : null });
      }
      if (url.pathname === '/api/host/messages') return respond([letter]);
      if (url.pathname === '/api/host/messages/1') { Object.assign(letter, request.postDataJSON()); handling.push(request.postDataJSON()); return respond([letter]); }
      if (url.pathname === '/api/host/farm/adoptions') return respond([]);
      if (url.pathname === '/api/host/farm/residents') return respond([resident]);
      if (url.pathname === '/api/host/farm/residents/' + resident.id) { Object.assign(resident, request.postDataJSON()); resident.version++; return respond(resident); }
      if (url.pathname === '/api/farm') return respond({ ok:true, trees:[], residents:[], maxTrees:8 });
      if (url.pathname === '/api/host/logout') return respond({ ok:true });
      unexpected.push(method + ' ' + url.pathname); return respond({ ok:false }, 404);
    });
    const tab = name => page.locator('[data-owner-tab="' + name + '"]').click();
    const menu = page.locator('.owner-select-menu');
    const expectClosed = async () => assert.equal(await menu.count(), 0);
    await page.goto(base + '/inbox.html');
    await page.locator('#hostEmail').fill('owner-qa@example.invalid'); await page.locator('#hostPassword').fill('local-qa-password'); await page.locator('#loginButton').click();
    await field(page, 'site.name').waitFor();
    await tab('animals');
    const species = field(page, 'farm.keeper.species'), keeper = trigger(species);
    assert.equal(await keeper.getAttribute('aria-label'), null); assert.ok(await keeper.getAttribute('aria-labelledby'));
    await keeper.click(); assert.equal(await keeper.getAttribute('aria-expanded'), 'true'); assert.equal(await menu.count(), 1);
    await keeper.click(); await expectClosed(); assert.equal(await keeper.getAttribute('aria-expanded'), 'false');
    await keeper.click(); await page.getByRole('option', { name:'Red panda', exact:true }).click(); await expectClosed(); assert.equal(await species.inputValue(), 'redpanda');
    await page.locator('#saveContentButton').click(); await page.waitForFunction(() => document.querySelector('#ownerSaveState').textContent === 'Published content', null, { timeout:5000 }).catch(async error => { console.error(await page.locator('#ownerEditorStatus').innerText(), await page.locator('#ownerContentForm :invalid').evaluateAll(nodes => nodes.map(node => ({ name:node.dataset.ownerField, value:node.value, validation:node.validationMessage })))); throw error; });
    assert.equal(saves.at(-1).content.farm.keeper.species, 'redpanda');
    await keeper.click(); await page.locator('.owner-group h3').filter({ hasText:'Farm keeper' }).click(); await expectClosed();
    await keeper.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('End');
    assert.equal(await keeper.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape'); await expectClosed(); assert.equal(await species.inputValue(), 'redpanda', 'Escape leaves the saved value unchanged');
    await page.keyboard.press('Space'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await species.inputValue(), 'rabbit'); await expectClosed();
    await keeper.press('f'); await page.keyboard.press('Enter'); assert.equal(await species.inputValue(), 'fox', 'typing finds a species');
    await keeper.click(); await page.keyboard.press('Tab'); await expectClosed();
    await keeper.click(); await tab('papers'); await expectClosed();
    console.log('[owner controls] Same-click, option click, outside, Escape, Tab, navigation, arrows and typeahead passed');

    // Existing native form automation and programmatic updates keep the visible value in sync.
    const paperType = page.locator('[data-owner-field$=".type"]').first();
    await paperType.selectOption('preprint'); assert.equal(await trigger(paperType).innerText(), 'preprint');
    await page.locator('[data-owner-panel="papers"] > .owner-group > .owner-add').click();
    const newType = page.locator('[data-owner-field$=".type"]').last();
    await trigger(newType).click(); await page.getByRole('option', { name:'publication', exact:true }).click();
    assert.equal(await newType.inputValue(), 'publication');
    await tab('animals');
    const animalSelect = page.locator('[data-resident-id="' + resident.id + '"] select');
    await trigger(animalSelect).click(); await page.getByRole('option', { name:'Wolf', exact:true }).click();
    await page.locator('[data-resident-id="' + resident.id + '"]').getByRole('button', { name:'Save animal', exact:true }).click();
    await page.waitForFunction(() => document.querySelector('[data-resident-id] .owner-animal-status')?.textContent === 'Published animal information.');
    assert.equal(resident.species, 'wolf');
    await tab('letters');
    const letterSelect = page.locator('.letter-management select');
    await trigger(letterSelect).click(); await page.getByRole('option', { name:'Handled', exact:true }).click();
    await page.getByRole('button', { name:'Save handling', exact:true }).click();
    await page.waitForFunction(() => document.querySelector('.letter-management select')?.value === 'done');
    assert.equal(handling.at(-1).status, 'done');
    await trigger(page.locator('#adoptionFilter')).click(); await page.getByRole('option', { name:'Approved residents', exact:true }).click(); assert.equal(await page.locator('#adoptionFilter').inputValue(), 'approved');
    console.log('[owner controls] Dynamic paper and adoption controls, native select compatibility, animal and request saving passed');

    await tab('home');
    await field(page, 'home.avatar').locator('..').locator('..').locator('input[type="file"]').setInputFiles(path.join(root, 'assets/avatar.jpg'));
    await page.locator('#ownerImageCropDialog').waitFor();
    const ratio = page.locator('#ownerCropRatio'), ratioTrigger = trigger(ratio);
    await ratioTrigger.click(); await ratioTrigger.click(); await expectClosed();
    await ratioTrigger.click(); await page.keyboard.press('Escape'); await expectClosed(); assert.equal(await page.locator('#ownerImageCropDialog').isVisible(), true, 'Escape closes options before the crop dialog');
    await ratioTrigger.click(); await page.getByRole('option', { name:'Custom', exact:true }).click();
    assert.equal(await page.locator('#ownerCropRatioWidth').isVisible(), true);
    await page.locator('#ownerCropCancel').click();
    await page.setViewportSize({ width:390, height:844 }); await tab('animals');
    const mobileKeeper = trigger(field(page, 'farm.keeper.species'));
    await mobileKeeper.tap();
    const bounds = await menu.evaluate(menu => { const box = menu.getBoundingClientRect(); return { left:box.left, right:box.right, top:box.top, bottom:box.bottom, viewport:innerWidth, height:innerHeight, pageWidth:document.documentElement.scrollWidth }; });
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewport + 1 && bounds.top >= 0 && bounds.bottom <= bounds.height + 1, JSON.stringify(bounds));
    assert.ok(bounds.pageWidth <= bounds.viewport + 1, JSON.stringify(bounds));
    await page.screenshot({ path:path.join(process.env.OWNER_QA_DIR || '/tmp', 'owner-controls-mobile.png'), fullPage:false });
    await mobileKeeper.tap(); await expectClosed();
    await page.setViewportSize({ width:1440, height:1000 }); await tab('profile');
    const appearance = await field(page, 'site.name').evaluate(input => { const style = getComputedStyle(input); return { borderRadius:style.borderRadius, fontSize:style.fontSize, background:style.backgroundColor }; });
    assert.equal(appearance.borderRadius, '10px'); assert.ok(parseFloat(appearance.fontSize) >= 15); assert.match(appearance.background, /^rgba\(255, 255, 255, 0\.02[45]\)$/);
    await page.screenshot({ path:path.join(process.env.OWNER_QA_DIR || '/tmp', 'owner-controls-desktop.png'), fullPage:false });
    await page.locator('#logoutButton').click(); await page.locator('#loginPanel').waitFor();
    await page.locator('#hostEmail').fill('owner-qa@example.invalid'); await page.locator('#hostPassword').fill('local-qa-password'); await page.locator('#loginButton').click();
    await field(page, 'site.name').waitFor(); await tab('letters');
    assert.equal(await page.locator('#adoptionFilter').inputValue(), 'pending');
    assert.equal(await trigger(page.locator('#adoptionFilter')).innerText(), 'Waiting for review', 'session reset also updates the visible filter');
    await trigger(page.locator('.letter-management select')).focus();
    await page.locator('#refreshButton').evaluate(button => button.click());
    await page.waitForFunction(() => document.activeElement?.classList.contains('owner-select-trigger') && !document.querySelector('#refreshButton').disabled);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.handlingField), 'status', 'letter refresh restores the visible select focus');
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log('[owner controls] Crop modal, mobile layout, shared Message field styling and no browser errors passed');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
