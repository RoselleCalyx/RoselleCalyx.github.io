# Cassini orbiter model

Source: [NASA – Cassini-Huygens (A)](https://science.nasa.gov/3d-resources/cassini-huygens-a/)

Creator: NASA/Brian E. Kumanchik.

Selected download: **Cassini-Huygens (A) (without Hyugens).glb** (NASA's spelling).
Local file: `cassini-orbiter-nasa.glb`, downloaded 27 October 2026.

Direct NASA asset URL:
https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/cassini-huygens-(a)/Cassini-Huygens%20(A)%20(without%20Hyugens).glb

This is the orbiter-only configuration after Huygens separation. The GLB is unchanged on disk. The active renderer adapts it into a fictional
future exploration craft. The original bulky outboard boom sleeve and collars
are removed from the rendered geometry and replaced with a narrower, moderately
shortened three-spar carbon truss, small champagne joints and a compact sensor.
The source bus and antenna geometry stay. Own additions include beveled ceramic
shields, narrow structural rails, a recessed optical head, compact heat exchangers,
and segmented dish trim with restrained amber accents. Warm materials and
horizon lighting connect it to the painted landscape. These new details are our
art direction, not historical Cassini engineering. The associated NASA download page credits the model to
NASA/Brian E. Kumanchik; NASA makes these resources available under its
[media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
No NASA endorsement is implied.

`cassini-opening-gilded.webp` is a transparent still rendered locally from this exact
model at the opening pose. It is the loading, WebGL-unavailable and context-loss
fallback, so the silhouette does not switch to a different generated spacecraft.

Renderer: Three.js r170, vendored in `js/vendor/three/`, MIT license included.
Draco decoding uses the decoder files supplied in the same official npm release.

The scene's Earth direction is normalized (0.78, 0.59, 0.21), an explicit,
fixed cinematic viewing convention. Opening roll is -0.105 radians; the boom
recedes in depth instead of presenting its entire length in the image plane.
It is not reconstructed from mission quaternions or Earth/Saturn ephemerides.
Before aerodynamic loss of control, the model's +Y high-gain-antenna normal
tracks that direction; controlled roll rotates the asymmetric instruments around
that axis. Position, velocity and attitude are separate quantities.
