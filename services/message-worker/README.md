# Quiet Shore message backend

Plain JavaScript Cloudflare Worker + private D1 inbox + shared farm + owner content management + Telegram notification outbox. No application npm dependencies are needed. The parent site's `docs/message-cloudflare-setup.md` contains the Chinese setup guide.

## Deploy after creating a Cloudflare account

The production Worker was deployed on 2026-10-10 at `https://quiet-shore-messages.quiet-shore-message-worker.workers.dev`; the configured D1 database and migration already exist. Reuse them for subsequent deployments. Telegram and Turnstile remain optional and unconfigured.

Run commands from this directory. Install the locked official Wrangler CLI first:

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler login --scopes account:read user:read workers_scripts:write d1:write
# Only when creating a new deployment/database:
pnpm exec wrangler d1 create message-inbox
```

Copy the returned `database_id` into `wrangler.jsonc`. Confirm `ALLOWED_ORIGIN`, `HOST_EMAIL`, and `INBOX_URL`, then run:

```sh
pnpm exec wrangler d1 migrations apply message-inbox --remote
pnpm exec wrangler deploy
pnpm exec wrangler secret put HOST_PASSWORD
# Optional Telegram notifications:
pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN
pnpm exec wrangler secret put TELEGRAM_CHAT_ID
```

The first deployment creates the Worker. Until `HOST_PASSWORD` is set, every API request fails closed with HTTP 503. Enter secrets at Wrangler's prompt; never paste them into this repository, frontend configuration, or command arguments. The password must contain at least 16 characters; use a long random password. `HOST_EMAIL` is only the owner's login identifier, and sends no email.

Alternatively, open the Worker's Dashboard **Settings** → **Runtime variables and secrets** → **Add variable**. Choose Production, set Key to `HOST_PASSWORD`, enter the password as Value, check Secret, and complete **Add 1 variable and deploy**. The password should be entered and submitted by the owner.

For optional Turnstile protection, add the public site key to the site's `SITE.turnstileSiteKey`, allow the configured site's hostname in Turnstile, and run:

```sh
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

Once that secret is set, anonymous new submissions require a valid token with action `message` and the configured origin's hostname. The Worker verifies it through Cloudflare Siteverify.

Set the deployed `https://quiet-shore-messages.…workers.dev` base URL in the site's message API configuration. The D1 database has no public REST endpoint. Only the Worker may read its binding. Local secrets, when needed for Wrangler development, belong in ignored `.dev.vars`.

## Local tests

```sh
node --test tests/*.test.js
```

Node 22.13 or newer is required for the built-in `node:sqlite` test adapter. Tests execute the real migration and SQL in memory through a D1-compatible wrapper. All Telegram and Turnstile requests are mocked; the tests send no real notifications. Wrangler, a Cloudflare account, and network access are not required for these tests.

## API

All requests, including host requests and command-line checks, must supply the exact configured `Origin`. JSON bodies are capped at 8 KB while streaming, except the owner content save endpoint, which allows one MiB. Responses never permit wildcard origins or cookie credentials.

| Method | Path | Body / response |
| --- | --- | --- |
| POST | `/api/messages` | `{name?,contact?,text,submissionId?,website?,turnstileToken?}` → `{ok:true,id}` only after D1 commit |
| POST | `/api/host/login` | `{email,password}` → `{access_token,refresh_token,expires_in,expires_at,user:{id:"host",email}}` |
| POST | `/api/host/refresh` | `{refresh_token}` → a rotated token pair and the same session shape |
| POST | `/api/host/logout` | Bearer access token → `{ok:true}` and both tokens revoked |
| GET | `/api/host/me` | Bearer access token → `{id:"host",email}` |
| GET | `/api/host/messages?limit=100&offset=0` | Bearer access token → private letter rows |
| PATCH | `/api/host/messages/{id}` | Bearer access token + any nonempty subset of `{read_at:ISO timestamp|null,status:"new"|"done"|"archived",host_note:string}` → `[updatedRow]` |
| GET | `/api/site-content` | Public presentation overlay → `{ok:true,revision,updatedAt,content}` |
| GET | `/api/host/site-content` | Bearer access token → the same content envelope |
| PUT | `/api/host/site-content` | Bearer access token + `{revision,content}` → the committed content envelope |
| GET | `/api/host/farm/adoptions?status=approved` | Bearer access token → approved visitor residents, with UUID `id` values |
| GET | `/api/host/farm/residents` | Bearer access token → approved animals including those resting indoors |
| PATCH | `/api/host/farm/residents/{UUID}` | Bearer access token + `{version,...changes}` → confirmed animal details and incremented version |
| DELETE | `/api/host/farm/residents/{UUID}` | Bearer access token → `{ok:true,deleted:true}` after retiring an approved visitor resident |

Private message rows expose `id,created_at,name,contact,text,read_at,status,host_note`. Owner notes allow 2,000 Unicode code points and remain private. Unsupported body fields, public message reads, deletes, and edits to a visitor's submitted text are rejected. Empty nickname/contact become `null`. Names allow 60 Unicode code points, contact 120, and trimmed text 2–500.

Keep the same UUID `submissionId` when retrying the same draft after an uncertain connection. A matching normalized payload returns the original ID; reusing that ID for different content returns HTTP 409. The submission ID cannot be used to retrieve a letter's content.

## Owner content management

Apply all migrations in order before deploying this version. `0003_owner_content.sql` creates the public overlay and adds the private request status/note columns; it preserves existing letters and sessions. The original inbox deployment does not provide the new content endpoints until the migration and updated Worker have both been deployed.

