// Local browser checks for normalized pose fades, frozen gait frames and holds.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..'), out = '/tmp/farm-pose-transition-qa';
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };

async function main() {
  await fs.mkdir(out, { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1120 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname === '/farm.html') {
        let html = await fs.readFile(path.join(root, 'farm.html'), 'utf8');
        if (!html.includes('farm-pose-transitions.js')) html = html.replace('<script src="js/site-content.js', '<script src="js/farm-pose-transitions.js"></script>\n  <script src="js/site-content.js');
        return route.fulfill({ contentType: 'text/html', body: html });
      }
      if (url.pathname === '/js/farm.js') {
        const source = await fs.readFile(path.join(root, 'js/farm.js'), 'utf8'), end = source.lastIndexOf('})();');
        return route.fulfill({ contentType: 'application/javascript', body: source.slice(0, end) + 'window.__poseTest={animals,addAnimal,setPose,rest,place,react,stepAnimal};\n' + source.slice(end) });
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/farm.html?season=spring&p=.5`);
    await page.waitForFunction(() => window.__poseTest && window.FarmPoseTransitions && __poseTest.animals.every(a => a.el.classList.contains('walk-ready')));
    await page.evaluate(() => Object.keys(FarmArt.SPECIES).filter(sp => !__poseTest.animals.some(a => a.def.species === sp)).forEach(sp => __poseTest.addAnimal({ species: sp, name: 'Pose QA ' + sp })));
    await page.waitForFunction(() => __poseTest.animals.every(a => a.el.classList.contains('walk-ready')));
    await page.waitForFunction(() => [...document.querySelectorAll('.pose-sprite')].every(i => i.dataset.ready));
    await page.evaluate(() => __poseTest.animals.forEach(a => { a.held = true; FarmPoseTransitions.finish(a); }));
    const species = await page.evaluate(() => [...new Set(__poseTest.animals.map(a => a.def.species))]);
    for (const sp of species) {
      const immediate = await page.evaluate(sp => {
        const t = __poseTest, a = t.animals.find(a => a.def.species === sp);
        a.state = 'walk'; a.phase = .437; t.setPose(a, 'walk'); t.place(a); FarmPoseTransitions.finish(a);
        const last = getComputedStyle(a.sprite).backgroundPosition;
        t.rest(a, performance.now(), 10000, 'sit'); t.place(a);
        const old = a.el.querySelector('.pose-transition-old'), live = a.el.querySelector('.pose-live');
        const frozen = old.querySelector('.pose-transition-art').style.backgroundPosition;
        // place may update the real sheet while settling, but never the snapshot.
        a.phase = 0; t.place(a);
        return { old: !!old, oldOpacity: old.style.opacity, liveOpacity: live.style.opacity, last, frozen,
          stillFrozen: old.querySelector('.pose-transition-art').style.backgroundPosition === frozen,
          walkOpacity: getComputedStyle(a.sprite).opacity, transition: getComputedStyle(a.sprite).transitionDuration,
          held: a.held };
      }, sp);
      assert.ok(immediate.old && immediate.stillFrozen, sp + ' must retain its last rendered frame');
      assert.equal(immediate.frozen, immediate.last, sp + ' outgoing frame cannot reset to frame zero');
      assert.equal(immediate.oldOpacity, '1'); assert.equal(immediate.liveOpacity, '0');
      assert.equal(immediate.walkOpacity, '0'); assert.equal(immediate.transition, '0s'); assert.equal(immediate.held, true);
      await page.waitForTimeout(100);
      const middle = await page.evaluate(sp => {
        const a = __poseTest.animals.find(a => a.def.species === sp), old = a.el.querySelector('.pose-transition-old'), live = a.el.querySelector('.pose-live');
        return { sum: Number(old.style.opacity) + Number(live.style.opacity), inProgress: Number(live.style.opacity) > 0 && Number(live.style.opacity) < 1 };
      }, sp);
      assert.equal(middle.sum, 1); assert.equal(middle.inProgress, true);
      await page.waitForTimeout(240);
      assert.equal(await page.locator(`.actor[data-species="${sp}"] .pose-transition-old`).count(), 0);
    }
    const interruptions = await page.evaluate(async () => {
      const t = __poseTest, a = t.animals.find(a => a.keeper), now = performance.now();
      t.rest(a, now, 10000, 'sleep'); t.place(a);
      await new Promise(ok => setTimeout(ok, 90));
      t.rest(a, now, 10000, 'stand'); t.place(a);
      const composite = a.el.querySelector('.pose-transition-old').children.length;
      const before = { x: a.x, y: a.y, phase: a.phase, held: a.held };
      t.stepAnimal(a, .1, now + 2000);
      return { composite, unchanged: JSON.stringify(before) === JSON.stringify({ x: a.x, y: a.y, phase: a.phase, held: a.held }) };
    });
    assert.equal(interruptions.composite, 2, 'interruptions freeze the current normalized blend'); assert.equal(interruptions.unchanged, true);
    await page.waitForTimeout(330);
    await page.evaluate(() => { const a = __poseTest.animals.find(a => a.keeper); __poseTest.react(a, 'wave', { duration: 1000 }); });
    await page.waitForFunction(() => document.querySelector('.actor.keeper.reaction-ready.pose-changing'));
    assert.ok(await page.locator('.actor.keeper .pose-transition-old').count(), 'reaction canvas readiness fades from the held pose');
    await page.waitForFunction(() => !document.querySelector('.actor.keeper').classList.contains('reaction-ready'));
    await page.waitForTimeout(330);
    assert.equal(await page.locator('.actor.keeper .pose-transition-old').count(), 0);

    // Pixel probe uses equal opaque gray art. The midpoint must stay gray, not
    // flash brighter (opaque idle under fading gait) or dim toward the backdrop.
    await page.evaluate(() => {
      const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path fill="#808080" d="M0 0h128v128H0z"/></svg>');
      const el = document.createElement('div'); el.id = 'poseBlendProbe'; el.className = 'actor walk-ready walking';
      el.style.cssText = 'position:fixed;left:10px;top:100px;width:128px;height:128px;z-index:99999;transform:none;background:black;';
      el.style.setProperty('--gait-blend', '.5');
      el.innerHTML = `<div class="bob" style="animation:none!important"><img class="animal-sprite" src="${image}"/><div class="walk-sprite"></div><div class="walk-sprite walk-sprite-next"></div></div>`;
      el.querySelectorAll('.walk-sprite').forEach(s => { s.style.backgroundImage = `url("${image}")`; s.style.backgroundSize = '100% 100%'; s.style.transform = 'none'; });
      document.body.append(el);
      window.__probe = { el, state: 'walk' }; FarmPoseTransitions.before(__probe, 'walk'); el.dataset.pose = 'walk';
    });
    await page.locator('#poseBlendProbe .animal-sprite').evaluate(i => i.decode());
    await page.evaluate(() => { __probe.state = 'idle'; FarmPoseTransitions.before(__probe, 'sit'); __probe.el.dataset.pose = 'sit'; __probe.el.classList.remove('walking'); });
    const brightness = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(55);
      const pixel = await sharp(await page.locator('#poseBlendProbe .bob').screenshot()).extract({ left: 64, top: 64, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
      brightness.push(pixel[0]);
    }
    assert.ok(brightness.every(v => v >= 126 && v <= 130), 'normalized pose fades must not brighten or dim equal art: ' + brightness);
    await page.evaluate(() => { FarmPoseTransitions.cancel(__probe); __probe.el.remove(); });

    const relocation = await page.evaluate(() => {
      const t = __poseTest, a = t.animals.find(a => a.def.species === 'crocodile');
      t.rest(a, performance.now(), 10000, 'sleep'); t.place(a);
      FarmPoseTransitions.cancel(a); a.el.classList.remove('aquatic');
      t.rest(a, performance.now(), 10000, 'sit'); t.place(a);
      return !a.el.querySelector('.pose-transition-old');
    });
    assert.equal(relocation, true, 'habitat cancellation discards masked outgoing art');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.body.classList.contains('farm-reduced-motion'));
    await page.evaluate(() => { const a = __poseTest.animals.find(a => a.keeper); __poseTest.rest(a, performance.now(), 10000, 'sleep'); __poseTest.place(a); });
    assert.equal(await page.locator('.pose-transition-old').count(), 0, 'reduced motion switches pose immediately');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => Sky.setCalm(true));
    await page.waitForFunction(() => document.body.classList.contains('farm-calm'));
    await page.evaluate(() => { const a = __poseTest.animals.find(a => a.keeper); __poseTest.rest(a, performance.now(), 10000, 'stand'); __poseTest.place(a); });
    assert.equal(await page.locator('.pose-transition-old').count(), 0, 'calm mode has no remaining fade');
    await page.evaluate(() => Sky.setCalm(false));
    await page.waitForFunction(() => !document.body.classList.contains('farm-calm'));
    await page.evaluate(() => {
      const t = __poseTest;
      t.animals.forEach((a, i) => { a.held = true; a.x = 10 + i * 6; a.y = 90; t.rest(a, performance.now(), 10000, 'sleep'); t.place(a); });
    });
    await page.waitForTimeout(330);
    await page.screenshot({ path: path.join(out, 'sleeping-residents.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'live art groups cannot cause page overflow');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, species, brightness, duration: 280, interruptions, screenshots: out }));
  } finally { if (browser) await browser.close(); await new Promise(ok => server.close(ok)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
