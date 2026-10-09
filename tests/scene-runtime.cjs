// Visual + interaction regression against a locally served repository.
// Private game state is injected only into browser-test responses.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
const base=process.env.SCENE_PREVIEW_URL||'http://127.0.0.1:4173',out='/tmp/scene-polish',root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(out,{recursive:true});const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
  const p=await b.newPage({viewport:{width:1440,height:960}}),errors=[],broken=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)broken.push(r.url());});
  await p.route('**/*',async route=>{
   const u=new URL(route.request().url());if(!u.origin.startsWith(base))return route.abort();
   const hooks={'/js/woods.js':'window.__scene={items,covers,P,pick,hitTest,moveCover};','/js/pond.js':'window.__scene={rod,castTo,landBobber,fishApproach,strike,updateRod,land,setTrap,haulTrap,save};','/js/saturn.js':'window.__scene={flight,drawMeteors};'};
   if(hooks[u.pathname]){let s=await fs.readFile(path.join(root,u.pathname),'utf8');const end=s.lastIndexOf('})();');s=s.slice(0,end)+hooks[u.pathname]+s.slice(end);return route.fulfill({contentType:'application/javascript',body:s});}
   return route.continue();
  });
  let home=null;
  if(!process.argv.includes('--farm-only')){
  await p.goto(base+'/index.html?p=0');await p.waitForFunction(()=>window.CassiniArt?.textured&&window.__scene);await p.waitForTimeout(2000);
  home=await p.evaluate(()=>{
    const cv=document.createElement('canvas');cv.width=innerWidth*2;cv.height=innerHeight*2;const g=cv.getContext('2d');
    __scene.drawMeteors(g,3,1);const pixels=g.getImageData(0,0,cv.width,cv.height).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;
    return {meteorPixels:count,scale:__scene.flight(0).scale,angle:__scene.flight(0).angle};
  });assert.ok(home.meteorPixels>100);assert.ok(home.scale>1);assert.equal(home.angle,.34);
  await p.screenshot({path:out+'/after-home.png'});
  await p.goto(base+'/starmap.html');await p.waitForTimeout(1000);
  const side=p.locator('.sm-side');await side.hover();const before=await p.evaluate(()=>({y:scrollY,chart:document.querySelector('.chart-wrap').getBoundingClientRect().y}));
  await p.mouse.wheel(0,1400);await p.waitForTimeout(400);
  assert.ok(await side.evaluate(e=>e.scrollTop)>0,'the whole options panel scrolls independently');
  for(let i=0;i<3;i++){await p.mouse.wheel(0,1000);await p.waitForTimeout(80);}
  const after=await p.evaluate(()=>({y:scrollY,chart:document.querySelector('.chart-wrap').getBoundingClientRect().y}));assert.deepEqual(after,before,'scroll cannot chain into the document at the panel edge');
  await p.locator('#cassiniBtn').click();assert.ok(await p.locator('#orrery').isVisible());assert.equal(await p.evaluate(()=>scrollY),before.y);
  await p.screenshot({path:out+'/after-starmap.png'});
  }
  for(const name of ['woods','pond']){
   for(const season of ['spring','summer','autumn','winter']){
    await p.goto(base+`/${name}.html?season=${season}`);await p.waitForFunction(()=>document.querySelector('#stage').dataset.texture==='illustrated');await p.waitForTimeout(500);
    assert.ok(await p.evaluate(()=>document.querySelector('#scene').width>0));
    if(season==='summer'||season==='winter')await p.screenshot({path:out+`/after-${name}-${season}.png`,fullPage:true});
   }
  }
  await p.goto(base+'/woods.html?season=summer');await p.waitForFunction(()=>window.__scene&&document.querySelector('#stage').dataset.texture==='illustrated');
  const item=await p.evaluate(()=>{
   const t=__scene,it=t.items.find(i=>i.id!=='amanita');it.g=1;it.born=-10;it.cover=null;it.u=.5;it.v=.8;return {id:it.id,at:t.P(it.u,it.v)};
  });
  const box=await p.locator('#scene').boundingBox();await p.mouse.click(box.x+item.at[0],box.y+item.at[1]-8);
  await p.waitForTimeout(650);assert.ok(await p.evaluate(id=>JSON.parse(localStorage.getItem('wild-woods')).basket[id]>0,item.id),'picking updates the basket');
  await p.evaluate(()=>{const t=__scene,c=t.covers[0];t.moveCover(c,true);});await p.waitForTimeout(450);assert.ok(await p.evaluate(()=>__scene.covers[0].off)>.5,'rocks still uncover finds');
  await p.locator('#btnJournal').click();assert.ok(await p.locator('.modal').isVisible());await p.keyboard.press('Escape');
  await p.goto(base+'/pond.html?season=summer');await p.waitForFunction(()=>window.__scene&&document.querySelector('#stage').dataset.texture==='illustrated');
  const pondBox=await p.locator('#scene').boundingBox();await p.mouse.click(pondBox.x+pondBox.width*.45,pondBox.y+pondBox.height*.65);await p.waitForTimeout(100);
  assert.equal(await p.evaluate(()=>__scene.rod.state),'casting');
  await p.evaluate(()=>{const t=__scene;t.landBobber();t.fishApproach();t.rod.state='bite';t.strike();});assert.ok(await p.locator('#reel').isVisible());
  await p.evaluate(()=>{const t=__scene;t.rod.progress=1;t.rod.tension=.45;t.updateRod(0);});assert.ok(await p.locator('#card').isVisible());
  await p.locator('[data-keep]').click();assert.ok(await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('wild-pond')).creel).some(n=>n>0)),'fish catches persist');
  await p.evaluate(()=>__scene.setTrap(0));assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('wild-pond')).traps[0].dur)>0);
  await p.setViewportSize({width:390,height:844});
  for(const name of (process.argv.includes('--farm-only')?['woods','pond','farm']:['index','starmap','woods','pond','farm'])){
   await p.goto(base+`/${name}.html?season=winter&p=0`);await p.waitForTimeout(1100);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' mobile overflow');
   await p.screenshot({path:out+`/mobile-${name}.png`,fullPage:name!=='index'});
  }
  // A missing painting must preserve the procedural game, including its hit targets.
  await p.route('**/assets/wild/*.webp',route=>route.abort());await p.goto(base+'/woods.html?season=summer');await p.waitForTimeout(700);
  assert.equal(await p.locator('#stage').getAttribute('data-texture'),'procedural');assert.ok(await p.evaluate(()=>__scene.items.length)>0);
  assert.deepEqual(errors,[]);assert.deepEqual(broken,[]);
  console.log(JSON.stringify({passed:true,home,checks:['side-panel scroll and edge containment','Cassini journey remains in view','four-season textures','pick/cover/journal','cast/reel/catch/trap','mobile layouts','procedural fallback'],screenshots:out}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
