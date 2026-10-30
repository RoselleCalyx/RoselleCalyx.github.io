# Home visual assets

Generated with the built-in imagegen tool. Output: assets/home-galaxy.webp.

## Final generation prompt

Use case: stylized-concept. Asset type: cinematic astronomy background for a personal homepage, wide 16:9 landscape. Primary request: an epic, richly detailed but natural Milky Way starfield. Composition: left 55 percent mostly near-black deep navy space, sparse delicate stars, generous quiet negative space for a separate Saturn and typography. The luminous Milky Way runs diagonally from upper right at 85 percent width to lower middle-right at 63 percent width. Intricate branching interstellar dust lanes, millions of tiny resolved stars, softly luminous ivory and amber galactic core with restrained violet and cobalt nebular clouds. Lighting: photographic long-exposure astrophotography meets premium cinematic space concept art, subtle contrast, velvet blacks, breathtaking scale. No planets, no moons, no spacecraft, no landscape, no people, no text, no watermark. Avoid oversized stars, rainbow nebulae, spiral galaxy shapes, cartoon glowing blobs. The lower edge should fall to dark navy to composite behind an existing golden mountain landscape.

The foreground is the existing home-landscape.webp, feathered non-destructively in canvas. The Cassini flight is an artistic projection, not mission ephemeris.

## October 30 · fixed mobile composition

Phone framing now fits the atmospheric passage and both observers from the
opening, rather than panning the whole painting up to 140 px during approach.
`HOME_FRAME` limits the narrow-screen scale to a protected source interval
(x=245..795 with side margins); the galaxy extends above the smaller painting.
The shared frame still drives the planet, all flight effects, the landscape and
its contour mask. It stays fixed throughout forward and reverse scrolling.
The opening craft has a separate, visible mobile anchor and remains large.
Short phones use more compact opening typography and a single row of links;
short landscape screens crop some lower flowers to keep entry below the header.
The portrait farewell copy occupies the upper sky rather than covering the
retained light at the entry location.
The existing stable art height continues to prevent browser toolbars from
resizing the scene during a swipe. Wide desktop framing and orbital dynamics
are unchanged.

`tests/home-composition.test.cjs` checks entry/wake clearance, observer contours,
painting coverage, fixed framing, the opening anchor and desktop parity over
phone, landscape and tablet sizes. The interactive
`tests/home-mobile-composition-preview.html` previews phases and plays the actual
scroll-driven finale while measuring foreground position changes.
The focused home/flight/occlusion/input/handoff suite passes 101 checks. Browser
previews cover 320×568 and 390×844 portrait plus 844×390 landscape; continuous
finale playback measures zero horizontal and vertical foreground movement.

## October 9 integration with Claude's 716f583

Keep Claude's separate inner-ring canvas and dissolve into the bio. Restore the galaxy's colour and contrast (saturation 1.12, brightness 1.08, contrast 1.07), delay the downward fade until below 64% of the viewport, and narrow the deep-space veil around Saturn. A feathered, pointer-transparent shade inside the opening UI sits above the inner rings, protecting the left copy and social links while fading out with them. Its closest-side gradient reaches full transparency at its boundaries, avoiding a rectangular edge across Saturn. The right quote has a smaller soft shade; mobile uses its own copy shade and galaxy crop.

`tests/home-runtime.cjs` requires Playwright, local Chrome and a static server on port 4173 (or HOME_PREVIEW_URL). It captures desktop/mobile, flight and the bio handoff, and checks the finale, opening-copy fade, calm mode, mobile overflow and script errors. Screenshots are written to `/tmp/home-epic-qa`. `--live` also reads the public homepage and farm deployment; `--baseline` captures the unmodified treatment.

The public deployment inspected during this integration included Claude's feeding and inner-ring changes, but did not reference `js/farm-motion.js` or the distance-driven gait. Those animal changes are integrated locally with this revision; this inspection does not confirm their deployment.
