// Browser regressions for ground occlusion and the cover's return to the deck.
// Private state is exposed only in intercepted test responses.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4173',out='/tmp/wild-depth-qa';
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{
      window.__drawOrder=[];window.__coverFrames=[];window.__dockDrawn=false;window.__restTrapDrawn=false;
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
        const scene=this.canvas.id==='scene',state=window.__woodDepth||window.__pondDepth;
        if(scene&&state){
          if(source===state.bg){__drawOrder=[];__dockDrawn=false;__restTrapDrawn=false;}
          if(source===state.fg){__drawOrder.push('foreground');__dockDrawn=true;}
          if(source.src?.endsWith('/trap.webp')&&__dockDrawn)__restTrapDrawn=true;
          if(source.src)__drawOrder.push(source.src.split('/').pop());
        }
        const result=draw.call(this,source,...args);
        if(scene&&source.src?.endsWith('/fish-cover-v2.webp')){
          const [left,top,w,h]=args;
          __coverFrames.push({x:left+w/2,y:top+h,w,h,phase:window.__pondDepth?.phase||'rest',aboveDock:__dockDrawn,aboveRestTrap:__restTrapDrawn});
        }
        return result;
      };
    });
    await p.route('**/js/woods.js*',async route=>{
      const s=await fs.readFile(path.join(root,'js/woods.js'),'utf8'),i=s.lastIndexOf('})();');
      const hook='window.__woodDepth={bg,fg,ctx,P,LANTERN,get k(){return k;},get items(){return items;},render(){draw(0);}};';
      await route.fulfill({contentType:'application/javascript',body:s.slice(0,i)+hook+s.slice(i)});
    });
    await p.goto(base+'/woods.html?season=summer');
    await p.waitForFunction(()=>document.querySelector('#stage').dataset.lantern==='material'&&WoodsObjects.loaded()===45&&document.querySelector('#stage').dataset.texture==='illustrated');
    const occlusion=await p.evaluate(()=>{
      const s=__woodDepth,[x,y]=s.P(s.LANTERN.u,s.LANTERN.v),k=s.k;
      const sample=()=>Array.from(s.ctx.getImageData(Math.round(x-3*k),Math.round(y-26*k),Math.max(1,Math.round(6*k)),Math.max(1,Math.round(17*k))).data);
      const fixture=(v,g)=>s.items.splice(0,s.items.length,{id:'porcini',u:s.LANTERN.u,v,g,s:85*k,born:-10,variant:0,flip:1,cover:null,matured:true});
      s.items.splice(0);s.render();const baseline=sample(),behind=[];
      for(const growth of [.05,.5,1]){
        fixture(s.LANTERN.v-.01,growth);s.render();const pixels=sample();
        behind.push({growth,maxPixelChange:Math.max(...pixels.map((n,i)=>Math.abs(n-baseline[i]))),order:[...__drawOrder]});
      }
      fixture(s.LANTERN.v+.01,1);s.render();const front=sample();
      return {behind,frontChange:Math.max(...front.map((n,i)=>Math.abs(n-baseline[i]))),frontOrder:[...__drawOrder]};
    });
    for(const state of occlusion.behind){
      assert.ok(state.maxPixelChange<=4,`growth ${state.growth} behind the post must not paint over it (${state.maxPixelChange})`);
      assert.ok(state.order.indexOf('porcini-shape1-v1.webp')<state.order.indexOf('woods-lamp-post-v1.webp'));
    }
    assert.ok(occlusion.frontChange>25,'a foreground mushroom must visibly occlude the post');
    assert.ok(occlusion.frontOrder.indexOf('porcini-shape1-v1.webp')>occlusion.frontOrder.indexOf('woods-lamp-post-v1.webp'));
    await p.screenshot({path:out+'/woods-front.png',fullPage:true});
    await p.evaluate(()=>{__woodDepth.items[0].v=__woodDepth.LANTERN.v-.01;__woodDepth.render();});
    await p.screenshot({path:out+'/woods-behind.png',fullPage:true});
    await p.route('**/js/pond.js*',async route=>{
      const s=await fs.readFile(path.join(root,'js/pond.js'),'utf8'),i=s.lastIndexOf('})();');
      const hook=`window.__pondDepth={bg,fg,shots:{},get phase(){return net?.phase;}};
        const depthDraw=draw;draw=function(dt){depthDraw(dt);const state=window.__pondDepth,age=net?.phase==='pull'?time-net.t2:-1;
          for(const [name,at] of [['lift',.2],['carry',.8],['land',1.4]])if(age>=at&&!state.shots[name])state.shots[name]=cv.toDataURL();
          if(!net&&state.shots.land&&!state.shots.rest)state.shots.rest=cv.toDataURL();};`;
      await route.fulfill({contentType:'application/javascript',body:s.slice(0,i)+hook+s.slice(i)});
    });
    for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
      await p.setViewportSize(viewport);await p.goto(base+'/pond.html?season=summer');
      await p.waitForFunction(()=>PondEquipment.ready&&document.querySelector('#stage').dataset.texture==='illustrated');
      await p.locator('[data-tool="net"]').click();const rect=await p.locator('#scene').boundingBox();
      await p.mouse.click(rect.x+rect.width*.45,rect.y+rect.height*.65);
      await p.waitForFunction(()=>__pondDepth.shots.rest);
      const frames=await p.evaluate(()=>__coverFrames),lastPull=frames.findLastIndex(f=>f.phase==='pull'),landed=frames[lastPull+1];
      assert.ok(frames.filter(f=>['fly','sink','pull'].includes(f.phase)).every(f=>f.aboveDock),'the moving cover must not pass underneath the dock layer');
      assert.ok(frames.filter(f=>f.phase==='pull').every(f=>f.aboveRestTrap),'the retrieved cover must be drawn above the resting trap');
      assert.equal(landed.phase,'rest');
      for(const property of ['x','y','w','h'])assert.ok(Math.abs(frames[lastPull][property]-landed[property])<2,`no ${property} jump when the cover lands`);
      const shots=await p.evaluate(()=>__pondDepth.shots);
      for(const [name,data] of Object.entries(shots))await fs.writeFile(`${out}/pond-${viewport.width}-${name}.png`,Buffer.from(data.split(',')[1],'base64'));
      await p.locator('[data-release]').click();await p.locator('#card').waitFor({state:'hidden'});
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,behindGrowth:occlusion.behind.map(s=>({growth:s.growth,maxPixelChange:s.maxPixelChange})),frontPixelChange:occlusion.frontChange,cover:'above dock throughout, continuous landing on desktop and mobile',screenshots:out}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
