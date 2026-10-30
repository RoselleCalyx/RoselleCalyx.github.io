'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/cassini-flight.js'),'utf8'),context);
const {orbit,sample,view,illumination}=context.window.CassiniFlight;
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
test('Scene light follows the craft: sunset rim, Saturn eclipse and entry heat',()=>{
  const at=p=>illumination(sample(p),p);
  const opening=at(0),entry=at(.775);
  // Every lap of the far passage crosses Saturn's shadow once.
  const lit=[];for(let p=.19;p<=.5;p+=.005)lit.push(at(p).lit);
  const passages=lit.filter((v,i)=>v<.3&&!(lit[i-1]<.3)).length;
  assert.equal(passages,context.window.CassiniFlight.LAPS);
  const shadow=at(.24);
  assert.equal(opening.lit,1);assert.equal(opening.heat,0);
  // The far passage crosses Saturn's shadow; the light dims but never vanishes.
  assert.ok(shadow.lit<.3&&shadow.lit>=.14);
  assert.ok(entry.heat>.9);
  for(const q of [opening,shadow,entry])for(const v of [q.sun,q.planet,q.motion])
    assert.ok(Math.abs(Math.hypot(...v)-1)<1e-9);
  // The horizon sun lies beyond the painting, so the craft is backlit.
  assert.ok(opening.sun[2]<0);
});
test('Titan passes Cassini at the final flyby beat and its light peaks then',()=>{
  const {titan}=context.window.CassiniFlight;
  const gap=p=>{const t=titan(p),s=sample(p);return Math.hypot(t.x-s.x,t.y-s.y);};
  assert.ok(gap(.49)<120,'Titan sits beside Cassini at 11 September');
  assert.ok(gap(.2)>500&&gap(.7)>300,'and is far away before and after');
  const shine=p=>illumination(sample(p),p).titanshine;
  assert.ok(shine(.52)>.9&&shine(.2)<.1);
  // The flyby happens above the painted horizon (row 602), so it is visible.
  assert.ok(titan(.49).y<590);
});
test('Grand Finale petals keep the orbit size while precessing',()=>{
  for(const omega of [-.15,0,.15])for(let i=0;i<40;i++){
    const q=orbit(i*Math.PI/20,1.03,omega);
    assert.ok(Math.abs(Math.hypot(q.x-573,q.y-318,q.z)-q.r)<1e-8);
  }
  assert.notEqual(orbit(1,1.03,.1).x.toFixed(3),orbit(1,1.03,0).x.toFixed(3));
});
test('Extra laps speed up smoothly and still meet Titan at apocentre',()=>{
  const {lapClock,LAPS}=context.window.CassiniFlight;
  assert.ok(Math.abs(lapClock(.5)-LAPS)<1e-12,'apocentre at p = .5');
  const rate=p=>(lapClock(p+1e-5)-lapClock(p))/1e-5;
  assert.ok(Math.abs(rate(.18)-2)<1e-3&&Math.abs(rate(.499)-2)<1e-2,'base rate at both ends');
  for(let p=0;p<.5;p+=.01)assert.ok(rate(p+.01)/rate(p)<1.6,'no sudden speed jumps');
  const a=sample(.4999),b=sample(.5001);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<2);
});
test('Enceladus orbits between the rings and Titan, tidally locked to Saturn',()=>{
  const {enceladus,titan}=context.window.CassiniFlight;
  const radius=q=>Math.hypot(q.x-573,(q.y-318),q.z);
  for(let p=0;p<1;p+=.05){
    const e=enceladus(p),t=titan(p);
    // The projected ellipse of Enceladus lies outside the A ring (2.27 R).
    const u=(e.x-573)*Math.cos(.31)+(e.y-318)*Math.sin(.31),v=-(e.x-573)*Math.sin(.31)+(e.y-318)*Math.cos(.31);
    assert.ok(Math.hypot(u/262,v/(262*Math.sin(.33)))>2.27);
    assert.ok(radius(e)<radius(t));
  }
  // Locked rotation: the face toward the viewer turns once per orbit.
  const a=enceladus(0),b=enceladus(1/3);
  assert.ok(Math.abs(((b.face-a.face)%(2*Math.PI)+2*Math.PI)%(2*Math.PI))<1e-9);
  const q=enceladus(1/12);assert.ok(Math.abs(Math.abs(q.face-a.face)-Math.PI/2)<1e-9||Math.abs(Math.abs(q.face-a.face)-1.5*Math.PI)<1e-9);
});
