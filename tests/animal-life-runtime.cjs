const {chromium}=require('playwright'),sharp=require('sharp'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out='/tmp/animal-life-qa',base='http://127.0.0.1:4173';
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1120}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{if(!localStorage.getItem('rename-seeded')){localStorage.setItem('farm-hearts',JSON.stringify({'snowcat:Yuki':7,'snowcat:Matcha':2}));localStorage.setItem('rename-seeded','1');}});
  await p.route('**/js/farm.js*',async route=>{const source=await fs.readFile(path.join(root,'js/farm.js'),'utf8'),end=source.lastIndexOf('})();');await route.fulfill({contentType:'application/javascript',body:source.slice(0,end)+'window.__life={animals,planWalk,place,stepAnimal,startHop,react,rest,openAnimal,closeBubble};'+source.slice(end)});});
  await p.goto(base+'/farm.html?season=spring&p=.5');
  await p.waitForFunction(()=>window.__life&&document.querySelectorAll('.actor.walk-ready.jump-ready').length===__life.animals.length&&AnimalReactions.ready);
  assert.equal(await p.locator('.farm-keeper b').innerText(),'Matcha is keeping watch.');
  assert.deepEqual(await p.evaluate(()=>Site.store.get('farm-hearts',{})),{'snowcat:Matcha':9});
  const affection=await p.evaluate(()=>{
    const result=[];
    for(const sp of Object.keys(FarmArt.SPECIES)){
      const el=document.createElement('div');el.className='actor react';el.innerHTML='<canvas class="reaction-art" width="320" height="320"></canvas>';
      const a={el,def:{species:sp}};
      for(const kind of ['munch','wave','pet-nuzzle','pet-stretch']){
        a.reaction={kind,start:0,duration:2400};
        const frames=[0,.2,.4,.6,.8,1].map(t=>{AnimalReactions.draw(a,t*2400,false);return el.querySelector('canvas').toDataURL();});
        result.push({sp,kind,count:new Set(frames).size});
      }
    }return result;
  });
  assert.ok(affection.every(a=>a.count>=5),'all eight species must change their feeding and petting silhouettes');
  await p.evaluate(()=>__life.openAnimal(__life.animals.find(a=>a.keeper)));
  await p.locator('[data-pet]').click();await p.waitForTimeout(600);
  assert.equal(await p.locator('.actor.keeper.reaction-ready').count(),1);
  assert.equal(await p.evaluate(()=>__life.animals.find(a=>a.keeper).reaction.kind),'pet-nuzzle');
  await p.locator('[data-pet]').click();
  assert.equal(await p.evaluate(()=>__life.animals.find(a=>a.keeper).reaction.kind),'pet-stretch');
  await p.evaluate(()=>__life.closeBubble());await p.waitForTimeout(2500);
  assert.equal(await p.locator('.actor.keeper.petting').count(),0);
  // Pixel-level regression: equal opaque frames must retain full opacity at mid-blend.
  await p.evaluate(()=>{
    const node=document.createElement('div');node.id='blendProbe';node.className='actor walk-ready walking';
    node.style.cssText='position:fixed;left:10px;top:80px;width:128px;height:128px;z-index:99999;transform:none;background:black;';
    node.innerHTML='<div class="bob"><div class="walk-sprite"></div><div class="walk-sprite walk-sprite-next"></div></div>';
    node.querySelectorAll('.walk-sprite').forEach(s=>{s.style.background='white';s.style.transform='none';});document.body.append(node);
  });
  const brightness=[];
  for(const blend of [0,.25,.5,.75,1]){
    await p.evaluate(v=>document.querySelector('#blendProbe').style.setProperty('--gait-blend',v),blend);
    const data=await sharp(await p.locator('#blendProbe .bob').screenshot()).extract({left:64,top:64,width:1,height:1}).removeAlpha().raw().toBuffer();brightness.push(data[0]);
  }
  assert.ok(brightness.every(v=>v>=253),'frame blending must not flash the background');await p.evaluate(()=>document.querySelector('#blendProbe').remove());
  const movement=[];
  for(const sp of ['shiba','panda','duckling','rabbit']){
    await p.evaluate(sp=>{
      const t=__life;t.animals.forEach(a=>{a.held=true;a.x=70;a.y=94;t.place(a);});const a=t.animals.find(a=>a.def.species===sp);
      a.x=14;a.y=67;a.phase=0;a.lift=0;a.held=false;t.rest(a,performance.now(),0,'sit');t.planWalk(a,{x:28,y:67},performance.now());t.stepAnimal(a,.016,performance.now()+500);t.place(a);
    },sp);
    const states=[],shots=[];
    for(let i=0;i<12;i++){
      await p.waitForTimeout(130);
      states.push(await p.evaluate(sp=>{const a=__life.animals.find(a=>a.def.species===sp);return {x:a.x,phase:a.phase,pose:a.pose,speed:a.speed,walking:a.el.classList.contains('walking'),hopping:a.el.classList.contains('hopping'),top:a.el.style.top,frame:a.sprite.style.backgroundPositionX,baseOpacity:getComputedStyle(a.el.querySelector('.animal-sprite')).opacity};},sp));
      const box=await p.locator(`.actor[data-species="${sp}"] .bob`).boundingBox();
      shots.push(await p.screenshot({clip:box}));
    }
    const moving=states.filter(s=>s.walking||s.hopping);
    assert.ok(states.at(-1).x>states[0].x+.6,sp+' must actually travel');assert.ok(moving.length>=4&&moving.every(s=>s.baseOpacity==='0'),sp+' cannot slide its sitting image');
    assert.ok(new Set(moving.map(s=>s.frame)).size>3,sp+' must play articulated frames');
    if(sp==='rabbit'){assert.ok(moving.every(s=>s.hopping&&!s.walking));assert.ok(new Set(moving.map(s=>s.top)).size>3);}
    const thumbs=await Promise.all(shots.map(input=>sharp(input).resize(192,192,{fit:'contain',background:'#e8e5d8'}).png().toBuffer()));
    await sharp({create:{width:768,height:576,channels:4,background:'#e8e5d8'}}).composite(thumbs.map((input,i)=>({input,left:i%4*192,top:Math.floor(i/4)*192}))).png().toFile(out+'/'+sp+'-playback.png');
    movement.push({sp,framesSeen:new Set(states.map(s=>s.frame)).size,travel:states.at(-1).x-states[0].x});
  }
  const gait=await p.evaluate(()=>({cycle:8.1*FarmArt.SPECIES.shiba.size*FarmMotion.GAITS.shiba.stride/FarmArt.SPECIES.shiba.speed,rabbit:FarmMotion.GAITS.rabbit.src,periods:Object.fromEntries(Object.entries(FarmArt.SPECIES).map(([sp,s])=>[sp,8.1*s.size*FarmMotion.GAITS[sp].stride/s.speed]))}));
  assert.ok(Object.entries(gait.periods).every(([sp,t])=>sp==='rabbit'?t>.65&&t<.8:t>=1.5&&t<=2.5),'every species needs a relaxed locomotion cycle');
  assert.ok(gait.cycle>1.4,'Shiba should have an unhurried stride');assert.ok(gait.rabbit.includes('/jump/'));
  const jumps=await p.evaluate(()=>{
    const t=__life,a=t.animals.find(a=>a.keeper);t.animals.forEach(a=>{a.held=true;});a.held=false;a.x=14;a.y=67;t.startHop(a,{x:22,y:67},performance.now());const start=a.hop.start,result=[];
    for(const offset of [0,140,280,420,560,700,840,980]){t.stepAnimal(a,.016,start+offset);result.push({offset,x:a.x,lift:a.lift,frame:a.el.querySelector('.jump-sprite').style.backgroundPositionX});}a.held=true;return result;
  });
  assert.equal(jumps[1].x,jumps[0].x,'crouch precedes translation');assert.equal(jumps[1].lift,0);assert.ok(jumps[4].lift>2);assert.ok(new Set(jumps.map(s=>s.frame)).size>=7,'leap must change posture');
  await p.evaluate(()=>{const a=__life.animals.find(a=>a.def.species==='shiba');__life.react(a,'wag');});
  await p.waitForTimeout(150);const wag1=await p.evaluate(()=>document.querySelector('.actor[data-species="shiba"] .reaction-art').toDataURL());await p.waitForTimeout(170);const wag2=await p.evaluate(()=>document.querySelector('.actor[data-species="shiba"] .reaction-art').toDataURL());assert.notEqual(wag1,wag2,'the tail must actually articulate');
  await p.evaluate(()=>{const a=__life.animals.find(a=>a.keeper);__life.react(a,'wave');});await p.waitForTimeout(300);
  await p.screenshot({path:out+'/feeding.png'});
  await p.goto(base+'/pond.html?season=summer');await p.waitForFunction(()=>PondPlants.ready);await p.waitForTimeout(500);await p.screenshot({path:out+'/pond.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,brightness,movement,gait,jumps,screenshots:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
