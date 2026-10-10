// HOME_PREVIEW_URL=http://127.0.0.1:4174 node tests/home-mobile-viewport-runtime.cjs
// Height-only viewport changes exercise browsers whose lvh moves with toolbars.
// A second case fixes lvh/vh to emulate browsers whose large viewport stays stable.
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const base = process.env.HOME_PREVIEW_URL || 'http://127.0.0.1:4174';
const out = '/tmp/home-mobile-viewport-qa';
const ids = ['saturn', 'fx', 'rings', 'starFall'];
const instrument = `
  window.__homeViewport = () => {
    const f = burnFlight(FINAL_ENTRY), [x, y] = P(f.x, f.y);
    return { vw, vh, dpr, pTarget, frame: { ...F }, anchor: { x, y } };
  };
`;

async function installHooks(page, fixedLargeViewport = false) {
  await page.addInitScript(ids => {
    window.__canvasDimensionWrites = {};
    for (const dimension of ['width', 'height']) {
      const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension);
      Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
        ...original,
        set(value) {
          if (ids.includes(this.id)) {
            const key = this.id + '.' + dimension;
            __canvasDimensionWrites[key] = (__canvasDimensionWrites[key] || 0) + 1;
          }
          original.set.call(this, value);
        }
      });
    }
  }, ids);
  await page.route('**/js/saturn.js*', async route => {
    const source = await fs.readFile(new URL('../js/saturn.js', `file://${__filename}`), 'utf8');
    const end = source.lastIndexOf('})();');
    assert.ok(end > 0, 'instrument the production renderer');
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: source.slice(0, end) + instrument + source.slice(end) });
  });
  if (fixedLargeViewport) await page.route('**/css/home.css*', async route => {
    const source = await fs.readFile(new URL('../css/home.css', `file://${__filename}`), 'utf8');
    assert.ok(source.includes('100lvh'), 'the phone painting uses the large viewport');
    // Real phone toolbar motion changes dvh, while both lvh and vh stay fixed.
    const body = source.replace(/100lvh/g, '844px').replace(/106lvh/g, '894.64px').replace(/-3lvh/g, '-25.32px') +
      '\nbody[data-page="home"] .story { height: 2363.2px !important; }\n';
    await route.fulfill({ status: 200, contentType: 'text/css', body });
  });
}

async function ready(page) {
  await page.waitForFunction(() => window.__homeViewport && document.querySelector('#heroLand').width === 1672);
  await page.evaluate(async () => { await document.fonts.ready; scrollTo({ top: 300, behavior: 'instant' }); });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => scrollY), 300, 'resize exercises a running story');
}

