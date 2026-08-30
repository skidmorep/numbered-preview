# JP Cuts website

A password-protected, no-index working preview with one shared content model, owner editing, approved JP photography, and the selected **The Chair** design. Warm tan carries the page while camo remains a restrained accent.

Private preview: <https://dev.jpcuuts.com/>

Editor: <https://dev.jpcuuts.com/admin/>

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

Remote visual and editor checks require an owner session or the existing owner credentials and test-video path.

## Content and media rules

- The editor supports the hero headline and booking label, notes for the two approved services, approved replacement photos, the before/after heading, and the event-form button label.
- The approved Instagram Reel is fixed and embedded on the homepage.
- The public page omits JP's phone number and email address. Event inquiries use the accordion form and the Worker keeps the delivery address server-side.
- Images must be JPEG, PNG, WebP, or AVIF and no larger than 6 MB.
- Videos must be MP4 or WebM and no larger than 15 MB.
- Images require alt text before upload.
- Empty optional sections stay hidden.
- Published content writes a new revision; simultaneous stale saves are rejected.

Content version 4 is a one-time correction release. When version 3 content loads, it preserves the selected hero headline and replaces the old brand name, location, booking destination, services, bio, event copy, social links, featured Reel, and homepage media with the approved JP Cuts values. This intentionally removes stale owner edits that conflict with the corrected source material.

## Media source

JP approved the selected client, wedding, and team photographs in the shared Dropbox project folder. Optimized derivatives belong in `public/media/defaults`; the source originals remain untouched. `media-sources.json` records the approved source and derivative hash for each shipped homepage asset.

## Account handoff and recovery

- Owners sign in with their email address and password.
- The login screen links to `/forgot-password/`, where the user requests a reset link by email. Normal sign-in never uses email OTP.
- The public response does not reveal whether an account exists. Requests are throttled by hashed email and IP keys.
- Reset links expire after 30 minutes and work once. The raw token stays in the URL fragment, is moved into the reset form in the browser, and is never sent in a GET request or stored in D1.
- D1 stores only the token hash. A successful reset atomically consumes the token, revokes existing sessions, and invalidates older unused tokens.
- The user must complete a fresh login after resetting the password.
- `/claim/` remains an operator-assisted fallback for an existing private recovery code, but it is not linked from the login screen.
- The owner can add another owner from the editor after confirming the person's email address.

Password reset and contact delivery use the existing `RESEND_API_KEY` Worker secret. `CONTACT_EMAIL_FROM` and `CONTACT_EMAIL_TO` are server-only Worker variables; the recipient never enters the public content payload or HTML. Apply D1 migrations before deploying:

```sh
npm run cf:migrate:remote
wrangler secret put RESEND_API_KEY
npm run cf:deploy
```
