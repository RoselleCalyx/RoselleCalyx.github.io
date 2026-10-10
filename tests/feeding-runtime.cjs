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
  const pantryState=()=>p.evaluate(()=>localStorage.getItem('farm-basket')+localStorage.getItem('wild-woods')+localStorage.getItem('wild-pond'));
  async function checkToolbar(){
   const toolbar=p.locator('.bubble.animal-actions');
   assert.equal(await toolbar.count(),1,'animal selection opens an icon toolbar');
   assert.equal(await toolbar.locator('button').count(),3,'the animal has exactly three quick actions');
   assert.equal(await toolbar.locator('[data-pet], [data-feed], [data-heart]').count(),3);
   assert.equal(await toolbar.locator('.x, h4, p, .feed-tray').count(),0,'the toolbar has no text card or food chooser');
   assert.equal(await p.locator('.bubble.animal-food').count(),0,'food choices require an explicit Feed click');
   const styles=await toolbar.evaluate(el=>({position:getComputedStyle(el).position,background:getComputedStyle(el).backgroundColor,buttons:[...el.querySelectorAll('button')].map(b=>({background:getComputedStyle(b).backgroundColor,label:b.getAttribute('aria-label'),title:b.title}))}));
   assert.equal(styles.position,'fixed');
   assert.equal(styles.background,'rgba(0, 0, 0, 0)','the icon toolbar background stays transparent');
   for(const b of styles.buttons){assert.equal(b.background,'rgba(0, 0, 0, 0)');assert.ok(b.label&&b.title,'icon actions have accessible names and tooltips');}
  }
  async function offer(food){
   await p.locator('[data-feed]').click();
   const card=p.locator('.bubble.animal-food');
   assert.equal(await card.count(),1);
   assert.equal(await p.locator('.bubble.animal-actions').count(),0,'the food chooser replaces the toolbar');
   const alpha=await card.evaluate(el=>Number(getComputedStyle(el).backgroundColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1]??1));
   assert.ok(alpha>0&&alpha<1,'the food chooser has a semi-transparent background');
   await p.getByRole('button',{name:'Offer '+food,exact:true}).click();
   assert.equal(await p.locator('.bubble').count(),0,'choosing a food immediately clears the animal and food overlays');
   assert.equal(await p.locator('#farmFeedback[aria-live="polite"]').count(),1,'reaction feedback survives after the chooser closes');
  }
  const foods={snowcat:'River shrimp',rabbit:'Apple',panda:'Bamboo shoot',fox:'Wild bayberry',shiba:'Apple',hedgehog:'Wild strawberry',duckling:'River shrimp',penguin:'River shrimp'},result=[];
  for(const [sp,food] of Object.entries(foods)){
   await p.evaluate(sp=>{
    const t=__feed;t.animals.forEach(a=>{a.held=true;});const a=t.animals.find(a=>a.def.species===sp);a.x=25;a.y=80;a.lift=0;t.place(a);t.openAnimal(a);
   },sp);
   await checkToolbar();
   if(sp==='snowcat'){
    assert.equal(await p.locator('[data-heart]').getAttribute('data-liked'),'false','food-earned hearts do not select the like icon');
    assert.equal(await p.locator('.animal-heart-shape').evaluate(el=>getComputedStyle(el).fill),'none','the heart starts with a transparent center');
    const before=await p.evaluate(()=>{const a=__feed.animals.find(a=>a.keeper);return Site.store.get('farm-hearts',{})[a.def.species+':'+a.def.name]||0;});
    await p.locator('[data-heart]').click();
    assert.equal(await p.locator('[data-heart]').getAttribute('data-liked'),'true');
    assert.equal(await p.locator('.animal-heart-shape').evaluate(el=>getComputedStyle(el).fill),'rgb(231, 88, 96)','clicking Like fills the heart red immediately');
    const after=await p.evaluate(()=>{const a=__feed.animals.find(a=>a.keeper);return Site.store.get('farm-hearts',{})[a.def.species+':'+a.def.name]||0;});
    assert.equal(after,before+1,'the heart icon still records likes');
    assert.equal(await p.locator('[data-heart]').innerText(),'','the like count does not create another visible label');
    assert.match(await p.locator('[data-heart]').getAttribute('aria-label'),new RegExp(String(after)));
   }
   await offer(food);
   assert.equal(await p.evaluate(sp=>__feed.animals.find(a=>a.def.species===sp).held,sp),true,'dismissing the food chooser keeps the animal still for delivery');
   const pantry=await pantryState();
   await p.evaluate(sp=>__feed.openAnimal(__feed.animals.find(a=>a.def.species===sp)),sp);
   await p.locator('[data-feed]').click();
   assert.equal(await p.locator('.bubble.animal-food').count(),0,'Feed cannot open another chooser while a bite is in progress');
   assert.equal(await pantryState(),pantry,'another click cannot consume another bite');
   await p.waitForFunction(sp=>__feed.animals.find(a=>a.def.species===sp).reaction?.kind==='munch',sp);
   await p.locator('[data-pet]').click();
   assert.equal(await p.evaluate(sp=>__feed.animals.find(a=>a.def.species===sp).reaction?.kind,sp),'munch','Pet cannot interrupt chewing');
   await p.keyboard.press('Escape');
   assert.equal(await p.locator('.bubble').count(),0);
   assert.equal(await p.locator(`.actor[data-species="${sp}"] .bite-treat`).count(),1);
   const frames=[];
   for(let i=0;i<3;i++){
    await p.waitForTimeout(400);
    frames.push(await p.locator(`.actor[data-species="${sp}"] .reaction-art`).evaluate(cv=>cv.toDataURL()));
    if(sp==='snowcat')await p.screenshot({path:out+`/matcha-eating-${i}.png`});
   }
   assert.ok(new Set(frames).size===3,sp+' must visibly chew before celebrating');
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
  await offer('Carp');
  await p.waitForFunction(()=>__feed.animals.find(a=>a.def.species==='shiba').reaction?.kind==='munch');
  await p.waitForFunction(()=>!__feed.animals.find(a=>a.def.species==='shiba').feeding);
  assert.match(await p.locator('#farmFeedback').textContent(),/enjoys/);
  await p.evaluate(()=>__feed.openAnimal(__feed.animals.find(a=>a.keeper)));
  const apples=await p.evaluate(()=>Site.store.get('farm-basket',{}).apple);
  await offer('Apple');
  assert.equal(await p.evaluate(()=>Site.store.get('farm-basket',{}).apple),apples);
  assert.equal(await p.evaluate(()=>__feed.animals.find(a=>a.keeper).reaction.kind),'shake');
  // At phone width the actions remain above the animal; only food uses a sheet.
  await p.setViewportSize({width:390,height:844});
  await p.evaluate(()=>{const a=__feed.animals.find(a=>a.def.species==='rabbit');a.x=50;a.y=75;__feed.place(a);a.el.scrollIntoView({block:'center',inline:'center'});__feed.openAnimal(a);});
  await checkToolbar();
  const geometry=await p.evaluate(()=>{const toolbar=document.querySelector('.bubble.animal-actions').getBoundingClientRect(),a=__feed.animals.find(a=>a.def.species==='rabbit').el.getBoundingClientRect();return {toolbar:{left:toolbar.left,right:toolbar.right,top:toolbar.top,bottom:toolbar.bottom},animalTop:a.top,width:innerWidth};});
  assert.ok(geometry.toolbar.left>=0&&geometry.toolbar.right<=geometry.width,'phone actions stay within the viewport');
  assert.ok(geometry.toolbar.bottom<=geometry.animalTop,'phone actions appear above the animal');
  assert.equal(await p.locator('.bubble.animal-actions.mobile-sheet').count(),0,'the icon toolbar never becomes a bottom sheet');
  await p.locator('[data-feed]').click();
  assert.equal(await p.locator('.bubble.animal-food.mobile-sheet').count(),1);
  await p.getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(await p.locator('.bubble').count(),0,'closing the food chooser clears it without offering a snack');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,result,screenshots:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
