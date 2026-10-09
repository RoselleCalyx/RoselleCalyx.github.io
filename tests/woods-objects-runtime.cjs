// Isolated browser checks; private hooks are injected only into test responses.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4173',out='/tmp/woods-objects-qa';
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],broken=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)broken.push(r.url());});
  await p.addInitScript(()=>{window.__lampDraws=new Set();const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source.src?.includes('/equipment/'))__lampDraws.add(source.src.split('/').pop());return draw.call(this,source,...args);};});
  await p.route('**/js/woods.js*',async route=>{const s=await fs.readFile(path.join(root,'js/woods.js'),'utf8'),end=s.lastIndexOf('})();');
   const hook='window.__woods={get items(){return items;},get covers(){return covers;},get berries(){return berries;},get hips(){return hips;},P,pick,hitTest,moveCover,save,iconOf};';
   await route.fulfill({contentType:'application/javascript',body:s.slice(0,end)+hook+s.slice(end)});
  });
  for(const season of ['spring','summer','autumn','winter']){
   await p.goto(base+`/woods.html?season=${season}`);await p.waitForFunction(()=>document.querySelector('#stage').dataset.objects==='natural'&&document.querySelector('#stage').dataset.texture==='illustrated'&&__lampDraws.has('lantern.webp')&&__lampDraws.has('woods-lamp-post-v1.webp'));
   assert.deepEqual((await p.evaluate(()=>[...__lampDraws])).sort(),['lantern.webp','woods-lamp-post-v1.webp'],'the woods uses the shared lantern with its own blunt timber support');
   const state=await p.evaluate(()=>({loaded:WoodsObjects.loaded(),variants:__woods.items.map(t=>t.variant),rocks:__woods.covers.filter(c=>c.kind==='rock').map(c=>c.variant)}));
   assert.equal(state.loaded,45);assert.deepEqual(state.rocks,[0,1,2]);assert.ok(state.variants.every(v=>[0,1,2].includes(v)));
   await p.screenshot({path:out+`/woods-${season}.png`,fullPage:true});
  }
  const render=await p.evaluate(()=>WoodsObjects.types.map(type=>{
   const samples=[0,1,2].map(variant=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d'),ok=WoodsObjects.draw(g,type,64,120,112,112,variant);const d=g.getImageData(0,0,128,128).data;return {ok,pixels:d.filter((v,i)=>i%4===3&&v>0).length,url:cv.toDataURL()};});
   return {type,ok:samples.every(s=>s.ok&&s.pixels>200),unique:new Set(samples.map(s=>s.url)).size};
  }));assert.ok(render.every(t=>t.ok&&t.unique===3),'all 45 natural objects render distinct visible silhouettes');
  await p.goto(base+'/woods.html?season=autumn');await p.waitForFunction(()=>document.querySelector('#stage').dataset.objects==='natural');
  await p.evaluate(()=>{const samples=['porcini','chanterelle','shiitake','matsutake','amanita'];const pos=[[.29,.77],[.45,.74],[.39,.83],[.74,.72],[.81,.83]];__woods.items.splice(0,__woods.items.length,...samples.map((id,i)=>({id,u:pos[i][0],v:pos[i][1],variant:i%3,g:1,born:-10,s:45,cover:null,flip:i%2?-1:1})));});
  await p.waitForTimeout(100);await p.screenshot({path:out+'/woods-mushroom-samples.png',fullPage:true});
  const a=await p.evaluate(()=>{const t=__woods.items.find(t=>t.id==='porcini');return {at:__woods.P(t.u,t.v),variant:t.variant};});
  const box=await p.locator('#scene').boundingBox();await p.mouse.click(box.x+a.at[0],box.y+a.at[1]-18);await p.waitForTimeout(600);
  assert.ok(await p.evaluate(()=>__woods.save.basket.porcini>0),'real canvas click still harvests the new mushroom');
  const poison=await p.evaluate(()=>{const t=__woods.items.find(t=>t.id==='amanita');__woods.pick(t);return {picking:t.picking,seen:__woods.save.seen.amanita,basket:__woods.save.basket.amanita||0};});
  assert.equal(poison.picking,undefined);assert.ok(poison.seen>0);assert.equal(poison.basket,0);
  await p.evaluate(()=>__woods.moveCover(__woods.covers[0],true));await p.waitForTimeout(400);assert.ok(await p.evaluate(()=>__woods.covers[0].off>.7));
  const variant=await p.evaluate(()=>__woods.items.find(t=>t.id==='matsutake').variant);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>__woods.items.find(t=>t.id==='matsutake').variant),variant);
  await p.locator('#btnJournal').click();assert.ok(await p.locator('.modal').isVisible());assert.ok(await p.locator('.modal img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)));await p.keyboard.press('Escape');
  await p.setViewportSize({width:390,height:844});await p.reload();await p.waitForFunction(()=>document.querySelector('#stage').dataset.objects==='natural');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/woods-mobile.png',fullPage:true});
  await p.route('**/assets/wild/objects/*.webp',r=>r.abort());await p.reload();await p.waitForFunction(()=>document.querySelector('#stage').dataset.objects==='partial');
  assert.ok(await p.evaluate(()=>__woods.items.length>0&&__woods.covers.length>0),'the procedural objects remain available when textures fail');
  assert.deepEqual(errors,[]);assert.deepEqual(broken,[]);console.log(JSON.stringify({passed:true,checks:['45 distinct rendered objects','current pond lantern in four seasons','four seasons and snow','canvas harvest and saved basket','rock movement','poison remains observation only','stable per-object shape','journal artwork','mobile','procedural fallback'],screenshots:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
