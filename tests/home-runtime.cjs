// Run against a local static server: HOME_PREVIEW_URL=http://127.0.0.1:4173 node tests/home-runtime.cjs
// --baseline captures Claude's original treatment; --live also inspects the public deployment.
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const out = '/tmp/home-epic-qa', base = process.env.HOME_PREVIEW_URL || 'http://127.0.0.1:4173';
const baseline = process.argv.includes('--baseline');
async function main() {
  await fs.mkdir(out,{recursive:true});
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:960}}), errors=[];
    await page.addInitScript(()=>{
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      window.__foregroundDraws=[];
      CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
        const target=this.canvas.id;
        if(target==='rings'||target==='fx'){
          __foregroundDraws.push({target,source:source.src||source.tagName});
          if(__foregroundDraws.length>100)__foregroundDraws.shift();
        }
        return draw.call(this,source,...args);
      };
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/index.html?p=0');
    await page.waitForTimeout(2800); // ray-traced Saturn and its opening fade
    await page.screenshot({path:`${out}/${baseline?'before':'after'}-desktop.png`});
    const style=await page.evaluate(()=>{
      const galaxy=getComputedStyle(document.querySelector('.hero-cosmos'));
      return {filter:galaxy.filter,mask:galaxy.maskImage,veilOpacity:getComputedStyle(document.querySelector('.hero-veil')).opacity,
        title:document.querySelector('.hero-title').getBoundingClientRect().toJSON(),
        rings:document.querySelector('#rings').width};
    });
    if (!baseline) {
      assert.ok(style.filter.includes('saturate(1.12)'),'galactic colour treatment must be active');
      assert.ok(await page.locator('.hero-text-shade').count()===1,'text needs its own shade above the ring layer');
      const layers=await page.evaluate(()=>__foregroundDraws);
      const craft=layers.findLastIndex(x=>x.source.includes('cassini-flight'));
      assert.ok(craft>0,'the spacecraft texture must be drawn');
      assert.equal(layers[craft].target,'rings','Cassini must use the foreground canvas');
      assert.equal(layers[craft-1].target,'rings');
      assert.equal(layers[craft-1].source,'CANVAS','the near-side ring surface must be drawn before Cassini');
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/index.html?p=0');await page.waitForTimeout(2800);
    await page.screenshot({path:`${out}/${baseline?'before':'after'}-mobile.png`});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal mobile overflow');
    if (!baseline) {
      await page.setViewportSize({width:1440,height:960});
      await page.goto(base+'/index.html?p=.55');await page.waitForTimeout(2400);
      await page.screenshot({path:`${out}/journey.png`});
      assert.equal(await page.locator('#heroUI').evaluate(e=>getComputedStyle(e).visibility),'hidden','copy and its shade fade out during the flight');
      await page.goto(base+'/index.html?p=.95');await page.waitForTimeout(1800);
      assert.ok(Number(await page.locator('#finale').evaluate(e=>getComputedStyle(e).opacity))>.95,'the finale remains visible');
      await page.goto(base+'/index.html');await page.waitForTimeout(1800);
      await page.evaluate(()=>scrollTo({top:document.querySelector('.story').offsetHeight-innerHeight*.5,behavior:'instant'}));
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.hero.leaving').count(),1,'hero dissolves into the bio');
      await page.screenshot({path:`${out}/handoff.png`});
      await page.evaluate(()=>{scrollTo({top:0,behavior:'instant'});Sky.setCalm(true);});
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.hero-cosmos').evaluate(e=>getComputedStyle(e).transform),'none','calm mode stops galaxy drift');
    }
    let live=null;
    if (process.argv.includes('--live')) {
      await page.setViewportSize({width:1440,height:960});
      await page.goto('https://rosellecalyx.github.io/',{waitUntil:'networkidle',timeout:45000});
      await page.waitForTimeout(2500);await page.screenshot({path:`${out}/live-desktop.png`});
      const farm=await page.request.get('https://rosellecalyx.github.io/farm.html');
      const html=await farm.text();
      const runtime=(html.match(/src="(js\/farm\.js[^\"]*)"/)||[])[1];
      const r=runtime?await page.request.get('https://rosellecalyx.github.io/'+runtime):null;
      const code=r?await r.text():'';
      live={url:page.url(),farmStatus:farm.status(),motionScript:html.includes('js/farm-motion.js'),distanceGait:code.includes('Motion.advance('),feeding:code.includes('function feed('),homeRings:await page.locator('#rings').count()===1};
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,baseline,style,live,screenshots:out}));
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
