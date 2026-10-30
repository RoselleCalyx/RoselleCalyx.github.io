# Living overlook and Among the Rings

## Entry points

- `/index.html`: tiny wind, breathing and entry light within the original painting.
  Click an unobstructed part of Saturn, or the keyboard-accessible “Explore the
  rings” link, to enter the observatory.
- `/rings.html`: a separate, immediately interactive ring close-up.
  Drag or use arrow keys to turn; wheel or the labelled buttons change distance.
  Among the ice / From above changes the view, with mass and time-flow controls,
  pause, reset and a collapsible control panel. Natural light, Trajectories and
  Density reveal different aspects of the same simulation.
  **Release dye line** (or key D) drops two lines of tracer grains upstream; they
  obey the same Hill equations and show shear, the propeller streams and horseshoe
  turnarounds. A live overhead radar plots the actual particles, Hill sphere and dye.

  Backdrop: Saturn uses banded clouds with a soft terminator, a cold limb and the
  rings' shadow traced along the sunbeam. The ring system follows the C, B and A
  rings, Cassini Division, Encke and Keeler gaps and F ring in units of 886 km,
  with Saturn's shadow and forward-scattered glow; ringlet texture is procedural.
  The simulated window sits at 130,000 km. Grain tumbling, context ice and sunlit
  dust run in shaders; per frame the CPU only writes each grain's position.
  **Compare with Cassini** opens a card pairing a live, time-averaged density
  snapshot of the model (turned to the same diagonal) with Cassini's PIA12790
  image of the “Earhart” propeller beside the Encke Gap (NASA/JPL/SSI, loaded
  from NASA). Shapes are comparable; sizes are not.
- `/enceladus.html`: Field station 02. Ice grains leave vents along four tiger
  stripes and follow the same local Hill equations in Enceladus's frame (Hill
  radius about 950 km, escape speed about 239 m/s). Slow grains fall back; fast
  grains leave the Hill sphere and are sheared into the E-ring stream. A haze and
  the grains brighten by forward scattering when you look toward the Sun. Jet
  speed, time flow, “Show fates” colouring and an E-ring view are available.

## The existing painting

`js/home-life.js` uploads the feathered original landscape. Eight smooth, bounded
source-space motion fields move hair, cloth, cat breathing/ear and flower groups.
A shared spatially delayed breeze also shifts distant clouds. The face, boots and
rock anchors remain still; the full-scene camera and Cassini trajectory are unchanged.
Cat breathing is a tiny periodic expansion rather than vertical floating.

The exact same displacement samples the foreground-contour texture into an
updated mask, so moved silhouettes still occlude Cassini and ring particles.
Atmospheric entry adds a restrained, distance-attenuated warm fill and edge light
on the traced foreground surfaces. This is an artistic light response, not a
physically recovered exposure. Calm sky and system reduced motion suppress the
micro-movements. Rendering is cached at 30 Hz, or until light changes in calm mode;
missing/lost WebGL keeps the original static landscape visible.

## A local ring simulation

`js/ring-dynamics.js` integrates the dimensionless Hill equations in a rotating
Keplerian patch, with a softened moonlet potential and fourth-order Runge–Kutta:

```
x'' = 2 y' + 3 x - mu x / (x² + y² + epsilon²)^(3/2)
y'' = -2 x'     - mu y / (x² + y² + epsilon²)^(3/2)
mu = 3 × relative moonlet mass
```

Zero mass uses the exact unforced epicyclic solution, preserving circular shear
`x'=0, y'=-1.5x` and any previously acquired free oscillation. The Hill length
scales with the cube root of moonlet mass. Grains leaving this open local window
or reaching the moonlet surface are replenished from the upstream boundary;
crossing overshoot is retained to avoid timestep-dependent bands.
Grain-to-grain collisions, grain self-gravity and true mission ephemerides are
omitted. Time is compressed and visible grain dimensions enhanced for legibility. The panel's
“What am I seeing?” explains these limits, rather than presenting the picture as
an exact Cassini reconstruction.

The physical calibration uses a 130,000 km orbital radius and Saturn's JPL
gravitational parameter of 37,931,206.23 km³/s². One orbit takes about 13.3 hours;
the illustrative default Hill radius is 100 m. A moonlet surface at 0.64 Hill
radii gives a plausible bulk density near 700 kg/m³. The elapsed clock, selected
grain distance and departure from circular shear use these same units.

`js/ring-science.js` supplies the optional instruments. Trajectories are integrated
test-particle paths, with direction arrows, the Hill scale and the softened
model's L₁/L₂ equilibrium points. Density counts the actual grains on a 64 × 160
grid, spatially smooths counts and averages up to twelve recent samples; colour
shows number density relative to a uniform stream. The no-moonlet control evolves
independently from the same initial seeds and clock, rather than disabling gravity
on an already disturbed stream. Each quarter-orbit step advances both experiments.
Tap a grain to follow its recent passage and read its speed departure and
dimensionless Jacobi integral; selection ends when it leaves the open window.

`js/ring-lab.js` uses the existing locally vendored Three.js. The central patch
has 9,000 test grains (4,200 on coarse-pointer devices), with dimmer distant ice
as visual context. Ice uses faceted geometry, slow rotation, cool/warm lighting
and modest transmission on desktop. Saturn, ring bands and stars are procedural.
The moonlet has seeded crater basins and rims. Sun elevation controls the long
moonlet shadow on the ring plane and its direct-light shadow on grains.
Reduced motion starts paused; a paused and settled camera stops GPU redraws.
Missing 3D support uses an overhead 2D view with the same active physics controls.
The heavier scene loads only on its own page.

## References

- [NASA · Sunlit Propeller](https://science.nasa.gov/resource/sunlit-propeller/)
- [NAOJ · Dynamics of Saturn’s Ring: Propeller Structure](https://www.nao.ac.jp/en/gallery/weekly/2017/20170912-4d2u.html)
- [NAOJ · Detailed propeller simulation](https://4d2u.nao.ac.jp/movies/20160701-planet/)
- [JPL · Planetary satellite physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/)
- [NASA · Saturn ring fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html)
- [Rein & Tremaine · Symplectic integrators in the shearing sheet](https://academic.oup.com/mnras/article/415/4/3168/1747341)
  (local rotating-frame background; this implementation uses RK4, not their integrator).

## Verification

101 focused checks cover the existing flight, foreground, scroll, bio handoff,
new bounded motion, calm mode, exact zero-mass shear, mass-dependent disturbance,
long-flow stability, seeded reset, physical calibration, Jacobi conservation,
integrated paths, density normalization/averaging and open-boundary overshoot.
Browser QA checks live 3D, view/mass/playback controls, observation layers,
no-moonlet control, quarter-orbit steps, grain picking, sun angle,
paused reset, panel collapse, 320- and 390-pixel layouts and a 1440-pixel desktop, both fallback paths,
entry light and the home calm switch. `tests/worlds-mobile-preview.html` also
accepts `?w=320&h=568` and `?w=1440&h=960` for layout checks.

Preview parameters: `rings.html?lens=paths&mass=2.5&paused=1`,
`rings.html?lens=density&control=1&paused=1` or
`rings.html?renderer=canvas&lens=paths&paused=1`. The isolated original-painting fallback can
be checked at `tests/home-life-preview.html?fallback=1`.
