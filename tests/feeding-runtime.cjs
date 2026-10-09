// Exercise the real Feed -> Offer buttons, not isolated reaction calls.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out='/tmp/feeding-qa',base='http://127.0.0.1:4173';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1120}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/js/farm.js*',async route=>{const s=await fs.readFile(path.join(root,'js/farm.js'),'utf8'),i=s.lastIndexOf('})();');await route.fulfill({contentType:'application/javascript',body:s.slice(0,i)+'window.__feed={animals,addAnimal,openAnimal,closeBubble,place};'+s.slice(i)});});
  await p.addInitScript(()=>{
   localStorage.setItem('farm-basket',JSON.stringify({apple:20}));
   localStorage.setItem('wild-woods',JSON.stringify({basket:{shoot:20,bayberry:20,strawberry:20}}));
   localStorage.setItem('wild-pond',JSON.stringify({creel:{shrimp:20,carp:20}}));
  });
  await p.goto(base+'/farm.html?season=spring&p=.5');
  try{await p.waitForFunction(()=>window.__feed&&AnimalReactions.ready);}catch(e){console.error('Startup diagnostics',errors,await p.evaluate(()=>({farm:!!window.__feed,reactions:!!window.AnimalReactions,ready:window.AnimalReactions?.ready})));throw e;}
  await p.evaluate(()=>{for(const sp of ['hedgehog','penguin'])__feed.addAnimal({species:sp,name:sp});});
  await p.waitForFunction(()=>document.querySelectorAll('.actor.walk-ready.jump-ready').length===__feed.animals.length);
  if(process.argv.includes('--calm'))await p.evaluate(()=>Sky.setCalm(true));
  const foods={snowcat:'River shrimp',rabbit:'Apple',panda:'Bamboo shoot',fox:'Wild bayberry',shiba:'Apple',hedgehog:'Wild strawberry',duckling:'River shrimp',penguin:'River shrimp'},result=[];
  for(const [sp,food] of Object.entries(foods)){
   await p.evaluate(sp=>{
    const t=__feed;t.animals.forEach(a=>{a.held=true;});const a=t.animals.find(a=>a.def.species===sp);a.x=25;a.y=80;a.lift=0;t.place(a);t.openAnimal(a);
   },sp);
   await p.locator('[data-feed]').click();
   await p.getByRole('button',{name:'Offer '+food,exact:true}).click();
   const pantry=await p.evaluate(()=>localStorage.getItem('farm-basket')+localStorage.getItem('wild-woods')+localStorage.getItem('wild-pond'));
   await p.getByRole('button',{name:'Offer '+food,exact:true}).click();
   assert.equal(await p.evaluate(()=>localStorage.getItem('farm-basket')+localStorage.getItem('wild-woods')+localStorage.getItem('wild-pond')),pantry,'double clicks cannot consume another bite');
   await p.locator('[data-pet]').click();
   await p.waitForFunction(sp=>__feed.animals.find(a=>a.def.species===sp).reaction?.kind==='munch',sp);
   assert.equal(await p.locator(`.actor[data-species="${sp}"] .bite-treat`).count(),1);
   const frames=[];
   for(let i=0;i<3;i++){
    await p.waitForTimeout(400);
    frames.push(await p.locator(`.actor[data-species="${sp}"] .reaction-art`).evaluate(cv=>cv.toDataURL()));
    if(sp==='snowcat')await p.screenshot({path:out+`/matcha-eating-${i}.png`});
   }
   assert.ok(new Set(frames).size===3,sp+' must visibly chew before celebrating');
   await p.getByRole('button',{name:'Close',exact:true}).click();
   assert.equal(await p.evaluate(sp=>__feed.animals.find(a=>a.def.species===sp).held,sp),true,'closing the menu cannot interrupt eating');
   await p.waitForFunction(sp=>{const a=__feed.animals.find(a=>a.def.species===sp);return a.reaction&&a.reaction.kind!=='munch';},sp);
   const response=await p.evaluate(sp=>__feed.animals.find(a=>a.def.species===sp).reaction.kind,sp);
   assert.equal(await p.locator(`.actor[data-species="${sp}"] .bite-treat`).count(),0);
   await p.waitForFunction(sp=>!__feed.animals.find(a=>a.def.species===sp).feeding,sp);
   assert.equal(await p.evaluate(sp=>__feed.animals.find(a=>a.def.species===sp).held,sp),false);
   result.push({sp,eats:true,response});
  }
  // A liked food still eats; refused food remains in the basket.
  await p.evaluate(()=>__feed.openAnimal(__feed.animals.find(a=>a.def.species==='shiba')));
  await p.locator('[data-feed]').click();await p.getByRole('button',{name:'Offer Carp',exact:true}).click();
  await p.waitForFunction(()=>__feed.animals.find(a=>a.def.species==='shiba').reaction?.kind==='munch');
  await p.waitForFunction(()=>!__feed.animals.find(a=>a.def.species==='shiba').feeding);
  assert.match(await p.locator('.feed-line').innerText(),/enjoys/);
  await p.evaluate(()=>__feed.openAnimal(__feed.animals.find(a=>a.keeper)));
  await p.locator('[data-feed]').click();
  const apples=await p.evaluate(()=>Site.store.get('farm-basket',{}).apple);
  await p.getByRole('button',{name:'Offer Apple',exact:true}).click();
  assert.equal(await p.evaluate(()=>Site.store.get('farm-basket',{}).apple),apples);
  assert.equal(await p.evaluate(()=>__feed.animals.find(a=>a.keeper).reaction.kind),'shake');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,result,screenshots:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
