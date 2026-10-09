# Scene polish — 2026-10-09

This update combines procedural animation with painted textures. It does not replace the games with static screenshots.

## Homepage

Three staggered meteor schedules draw luminous heads and fading tails behind Saturn. Cassini is larger, with a detailed transparent spacecraft texture drawn along the existing scroll-driven flight, rotation and atmospheric entry. Its geometry-only canvas renderer remains the fallback when the texture is unavailable. The mobile starting position keeps the dish inside the viewport and below the introduction.

- `assets/cassini-flight-v2.webp`: transparent spacecraft, 1400 px wide.
- `js/cassini-art.js`: texture renderer and procedural fallback.
- `js/saturn.js`: flight and meteor simulation.

The attached reference guides the spacecraft silhouette, long instrument boom, dish orientation, dark metallic body and warm gold illumination. This is an illustrated likeness, not a physically accurate three-dimensional reconstruction.

Follow-up: Cassini and its atmospheric effects now render on the foreground canvas after the inner ring surface, so the ring cannot cover the spacecraft. Ring density combines multiple irregular radial scales with slant-dependent transmission, fine grain and directional illumination. Ice highlights are smaller and subtler. The homepage browser check records actual canvas draw calls to verify spacecraft compositing order.

## Farm

### Animal motion revision v3

Generated eight character atlases with the built-in ImageGen tool, each containing 12 walking poses and eight leap poses. Exported ground-aligned sheets into `assets/farm/walk/*-v3.webp` and `assets/farm/jump/*-v3.webp`; [asset manifest](../assets/farm/motion-v3-manifest.json) records all 16 runtime sheets. Rabbit locomotion deliberately uses the eight leap poses with a small distance-driven vertical bound, preserving hopping rather than four-legged walking. The other seven species use twelve walking frames.

All species now stroll at lower speeds with cycles around 1.5–2.3 seconds. Shiba moves at 1.4 world-percent units per second, compared with the previous 3.2. The opacity blend uses additive premultiplied compositing in an isolated group; opaque body areas remain opaque at the midpoint. Browser pixel checks measured 255 at every blend fraction, instead of the 191 produced by two half-opacity source-over layers.

Cross-position leaps have an initial grounded crouch, then a separate airborne interval and landing recovery. The eight changing joint poses run alongside the trajectory. Feeding rotates through species-specific reactions; articulated tail, paw and wing canvases reuse the existing painted character. A favorite treat can trigger a paw wave, tail wag or a full-posture happy leap. Calm mode suppresses gestures and pauses leap progress.

Detailed independent botanical objects are saved as `assets/wild/cattail-object-v1.webp` and `assets/wild/lotus-leaf-object-v1.webp`. Reeds use a 24-strip rooted bending mesh. Leaves rotate subtly and bob with the pond surface. Seasonal tint variants are cached, and procedural plants remain the load-failure fallback. The painted shoreline supplies fine ground cover without the old geometric bank overlay.

The exact ImageGen prompt set is saved in [life-v3-prompts.json](life-v3-prompts.json). [Motion preview](farm-motion-preview.html) now includes a separate eight-frame leap mode. `tests/animal-life-runtime.cjs` verifies opacity, actual travel and frame changes for Shiba/panda/duckling/rabbit, rabbit bounding, relaxed cadence, leap articulation, moving tail and pond plant loading; screenshots contain timed playback sequences.

Walking uses distance-driven sprite phases with a short blend between neighboring frames. The v3 sheets replace the earlier six/eight-frame walking assets at runtime. Feeding and petting have distinct reactions and species-specific gestures. Nine small procedural rocks, grass clumps and flower patches share the orchard breeze and seasonal palette.

Depth ordering lets animals pass behind props. Cats, rabbits, foxes and shibas can approach a rock, leap onto it, rest and hop down. The leap pauses in calm mode and when the document is hidden. Rocks use a textured canvas drawing rather than an additional downloaded image.

## Woods and pond

Backgrounds were created with the built-in ImageGen tool, exported into the repository as WebP assets. Interactive berries, mushrooms, movable covers, weather, fish, casting, reeling, water ripples and traps remain programmatic. Forest covers reuse the farm's procedural rock and grass drawings.

| Asset | Purpose |
| --- | --- |
| `assets/wild/woods-clearing-v2.webp` | Spring/summer forest clearing; autumn receives a subtle color filter |
| `assets/wild/woods-clearing-winter-v2.webp` | Matching snowy forest |
| `assets/wild/pond-water-v2.webp` | Twilight pond with open water for fishing |
| `assets/wild/pond-water-winter-v2.webp` | Matching frozen pond; ice hole is drawn at runtime |

Texture loads are asynchronous and fall back to the original procedural backgrounds on failure.

## Image generation briefs

