# Home scene layering and foreground occlusion

The source painting is unchanged. `js/home-occlusion.js` stores native canvas
contours in the landscape's 1672 × 761 image coordinates (the image starts at
painting row 180). Curves follow the traveller, cat, curled tail and near ridge;
separate fine strokes cover hair strands and sparse plants. Clouds and distant
mountains are excluded. These are hidden occlusion contours, not visible outlines
on the delivered page.

The contour matte is drawn once and reused. Animated canvases erase it with
`destination-out`, scaled and positioned by the same `HOME_FRAME` as the painting.
This avoids redrawing or recoloring the photograph, and preserves the exact
original scene. No per-frame image segmentation runs. The canvases share the
existing departure transform, keeping the matte and painting aligned.

Back to front:

1. Sky, ray-traced Saturn body, moons and far orbit traces.
2. Original landscape painting, including clouds and near subjects.
3. Near orbit trace, inner rings and ice particles.
4. All visible outer-ring pixels, above both particles and the painted cloud band.
5. Spacecraft and its atmospheric wake, above the cloud painting.
6. Traced foreground solids, applied as alpha erasure on the animated layers.
7. Existing page copy and overlays.

The outer ring is separated from the ray-traced body at render time, preventing
double compositing. Only geometrically visible ring pixels are promoted; portions
hidden by Saturn remain hidden. The spacecraft's far-side pass is separately
masked by Saturn and the rings before the terrain mask is applied. Foreground
erasure includes the wake and debris, avoiding particles leaking across subjects.

Verification: `tests/home-occlusion.test.cjs` rasterizes the contours and checks
solid subjects, cloud gaps, the notch between the ears and the tail. The browser
harness `tests/home-contour-preview.html` overlays the contours on the full-size
painting and checks 24 points against the actual canvas matte. Browser previews
at story progress .19 and .65 confirm character occlusion and visible flight
through clouds. All 81 combined geometry, contour and existing input/handoff
checks pass.


The overlapping folded trousers, boots and their contact shadow use a continuous
near-depth contour. The previous inner V cut into solid trouser fabric, creating
an unintended window as the craft crossed story progress .19–.20. Seven regression
points now cover that fabric/contact region while preserving the real air gap
between the outer trouser leg and cat. The segment was replayed with actual scroll
input after the correction.
