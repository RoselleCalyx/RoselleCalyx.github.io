// Verify the actual Pet button and rendered response in both ambient modes.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4173',out='/tmp/interaction-qa';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1120}}),errors=[],result=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/js/farm.js*',async route=>{const s=await fs.readFile(path.join(root,'js/farm.js'),'utf8'),i=s.lastIndexOf('})();');await route.fulfill({contentType:'application/javascript',body:s.slice(0,i)+'window.__pet={animals,addAnimal,openAnimal,closeBubble,place};'+s.slice(i)});});
  const signature=sp=>p.locator(`.actor[data-species="${sp}"]`).evaluate(el=>{
   const jump=el.querySelector('.jump-sprite'),visible=Number(getComputedStyle(jump).opacity)>.01;
   return visible?getComputedStyle(jump).backgroundPositionX+getComputedStyle(el.querySelector('.bob')).transform:el.querySelector('.reaction-art').toDataURL();
  });
  const expected={snowcat:'knead',rabbit:'binky',panda:'wave',fox:'wave',shiba:'wag',hedgehog:'curl',duckling:'flap',penguin:'flap'};
  for(const calm of [false,true]){
   await p.goto(base+'/farm.html?season=spring');await p.waitForFunction(()=>window.__pet&&AnimalReactions.ready);
   await p.evaluate(calm=>{Sky.setCalm(calm);for(const sp of ['hedgehog','penguin'])__pet.addAnimal({species:sp,name:sp});},calm);
   await p.waitForFunction(()=>document.querySelectorAll('.actor.walk-ready.jump-ready').length===__pet.animals.length);
   for(const [sp,kind] of Object.entries(expected)){
    await p.evaluate(sp=>{const a=__pet.animals.find(a=>a.def.species===sp);a.x=25;a.y=80;a.lift=0;__pet.place(a);__pet.openAnimal(a);},sp);
    await p.locator('[data-pet]').click();
    assert.equal(await p.evaluate(sp=>__pet.animals.find(a=>a.def.species===sp).reaction.kind,sp),kind);
    await p.waitForTimeout(420);const one=await signature(sp);
    await p.waitForTimeout(680);const two=await signature(sp);assert.notEqual(one,two,`${sp} must visibly respond with calm=${calm}`);
    if(calm&&['shiba','panda','rabbit'].includes(sp))await p.screenshot({path:`${out}/${sp}-pet.png`});
    await p.locator('[data-pet]').click();
    assert.equal(await p.evaluate(sp=>__pet.animals.find(a=>a.def.species===sp).reaction.kind,sp),'pet-nuzzle','repeated petting gives another posture');
    await p.getByRole('button',{name:'Close',exact:true}).click();
    result.push({sp,calm,response:kind});
   }
   await p.waitForTimeout(2800);
   assert.ok(await p.evaluate(()=>__pet.animals.every(a=>!a.reaction&&!a.el.classList.contains('reaction-ready')&&!a.held)),'every pet response cleans up, including calm mode');
  }
  await p.emulateMedia({reducedMotion:'reduce'});await p.reload();await p.waitForFunction(()=>window.__pet&&AnimalReactions.ready);
  await p.evaluate(()=>__pet.openAnimal(__pet.animals.find(a=>a.def.species==='panda')));await p.locator('[data-pet]').click();
  const still=await signature('panda');await p.waitForTimeout(1000);assert.notEqual(still,await signature('panda'),'reduced motion still acknowledges a deliberate click with a quiet pose change');
  await p.waitForTimeout(1800);assert.equal(await p.evaluate(()=>__pet.animals.find(a=>a.def.species==='panda').reaction),null);
  // A slow/missing affection atlas must not suppress the existing body response.
  await p.emulateMedia({reducedMotion:'no-preference'});await p.route('**/assets/farm/affection/*',r=>r.abort());await p.reload();await p.waitForFunction(()=>window.__pet);await p.evaluate(()=>Sky.setCalm(true));
  await p.evaluate(()=>__pet.openAnimal(__pet.animals.find(a=>a.def.species==='fox')));await p.locator('[data-pet]').click();
  assert.notEqual(await p.locator('.actor[data-species="fox"] .bob').evaluate(el=>getComputedStyle(el).animationName),'none','loading fallback still responds in calm mode');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,result,screenshots:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
