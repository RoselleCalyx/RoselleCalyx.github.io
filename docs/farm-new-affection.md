# New animal interactions

Generated with built-in imagegen using each existing character as its identity reference, then exported with the established `scripts/export-affection.cjs` workflow. Each transparent WebP contains sixteen 384 × 384 frames, aligned to the same 360 px ground anchor as existing animals.

| Animal | Runtime sprite sheet | Final prompt |
| --- | --- | --- |
| Red panda | `assets/farm/affection/redpanda-v4.webp` | [prompt](affection-new-a-prompts.json) |
| Raccoon | `assets/farm/affection/raccoon-v4.webp` | [prompt](affection-new-a-prompts.json) |
| Wolf | `assets/farm/affection/wolf-v4.webp` | [prompt](affection-new-b-prompts.json) |
| Crocodile | `assets/farm/affection/crocodile-v4.webp` | [prompt](affection-crocodile-prompts.json) |
| Fennec fox | `assets/farm/affection/fennec-v4.webp` | [prompt](affection-new-b-prompts.json) |

Frames 0–3 show sniffing and chewing, 4–7 greetings or tail movement, 8–11 leaning in with contented eyes, and 12–15 stretching and recovering. Feeding and petting use these actual painted body poses. The crocodile retains its waterline mask and heated winter refuge behavior. Source atlases are preserved in `assets/farm/affection/source/`; contact sheets are in `docs/*-v4.webp`.

Validation was limited to script syntax and one quick browser check of the five new species: chewing, petting, stretching and greetings all painted distinct frames, with the crocodile's water mask present and no script errors. No full regression suite was run for this addition.