`0004_farm_species.sql` expands adoption support to red pandas, raccoons, wolves, crocodiles, and fennec foxes. It preserves existing adoption submissions and review statuses. Apply it before deploying the Worker so the database accepts these species.

The empty database returns revision `0`, `updatedAt: null`, and `content: {}`. The website uses its checked-in defaults for sections absent from this overlay. An authenticated save replaces the complete overlay with one atomic D1 update, increments the revision, and publishes the returned content immediately. Send the revision from the most recent read. HTTP 409 `content_conflict` means another session saved first; reload and reconcile the latest content before retrying. A failed database write never reports success or changes the published content. A network interruption after commit can leave the caller uncertain; reread the latest revision before deciding to retry.

The supported public sections are:

- `site`: identity/contact text, the four `links` keys `scholar`, `linkedin`, `github`, `cv`, observer place/latitude/longitude, footer, and page title/subtitle pairs.
- `home`: hero title/lede, biography paragraphs, interests, beyond-the-lab text, portrait URL, education, news, explore cards, coda, and hero footer.
- `papers`: full publications/projects including authors, venue/year/type/topics, selected flag, cover image, abstract, PDF/code/project/data links, BibTeX, and `figures: [{src,caption}]`.
- `gallery`: albums, coordinates/tags, story, favorite flag, photo URLs/captions and supported painted placeholders.
- `bottles`: explicitly curated public letters and replies. Private inbox letters never enter this section automatically.
- `farm`: keeper and baseline residents, with at most 24 residents including approved visitor additions. CMS edits that exceed the combined capacity return HTTP 409 `farm_capacity` without changing the published revision.
- `voyager`: at least one stop, supported celestial bodies, chapters 0–3, exactly two title lines, mission text, dates (or `null` for the epilogue), image/scene metadata, source links, and scene flags.

`src/site-content.js` defines the exact field allowlists and size/shape limits. Unknown fields, credentials, infrastructure settings (`messageApi`, `formEndpoint`, `supabase`, Turnstile keys), unsafe schemes such as `javascript:`/`data:`, protocol-relative URLs, and URL credentials are rejected. Image fields accept relative paths or HTTP/HTTPS URLs; binary uploads are not stored by this endpoint. Total request bytes, traversal depth, array sizes, text lengths, coordinates, IDs, and enum values are bounded server-side.

Content and private request handling share the existing owner session. The public content endpoint exposes only the saved presentation overlay; it never queries messages, owner notes, sessions, farm pending requests, visitor credentials, or notification records. PUT CORS is permitted for the owner content path while unsupported routes still reject writes.

Approved visitor residents are managed separately from CMS baseline residents. Listing `status=approved` returns the same adoption UUIDs used for reviews. The authenticated resident removal endpoint preserves the adoption request record, changes its status to `rejected`, records the removal time in `reviewed_at`, frees its place, and immediately excludes it from public farm snapshots. Pending/rejected/unknown IDs return HTTP 404 `resident_not_found`; removed requests cannot be approved again. A repeated removal returns 404, so refresh the approved list after an uncertain connection. No visitor credential can authorize owner moderation.

`0006_resident_management.sql` adds `active`, `version`, and an editable `since` month without replacing adoption records. In the owner's Animals tab, resting uses `active:false` while the adoption stays approved; restoring uses `active:true`. Both indoor and outdoor animals retain their places in the 24-resident capacity. CMS baseline residents also accept optional `active` (omitted means outdoors).

The resident PATCH accepts a required nonnegative integer `version` and at least one of `species`, `name`, `adoptedBy`, `note`, `since`, or `active`. Success returns `{id,species,name,adoptedBy,note,since,active,version,created_at}` with the next version; a concurrent update returns HTTP 409 `resident_conflict`. The public farm includes only outdoor approved residents and never returns management versions or visitor credentials. Apply the migration before deploying this Worker.

## Security and notification behavior

- Host password checks use SHA-256 digests and a constant-time comparison; the password is a Worker secret, not a browser credential or database column. Access and refresh tokens contain 256 random bits; D1 stores only their SHA-256 hashes. Access lasts one hour. The refresh session expires seven days after login, and refresh rotation consumes the old token with one atomic conditional SQL update.
- D1 enforces fixed-window limits per HMAC-SHA-256 IP hash: anonymous new letters 5/10 minutes, login 5/15 minutes, refresh 30/15 minutes. The HMAC key comes from the secret host password; raw IP addresses are not stored. Limits may allow short bursts at a window boundary. CORS is browser origin control; non-browser clients can set an Origin header, so the server limits and optional Turnstile remain relevant.
- A letter and its notification outbox entry are saved in one D1 `batch()` transaction. Telegram is attempted after commit and cannot turn a saved letter into a failed submission. Missing Telegram secrets leave durable records pending. A five-minute Cron Trigger retries failures with backoff and honors Telegram `retry_after` responses. An atomic one-minute lease avoids concurrent workers sending the same batch.
- Each Telegram notification contains only a count and the host inbox URL, with no sender name, contact, or letter text. Notification failure records contain only generic codes, never bot-token URLs. Telegram reminders are at least once: a network interruption after Telegram acceptance or a database failure while marking delivery can cause a repeated reminder. Original letters stay in D1.
- Closing the site's inbox does not stop server notifications. Cloud cron execution, connectivity, free quotas, and Telegram delivery cannot guarantee an exact arrival time. The Worker and D1 migration have been deployed; Telegram delivery has not yet been configured or verified.

Official references: [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Turnstile verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage).
