const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(readFileSync(require('node:path').join(__dirname, '../js/farm-motion.js'), 'utf8'), context);
const m = context.window.FarmMotion;
for (const [species, gait] of Object.entries(m.GAITS)) {
  assert.equal(m.advance(.4, 0, 100, species), .4, 'holding still must not advance feet');
  const phase = m.advance(0, 100 * gait.stride / gait.frames, 100, species);
  assert.equal(m.frame(phase + 1e-9, species), 1, 'one frame covers its share of a stride');
  assert.ok(Math.abs(m.advance(.25, 100 * gait.stride, 100, species) - .25) < 1e-9, 'a stride must close the loop');
  assert.equal(m.advance(.3, 0, 0, species), .3, 'a hidden/zero-size actor keeps its phase');
  assert.equal(m.position(1 - 1e-8, species), 100, 'last frame must stay inside the sheet');
  assert.equal(m.position(1, species), 0, 'loop must wrap to frame zero');
}
const takeoff = m.travel(0, 2.4, 20, .1);
assert.ok(takeoff.speed > 0 && takeoff.speed < 2.4, 'start gradually');
assert.ok(takeoff.distance > 0 && takeoff.distance < .24);
assert.ok(m.travel(2.4, 2.4, .05, .1).speed < 2.4, 'slow down approaching the destination');
assert.equal(m.travel(0, 2.4, 10, 0).distance, 0, 'paused time does not move an animal');
assert.ok(m.travel(2.4, 2.4, .001, .1).distance <= .001, 'never overshoot the destination');
function simulate(hz) {
  let remaining = 6, speed = 0, phase = 0;
  for (let t = 0; t < hz * 10 && remaining > 1e-7; t++) {
    const move = m.travel(speed, 2.4, remaining, 1 / hz);
    speed = move.speed; remaining -= move.distance;
    phase = m.advance(phase, move.distance, 11, 'snowcat');
  }
  return { remaining, phase };
}
const a = simulate(30), b = simulate(60);
assert.ok(a.remaining < 1e-7 && b.remaining < 1e-7);
assert.ok(Math.abs(a.phase - b.phase) < 1e-7, 'same path must have the same gait phase at 30 and 60 fps');
console.log('Farm motion passed: all eight species, distance/phase, loop bounds, acceleration, braking, pause and frame-rate independence.');
