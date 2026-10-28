'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/ring-dynamics.js'),'utf8'),scope);
const {RingPatch}=scope.window.RingDynamics;
test('With no moonlet, Hill integration preserves the exact Kepler shear',()=>{
  const p=new RingPatch(500);p.setMass(0);
  // Keep particles away from the open boundaries for an exact trajectory check.
  for(let i=0;i<p.count;i++)p.y[i]=0;
  const x=Array.from(p.x);p.advance(.25);
  for(let i=0;i<p.count;i++){
    assert.ok(Math.abs(p.x[i]-x[i])<1e-11);
    assert.ok(Math.abs(p.y[i]+1.5*x[i]*.25)<1e-11);
    assert.ok(Math.abs(p.vx[i])<1e-11);
  }
});
test('A moonlet perturbs a passing stream; greater mass increases the gravity scale',()=>{
  const a=new RingPatch(1),b=new RingPatch(1),c=new RingPatch(1);
  a.setMass(0);b.setMass(1);c.setMass(4);
  for(const p of [a,b,c]){p.x[0]=2;p.y[0]=3;p.vx[0]=0;p.vy[0]=-3;p.advance(.25);}
  const distance=p=>Math.hypot(p.x[0]-a.x[0],p.y[0]-a.y[0]);
  assert.ok(distance(b)>.005);assert.ok(distance(c)>distance(b));
  assert.equal(b.hillRadius,1);assert.ok(Math.abs(c.hillRadius-Math.cbrt(4))<1e-12);
});
test('A long flow remains finite and bounded with zero, normal and heavy moonlets',()=>{
  for(const mass of [0,1,6]){
    const p=new RingPatch(400);p.setMass(mass);
    for(let step=0;step<150;step++)p.advance(.2);
    for(let i=0;i<p.count;i++){
      for(const key of ['x','y','vx','vy'])assert.ok(Number.isFinite(p[key][i]));
      assert.ok(Math.abs(p.x[i])<=p.width/2);assert.ok(Math.abs(p.y[i])<=p.length/2);
    }
  }
});
test('Reset restores seeded grains and the simulation is independent of frame partitions',()=>{
  const a=new RingPatch(100),b=new RingPatch(100),initial=Array.from(a.x);
  a.advance(.1);for(let i=0;i<4;i++)b.advance(.025);
  for(let i=0;i<a.count;i++)assert.ok(Math.hypot(a.x[i]-b.x[i],a.y[i]-b.y[i])<1e-10);
  a.reset();assert.deepEqual(Array.from(a.x),initial);assert.equal(a.time,0);
  a.setMass(NaN);assert.equal(a.mass,1);a.setMass(-2);assert.equal(a.mass,0);a.setMass(99);assert.equal(a.mass,6);
});

test('The physical clock and Hill scale use a plausible A-ring orbit',()=>{
  const {physical}=scope.window.RingDynamics,a=physical(1,Math.PI*2),b=physical(8);
  assert.ok(a.periodHours>13.2&&a.periodHours<13.4);
  assert.ok(Math.abs(a.elapsedHours-a.periodHours)<1e-10);
  assert.equal(a.hillMeters,100);assert.equal(b.hillMeters,200);
  assert.ok(Math.abs(b.massKg/a.massKg-8)<1e-12);
  const rho=a.massKg/(4*Math.PI/3*a.bodyMeters**3);
  assert.ok(rho>650&&rho<750,'body and Hill radius correspond to porous icy material');
});
test('Unforced epicycles and softly perturbed trajectories preserve their Jacobi integral',()=>{
  const {jacobi}=scope.window.RingDynamics;
  for(const mass of [0,1]){
    const p=new RingPatch(1);p.setMass(mass);p.x[0]=2;p.y[0]=3;p.vx[0]=.2;p.vy[0]=-2.8;
    const a=jacobi(p.x[0],p.y[0],p.vx[0],p.vy[0],mass);
    p.advance(.3);const b=jacobi(p.x[0],p.y[0],p.vx[0],p.vy[0],mass);
    assert.equal(p.generation[0],0);assert.ok(Math.abs(a-b)<1e-6);
  }
});
test('Density measures particle counts relative to the mean, without altering the flow',()=>{
  const {density}=scope.window.RingDynamics,nx=16,ny=32,p=new RingPatch(nx*ny);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const i=y*nx+x;p.x[i]=((x+.5)/nx-.5)*p.width;p.y[i]=((y+.5)/ny-.5)*p.length;
  }
  const before=Array.from(p.x),map=density(p,nx,ny);
  assert.equal(map.values.length,nx*ny);for(const value of map.values)assert.equal(value,1);
  assert.deepEqual(Array.from(p.x),before);
  p.x.fill(0);p.y.fill(0);const clump=density(p,nx,ny);
  assert.ok(Math.max(...clump.values)>1);assert.ok(clump.values[0]===0);
});
test('Integrated streamline overlays follow circular shear without a moonlet and bend with gravity',()=>{
  const {streamline}=scope.window.RingDynamics,a=streamline(0,2),b=streamline(3,2);
  assert.ok(a.points.length>100&&b.points.length>100);
  assert.ok(a.points.every(p=>Math.abs(p[0]-2)<1e-10));
  assert.ok(b.points.some(p=>Math.abs(p[0]-2)>.2));
  for(const trace of [a,b])for(let i=1;i<trace.points.length;i++){
    const p=trace.points[i],q=trace.points[i-1];
    assert.ok(p.every(Number.isFinite));assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])<2,'no recycled grain jumps through the overlay');
  }
});

test('Density averaging keeps experiment and control separate and discards stale reset samples',()=>{
  const science=fs.readFileSync(path.join(__dirname,'../js/ring-science.js'),'utf8').replace(/export /g,'');
  vm.runInNewContext(science,scope);
  const average=scope.createDensityAverage(),a=new RingPatch(100),b=new RingPatch(100);b.setMass(0);
  const ca=average(a),cb=average(b);assert.notEqual(ca,cb);
  a.advance(.3);assert.equal(average(a).frames.length,2);assert.equal(average(b).frames.length,1);
  a.reset();assert.equal(average(a).frames.length,1);
  a.setMass(2);assert.equal(average(a).frames.length,1);assert.equal(average(a).mass,2);
});

test('Control flow carries boundary overshoot without timestep-dependent artificial bands',()=>{
  const a=new RingPatch(300),b=new RingPatch(300);a.setMass(0);b.setMass(0);
  for(let j=0;j<20;j++){a.advance(.6);for(let k=0;k<24;k++)b.advance(.025);}
  for(let i=0;i<a.count;i++)assert.ok(Math.abs(a.y[i]-b.y[i])<1e-9,'same position after boundary crossings at either time resolution');
});
