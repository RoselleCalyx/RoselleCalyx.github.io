# Owner content coverage

Audit date: 10 October 2026. The owner workspace and public pages share the authenticated content service. The static files remain the fallback when the service cannot be reached.

| Public area | Owner controls | Public binding |
| --- | --- | --- |
| Identity and contact | Name, navigation brand, tagline, role, affiliation, location, email and footer | Shared header/footer, Home biography and links; Message delivery copy uses the current name |
| Public links | Scholar, LinkedIn, GitHub, CV URL; additional named links with icons, ordering and removal | Fixed social links on Home; additional links in the About section |
| Page presentation | Titles, introductions, navigation labels and metadata descriptions for Home, Papers, Gallery, Message, Starmap, Voyager, Farm, Woods and Pond | Shared navigation, page headings, document titles and live document metadata; Home uses its hero fields for the visible welcome |
| Home welcome and biography | Hero title/introduction/footer, biography paragraphs, interests, portrait upload/crop and alternative text, beyond-the-lab text, closing text | Home welcome and About area |
| Home structure | Section labels; show or hide About, Education, News and Explore; finale date/title/text | Existing sections retain their content when hidden; the Home story finale changes without changing animation timing |
| Education, news and exploration | Add, edit, reorder and remove education entries, linked news and destination cards | Home lists and cards |
| Papers | Title, ordered authors, venue, year, type, topics, selected state, abstract, cover and additional figures, captions, alternative text, PDF/code/project/data links and BibTeX | Searchable paper cards, filters, image viewer and citations |
| Albums and photos | Album identity, place, title, month, coordinates, tags, favorite state, story; images, captions, individual photo stories, alternative text and painted placeholders | Gallery timeline, wall, map and image viewer |
| Reversible publication | Show or hide a paper, album or curated note without deleting it | Unpublished records are omitted from the public content response and from rendering; the owner retains all fields for later publication |
| Message page | Introductory kicker, writing placeholder, shared-notes introduction and empty-state text | Message form and shared-note list; delivery/privacy explanations remain consistent with actual transport behavior |
| Public bottles | Add, edit, reorder, hide or remove curated sender/date/text/reply records | Shared notes only; private incoming letters are never published automatically |
| Original farm residents and keeper | Species, name, keeper title/note, adopter, month and note; add residents; send indoors or let outside | Farm characters, labels and keeper card; keeper identity is reused in the Woods and Pond companion copy |
| Approved visitor animals | Edit species, name, adopter, month and note; reversible indoor/outdoor state | Authenticated resident management with revision checks; the public farm receives only active approved animals |
| Incoming requests | Read/unread, work status, private owner notes; approve or decline adoption requests; open the approved animal editor | Owner-only inbox and resident endpoints |
| Starmap | Observer place, latitude and longitude, page heading/introduction | Sky position and page copy |
| Voyager | Stop identity, date, place, title, poem, mission fact/source, body, chapter, color/map position, scene image/descriptions/effects | Timeline, journey map, field notes and scene imagery |

## Compatibility and publication behavior

- New presentation fields are optional. Existing saved documents remain valid; missing fields keep the established presentation. Missing publication flags mean visible, preserving older papers, albums and notes.
- Hiding a section or entry is reversible. It does not delete its owner draft. Uploaded media URLs remain public assets; hiding a record does not revoke an image URL that was already shared.
- Saving uses the existing revision check. A stale owner session cannot silently overwrite a newer publication. Private letters, owner notes and credentials are outside the public content schema.
- Metadata is updated in the rendered document after public content loads. Static HTML still provides the offline and no-JavaScript fallback; search engines or link preview services that do not execute JavaScript may retain that fallback.

## Kept in code deliberately

The audit separates personal/editorial content from application mechanics. Star catalogs and constellation coordinates, astronomical calculations, the Home mission timeline's timing, animal art/animation definitions, crop presets, fish and forage catalogs, seasons, game rules and visitor progress remain maintained in code. Changing these through ordinary text fields could invalidate interactions or scientific behavior. Page buttons, error messages, accessibility controls and explanations of privacy/delivery also remain application copy rather than arbitrary owner text.

Service endpoints, database configuration, challenge keys, authentication credentials and notification destinations remain deployment settings. The public editor cannot change the login service or expose secrets. The CV control accepts a published URL or existing site asset path; the image uploader handles images rather than arbitrary documents.
