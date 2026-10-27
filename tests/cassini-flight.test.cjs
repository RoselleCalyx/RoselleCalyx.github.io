'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/cassini-flight.js'),'utf8'),context);
const {orbit,sample,view}=context.window.CassiniFlight;
test('Kepler orbit preserves radius in the three-dimensional projection',()=>{
  for(let i=0;i<200;i++){
    const q=orbit(i*Math.PI/100);
    assert.ok(Math.abs(Math.hypot(q.x-573,q.y-318,q.z)-q.r)<1e-8);
  }
  assert.ok(Math.abs(orbit(0).r-1.085*262)<1e-8);
  assert.ok(Math.abs(orbit(Math.PI).r-3.65*262)<1e-8);
});
test('Equal mission-time steps preserve swept area outside the atmosphere',()=>{
  const h=1e-5,areas=[];
  for(let mean=.2;mean<6;mean+=.2){
    const a=orbit(mean),b=orbit(mean+h);
    const x=a.x-573,y=a.y-318,z=a.z;
    const vx=(b.x-a.x)/h,vy=(b.y-a.y)/h,vz=(b.z-a.z)/h;
    areas.push(Math.hypot(y*vz-z*vy,z*vx-x*vz,x*vy-y*vx));
  }
  assert.ok(Math.max(...areas)/Math.min(...areas)<1.0001);
});
test('Atmospheric drag carries the spacecraft inward without an exit flyby',()=>{
  let previous=sample(.737).r;
  for(let p=.7375;p<=.81;p+=.0005){
    const q=sample(p);assert.ok(q.r<previous);previous=q.r;
    assert.ok(Number.isFinite(q.motionAngle));
  }
});
test('Orbit reveal, Titan transition and atmospheric entry have no position jumps',()=>{
  for(const mobile of [true,false])for(const p of [.19,.5,.72,.737]){
    const a=sample(p-1e-7,mobile),b=sample(p+1e-7,mobile);
    assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<.01);
    assert.ok(Math.abs(b.scale-a.scale)<.001);
  }
});
test('Camera preserves the complete painting throughout the flight on phone and desktop',()=>{
  for(const [w,h] of [[320,568],[689,763],[1440,960]]){
    const F={left:0,top:0,S:w/1672};
    let previous=view(0,w,h,F);
    for(let i=1;i<=1000;i++){
      const q=view(i/1000,w,h,F);assert.ok(q.zoom>0);
      assert.ok(Math.hypot(q.x-previous.x,q.y-previous.y)<15);
      assert.deepEqual(q,view(0,w,h,F));previous=q;
    }
  }
});

test('Antenna tracks the fixed Earth direction throughout controlled flight',()=>{
  const {attitude,earthDirection}=context.window.CassiniFlight;
  for(let p=0;p<=.768;p+=.0005){
    const [x,y,z,w]=attitude(p);
    assert.ok(Math.abs(Math.hypot(x,y,z,w)-1)<1e-12,'attitude is a unit quaternion');
    // Transform the model's +Y antenna normal by the quaternion.
    const normal=[2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)];
    assert.ok(Math.hypot(...normal.map((n,i)=>n-earthDirection[i]))<1e-12);
  }
});
test('Attitude is independent of orbital velocity and only tumbles after signal loss',()=>{
  const {attitude,earthDirection}=context.window.CassiniFlight;
  assert.notEqual(sample(.2).motionAngle,sample(.4).motionAngle);
  assert.equal(sample(.2).angle,sample(.4).angle);
  const [x,y,z,w]=attitude(.79);
  const normal=[2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)];
  assert.ok(Math.hypot(...normal.map((n,i)=>n-earthDirection[i]))>.1);
  for(const p of [.19,.5,.737,.768,.795]){
    const a=attitude(p-1e-7),b=attitude(p+1e-7);
    assert.ok(Math.hypot(...a.map((n,i)=>n-b[i]))<.0001);
  }
});

test('Atmospheric light stays absent in vacuum and builds before structural breakup',()=>{
  const {entryEffects}=context.window.CassiniFlight;
  for(let p=0;p<=.737;p+=.001){
    const e=entryEffects(p);
    assert.equal(e.sheath,0);assert.equal(e.plume,0);
    assert.equal(e.breakup,0);assert.equal(e.hull,1);
  }
  const first=entryEffects(.742),heated=entryEffects(.76),signal=entryEffects(.77);
  assert.ok(first.sheath>0);assert.equal(first.plume,0);
  assert.ok(heated.plume>first.plume);assert.ok(signal.plume>heated.plume);
  assert.equal(signal.breakup,0);assert.equal(signal.hull,1);
  assert.ok(entryEffects(.79).breakup>0);
});
test('Incandescent wake outlasts the hull and fades into a longer ember afterglow',()=>{
  const {entryEffects}=context.window.CassiniFlight;
  assert.equal(entryEffects(.806).hull,0);
  assert.ok(entryEffects(.806).fade>.9);
  assert.equal(entryEffects(.866).fade,0);
  assert.ok(entryEffects(.866).embers>0);
  assert.equal(entryEffects(.892).embers,0);
});
test('Entry brightness and visibility stay bounded and continuous when scrubbing',()=>{
  const {entryEffects}=context.window.CassiniFlight;
  let previous=entryEffects(0);
  for(let i=1;i<=10000;i++){
    const e=entryEffects(i/10000);
    for(const k of Object.keys(e)){
      assert.ok(e[k]>=0&&e[k]<=1);
      assert.ok(Math.abs(e[k]-previous[k])<.012);
    }
    previous=e;
  }
  for(const p of [.737,.744,.751,.773,.782,.795,.805,.808,.817,.865,.891]){
    const a=entryEffects(p-1e-7),b=entryEffects(p+1e-7);
    for(const k of Object.keys(a))assert.ok(Math.abs(a[k]-b[k])<.0001);
  }
});
