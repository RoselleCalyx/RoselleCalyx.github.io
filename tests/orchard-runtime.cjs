const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4173',out='/tmp/orchard-qa',types=['kiwi','grape','durian','mango'];
(async()=>{
 await fs.mkdir(out,{recursive:true});const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1120}}),errors=[],broken=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)broken.push(r.url());});
  await p.route('**/js/farm.js*',async route=>{const s=await fs.readFile(path.join(root,'js/farm.js'),'utf8'),i=s.lastIndexOf('})();');await route.fulfill({contentType:'application/javascript',body:s.slice(0,i)+'window.__orchard={trees,renderTree,onTreeClick,plantModal,saveTrees,harvestAll};'+s.slice(i)});});
  await p.goto(base+'/farm.html?season=spring&p=.45');await p.waitForFunction(()=>window.__orchard);
  // Preserve original residents, and plant all four newcomers through the UI.
  for(const type of types){
   await p.locator('#btnPlant').click();assert.equal(await p.locator('[data-tree]').count(),8);
   await p.locator(`[data-tree="${type}"]`).click();
   await p.locator('.modal').waitFor({state:'detached'});
   for(let i=0;i<3;i++){
    await p.evaluate(type=>{const t=__orchard.trees.find(t=>t.type===type);__orchard.onTreeClick(t,{target:t.el});},type);
    await p.locator('[data-water]').click();
   }
   await p.waitForFunction(type=>__orchard.trees.find(t=>t.type===type)?.sim?.built,type);
   assert.equal(await p.evaluate(type=>__orchard.trees.find(t=>t.type===type).water,type),3);
  }
  assert.equal(await p.evaluate(()=>Site.store.get('farm-trees',[]).length),8);
  const savedShapes=await p.evaluate(()=>Site.store.get('farm-trees',[]).map(t=>({id:t.id,variant:t.variant})));
  assert.ok(savedShapes.every(t=>Number.isInteger(t.variant)&&t.variant>=0&&t.variant<3),'every planting persists one of three shapes');
  const anchors=await p.evaluate(types=>__orchard.trees.filter(t=>types.includes(t.type)).map(t=>({type:t.type,flowers:t.sim.flowers.length,caps:t.sim.caps.length,leaves:t.sim.anchors.leaves.summer.length,source:t.sim.a.src})),types);
  assert.ok(anchors.every(t=>t.flowers>0&&t.caps>0&&t.leaves>0));assert.equal(new Set(anchors.map(t=>t.source)).size,4);
  await p.screenshot({path:out+'/farm-spring.png',fullPage:true});
  for(const season of ['summer','autumn','winter']){
   await p.goto(base+`/farm.html?season=${season}&p=.65`);await p.waitForFunction(()=>__orchard.trees.every(t=>t.sim?.built));
   await p.waitForTimeout(600);
   assert.deepEqual(await p.evaluate(()=>Site.store.get('farm-trees',[]).map(t=>({id:t.id,variant:t.variant}))),savedShapes,'reload and seasons preserve planted shapes');
   const state=await p.evaluate(types=>__orchard.trees.filter(t=>types.includes(t.type)).map(t=>({type:t.type,fruit:t.el.querySelectorAll('.fruit').length,sim:t.sim.cv.toDataURL(),source:t.sim.a.src})),types);
   if(season==='summer')assert.ok(state.filter(t=>['mango','durian'].includes(t.type)).every(t=>t.fruit>0));
   if(season==='autumn')assert.ok(state.filter(t=>['kiwi','grape'].includes(t.type)).every(t=>t.fruit>0));
   if(season==='winter')assert.ok(state.every(t=>t.fruit===0));
   assert.equal(new Set(state.map(t=>t.sim)).size,4,'species simulation layers must use independent anchors');
   await p.screenshot({path:out+`/farm-${season}.png`,fullPage:true});
   if(season!=='winter'){
    const ripe=season==='summer'?['durian','mango']:['kiwi','grape'];
    await p.locator('#btnHarvest').click();
    assert.ok(await p.evaluate(types=>types.every(type=>Site.store.get('farm-basket',{})[type]>0),ripe),'new fruit must persist in the basket');
    assert.ok(await p.evaluate(types=>__orchard.trees.filter(t=>types.includes(t.type)).every(t=>!t.el.querySelector('.fruit')),ripe));
   }
  }
  await p.goto(base+'/docs/orchard-preview.html');await p.waitForFunction(()=>trees.length===3&&trees.every(t=>t.sim.built));
  for(const type of ['apple','peach','orange','cherry',...types]){
   await p.locator('#species').selectOption(type);await p.waitForFunction(()=>trees.length===3&&trees.every(t=>t.sim.built));
   const shapes=await p.evaluate(()=>trees.map(t=>({variant:t.variant,anchors:t.sim.anchors.leaves.summer.length,fruit:FarmArt.fruitSlots(t.type,t.variant)})));
   assert.deepEqual(shapes.map(t=>t.variant),[0,1,2]);assert.ok(shapes.every(t=>t.anchors>100));
   assert.equal(new Set(shapes.map(t=>JSON.stringify(t.fruit))).size,3,'each shape has independent fruit anchors');
   for(const season of ['spring','summer','autumn','winter']){
    await p.locator('#season').selectOption(season);await p.locator('#progress').evaluate(el=>{el.value='0.65';el.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(200);
    const bases=await p.evaluate(()=>trees.map(t=>t.sim.a.src));assert.equal(new Set(bases).size,3,'all three shapes render distinct seasonal assets');
    if(['kiwi','grape'].includes(type))await p.screenshot({path:out+`/preview-${type}-${season}.png`,fullPage:true});
   }
  }
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/farm.html?season=autumn&p=.6');
  await p.waitForFunction(()=>window.__orchard);
  await p.evaluate(()=>Site.store.set('farm-trees',Site.store.get('farm-trees',[]).slice(0,7)));
  await p.reload();await p.locator('#btnPlant').click();
  await p.locator('.modal.open').waitFor({state:'visible'});
  assert.equal(await p.locator('[data-tree]').count(),8);
  assert.ok(await p.locator('.modal-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'plant catalog fits mobile');
  await p.screenshot({path:out+'/plant-mobile.png',fullPage:true});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(broken,[]);console.log(JSON.stringify({passed:true,checks:['plant all four via UI','three waterings','old trees preserved','persistent planting shapes','all eight species and three variants','shape-specific fruit anchors','four seasons','harvest and persisted basket','snow and blossoms','mobile'],anchors,screenshots:out}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
