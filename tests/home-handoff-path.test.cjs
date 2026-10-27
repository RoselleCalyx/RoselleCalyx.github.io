'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/saturn.js'), 'utf8');
const start = source.indexOf('  function handoffPose(');
const end = source.indexOf('  function drawHandoff(', start);
assert.ok(start >= 0 && end > start, 'exercise the production falling-remnant path');
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function pathFor(width, height, dpr) {
  // Deliberately far from the old 52%-of-screen destination to expose diagonal drift.
  const sx = width * .31 * dpr, sy = height * .23 * dpr;
  const endY = height * .78 * dpr;
  const context = { Math, smooth, dpr, p: 1,
    burnFlight: () => ({ x: sx, y: sy }), P: (x, y) => [x, y],
    cvFall: { width: width * dpr, height: height * dpr }, descent: { endY } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.pose = handoffPose;', context);
  return { pose: context.pose, sx, sy, endY };
}

const sizes = [[320, 568], [390, 844], [844, 390], [1440, 960], [2560, 1080]];
const densities = [.8, 1, 1.5, 2, 3];
const samples = Array.from({ length: 201 }, (_, i) => i / 200);

test('Home remnant falls straight down without horizontal motion across screens and zoom', () => {
  for (const [width, height] of sizes) for (const dpr of densities) {
    const { pose, sx, sy, endY } = pathFor(width, height, dpr);
    const first = pose(0, false);
    assert.equal(first.x, sx); assert.equal(first.y, sy);
    let previousY = sy;
    for (const q of samples) {
      const current = pose(q, false);
      assert.equal(current.x, sx, `${width}x${height} @${dpr}, q=${q}: horizontal position stays fixed`);
      assert.ok(current.y >= previousY, 'vertical motion stays downward');
      assert.ok(current.y <= endY + 1e-9, 'path stops at the biography clearance altitude');
      previousY = current.y;
    }
    assert.ok(Math.abs(pose(1, false).y - endY) < 1e-9, 'endpoint matches the biography clearance altitude');
    assert.equal(pose(1, false).x, sx, 'descent ends directly below its starting point');
  }
});

test('Home calm mode retains the burn position across screens and zoom', () => {
  for (const [width, height] of sizes) for (const dpr of densities) {
    const { pose, sx, sy } = pathFor(width, height, dpr);
    for (const q of samples) {
      const current = pose(q, true);
      assert.equal(current.x, sx); assert.equal(current.y, sy);
    }
  }
});

test('Home path reverses deterministically when visitors scroll back', () => {
  for (const [width, height] of sizes) for (const dpr of densities) {
    const { pose } = pathFor(width, height, dpr);
    const forward = samples.map(q => pose(q, false));
    for (let i = samples.length - 1; i >= 0; i--) {
      const reverse = pose(samples[i], false);
      assert.equal(reverse.x, forward[i].x);
      assert.equal(reverse.y, forward[i].y);
      assert.equal(reverse.scale, forward[i].scale);
    }
  }
});

test('The last ember stays fully visible until the actual border is nearby', () => {
  const scope={smooth,Math};
  vm.runInNewContext(source.slice(start,end)+'\nthis.fade=handoffFade;',scope);
  for(const gap of [24,32,48,80,200])assert.equal(scope.fade(gap),1);
  assert.equal(scope.fade(12),.5);
  assert.equal(scope.fade(0),0);
  assert.equal(scope.fade(-30),0);
  let previous=0;
  for(let gap=0;gap<=24;gap+=.05){
    const a=scope.fade(gap);
    assert.ok(a>=previous&&a-previous<.004,'the last 24 pixels fade smoothly');
    previous=a;
  }
});

test('Descent meets the real biography edge on phone and desktop before fading out', () => {
  const geometryStart=source.indexOf('  function descentGeometry()');
  const geometryEnd=source.indexOf('  function readScroll()',geometryStart);
  for(const [vw,vh] of sizes)for(const dpr of densities){
    const S=vw/1672,story={offsetHeight:vh*6},anchor={offsetTop:vh*6+260};
    const scope={Math,smooth,vw,vh,dpr,p:1,SAT:{x:573,y:318},FINAL_ENTRY:.785,
      F:{left:0,top:0,S},story,cvFall:{height:vh*dpr},
      documentTop:el=>el===story?0:el.offsetTop,descentAnchor:()=>anchor,
      burnFlight:()=>({x:480,y:220}),P:(x,y)=>[x*S*dpr,y*S*dpr],
      CassiniFlight:{view:()=>({x:573*S,y:318*S,zoom:1})}};
    vm.runInNewContext(source.slice(geometryStart,geometryEnd)+source.slice(start,end)+
      '\nthis.descent=descentGeometry();this.pose=handoffPose;this.fade=handoffFade;',scope);
    const g=scope.descent,stop=scope.pose(1,false),scrollEnd=g.start+g.distance;
    assert.equal(g.clearance,2);
    assert.ok(Math.abs(g.border-scrollEnd-stop.y/dpr-2)<1e-9);
    let previous=0;
    for(let q=.8;q<=1;q+=.001){
      const scroll=g.start+g.distance*q,y=scope.pose(q,false).y/dpr;
      const gap=g.border-scroll-g.clearance-y;
      if(gap>=24)assert.equal(scope.fade(gap),1,'no premature fade in open space');
      assert.ok(y>=previous);previous=y;
    }
    const terminalGap=g.border-scrollEnd-g.clearance-stop.y/dpr;
    assert.ok(scope.fade(terminalGap)<1e-20,'the light is gone at contact');
  }
});
