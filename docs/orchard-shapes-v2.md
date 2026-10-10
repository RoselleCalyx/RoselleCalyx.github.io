# Natural orchard shapes · 2026-10-09

All eight orchard species now have three distinct plant silhouettes. New plantings receive a uniformly random variant (0–2), saved with the tree. Existing trees without a variant receive a stable selection from their saved seed. Variant 0 is valid and is retained; refresh, watering, harvest and season changes do not reroll the shape.

Kiwi and grape supports use crooked weathered branches, unequal posts, visible hemp ties, knots and irregular crosspieces. Three different support layouts replace the earlier regular pergola. Apple, peach, orange, cherry, durian and mango each have independent trunk/crown shapes too.

## Assets and simulation

The built-in imagegen tool produced eight selected 4-season × 3-shape atlases. The selected mango atlas was regenerated with more space between its plants. Exact final prompts are in `orchard-prompts-v2.json`. `scripts/export-orchard-variants.cjs` uses connected plant silhouettes to separate the atlas, keeping antialiased edges, then exports 96 transparent 512 × 512 WebP textures with a common root anchor (256, 483). They total approximately 6.8 MB. `assets/farm/trees/variants-v2-manifest.json` lists each species, variant, season and file. Eight `orchard-*-shapes-v2.webp` contact sheets provide visual reference; older v1 files are retained.

Each species/variant has its own cached image-derived flower, leaf and snow anchors. Fruit attachment positions are snapped to the corresponding summer foliage, or to woody branches for durian. Live and clickable fruit share those positions, and the clickable layer updates once the anchors finish loading. Flowers, fruit and snow remain dynamic canvas/SVG layers.

The live canopy now adds shaded, veined leaf clusters along the painting's foliage and outer edges. Each species keeps its leaf shape; the planted seed controls cluster density, size and orientation without changing its saved tree shape. Cached foliage layers keep branch and trellis gaps open, while a few outer shoots move gently in the breeze. Spring leaves fill out, autumn leaves turn and thin, and the remaining autumn canopy fades into bare winter branches. Evergreen foliage stays beneath winter snow. Calm mode holds the new leaves still; mobile devices animate fewer shoots with the same canopy density.

`orchard-preview.html` displays the three shapes side by side for any of the eight species, with season/progress controls and clickable fruit.

## Verification

`tests/orchard-runtime.cjs` passed for all 24 shapes across four seasons, independent fruit anchors, new planting/watering, shape persistence across reloads and seasons, harvest/basket persistence, and a 390 px mobile planting catalog. `tests/farm-runtime.cjs` passed for the existing animal movement, feeding, seasonal farm and asset loading. The farm and preview screenshots were visually inspected; the in-app browser preview was also inspected with live fruit and falling leaves. Tests use isolated browser storage and do not replace the user's garden.
