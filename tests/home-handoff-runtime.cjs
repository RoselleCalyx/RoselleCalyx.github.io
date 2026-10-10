// Run against the local static preview. Private geometry is exposed only in this intercepted test response.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const base=process.env.HOME_PREVIEW_URL||'http://127.0.0.1:4173',out='/tmp/home-handoff-qa';
const instrument=`
  window.__homeHandoff={
    state:()=>({p,pTarget,fall,fallTarget,dpr,width:cvFall.width,height:cvFall.height,scroll:scrollY,descent:descent&&{...descent}}),
    geometry:()=>({...descentGeometry()}),
    finalAnchor:()=>{const f=burnFlight(FINAL_ENTRY),[x,y]=P(f.x,f.y);return {x,y};},
    pose:(q,calm=false)=>handoffPose(q,calm),
    arrivalLayer:progress=>{const layer=document.createElement('canvas');layer.width=cvR.width;layer.height=cvR.height;drawArrival(layer.getContext('2d'),progress,F.S*dpr,0);return layer;}
  };
`;
async function installHooks(page){
  await page.route('**/js/saturn.js*',async route=>{
    const source=await fs.readFile(new URL('../js/saturn.js',`file://${__filename}`),'utf8'),end=source.lastIndexOf('})();');
    assert.ok(end>0&&source.includes('function handoffPose('),'instrument the current home renderer');
    await route.fulfill({status:200,contentType:'application/javascript',body:source.slice(0,end)+instrument+source.slice(end)});
  });
}
async function ready(page){
  await page.waitForFunction(()=>window.__homeHandoff&&document.querySelector('#heroLand').width===1672);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1600);
}
async function light(page){
  return page.evaluate(()=>{
    const el=document.querySelector('#starFall'),data=el.getContext('2d').getImageData(0,0,el.width,el.height).data,state=__homeHandoff.state();
    const ceiling=state.descent?(state.descent.border-scrollY-state.descent.clearance)*state.dpr:el.height;
    const bioTop=document.querySelector('#about').getBoundingClientRect().top;
    let lit=0,bright=0,warm=0,maxAlpha=0,belowBoundary=0,lowestPixel=-1;
    for(let i=0;i<data.length;i+=4){
      const row=Math.floor(i/4/el.width),alpha=data[i+3];
      if(alpha){lowestPixel=Math.max(lowestPixel,row);if(row>=Math.ceil(ceiling))belowBoundary++;}
      if(alpha>8)lit++;
      if(alpha>180&&data[i]>230&&data[i+1]>180)bright++;
      if(alpha>8&&data[i]>220&&data[i+1]>110&&data[i+2]<180)warm++;
      maxAlpha=Math.max(maxAlpha,alpha);
    }
    return {...state,opacity:+getComputedStyle(el).opacity,lit,bright,warm,maxAlpha,ceiling,bioTop,belowBoundary,lowestPixel};
  });
}
async function scrollQ(page,q){
  assert.ok(q>=0&&q<1,'settled descent samples precede completion');
  await page.evaluate(q=>{const g=__homeHandoff.geometry();scrollTo({top:g.start+g.distance*q,behavior:'instant'});},q);
  await page.waitForFunction(q=>{const s=__homeHandoff.state();return Math.abs(s.fall-q)<.005&&s.p>.9&&Math.abs(s.p-s.pTarget)<.002;},q);
  const sample=await light(page);
  assert.equal(sample.belowBoundary,0,'all light, wake, and ash pixels stay above the biography clearance');
  if(sample.lowestPixel>=0)assert.ok(sample.lowestPixel/sample.dpr<sample.bioTop,'the rendered light never reaches the visible biography border');
  return sample;
}
async function finalGeometry(page){
  const values=await page.evaluate(()=>({anchor:__homeHandoff.finalAnchor(),zero:__homeHandoff.pose(0),tiny:__homeHandoff.pose(.001),early:__homeHandoff.pose(.25),middle:__homeHandoff.pose(.5),late:__homeHandoff.pose(.8),end:__homeHandoff.pose(1),calm:__homeHandoff.pose(.7,true),geometry:__homeHandoff.geometry(),state:__homeHandoff.state()}));
  const {anchor,zero,tiny,early,middle,late,end,calm,geometry,state}=values;
  assert.ok(Math.hypot(anchor.x-zero.x,anchor.y-zero.y)<.001,'retained flare and falling remnant share exactly the final burn anchor');
  assert.ok(Math.hypot(tiny.x-zero.x,tiny.y-zero.y)<state.height*.001,'the first downward motion cannot teleport');
  assert.ok(early.y>zero.y&&middle.y>early.y&&late.y>middle.y&&end.y>late.y,'the remnant descends steadily');
  assert.ok(early.scale>.35&&early.scale<zero.scale,'the opening flare shrinks gradually over the first quarter of descent');
  assert.ok(middle.scale<early.scale&&late.scale<middle.scale&&end.scale<late.scale&&end.scale>0,'the large flare becomes a small ember');
  assert.equal(calm.y,zero.y,'reduced motion keeps the remnant at the burn altitude');
  assert.ok(zero.x>=0&&zero.x<=state.width&&zero.y>=0&&zero.y<=state.height,'final flare remains on screen');
  assert.equal(geometry.clearance,state.width/state.dpr<680?18:24,'the clearance adapts to phone and desktop layouts');
  const terminalBorder=geometry.border-(geometry.start+geometry.distance);
  assert.ok(Math.abs(terminalBorder-end.y/state.dpr-geometry.clearance)<1,'the end of descent is just above the actual biography border');
  assert.ok(geometry.distance>state.height/state.dpr*.25,'the descent has room for its gradual transformation');
  return values;
}
async function finishDescent(page,overshoot=0){
  await page.evaluate(async overshoot=>{
    const g=__homeHandoff.geometry();scrollTo({top:g.start+g.distance+overshoot,behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  },overshoot);
  const sample=await light(page);
  assert.equal(sample.opacity,0,'a fast jump to the end clears the light without waiting for scroll smoothing');
  assert.equal(sample.lit,0,'completion clears the canvas instead of leaving invisible particles');
  assert.equal(sample.belowBoundary,0);
  return sample;
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const errors=[],sizes=[];
  try{
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await installHooks(page);
    for(const [width,height] of [[1440,960],[390,844],[320,568],[844,390],[2560,1080]]){
      await page.setViewportSize({width,height});await page.goto(base+'/index.html?p=0');await ready(page);
      const bounds=await page.evaluate(()=>({hero:document.querySelector('.hero').getBoundingClientRect().toJSON(),land:document.querySelector('#heroLand').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.equal(Math.round(bounds.hero.height),height,'hero follows even a short landscape screen');assert.ok(!bounds.overflow);
      assert.ok(bounds.land.left<=0&&bounds.land.right>=width&&bounds.land.bottom>=height-1,'painting covers all lower edges');
      assert.equal((await light(page)).opacity,0,'the final burn light is absent at the beginning');
      await page.screenshot({path:`${out}/home-${width}x${height}.png`});sizes.push({width,height});
    }
    await page.setViewportSize({width:1440,height:960});
    await page.goto(base+'/index.html?p=.67');await ready(page);
    const plasmaPixels=await page.evaluate(()=>{const layer=__homeHandoff.arrivalLayer(.67),data=layer.getContext('2d').getImageData(0,0,layer.width,layer.height).data;let warm=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>20&&data[i]>170&&data[i]>data[i+1]*1.1)warm++;return warm;});
    assert.ok(plasmaPixels>1200,'the entry plume renders a broad warm plasma layer, independently of Saturn and the rings');
    await page.screenshot({path:out+'/atmospheric-plasma.png'});
    let previousDim=0;
    for(const progress of [.85,.95,1]){
      await page.goto(base+`/index.html?p=${progress}`);await ready(page);
      const dim=await page.locator('#heroDim').evaluate(el=>+getComputedStyle(el).opacity);
      assert.ok(dim>previousDim,'the finale background progressively darkens');previousDim=dim;
      if(progress===1)assert.ok(dim>.8,'the final light is framed by a deeply darkened landscape');
      const first=await light(page);assert.equal(first.fall,0,'pinned final chapter does not start falling');
      assert.ok(first.opacity>.99&&first.lit>20000&&first.bright>100&&first.maxAlpha>245,'a large incandescent light persists after the spacecraft burns away');
      await finalGeometry(page);await page.waitForTimeout(700);const held=await light(page);
      assert.equal(held.lit,first.lit,'waiting at the finale retains the same large light');
      await page.screenshot({path:`${out}/retained-flare-${progress}.png`});
    }
    await page.goto(base+'/index.html');await ready(page);
    const start=await scrollQ(page,0);assert.ok(start.opacity>.99&&start.lit>20000,'the final light is present at the real story exit');
    await finalGeometry(page);
    const first=await scrollQ(page,.25);await page.screenshot({path:out+'/remnant-early.png'});
    const middle=await scrollQ(page,.5);await page.screenshot({path:out+'/remnant-middle.png'});
    const second=await scrollQ(page,.78);await page.screenshot({path:out+'/fall-into-bio.png'});
    const ashes=await scrollQ(page,.94);await page.screenshot({path:out+'/remnant-ash.png'});
    assert.ok(first.opacity>.99&&middle.lit<first.lit&&second.fall>middle.fall&&second.lit<middle.lit,'the same flare shrinks progressively into the descending remnant');
    assert.ok(ashes.lit>0&&ashes.warm<second.warm&&ashes.bright<=second.bright&&ashes.lit<second.lit,`the remnant cools into sparse ash while a tiny ember remains near the frame: ${JSON.stringify({second,ashes})}`);
    const back=await scrollQ(page,.25);assert.ok(back.fall<second.fall&&back.lit>second.lit,'reversing scroll restores the earlier remnant');
    const restored=await scrollQ(page,0);assert.ok(restored.opacity>.99&&restored.lit>20000,'scrolling back restores the large retained light');
    await finishDescent(page);
    await scrollQ(page,.5);
    const geometryBefore=await page.evaluate(()=>__homeHandoff.geometry());
    await page.setViewportSize({width:1024,height:768});
    await page.waitForTimeout(1000);
    await scrollQ(page,.7);await finalGeometry(page);
    const geometryAfter=await page.evaluate(()=>__homeHandoff.geometry());
    assert.notEqual(geometryAfter.border,geometryBefore.border,'resizing recomputes the biography boundary');
    await page.screenshot({path:out+'/remnant-resized.png'});
    await finishDescent(page,768);
    assert.equal((await light(page)).opacity,0,'no fixed light overlay remains far into the biography');
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(1900);
    assert.equal((await light(page)).opacity,0,'returning to the opening clears the final light');

    // A real coarse-pointer phone also exercises the smaller particle budget and capped pixel density.
    const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    phone.on('pageerror',e=>errors.push(e.message));await installHooks(phone);
    await phone.goto(base+'/index.html?p=1');await ready(phone);await finalGeometry(phone);
    const phoneLight=await light(phone);assert.ok(phoneLight.opacity>.99&&phoneLight.lit>10000&&phoneLight.bright>100,'the retained light is visible on a phone');
    await phone.screenshot({path:out+'/retained-flare-mobile.png'});
    await phone.goto(base+'/index.html');await ready(phone);await scrollQ(phone,.25);await phone.screenshot({path:out+'/remnant-mobile.png'});
    await scrollQ(phone,.78);await finalGeometry(phone);await finishDescent(phone);
    await phone.emulateMedia({reducedMotion:'reduce'});await phone.reload();await ready(phone);await scrollQ(phone,.65);
    assert.equal(await phone.locator('.hero').evaluate(el=>el.style.getPropertyValue('--fall')),'0','reduced motion uses a quiet fade');
    const quiet=await phone.evaluate(()=>({zero:__homeHandoff.pose(0,true),current:__homeHandoff.pose(__homeHandoff.state().fall,true)}));
    assert.equal(quiet.current.y,quiet.zero.y,'reduced motion replaces downward movement with a stationary fade');
    await phone.screenshot({path:out+'/reduced-motion-mobile.png'});await finishDescent(phone);await phone.close();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,sizes,plasmaPixels,retainedFinale:true,sameAnchor:true,bioClearance:true,allPixelsClipped:true,gradualCooling:true,reversible:true,fastJump:true,resize:true,phone:true,reducedMotion:true,screenshots:out}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
