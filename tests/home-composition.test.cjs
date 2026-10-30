'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const scope={window:{}};
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('window.HOME_FRAME ='),end=html.indexOf('    (function ()',start);
assert.ok(start>=0&&end>start);
vm.runInNewContext(html.slice(start,end),scope);
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/cassini-flight.js'),'utf8'),scope);
const frame=scope.window.HOME_FRAME,{sample,view}=scope.window.CassiniFlight;
const sizes=[[320,568],[360,640],[375,667],[390,700],[390,844],[393,852],[412,915],[430,932],[540,720],[689,763],[768,1024],[820,1180],[568,320],[844,390],[932,430]];
function screen(q,p,w,h,F){const camera=view(p,w,h,F);return {x:camera.x+(q.x-573)*F.S*camera.zoom,y:camera.y+(q.y-318)*F.S*camera.zoom};}

test('The entire atmospheric passage and its core wake stay on screen, clear of phone chrome',()=>{
  for(const [w,h] of sizes){
    const F=frame(w,h);
    for(let p=.737;p<=.785;p+=.00025){
      const q=screen(sample(p,w<760),p,w,h,F),radius=30*F.S;
      assert.ok(q.x-radius>0&&q.x+radius<w,`${w}×${h} at ${p}: horizontal wake clearance`);
      assert.ok(q.y>90&&q.y+radius<h,`${w}×${h} at ${p}: entry below header and inside viewport`);
    }
  }
});
test('The traveller and full cat share the same fixed scene as the entry, with sky above and no bottom or side gaps',()=>{
  for(const [w,h] of sizes){
    const F=frame(w,h);
    assert.ok(F.left<=0&&F.left+F.IW*F.S>=w,'painting covers both sides');
    assert.ok(F.top+F.IH*F.S>=h-1e-9,'painting covers the bottom');
    for(const [x,y] of [[480,540],[610,780],[634,618],[750,753]]){
      const q=screen({x,y},.79,w,h,F);
      assert.ok(q.x>=0&&q.x<=w&&q.y>=0&&q.y<=h,`${w}×${h}: observer contour ${x},${y}`);
    }
    const initial={...F},camera=view(0,w,h,F);
    for(let i=0;i<=1000;i++){
      assert.deepEqual(view(i/1000,w,h,F),camera,'camera is independent of story progress');
      assert.deepEqual({...F},initial,'view never mutates the shared foreground frame');
    }
  }
});
test('The large opening spacecraft has a visible anchor in the portrait composition',()=>{
  for(const [w,h] of sizes.filter(([w,h])=>w<760&&h>w)){
    const F=frame(w,h),pose=sample(0,true),q=screen(pose,0,w,h,F);
    assert.ok(q.x>w*.55&&q.x<w*.82&&q.y>h*.35&&q.y<h*.75,`${w}×${h}: opening craft visible beside the observers`);
    assert.ok(pose.scale*F.S>.85,'opening retains a substantial on-screen scale');
  }
});
test('Wide desktop compositions retain their original framing',()=>{
  for(const [w,h] of [[1024,768],[1280,800],[1440,960],[1920,1080],[2560,1440]]){
    const S=Math.max(w/1672,h/941)*1.02,left=Math.min(0,Math.max(w-1672*S,w/2-836*S));
    assert.deepEqual({...frame(w,h)},{S,left,top:h-941*S,IW:1672,IH:941});
  }
});
