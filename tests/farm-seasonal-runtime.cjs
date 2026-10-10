// Check the crocodile's heated winter refuge and its return to open water.
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = '/tmp/farm-seasonal-qa';
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json' };
async function main() {
  await fs.mkdir(out, { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1120 } }), errors = [], broken = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().includes('127.0.0.1')) broken.push(r.url()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname === '/js/farm.js') {
        const source = await fs.readFile(path.join(root, 'js/farm.js'), 'utf8'), end = source.lastIndexOf('})();');
        return route.fulfill({ contentType: 'application/javascript', body: source.slice(0, end) + 'window.__seasonTest={animals,addAnimal,place,setPose,planWalk,stepAnimal,feed,openAnimal,closeBubble,inWater(x,y){return ((x-WATER.cx)/WATER.rx)**2+((y-WATER.cy)/WATER.ry)**2<1;},inSwimArea,setSeason(name){season={...season,name};applySeason(false);}};\n' + source.slice(end) });
      }
      return route.continue();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/farm.html?season=winter&p=.5');
    await page.waitForFunction(() => window.__seasonTest && document.querySelector('.actor[data-species="crocodile"] .pose-sprite').dataset.ready === 'true' && document.querySelector('.winter-refuge img').complete);
    const initial = await page.evaluate(() => {
      const t = __seasonTest, a = t.animals.find(a => a.def.species === 'crocodile');
      return { winter: a.winterRest, sleep: a.pose === 'sleep', ashore: !t.inWater(a.x, a.y), idle: a.state === 'idle', shelter: getComputedStyle(a.el.querySelector('.winter-refuge')).display, wake: getComputedStyle(a.el.querySelector('.swim-water')).display, mask: getComputedStyle(a.el.querySelector('.pose-sprite')).maskImage };
    });
    assert.deepEqual(initial, { winter: true, sleep: true, ashore: true, idle: true, shelter: 'block', wake: 'none', mask: 'none' });
    await page.locator('#world').screenshot({ path: path.join(out, 'winter.png') });
    const r = await page.locator('.actor[data-species="crocodile"]').boundingBox();
    await page.screenshot({ path: path.join(out, 'winter-refuge.png'), clip: { x: r.x - 40, y: r.y + r.height * .4, width: r.width + 80, height: r.height * .65 + 30 } });
    const winter = await page.evaluate(() => {
      const t = __seasonTest, a = t.animals.find(a => a.def.species === 'crocodile'), now = performance.now();
      const second = t.addAnimal({ species: 'crocodile', name: 'River' }), before = { x: a.x, y: a.y, phase: a.phase };
      t.planWalk(a, { x: 66, y: 81 }, now);
      for (let i = 0; i < 100; i++) t.stepAnimal(a, .1, now + 10000 + i * 100);
      const line = document.getElementById('farmFeedback'), food = { id: 'carp', name: 'Carp', from: 'pond', icon: '🐟' };
      const storage = JSON.stringify({ ...localStorage }); t.feed(a, food, line, null);
      return { stationary: before.x === a.x && before.y === a.y && before.phase === a.phase, sleep: a.pose === 'sleep', foodUntouched: storage === JSON.stringify({ ...localStorage }), feedback: line.textContent.includes('spring'), separate: Math.hypot(second.x - a.x, second.y - a.y) > 5, bothAshore: !t.inWater(second.x, second.y) && !t.inWater(a.x, a.y) };
    });
    assert(Object.values(winter).every(Boolean));
    const returnedResident = await page.evaluate(() => {
      const t = __seasonTest;
      const third = t.addAnimal({ species: 'crocodile', name: 'Brook' });
      const second = t.animals.find(a => a.def.name === 'River');
      t.animals.splice(t.animals.indexOf(second), 1); second.el.remove();
      const returned = t.addAnimal({ species: 'crocodile', name: 'River' });
      return Math.hypot(third.x - returned.x, third.y - returned.y) > .4;
    });
    assert(returnedResident, 'a returning resident gets an unoccupied winter place');
    await page.locator('.actor[data-species="crocodile"]').first().click();
    await page.locator('[data-feed]').click();
    assert.equal(await page.locator('.animal-food').count(), 0, 'winter resting does not offer an unusable snack tray');
    await page.locator('[data-pet]').click();
    assert.equal(await page.locator('.actor[data-species="crocodile"]').first().getAttribute('data-pose'), 'sleep');
    await page.evaluate(() => __seasonTest.closeBubble());
    const seasonal = await page.evaluate(async () => {
      const t = __seasonTest, a = t.animals.find(a => a.def.species === 'crocodile');
      t.setSeason('spring');
      const spring = t.animals.filter(a => a.def.species === 'crocodile').every(a => !a.winterRest && t.inSwimArea(a.x, a.y) && a.el.classList.contains('aquatic') && getComputedStyle(a.el.querySelector('.winter-refuge')).display === 'none');
      a.state = 'walk'; a.phase = .37; t.setPose(a, 'walk'); t.place(a); FarmPoseTransitions.finish(a);
      let delayed = false;
      a.feedT = setTimeout(() => { delayed = true; }, 80); a.reactT = setTimeout(() => { delayed = true; }, 80); a.feeding = true;
      t.setSeason('winter');
      await new Promise(ok => setTimeout(ok, 140));
      const winter = a.winterRest && a.pose === 'sleep' && !a.feeding && !delayed && !a.el.querySelector('.pose-transition-old');
      t.setSeason('spring');
      return { spring, winter, returned: t.inSwimArea(a.x, a.y), stationaryReset: a.speed === 0 && a.state === 'idle' };
    });
    assert(Object.values(seasonal).every(Boolean));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => __seasonTest.setSeason('winter'));
    assert.equal(await page.locator('.actor[data-species="crocodile"] .bob').first().evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const capacity = await page.evaluate(() => {
      const t = __seasonTest;
      while (t.animals.filter(a => a.sp.habitat === 'water').length < 25) t.addAnimal({ species: 'crocodile', name: `Winter ${t.animals.length}` });
      const residents = t.animals.filter(a => a.sp.habitat === 'water');
      return new Set(residents.map(a => `${a.x}:${a.y}`)).size === 25 && residents.every(a => !t.inWater(a.x, a.y));
    });
    assert(capacity, 'all supported residents can receive distinct shore positions');
    assert.deepEqual(errors, []); assert.deepEqual(broken, []);
    console.log(JSON.stringify({ passed: true, checks: ['winter shelter and complete resting sprite', 'winter admission, duplicate residents and no skating', 'no winter feeding or energetic pet reactions', 'spring return and clearing pending snack timers', 'no stale pose snapshot across habitats', 'reduced motion and mobile layout', 'no script errors or missing assets'], screenshots: out }));
  } finally { if (browser) await browser.close(); await new Promise(ok => server.close(ok)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
