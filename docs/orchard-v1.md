# Orchard additions · 2026-10-09

Added kiwi, grape, durian and mango to the existing plant, water, seasonal growth and harvest flow. The garden now has eight planting positions; existing saved tree positions remain valid.

## Artwork

The built-in imagegen tool generated four transparent seasonal atlases, using the existing orchard artwork as the painting-style reference. `orchard-prompts-v1.json` records the exact prompts and botanical reference URLs. `scripts/export-orchard.cjs` exports sixteen 512 × 512 WebP textures with a common root at (256, 483); `assets/farm/trees/manifest.json` records the files. The four `orchard-*-v1.webp` contact sheets show all seasons.

Kiwi and grape use woody vines and timber supports. Durian and mango use independent evergreen tree bodies and leaf shapes. Flowers, fruit and snow are drawn by the existing live simulation, rather than baked into the textures. The simulation scans each species' leaf and branch alpha to place flowers, falling leaves and snow. Each fruit has its own silhouette: furry kiwi, berry clusters, spiky durian and elongated mango. Mango and grape blossoms use small branching panicles.

For the farm's compressed seasonal calendar, durian and mango ripen in summer; kiwi and grape ripen in autumn. Three waterings also advance a sapling to maturity. Tropical evergreen specimens retain their foliage in the farm's stylized snowy winter; this is a game-world presentation, not a climate model.

## Verification

`tests/orchard-runtime.cjs` passed: all four plants selected through the UI, three waterings, preservation of the original four trees, independent simulation anchors, four seasons, ripe fruit collection and basket persistence, asset loading, and a 390 px mobile planting catalog. Test hooks are injected only into the isolated test browser response. `tests/farm-runtime.cjs` also passed, covering animal behavior and feeding alongside the seasonal farm.

`docs/orchard-preview.html` provides an interactive four-species preview with season/progress controls and clickable fruit. Screenshots of the farm and preview were inspected for seasonal appearance and placement. The user's farm planting catalog was also opened and visually verified without changing their saved garden.
