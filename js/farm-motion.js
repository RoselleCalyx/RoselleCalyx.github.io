/* Distance-driven gait: one cycle covers a species-specific fraction of its
   on-screen square. Feet slow down with the animal, including on detours. */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const GAITS = {
    snowcat: { frames: 8, stride: .23, scale: 1.25, baseline: .9375, src: 'assets/farm/walk/snowcat-v2.webp' },
    rabbit: { frames: 6, stride: .46, scale: 1.2, baseline: 353 / 384 },
    panda: { frames: 6, stride: .18, scale: 1.3, baseline: 353 / 384 },
    fox: { frames: 6, stride: .30, scale: 1.38, baseline: 353 / 384 },
    shiba: { frames: 6, stride: .27, scale: 1.3, baseline: 353 / 384 },
    hedgehog: { frames: 6, stride: .14, scale: 1.3, baseline: 353 / 384 },
    duckling: { frames: 6, stride: .25, scale: 1.2, baseline: 353 / 384 },
    penguin: { frames: 6, stride: .19, scale: 1.2, baseline: 353 / 384 }
  };
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
  function travel(speed, cruise, distance, dt) {
    const acceleration = cruise * 2.8;
    const target = Math.min(cruise, Math.sqrt(Math.max(0, 2 * acceleration * distance)));
    const next = speed + clamp(target - speed, -acceleration * dt, acceleration * dt);
    return { speed: next, distance: Math.min(distance, Math.max(0, (speed + next) * .5 * dt)) };
  }
  window.FarmMotion = { GAITS, advance, frame, position, travel };
})();
