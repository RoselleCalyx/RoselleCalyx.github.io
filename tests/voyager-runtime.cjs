// NODE_PATH=<bundled node_modules> node tests/voyager-runtime.cjs
// Preview server: python3 -m http.server 4174 --bind 127.0.0.1
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const base=process.env.VOYAGER_PREVIEW_URL||'http://127.0.0.1:4174';
const out='/tmp/voyager-qa';
async function main(){
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try{
    const errors=[],warnings=[],failed=[];
    const context=await browser.newContext({viewport:{width:1440,height:960}});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(/Voyager shader|GL_INVALID|shader error/.test(m.text()))warnings.push(m.text());});
    page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))failed.push(r.url());});
    await page.goto(base+'/voyager.html');
    await page.waitForTimeout(2300);
    assert.equal(await page.locator('#voyagerCosmos').getAttribute('data-renderer'),'webgl');
    await page.waitForFunction(()=>document.getElementById('voyagerFigure').dataset.scene==='departure');
    const sceneRequests=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/scenes/')).length);
    assert.ok(sceneRequests<=2,'only current and next scene preload');
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await page.evaluate(()=>/[\u3400-\u9fff]/.test(document.body.innerText)),false);
    assert.equal(await page.locator('.v-stop').count(),19);
    await page.screenshot({path:out+'/departure-desktop.png'});
    await page.locator('#vMapOpen').click();
    assert.equal(await page.locator('#vMap').evaluate(e=>e.open),true);
    await page.locator('.v-map-node[data-stop="saturn"]').click();
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('#voyager').getAttribute('data-stop'),'saturn');
    assert.equal(await page.locator('#vMap').evaluate(e=>e.open),false);
    await page.screenshot({path:out+'/saturn-desktop.png'});
    await page.locator('#vMapOpen').click();
    await page.screenshot({path:out+'/map-desktop.png'});
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'vMapOpen');
    await page.locator('#vJournalOpen').click();
    assert.ok((await page.locator('#vFact').innerText()).includes('orbit around Saturn'));
    await page.keyboard.press('Escape');
    await page.locator('#vPanoramaOpen').click();
    assert.equal(await page.locator('#vPanorama').evaluate(e=>e.open),true);
    await page.waitForFunction(()=>document.getElementById('vPanoramaImage').naturalWidth>1000);
    await page.screenshot({path:out+'/saturn-panorama.png'});
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'vPanoramaOpen');
    await page.locator('#vImmersive').click();
    assert.ok((await page.locator('body').getAttribute('class')).includes('v-immersive'));
    await page.waitForTimeout(600);
    await page.screenshot({path:out+'/saturn-immersive.png'});
    await page.keyboard.press('Escape');
    await page.locator('#vMapOpen').click();
    await page.locator('.v-map-node[data-stop="beyond"]').click();
    await page.waitForTimeout(1400);
    await page.screenshot({path:out+'/beyond-desktop.png'});
    assert.equal(await page.locator('#vNext').isDisabled(),true);
    await page.locator('#vJournalOpen').click();
    assert.ok((await page.locator('#vFact').innerText()).includes('imagined'));
    await page.keyboard.press('Escape');
    await page.reload();
    assert.equal(await page.locator('#voyager').getAttribute('data-stop'),'beyond');
    await page.locator('#vRestart').click();
    assert.equal(await page.locator('#vPrev').isDisabled(),true);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#voyager').getAttribute('data-stop'),'venus');
    await page.goBack();
    assert.equal(await page.locator('#voyager').getAttribute('data-stop'),'departure');
    await page.waitForFunction(()=>document.getElementById('voyagerFigure').dataset.scene==='departure');
    // Motion pause must actually stop frame production after the dirty redraw.
    await page.locator('#vMotion').click();await page.waitForTimeout(200);
    const f=await page.locator('#voyagerFigure').getAttribute('data-frame');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#voyagerFigure').getAttribute('data-frame'),f);
    await page.locator('#vMotion').click();
    const canLose=await page.evaluate(()=>{
      const gl=document.getElementById('voyagerCosmos').getContext('webgl');
      window.__testContextLoss=gl.getExtension('WEBGL_lose_context');
      if(window.__testContextLoss)window.__testContextLoss.loseContext();
      return !!window.__testContextLoss;
    });
    if(canLose){
      await page.waitForFunction(()=>!document.getElementById('vRenderNotice').hidden);
      await page.waitForTimeout(150);
      await page.evaluate(()=>window.__testContextLoss.restoreContext());
      await page.waitForFunction(()=>document.getElementById('vRenderNotice').hidden);
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/voyager.html#saturn');await page.waitForTimeout(1700);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile overflow');
    await page.screenshot({path:out+'/saturn-mobile.png'});
    await page.locator('#vMapOpen').click();
    await page.screenshot({path:out+'/map-mobile.png'});
    await page.locator('.v-chapter [data-stop="titan"]').click();
    assert.equal(await page.locator('#voyager').getAttribute('data-stop'),'titan');
    await page.setViewportSize({width:320,height:700});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no narrow-phone overflow');
    await page.setViewportSize({width:1440,height:960});
    // Every stop uses its own complete scene with the correct mission target.
    const ids=await page.evaluate(()=>VOYAGER_STOPS.map(s=>s.id));
    assert.equal(await page.evaluate(()=>new Set(VOYAGER_STOPS.map(s=>s.scene.art)).size),19);
    for(const id of ids){
      await page.evaluate(id=>{location.hash=id;},id);
      await page.waitForFunction(id=>document.getElementById('voyagerFigure').dataset.scene===id,id);
      assert.equal(await page.locator('#voyager').getAttribute('data-stop'),id);
      assert.equal(await page.locator('#voyagerScene').getAttribute('data-target'),await page.evaluate(id=>VOYAGER_STOPS.find(s=>s.id===id).body,id));
    }
    for(const id of ['venus','jupiter','phoebe','titan','enceladus','iapetus','plume','finale','beyond']) {
      await page.evaluate(id=>{location.hash=id;},id);await page.waitForTimeout(1600);
      assert.equal(await page.locator('#voyagerFigure').getAttribute('data-character'),'scene');
      await page.screenshot({path:out+'/'+id+'-desktop.png'});
    }
    if(!process.argv.includes('--visual')){
      await page.locator('#vPlay').click();
      assert.equal(await page.locator('#voyager').getAttribute('data-stop'),'departure');
      await page.waitForFunction(()=>document.getElementById('voyager').dataset.stop==='venus',{},{timeout:18000});
      await page.locator('#vPlay').click();
      assert.equal(await page.locator('#vPlay').getAttribute('aria-pressed'),'false');
      const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      const p=await reduced.newPage();p.on('pageerror',e=>errors.push(e.message));
      await p.goto(base+'/voyager.html#enceladus');await p.waitForFunction(()=>document.getElementById('voyagerFigure').dataset.scene==='enceladus');await p.waitForTimeout(250);
      assert.equal(await p.locator('#vMotion').isDisabled(),true);
      const rf=await p.locator('#voyagerFigure').getAttribute('data-frame');await p.waitForTimeout(250);
      assert.equal(await p.locator('#voyagerFigure').getAttribute('data-frame'),rf);
      await p.screenshot({path:out+'/enceladus-reduced.png'});
      await reduced.close();
      const fallback=await browser.newContext();const fp=await fallback.newPage();
      fp.on('pageerror',e=>errors.push(e.message));
      await fp.addInitScript(()=>{
        const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'?null:original.call(this,kind,...args);};
        localStorage.setItem('lonely-voyager-v1','null');
        Storage.prototype.setItem=function(){throw new Error('storage blocked');};
      });
      await fp.goto(base+'/voyager.html#saturn');
      assert.equal(await fp.locator('#voyagerCosmos').getAttribute('data-renderer'),'canvas');
      await fp.locator('#vNext').click();assert.equal(await fp.locator('#voyager').getAttribute('data-stop'),'huygens');
      await fp.waitForFunction(()=>document.getElementById('voyagerFigure').dataset.scene==='huygens');
      await fallback.close();
      const failure=await browser.newContext();const ep=await failure.newPage();
      await ep.route('**/scenes/inner-shore-v1.png',route=>route.abort());
      await ep.goto(base+'/voyager.html#venus');
      await ep.waitForFunction(()=>document.getElementById('voyagerScene').dataset.loading==='error');
      assert.equal(await ep.locator('#vRetryScene').isVisible(),true);
      assert.equal(await ep.locator('#voyagerFigure').getAttribute('data-scene'),'');
      await ep.unroute('**/scenes/inner-shore-v1.png');await ep.locator('#vRetryScene').click();
      await ep.waitForFunction(()=>document.getElementById('voyagerFigure').dataset.scene==='venus');
      // Delayed responses cannot replace the final selection after rapid navigation.
      await ep.route('**/scenes/phoebe-encounter-v1.png',async route=>{await new Promise(r=>setTimeout(r,800));await route.continue();});
      await ep.evaluate(()=>{location.hash='phoebe';});await ep.waitForTimeout(100);
      await ep.evaluate(()=>{location.hash='earth';});
      await ep.waitForFunction(()=>document.getElementById('voyagerFigure').dataset.scene==='earth');
      await ep.waitForTimeout(1000);assert.equal(await ep.locator('#voyagerFigure').getAttribute('data-scene'),'earth');
      await failure.close();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);assert.deepEqual(failed,[]);
    console.log(JSON.stringify({passed:true,chapters:ids.length,errors,warnings,failed,screenshots:out}));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
