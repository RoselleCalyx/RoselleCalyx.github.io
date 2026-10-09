# Quiet Shore message backend

Plain JavaScript Cloudflare Worker + private D1 inbox + Telegram notification outbox. No application npm dependencies are needed. The parent site's `docs/message-cloudflare-setup.md` contains the Chinese setup guide.

## Deploy after creating a Cloudflare account

Run these commands from this directory. `npx` obtains the official Wrangler CLI; none of these cloud commands were run during implementation.

```sh
npx wrangler login
npx wrangler d1 create message-inbox
```

Copy the returned `database_id` into `wrangler.jsonc`. Confirm `ALLOWED_ORIGIN`, `HOST_EMAIL`, and `INBOX_URL`, then run:

```sh
npx wrangler d1 migrations apply message-inbox --remote
npx wrangler deploy
npx wrangler secret put HOST_PASSWORD
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

The first deployment creates the Worker. Until `HOST_PASSWORD` is set, every API request fails closed with HTTP 503. Enter secrets at Wrangler's prompt; never paste them into this repository, frontend configuration, or command arguments. The password must contain at least 16 characters; use a long random password. `HOST_EMAIL` is only the owner's login identifier, and sends no email.

For optional Turnstile protection, add the public site key to the site's `SITE.turnstileSiteKey`, allow the configured site's hostname in Turnstile, and run:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Once that secret is set, anonymous new submissions require a valid token with action `message` and the configured origin's hostname. The Worker verifies it through Cloudflare Siteverify.

Set the deployed `https://quiet-shore-messages.…workers.dev` base URL in the site's message API configuration. The D1 database has no public REST endpoint. Only the Worker may read its binding. Local secrets, when needed for Wrangler development, belong in ignored `.dev.vars`.

## Local tests

```sh
node --test tests/worker.test.js
```

Node 22.13 or newer is required for the built-in `node:sqlite` test adapter. Tests execute the real migration and SQL in memory through a D1-compatible wrapper. All Telegram and Turnstile requests are mocked; the tests send no real notifications. Wrangler, a Cloudflare account, and network access are not required for these tests.

## API

All requests, including host requests and command-line checks, must supply the exact configured `Origin`. JSON bodies are capped at 8 KB while streaming. Responses never permit wildcard origins or cookie credentials.

| Method | Path | Body / response |
| --- | --- | --- |
| POST | `/api/messages` | `{name?,contact?,text,submissionId?,website?,turnstileToken?}` → `{ok:true,id}` only after D1 commit |
| POST | `/api/host/login` | `{email,password}` → `{access_token,refresh_token,expires_in,expires_at,user:{id:"host",email}}` |
| POST | `/api/host/refresh` | `{refresh_token}` → a rotated token pair and the same session shape |
| POST | `/api/host/logout` | Bearer access token → `{ok:true}` and both tokens revoked |
| GET | `/api/host/me` | Bearer access token → `{id:"host",email}` |
| GET | `/api/host/messages?limit=100&offset=0` | Bearer access token → private letter rows |
| PATCH | `/api/host/messages/{id}` | Bearer access token + `{read_at:ISO timestamp}` → `[updatedRow]` |

Private rows expose only `id,created_at,name,contact,text,read_at`. Unsupported body fields, public reads, deletes, and message edits are rejected. Empty nickname/contact become `null`. Names allow 60 Unicode code points, contact 120, and trimmed text 2–500.

Keep the same UUID `submissionId` when retrying the same draft after an uncertain connection. A matching normalized payload returns the original ID; reusing that ID for different content returns HTTP 409. The submission ID cannot be used to retrieve a letter's content.

## Security and notification behavior

- Host password checks use SHA-256 digests and a constant-time comparison; the password is a Worker secret, not a browser credential or database column. Access and refresh tokens contain 256 random bits; D1 stores only their SHA-256 hashes. Access lasts one hour. The refresh session expires seven days after login, and refresh rotation consumes the old token with one atomic conditional SQL update.
- D1 enforces fixed-window limits per HMAC-SHA-256 IP hash: anonymous new letters 5/10 minutes, login 5/15 minutes, refresh 30/15 minutes. The HMAC key comes from the secret host password; raw IP addresses are not stored. Limits may allow short bursts at a window boundary. CORS is browser origin control; non-browser clients can set an Origin header, so the server limits and optional Turnstile remain relevant.
- A letter and its notification outbox entry are saved in one D1 `batch()` transaction. Telegram is attempted after commit and cannot turn a saved letter into a failed submission. Missing Telegram secrets leave durable records pending. A five-minute Cron Trigger retries failures with backoff and honors Telegram `retry_after` responses. An atomic one-minute lease avoids concurrent workers sending the same batch.
- Each Telegram notification contains only a count and the host inbox URL, with no sender name, contact, or letter text. Notification failure records contain only generic codes, never bot-token URLs. Telegram reminders are at least once: a network interruption after Telegram acceptance or a database failure while marking delivery can cause a repeated reminder. Original letters stay in D1.
- Closing the site's inbox does not stop server notifications. Cloud cron execution, connectivity, free quotas, and Telegram delivery cannot guarantee an exact arrival time. This code has not been deployed or tested against a real D1 database yet.

Official references: [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Turnstile verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage).
