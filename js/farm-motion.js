/* Distance-driven gait: one cycle covers a species-specific fraction of its
   on-screen square. Feet slow down with the animal, including on detours. */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const GAITS = {
    snowcat: { frames: 8, stride: .23, scale: 1.25, baseline: .9375, src: 'assets/farm/walk/snowcat-v2.webp' },
    rabbit: { frames: 6, stride: .46, scale: 1.2, baseline: 353 / 384 },
    panda: { frames: 6, stride: .18, scale: 1.3, baseline: 353 / 384 },
    fox: { frames: 6, stride: .36, scale: 1.38, baseline: 353 / 384 },
    shiba: { frames: 6, stride: .42, scale: 1.3, baseline: 353 / 384 },
    hedgehog: { frames: 6, stride: .23, scale: 1.3, baseline: 353 / 384 },
    duckling: { frames: 6, stride: .36, scale: 1.2, baseline: 353 / 384 },
    penguin: { frames: 6, stride: .22, scale: 1.2, baseline: 353 / 384 }
  };
  Object.entries(GAITS).forEach(([sp,g])=>{g.frames=12;g.src=`assets/farm/walk/${sp}-v3.webp`;g.baseline=360/384;});
  // A rabbit travels in bounds, not a quadruped walking cycle.
  GAITS.rabbit.frames=8;GAITS.rabbit.src='assets/farm/jump/rabbit-v3.webp';
  GAITS.panda.src='assets/farm/walk/panda-v4.webp';
  Object.assign(GAITS, {
    redpanda: { frames: 6, stride: .28, scale: 1.25, baseline: 360 / 384, src: 'assets/farm/walk/redpanda-v2.webp' },
    raccoon: { frames: 6, stride: .3, scale: 1.25, baseline: 360 / 384 },
    wolf: { frames: 6, stride: .36, scale: 1.25, baseline: 360 / 384 },
    crocodile: { frames: 6, stride: .4, scale: 1.45, baseline: 360 / 384 },
    fennec: { frames: 6, stride: .38, scale: 1.25, baseline: 360 / 384 }
  });
  function leap(progress){
    const f=clamp(progress,0,1)*7,index=Math.floor(f),blend=f-index;
    return {frame:index,next:Math.min(7,index+1),blend:blend*blend*(3-2*blend)};
  }
  function advance(phase, distance, square, species) {
    const gait = GAITS[species];
    if (!gait || square <= 0 || distance <= 0) return phase;
    return (phase + distance / (square * gait.stride)) % 1;
  }
  function frame(phase, species) {
    return Math.min(GAITS[species].frames - 1, Math.floor(((phase % 1 + 1) % 1) * GAITS[species].frames));
  }
  function position(phase, species) {
    return frame(phase, species) * 100 / (GAITS[species].frames - 1);
  }
  function sample(phase, species) {
    const frames=GAITS[species].frames, f=((phase%1+1)%1)*frames;
    const blend=clamp((f%1-.62)/.38,0,1);
    return {frame:Math.floor(f),next:(Math.floor(f)+1)%frames,blend:blend*blend*(3-2*blend)};
  }
  function travel(speed, cruise, distance, dt) {
    const acceleration = cruise * 2.8;
    const target = Math.min(cruise, Math.sqrt(Math.max(0, 2 * acceleration * distance)));
    const next = speed + clamp(target - speed, -acceleration * dt, acceleration * dt);
    return { speed: next, distance: Math.min(distance, Math.max(0, (speed + next) * .5 * dt)) };
  }
  window.FarmMotion = { GAITS, advance, frame, position, sample, leap, travel };
})();
