'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/home-life.js'),'utf8'),scope);
const {displacement,motions}=scope.window.HomeLife;
test('Face, boots and rock anchors remain still while hair and cat breathe',()=>{
  let hair=0,cat=0;
  for(let t=0;t<100;t+=.25){
    for(const [x,y] of [[575,360],[612,530],[680,650]])assert.ok(Math.hypot(...displacement(x,y,t))<.035,`${x},${y} stays anchored`);
    hair=Math.max(hair,Math.hypot(...displacement(485,421,t)));
    cat=Math.max(cat,Math.hypot(...displacement(680,510,t)));
  }
  assert.ok(hair>1.5&&hair<3);assert.ok(cat>.07&&cat<.4);
});
test('The painting has bounded, continuous motion and reduced motion is exactly still',()=>{
  for(const [x,y] of [[485,421],[544,438],[665,510],[634,448],[185,438],[277,476]]){
    let previous=displacement(x,y,0);
    for(let t=.01;t<20;t+=.01){
      const q=displacement(x,y,t);
      assert.ok(Math.hypot(...q)<3);assert.ok(Math.hypot(q[0]-previous[0],q[1]-previous[1])<.05);
      assert.ok(displacement(x,y,t,true).every(v=>v===0));previous=q;
    }
  }
  assert.ok(motions(19,true).flat().every(v=>v===0));
});
