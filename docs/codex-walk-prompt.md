# Prompt for Codex: four-legged walk cycles for the farm animals

Copy everything below the line into Codex.

---

The farm animals on farm.html currently have only one static, front-facing sitting illustration each (assets/farm/<species>.webp). When an animal walks, js/farm.js just slides that sitting picture across the meadow with a small bob/tilt (CSS `animal-step` / `animal-hop` in css/style.css), so the legs never move. Please add real limb-driven walk cycles that match the existing picture-book art, and wire them in.

## 1. Generate the walk-cycle sprite sheets (built-in imagegen)

Make one sheet per species: snowcat, rabbit, panda, fox, shiba, hedgehog, duckling, penguin.
Generate each species separately, and use that species' existing sprite (assets/farm/<species>.webp) as the visual reference, so it is clearly the same individual animal: same fur colours and markings, same eye colour, same proportions, same gouache/watercolour picture-book style.

Use this prompt template, replacing the bracketed parts:

> Use case: game sprite animation. Asset type: production transparent sprite sheet, a seamless in-place walk cycle for a cozy hand-painted farm website.
> Character: the exact same [SPECIES DESCRIPTION] as the reference image, same fur colours, markings, eye colour, proportions and gentle expression, now shown in true side profile facing RIGHT (a slight three-quarter turn of the head toward the viewer is fine).
> Layout: exactly 6 frames in ONE horizontal row, 6 equal square cells of 384x384 px, total 2304x384 px. The animal walks in place: it does not move forward between frames. Same scale, same head height and the same ground baseline in every frame, with the paws touching the ground at 92% of the cell height. The animal fills about 80% of the cell width, with generous transparent margins, and nothing crosses into neighbouring cells.
> Motion: [GAIT]. Frames 1–6 form a smooth loop, so frame 6 flows back into frame 1. Legs, paws and tail visibly change position from frame to frame; the body rises and falls slightly; the ears and tail follow through softly.
> Style: identical to the reference, a premium children's picture-book illustration in delicate gouache and watercolour, subtle paper grain, soft fluffy fur edges, warm light from the upper left, no outlines.
> Real alpha transparency everywhere outside the animal. No background, no ground line, no shadow, no props, no text, no frame numbers, no borders.

Species descriptions and gaits:

- snowcat: snow leopard kitten, cream-white fluffy fur, taupe rosette spots, blue eyes, thick ringed tail. GAIT: a natural cat walk with diagonal leg pairs (front-right and back-left step together); the tail is held low with a soft upward curl.
- fox: baby red fox, amber fur, white chest, dark socks, huge white-tipped tail. GAIT: a light, dainty trot with diagonal leg pairs; the tail floats out behind.
- shiba: happy golden shiba puppy, cream muzzle and chest, curled tail. GAIT: a bouncy puppy trot with diagonal leg pairs; the curled tail bobs.
- panda: chubby baby panda. GAIT: a slow, rolling four-legged amble, with shoulders and hips rocking side to side and heavy, plush paws.
- hedgehog: tiny warm-brown hedgehog with a cream face. GAIT: a quick scurry; tiny legs visibly alternate under the spiny dome, and the nose leads.
- rabbit: ivory bunny with long pink-lined ears. GAIT: a 6-frame HOP loop instead of a walk: (1) crouch, (2) push off with the hind legs, (3) stretched in the air, (4) tucked in the air, (5) front paws land, (6) hind feet come down. The ears trail on the jump.
- duckling: round butter-yellow duckling. GAIT: a waddle; the orange feet alternate, the body sways and the tiny wings flutter.
- penguin: fluffy baby emperor penguin in grey down. GAIT: a waddle; the feet alternate with short steps, the body rocks left and right and the flippers hold out for balance.

Save the sheets as assets/farm/walk/<species>.webp. Keep each file under about 150 KB; WebP with alpha, quality around 85.

Quality check before wiring anything in: put the 6 frames side by side and confirm that the animal stays in the same place and on the same baseline, that the legs actually alternate, and that it still looks like the same animal as its sitting sprite. If the image model cannot keep 6 frames consistent, fall back to a 2-frame step (frame A has the left legs forward, frame B the right legs forward) in a 768x384 sheet. Two clean frames are better than six wobbly ones.

## 2. Wire the walk cycles into the farm

- In js/farm.js `addAnimal()`, next to the existing `.animal-sprite` inside `.bob`, add `<div class="walk-sprite" style="background-image:url(assets/farm/walk/<species>.webp)"></div>`. Keep the sitting sprite exactly as it is for idle and for the keeper on her rock.
- Show `.walk-sprite` and hide `.animal-sprite` only while the actor has `.walking` or `.hopping` (these classes are already toggled in `place()`). When the animal stops, switch straight back to the sitting sprite.
- CSS: give `.walk-sprite` an `aspect-ratio: 1` and `background-size: 600% 100%`, and animate `background-position-x` from `0%` to `120%` with `steps(6)` and `infinite` (with 6 frames at 600% this lands exactly on frames 0–5). Scale the duration with species speed: about 0.6 s per loop for the fox and shiba, 0.8 s for the snowcat and duckling, 1 s for the panda and penguin, 0.45 s for the hedgehog, and 0.7 s for the rabbit's hop. For the 2-frame fallback use `200% 100%`, `200%` and `steps(2)`.
- While walking, turn off the old whole-sprite `animal-step` tilt (and `animal-hop` for the rabbit, since the hop is now in the frames). Keep only a very small vertical bob, or none.
- Direction: the sheets face right. The existing `.actor.left .flip { transform: scaleX(-1) }` already mirrors the animal when it walks left; make sure `.walk-sprite` sits inside `.flip`.
- Make the walking sprite the same on-screen size as the sitting one, with its paws on the same ground point. The actor uses `transform: translate(-50%, -94%)`, so check that a walking animal doesn't jump up or down when it starts or stops.
- `prefers-reduced-motion` and the site's calm mode (`Sky.calm`): show a single walk frame (frame 0) instead of animating.
- Preload the eight walk sheets after the page has loaded (with `requestIdleCallback` or after `load`), so the first step never flashes blank.
- Don't change the adoption grid, the roster, or the sitting sprites.

## 3. Verify

Open farm.html (and farm.html?season=winter) on desktop and at a phone width. Confirm that each of the eight animals walks with moving legs, faces the way it is going, returns to its sitting pose when it stops, never floats or sinks at the switch, and that the page stays smooth with all animals walking.