async function startSamples(page) {
  await page.evaluate(ids => {
    window.__viewportSamples = [];
    window.__viewportSampling = true;
    const generation = window.__viewportGeneration = (window.__viewportGeneration || 0) + 1;
    window.__viewportSnapshot = () => ({
      ...__homeViewport(), innerHeight, scroll: scrollY,
      hero: document.querySelector('.hero').getBoundingClientRect().toJSON(),
      land: document.querySelector('#heroLand').getBoundingClientRect().toJSON(),
      cosmosHeight: getComputedStyle(document.querySelector('.hero-cosmos')).height,
      writes: { ...__canvasDimensionWrites },
      canvases: ids.map(id => {
        const el = document.getElementById(id), r = el.getBoundingClientRect();
        return { id, width: el.width, height: el.height, cssWidth: r.width, cssHeight: r.height };
      })
    });
    const tick = () => {
      if (!__viewportSampling || generation !== __viewportGeneration) return;
      __viewportSamples.push(__viewportSnapshot());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ids);
}

async function resizeSamples(page, width, height) {
  await startSamples(page);
  await page.setViewportSize({ width, height });
  await page.waitForFunction(() => __viewportSamples.length >= 24);
  return page.evaluate(() => { __viewportSampling = false; return __viewportSamples; });
}

function assertCovered(samples, label) {
  for (const [index, s] of samples.entries()) {
    assert.equal(Math.round(s.hero.height), s.innerHeight, `${label} frame ${index}: hero tracks visible height`);
    assert.ok(s.land.left <= s.hero.left + 1 && s.land.right >= s.hero.right - 1, `${label} frame ${index}: painting covers both sides`);
    assert.ok(s.land.bottom >= s.hero.bottom - 1, `${label} frame ${index}: painting covers the bottom without waiting for resize debounce`);
    for (const c of s.canvases) {
      assert.equal(c.width, Math.round(c.cssWidth * s.dpr), `${label} frame ${index}: ${c.id} bitmap width matches its drawing surface`);
      assert.equal(c.height, Math.round(c.cssHeight * s.dpr), `${label} frame ${index}: ${c.id} bitmap height matches its drawing surface`);
    }
  }
}

function assertSceneStable(samples, initial, label, stableProgress = false) {
  for (const [index, s] of samples.entries()) {
    const frame = `${label} frame ${index}`;
    assert.deepEqual(s.frame, initial.frame, `${frame}: toolbar motion preserves the painting frame`);
    assert.deepEqual(s.anchor, initial.anchor, `${frame}: toolbar motion preserves the final burn anchor`);
    assert.equal(s.vh, initial.vh, `${frame}: toolbar motion preserves the drawing height`);
    assert.equal(s.land.width, initial.land.width, `${frame}: toolbar motion never zooms the landscape width`);
    assert.equal(s.land.height, initial.land.height, `${frame}: toolbar motion never zooms the landscape height`);
    assert.deepEqual(s.canvases, initial.canvases, `${frame}: every canvas keeps its CSS and bitmap dimensions`);
    assert.deepEqual(s.writes, initial.writes, `${frame}: toolbar motion never resets unchanged canvas bitmaps`);
    assert.equal(s.cosmosHeight, initial.cosmosHeight, `${frame}: toolbar motion preserves the galaxy surface`);
    if (stableProgress) assert.equal(s.pTarget, initial.pTarget, `${frame}: toolbar motion preserves story progress`);
  }
}

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const errors = [], results = {};
  try {
    const phone = await browser.newPage({ viewport: { width: 390, height: 700 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    phone.on('pageerror', e => errors.push(e.message));
    // Playwright keeps the configured physical screen when only viewport dimensions change.
    // Mirror a real orientation event when the subsequent width change rotates the phone.
    await phone.addInitScript(() => {
      window.__screenOrientationType = 'portrait-primary';
      Object.defineProperty(screen.orientation, 'type', { configurable: true, get: () => __screenOrientationType });
      Object.defineProperty(screen.orientation, 'angle', { configurable: true, get: () => __screenOrientationType.startsWith('landscape') ? 90 : 0 });
    });
    await installHooks(phone); await phone.goto(base + '/index.html'); await ready(phone);
    await phone.screenshot({ path: out + '/phone-visible-700.png' });
    await startSamples(phone);
    const initialPhone = await phone.evaluate(() => { __viewportSampling = false; return __viewportSnapshot(); });
    assert.equal(initialPhone.vh, 844, 'physical screen height prepares the full picture before the toolbar first retracts');
    for (const height of [844, 700, 844]) {
      const samples = await resizeSamples(phone, 390, height);
      assertCovered(samples, `moving lvh toolbar ${height}`);
      assertSceneStable(samples, initialPhone, `moving lvh toolbar ${height}`);
      results[`toolbar-${height}`] = { frames: samples.length, maxBottomGap: Math.max(...samples.map(s => s.hero.bottom - s.land.bottom)) };
    }
    await phone.screenshot({ path: out + '/phone-moving-lvh-visible-844.png' });
    await phone.evaluate(() => { __screenOrientationType = 'landscape-primary'; });
    const rotated = await resizeSamples(phone, 844, 390);
    assertCovered(rotated, 'phone orientation 844x390');
    assert.equal(rotated.at(-1).vw, 844, 'orientation recomputes drawing width');
    assert.equal(rotated.at(-1).vh, 390, 'orientation recomputes drawing height');
    assert.notDeepEqual(rotated.at(-1).writes, initialPhone.writes, 'orientation rebuilds the canvas bitmaps');
    results['844x390'] = { frames: rotated.length, maxBottomGap: Math.max(...rotated.map(s => s.hero.bottom - s.land.bottom)) };
    await phone.close();

    const toolbar = await browser.newPage({ viewport: { width: 390, height: 700 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    toolbar.on('pageerror', e => errors.push(e.message));
    await installHooks(toolbar, true); await toolbar.goto(base + '/index.html');
    await toolbar.waitForFunction(() => window.__homeViewport && document.querySelector('#heroLand').width === 1672);
    await toolbar.waitForTimeout(1400);
    await toolbar.screenshot({ path: out + '/phone-opening-visible-700-large-844.png' });
    await ready(toolbar);
    await startSamples(toolbar);
    const initial = await toolbar.evaluate(() => { __viewportSampling = false; return __viewportSnapshot(); });
    assert.equal(initial.vh, 844, 'the initial visible 700px viewport already paints the full 844px large viewport');
    await toolbar.screenshot({ path: out + '/phone-visible-700-large-844.png' });
    for (const height of [844, 700, 844]) {
      const samples = await resizeSamples(toolbar, 390, height);
      assertCovered(samples, `toolbar ${height}`);
      assertSceneStable(samples, initial, `fixed lvh toolbar ${height}`, true);
    }
    await toolbar.screenshot({ path: out + '/phone-visible-844-large-844.png' });
    await toolbar.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    desktop.on('pageerror', e => errors.push(e.message));
    await installHooks(desktop); await desktop.goto(base + '/index.html'); await ready(desktop);
    assertCovered(await resizeSamples(desktop, 1024, 768), 'desktop resize');
    await desktop.close();
    assert.deepEqual(errors, [], 'no runtime errors');
    console.log(JSON.stringify({ passed: true, phone: results, movingLvhToolbarStable: true, fixedLvhToolbarStable: true, canvasResetsAvoided: true, desktopFirstFrame: true, screenshots: out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
