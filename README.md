# JP Cuts website

A password-protected, no-index working preview with one shared content model, owner editing, approved JP photography, and the selected **The Chair** design. Warm tan carries the page while camo remains a restrained accent.

Private preview: <https://dev.jpcuuts.com/>

Editor: <https://dev.jpcuuts.com/admin/>

Production: <https://jpcuuts.com/>

## Release boundary

- `dev.jpcuuts.com` runs on the isolated review Worker configured by the default `wrangler.toml`.
- `jpcuuts.com` and `www.jpcuuts.com` run on the production Worker configured by `wrangler.production.toml`.
- All design and content changes deploy to dev first with `npm run cf:deploy:dev`.
- Production deploys only after explicit approval with `npm run cf:deploy:production`.
- There is intentionally no ambiguous `cf:deploy` command.
- A bare `wrangler deploy` targets dev, never production.

## Architecture

- React and Vite render the public site and editor.
- D1-backed email/password sessions protect the complete preview origin, including direct content and media URLs.
- One content record drives the selected public design.
- The public site is mobile-first and scales through tablet and desktop without a layout switcher.
- A Cloudflare Worker serves the app, content API, authenticated editor API, and uploaded media.
- D1 stores users, sessions, current content, and revision history.
- Resend sends password-reset links from the verified `parabolos.com` domain. Its API key is a Worker secret and is never stored in source.
- A private R2 bucket stores uploaded images and videos; the Worker validates and serves them.
- Booking goes to JP's Calendly. This app does not store card data or manage availability.

## Local development

```sh
npm install
npm run cf:migrate:local
npm run build
wrangler dev
```

Run the release checks:

```sh
npm run lint
npm test
npm run build
npm run test:chair
npm run test:foundation
```

Remote visual and editor checks require an owner session or the existing owner credentials.

## Content and media rules

- The editor supports the hero headline and booking label, structured Faded University/Lipscomb details, an authentic-logo upload slot, notes for the two approved services, approved replacement photos, per-image focus points, the before/after heading, and the event-form button label.
- The selected Instagram Reel stays available in the editor but remains unpublished by default. The public site never embeds Instagram.
- The public page omits JP's phone number and email address. Event inquiries use the accordion form and the Worker keeps the delivery address server-side.
- Images must be JPEG, PNG, WebP, or AVIF and no larger than 6 MB.
- Videos must be MP4 or WebM and no larger than 15 MB.
- Images require alt text before upload.
- Each published image carries a numeric `focus` point from 0–100 on both axes. Legacy owner media is normalized one asset at a time so URLs, alt text, array order, and copy remain intact.
- Empty optional sections stay hidden.
- Published content writes a new revision; simultaneous stale saves are rejected.

Content version 6 preserves the owner’s story, headline, media URLs, ordering, alt text, focus points, contact details, and permitted social fields while adding structured Faded University/Lipscomb availability and the authentic-logo slot. Older correction-era content still receives the protected JP Cuts identity, Calendly destination, approved services, and unpublished Reel state.

## Media source

JP approved the selected client, wedding, and team photographs in the shared Dropbox project folder. Optimized derivatives belong in `public/media/defaults`; the source originals remain untouched. `media-sources.json` records the approved source and derivative hash for each shipped homepage asset.

## Account handoff and recovery

- Owners sign in with their email address and password.
- The root and admin login shells post explicitly to `/login/`, then return only to the allowlisted public or admin destination. Signing out clears that session without invalidating another active owner context.
- The login screen links to `/forgot-password/`, where the user requests a reset link by email. Normal sign-in never uses email OTP.
- The public response does not reveal whether an account exists. Login, reset, and contact requests reserve hashed identifier/IP attempts atomically in D1 before password verification or email work. Login also has a global per-IP ceiling across identifiers.
- Reset links expire after 30 minutes and work once. The raw token stays in the URL fragment, is moved into the reset form in the browser, and is never sent in a GET request or stored in D1.
- D1 stores only the token hash. A successful reset atomically consumes the token, revokes existing sessions, and invalidates older unused tokens.
- Content state and its revision receipt commit in one D1 batch; a stale or racing save receives `409` without overwriting owner edits.
- The user must complete a fresh login after resetting the password.
- `/claim/` remains an operator-assisted fallback for an existing private recovery code, but it is not linked from the login screen.
- The owner can add another owner from the editor after confirming the person's email address.

Password reset and contact delivery use the existing `RESEND_API_KEY` Worker secret. `CONTACT_EMAIL_FROM` and `CONTACT_EMAIL_TO` are server-only Worker variables; the recipient never enters the public content payload or HTML. Apply D1 migrations before deploying:

```sh
npm run cf:migrate:remote
wrangler secret put RESEND_API_KEY
npm run cf:deploy:dev
```
