// Run against the local static preview with the bundled Playwright runtime.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.VOYAGER_PREVIEW_URL || 'http://127.0.0.1:4174';
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const errors = [], results = [];
  try {
    for (const [width, height, fallback, reduced] of [[320, 700, false, false], [390, 844, true, false], [1440, 960, false, false], [390, 844, false, true]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/site-content', route => route.abort());
      if (fallback) await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === 'webgl' ? null : original.call(this, kind, ...args); };
      });
      await page.goto(base + '/voyager.html#saturn');
      await page.waitForFunction(() => window.CassiniArt && document.querySelector('#voyagerFigure').dataset.scene === 'saturn');
      await page.evaluate(() => {
        const original = CassiniArt.draw;
        CassiniArt.draw = function (ctx, x, y, scale, angle) {
          window.__craftMotion = { x, y, scale, angle };
          (window.__craftTrail ||= []).push({ x, y });
          return original.call(this, ctx, x, y, scale, angle);
        };
      });
      if (reduced) {
        assert.ok(await page.locator('#vMotion').isDisabled());
        const frame = await page.locator('#voyagerFigure').getAttribute('data-frame');
        await page.waitForTimeout(350);
        assert.equal(await page.locator('#voyagerFigure').getAttribute('data-frame'), frame);
      } else {
        await page.waitForTimeout(400);
        const first = await page.evaluate(() => { __craftTrail = []; return __craftMotion; });
        await page.waitForTimeout(2500);
        const last = await page.evaluate(() => __craftMotion);
        const trail = await page.evaluate(() => __craftTrail);
        const travel = Math.max(...trail.map(p => p.x)) - Math.min(...trail.map(p => p.x));
        assert.ok(travel > 0, 'Cassini moves independently of mouse or touch input');
        if (width < 700) {
          assert.ok(travel > 15, 'phone motion is clearly visible even when the flight changes direction');
          const scene = await page.locator('#voyagerScene').boundingBox();
          for (const pose of trail) {
            assert.ok(pose.x >= scene.width * .595 && pose.x <= scene.width * .785, 'flight retains its original horizontal range');
            assert.ok(pose.y >= scene.height * .325 && pose.y <= scene.height * .375, 'flight retains the original scene height instead of following text or controls');
          }
        }
        await page.locator('#vMotion').click(); await page.waitForTimeout(150);
        const paused = await page.evaluate(() => __craftMotion);
        await page.waitForTimeout(250);
        assert.deepEqual(await page.evaluate(() => __craftMotion), paused, 'pause freezes the actual spacecraft pose');
        await page.locator('#vMotion').click(); await page.waitForTimeout(300);
        assert.notDeepEqual(await page.evaluate(() => __craftMotion), paused, 'resume restarts flight');
        results.push({ width, fallback, travelPixels: travel });
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, results, reducedMotionRespected: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
