# Cassini · Grand Finale cinematic flight

## Reference material

- NASA/JPL mission planners' [Grand Finale Orbits Petal Plot](https://science.nasa.gov/resource/grand-finale-orbits-petal-plot/): animation of the 22 final orbits.
- NASA/JPL [Cassini's Grand Finale](https://science.nasa.gov/resource/cassinis-grand-finale/): official animated film and downloadable video.
- NASA/JPL [final orbits illustration](https://science.nasa.gov/resource/cassinis-final-orbits/): periapses of the ring-grazing and Grand Finale phases.
- NASA/JPL [end-of-mission press kit](https://www.jpl.nasa.gov/news/press_kits/cassiniEndofMission.pdf), pp. 13–16: Titan's final encounter, antenna pointing toward Earth, atmospheric drag, loss of attitude control, ablation and breakup.
- NASA/JPL [Grand Finale Dive illustration](https://science.nasa.gov/resource/cassini-grand-finale-dive-illustration/): spacecraft and ring-gap visual reference.

## Interpretation

A representative high-inclination Kepler ellipse communicates the orbital geometry. One full orbit stands for the years of exploration and the 22 final dives; a final half orbit leads to atmospheric entry. The orbit is not reconstructed from SPICE kernels. The semimajor axis, viewing direction, compressed timeline, Titan transition and camera choreography are illustrative. The background moons are decorative, not a simulated Titan encounter. There is no claim of an exact historic spacecraft attitude or meteorological reconstruction.

Mean anomaly is solved to eccentric anomaly, preserving faster motion around periapsis. Projection retains a third depth coordinate; the far passage renders behind Saturn. Near entry, deterministic central-gravity integration adds increasing atmospheric drag. The antenna's quiet orientation is independent of the velocity tangent. Only the final loss of control introduces a small tumble. The wake and fragments follow velocity, with debris trailing under drag. A final fading light retains the existing poetic transition toward the biography.

The original landscape composition remains fixed throughout: traveller, cat, flowers, clouds and Saturn stay visible together. The spacecraft recedes from its opening close-up into the sky, completes its representative inclined orbit, and enters the atmosphere within that same scene. Spacecraft rendering sits above the clouds; precise hidden foreground contours keep it behind the traveller, cat, plants and near rock ridge. The visible outer ring is composited above ice particles and painted clouds. See `docs/home-layering.md`. The ending uses only gentle dimming. Reverse scrolling follows exactly the same geometry.

## Atmospheric crescendo

The first sheath appears at scroll progress .737–.751, after atmospheric entry.
A thin wake starts at .744 and grows toward its .782 peak. The hull stays fully
visible through the final-transmission beat (.770); breakup starts at .773 and
the hull disappears by .805. The bright plasma then fades through .865, with
embers remaining until .891. These are compressed artistic timings, not elapsed
seconds or a calculated thermal solution. NASA's [final approach account](https://science.nasa.gov/missions/cassini/cassini-spacecraft-makes-its-final-approach-to-saturn/)
describes atmospheric entry, signal loss, then breakup and consumption.

The wake samples the actual recent descent, capped at atmospheric entry, so it
curves with the spacecraft's passage instead of rotating a rigid cone into space.
Soft overlapping emission kernels, faint filaments, a leading bow shock and warm
sparks create a white-gold head and fading amber trail. All ablation effects use
the existing foreground contour mask. The camera and landscape remain fixed;
calm mode freezes the small turbulent motions. This is a visual interpretation,
not a fluid-dynamics or radiative-transfer simulation.

## Falling remnant at the biography

The final ember now fades according to its actual distance from the biography
card, rather than overlapping progress-based opacity ramps. It stays fully
visible until the last 24 CSS pixels, then fades smoothly to a terminal position
2 pixels above the card edge. The ash and ember share this one fade. The existing
clip keeps all glow outside the card, including during fast scrolling. A lagging
descent is allowed to settle before the offscreen renderer stops; calm mode keeps
a stationary, progress-based fade. Regression checks cover contact geometry on
five viewport sizes and five pixel densities, plus the distance-based fade.

## Current spacecraft rendering

The active renderer uses the orbiter-only GLB published by NASA/Brian E. Kumanchik,
from [Cassini-Huygens (A)](https://science.nasa.gov/3d-resources/cassini-huygens-a/).
The 1.58 MB source model supplies the recognizable Cassini structure. Our own
`js/cassini-design.js` adds a fictional future exploration edition: beveled ceramic
panels and gold structural rails, an optical head, compact heat exchangers, a
segmented antenna lip and subtle amber contact arcs. The original thick foil mast
and collars are removed only outside the bus, then replaced with a narrower,
moderately shorter three-spar carbon truss, small champagne joints and sensor tip.
The bus and antenna remain the design's foundation. These refinements prioritize
the epic painted setting rather than historical hardware fidelity.
See `assets/models/README.md` for the source, attribution and configuration.

A locally vendored Three.js r170 renderer draws the same rigid object into a
transparent canvas. The ivory dish, softened hardware, champagne foil and warm rim light are our
own finish over the official geometry. Lighting remains fixed in scene space,
so it is consistent across orientations.
The craft no longer crossfades independent generated viewpoints.

The model's +Y antenna normal tracks one explicit Earth direction in the scene:
normalized (0.78, 0.59, 0.21), where +X is right, +Y is up and +Z faces the viewer.
The opening pose aligns the antenna to this direction and rolls -0.105 radians
about that axis, foreshortening the long boom into depth. Observation roll changes without turning the antenna
away from Earth. Aerodynamic tumble starts after the final-transmission beat.
The Earth vector is an artistic viewing convention, not the historical Earth
position recovered from ephemerides. The orbital story and attitude timing remain
compressed and illustrative.

The opening still (`assets/models/cassini-opening-gilded.webp`) is rendered from
the exact same model and pose. Loading, missing WebGL, or context loss uses this
still instead of changing the spacecraft's shape. GPU renders are cached while
the attitude is unchanged, and the render resolution reduces for distant views.

## Superseded sprite experiment

`assets/cassini-turntable-v3.webp` is retained as an earlier generated study and is
no longer used by the site. The original prompts are recorded below for provenance.

Generation prompt:

> Use case: scientific-educational. Asset type: transparent spacecraft turntable sprite atlas for a cinematic NASA Cassini flight animation on a website. Create a precise 4 column by 3 row grid of TWELVE separate full-body photorealistic 3D render views of the SAME NASA CASSINI ORBITER (after Huygens separation), isolated on genuinely transparent background, no text, no labels, no grid lines, no shadows on any floor. Every cell equal size, ample empty transparent padding, spacecraft centered same optical size. Beautiful scientifically recognizable Cassini: large ivory parabolic high-gain antenna at the top of a compact tall gold multilayer insulation cylindrical bus, dark instrument pallets, three small dark RTG cylinders on short radial struts, slender magnetometer boom extending modestly sideways. No solar panels, no rocket plume. Antenna axis generally vertical in every cell, slight diagonal 20 degree tilt is okay. 12 views form a continuous horizontal yaw turntable: left-to-right then top-to-bottom, yaw 0,30,60,90,120,150,180,210,240,270,300,330 degrees, with constant three-quarter camera elevation 20 degrees above dish plane. SAME silhouette proportions and dimensions and camera framing for all twelve views. Dish subtly changes elliptical perspective and back support is visible from behind. Warm distant sunlight from upper left, fine gold foil crinkles and silver antenna struts, subtle cool blue fill so shadow detail is visible against dark space. A beautiful high-budget space documentary spacecraft miniature, not a toy, not a cartoon. Highest detail. Landscape canvas, twelve complete separate sprites, all appendages fully inside their own cell. Keep the magnetometer boom shorter than twice the bus length so the craft has a balanced elegant silhouette.

Background edit prompt:

> Use case: background-extraction. Remove ALL brown/gray studio backdrops and ALL hazy halos from this 12-view Cassini sprite atlas. Preserve the 12 spacecraft exactly in the same grid positions and proportions. The entire space between spacecraft, outside them, and inside openings between antenna support struts must have alpha ZERO, genuine clean transparent PNG. Only the solid spacecraft remains. No new floor, no gradient, no checkerboard drawing, no outline, no glow. This is a production transparent sprite sheet for compositing against stars.

## Verification

86 checks cover orbital geometry, atmospheric drag, continuity, fixed full-scene framing, quaternion normalization, Earth-pointing throughout controlled flight, post-signal tumble, staged atmospheric heating and afterglow, wheel input and biography handoff. Browser checks verify the NASA model reaches its ready state and that the same-model fallback remains visible when WebGL is disabled. The local visual harness is `tests/cassini-model-preview.html`.