All five images were made with the built-in ImageGen tool. The following reusable briefs record the composition and constraints of the generation/edit prompt set.

1. **Forest clearing:** Match the existing farm meadow's fine watercolor/gouache twilight storybook style. Wide landscape with bamboo on the left, a leafy berry-tree crown on the right, a mountain and lake opening in the center, warm small lanterns and a curved stone path. Keep the playable ground in the bottom 36 percent. Place bamboo around x 5–25 percent and the tree crown around x 70, y 40 percent. A fallen log lies from approximately (28,86) to (47,80). Do not include animals, mushrooms, collectible berries, interface elements or text; these are rendered interactively by code.
2. **Pond:** Same painterly twilight style and palette. Mountains, cottage, moon and distant shoreline occupy the top 40 percent; open reflective water fills the lower 60 percent. Put the moon around (80,10), shoreline near y 40 percent, and only a small bank in the lower-left corner. No dock, reeds, fish, lotus, fishing equipment, animals, text or interface elements.
3. **Winter forest edit:** Preserve the clearing's geometry and composition. Add snow to bamboo, tree branches, mountains and ground; keep the playable paths and warm lanterns. No added characters, collectibles or UI.
4. **Winter pond edit:** Preserve the pond's geometry, shoreline, cottage and moon. Snow-covered mountains and trees, frozen reflective lake, warm cabin lights. No fishing hole, dock, equipment or animals; the hole and equipment are drawn by code.
5. **Cassini:** Use the user's attached Saturn artwork as the appearance reference. Isolated realistic Cassini spacecraft on a transparent background, long slender instrument boom extending toward the upper left, dark cylindrical metallic bus, gold foil and small protruding instruments, large illuminated dish on the right. Three-quarter side view, warm sunset rim light, fine metallic surface detail. No planet, stars, smoke, flames, text or background. Preserve a wide silhouette that can be animated as a canvas sprite.

## Verification

- `tests/farm-motion.cjs`: eight species, distance-driven phase, neighboring-frame blend, acceleration/braking and timing invariants.
- `tests/farm-runtime.cjs`: walking, feeding, petting, rock ascent/descent, seasonal props, calm mode and mobile layout.
- `tests/home-runtime.cjs`: homepage composition and scroll-driven finale.
- `tests/scene-runtime.cjs`: meteor drawing, loaded Cassini texture, sidebar scroll containment, Cassini route visibility, four-season textures, mushroom picking, covers, journal, fishing/reeling/catch, traps, mobile overflow and procedural fallback.

Browser test hooks are injected only into test responses, not shipped in the site scripts.

## 2026-10-09：Matcha、四足熊猫和互动姿态

- 兔子恢复原先速度 4，仍播放 8 帧蹦跳周期（约 0.73 秒）。其他动物保持慢步态。
- 熊猫重新生成 12 帧侧面四足承重步态：`assets/farm/walk/panda-v4.webp`。旧版保留。
- 雪豹更名 Matcha，农场、森林、池塘文案统一；旧 Yuki 心心累计数迁移并合并到新名字。
- 8 种动物各新增 16 帧真实身体姿态：`assets/farm/affection/*-v4.webp`，喂食回应 8 帧、抚摸 8 帧。吃东西、抬爪/扇翅、跳跃分开播放；拍拍交替播放歪头贴近与伸展。所有互动结束后恢复行动，关闭面板也不会打断正在播放的动作。
- 芦苇、水葫芦、海菜花和草丛使用透明植物对象纹理，根部固定的弯曲网格、轻微浮动、倒影和接触暗部；远岸植物随距离缩小，冬季不显示浮水花。
- 使用内置 imagegen 生成；完整提示词在 `docs/affection-v4-prompts.json`。姿态总览：`docs/*-v4.webp`。
- 验证：farm-motion、farm-runtime、animal-life-runtime、scene-runtime；实际浏览器刷新并点击 Matcha 的 Pet，检查连续播放。改动仍在本地，未提交或上线。

### 喂食流程补接

之前最爱食物分支直接跳到开心回应，没有先播放吃东西。现在实际 Offer 点击会依次播放 620ms 食物送达、2200ms 低头和咀嚼，再播放 2400ms 喜爱回应。食物图标在嘴边逐渐吃完；进食期间重复点击不额外扣库存，拍拍和关闭面板不打断进食。普通喜欢的食物吃完后直接恢复，拒绝和吃饱逻辑保留。

新增 `tests/feeding-runtime.cjs`，通过真实 Feed/Offer 按钮检查全部 8 种动物的咀嚼帧、喜爱回应、重复扣食物防护、关闭面板后继续动作，以及普通喜欢/拒绝食物。与 farm-runtime 同时通过。当前用户页面实际喂了 Kinako 一份已有牛肝菌，观察了咀嚼及结束后的恢复。缓存版本更新为 20261009-feed7，未上线。
