# Wolf and crocodile farm assets

Generated on 2026-10-10 with the built-in imagegen tool. The existing `fox.webp`, `shiba.webp`, and `meadow-spring.webp` were visually inspected to match the farm's softly shaded watercolor/gouache animal style.

Each source atlas has 4 columns × 2 rows: idle, sleep, then six motion frames in row-major order. Wolf uses side-profile walking; crocodile uses a low side-profile swimming silhouette with folded legs and a gently changing tail. The crocodile source contains no painted water, so the farm's actual pond supplies the water and ripples.

Original generated atlases are copied to `assets/farm/source/wolf-atlas.png` and `assets/farm/source/crocodile-atlas.png`. Full connected alpha figures are isolated before export, preserving complete tails and ears even when generated figures approach atlas cell boundaries. The exporter only crops, resizes, and packs artwork.

Runtime outputs per species:

- `assets/farm/<species>.webp`: 320 × 320 transparent idle, baseline 301/320.
- `assets/farm/poses/<species>-sleep.webp`: 384 × 384 transparent sleep, baseline 360/384.
- `assets/farm/walk/<species>.webp`: six 384 × 384 transparent frames in one 2304 × 384 row, baseline 360/384.

Runtime gait scale is 1.25 for wolf and 1.45 for crocodile, controlled by `js/farm-motion.js`. No jump or affection atlas was generated for these species.

## Source generation prompts

### Wolf

```text
Use case: stylized-concept
Asset type: production transparent sprite atlas for a cozy illustrated farm game.
Primary request: create a precise 4 columns × 2 rows sprite atlas, exactly EIGHT separate full-body poses of the SAME adorable baby gray wolf. Landscape 2:1 canvas, equal square cells, no drawn grid, no labels.
Subject: a cute baby wolf with thick gray-silver and warm cream fur, dark charcoal ear tips, distinct natural wolf muzzle, fluffy cheeks, glossy amber-brown eyes, small black nose, fluffy charcoal-tipped tail and oversized paws. Friendly relaxed expression. Keep wolf identity and fur markings identical across all eight poses.
Style/medium: softly realistic hand-painted watercolor and gouache children's book animal illustration, tactile individual fluffy fur strands, dimensional softly shaded fur, round baby proportions. Match a farm sprite style with highly detailed soft fur, rounded tiny body, no dark outlines, no vector/cartoon-flat look.
Composition/framing: exactly 4 columns and 2 rows in a perfectly regular grid. Each figure completely fits INSIDE its individual square cell with wide transparent margins. Consistent apparent body size across six walk frames. Anatomically correct four legs and one tail in every pose.
Pose order, row-major:
1 top left: sitting upright full body, front three-quarter, paws clearly visible, warmly looking toward viewer.
2 top second: curled up asleep, eyes closed, full body with tail wrapped around, head facing RIGHT.
3 top third: full side profile walking RIGHT, gait frame 1, right forepaw forward, rear paw extended.
4 top fourth: full side profile walking RIGHT, gait frame 2, forepaw lowering and rear paw gathering.
5 bottom left: full side profile walking RIGHT, gait frame 3, paws passing beneath body.
6 bottom second: full side profile walking RIGHT, gait frame 4, opposite front and rear paws reaching.
7 bottom third: full side profile walking RIGHT, gait frame 5, pushing off gently.
8 bottom fourth: full side profile walking RIGHT, gait frame 6, legs transitioning back toward frame 1.
The six walk figures form a gentle natural slow walking loop, visibly distinct limb positions but same wolf shape/size, complete ears/paws/tail never clipped.
Scene/backdrop: actual alpha transparent background across entire canvas and between all figures.
Constraints: no ground, no cast shadow, no white background, no scenery, no collar, no props, no text, no grid lines, no duplicate poses. Center each figure in its cell, leave at least 10% margin on every side. Render an art atlas, not a diagram.
```

### Crocodile

```text
Use case: stylized-concept
Asset type: production transparent sprite atlas for a cozy illustrated farm pond game.
Primary request: create a precise 4 columns × 2 rows sprite atlas, exactly EIGHT separate full-body poses of the SAME adorable small baby crocodile gently floating/swimming. Landscape 2:1 canvas, equal square cells, no drawn grid, no labels.
Subject: one friendly baby crocodile, pale olive green scales with subtle deeper green back scutes, creamy underside, round amber-brown eyes high on head, a small nostril, rounded long crocodile snout with a gentle closed-mouth smile, four short tucked legs and long tapering tail. Recognizably a crocodile with softly textured small scales and little dorsal ridges. Keep face proportions and markings identical in every cell.
Style/medium: dimensional softly realistic hand-painted watercolor and gouache children's book animal illustration, detailed tactile skin, soft rounded baby proportions, natural subdued colors, soft edges, no black outlines, no vector-flat rendering. Complements richly fluffy animal cutouts in a cozy farm scene.
Composition/framing: Exactly 4 columns and 2 rows in a perfectly regular grid. Each FULL animal fits completely inside its individual square cell with at least 10% transparent margin on every side, including the full tail tip. All eight animals in strict SIDE profile facing RIGHT. All bodies LOW and HORIZONTAL, roughly three times as long as their body height. No upright standing, no walking, no raised belly: crocodile body lies level as it floats in pond. All full figures must have similar size and aligned snouts. Tail extends LEFT, head/snout to RIGHT. Large transparent space above and below the horizontal bodies.
Pose order row-major:
1 top left: idle relaxed floating position, eyes open, level head and back, full long tail gently curling slightly behind, short legs tucked almost flat alongside body.
2 top second: sleeping while floating, SAME low horizontal profile, eyes peacefully closed, mouth closed, limbs folded against body, tail relaxed.
3 top third: swimming frame 1, tail gently sweeps upward in silhouette, head level, legs near body.
4 top fourth: swimming frame 2, tail easing back toward straight, feet angle slightly in a tiny paddle.
5 bottom left: swimming frame 3, tail mostly straight extending left, small limbs tucked.
6 bottom second: swimming frame 4, tail gently sweeps downward in silhouette, level body, slight foot paddle.
7 bottom third: swimming frame 5, tail easing back toward straight.
8 bottom fourth: swimming frame 6, tail returning smoothly to frame 1 position.
The six swim figures form a slow gentle tail-driven swimming loop with visible DIFFERENT tail bends but stable face/head/body, and minimal tiny leg motion. No walking or ground contact.
Scene/backdrop: ACTUAL transparent alpha background around and between animals. Depict ONLY crocodile cutouts. The game draws its pond separately.
Constraints: No water, no waterline, no waves, no ripples, no splash, no watery shadows, no scenery, no ground, no cast shadow, no text, no gridlines, no props, no white background. Entire snout, limbs and tail must be included in each cell.
```

## Export and verification

Rebuild with the bundled Node.js runtime and `sharp` available via `NODE_PATH`:

```sh
node scripts/export-farm-new-animals-b.cjs assets/farm/source/wolf-atlas.png assets/farm/source/crocodile-atlas.png
```

The exporter also writes `assets/farm/source/new-animals-b-contact-sheet.webp` for visual inspection. All sixteen figures were visually checked: complete ears/tails/paws, correct frame order, consistent identity, closed sleeping eyes, and low horizontal crocodile silhouettes. Export metadata confirms the expected dimensions and four-channel alpha. Both motion sheets have six unique pixel hashes. Strong-alpha bottoms are 298/320 for idle and 356–357/384 for motion due to the three-pixel antialias padding inside the nominal 301 and 360 anchors.
