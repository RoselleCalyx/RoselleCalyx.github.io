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
        return route.fulfill({ contentType:'application/javascript', body:source.slice(0,end) + 'window.__farmTest = {animals, trees, stepAnimal, planWalk, rest, place, openAnimal, closeBubble, feed, startHop, leaveRock, addAnimal, waterSpot, inSwimArea, think};\n' + source.slice(end) });
      }
      return route.continue();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/farm.html?season=spring&p=.5');
    await page.waitForFunction(() => window.__farmTest && document.querySelectorAll('.actor.walk-ready').length === __farmTest.animals.length);
    await page.waitForFunction(() => __farmTest.animals.filter(a => FarmArt.JUMPS.has(a.def.species)).every(a => a.el.classList.contains('jump-ready')));
    await page.waitForFunction(() => [...document.querySelectorAll('.pose-sprite')].every(i => i.dataset.ready === 'true'));
    assert.deepEqual(errors, [], 'page must initialize without script errors');
    await page.screenshot({path:path.join(out,'new-residents.png'),fullPage:true});
    const habitat = await page.evaluate(() => {
      const t = __farmTest, now = performance.now();
      const species = ['redpanda','raccoon','wolf','crocodile','fennec'];
      const present = species.every(sp => t.animals.some(a => a.def.species === sp));
      const croc = t.animals.find(a => a.def.species === 'crocodile');
      t.animals.forEach(a => a.held = true);
      const second = t.addAnimal({ species:'crocodile', name:'River' }); second.held = true;
      const spawned = t.inSwimArea(croc.x,croc.y) && t.inSwimArea(second.x,second.y);
      let confined = true, moved = false;
      croc.held = false;
      for (let trip = 0; trip < 20; trip++) {
        const target = t.waterSpot(croc.x,croc), start = {x:croc.x,y:croc.y};
        const at = now + trip * 50000;
        t.planWalk(croc,target,at);t.stepAnimal(croc,.016,at+1700);
        for (let tick = 0; tick < 1200; tick++) {
          t.stepAnimal(croc,1/30,at+1716+tick*1000/30);
          confined &&= t.inSwimArea(croc.x,croc.y);
          moved ||= Math.hypot(croc.x-start.x,croc.y-start.y) > 1;
          if (croc.state === 'idle') break;
        }
      }
      t.planWalk(croc,{x:4,y:94},now+1100000);
      const corrected = t.inSwimArea(croc.tx,croc.ty);
      const hops = t.startHop(croc,{x:18,y:78},now+1100100);
      t.rest(croc,now,10000,'sleep');croc.held=true;
      const anchor={x:croc.x,y:croc.y,phase:croc.phase};
      t.stepAnimal(croc,.1,now+2000);
      const held=croc.x===anchor.x&&croc.y===anchor.y&&croc.phase===anchor.phase;
      second.el.remove();t.animals.splice(t.animals.indexOf(second),1);
      t.rest(croc,now,10000,'sit');t.place(croc);
      return {present,spawned,confined,moved,corrected,hops,held};
    });
    assert.deepEqual(habitat,{present:true,spawned:true,confined:true,moved:true,corrected:true,hops:false,held:true},'new residents and duplicate crocodiles stay in water throughout motion and rest');
    await page.evaluate(() => __farmTest.openAnimal(__farmTest.animals.find(a=>a.def.species==='crocodile')));
    await page.locator('[data-pet]').click();
    assert.equal(await page.evaluate(()=>__farmTest.inSwimArea(...['x','y'].map(k=>__farmTest.animals.find(a=>a.def.species==='crocodile')[k]))),true,'petting stays in water');
    await page.evaluate(() => __farmTest.closeBubble());
    await page.locator('#btnAdopt').click();
    assert.equal(await page.locator('.species-grid [data-sp]').count(),12,'all twelve adoptable species are offered');
    for (const sp of ['redpanda','raccoon','wolf','crocodile','fennec']) {
      await page.locator(`.species-grid [data-sp="${sp}"]`).click();
      assert.equal(await page.locator(`.species-grid [data-sp="${sp}"]`).getAttribute('aria-checked'),'true');
    }
    await page.locator('.modal-close').click();
    await page.evaluate(() => {
      const t=__farmTest,a=t.animals.find(a=>a.def.species==='crocodile');
      t.openAnimal(a);t.feed(a,{id:'carp',name:'Carp',from:'pond',icon:'🐟'},document.querySelector('.feed-line'),null);t.closeBubble();
    });
    await page.waitForFunction(()=>__farmTest.animals.find(a=>a.def.species==='crocodile').reaction?.kind==='swish');
    assert.equal(await page.evaluate(()=>{const a=__farmTest.animals.find(a=>a.def.species==='crocodile');return __farmTest.inSwimArea(a.x,a.y)&&a.held;}),true,'favorite fish gets a swimming response in water');
    await page.waitForFunction(()=>!__farmTest.animals.find(a=>a.def.species==='crocodile').feeding);
    const cycle = await page.evaluate(() => {
      const t = __farmTest, a = t.animals.find(a => a.keeper), now = performance.now();
      t.animals.forEach(a => a.held = true);
      // Keep this fixed gait inspection corridor clear of new resident homes.
      const wolf=t.animals.find(a=>a.def.species==='wolf');wolf.y=94;t.place(wolf);
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
    assert.equal(cycle.frames.length,12,'all twelve cat gait frames must play');
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
    for(let i=0;i<3;i++){
      await page.evaluate(() => {
        const t=__farmTest,a=t.animals.find(a=>a.keeper);t.openAnimal(a);
        t.feed(a,{id:'shrimp',name:'Shrimp',from:'pond',icon:'🦐'},document.querySelector('.feed-line'),null);
      });
      await page.waitForFunction(()=>__farmTest.animals.find(a=>a.keeper).reaction?.kind==='munch');
      if(i<2)await page.waitForFunction(()=>!__farmTest.animals.find(a=>a.keeper).feeding);
    }
    await page.waitForFunction(()=>__farmTest.animals.find(a=>a.keeper).reaction?.kind==='happy-hop');
    assert.equal(await page.locator('.actor.keeper').getAttribute('data-pose'),'stand');
    assert.ok(await page.locator('.actor.keeper.react-happy-hop').count(),'successive favorite snacks vary their reactions');
    await page.waitForFunction(()=>!__farmTest.animals.find(a=>a.keeper).feeding);
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
    // Calm sky still responds to deliberate interactions; reduced motion quiets the nap.
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.body.classList.contains('farm-reduced-motion'));
    assert.equal(await page.locator('.actor.keeper .bob').evaluate(e=>getComputedStyle(e).animationName),'none','a feeding nap respects reduced motion');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>__farmTest.animals.find(a=>a.keeper).x),nap.x,'closing the bubble cannot interrupt a feeding nap');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>Sky.setCalm(false));
    await page.waitForTimeout(8900);
    assert.equal(await page.evaluate(()=>__farmTest.animals.find(a=>a.keeper).held),false,'feeding nap releases its hold');
    const hop = await page.evaluate(() => {
      const t=__farmTest,a=t.animals.find(a=>a.keeper),rock=MeadowProps.PROPS.find(p=>p.id==='rock-path'),now=performance.now();
      a.held=false;a.x=rock.x-3;a.y=rock.y;
      t.startHop(a,{x:rock.x,y:rock.y},now,rock);t.stepAnimal(a,.016,now+540);
      const apex=a.lift;t.stepAnimal(a,.016,now+1050);
      const perched={lift:a.lift,id:a.perch.id,z:Number(a.el.style.zIndex)};
      t.leaveRock(a,now+1100);t.stepAnimal(a,.016,now+2150);
      return {apex,perched,ground:a.lift,props:document.querySelectorAll('.meadow-prop').length};
    });
    assert.ok(hop.apex>hop.perched.lift);assert.equal(hop.perched.id,'rock-path');
    assert.equal(hop.perched.z,752);assert.equal(hop.ground,0);assert.equal(hop.props,9);
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
    await page.waitForFunction(()=>document.querySelectorAll('.motion-grid .actor').length===13);
    await page.waitForFunction(()=>[...document.querySelectorAll('.pose-sprite')].every(i=>i.complete&&i.naturalWidth));
    await page.locator('#pose').selectOption('stretch');
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(out,'preview.png'),fullPage:true});
    assert.equal(await page.locator('.actor[data-species="snowcat"]').getAttribute('data-pose'),'stretch');
    await page.locator('#pose').selectOption('walk');
    await page.locator('#pause').click();
    const before=await page.locator('.actor[data-species="snowcat"] .walk-sprite:not(.walk-sprite-next)').evaluate(e=>e.style.backgroundPositionX);
    await page.locator('#step').click();
    const after=await page.locator('.actor[data-species="snowcat"] .walk-sprite:not(.walk-sprite-next)').evaluate(e=>e.style.backgroundPositionX);
    assert.notEqual(after,before,'preview supports frame stepping');
    await page.locator('#flip').click();
    assert.equal(await page.locator('.actor.left').count(),13);
    assert.deepEqual(errors,[]); assert.deepEqual(broken,[],'all local assets must load');
    console.log(JSON.stringify({passed:true,checks:['five new residents and adoption choices','crocodile spawning, swimming boundary, held pose, hop guard and fish response','twelve-frame cat cycle','wake/stand/walk','held phase','pet posture','varied feeding postures and nap hold/release','FarmFX integration','eight-posture rock takeoff/perch/landing and depth','reduced motion','four seasons','mobile overflow','thirteen-species preview stepping/mirroring','local asset loads'],screenshots:out}));
  } finally { if(browser) await browser.close(); await new Promise(ok=>server.close(ok)); }
}
main().catch(e=>{ console.error(e); process.exitCode=1; });
