# Natural orchard shapes · 2026-10-09

All eight orchard species now have three distinct plant silhouettes. New plantings receive a uniformly random variant (0–2), saved with the tree. Existing trees without a variant receive a stable selection from their saved seed. Variant 0 is valid and is retained; refresh, watering, harvest and season changes do not reroll the shape.

Kiwi and grape supports use crooked weathered branches, unequal posts, visible hemp ties, knots and irregular crosspieces. Three different support layouts replace the earlier regular pergola. Apple, peach, orange, cherry, durian and mango each have independent trunk/crown shapes too.

## Assets and simulation

The built-in imagegen tool produced eight selected 4-season × 3-shape atlases. The selected mango atlas was regenerated with more space between its plants. Exact final prompts are in `orchard-prompts-v2.json`. `scripts/export-orchard-variants.cjs` uses connected plant silhouettes to separate the atlas, keeping antialiased edges, then exports 96 transparent 512 × 512 WebP textures with a common root anchor (256, 483). They total approximately 6.8 MB. `assets/farm/trees/variants-v2-manifest.json` lists each species, variant, season and file. Eight `orchard-*-shapes-v2.webp` contact sheets provide visual reference; older v1 files are retained.

Each species/variant has its own cached image-derived flower, leaf and snow anchors. Fruit attachment positions are snapped to the corresponding summer foliage, or to woody branches for durian. Live and clickable fruit share those positions, and the clickable layer updates once the anchors finish loading. Flowers, fruit and snow remain dynamic canvas/SVG layers.

The live canopy now adds shaded, veined leaf clusters along the painting's foliage and outer edges. Each species keeps its leaf shape; the planted seed controls cluster density, size and orientation without changing its saved tree shape. Cached foliage layers keep branch and trellis gaps open, while a few outer shoots move gently in the breeze. Spring leaves fill out, autumn leaves turn and thin, and the remaining autumn canopy fades into bare winter branches. Evergreen foliage stays beneath winter snow. Calm mode holds the new leaves still; mobile devices animate fewer shoots with the same canopy density.

Mature trees are 10% larger, with the original depth and crown proportions; saplings retain their size. Terrestrial animals' avoidance of foreground trees scales with their growth. Roots, fruit positions and saved variants remain anchored to the same painting coordinates.

Exposed wood now has a cached material layer for each species, shape and season. A root-connected winter wood mask supplies a conservative location guide; each season's own pixels then exclude foliage, flowers and snow. Texture follows the principal direction of nearby branches and preserves the painting's lighting. Species differ in their muted bark colour, fine grain, horizontal lenticels, shallow fissures and peeling fibres; vine supports receive a gentler weathered finish. The layer blends with seasonal changes and is painted below leaves, flowers, fruit and snow. Mobile caches are 256 px, desktop caches 320 px, and no material generation runs in the animation loop.

Material references: [apple bark](https://plants.ces.ncsu.edu/plants/malus-domestica/common-name/apple/), [peach bark](https://plants.ces.ncsu.edu/plants/prunus-persica/), [grape's peeling fibres](https://plants.ces.ncsu.edu/plants/vitis-vinifera/), [durian's rough, peeling bark](https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2865), and [mango's shallow fissures](https://heritagetrees.nparks.gov.sg/heritagetrees/ht-2020-312/). These inform the native material profiles; the existing painted silhouettes are retained.

Tree hit targets use cached seasonal alpha contours, leaving transparent crown and trellis gaps clickable for the scene behind them. The visual layers remain unclipped so growing leaves and falling snow still overhang. Ripe fruits keep their own painted hit areas; tree keyboard access and sapling watering remain available.

`orchard-preview.html` displays the three shapes side by side for any of the eight species, with season/progress controls and clickable fruit.

## Verification

`tests/orchard-runtime.cjs` passed for all 24 shapes across four seasons, independent fruit anchors, new planting/watering, shape persistence across reloads and seasons, harvest/basket persistence, and a 390 px mobile planting catalog. `tests/farm-runtime.cjs` passed for the existing animal movement, feeding, seasonal farm and asset loading. The farm and preview screenshots were visually inspected; the in-app browser preview was also inspected with live fruit and falling leaves. Tests use isolated browser storage and do not replace the user's garden.

The larger trees and wood materials were checked with isolated GET-only farm fixtures at 1440 px and 390 px, plus all eight species and three shapes in the preview. Mature trees grow by 10%, their ground anchors stay fixed, saplings retain their size, and image/canvas/fruit layers remain aligned. All 24 preview fruit clicks, four farm harvest species, trunk clicks, Enter/Space access, sapling watering controls, calm mode, saved shapes, winter foliage and mobile browsing passed. External API writes were blocked. The woods sign is now reachable through transparent vine gaps; real painted branches still occlude it.

Spring, autumn and winter transition midpoints also passed tree, fruit and entrance hit checks with the two visible seasons' combined contours. Absolute fragment URLs were verified in the preview's `<base>` layout; transparent corners pass clicks through while painted trunks remain interactive.
