// Browser image crop/upload integration against an in-memory API.
// Every service request is mocked; no production login, upload or publication occurs.
// node tests/owner-images-runtime.cjs
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
const imageTools = (page, name) => field(page, name).locator('..').locator('..').locator(':scope > .owner-image-tools');
const dialog = page => page.locator('#ownerImageCropDialog');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

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
  const state = { revision:0, content:{}, saves:[], uploads:[], uploadMode:'success', media:new Map(), gate:null };
  const errors = [], apiErrors = [];
  const envelope = () => ({ ok:true, revision:state.revision, updatedAt:state.revision ? '2026-10-10T01:00:00Z' : null, content:copy(state.content) });
  let browser;
  try {
    browser = await chromium.launch({ executablePath:chrome, headless:true });
    const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, reducedMotion:'reduce' });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const fixture = await context.newPage();
    await fixture.goto('about:blank');
    const source = Buffer.from(await fixture.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
      const context = canvas.getContext('2d');
      for (const [color, x, y] of [['#e21b2f',0,0], ['#1f63db',600,0], ['#20b86a',0,400], ['#fec841',600,400]]) { context.fillStyle = color; context.fillRect(x, y, 600, 400); }
      context.strokeStyle = '#ffffff'; context.lineWidth = 2;
      context.strokeRect(10, 10, 1180, 780);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const decodeImage = (bytes, mime) => fixture.evaluate(async ({ bytes, mime }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type:mime }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
      const pixel = Array.from(context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data);
      const result = { width:bitmap.width, height:bitmap.height, pixel }; bitmap.close(); return result;
    }, { bytes:Array.from(bytes), mime });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === base) return route.continue();
      if (!url.pathname.startsWith('/api/')) return route.abort();
      const method = request.method(), pathname = url.pathname;
      const headers = { 'Access-Control-Allow-Origin':base, 'Access-Control-Allow-Methods':'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Farm-Token' };
      const respond = (data, status=200) => route.fulfill({ status, contentType:'application/json', headers, body:JSON.stringify(data) });
      try {
        if (method === 'OPTIONS') return respond({});
        if (pathname.startsWith('/api/media/')) {
          const stored = state.media.get(pathname.split('/').at(-1)); assert.ok(stored, 'public image URL refers to a completed mock upload');
          return route.fulfill({ status:200, contentType:stored.mime, headers, body:stored.bytes });
        }
        if (pathname === '/api/site-content') return respond(envelope());
        if (pathname === '/api/host/login') {
          assert.deepEqual(request.postDataJSON(), { email:'owner-images-qa@example.invalid', password:'local-image-qa-password' });
          return respond({ access_token:'qa-image-token', refresh_token:'qa-image-refresh', expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'host', email:'owner-images-qa@example.invalid' } });
        }
        if (pathname.startsWith('/api/host/')) assert.equal(request.headers().authorization, 'Bearer qa-image-token');
        if (pathname === '/api/host/me') return respond({ id:'host', email:'owner-images-qa@example.invalid' });
        if (pathname === '/api/host/site-content') {
          if (method === 'GET') return respond(envelope());
          assert.equal(method, 'PUT'); const body = request.postDataJSON(); assert.equal(body.revision, state.revision);
          validateSiteContent(body.content); state.content = copy(body.content); state.revision++; state.saves.push(copy(body)); return respond(envelope());
        }
        if (pathname === '/api/host/media') {
          assert.equal(method, 'POST');
          const mime = request.headers()['content-type']; assert.ok(['image/jpeg', 'image/png', 'image/webp'].includes(mime), 'upload uses a binary image body');
          const bytes = request.postDataBuffer(); assert.ok(bytes?.length > 0); assert.ok(bytes.length <= 1024 * 1024);
          const decoded = await decodeImage(bytes, mime); assert.ok(decoded.width <= 2048 && decoded.height <= 2048);
          const id = 'f19c1705-511c-4fbd-814c-' + String(state.uploads.length + 1).padStart(12, '0');
          const uploaded = { ...decoded, id, mime, bytes, url:url.origin + '/api/media/' + id }; state.uploads.push(uploaded);
          const mode = state.uploadMode, gate = state.gate; if (gate) await gate;
          if (mode === 'network') return route.abort();
          if (mode === 'failure') return respond({ ok:false, code:'media_capacity', message:'Image storage is full. Your original image has not changed.' }, 409);
          state.media.set(id, uploaded);
          return respond({ ok:true, id, url:uploaded.url, width:decoded.width, height:decoded.height, mime, bytes:bytes.length, deduplicated:false });
        }
        if (pathname === '/api/host/messages' || pathname === '/api/host/farm/adoptions' || pathname === '/api/host/farm/residents') return respond([]);
        if (pathname === '/api/farm') return respond({ ok:true, maxTrees:8, trees:[], residents:[] });
        if (pathname === '/api/host/logout') return respond({ ok:true });
        throw Error('Unexpected mocked API request: ' + method + ' ' + pathname);
      } catch (error) { apiErrors.push(error.message); return respond({ ok:false, code:'test_failure', message:error.message }, 500); }
    });
    const owner = await context.newPage();
    const tab = async name => owner.locator('[data-owner-tab="' + name + '"]').click();
    const login = async () => {
      await owner.locator('#loginPanel').waitFor({ state:'visible' });
      await owner.locator('#hostEmail').fill('owner-images-qa@example.invalid'); await owner.locator('#hostPassword').fill('local-image-qa-password'); await owner.locator('#loginButton').click();
      await owner.locator('#inboxPanel').waitFor({ state:'visible' }); await field(owner, 'site.name').waitFor({ state:'attached' });
    };
    const range = async (selector, value) => {
      await owner.locator(selector).evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles:true })); }, value);
      assert.equal(Number(await owner.locator(selector).inputValue()), value);
    };
    const choose = async (name, fixtureOverride={}) => {
      const tools = imageTools(owner, name); assert.equal(await tools.locator('.owner-image-upload').count(), 1, name + ' has image upload controls');
      await tools.locator('.owner-image-file').setInputFiles({ name:'quadrants.png', mimeType:'image/png', buffer:source, ...fixtureOverride });
    };
    const cropReady = async () => { await dialog(owner).waitFor({ state:'visible' }); await owner.waitForFunction(() => { const canvas = document.querySelector('#ownerCropCanvas'); return canvas?.width > 0 && !document.querySelector('#ownerCropUpload').disabled; }); };
    const upload = async () => {
      const before = state.uploads.length; await owner.locator('#ownerCropUpload').click(); await dialog(owner).waitFor({ state:'hidden' });
      assert.equal(state.uploads.length, before + 1); return state.uploads.at(-1);
    };
    const save = async () => {
      const before = state.revision; await owner.locator('#saveContentButton').click();
      await owner.waitForFunction(() => document.querySelector('#ownerSaveState').textContent === 'Published content'); assert.equal(state.revision, before + 1);
    };
    await owner.goto(base + '/inbox.html'); await login(); await tab('home');
    const originalAvatar = await field(owner, 'home.avatar').inputValue(); assert.equal(originalAvatar, defaults.home.avatar);
    await choose('home.avatar'); await cropReady();
    assert.equal(Number(await owner.locator('#ownerCropRatio').inputValue()), 0.75, 'portrait opens at the target 3:4 aspect ratio');
    assert.equal(await field(owner, 'home.avatar').inputValue(), originalAvatar, 'selecting a file keeps the original image URL');
    await fs.mkdir(output, { recursive:true }); await owner.screenshot({ path:path.join(output, 'owner-image-crop-desktop.png') });
    let releasePortrait; state.gate = new Promise(resolve => { releasePortrait = resolve; });
    const portraitSent = owner.waitForRequest(request => new URL(request.url()).pathname === '/api/host/media' && request.method() === 'POST');
    await owner.locator('#ownerCropUpload').click(); await portraitSent;
    assert.equal(await field(owner, 'home.avatar').inputValue(), originalAvatar, 'pending upload cannot change the draft image URL');
    assert.equal(await owner.locator('#ownerCropUpload').isDisabled(), true, 'pending upload cannot be submitted again');
    state.gate = null; releasePortrait(); await dialog(owner).waitFor({ state:'hidden' });
    const portrait = state.uploads.at(-1); assert.deepEqual([portrait.width, portrait.height], [600,800], 'default portrait crop preserves source resolution without stretching');
    assert.equal(await field(owner, 'home.avatar').inputValue(), portrait.url); assert.equal(state.revision, 0); assert.equal(state.saves.length, 0);
    assert.equal(await owner.locator('#ownerSaveState').innerText(), 'Unpublished changes', 'uploaded image remains a draft until the owner publishes');
    await save(); assert.equal(state.content.home.avatar, portrait.url);
    const publicHome = await context.newPage(); await publicHome.goto(base + '/index.html'); await publicHome.evaluate(() => SiteContent.started); await publicHome.locator('.bio-portrait img').scrollIntoViewIfNeeded();
    await publicHome.waitForFunction(() => { const portrait = document.querySelector('.bio-portrait img'); return portrait?.complete && portrait.naturalWidth > 0; });
    assert.equal(await publicHome.locator('.bio-portrait img').getAttribute('src'), portrait.url);
    assert.deepEqual(await publicHome.locator('.bio-portrait img').evaluate(image => [image.naturalWidth, image.naturalHeight]), [600,800]); await publicHome.close();
    console.log('[owner images] Default 3:4 portrait uploads a 600 × 800 crop; confirmed URL requires explicit publication');

    await choose('home.avatar'); await cropReady(); await range('#ownerCropZoom', 2); await range('#ownerCropX', 100); await range('#ownerCropY', 100);
    const moved = await upload(); assert.ok(Math.abs(moved.width / moved.height - 0.75) < 0.01); assert.ok(moved.width < portrait.width && moved.height < portrait.height, 'zoom crops a smaller source area');
    assert.ok(moved.pixel.slice(0,3).every((channel,index) => Math.abs(channel - [254,200,65][index]) < 12), 'zoom and movement choose the gold lower-right source region: ' + moved.pixel);
    console.log('[owner images] Zoom and both movement controls preserve ratio and select the intended source region');

    await choose('home.avatar'); await cropReady(); await owner.locator('#ownerCropRatio').selectOption('custom');
    await owner.locator('#ownerCropRatioWidth').fill('0'); await owner.locator('#ownerCropRatioHeight').fill('2');
    assert.equal(await owner.locator('#ownerCropUpload').isDisabled(), true, 'invalid custom dimensions cannot upload');
    await owner.locator('#ownerCropRatioWidth').fill('5');
    const custom = await upload(); assert.ok(Math.abs(custom.width / custom.height - 2.5) < 0.01); assert.ok(custom.width <= 1200 && custom.height <= 800);
    console.log('[owner images] Custom 5:2 crop uploads proportional dimensions without upscaling');

    const avatarBeforeCancel = await field(owner, 'home.avatar').inputValue(), uploadsBeforeCancel = state.uploads.length;
    await choose('home.avatar'); await cropReady(); await owner.locator('#ownerCropCancel').click(); await dialog(owner).waitFor({ state:'hidden' });
    assert.equal(await field(owner, 'home.avatar').inputValue(), avatarBeforeCancel); assert.equal(state.uploads.length, uploadsBeforeCancel);
    console.log('[owner images] Cancelling a crop preserves the current image and makes no upload');

    state.uploadMode = 'failure'; await choose('home.avatar'); await cropReady(); await owner.locator('#ownerCropUpload').click();
    await owner.waitForFunction(() => /full|capacity|storage/i.test(document.querySelector('#ownerCropStatus').textContent));
    assert.equal(await dialog(owner).isVisible(), true); assert.equal(await field(owner, 'home.avatar').inputValue(), avatarBeforeCancel);
    assert.equal(await owner.locator('#ownerSaveState').innerText(), 'Unpublished changes'); assert.equal(await owner.locator('#ownerCropUpload').isDisabled(), false);
    await owner.locator('#ownerCropCancel').click();
    state.uploadMode = 'network'; await choose('home.avatar'); await cropReady(); await owner.locator('#ownerCropUpload').click();
    await owner.waitForFunction(() => /interrupted|network|failed|try again/i.test(document.querySelector('#ownerCropStatus').textContent));
    assert.equal(await dialog(owner).isVisible(), true); assert.equal(await field(owner, 'home.avatar').inputValue(), avatarBeforeCancel);
    await owner.locator('#ownerCropCancel').click(); state.uploadMode = 'success';
    console.log('[owner images] Upload failure preserves both the original URL and unrelated unpublished changes');

    await tab('gallery'); const photoPath = 'gallery.0.photos.0.src';
    await field(owner, photoPath).evaluate(input => { for (let parent = input.closest('details'); parent; parent = parent.parentElement.closest('details')) parent.open = true; });
    await choose(photoPath); await cropReady(); assert.equal(await owner.locator('#ownerCropRatio').inputValue(), 'original', 'gallery images start at their original ratio');
    const gallery = await upload(); assert.deepEqual([gallery.width, gallery.height], [1200,800]); assert.equal(await field(owner, photoPath).inputValue(), gallery.url);
    await save(); assert.equal(state.content.gallery[0].photos[0].src, gallery.url);
    console.log('[owner images] Gallery defaults to the original dimensions and publishes the uploaded URL');

    await tab('papers'); await choose('papers.0.image'); await cropReady();
    assert.ok(Math.abs(Number(await owner.locator('#ownerCropRatio').inputValue()) - 4 / 3) < 0.001, 'paper card cover opens at 4:3');
    const cover = await upload(); assert.ok(Math.abs(cover.width / cover.height - 4 / 3) < 0.01); assert.equal(await field(owner, 'papers.0.image').inputValue(), cover.url);
    console.log('[owner images] Paper cover starts at the public card target ratio of 4:3');
    const firstPaper = field(owner, 'papers.0.title').locator('..').locator('..');
    await firstPaper.locator('.owner-group > .owner-add').click(); await choose('papers.0.figures.0.src'); await cropReady();
    assert.equal(await owner.locator('#ownerCropRatio').inputValue(), 'original', 'scientific figures start at the original ratio');
    const figure = await upload(); assert.deepEqual([figure.width, figure.height], [1200,800]); await save();
    assert.equal(state.content.papers[0].figures[0].src, figure.url);
    console.log('[owner images] Additional scientific figures preserve original ratio and publish their uploaded URL');


    await tab('home'); const beforeInvalid = await field(owner, 'home.avatar').inputValue(), uploadsBeforeInvalid = state.uploads.length;
    await choose('home.avatar', { name:'script.svg', mimeType:'image/svg+xml', buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>') });
    await delay(100); assert.equal(await dialog(owner).isVisible(), false, 'unsupported SVG cannot enter the cropper'); assert.equal(state.uploads.length, uploadsBeforeInvalid); assert.equal(await field(owner, 'home.avatar').inputValue(), beforeInvalid);
    await choose('home.avatar', { name:'oversized.png', mimeType:'image/png', buffer:Buffer.alloc(21 * 1024 * 1024) });
    await delay(100); assert.equal(await dialog(owner).isVisible(), false, 'oversized source files cannot enter the cropper'); assert.equal(state.uploads.length, uploadsBeforeInvalid); assert.equal(await field(owner, 'home.avatar').inputValue(), beforeInvalid);
    console.log('[owner images] Unsupported and oversized source files never upload or change the image URL');
    const oversizedHeader = Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(oversizedHeader); oversizedHeader.writeUInt32BE(13,8); oversizedHeader.write('IHDR',12); oversizedHeader.writeUInt32BE(10000,16); oversizedHeader.writeUInt32BE(10000,20); oversizedHeader[24] = 8; oversizedHeader[25] = 6;
    await owner.evaluate(() => { window.__qaImageDecodeCalls = 0; window.__qaOriginalImageBitmap = window.createImageBitmap; window.createImageBitmap = (...args) => { window.__qaImageDecodeCalls++; return window.__qaOriginalImageBitmap(...args); }; });
    await choose('home.avatar', { name:'100-megapixel-header.png', mimeType:'image/png', buffer:oversizedHeader });
    await dialog(owner).waitFor({ state:'visible' }); await owner.waitForFunction(() => /32 megapixels/.test(document.querySelector('#ownerCropStatus').textContent));
    assert.equal(await owner.evaluate(() => window.__qaImageDecodeCalls), 0, 'oversized PNG dimensions are rejected before allocating a decoded bitmap');
    assert.equal(await owner.locator('#ownerCropUpload').isDisabled(), true); assert.equal(state.uploads.length, uploadsBeforeInvalid); assert.equal(await field(owner, 'home.avatar').inputValue(), beforeInvalid);
    await owner.locator('#ownerCropCancel').click(); await owner.evaluate(() => { window.createImageBitmap = window.__qaOriginalImageBitmap; delete window.__qaOriginalImageBitmap; delete window.__qaImageDecodeCalls; });
    console.log('[owner images] 100-megapixel PNG header is rejected before bitmap decoding or uploading');


    await owner.setViewportSize({ width:390, height:844 }); await choose('home.avatar'); await cropReady();
    const mobile = await owner.evaluate(() => { const dialog = document.querySelector('#ownerImageCropDialog'), bounds = dialog.getBoundingClientRect(); return { viewport:innerWidth, pageWidth:document.documentElement.scrollWidth, left:bounds.left, right:bounds.right, clientWidth:dialog.clientWidth, scrollWidth:dialog.scrollWidth }; });
    assert.ok(mobile.pageWidth <= mobile.viewport + 1, 'mobile page does not overflow: ' + JSON.stringify(mobile)); assert.ok(mobile.left >= -1 && mobile.right <= mobile.viewport + 1, 'mobile crop dialog fits the viewport: ' + JSON.stringify(mobile)); assert.ok(mobile.scrollWidth <= mobile.clientWidth + 1, 'mobile dialog content does not overflow: ' + JSON.stringify(mobile));
    await owner.screenshot({ path:path.join(output, 'owner-image-crop-mobile.png') }); await owner.locator('#ownerCropCancel').click();
    console.log('[owner images] 390 × 844 crop dialog and controls fit without horizontal overflow');

    await field(owner, 'home.heroLede').fill('An unrelated draft retained after session expiry'); const staleImage = await field(owner, 'home.avatar').inputValue();
    let release; state.gate = new Promise(resolve => { release = resolve; });
    await choose('home.avatar'); await cropReady(); const sent = owner.waitForRequest(request => new URL(request.url()).pathname === '/api/host/media' && request.method() === 'POST');
    await owner.locator('#ownerCropUpload').click(); await sent;
    await owner.evaluate(() => dispatchEvent(new CustomEvent('host-auth-expired'))); await owner.locator('#loginPanel').waitFor({ state:'visible' });
    assert.equal(await dialog(owner).isVisible(), false, 'session expiry immediately closes the private upload UI');
    await login(); await tab('home'); assert.equal(await field(owner, 'home.heroLede').inputValue(), 'An unrelated draft retained after session expiry');
    state.gate = null; release(); await delay(200);
    assert.equal(await field(owner, 'home.avatar').inputValue(), staleImage, 'a response from an expired host session cannot replace the draft image');
    assert.equal(await owner.locator('#ownerSaveState').innerText(), 'Unpublished changes');
    console.log('[owner images] Expired-session upload responses cannot modify the restored draft');
    assert.deepEqual(apiErrors, []); assert.deepEqual(errors, []);
    console.log('[owner images] Completed ' + state.uploads.length + ' mocked uploads and ' + state.saves.length + ' publications; no production writes. Screenshots: ' + path.join(output, 'owner-image-crop-desktop.png') + ', ' + path.join(output, 'owner-image-crop-mobile.png'));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
