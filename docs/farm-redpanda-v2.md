# Red panda visual refinement — 2026-10-10

Edited with the built-in imagegen tool from the original eight-pose red panda atlas, then refined once more. The new version keeps the farm's watercolor/gouache style with a rounder cheek silhouette, compact baby body, slight head tilt, dark legs and natural russet/buff tail rings. Idle, sleep and all six walk phases use the same character design.

## Active runtime assets

- `assets/farm/redpanda-v2.webp`: 320 × 320 idle; 27,666 bytes.
- `assets/farm/poses/redpanda-sleep-v2.webp`: 384 × 384 sleep; 23,364 bytes.
- `assets/farm/walk/redpanda-v2.webp`: 2304 × 384, six walk frames; 119,198 bytes.

Originals remain available. The scene, adoption grid and roster share FarmArt's updated image; FarmMotion selects the revised walk sheet. New filenames and script versions prevent the previous image cache from hiding this edit.

Source atlas: `assets/farm/new-animals/source/redpanda-v2.png` (gitignored). Export parameters and dimensions: `assets/farm/new-animals/redpanda-v2.json`. [Contact sheet](../assets/farm/new-animals/redpanda-v2-contact.webp).

Alpha-based figure extraction and packing use `cells` from `scripts/export-farm-motion.cjs` and `render`/`scaleFor` from `scripts/export-farm-new-animals-a.cjs`. Eight complete figures were extracted. All three exports retain transparency; the six walking frames have distinct pixel hashes and one common scale. Strong-alpha baselines sit at 356–358/384 with clear side margins of at least 33 pixels. RGB WebP quality is 88 for idle/sleep and 86 for walk; alpha quality is 100.

Natural color references: [Smithsonian's red panda description](https://nationalzoo.si.edu/animals/red-panda) identifies red/buff tail rings; [San Diego Zoo](https://animals.sandiegozoo.org/animals/red-panda) describes cinnamon-red upper fur, dark lower body/legs and a cream face mask. The juvenile proportions and softer expression are artistic choices.

## Final edit prompt

Use case: precise-object-edit. Edit target: the attached eight-pose baby red panda atlas. A stronger consistent refinement is needed: make the character unmistakably more adorable while keeping realistic juvenile red panda colors and real anatomy.
Keep the 4-column × 2-row transparent atlas, the same eight pose order (seated, curled asleep, six right-facing walk phases), complete figures and ample clear gutters.
Change the character across ALL EIGHT poses: give it a rounder fluffier cheek silhouette, 8–10 percent larger head relative to a slightly shorter more compact plump torso, softer short muzzle, friendly gentle dark brown eyes subtly rounder, dainty black nose, cute short furry paws. Keep the seated character's slight head tilt. Ears stay short natural triangular red-panda ears with softly rounded tips and thick ivory edges, not round bear ears. Natural four-legged juvenile cub proportions, fluffy rather than toy-like or humanoid.
REQUIRED COAT CORRECTION: back and crown rich natural muted chestnut/cinnamon red, silky warm russet highlights and auburn depth rather than bright flat orange. Chest, belly, shoulder undersides and ALL four legs MUST be deep nearly black espresso/charcoal-brown fur, clearly much darker than the target image; do NOT keep gray/taupe or medium-brown legs/chest, do NOT add a white chest bib. Ivory cream cheeks and muzzle with natural deep russet tear streaks. Huge plush tail clearly banded in alternating russet-red and warm golden-buff/ochre rings; the light rings are earthy honey-buff, not white, and dark rings must not be black like a raccoon. Match colors exactly throughout seated/sleeping/walking forms.
Keep detailed soft painterly watercolor/gouache fur and restrained natural light so the result fits the existing farm. Walk figures all same size and body alignment, visibly alternating four paws in six smooth sequential in-place phases facing RIGHT. Sleep eyes fully closed.
Real alpha transparency outside each figure. No cast shadow, scenery, ground, props, typography, labels, grid, added animals, checkerboard texture or background. These refinements should be visibly clearer than a tiny color tweak.
