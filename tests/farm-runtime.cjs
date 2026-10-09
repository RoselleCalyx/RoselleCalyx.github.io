// Browser smoke/visual checks. Requires playwright and a local Chrome install.
// Test controls are injected into the response, never into the published page.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = '/tmp/farm-motion-qa';
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.json':'application/json' };
async function main() {
  await fs.mkdir(out, { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + relative);
      if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', ok); });
  let browser;
  try {
    browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
    const page = await browser.newPage({ viewport:{width:1440,height:1120} });
    const errors = [], broken = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().includes('127.0.0.1')) broken.push(r.url()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname === '/js/farm.js') {
        const source = await fs.readFile(path.join(root,'js/farm.js'),'utf8');
        const end = source.lastIndexOf('})();');
        return route.fulfill({ contentType:'application/javascript', body:source.slice(0,end) + 'window.__farmTest = {animals, trees, stepAnimal, planWalk, rest, place, openAnimal, closeBubble, feed};\n' + source.slice(end) });
      }
      return route.continue();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/farm.html?season=spring&p=.5');
    await page.waitForFunction(() => window.__farmTest && document.querySelectorAll('.actor.walk-ready').length === __farmTest.animals.length);
    await page.waitForFunction(() => [...document.querySelectorAll('.pose-sprite')].every(i => i.dataset.ready === 'true'));
    assert.deepEqual(errors, [], 'page must initialize without script errors');
    const cycle = await page.evaluate(() => {
      const t = __farmTest, a = t.animals.find(a => a.keeper), now = performance.now();
      t.animals.forEach(a => a.held = true);
      a.held = false; a.x = 14; a.y = 67; t.rest(a,now,10000,'sleep');
      t.planWalk(a,{x:26,y:67},now);
      const wake = a.pose;
      t.stepAnimal(a,.016,now+1200); const standing = a.pose;
      t.stepAnimal(a,.016,now+1700);
      const frames = new Set();
      for (let i = 0; i < 180; i++) { t.stepAnimal(a,1/60,now+1716+i*1000/60); frames.add(FarmMotion.frame(a.phase,'snowcat')); }
      a.held = true;
      return { wake, standing, frames:[...frames], x:a.x, state:a.state, phase:a.phase, animation:getComputedStyle(a.sprite).animationName };
    });
    assert.equal(cycle.wake,'stretch'); assert.equal(cycle.standing,'stand');
    assert.equal(cycle.frames.length,8,'all eight gait frames must play');
    assert.ok(cycle.x > 14 && cycle.x < 26); assert.equal(cycle.state,'walk');
    assert.equal(cycle.animation,'none','CSS must not run an independent foot timer');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __farmTest.animals.find(a=>a.keeper).phase),cycle.phase,'held animals must keep their frame');
    await page.evaluate(() => { const a=__farmTest.animals.find(a=>a.keeper); __farmTest.openAnimal(a); });
    await page.locator('[data-pet]').click();
    assert.equal(await page.locator('.actor.keeper').getAttribute('data-pose'),'stretch');
    await page.evaluate(() => __farmTest.closeBubble());
    // Exercise Claude's feeding flow together with the new posture controller.
    assert.equal(await page.evaluate(()=>typeof FarmFX.update),'function');
    await page.evaluate(() => {
      const t=__farmTest,a=t.animals.find(a=>a.keeper);
      t.openAnimal(a);
      const line=document.querySelector('.feed-line');
      const food={id:'shrimp',name:'Shrimp',from:'pond',icon:'🦐'};
      for(let i=0;i<3;i++) t.feed(a,food,line,null);
    });
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.actor.keeper').getAttribute('data-pose'),'stand');
    await page.waitForTimeout(1850);
    await page.evaluate(() => {
      const t=__farmTest,a=t.animals.find(a=>a.keeper);
      t.feed(a,{id:'shrimp',name:'Shrimp',from:'pond'},document.querySelector('.feed-line'),null);
      t.closeBubble();
    });
    const nap=await page.evaluate(()=>{
      const a=__farmTest.animals.find(a=>a.keeper);
      return {pose:a.pose,held:a.held,speed:a.speed,x:a.x};
    });
    assert.equal(nap.pose,'sleep');assert.equal(nap.held,true);assert.equal(nap.speed,0);
    await page.evaluate(()=>Sky.setCalm(true));
    await page.waitForFunction(()=>document.body.classList.contains('farm-calm'));
    assert.equal(await page.locator('.actor.keeper .bob').evaluate(e=>getComputedStyle(e).animationName),'none');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>__farmTest.animals.find(a=>a.keeper).x),nap.x,'closing the bubble cannot interrupt a feeding nap');
    await page.evaluate(()=>Sky.setCalm(false));
    await page.waitForTimeout(8900);
    assert.equal(await page.evaluate(()=>__farmTest.animals.find(a=>a.keeper).held),false,'feeding nap releases its hold');
    // Resting screenshot with every resident, and all four cat postures in preview.
    await page.evaluate(() => {
      const t=__farmTest;
      t.animals.forEach(a=>{ a.held=true; t.rest(a,performance.now(),10000,'sleep'); });
      const a=t.animals.find(a=>a.keeper); a.x=18;a.y=78;t.place(a);
    });
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
    await page.evaluate(() => {
      const t=__farmTest,a=t.animals.find(a=>a.keeper),now=performance.now();
      a.x=14;a.y=67;a.held=false;t.planWalk(a,{x:26,y:67},now);t.stepAnimal(a,.016,now+1700);
    });
    const movingX=await page.evaluate(()=>__farmTest.animals[0].x);
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>__farmTest.animals[0].x)>movingX,'ordinary motion must run before reducing it');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.actor.keeper .bob').evaluate(el=>getComputedStyle(el).animationName),'none');
    const calm=await page.evaluate(()=>[__farmTest.animals[0].x,__farmTest.animals[0].phase]);
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(()=>[__farmTest.animals[0].x,__farmTest.animals[0].phase]),calm);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>__farmTest.animals[0].x)>calm[0],'motion resumes when the preference changes');
    for (const season of ['summer','autumn','winter']) {
      await page.goto(base + `/farm.html?season=${season}&p=.6`);
      await page.waitForFunction(() => window.__farmTest);
      assert.equal(await page.locator('#world').getAttribute('data-season'),season);
    }
    await page.waitForTimeout(1900);
    await page.screenshot({path:path.join(out,'winter.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.goto(base + '/farm.html?season=spring&p=.5');
    await page.waitForFunction(() => window.__farmTest);
    await page.waitForTimeout(1900);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow on mobile');
    await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
    await page.setViewportSize({width:1280,height:1120});
    await page.goto(base + '/docs/farm-motion-preview.html');
    await page.waitForFunction(()=>document.querySelectorAll('.motion-grid .actor').length===8);
    await page.waitForFunction(()=>[...document.querySelectorAll('.pose-sprite')].every(i=>i.complete&&i.naturalWidth));
    await page.locator('#pose').selectOption('stretch');
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(out,'preview.png'),fullPage:true});
    assert.equal(await page.locator('.actor[data-species="snowcat"]').getAttribute('data-pose'),'stretch');
    await page.locator('#pose').selectOption('walk');
    await page.locator('#pause').click();
    const before=await page.locator('.actor[data-species="snowcat"] .walk-sprite').evaluate(e=>e.style.backgroundPositionX);
    await page.locator('#step').click();
    const after=await page.locator('.actor[data-species="snowcat"] .walk-sprite').evaluate(e=>e.style.backgroundPositionX);
    assert.notEqual(after,before,'preview supports frame stepping');
    await page.locator('#flip').click();
    assert.equal(await page.locator('.actor.left').count(),8);
    assert.deepEqual(errors,[]); assert.deepEqual(broken,[],'all local assets must load');
    console.log(JSON.stringify({passed:true,checks:['eight-frame cycle','wake/stand/walk','held phase','pet posture','feeding posture and nap hold/release','FarmFX integration','reduced motion','four seasons','mobile overflow','preview stepping/mirroring','local asset loads'],screenshots:out}));
  } finally { if(browser) await browser.close(); await new Promise(ok=>server.close(ok)); }
}
main().catch(e=>{ console.error(e); process.exitCode=1; });
