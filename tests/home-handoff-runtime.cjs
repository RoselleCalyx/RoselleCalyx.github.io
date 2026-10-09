const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const base='http://127.0.0.1:4173',out='/tmp/home-handoff-qa';
(async()=>{await fs.mkdir(out,{recursive:true});const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{const p=await b.newPage(),errors=[],sizes=[];p.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[1440,960],[390,844],[320,568],[844,390],[2560,1080]]){
  await p.setViewportSize({width,height});await p.goto(base+'/index.html?p=0');await p.waitForFunction(()=>document.querySelector('#heroLand').width===1672);await p.waitForTimeout(1600);
  const bounds=await p.evaluate(()=>{const h=document.querySelector('.hero').getBoundingClientRect(),l=document.querySelector('#heroLand').getBoundingClientRect();return{hero:h.toJSON(),land:l.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(Math.round(bounds.hero.height),height,'hero follows even a short landscape screen');assert.ok(!bounds.overflow);assert.ok(bounds.land.left<=0&&bounds.land.right>=width&&bounds.land.bottom>=height-1,'painting covers all lower edges');
  await p.screenshot({path:`${out}/home-${width}x${height}.png`});sizes.push({width,height});
 }
 await p.setViewportSize({width:1440,height:960});await p.goto(base+'/index.html');await p.waitForTimeout(1600);
 const to=async bottom=>{await p.evaluate(bottom=>scrollTo({top:document.querySelector('.story').offsetHeight-innerHeight*bottom,behavior:'instant'}),bottom);await p.waitForTimeout(650);return p.locator('#starFall').evaluate(el=>({p:+el.dataset.progress,a:+getComputedStyle(el).opacity,pixels:el.getContext('2d').getImageData(0,0,el.width,el.height).data.some((a,i)=>i%4===3&&a>0)}));};
 assert.equal((await to(1.5)).a,0,'no transition before the final chapter');
 const first=await to(.84),second=await to(.5);assert.ok(first.a>.8&&first.p>0&&first.p<second.p&&second.pixels,'the falling light renders as the story exits');await p.screenshot({path:out+'/fall-into-bio.png'});
 const back=await to(.84);assert.ok(back.p<second.p,'reversing the scroll reverses the descent');
 assert.equal((await to(-1)).a,0,'no fixed star overlay is left behind on the biography');
 assert.equal((await to(2)).a,0,'returning to the story clears the transition');
 await p.emulateMedia({reducedMotion:'reduce'});await p.reload();await p.waitForTimeout(500);await to(.5);assert.equal(await p.locator('.hero').evaluate(el=>el.style.getPropertyValue('--fall')),'0','reduced motion uses a quiet fade');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,sizes,transition:true,reversible:true,screenshots:out}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
