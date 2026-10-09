// Run against the local static preview. Private geometry is exposed only in this intercepted test response.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const base=process.env.HOME_PREVIEW_URL||'http://127.0.0.1:4173',out='/tmp/home-handoff-qa';
const instrument=`
  window.__homeHandoff={
    state:()=>({p,pTarget,fall,dpr,width:cvFall.width,height:cvFall.height}),
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
  await page.waitForTimeout(1600);
}
async function light(page){
  return page.evaluate(()=>{
    const el=document.querySelector('#starFall'),data=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
    let lit=0,bright=0,warm=0,maxAlpha=0;
    for(let i=0;i<data.length;i+=4){if(data[i+3]>8)lit++;if(data[i+3]>180&&data[i]>230&&data[i+1]>180)bright++;if(data[i+3]>8&&data[i]>220&&data[i+1]>110&&data[i+2]<180)warm++;maxAlpha=Math.max(maxAlpha,data[i+3]);}
    return {...__homeHandoff.state(),opacity:+getComputedStyle(el).opacity,lit,bright,warm,maxAlpha};
  });
}
async function scrollQ(page,q){
  await page.evaluate(q=>scrollTo({top:document.querySelector('.story').offsetHeight-innerHeight*(1.02-.72*q),behavior:'instant'}),q);
  await page.waitForFunction(q=>{const s=__homeHandoff.state();return Math.abs(s.fall-q)<.005&&s.p>.9&&Math.abs(s.p-s.pTarget)<.002;},q);
  return light(page);
}
async function finalGeometry(page){
  const values=await page.evaluate(()=>({anchor:__homeHandoff.finalAnchor(),zero:__homeHandoff.pose(0),tiny:__homeHandoff.pose(.001),middle:__homeHandoff.pose(.3),late:__homeHandoff.pose(.7),calm:__homeHandoff.pose(.7,true),state:__homeHandoff.state()}));
  const {anchor,zero,tiny,middle,late,calm,state}=values;
  assert.ok(Math.hypot(anchor.x-zero.x,anchor.y-zero.y)<.001,'retained flare and falling remnant share exactly the final burn anchor');
  assert.ok(Math.hypot(tiny.x-zero.x,tiny.y-zero.y)<state.height*.001,'the first downward motion cannot teleport');
  assert.ok(middle.y>zero.y&&late.y>middle.y,'the remnant descends steadily');
  assert.ok(middle.scale<zero.scale&&late.scale<middle.scale&&late.scale>0,'the large flare becomes a small ember');
  assert.equal(calm.y,zero.y,'reduced motion keeps the remnant at the burn altitude');
  assert.ok(zero.x>=0&&zero.x<=state.width&&zero.y>=0&&zero.y<=state.height,'final flare remains on screen');
  return values;
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
    for(const progress of [.95,1]){
      await page.goto(base+`/index.html?p=${progress}`);await ready(page);
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
    const second=await scrollQ(page,.65);await page.screenshot({path:out+'/fall-into-bio.png'});
    const ashes=await scrollQ(page,.94);await page.screenshot({path:out+'/remnant-ash.png'});
    assert.ok(first.opacity>.99&&second.fall>first.fall&&second.lit<first.lit,'the same flare shrinks into the descending remnant');
    assert.ok(ashes.opacity<.25&&ashes.warm<second.warm&&ashes.bright<=second.bright&&ashes.lit<second.lit,`the remnant cools and fades into ash: ${JSON.stringify({second,ashes})}`);
    const back=await scrollQ(page,.25);assert.ok(back.fall<second.fall&&back.lit>second.lit,'reversing scroll restores the earlier remnant');
    const restored=await scrollQ(page,0);assert.ok(restored.opacity>.99&&restored.lit>20000,'scrolling back restores the large retained light');
    await page.evaluate(()=>scrollTo({top:document.querySelector('.story').offsetHeight+innerHeight,behavior:'instant'}));await page.waitForTimeout(900);
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
    await phone.emulateMedia({reducedMotion:'reduce'});await phone.reload();await ready(phone);await scrollQ(phone,.65);
    assert.equal(await phone.locator('.hero').evaluate(el=>el.style.getPropertyValue('--fall')),'0','reduced motion uses a quiet fade');
    await phone.screenshot({path:out+'/reduced-motion-mobile.png'});await phone.close();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,sizes,plasmaPixels,retainedFinale:true,sameAnchor:true,coolingAsh:true,reversible:true,phone:true,reducedMotion:true,screenshots:out}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
