const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4173',out='/tmp/pond-equipment-qa',root=path.resolve(__dirname,'..');
(async()=>{await fs.mkdir(out,{recursive:true});const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1120}}),errors=[],broken=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)broken.push(r.url());});
  await p.addInitScript(()=>{window.__gearDraws=new Set();window.__coverDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source.src?.includes('/equipment/'))__gearDraws.add(source.src.split('/').pop());if(source.src?.endsWith('/fish-cover-v2.webp')){__coverDraws.push({w:args[2],h:args[3],alpha:this.globalAlpha});if(__coverDraws.length>32)__coverDraws.shift();}return draw.call(this,source,...args);};});
  await p.route('**/js/pond.js*',async route=>{const s=await fs.readFile(path.join(root,'js/pond.js'),'utf8'),i=s.lastIndexOf('})();');await route.fulfill({contentType:'application/javascript',body:s.slice(0,i)+'window.__gear={save,get phase(){return net?.phase},get rod(){return rod}};'+s.slice(i)});});
  await p.goto(base+'/pond.html?season=summer');await p.waitForFunction(()=>window.__gear&&PondEquipment.ready&&document.querySelector('#stage').dataset.texture==='illustrated');await p.waitForTimeout(200);
  assert.deepEqual((await p.evaluate(()=>[...__gearDraws])).sort(),['fish-cover-v2.webp','dock.webp','lantern.webp','rod.webp','stake.webp','trap.webp'].sort(),'all six current materials are drawn in the scene');
  assert.equal(await p.locator('[data-tool="net"] img').getAttribute('src'),'assets/wild/equipment/fish-cover-v2.webp');
  const water=async(u,v)=>{const r=await p.locator('#scene').boundingBox();await p.mouse.click(r.x+r.width*u,r.y+r.height*v);};
  await p.locator('[data-tool="net"]').click();await water(.45,.65);await p.waitForFunction(()=>__gear.phase==='fly');await p.waitForFunction(()=>__gear.phase==='sink'&&document.querySelector('#hint').textContent.includes('Gathering fish'));
  assert.ok(await p.evaluate(()=>__coverDraws.every(d=>Math.abs(d.h/d.w-640/343)<.001)&&__coverDraws.some(d=>Math.abs(d.alpha-.48)<.01)),'the tall open cover retains its proportions and is transparent only below the waterline');
  await p.screenshot({path:out+'/fish-cover-underwater.png'});
  await p.waitForFunction(()=>__gear.phase==='pull');await p.waitForFunction(()=>!document.querySelector('#card').hidden);assert.match(await p.locator('#card').innerText(),/bamboo cover/i);await p.locator('[data-keep]').click();await p.locator('#card').waitFor({state:'hidden'});
  assert.ok(await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('wild-pond')).creel).some(n=>n>0)),'fish caught with the cover remain keepable');
  await p.locator('[data-tool="trap"]').click();await water(.11,.74);assert.ok(await p.evaluate(()=>__gear.save.traps[0]?.dur>0),'a trap can be set through its real stake');
  await p.screenshot({path:out+'/soaking-trap.png'});
  await p.evaluate(()=>{__gear.save.traps[0].t0=Date.now()-100000;});await water(.11,.74);await p.waitForFunction(()=>!document.querySelector('#card').hidden);await p.locator('[data-release]').click();
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/pond.html?season=summer');await p.waitForFunction(()=>PondEquipment.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png',fullPage:true});
  for(const season of ['spring','autumn','winter']){await p.goto(base+'/pond.html?season='+season);await p.waitForFunction(()=>PondEquipment.ready);await p.waitForTimeout(150);if(season==='winter')assert.ok(await p.locator('[data-tool="net"]').evaluate(el=>el.classList.contains('disabled')));}
  assert.deepEqual(errors,[]);assert.deepEqual(broken,[]);console.log(JSON.stringify({passed:true,materials:6,fishCover:true,trap:true,seasons:4,mobile:true,screenshots:out}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
